-- Owner-confirmed boarder erasure. Financial deletes stay inside a checked RPC.
-- Uploads are removed through the Storage API after their application rows are
-- gone; a durable private job lets the owner finish interrupted cleanup.
create table private.boarder_deletions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  member_id uuid not null unique,
  user_id uuid not null,
  requested_by uuid not null,
  display_name text,
  status text not null check (status in ('purging', 'cleanup_pending', 'complete')),
  counts jsonb not null default '{}'::jsonb,
  delete_transaction_id bigint,
  allowed_delete_rows jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  check ((status = 'purging') = (delete_transaction_id is not null)),
  check (status = 'purging' or allowed_delete_rows = '{}'::jsonb),
  check ((status = 'complete') = (completed_at is not null))
);
alter table private.boarder_deletions enable row level security;
revoke all on private.boarder_deletions from public, anon, authenticated, service_role;

-- Only an uncommitted RPC job can authorize deletion of these exact rows.
-- Custom settings, a job UUID, and later calls in the same transaction cannot
-- manufacture or reuse the capability. Ordinary append-only protection stays.
create function private.boarder_delete_allowed(p_table text, p_row jsonb)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_table in ('payments', 'payment_allocations', 'audit_logs') and exists (
    select 1 from private.boarder_deletions d
    join public.organization_members actor on actor.organization_id = d.organization_id
      and actor.user_id = auth.uid() and actor.role = 'owner' and actor.status = 'active'
    where d.status = 'purging' and d.delete_transaction_id = txid_current()
      and d.requested_by = auth.uid()
      and d.organization_id = private.try_uuid(p_row ->> 'organization_id')
      and (d.allowed_delete_rows -> p_table) ? (p_row ->> 'id')
  )
$$;
revoke execute on function private.boarder_delete_allowed(text, jsonb) from public, anon, authenticated, service_role;

create or replace function private.block_mutation() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' and tg_table_schema = 'public'
     and private.boarder_delete_allowed(tg_table_name, to_jsonb(old)) then
    return old;
  end if;
  raise exception '% rows are append-only', tg_table_name using errcode = '42501';
end
$$;

