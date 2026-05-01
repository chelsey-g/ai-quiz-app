# Community Decks Design

## Overview

A public deck marketplace where users can browse and search decks published by other users, then fork any deck to their own dashboard for studying and editing. Browsing is open to unauthenticated visitors; forking requires a logged-in account.

---

## Data Model

### `profiles` table

Created automatically on user signup via a Postgres trigger on `auth.users`.

```sql
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);
```

RLS:
- `SELECT` — any authenticated or anonymous user can read any profile row
- `UPDATE` — only `auth.uid() = id`

A `handle_new_user` trigger inserts a row into `profiles` on every `INSERT` into `auth.users`.

### `decks.is_public` column

```sql
alter table decks add column is_public boolean not null default false;
```

New RLS policy on `decks`:
- Existing policy: `SELECT` where `user_id = auth.uid()` (own decks)
- New policy: `SELECT` where `is_public = true` (public browsing, no auth required)

### Fork operation

`POST /api/community/fork` — server-side only (service role or RLS-compliant):
1. Fetch the source deck (must be `is_public = true`)
2. Insert a new deck row: same `title`, `topic_tags`, `card_count`; `user_id = auth.uid()`; `is_public = false`; `note_id = null`
3. Bulk-insert all cards from the source deck with the new `deck_id`, resetting `times_seen` and `times_correct` to 0
4. Return `{ deckId: <new id> }` — client redirects to `/decks/<newId>`

---

## API

### `GET /api/community?q=<query>`

- Auth: not required
- Query: `title ILIKE '%q%' OR '<tag>' = ANY(topic_tags)` on rows where `is_public = true`
- Joins `profiles` to get `display_name` for each deck owner
- Returns up to 50 results ordered by `created_at DESC`
- Response: `{ decks: Array<PublicDeck> }` where `PublicDeck` extends the deck row with `publisher_name: string | null`

### `POST /api/community/fork`

- Auth: required (401 if not logged in)
- Body: `{ deckId: string }`
- Validates deck exists and `is_public = true` (404 otherwise)
- Executes fork operation described above
- Response: `{ deckId: string }`

---

## UI

### Publish toggle — deck detail page (`/decks/[id]`)

A toggle in the deck header (near the rename/delete controls). Label: "Public" when on, "Private" when off. Fires `PATCH /api/decks/[id]` with `{ is_public: boolean }`. No confirmation modal — it's reversible.

### `/community` page

- Single search bar, centered, with placeholder "Search public decks by topic or title…"
- Results rendered in the same 3-column grid as the dashboard
- Each card uses a variant of `DeckCard` that:
  - Shows "by @displayname" (or "by Anonymous" if `display_name` is null) beneath the title
  - Replaces the deck link with a **Fork** button
  - Hides accuracy bar (no personal stats on community cards)
- Empty/no-query state: prompt text, no grid
- Auth gate on Fork: unauthenticated users see "Sign in to fork" instead of the Fork button; clicking it redirects to `/login`

### Sidebar

"Community" nav link added between Dashboard and Import, with a globe icon.

---

## Out of Scope (v1)

- Pagination (capped at 50 results)
- Likes, ratings, or view counts
- Reporting / moderation
- Search ranking beyond recency
- Deck preview before forking
