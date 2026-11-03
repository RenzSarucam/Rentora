-- Rentora access control: least-privilege grants + row level security on every table.

-- ---------------------------------------------------------------------------
-- Ownership helpers used by policies (SECURITY DEFINER avoids nested-RLS recursion).
-- ---------------------------------------------------------------------------
create function private.owns_invoice(p_invoice uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.invoices i join public.organization_members m on m.id = i.member_id
    where i.id = p_invoice and m.user_id = auth.uid()
  )
$$;

create function private.owns_request(p_request uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.maintenance_requests r join public.organization_members m on m.id = r.member_id
    where r.id = p_request and m.user_id = auth.uid()
  )
$$;

create function private.is_active_member(p_member uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.organization_members m
    where m.id = p_member and m.user_id = auth.uid() and m.status <> 'archived'
  )
$$;

create function private.can_view_bed(p_bed uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.boarder_assignments a join public.organization_members m on m.id = a.member_id
    where a.bed_id = p_bed and m.user_id = auth.uid()
  )
$$;

create function private.can_view_room(p_room uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.boarder_assignments a
    join public.beds b on b.id = a.bed_id
    join public.organization_members m on m.id = a.member_id
    where b.room_id = p_room and m.user_id = auth.uid()
  )
$$;

-- Storage object names are "<organization_id>/<member_id>/<file>".
create function private.storage_owner_path(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = private.try_uuid(split_part(p_name, '/', 1))
      and m.id = private.try_uuid(split_part(p_name, '/', 2))
      and m.user_id = auth.uid()
  )
$$;

