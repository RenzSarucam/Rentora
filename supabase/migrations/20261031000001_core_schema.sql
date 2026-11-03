-- Rentora core schema.
-- Money is stored as bigint centavos (₱1.00 = 100). Dates are calendar dates in Asia/Manila.
-- Every tenant-owned row carries organization_id so RLS can isolate organizations cheaply.

create schema if not exists private;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.member_role as enum ('owner', 'admin', 'boarder');
create type public.member_status as enum ('invited', 'active', 'archived');
create type public.room_status as enum ('active', 'maintenance');
create type public.bed_status as enum ('active', 'maintenance');
create type public.invoice_kind as enum ('rent', 'deposit', 'other');
create type public.invoice_status as enum ('open', 'partially_paid', 'paid', 'void');
create type public.invoice_item_kind as enum ('rent', 'fee', 'discount', 'deposit', 'other');
create type public.payment_method as enum ('cash', 'gcash', 'maya', 'bank_transfer', 'other');
create type public.submission_status as enum ('pending', 'approved', 'rejected');
create type public.maintenance_status as enum ('open', 'in_progress', 'resolved', 'cancelled');
create type public.maintenance_priority as enum ('low', 'normal', 'urgent');

-- ---------------------------------------------------------------------------
-- Organizations and people
-- ---------------------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  timezone text not null default 'Asia/Manila',
  currency text not null default 'PHP' check (currency = 'PHP'),
  default_due_day smallint not null default 5 check (default_due_day between 1 and 28),
  next_invoice_seq integer not null default 1 check (next_invoice_seq > 0),
  next_receipt_seq integer not null default 1 check (next_receipt_seq > 0),
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null default '' check (char_length(full_name) <= 120),
  phone text check (phone is null or char_length(phone) <= 32),
  emergency_contact_name text check (emergency_contact_name is null or char_length(emergency_contact_name) <= 120),
  emergency_contact_phone text check (emergency_contact_phone is null or char_length(emergency_contact_phone) <= 32),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  -- References profiles (1:1 with auth.users) so the API can embed names.
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.member_role not null,
  status public.member_status not null default 'invited',
  notes text check (notes is null or char_length(notes) <= 2000),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, user_id),
  check ((status = 'archived') = (archived_at is not null))
);
-- MVP rule: one organization per login. Keeps "which tenant am I in" unambiguous.
create unique index organization_members_one_org_per_user on public.organization_members (user_id);
create index organization_members_org_role on public.organization_members (organization_id, role, status);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  member_id uuid not null references public.organization_members (id) on delete cascade,
  email text not null,
  invited_by uuid references auth.users (id) on delete set null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
create index invitations_member on public.invitations (member_id);

-- ---------------------------------------------------------------------------
-- Property, rooms, beds
-- ---------------------------------------------------------------------------
create table public.properties (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  address text check (address is null or char_length(address) <= 300),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, id)
);
create index properties_org on public.properties (organization_id);

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  property_id uuid not null,
  code text not null check (char_length(code) between 1 and 20),
  floor text check (floor is null or char_length(floor) <= 20),
  capacity smallint not null check (capacity between 1 and 20),
  monthly_rate_centavos bigint not null check (monthly_rate_centavos >= 0 and monthly_rate_centavos <= 100000000),
  status public.room_status not null default 'active',
  notes text check (notes is null or char_length(notes) <= 2000),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, property_id) references public.properties (organization_id, id)
);
create unique index rooms_code_unique on public.rooms (property_id, lower(code)) where archived_at is null;
create index rooms_org on public.rooms (organization_id);

create table public.beds (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  room_id uuid not null,
  label text not null check (char_length(label) between 1 and 20),
  monthly_rate_centavos bigint not null check (monthly_rate_centavos >= 0 and monthly_rate_centavos <= 100000000),
  status public.bed_status not null default 'active',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, room_id) references public.rooms (organization_id, id)
);
create unique index beds_label_unique on public.beds (room_id, lower(label)) where archived_at is null;
create index beds_room on public.beds (room_id);

create table public.boarder_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  member_id uuid not null references public.organization_members (id),
  bed_id uuid not null,
  monthly_rent_centavos bigint not null check (monthly_rent_centavos >= 0 and monthly_rent_centavos <= 100000000),
  move_in_date date not null,
  move_out_date date,
  end_reason text check (end_reason is null or char_length(end_reason) <= 300),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, bed_id) references public.beds (organization_id, id),
  check (move_out_date is null or move_out_date >= move_in_date)
);
-- A bed holds at most one current boarder; a boarder holds at most one current bed.
create unique index assignments_one_current_per_bed on public.boarder_assignments (bed_id) where move_out_date is null;
create unique index assignments_one_current_per_member on public.boarder_assignments (member_id) where move_out_date is null;
create index assignments_org on public.boarder_assignments (organization_id);

