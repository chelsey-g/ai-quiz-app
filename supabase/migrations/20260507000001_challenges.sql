-- challenges
create table if not exists challenges (
  id uuid primary key default gen_random_uuid(),
  challenger_id uuid not null references auth.users on delete cascade,
  title text not null,
  deck_id uuid references decks on delete set null,
  card_ids uuid[],
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

create index challenges_challenger_id_idx on challenges (challenger_id);

-- challenge_attempts
create table if not exists challenge_attempts (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references challenges on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed')),
  score int,
  total int,
  card_results jsonb not null default '[]'::jsonb,
  started_at timestamptz,
  completed_at timestamptz
);

create index challenge_attempts_challenge_id_idx on challenge_attempts (challenge_id);
create index challenge_attempts_user_id_idx on challenge_attempts (user_id);

-- notifications
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  type text not null check (type in ('challenge_received', 'challenge_completed')),
  payload jsonb not null default '{}'::jsonb,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_user_id_idx on notifications (user_id);
create index notifications_user_id_read_idx on notifications (user_id, read);

-- RLS: challenges
alter table challenges enable row level security;

create policy "challenges_select_challenger" on challenges
  for select using (auth.uid() = challenger_id);

create policy "challenges_select_participant" on challenges
  for select using (
    exists (
      select 1 from challenge_attempts ca
      where ca.challenge_id = id and ca.user_id = auth.uid()
    )
  );

create policy "challenges_insert" on challenges
  for insert with check (auth.uid() = challenger_id);

-- RLS: challenge_attempts
alter table challenge_attempts enable row level security;

create policy "challenge_attempts_select_own" on challenge_attempts
  for select using (auth.uid() = user_id);

create policy "challenge_attempts_select_challenger" on challenge_attempts
  for select using (
    exists (
      select 1 from challenges c
      where c.id = challenge_id and c.challenger_id = auth.uid()
    )
  );

create policy "challenge_attempts_update_own" on challenge_attempts
  for update using (auth.uid() = user_id);

-- RLS: notifications
alter table notifications enable row level security;

create policy "notifications_select" on notifications
  for select using (auth.uid() = user_id);

create policy "notifications_insert" on notifications
  for insert with check (true);

create policy "notifications_update" on notifications
  for update using (auth.uid() = user_id);

-- Realtime
alter publication supabase_realtime add table notifications;
