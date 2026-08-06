# Plan 009: "Regenerate answers" button on deck detail page

> **Executor instructions**: Follow this plan step by step. Confirm plan 008
> is DONE before starting (this touches the same files: `distractors.ts` and
> `decks/[id]/page.tsx`). Run every verification command before moving on.
> Update the status row in `plans/README.md` when finished.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW — user-initiated, ownership-checked, reuses existing generation infra
- **Depends on**: 008 (condensed MC answer must ship first, or this just regenerates the old long-answer behavior)
- **Category**: feature
- **Planned at**: 2026-08-06, follow-up to plan 008 at user's request

## Why this matters

Plan 008 only fixes MC answer length for newly-generated cards. Every card
already at `mc_status = 'ready'` keeps its current (long) correct answer
forever — nothing re-triggers generation for `'ready'` cards, and the
existing per-card regenerate endpoint (`/api/cards/[id]/generate-distractors`)
explicitly no-ops when `mc_status === "ready"`. Users with existing decks get
no benefit from 008 unless they can explicitly ask for a refresh.

Decided against a system-wide bulk regeneration migration (would silently
re-run AI generation for every MC-enabled card across every user of the app —
real, uncontrolled AI Gateway cost). This is the scoped alternative: a
user-triggered, per-deck action, so cost only occurs when someone actually
asks for it, on their own deck.

## How the existing infra already does most of this

`src/app/api/decks/[id]/route.ts` `GET` handler already does, on every deck load:

```ts
if (cards.some(c => c.mc_status === "pending" || c.mc_status === "failed")) {
  generateAndSaveDistractorsForDeck(id, deck.title).catch(() => {});
}
```

and `src/app/decks/[id]/page.tsx` already polls (~L557) until no card is
`mc_status === "pending"` anymore, refreshing the UI when generation
finishes. `generateAndSaveDistractorsForDeck` (`src/lib/services/distractors.ts`)
already selects and regenerates any card `mc_status in ('pending', 'failed')`.

So "regenerate" doesn't need new generation logic — it needs a way to flip a
deck's already-`'ready'` cards back to `'pending'`, and the existing
poll-and-refresh path does the rest for free.

## Changes

### 1. New endpoint: reset a deck's cards to pending

`POST /api/decks/[id]/regenerate-mc/route.ts` (new file):
- Auth check (`Unauthorized` if no user).
- Verify deck ownership: `.from("decks").select("id").eq("id", id).eq("user_id", user.id).single()` — 404/403 if not found/not owned. Follow the same pattern as other owned-resource routes in this codebase (see `api/collections`, `api/profile` for the style).
- `update cards set mc_status = 'pending' where deck_id = :id` (all cards in the deck, regardless of current status — this is the "regenerate everything" action).
- Return 200. Do NOT call `generateAndSaveDistractorsForDeck` directly here — let the existing GET-triggered fire-and-forget path pick it up next time the deck is fetched, exactly like the current pending/failed flow. (If that turns out to introduce a noticeable delay in manual testing, it's fine to also kick off `generateAndSaveDistractorsForDeck(id, deck.title).catch(() => {})` fire-and-forget from this route directly — use judgment, don't over-engineer either way.)

### 2. UI: button on the deck detail page

`src/app/decks/[id]/page.tsx`:
- Add a "Regenerate answers" action, placed wherever this page's existing deck-level actions/settings live (find the natural spot — don't invent a new menu structure if one already exists).
- On click: confirm dialog if there's a project pattern for confirming destructive-ish/cost-incurring actions elsewhere in the app — otherwise a simple click is fine, this isn't destructive (distractors get regenerated, not deleted, and `back` is untouched).
- Call the new endpoint, then rely on the **existing** pending-poll mechanism already in this file to refresh the UI — don't build a second polling path.
- Disable the button while any card in the deck is already `mc_status === 'pending'` (covers both "regeneration in progress" and prevents double-clicks/spam).

## Explicitly out of scope

- No system-wide/bulk regeneration of other users' decks.
- No new rate-limiting — deliberately deferred to the existing `ai-rate-limiting` plan (`docs/superpowers/plans/`, item #4 on the roadmap). Don't build ad hoc throttling here.
- No changes to `distractors.ts` generation logic beyond what plan 008 already ships — this plan is pure plumbing (status reset + trigger UI) on top of 008's fix.

## Verification

1. `npm run lint` / `npx tsc --noEmit` clean.
2. Manually: open a deck with `mc_status = 'ready'` cards, click regenerate, confirm cards flip to `pending`, then to `ready` again with a shorter `mc_condensed_answer` after the existing poll picks it up.
3. Confirm the endpoint 403/404s for a deck you don't own (test via a second account or by hitting the route with a foreign deck id).
4. Confirm clicking regenerate twice quickly doesn't kick off two overlapping generation runs (button disable state, or idempotent behavior server-side).