-- ---------------------------------------------------------------------------
-- Billing
-- ---------------------------------------------------------------------------
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  member_id uuid not null references public.organization_members (id),
  assignment_id uuid references public.boarder_assignments (id),
  kind public.invoice_kind not null,
  invoice_number text not null,
  period_month date,
  issue_date date not null,
  due_date date not null,
  status public.invoice_status not null default 'open',
  total_centavos bigint not null default 0 check (total_centavos >= 0),
  amount_paid_centavos bigint not null default 0 check (amount_paid_centavos >= 0),
  notes text check (notes is null or char_length(notes) <= 1000),
  created_by uuid references auth.users (id) on delete set null,
  voided_at timestamptz,
  void_reason text,
  created_at timestamptz not null default now(),
  unique (organization_id, invoice_number),
  check (amount_paid_centavos <= total_centavos),
  check (due_date >= issue_date),
  check (period_month is null or extract(day from period_month) = 1),
  check (kind <> 'rent' or (period_month is not null and assignment_id is not null)),
  check ((status = 'void') = (voided_at is not null))
);
-- Idempotent monthly billing: one rent invoice per assignment per month, void ones excluded.
create unique index invoices_one_rent_per_period on public.invoices (assignment_id, period_month)
  where kind = 'rent' and status <> 'void';
create index invoices_org_status on public.invoices (organization_id, status, due_date);
create index invoices_member on public.invoices (member_id);

create table public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  kind public.invoice_item_kind not null,
  description text not null check (char_length(description) between 1 and 200),
  amount_centavos bigint not null check (amount_centavos between -100000000 and 100000000),
  created_at timestamptz not null default now(),
  check ((kind = 'discount' and amount_centavos < 0) or (kind <> 'discount' and amount_centavos > 0))
);
create index invoice_items_invoice on public.invoice_items (invoice_id);

create table public.payment_submissions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  member_id uuid not null references public.organization_members (id),
  invoice_id uuid not null references public.invoices (id),
  amount_centavos bigint not null check (amount_centavos > 0 and amount_centavos <= 100000000),
  method public.payment_method not null check (method <> 'cash'),
  reference_number text not null check (char_length(reference_number) between 4 and 64),
  paid_on date not null,
  proof_path text not null check (char_length(proof_path) <= 300),
  status public.submission_status not null default 'pending',
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  review_note text check (review_note is null or char_length(review_note) <= 500),
  created_at timestamptz not null default now(),
  check ((status = 'pending') = (reviewed_at is null))
);
-- A transaction reference can only be live once per organization (blocks re-submitting the same GCash ref).
create unique index submissions_reference_unique on public.payment_submissions
  (organization_id, method, lower(reference_number)) where status <> 'rejected';
create index submissions_org_status on public.payment_submissions (organization_id, status, created_at);
create index submissions_member on public.payment_submissions (member_id);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  member_id uuid not null references public.organization_members (id),
  amount_centavos bigint not null check (amount_centavos > 0 and amount_centavos <= 100000000),
  method public.payment_method not null,
  reference_number text check (reference_number is null or char_length(reference_number) <= 64),
  received_on date not null,
  receipt_number text not null,
  submission_id uuid unique references public.payment_submissions (id),
  notes text check (notes is null or char_length(notes) <= 500),
  recorded_by uuid references auth.users (id) on delete set null,
  voided_at timestamptz,
  void_reason text check (void_reason is null or char_length(void_reason) <= 300),
  voided_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (organization_id, receipt_number)
);
create index payments_org_received on public.payments (organization_id, received_on);
create index payments_member on public.payments (member_id);

create table public.payment_allocations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  payment_id uuid not null references public.payments (id),
  invoice_id uuid not null references public.invoices (id),
  amount_centavos bigint not null check (amount_centavos > 0),
  created_at timestamptz not null default now(),
  unique (payment_id, invoice_id)
);
create index allocations_invoice on public.payment_allocations (invoice_id);

-- ---------------------------------------------------------------------------
-- Maintenance and announcements
-- ---------------------------------------------------------------------------
create table public.maintenance_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  member_id uuid not null references public.organization_members (id),
  room_id uuid references public.rooms (id),
  title text not null check (char_length(title) between 3 and 120),
  description text not null check (char_length(description) between 1 and 2000),
  priority public.maintenance_priority not null default 'normal',
  status public.maintenance_status not null default 'open',
  photo_path text check (photo_path is null or char_length(photo_path) <= 300),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index maintenance_org_status on public.maintenance_requests (organization_id, status, created_at);
create index maintenance_member on public.maintenance_requests (member_id);

create table public.maintenance_updates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  request_id uuid not null references public.maintenance_requests (id) on delete cascade,
  author_id uuid references auth.users (id) on delete set null,
  body text not null check (char_length(body) between 1 and 2000),
  status_to public.maintenance_status,
  created_at timestamptz not null default now()
);
create index maintenance_updates_request on public.maintenance_updates (request_id, created_at);

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  title text not null check (char_length(title) between 3 and 140),
  body text not null check (char_length(body) between 1 and 5000),
  pinned boolean not null default false,
  published_at timestamptz,
  archived_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index announcements_org on public.announcements (organization_id, published_at desc);

-- ---------------------------------------------------------------------------
-- Audit log and rate limiting
-- ---------------------------------------------------------------------------
create table public.audit_logs (
  id bigint generated always as identity primary key,
  organization_id uuid references public.organizations (id) on delete cascade,
  actor_id uuid,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_org_created on public.audit_logs (organization_id, created_at desc);

create table private.rate_limits (
  key text primary key,
  window_start timestamptz not null,
  hits integer not null
);
