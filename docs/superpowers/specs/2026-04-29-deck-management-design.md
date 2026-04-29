# Deck Management — Design Spec

**Date:** 2026-04-29
**Status:** Approved

## Overview

Add inline card editing, card deletion, card creation, deck rename, and deck deletion to the existing deck detail page. No separate route — management lives on `/decks/[id]` below the study controls.

## UI Layout

The deck detail page gains a **Cards section** below the study/quiz buttons, always visible.

### Deck header
- Deck title displays with a pencil icon. Clicking the icon (or the title) turns it into an inline `<input>`. Enter or blur saves; Escape cancels.
- A "Delete deck" button (destructive, muted until hover) sits in the header actions. Clicking opens a confirmation dialog before deleting.

### Card list
- Each card renders as a compact row: front text (truncated to one line) + accuracy badge (`X%` amber if studied, nothing if unseen).
- Clicking a row expands it **inline** (pushing rows below down). Expanded state shows:
  - Textarea for front text
  - Textarea for back text
  - **Save** button (amber, disabled until changed)
  - **Cancel** button (ghost)
  - **Delete card** button (red text, right-aligned)
- Only one card can be expanded at a time. Clicking another row collapses the current one (if unchanged) or leaves it open if dirty.
- Delete card: immediate optimistic removal from list. No confirmation — too low stakes. If the API call fails, the row reappears with an error state.

### Add card
- "+ Add card" button at the bottom of the list.
- Clicking inserts a blank expanded form at the bottom with empty front/back fields and a **Save** button. Cancel removes the blank form.
- After save the new card appears at the bottom of the list.

## Architecture

### Files changed
| File | Change |
|---|---|
| `src/app/decks/[id]/page.tsx` | Add `CardList` component + rename/delete deck UI |
| `src/app/api/decks/[id]/route.ts` | Add `PATCH` (rename) and `DELETE` (delete deck + cascade) |
| `src/app/api/cards/[id]/route.ts` | New — `PATCH` (edit front/back) + `DELETE` |
| `src/app/api/decks/[id]/cards/route.ts` | New — `POST` (add card to deck) |

### API contracts

**PATCH `/api/decks/[id]`**
```json
{ "title": "New title" }
→ { "ok": true }
```

**DELETE `/api/decks/[id]`**
```
→ { "ok": true }
```
Deletes deck row. Cards cascade via FK. Sessions cascade via FK.

**PATCH `/api/cards/[id]`**
```json
{ "front": "...", "back": "..." }
→ { "ok": true }
```
Auth-checks that the card's deck belongs to the current user.

**DELETE `/api/cards/[id]`**
```
→ { "ok": true }
```
Auth-checks ownership. Decrements `decks.card_count` by 1.

**POST `/api/decks/[id]/cards`**
```json
{ "front": "...", "back": "..." }
→ { "id": "uuid", "front": "...", "back": "..." }
```
Inserts with `card_type = "basic"`, increments `decks.card_count`.

## Data flow

All mutations are optimistic on the client:
1. Update local state immediately
2. Fire API call
3. On error: revert local state + show inline error message

The deck detail page already fetches cards via `/api/decks/[id]`. Card state is lifted to component-level state so mutations update the list without a full refetch.

## What's Not In Scope
- Reordering cards
- Bulk delete
- Card type changes (basic/cloze)
- Image attachments
