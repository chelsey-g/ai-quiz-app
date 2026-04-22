alter table cards
  add column repetitions int not null default 0,
  add column ease_factor float not null default 2.5,
  add column interval_days int not null default 1,
  add column next_review_at timestamptz;
