-- profiles table
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "profiles_select_all" on profiles
  for select using (true);

create policy "profiles_update_own" on profiles
  for update using (auth.uid() = id);

-- auto-create profile on signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- is_public on decks
alter table decks add column if not exists is_public boolean not null default false;

-- RLS policy: anyone can read public decks
create policy "decks_select_public" on decks
  for select using (is_public = true);