create function private.storage_writer_path(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.storage_owner_path(p_name)
    and exists (
      select 1 from public.organization_members m
      where m.id = private.try_uuid(split_part(p_name, '/', 2)) and m.status <> 'archived' and m.role = 'boarder'
    )
    and array_length(string_to_array(p_name, '/'), 1) = 3
$$;

create function private.storage_staff_path(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_staff(private.try_uuid(split_part(p_name, '/', 1)))
$$;

create function private.prepare_maintenance_update() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  select r.organization_id into new.organization_id from public.maintenance_requests r where r.id = new.request_id;
  new.author_id := auth.uid();
  -- Status changes only come through update_maintenance_status().
  if current_setting('rentora.status_change', true) is distinct from 'on' then
    new.status_to := null;
  end if;
  return new;
end
$$;
create trigger maintenance_updates_prepare before insert on public.maintenance_updates
  for each row execute function private.prepare_maintenance_update();

-- Staff status changes. Inserts its own update row with a status, which the trigger above lets through.
create function public.update_maintenance_status(p_request uuid, p_status public.maintenance_status, p_note text default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_req public.maintenance_requests;
begin
  select * into v_req from public.maintenance_requests where id = p_request for update;
  perform private.assert_staff(v_req.organization_id);
  if v_req.status = p_status then
    raise exception 'Request is already %', replace(p_status::text, '_', ' ') using errcode = '23514';
  end if;
  update public.maintenance_requests
    set status = p_status, resolved_at = case when p_status = 'resolved' then now() else null end
    where id = p_request;
  perform set_config('rentora.status_change', 'on', true);
  insert into public.maintenance_updates (organization_id, request_id, author_id, body, status_to)
    values (v_req.organization_id, p_request, auth.uid(),
            coalesce(nullif(trim(p_note), ''), 'Status changed to ' || replace(p_status::text, '_', ' ')), p_status);
  perform set_config('rentora.status_change', 'off', true);
  perform private.log(v_req.organization_id, 'maintenance.status_changed', 'maintenance_requests', p_request,
    jsonb_build_object('from', v_req.status, 'to', p_status));
end
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on schema private from public, anon, authenticated;
revoke all on all tables in schema private from public, anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;

grant usage on schema private to authenticated;
grant execute on function
  private.is_staff(uuid), private.is_member(uuid), private.owns_member(uuid), private.is_staff_of_user(uuid),
  private.owns_invoice(uuid), private.owns_request(uuid), private.is_active_member(uuid),
  private.can_view_bed(uuid), private.can_view_room(uuid), private.try_uuid(text),
  private.storage_owner_path(text), private.storage_writer_path(text), private.storage_staff_path(text)
to authenticated;

grant select on public.organizations to authenticated;
grant update (name, default_due_day) on public.organizations to authenticated;

grant select on public.profiles to authenticated;
grant update (full_name, phone, emergency_contact_name, emergency_contact_phone) on public.profiles to authenticated;

grant select on public.organization_members to authenticated;
grant update (notes) on public.organization_members to authenticated;

grant select on public.invitations to authenticated;

grant select on public.properties to authenticated;
grant insert (organization_id, name, address) on public.properties to authenticated;
grant update (name, address, archived_at) on public.properties to authenticated;

grant select on public.rooms to authenticated;
grant update (code, floor, capacity, monthly_rate_centavos, status, notes, archived_at) on public.rooms to authenticated;

grant select on public.beds to authenticated;
grant insert (organization_id, room_id, label, monthly_rate_centavos, status) on public.beds to authenticated;
grant update (label, monthly_rate_centavos, status, archived_at) on public.beds to authenticated;

grant select on public.boarder_assignments to authenticated;
grant update (monthly_rent_centavos) on public.boarder_assignments to authenticated;

grant select on public.invoices to authenticated;
grant update (due_date, notes) on public.invoices to authenticated;
grant select on public.invoice_items to authenticated;
grant select on public.payment_submissions to authenticated;
grant select on public.payments to authenticated;
grant select on public.payment_allocations to authenticated;

grant select on public.maintenance_requests to authenticated;
grant insert (member_id, title, description, priority, photo_path) on public.maintenance_requests to authenticated;
grant select on public.maintenance_updates to authenticated;
grant insert (request_id, body) on public.maintenance_updates to authenticated;

grant select on public.announcements to authenticated;
grant insert (organization_id, title, body, pinned, published_at) on public.announcements to authenticated;
grant update (title, body, pinned, published_at, archived_at) on public.announcements to authenticated;

grant select on public.audit_logs to authenticated;

-- RPCs callable by signed-in users (each one checks the caller itself).
grant execute on function
  public.create_room(uuid, text, text, integer, bigint, text),
  public.assign_bed(uuid, uuid, date, bigint),
  public.end_assignment(uuid, date, text),
  public.transfer_bed(uuid, uuid, date, bigint),
  public.set_boarder_archived(uuid, boolean),
  public.generate_monthly_invoices(uuid, date, date),
  public.create_invoice(uuid, public.invoice_kind, date, jsonb, text),
  public.add_invoice_item(uuid, public.invoice_item_kind, text, bigint),
  public.remove_invoice_item(uuid),
  public.void_invoice(uuid, text),
  public.record_payment(uuid, bigint, public.payment_method, text, date, text, uuid),
  public.submit_payment(uuid, bigint, public.payment_method, text, date, text),
  public.approve_payment_submission(uuid, text),
  public.reject_payment_submission(uuid, text),
  public.void_payment(uuid, text),
  public.update_maintenance_status(uuid, public.maintenance_status, text),
  public.accept_invitation()
to authenticated;

-- Server-only RPCs.
grant execute on function
  public.register_boarder_invitation(uuid, uuid, text, text, text, uuid),
  public.provision_organization(text, text, text, uuid, text, text),
  public.rate_limit_hit(text, integer, integer)
to service_role;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.organization_members enable row level security;
alter table public.invitations enable row level security;
alter table public.properties enable row level security;
alter table public.rooms enable row level security;
alter table public.beds enable row level security;
alter table public.boarder_assignments enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.payment_submissions enable row level security;
alter table public.payments enable row level security;
alter table public.payment_allocations enable row level security;
alter table public.maintenance_requests enable row level security;
alter table public.maintenance_updates enable row level security;
alter table public.announcements enable row level security;
alter table public.audit_logs enable row level security;
alter table private.rate_limits enable row level security;

create policy "members read their organization" on public.organizations
  for select to authenticated using (private.is_member(id));
create policy "staff update their organization" on public.organizations
  for update to authenticated using (private.is_staff(id)) with check (private.is_staff(id));

create policy "read own or managed profiles" on public.profiles
  for select to authenticated using (id = auth.uid() or private.is_staff_of_user(id));
create policy "update own or managed profiles" on public.profiles
  for update to authenticated
  using (id = auth.uid() or private.is_staff_of_user(id))
  with check (id = auth.uid() or private.is_staff_of_user(id));

create policy "read own membership or staff reads all" on public.organization_members
  for select to authenticated using (user_id = auth.uid() or private.is_staff(organization_id));
create policy "staff update members" on public.organization_members
  for update to authenticated using (private.is_staff(organization_id)) with check (private.is_staff(organization_id));

create policy "staff read invitations" on public.invitations
  for select to authenticated using (private.is_staff(organization_id));

create policy "members read properties" on public.properties
  for select to authenticated using (private.is_member(organization_id));
create policy "staff insert properties" on public.properties
  for insert to authenticated with check (private.is_staff(organization_id));
create policy "staff update properties" on public.properties
  for update to authenticated using (private.is_staff(organization_id)) with check (private.is_staff(organization_id));

create policy "staff or occupant read rooms" on public.rooms
  for select to authenticated using (private.is_staff(organization_id) or private.can_view_room(id));
create policy "staff update rooms" on public.rooms
  for update to authenticated using (private.is_staff(organization_id)) with check (private.is_staff(organization_id));

create policy "staff or occupant read beds" on public.beds
  for select to authenticated using (private.is_staff(organization_id) or private.can_view_bed(id));
create policy "staff insert beds" on public.beds
  for insert to authenticated with check (private.is_staff(organization_id));
create policy "staff update beds" on public.beds
  for update to authenticated using (private.is_staff(organization_id)) with check (private.is_staff(organization_id));

create policy "staff or self read assignments" on public.boarder_assignments
  for select to authenticated using (private.is_staff(organization_id) or private.owns_member(member_id));
create policy "staff update assignments" on public.boarder_assignments
  for update to authenticated using (private.is_staff(organization_id)) with check (private.is_staff(organization_id));

create policy "staff or self read invoices" on public.invoices
  for select to authenticated using (private.is_staff(organization_id) or private.owns_member(member_id));
create policy "staff update invoices" on public.invoices
  for update to authenticated using (private.is_staff(organization_id)) with check (private.is_staff(organization_id));

create policy "staff or self read invoice items" on public.invoice_items
  for select to authenticated using (private.is_staff(organization_id) or private.owns_invoice(invoice_id));

create policy "staff or self read submissions" on public.payment_submissions
  for select to authenticated using (private.is_staff(organization_id) or private.owns_member(member_id));

create policy "staff or self read payments" on public.payments
  for select to authenticated using (private.is_staff(organization_id) or private.owns_member(member_id));

create policy "staff or self read allocations" on public.payment_allocations
  for select to authenticated using (private.is_staff(organization_id) or private.owns_invoice(invoice_id));

create policy "staff or self read maintenance" on public.maintenance_requests
  for select to authenticated using (private.is_staff(organization_id) or private.owns_member(member_id));
create policy "boarders file their own requests" on public.maintenance_requests
  for insert to authenticated with check (private.is_active_member(member_id));

create policy "staff or requester read updates" on public.maintenance_updates
  for select to authenticated using (private.is_staff(organization_id) or private.owns_request(request_id));
create policy "staff or requester add updates" on public.maintenance_updates
  for insert to authenticated with check (
    private.is_staff(organization_id)
    or (private.owns_request(request_id) and exists (
      select 1 from public.maintenance_requests r
      where r.id = request_id and private.is_active_member(r.member_id) and r.status in ('open', 'in_progress')
    ))
  );

create policy "staff read all, members read published" on public.announcements
  for select to authenticated using (
    private.is_staff(organization_id)
    or (private.is_member(organization_id) and published_at is not null and published_at <= now() and archived_at is null)
  );
create policy "staff insert announcements" on public.announcements
  for insert to authenticated with check (private.is_staff(organization_id));
create policy "staff update announcements" on public.announcements
  for update to authenticated using (private.is_staff(organization_id)) with check (private.is_staff(organization_id));

create policy "staff read audit log" on public.audit_logs
  for select to authenticated using (private.is_staff(organization_id));
