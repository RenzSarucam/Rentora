-- Rentora functions: authorization helpers, integrity triggers, transactional RPCs.
-- Every SECURITY DEFINER function pins search_path = '' and fully qualifies names.
-- Financial writes happen only here; authenticated users have no direct write grants on those tables.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create function private.manila_today() returns date
language sql stable set search_path = '' as $$
  select (now() at time zone 'Asia/Manila')::date
$$;

create function private.try_uuid(p text) returns uuid
language plpgsql immutable set search_path = '' as $$
begin
  return p::uuid;
exception when others then
  return null;
end
$$;

create function private.is_staff(p_org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = p_org and m.user_id = auth.uid()
      and m.role in ('owner', 'admin') and m.status = 'active'
  )
$$;

create function private.is_member(p_org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = p_org and m.user_id = auth.uid() and m.status <> 'archived'
  )
$$;

-- True when the member row belongs to the caller (any status: past boarders keep read access to their history).
create function private.owns_member(p_member uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.organization_members m where m.id = p_member and m.user_id = auth.uid()
  )
$$;

-- True when the caller is staff in an organization the given user belongs to.
create function private.is_staff_of_user(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.organization_members target
    where target.user_id = p_user and private.is_staff(target.organization_id)
  )
$$;

create function private.assert_staff(p_org uuid) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_org is null or not private.is_staff(p_org) then
    raise exception 'Not authorized for this organization' using errcode = '42501';
  end if;
end
$$;

