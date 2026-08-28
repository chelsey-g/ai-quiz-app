-- Notes: raw .md files ingested from GitHub
create table notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  source_path text not null,
  raw_content text not null,
  github_sha text,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

-- Decks: one generated study deck per note
create table decks (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references notes(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  topic_tags text[] not null default '{}',
  card_count int not null default 0,
  created_at timestamptz not null default now()
);

-- Cards: individual flashcards within a deck
create table cards (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references decks(id) on delete cascade,
  front text not null,
  back text not null,
  card_type text not null default 'flashcard', -- flashcard | mcq | free_text
  times_seen int not null default 0,
  times_correct int not null default 0,
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);

-- Sessions: a single study sitting on a deck
create table sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  deck_id uuid not null references decks(id) on delete cascade,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  score int
);

-- Keep card_count on decks in sync automatically
create or replace function update_deck_card_count()
returns trigger language plpgsql as $$
begin
  if TG_OP = 'INSERT' then
    update decks set card_count = card_count + 1 where id = NEW.deck_id;
  elsif TG_OP = 'DELETE' then
    update decks set card_count = card_count - 1 where id = OLD.deck_id;
  end if;
  return null;
end;
$$;

create trigger trg_card_count
after insert or delete on cards
for each row execute function update_deck_card_count();

-- RLS: users can only see their own data
alter table notes enable row level security;
alter table decks enable row level security;
alter table cards enable row level security;
alter table sessions enable row level security;

create policy "owner access" on notes for all using (auth.uid() = user_id);
create policy "owner access" on decks for all using (auth.uid() = user_id);
create policy "owner access" on sessions for all using (auth.uid() = user_id);

-- Cards are accessed via deck ownership
create policy "owner access" on cards for all
  using (exists (
    select 1 from decks where decks.id = cards.deck_id and decks.user_id = auth.uid()
  ));
