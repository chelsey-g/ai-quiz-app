-- collections table
create table if not exists collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  is_public boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists collections_user_id_idx on collections (user_id);

-- collection_decks junction
create table if not exists collection_decks (
  collection_id uuid not null references collections on delete cascade,
  deck_id uuid not null references decks on delete cascade,
  added_at timestamptz not null default now(),
  primary key (collection_id, deck_id)
);

create index if not exists collection_decks_deck_id_idx on collection_decks (deck_id);

-- RLS: collections
alter table collections enable row level security;

create policy "collections_select" on collections
  for select using (auth.uid() = user_id or is_public = true);

create policy "collections_insert" on collections
  for insert with check (auth.uid() = user_id);

create policy "collections_update" on collections
  for update using (auth.uid() = user_id);

create policy "collections_delete" on collections
  for delete using (auth.uid() = user_id);

-- RLS: collection_decks
alter table collection_decks enable row level security;

create policy "collection_decks_select" on collection_decks
  for select using (
    exists (
      select 1 from collections c
      where c.id = collection_id
        and (c.user_id = auth.uid() or c.is_public = true)
    )
  );

create policy "collection_decks_insert" on collection_decks
  for insert with check (
    exists (
      select 1 from collections c
      where c.id = collection_id and c.user_id = auth.uid()
    )
  );

create policy "collection_decks_delete" on collection_decks
  for delete using (
    exists (
      select 1 from collections c
      where c.id = collection_id and c.user_id = auth.uid()
    )
  );
