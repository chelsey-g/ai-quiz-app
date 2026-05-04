# Collections Design

**Date:** 2026-05-04  
**Status:** Approved

## Overview

"My Collection" — users can create named groups of decks (collections), toggle each public or private, and public collections appear as a section on the `/profile` page. Collections are managed from the dashboard via a popover on each deck card.

## Data Model

### New tables

**`collections`**
- `id uuid PK default gen_random_uuid()`
- `user_id uuid not null FK auth.users on delete cascade`
- `name text not null`
- `is_public boolean not null default false`
- `created_at timestamptz not null default now()`

**`collection_decks`**
- `collection_id uuid not null FK collections on delete cascade`
- `deck_id uuid not null FK decks on delete cascade`
- `added_at timestamptz not null default now()`
- `PRIMARY KEY (collection_id, deck_id)`

### RLS policies

**collections:**
- SELECT: own rows OR is_public = true
- INSERT: auth.uid() = user_id
- UPDATE: auth.uid() = user_id
- DELETE: auth.uid() = user_id

**collection_decks:**
- SELECT: collection is own OR collection is public
- INSERT: collection belongs to auth.uid()
- DELETE: collection belongs to auth.uid()

## API Routes

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/collections` | List current user's collections (with deck count) |
| POST | `/api/collections` | Create a new collection |
| PATCH | `/api/collections/[id]` | Rename or toggle is_public |
| DELETE | `/api/collections/[id]` | Delete collection (decks unaffected) |
| POST | `/api/collections/[id]/decks` | Add a deck to collection |
| DELETE | `/api/collections/[id]/decks` | Remove a deck from collection |

## Dashboard UX

Each deck card gets a folder icon button in its action area. Clicking opens an inline popover:
- List of user's collections, each with a checkbox (checked = deck is in that collection)
- Toggling checkbox immediately adds/removes the deck (no save button)
- "New collection…" text input at bottom; Enter creates collection + adds deck in one step
- Popover closes on outside click or Escape

## Profile Page

A "Collections" section below the stats tiles. Only public collections (`is_public = true`) are shown. Each collection renders as a card:
- Collection name (bold)
- Deck count (muted)
- Public/private toggle — clicking it PATCHes `is_public`, updates optimistically

If the user has no public collections, the section shows a brief prompt to make a collection public.

Data is fetched server-side in the existing `ProfilePage` server component.

## Error Handling

- Creating a collection with a blank name: client blocks the request, no API call
- Adding a deck already in the collection: API treats as no-op (upsert / ignore conflict)
- Deleting a collection: decks are unaffected (only the `collection_decks` rows are cascade-deleted)
- Unauthenticated requests to mutating routes: 401
