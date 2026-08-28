-- Add avatar_url to profiles
alter table profiles add column if not exists avatar_url text;

-- Create avatars storage bucket (public reads)
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict do nothing;

-- RLS: anyone can read avatars
do $$ begin
  create policy "avatars_public_read" on storage.objects
    for select using (bucket_id = 'avatars');
exception when duplicate_object then null;
end $$;

-- RLS: authenticated users can upload to their own folder
do $$ begin
  create policy "avatars_insert_own" on storage.objects
    for insert with check (
      bucket_id = 'avatars'
      and auth.role() = 'authenticated'
      and (storage.foldername(name))[1] = auth.uid()::text
    );
exception when duplicate_object then null;
end $$;

-- RLS: authenticated users can update their own avatars
do $$ begin
  create policy "avatars_update_own" on storage.objects
    for update using (
      bucket_id = 'avatars'
      and auth.uid()::text = (storage.foldername(name))[1]
    );
exception when duplicate_object then null;
end $$;
