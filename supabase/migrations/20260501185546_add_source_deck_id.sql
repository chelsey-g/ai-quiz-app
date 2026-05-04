alter table decks
  add column if not exists source_deck_id uuid references decks(id) on delete set null;

create unique index if not exists decks_user_source_unique
  on decks (user_id, source_deck_id)
  where source_deck_id is not null;
