alter table cards
  add column if not exists mc_distractors text[] default null,
  add column if not exists mc_status text
    check (mc_status in ('pending', 'ready', 'failed'))
    default 'pending';
