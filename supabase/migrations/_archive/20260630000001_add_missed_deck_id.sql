alter table collections
  add column if not exists missed_deck_id uuid references decks(id) on delete set null;
