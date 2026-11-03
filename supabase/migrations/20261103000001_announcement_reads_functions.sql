-- Read receipts belong to one boarder and one published announcement version.
create table public.announcement_reads (
  member_id uuid not null references public.organization_members(id) on delete cascade,
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  read_published_at timestamptz not null,
  read_at timestamptz not null default now(),
  primary key (member_id, announcement_id)
);
create index announcement_reads_announcement on public.announcement_reads (announcement_id);
alter table public.announcement_reads enable row level security;
revoke all on public.announcement_reads from public, anon, authenticated;
grant select on public.announcement_reads to authenticated;
create policy "boarders read their own announcement receipts" on public.announcement_reads
  for select to authenticated using (private.owns_member(member_id));

create function public.mark_announcement_read(p_announcement uuid, p_published_at timestamptz)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_announcement public.announcements;
  v_member uuid;
begin
  select * into v_announcement from public.announcements
    where id = p_announcement and published_at is not null and published_at <= now() and archived_at is null
    for share;
  if not found then
    raise exception 'Announcement is not available' using errcode = '42501';
  end if;
  select id into v_member from public.organization_members
    where user_id = auth.uid() and organization_id = v_announcement.organization_id
      and role = 'boarder' and status <> 'archived'
    for share;
  if v_member is null then
    raise exception 'Not authorized for this announcement' using errcode = '42501';
  end if;
  if p_published_at is null or p_published_at <> v_announcement.published_at then
    raise exception 'This announcement has changed. Open it again.' using errcode = '22023';
  end if;
  insert into public.announcement_reads (member_id, announcement_id, read_published_at)
    values (v_member, p_announcement, v_announcement.published_at)
    on conflict (member_id, announcement_id) do update
      set read_published_at = excluded.read_published_at, read_at = now();
end
$$;
revoke execute on function public.mark_announcement_read(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.mark_announcement_read(uuid, timestamptz) to authenticated;
