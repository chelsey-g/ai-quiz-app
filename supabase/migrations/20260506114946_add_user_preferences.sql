alter table profiles
  add column if not exists default_study_mode text check (default_study_mode in ('flip', 'type')) default 'flip',
  add column if not exists daily_goal integer check (daily_goal > 0);
