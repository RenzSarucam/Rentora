-- Private buckets for payment proofs and maintenance photos.
-- Objects are named "<organization_id>/<member_id>/<random>.<ext>" and are only served through short-lived signed URLs.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('payment-proofs', 'payment-proofs', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('maintenance-photos', 'maintenance-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "boarders upload into their own folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('payment-proofs', 'maintenance-photos')
    and private.storage_writer_path(name)
  );

create policy "owner or staff read files" on storage.objects
  for select to authenticated
  using (
    bucket_id in ('payment-proofs', 'maintenance-photos')
    and (private.storage_owner_path(name) or private.storage_staff_path(name))
  );
-- No update or delete policies: uploaded evidence is immutable for app users.
