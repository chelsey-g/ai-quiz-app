alter table profiles
  add column if not exists notification_prefs jsonb
    not null default '{"challenge_received": true, "challenge_completed": true}';
