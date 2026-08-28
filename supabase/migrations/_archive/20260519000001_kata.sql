alter table decks add column is_code_deck boolean not null default false;

create table kata_attempts (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references decks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  problem_title text not null,
  problem_description text not null,
  function_stub text not null,
  difficulty text not null default 'easy',
  test_cases jsonb not null,
  user_code text,
  results jsonb,
  passed_count int not null default 0,
  total_count int not null default 0,
  created_at timestamptz not null default now()
);

alter table kata_attempts enable row level security;

create policy "Users can manage their own kata attempts"
  on kata_attempts for all
  using (user_id = auth.uid());

create index kata_attempts_deck_id_idx on kata_attempts (deck_id);
create index kata_attempts_user_id_idx on kata_attempts (user_id);
