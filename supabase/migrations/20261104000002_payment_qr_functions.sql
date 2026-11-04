-- Receiving details are private to the organization. Only its active owner
-- can change where boarders are asked to send money.
create function private.is_owner(p_org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.organization_members
    where organization_id = p_org and user_id = auth.uid() and role = 'owner' and status = 'active')
$$;
revoke execute on function private.is_owner(uuid) from public, anon, authenticated;
grant execute on function private.is_owner(uuid) to authenticated;

create table public.payment_receiving_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  method public.payment_method not null check (method in ('gcash', 'bank_transfer')),
  account_name text not null check (char_length(trim(account_name)) between 2 and 120),
  institution_name text check (institution_name is null or char_length(institution_name) between 1 and 100),
  account_number text check (account_number is null or account_number ~ '^[A-Za-z0-9+ -]{4,40}$'),
  qr_path text not null unique check (char_length(qr_path) <= 300
    and split_part(qr_path, '/', 1) = organization_id::text
    and array_length(string_to_array(qr_path, '/'), 1) = 3
    and split_part(qr_path, '/', 3) ~ '^[a-f0-9-]{36}\.(jpg|png)$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, method),
  check (method <> 'bank_transfer' or institution_name is not null)
);
alter table public.payment_receiving_accounts enable row level security;
revoke all on public.payment_receiving_accounts from public, anon, authenticated;
grant select on public.payment_receiving_accounts to authenticated;
grant insert (organization_id, method, account_name, institution_name, account_number, qr_path)
  on public.payment_receiving_accounts to authenticated;
grant update (account_name, institution_name, account_number, qr_path)
  on public.payment_receiving_accounts to authenticated;

create policy "members read their own receiving accounts" on public.payment_receiving_accounts
  for select to authenticated using (private.is_member(organization_id));
create policy "owners add receiving accounts" on public.payment_receiving_accounts
  for insert to authenticated with check (private.is_owner(organization_id) and exists (
    select 1 from public.organization_members m where m.organization_id = payment_receiving_accounts.organization_id
      and m.id = private.try_uuid(split_part(payment_receiving_accounts.qr_path, '/', 2)) and m.role = 'owner'
  ));
create policy "owners update receiving accounts" on public.payment_receiving_accounts
  for update to authenticated using (private.is_owner(organization_id))
  with check (private.is_owner(organization_id) and exists (
    select 1 from public.organization_members m where m.organization_id = payment_receiving_accounts.organization_id
      and m.id = private.try_uuid(split_part(payment_receiving_accounts.qr_path, '/', 2)) and m.role = 'owner'
  ));
create trigger payment_receiving_accounts_touch before update on public.payment_receiving_accounts
  for each row execute function private.touch_updated_at();
create trigger payment_receiving_accounts_audit after insert or update on public.payment_receiving_accounts
  for each row execute function private.audit_row();

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
  values ('payment-qrs', 'payment-qrs', false, 4194304, array['image/jpeg', 'image/png']);
create function private.payment_qr_writer_path(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select array_length(string_to_array(p_name, '/'), 1) = 3
    and split_part(p_name, '/', 3) ~ '^[a-f0-9-]{36}\.(jpg|png)$'
    and exists (select 1 from public.organization_members m
      where m.organization_id = private.try_uuid(split_part(p_name, '/', 1))
        and m.id = private.try_uuid(split_part(p_name, '/', 2))
        and m.user_id = auth.uid() and m.role = 'owner' and m.status = 'active')
$$;
revoke execute on function private.payment_qr_writer_path(text) from public, anon, authenticated;
grant execute on function private.payment_qr_writer_path(text) to authenticated;
create policy "owners upload receiving QR images" on storage.objects
  for insert to authenticated with check (bucket_id = 'payment-qrs' and private.payment_qr_writer_path(name));
create policy "members read current receiving QR images" on storage.objects
  for select to authenticated using (bucket_id = 'payment-qrs' and (private.payment_qr_writer_path(name) or exists (
    select 1 from public.payment_receiving_accounts a where a.qr_path = name and private.is_member(a.organization_id)
  )));
-- No public access, overwrite policy, or direct object-delete grant is added.

-- Historical Maya/Other records remain readable. New boarder submissions use
-- the two offered methods and may reserve only this invoice's remaining amount.
create or replace function public.submit_payment(
  p_invoice uuid, p_amount_centavos bigint, p_method public.payment_method, p_reference text, p_paid_on date, p_proof_path text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_inv public.invoices;
  v_member public.organization_members;
  v_outstanding bigint;
  v_pending bigint;
  v_invoice_pending bigint;
  v_id uuid;
begin
  select * into v_inv from public.invoices where id = p_invoice;
  select * into v_member from public.organization_members where id = v_inv.member_id and user_id = auth.uid() for update;
  if not found or v_member.status = 'archived' or v_member.role <> 'boarder' then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  select * into v_inv from public.invoices where id = p_invoice for update;
  if not found or v_inv.status not in ('open', 'partially_paid') then
    raise exception 'This invoice is not awaiting payment' using errcode = '23514';
  end if;
  if p_method is null or p_method not in ('gcash', 'bank_transfer') then
    raise exception 'Choose GCash or bank transfer' using errcode = '22023';
  end if;
  if p_paid_on > private.manila_today() or p_paid_on < private.manila_today() - 120 then
    raise exception 'Enter the date you paid' using errcode = '22023';
  end if;
  if p_proof_path is null or p_proof_path not like v_member.organization_id::text || '/' || v_member.id::text || '/%' then
    raise exception 'Invalid proof file' using errcode = '22023';
  end if;
  select coalesce(sum(total_centavos - amount_paid_centavos), 0) into v_outstanding from public.invoices
    where member_id = v_member.id and status in ('open', 'partially_paid');
  select coalesce(sum(amount_centavos), 0) into v_pending from public.payment_submissions
    where member_id = v_member.id and status = 'pending';
  if p_amount_centavos > v_outstanding - v_pending then
    raise exception 'Amount is more than your unpaid balance (including payments awaiting review)' using errcode = '23514';
  end if;
  select coalesce(sum(amount_centavos), 0) into v_invoice_pending from public.payment_submissions
    where invoice_id = p_invoice and status = 'pending';
  if p_amount_centavos > v_inv.total_centavos - v_inv.amount_paid_centavos - v_invoice_pending then
    raise exception 'Amount is more than the remaining amount on this bill (including payments awaiting review)' using errcode = '23514';
  end if;
  insert into public.payment_submissions(organization_id, member_id, invoice_id, amount_centavos, method, reference_number, paid_on, proof_path)
    values(v_member.organization_id, v_member.id, p_invoice, p_amount_centavos, p_method, trim(p_reference), p_paid_on, p_proof_path)
    returning id into v_id;
  perform private.log(v_member.organization_id, 'payment_submission.created', 'payment_submissions', v_id,
    jsonb_build_object('amount_centavos', p_amount_centavos, 'method', p_method));
  return v_id;
end
$$;
