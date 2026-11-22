-- NEXORA AI private user storage
-- Run this migration in the Supabase SQL Editor after reviewing the bucket name.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'nexora-files',
  'nexora-files',
  false,
  104857600,
  array['image/png','image/jpeg','image/webp','video/mp4','video/webm','audio/mpeg','audio/wav','audio/mp4','application/pdf']
)
on conflict (id) do nothing;

drop policy if exists "NEXORA users can read their own files" on storage.objects;
create policy "NEXORA users can read their own files"
on storage.objects for select
to authenticated
using (
  bucket_id = 'nexora-files'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "NEXORA users can upload their own files" on storage.objects;
create policy "NEXORA users can upload their own files"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'nexora-files'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "NEXORA users can update their own files" on storage.objects;
create policy "NEXORA users can update their own files"
on storage.objects for update
to authenticated
using (
  bucket_id = 'nexora-files'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'nexora-files'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "NEXORA users can delete their own files" on storage.objects;
create policy "NEXORA users can delete their own files"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'nexora-files'
  and (storage.foldername(name))[1] = auth.uid()::text
);