create function private.log(p_org uuid, p_action text, p_entity_type text, p_entity_id uuid, p_metadata jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = '' as $$
  insert into public.audit_logs (organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (p_org, auth.uid(), p_action, p_entity_type, p_entity_id, coalesce(p_metadata, '{}'::jsonb))
$$;

create function private.next_number(p_org uuid, p_kind text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_seq integer;
  v_year text := to_char(private.manila_today(), 'YYYY');
begin
  if p_kind = 'invoice' then
    update public.organizations set next_invoice_seq = next_invoice_seq + 1
      where id = p_org returning next_invoice_seq - 1 into v_seq;
    return 'INV-' || v_year || '-' || lpad(v_seq::text, 6, '0');
  else
    update public.organizations set next_receipt_seq = next_receipt_seq + 1
      where id = p_org returning next_receipt_seq - 1 into v_seq;
    return 'OR-' || v_year || '-' || lpad(v_seq::text, 6, '0');
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Generic triggers
-- ---------------------------------------------------------------------------
create function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, coalesce(new.email, ''), left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120))
  on conflict (id) do nothing;
  return new;
end
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

create function private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end
$$;
create trigger profiles_touch before update on public.profiles for each row execute function private.touch_updated_at();
create trigger maintenance_touch before update on public.maintenance_requests for each row execute function private.touch_updated_at();
create trigger announcements_touch before update on public.announcements for each row execute function private.touch_updated_at();

-- Records who changed which columns. Values are deliberately not copied into the log.
create function private.audit_row() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_row jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_org uuid := case when tg_table_name = 'organizations' then (v_row ->> 'id')::uuid else (v_row ->> 'organization_id')::uuid end;
  v_changed jsonb := '[]'::jsonb;
begin
  if tg_op = 'UPDATE' then
    select coalesce(jsonb_agg(n.key), '[]'::jsonb) into v_changed
    from jsonb_each(to_jsonb(new)) n
    where n.key not in ('updated_at', 'next_invoice_seq', 'next_receipt_seq')
      and n.value is distinct from (to_jsonb(old) -> n.key);
    if jsonb_array_length(v_changed) = 0 then
      return new;
    end if;
  end if;
  perform private.log(v_org, tg_table_name || '.' || lower(tg_op), tg_table_name, (v_row ->> 'id')::uuid,
    case when tg_op = 'UPDATE' then jsonb_build_object('changed', v_changed) else '{}'::jsonb end);
  return case when tg_op = 'DELETE' then old else new end;
end
$$;
create trigger audit_organizations after update on public.organizations for each row execute function private.audit_row();
create trigger audit_properties after insert or update or delete on public.properties for each row execute function private.audit_row();
create trigger audit_rooms after insert or update or delete on public.rooms for each row execute function private.audit_row();
create trigger audit_beds after insert or update or delete on public.beds for each row execute function private.audit_row();
create trigger audit_members after insert or update on public.organization_members for each row execute function private.audit_row();
create trigger audit_announcements after insert or update or delete on public.announcements for each row execute function private.audit_row();
create trigger audit_maintenance after insert on public.maintenance_requests for each row execute function private.audit_row();

-- ---------------------------------------------------------------------------
-- Rooms and beds integrity
-- ---------------------------------------------------------------------------
create function private.check_bed_capacity() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_capacity smallint;
  v_room_archived timestamptz;
  v_count integer;
begin
  if new.archived_at is not null then
    return new;
  end if;
  -- Lock the room so concurrent bed inserts cannot both pass the count.
  select capacity, archived_at into v_capacity, v_room_archived
    from public.rooms where id = new.room_id for update;
  if v_room_archived is not null then
    raise exception 'Cannot add beds to an archived room' using errcode = '23514';
  end if;
  select count(*) into v_count from public.beds
    where room_id = new.room_id and archived_at is null and id <> new.id;
  if v_count + 1 > v_capacity then
    raise exception 'Room capacity of % beds reached', v_capacity using errcode = '23514';
  end if;
  return new;
end
$$;
create trigger beds_capacity before insert or update of archived_at, room_id on public.beds
  for each row execute function private.check_bed_capacity();

create function private.check_bed_archive() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.archived_at is not null and old.archived_at is null and exists (
    select 1 from public.boarder_assignments a where a.bed_id = new.id and a.move_out_date is null
  ) then
    raise exception 'Move the boarder out before archiving this bed' using errcode = '23514';
  end if;
  return new;
end
$$;
create trigger beds_archive before update of archived_at on public.beds
  for each row execute function private.check_bed_archive();

create function private.check_room_update() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_count integer;
begin
  select count(*) into v_count from public.beds where room_id = new.id and archived_at is null;
  if new.archived_at is null and new.capacity < v_count then
    raise exception 'Capacity cannot be lower than the % active beds in this room', v_count using errcode = '23514';
  end if;
  if new.archived_at is not null and old.archived_at is null then
    if exists (
      select 1 from public.boarder_assignments a join public.beds b on b.id = a.bed_id
      where b.room_id = new.id and a.move_out_date is null
    ) then
      raise exception 'Move all boarders out before archiving this room' using errcode = '23514';
    end if;
  end if;
  return new;
end
$$;
create trigger rooms_update before update on public.rooms
  for each row execute function private.check_room_update();

create function private.cascade_room_archive() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.archived_at is not null and old.archived_at is null then
    update public.beds set archived_at = new.archived_at where room_id = new.id and archived_at is null;
  end if;
  return new;
end
$$;
create trigger rooms_archive_cascade after update of archived_at on public.rooms
  for each row execute function private.cascade_room_archive();

create function private.check_assignment() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_bed record;
  v_member record;
begin
  select b.organization_id, b.status, b.archived_at, r.status as room_status, r.archived_at as room_archived
    into v_bed from public.beds b join public.rooms r on r.id = b.room_id where b.id = new.bed_id;
  select organization_id, role, status into v_member from public.organization_members where id = new.member_id;
  if v_member.organization_id is distinct from new.organization_id or v_bed.organization_id is distinct from new.organization_id then
    raise exception 'Bed and boarder must belong to the same organization' using errcode = '23514';
  end if;
  if v_member.role <> 'boarder' or v_member.status = 'archived' then
    raise exception 'Only current boarders can be assigned a bed' using errcode = '23514';
  end if;
  if v_bed.archived_at is not null or v_bed.room_archived is not null then
    raise exception 'This bed is archived' using errcode = '23514';
  end if;
  if v_bed.status <> 'active' or v_bed.room_status <> 'active' then
    raise exception 'This bed is under maintenance' using errcode = '23514';
  end if;
  return new;
end
$$;
create trigger assignments_check before insert on public.boarder_assignments
  for each row execute function private.check_assignment();

-- ---------------------------------------------------------------------------
-- Invoice totals: derived from items and live allocations, never typed in.
-- ---------------------------------------------------------------------------
create function private.recompute_invoice(p_invoice uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_total bigint;
  v_paid bigint;
  v_status public.invoice_status;
begin
  select status into v_status from public.invoices where id = p_invoice for update;
  if not found then
    return;
  end if;
  select coalesce(sum(amount_centavos), 0) into v_total from public.invoice_items where invoice_id = p_invoice;
  select coalesce(sum(pa.amount_centavos), 0) into v_paid
    from public.payment_allocations pa join public.payments p on p.id = pa.payment_id
    where pa.invoice_id = p_invoice and p.voided_at is null;
  if v_total < 0 then
    raise exception 'Discounts cannot exceed the invoice charges' using errcode = '23514';
  end if;
  if v_paid > v_total then
    raise exception 'Invoice total cannot be lower than the amount already paid' using errcode = '23514';
  end if;
  update public.invoices set
    total_centavos = v_total,
    amount_paid_centavos = v_paid,
    status = case
      when v_status = 'void' then 'void'::public.invoice_status
      when v_paid >= v_total then 'paid'
      when v_paid > 0 then 'partially_paid'
      else 'open' end
  where id = p_invoice;
end
$$;

create function private.on_invoice_item_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_invoice uuid := coalesce(new.invoice_id, old.invoice_id);
begin
  if exists (select 1 from public.invoices where id = v_invoice and status = 'void') then
    raise exception 'Void invoices cannot be changed' using errcode = '23514';
  end if;
  perform private.recompute_invoice(v_invoice);
  return null;
end
$$;
create trigger invoice_items_recompute after insert or update or delete on public.invoice_items
  for each row execute function private.on_invoice_item_change();

create function private.on_allocation_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_payment_amount bigint;
  v_allocated bigint;
begin
  select amount_centavos into v_payment_amount from public.payments where id = new.payment_id;
  select coalesce(sum(amount_centavos), 0) into v_allocated from public.payment_allocations where payment_id = new.payment_id;
  if v_allocated > v_payment_amount then
    raise exception 'Allocations exceed the payment amount' using errcode = '23514';
  end if;
  if (select organization_id from public.invoices where id = new.invoice_id) is distinct from new.organization_id then
    raise exception 'Invoice belongs to another organization' using errcode = '23514';
  end if;
  perform private.recompute_invoice(new.invoice_id);
  return null;
end
$$;
create trigger allocations_recompute after insert on public.payment_allocations
  for each row execute function private.on_allocation_insert();

create function private.block_mutation() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception '% rows are append-only', tg_table_name using errcode = '42501';
end
$$;
create trigger allocations_immutable before update or delete on public.payment_allocations
  for each row execute function private.block_mutation();
create trigger audit_logs_immutable before update or delete on public.audit_logs
  for each row execute function private.block_mutation();

-- Payments are immutable except for the one-way void.
create function private.guard_payment_update() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (to_jsonb(new) - array['voided_at', 'void_reason', 'voided_by']) is distinct from (to_jsonb(old) - array['voided_at', 'void_reason', 'voided_by'])
     or old.voided_at is not null then
    raise exception 'Payments cannot be edited; void and re-record instead' using errcode = '42501';
  end if;
  return new;
end
$$;
create trigger payments_guard before update on public.payments
  for each row execute function private.guard_payment_update();
create trigger payments_no_delete before delete on public.payments
  for each row execute function private.block_mutation();

-- ---------------------------------------------------------------------------
-- Maintenance request defaults
-- ---------------------------------------------------------------------------
create function private.prepare_maintenance_request() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  select m.organization_id into new.organization_id from public.organization_members m where m.id = new.member_id;
  select r.id into new.room_id
    from public.boarder_assignments a join public.beds b on b.id = a.bed_id join public.rooms r on r.id = b.room_id
    where a.member_id = new.member_id and a.move_out_date is null;
  new.status := 'open';
  new.resolved_at := null;
  return new;
end
$$;
create trigger maintenance_prepare before insert on public.maintenance_requests
  for each row execute function private.prepare_maintenance_request();

-- ---------------------------------------------------------------------------
-- RPC: rooms and assignments (staff only)
-- ---------------------------------------------------------------------------
create function public.create_room(
  p_property uuid, p_code text, p_floor text, p_capacity integer, p_rate_centavos bigint, p_notes text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid;
  v_room uuid;
  i integer;
begin
  select organization_id into v_org from public.properties where id = p_property and archived_at is null;
  perform private.assert_staff(v_org);
  insert into public.rooms (organization_id, property_id, code, floor, capacity, monthly_rate_centavos, notes)
    values (v_org, p_property, trim(p_code), nullif(trim(p_floor), ''), p_capacity, p_rate_centavos, nullif(trim(p_notes), ''))
    returning id into v_room;
  for i in 1 .. p_capacity loop
    insert into public.beds (organization_id, room_id, label, monthly_rate_centavos)
      values (v_org, v_room, 'Bed ' || chr(64 + i), p_rate_centavos);
  end loop;
  return v_room;
end
$$;

create function public.assign_bed(p_member uuid, p_bed uuid, p_move_in date, p_rent_centavos bigint)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid;
  v_id uuid;
begin
  select organization_id into v_org from public.beds where id = p_bed;
  perform private.assert_staff(v_org);
  if exists (select 1 from public.boarder_assignments where member_id = p_member and move_out_date is null) then
    raise exception 'This boarder already has a bed. Use transfer instead.' using errcode = '23505';
  end if;
  if exists (select 1 from public.boarder_assignments where bed_id = p_bed and move_out_date is null) then
    raise exception 'This bed is already occupied' using errcode = '23505';
  end if;
  insert into public.boarder_assignments (organization_id, member_id, bed_id, monthly_rent_centavos, move_in_date, created_by)
    values (v_org, p_member, p_bed, p_rent_centavos, p_move_in, auth.uid())
    returning id into v_id;
  -- An invited boarder who has been given a bed is still "invited" until they accept; nothing else to change.
  perform private.log(v_org, 'assignment.created', 'boarder_assignments', v_id,
    jsonb_build_object('member_id', p_member, 'bed_id', p_bed, 'move_in', p_move_in));
  return v_id;
end
$$;

create function public.end_assignment(p_assignment uuid, p_move_out date, p_reason text default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_row public.boarder_assignments;
begin
  select * into v_row from public.boarder_assignments where id = p_assignment for update;
  perform private.assert_staff(v_row.organization_id);
  if v_row.move_out_date is not null then
    raise exception 'This boarder has already moved out' using errcode = '23514';
  end if;
  update public.boarder_assignments set move_out_date = p_move_out, end_reason = nullif(trim(p_reason), '')
    where id = p_assignment;
  perform private.log(v_row.organization_id, 'assignment.ended', 'boarder_assignments', p_assignment,
    jsonb_build_object('move_out', p_move_out));
end
$$;

create function public.transfer_bed(p_member uuid, p_new_bed uuid, p_date date, p_rent_centavos bigint)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_current public.boarder_assignments;
  v_id uuid;
begin
  select * into v_current from public.boarder_assignments where member_id = p_member and move_out_date is null for update;
  if not found then
    raise exception 'This boarder has no current bed' using errcode = '23514';
  end if;
  perform private.assert_staff(v_current.organization_id);
  if v_current.bed_id = p_new_bed then
    raise exception 'Choose a different bed' using errcode = '23514';
  end if;
  if p_date < v_current.move_in_date then
    raise exception 'Transfer date cannot be before the current move-in date' using errcode = '23514';
  end if;
  update public.boarder_assignments set move_out_date = p_date, end_reason = 'Transferred'
    where id = v_current.id;
  insert into public.boarder_assignments (organization_id, member_id, bed_id, monthly_rent_centavos, move_in_date, created_by)
    values (v_current.organization_id, p_member, p_new_bed, p_rent_centavos, p_date, auth.uid())
    returning id into v_id;
  perform private.log(v_current.organization_id, 'assignment.transferred', 'boarder_assignments', v_id,
    jsonb_build_object('member_id', p_member, 'from_bed', v_current.bed_id, 'to_bed', p_new_bed, 'date', p_date));
  return v_id;
end
$$;

create function public.set_boarder_archived(p_member uuid, p_archived boolean)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_member public.organization_members;
begin
  select * into v_member from public.organization_members where id = p_member for update;
  perform private.assert_staff(v_member.organization_id);
  if v_member.role <> 'boarder' then
    raise exception 'Only boarders can be archived here' using errcode = '23514';
  end if;
  if p_archived then
    if exists (select 1 from public.boarder_assignments where member_id = p_member and move_out_date is null) then
      raise exception 'Record the move-out before archiving this boarder' using errcode = '23514';
    end if;
    update public.organization_members set status = 'archived', archived_at = now() where id = p_member;
  else
    update public.organization_members
      set status = case when exists (select 1 from public.invitations i where i.member_id = p_member and i.accepted_at is not null)
                        then 'active'::public.member_status else 'invited' end,
          archived_at = null
      where id = p_member;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- RPC: billing (staff only)
-- ---------------------------------------------------------------------------
-- Idempotent: re-running for the same month creates nothing new. Returns the number of invoices created.
create function public.generate_monthly_invoices(p_org uuid, p_period date, p_due date)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_period date := date_trunc('month', p_period)::date;
  v_period_end date := (date_trunc('month', p_period) + interval '1 month - 1 day')::date;
  v_issue date := private.manila_today();
  v_created integer := 0;
  v_invoice uuid;
  a record;
begin
  perform private.assert_staff(p_org);
  if p_due < v_issue and p_due < v_period then
    raise exception 'Due date is in the past' using errcode = '22023';
  end if;
  -- Serialize generation per organization.
  perform 1 from public.organizations where id = p_org for update;
  for a in
    select ba.id, ba.member_id, ba.monthly_rent_centavos, r.code as room_code, b.label as bed_label
    from public.boarder_assignments ba
    join public.beds b on b.id = ba.bed_id
    join public.rooms r on r.id = b.room_id
    where ba.organization_id = p_org
      and ba.monthly_rent_centavos > 0
      and ba.move_in_date <= v_period_end
      and (ba.move_out_date is null or ba.move_out_date >= v_period)
      and not exists (
        select 1 from public.invoices i
        where i.assignment_id = ba.id and i.period_month = v_period and i.kind = 'rent' and i.status <> 'void'
      )
    order by r.code, b.label
  loop
    insert into public.invoices (organization_id, member_id, assignment_id, kind, invoice_number, period_month, issue_date, due_date, created_by)
      values (p_org, a.member_id, a.id, 'rent', private.next_number(p_org, 'invoice'), v_period, least(v_issue, p_due), p_due, auth.uid())
      returning id into v_invoice;
    insert into public.invoice_items (organization_id, invoice_id, kind, description, amount_centavos)
      values (p_org, v_invoice, 'rent',
        'Rent for ' || to_char(v_period, 'FMMonth YYYY') || ' · Room ' || a.room_code || ', ' || a.bed_label,
        a.monthly_rent_centavos);
    v_created := v_created + 1;
  end loop;
  perform private.log(p_org, 'invoices.generated', 'invoices', null,
    jsonb_build_object('period', v_period, 'due', p_due, 'created', v_created));
  return v_created;
end
$$;

-- For deposits and one-off charges. p_items: [{"kind":"deposit","description":"...","amount_centavos":500000}]
create function public.create_invoice(p_member uuid, p_kind public.invoice_kind, p_due date, p_items jsonb, p_notes text default null)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_member public.organization_members;
  v_id uuid;
  v_item jsonb;
  v_issue date := private.manila_today();
begin
  select * into v_member from public.organization_members where id = p_member;
  perform private.assert_staff(v_member.organization_id);
  if v_member.role <> 'boarder' then
    raise exception 'Invoices are issued to boarders' using errcode = '23514';
  end if;
  if p_kind = 'rent' then
    raise exception 'Rent invoices are created by monthly generation' using errcode = '22023';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 20 then
    raise exception 'Add between 1 and 20 line items' using errcode = '22023';
  end if;
  insert into public.invoices (organization_id, member_id, assignment_id, kind, invoice_number, issue_date, due_date, notes, created_by)
    values (v_member.organization_id, p_member,
      (select id from public.boarder_assignments where member_id = p_member and move_out_date is null),
      p_kind, private.next_number(v_member.organization_id, 'invoice'), least(v_issue, p_due), p_due, nullif(trim(p_notes), ''), auth.uid())
    returning id into v_id;
  for v_item in select * from jsonb_array_elements(p_items) loop
    insert into public.invoice_items (organization_id, invoice_id, kind, description, amount_centavos)
      values (v_member.organization_id, v_id, (v_item ->> 'kind')::public.invoice_item_kind,
        trim(v_item ->> 'description'), (v_item ->> 'amount_centavos')::bigint);
  end loop;
  perform private.log(v_member.organization_id, 'invoice.created', 'invoices', v_id, jsonb_build_object('kind', p_kind));
  return v_id;
end
$$;

create function public.add_invoice_item(p_invoice uuid, p_kind public.invoice_item_kind, p_description text, p_amount_centavos bigint)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid;
  v_id uuid;
begin
  select organization_id into v_org from public.invoices where id = p_invoice;
  perform private.assert_staff(v_org);
  insert into public.invoice_items (organization_id, invoice_id, kind, description, amount_centavos)
    values (v_org, p_invoice, p_kind, trim(p_description), p_amount_centavos)
    returning id into v_id;
  perform private.log(v_org, 'invoice.item_added', 'invoices', p_invoice,
    jsonb_build_object('kind', p_kind, 'amount_centavos', p_amount_centavos));
  return v_id;
end
$$;

create function public.remove_invoice_item(p_item uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_item public.invoice_items;
begin
  select * into v_item from public.invoice_items where id = p_item;
  perform private.assert_staff(v_item.organization_id);
  if v_item.kind = 'rent' then
    raise exception 'The rent line is fixed. Add a discount, or void the invoice.' using errcode = '23514';
  end if;
  delete from public.invoice_items where id = p_item;
  perform private.log(v_item.organization_id, 'invoice.item_removed', 'invoices', v_item.invoice_id,
    jsonb_build_object('kind', v_item.kind, 'amount_centavos', v_item.amount_centavos));
end
$$;

create function public.void_invoice(p_invoice uuid, p_reason text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_inv public.invoices;
begin
  select * into v_inv from public.invoices where id = p_invoice for update;
  perform private.assert_staff(v_inv.organization_id);
  if v_inv.status = 'void' then
    raise exception 'Invoice is already void' using errcode = '23514';
  end if;
  if v_inv.amount_paid_centavos > 0 then
    raise exception 'Void the payments on this invoice first' using errcode = '23514';
  end if;
  if exists (select 1 from public.payment_submissions where invoice_id = p_invoice and status = 'pending') then
    raise exception 'Review the pending payment for this invoice first' using errcode = '23514';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'A reason is required' using errcode = '22023';
  end if;
  update public.invoices set status = 'void', voided_at = now(), void_reason = trim(p_reason) where id = p_invoice;
  perform private.log(v_inv.organization_id, 'invoice.voided', 'invoices', p_invoice, '{}'::jsonb);
end
$$;

-- ---------------------------------------------------------------------------
-- Payments
-- ---------------------------------------------------------------------------
-- Applies a payment to the preferred invoice first, then the member's oldest unpaid invoices.
create function private.post_payment(
  p_member uuid, p_amount bigint, p_method public.payment_method, p_reference text, p_received_on date,
  p_notes text, p_preferred_invoice uuid, p_submission uuid
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid;
  v_payment uuid;
  v_remaining bigint := p_amount;
  v_take bigint;
  inv record;
begin
  select organization_id into v_org from public.organization_members where id = p_member;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be greater than zero' using errcode = '22023';
  end if;
  -- Lock the member's open invoices in a stable order to prevent concurrent double-allocation.
  perform 1 from public.invoices
    where member_id = p_member and status in ('open', 'partially_paid') order by id for update;
  if p_amount > (select coalesce(sum(total_centavos - amount_paid_centavos), 0) from public.invoices
                 where member_id = p_member and status in ('open', 'partially_paid')) then
    raise exception 'Amount is more than the boarder''s outstanding balance' using errcode = '23514';
  end if;
  insert into public.payments (organization_id, member_id, amount_centavos, method, reference_number, received_on,
                               receipt_number, submission_id, notes, recorded_by)
    values (v_org, p_member, p_amount, p_method, nullif(trim(p_reference), ''), p_received_on,
            private.next_number(v_org, 'receipt'), p_submission, nullif(trim(p_notes), ''), auth.uid())
    returning id into v_payment;
  for inv in
    select id, total_centavos - amount_paid_centavos as balance
    from public.invoices
    where member_id = p_member and status in ('open', 'partially_paid')
    order by (id = p_preferred_invoice) desc, due_date, issue_date, invoice_number
  loop
    exit when v_remaining = 0;
    v_take := least(v_remaining, inv.balance);
    if v_take > 0 then
      insert into public.payment_allocations (organization_id, payment_id, invoice_id, amount_centavos)
        values (v_org, v_payment, inv.id, v_take);
      v_remaining := v_remaining - v_take;
    end if;
  end loop;
  if v_remaining <> 0 then
    raise exception 'Could not allocate the full payment' using errcode = '23514';
  end if;
  return v_payment;
end
$$;

create function public.record_payment(
  p_member uuid, p_amount_centavos bigint, p_method public.payment_method, p_reference text,
  p_received_on date, p_notes text default null, p_invoice uuid default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid;
  v_payment uuid;
begin
  select organization_id into v_org from public.organization_members where id = p_member and role = 'boarder';
  perform private.assert_staff(v_org);
  if p_received_on > private.manila_today() then
    raise exception 'Payment date cannot be in the future' using errcode = '22023';
  end if;
  if p_invoice is not null and not exists (select 1 from public.invoices where id = p_invoice and member_id = p_member) then
    raise exception 'Invoice does not belong to this boarder' using errcode = '23514';
  end if;
  v_payment := private.post_payment(p_member, p_amount_centavos, p_method, p_reference, p_received_on, p_notes, p_invoice, null);
  perform private.log(v_org, 'payment.recorded', 'payments', v_payment,
    jsonb_build_object('amount_centavos', p_amount_centavos, 'method', p_method));
  return v_payment;
end
$$;

create function public.submit_payment(
  p_invoice uuid, p_amount_centavos bigint, p_method public.payment_method, p_reference text, p_paid_on date, p_proof_path text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_inv public.invoices;
  v_member public.organization_members;
  v_outstanding bigint;
  v_pending bigint;
  v_id uuid;
begin
  select * into v_inv from public.invoices where id = p_invoice;
  select * into v_member from public.organization_members where id = v_inv.member_id;
  if v_member.user_id is distinct from auth.uid() or v_member.status = 'archived' then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if v_inv.status not in ('open', 'partially_paid') then
    raise exception 'This invoice is not awaiting payment' using errcode = '23514';
  end if;
  if p_paid_on > private.manila_today() or p_paid_on < private.manila_today() - 120 then
    raise exception 'Enter the date you paid' using errcode = '22023';
  end if;
  if p_proof_path is null or p_proof_path not like v_member.organization_id::text || '/' || v_member.id::text || '/%' then
    raise exception 'Invalid proof file' using errcode = '22023';
  end if;
  select coalesce(sum(total_centavos - amount_paid_centavos), 0) into v_outstanding
    from public.invoices where member_id = v_member.id and status in ('open', 'partially_paid');
  select coalesce(sum(amount_centavos), 0) into v_pending
    from public.payment_submissions where member_id = v_member.id and status = 'pending';
  if p_amount_centavos > v_outstanding - v_pending then
    raise exception 'Amount is more than your unpaid balance (including payments awaiting review)' using errcode = '23514';
  end if;
  insert into public.payment_submissions (organization_id, member_id, invoice_id, amount_centavos, method, reference_number, paid_on, proof_path)
    values (v_member.organization_id, v_member.id, p_invoice, p_amount_centavos, p_method, trim(p_reference), p_paid_on, p_proof_path)
    returning id into v_id;
  perform private.log(v_member.organization_id, 'payment_submission.created', 'payment_submissions', v_id,
    jsonb_build_object('amount_centavos', p_amount_centavos, 'method', p_method));
  return v_id;
end
$$;

create function public.approve_payment_submission(p_submission uuid, p_note text default null)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_sub public.payment_submissions;
  v_payment uuid;
begin
  select * into v_sub from public.payment_submissions where id = p_submission for update;
  perform private.assert_staff(v_sub.organization_id);
  if v_sub.status <> 'pending' then
    raise exception 'This submission was already %', v_sub.status using errcode = '23514';
  end if;
  v_payment := private.post_payment(v_sub.member_id, v_sub.amount_centavos, v_sub.method, v_sub.reference_number,
                                    v_sub.paid_on, null, v_sub.invoice_id, v_sub.id);
  update public.payment_submissions
    set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(), review_note = nullif(trim(p_note), '')
    where id = p_submission;
  perform private.log(v_sub.organization_id, 'payment_submission.approved', 'payment_submissions', p_submission,
    jsonb_build_object('payment_id', v_payment, 'amount_centavos', v_sub.amount_centavos));
  return v_payment;
end
$$;

create function public.reject_payment_submission(p_submission uuid, p_note text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_sub public.payment_submissions;
begin
  select * into v_sub from public.payment_submissions where id = p_submission for update;
  perform private.assert_staff(v_sub.organization_id);
  if v_sub.status <> 'pending' then
    raise exception 'This submission was already %', v_sub.status using errcode = '23514';
  end if;
  if coalesce(trim(p_note), '') = '' then
    raise exception 'Tell the boarder why it was rejected' using errcode = '22023';
  end if;
  update public.payment_submissions
    set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), review_note = trim(p_note)
    where id = p_submission;
  perform private.log(v_sub.organization_id, 'payment_submission.rejected', 'payment_submissions', p_submission, '{}'::jsonb);
end
$$;

create function public.void_payment(p_payment uuid, p_reason text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_pay public.payments;
  v_invoice uuid;
begin
  select * into v_pay from public.payments where id = p_payment for update;
  perform private.assert_staff(v_pay.organization_id);
  if v_pay.voided_at is not null then
    raise exception 'Payment is already void' using errcode = '23514';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'A reason is required' using errcode = '22023';
  end if;
  update public.payments set voided_at = now(), void_reason = trim(p_reason), voided_by = auth.uid() where id = p_payment;
  for v_invoice in select invoice_id from public.payment_allocations where payment_id = p_payment loop
    perform private.recompute_invoice(v_invoice);
  end loop;
  perform private.log(v_pay.organization_id, 'payment.voided', 'payments', p_payment,
    jsonb_build_object('amount_centavos', v_pay.amount_centavos));
end
$$;

-- ---------------------------------------------------------------------------
-- Invitations and provisioning
-- ---------------------------------------------------------------------------
-- Called by the boarder after setting their password from the invite link.
create function public.accept_invitation()
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_member public.organization_members;
begin
  select * into v_member from public.organization_members where user_id = auth.uid() and status = 'invited' for update;
  if not found then
    return;
  end if;
  update public.organization_members set status = 'active' where id = v_member.id;
  update public.invitations set accepted_at = now() where member_id = v_member.id and accepted_at is null;
  perform private.log(v_member.organization_id, 'invitation.accepted', 'organization_members', v_member.id, '{}'::jsonb);
end
$$;

-- SERVICE ROLE ONLY. The server verifies the inviter's session first; this re-checks staff membership.
create function public.register_boarder_invitation(
  p_org uuid, p_user uuid, p_email text, p_full_name text, p_phone text, p_invited_by uuid
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_member uuid;
begin
  if not exists (
    select 1 from public.organization_members
    where organization_id = p_org and user_id = p_invited_by and role in ('owner', 'admin') and status = 'active'
  ) then
    raise exception 'Inviter is not staff of this organization' using errcode = '42501';
  end if;
  insert into public.profiles (id, email, full_name, phone)
    values (p_user, lower(trim(p_email)), trim(p_full_name), nullif(trim(p_phone), ''))
    on conflict (id) do update set full_name = excluded.full_name, phone = coalesce(excluded.phone, public.profiles.phone);
  select id into v_member from public.organization_members where user_id = p_user;
  if v_member is null then
    insert into public.organization_members (organization_id, user_id, role, status)
      values (p_org, p_user, 'boarder', 'invited') returning id into v_member;
  elsif not exists (select 1 from public.organization_members where id = v_member and organization_id = p_org and role = 'boarder' and status = 'invited') then
    raise exception 'This email already has an account' using errcode = '23505';
  end if;
  insert into public.invitations (organization_id, member_id, email, invited_by, expires_at)
    values (p_org, v_member, lower(trim(p_email)), p_invited_by, now() + interval '24 hours');
  insert into public.audit_logs (organization_id, actor_id, action, entity_type, entity_id, metadata)
    values (p_org, p_invited_by, 'invitation.sent', 'organization_members', v_member, '{}'::jsonb);
  return v_member;
end
$$;

-- SERVICE ROLE ONLY. Used by scripts/provision-admin.ts to create a landlord's organization.
create function public.provision_organization(
  p_name text, p_property_name text, p_property_address text, p_owner uuid, p_owner_name text, p_owner_email text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid;
begin
  insert into public.organizations (name) values (trim(p_name)) returning id into v_org;
  insert into public.properties (organization_id, name, address) values (v_org, trim(p_property_name), nullif(trim(p_property_address), ''));
  insert into public.profiles (id, email, full_name) values (p_owner, lower(trim(p_owner_email)), trim(p_owner_name))
    on conflict (id) do update set full_name = excluded.full_name;
  insert into public.organization_members (organization_id, user_id, role, status) values (v_org, p_owner, 'owner', 'active');
  insert into public.audit_logs (organization_id, actor_id, action, entity_type, entity_id)
    values (v_org, null, 'organization.provisioned', 'organizations', v_org);
  return v_org;
end
$$;

-- SERVICE ROLE ONLY. Fixed-window counter. Returns true when the call is allowed.
create function public.rate_limit_hit(p_key text, p_max integer, p_window_seconds integer)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_hits integer;
begin
  insert into private.rate_limits as rl (key, window_start, hits)
    values (p_key, now(), 1)
  on conflict (key) do update set
    hits = case when rl.window_start < now() - make_interval(secs => p_window_seconds) then 1 else rl.hits + 1 end,
    window_start = case when rl.window_start < now() - make_interval(secs => p_window_seconds) then now() else rl.window_start end
  returning hits into v_hits;
  return v_hits <= p_max;
end
$$;