create function public.delete_boarder(p_member uuid, p_confirmation_email text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid;
  v_member public.organization_members;
  v_profile public.profiles;
  v_job uuid;
  v_assignments uuid[];
  v_invoices uuid[];
  v_items uuid[];
  v_payments uuid[];
  v_allocations uuid[];
  v_submissions uuid[];
  v_requests uuid[];
  v_updates uuid[];
  v_invitations uuid[];
  v_entities uuid[];
  v_patterns text[];
  v_audit_ids text[];
  v_counts jsonb;
begin
  select organization_id into v_org from public.organization_members
    where user_id = auth.uid() and role = 'owner' and status = 'active';
  if v_org is null then
    raise exception 'Only the active owner can permanently delete a boarder' using errcode = '42501';
  end if;
  select * into v_member from public.organization_members
    where id = p_member and organization_id = v_org and role = 'boarder' for update;
  if not found then
    raise exception 'Boarder not found' using errcode = '22023';
  end if;
  select * into v_profile from public.profiles where id = v_member.user_id for update;
  if p_confirmation_email is null or lower(trim(p_confirmation_email)) <> lower(v_profile.email) then
    raise exception 'Type the boarder email to confirm permanent deletion' using errcode = '22023';
  end if;

  -- The member lock blocks new dependent rows; lock existing financial rows
  -- before collecting IDs so another payment cannot change the deletion set.
  perform 1 from public.invoices where member_id = p_member for update;
  perform 1 from public.payments where member_id = p_member for update;
  perform 1 from public.payment_submissions where member_id = p_member for update;
  perform 1 from public.maintenance_requests where member_id = p_member for update;
  select coalesce(array_agg(id), '{}') into v_assignments from public.boarder_assignments where member_id = p_member;
  select coalesce(array_agg(id), '{}') into v_invoices from public.invoices where member_id = p_member;
  select coalesce(array_agg(id), '{}') into v_items from public.invoice_items where invoice_id = any(v_invoices);
  select coalesce(array_agg(id), '{}') into v_payments from public.payments where member_id = p_member;
  select coalesce(array_agg(id), '{}') into v_submissions from public.payment_submissions where member_id = p_member;
  select coalesce(array_agg(id), '{}') into v_requests from public.maintenance_requests where member_id = p_member;
  select coalesce(array_agg(id), '{}') into v_updates from public.maintenance_updates
    where request_id = any(v_requests) or (organization_id = v_org and author_id = v_member.user_id);
  select coalesce(array_agg(id), '{}') into v_invitations from public.invitations where member_id = p_member;

  -- Refuse inconsistent cross-account links instead of erasing another person.
  if exists (select 1 from public.invoices where assignment_id = any(v_assignments) and member_id <> p_member)
    or exists (select 1 from public.payment_submissions where invoice_id = any(v_invoices) and member_id <> p_member)
    or exists (select 1 from public.payments where submission_id = any(v_submissions) and member_id <> p_member)
    or exists (select 1 from public.payments where member_id <> p_member
      and (recorded_by = v_member.user_id or voided_by = v_member.user_id))
    or exists (
      select 1 from public.payment_allocations a
      join public.payments p on p.id = a.payment_id join public.invoices i on i.id = a.invoice_id
      where (p.member_id = p_member or i.member_id = p_member)
        and (p.member_id <> p_member or i.member_id <> p_member
          or p.organization_id <> v_org or i.organization_id <> v_org or a.organization_id <> v_org)
    ) then
    raise exception 'This boarder has records linked to another account. Resolve those links before deleting.' using errcode = '23514';
  end if;
  select coalesce(array_agg(id), '{}') into v_allocations from public.payment_allocations where payment_id = any(v_payments);
  v_entities := array[p_member, v_member.user_id] || v_assignments || v_invoices || v_items || v_payments
    || v_allocations || v_submissions || v_requests || v_updates || v_invitations;
  select array_agg('%' || id::text || '%') into v_patterns from unnest(v_entities) id;
  select coalesce(array_agg(id::text), '{}') into v_audit_ids from public.audit_logs
    where organization_id = v_org and (actor_id = v_member.user_id or entity_id = any(v_entities) or metadata::text like any(v_patterns));
  v_counts := jsonb_build_object('assignments', cardinality(v_assignments), 'invoices', cardinality(v_invoices),
    'invoice_items', cardinality(v_items), 'payments', cardinality(v_payments), 'allocations', cardinality(v_allocations),
    'submissions', cardinality(v_submissions), 'repairs', cardinality(v_requests), 'updates', cardinality(v_updates),
    'invitations', cardinality(v_invitations), 'audit_entries', cardinality(v_audit_ids));

  insert into private.boarder_deletions (organization_id, member_id, user_id, requested_by, display_name,
    status, counts, delete_transaction_id, allowed_delete_rows)
  values (v_org, p_member, v_member.user_id, auth.uid(), coalesce(nullif(v_profile.full_name, ''), v_profile.email),
    'purging', v_counts, txid_current(), jsonb_build_object('payments', to_jsonb(v_payments)::jsonb,
      'payment_allocations', to_jsonb(v_allocations)::jsonb, 'audit_logs', to_jsonb(v_audit_ids))) returning id into v_job;

  delete from public.payment_allocations where id = any(v_allocations);
  delete from public.payments where id = any(v_payments);
  delete from public.payment_submissions where id = any(v_submissions);
  -- Cascaded item triggers see the invoice already removed, including void ones.
  delete from public.invoices where id = any(v_invoices);
  delete from public.boarder_assignments where id = any(v_assignments);
  delete from public.maintenance_updates where id = any(v_updates);
  delete from public.maintenance_requests where id = any(v_requests);
  -- Membership, invitations and announcement receipts cascade from the profile.
  -- The login is kept only until the Storage API has removed its objects.
  delete from public.profiles where id = v_member.user_id;
  delete from public.audit_logs where id::text = any(v_audit_ids);

  update private.boarder_deletions set status = 'cleanup_pending', delete_transaction_id = null,
    allowed_delete_rows = '{}'::jsonb where id = v_job;
  perform private.log(v_org, 'boarder.deletion_started', 'organization_members', p_member, v_counts);
  return v_job;
end
$$;
revoke execute on function public.delete_boarder(uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.delete_boarder(uuid, text) to authenticated;

create function public.boarder_deletion_jobs(p_job uuid default null)
returns table(id uuid, organization_id uuid, member_id uuid, display_name text, status text, counts jsonb, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare v_org uuid;
begin
  select m.organization_id into v_org from public.organization_members m
    where m.user_id = auth.uid() and m.role = 'owner' and m.status = 'active';
  if v_org is null then
    raise exception 'Only the active owner can manage boarder deletions' using errcode = '42501';
  end if;
  return query select d.id, d.organization_id, d.member_id, d.display_name, d.status, d.counts, d.created_at
    from private.boarder_deletions d where d.organization_id = v_org
      and ((p_job is null and d.status = 'cleanup_pending') or d.id = p_job) order by d.created_at;
end
$$;
revoke execute on function public.boarder_deletion_jobs(uuid) from public, anon, authenticated, service_role;
grant execute on function public.boarder_deletion_jobs(uuid) to authenticated;

create function public.complete_boarder_deletion(p_job uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_org uuid; v_job private.boarder_deletions;
begin
  select organization_id into v_org from public.organization_members
    where user_id = auth.uid() and role = 'owner' and status = 'active';
  if v_org is null then
    raise exception 'Only the active owner can finish a boarder deletion' using errcode = '42501';
  end if;
  select * into v_job from private.boarder_deletions where id = p_job and organization_id = v_org for update;
  if not found then raise exception 'Deletion not found' using errcode = '22023'; end if;
  if v_job.status = 'complete' then return; end if;
  if v_job.status <> 'cleanup_pending' then raise exception 'Deletion is not ready' using errcode = '22023'; end if;
  if exists (select 1 from storage.objects where bucket_id in ('payment-proofs', 'maintenance-photos')
    and split_part(name, '/', 1) = v_org::text and split_part(name, '/', 2) = v_job.member_id::text) then
    raise exception 'Some uploads still need cleanup. Use Finish deletion again.' using errcode = '23514';
  end if;
  delete from auth.users where id = v_job.user_id;
  update private.boarder_deletions set status = 'complete', display_name = null, completed_at = now() where id = p_job;
  perform private.log(v_org, 'boarder.deleted', 'organization_members', v_job.member_id, '{}'::jsonb);
end
$$;
revoke execute on function public.complete_boarder_deletion(uuid) from public, anon, authenticated, service_role;
grant execute on function public.complete_boarder_deletion(uuid) to authenticated;
