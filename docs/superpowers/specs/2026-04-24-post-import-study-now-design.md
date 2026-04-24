# Post-Import "Study Now" Action — Design Spec

**Date:** 2026-04-24
**Status:** Ready for implementation

## Problem

The import flow is a dead end. After a successful import, users see a result card confirming their deck was created (title, card count, model used), but there is no path to study it. They must navigate away to the dashboard and find the deck manually. This is unnecessary friction immediately after the most motivated moment — the user just created the deck.

## Solution

Add a "Study deck" link to each successful import result card. The link navigates directly to `/decks/[id]` for that deck. The deck ID is already available server-side (returned by the Supabase insert) — it just needs to be surfaced in the API response and rendered in the UI.

## Scope

Two surgical changes:

### 1. API route — `src/app/api/import/route.ts`

Add `deckId: newDeck.id` to the result object pushed for successful imports.

Before:
```ts
results.push({
  file: file.name,
  status: "ok",
  title: deck.title,
  cardCount: deck.cards.length,
  provider,
  model,
});
```

After:
```ts
results.push({
  file: file.name,
  status: "ok",
  title: deck.title,
  deckId: newDeck.id,
  cardCount: deck.cards.length,
  provider,
  model,
});
```

Also update the result type declaration to include `deckId?: string`.

### 2. Import UI — `src/app/import/page.tsx`

- Add `deckId?: string` to the `ImportResult` interface
- Import `Link` from `next/link`
- In the result card JSX, when `result.status === "ok"` and `result.deckId` is present, render a "Study deck" link styled as a small secondary button, positioned below the model/provider line within the existing card

The link placement stays within the existing card's left column (below the metadata), keeping the right column for the card count badge. No layout restructuring needed.

## What This Does Not Change

- Error result cards — unchanged, no Study link added
- The "Import more" button — unchanged
- The progress/processing state — unchanged
- Dashboard, deck detail page, or any other page — unchanged

## Success Criteria

- After a successful import, each result card shows a "Study deck" link
- Clicking the link navigates to `/decks/[deckId]`
- Error result cards show no Study link
- The result card layout is visually consistent with the existing design
- No TypeScript errors

## Non-Goals

- Auto-redirect after import (loses the result feedback)
- A single combined CTA for all decks (loses per-deck association)
- Any changes to the deck detail page or study experience
