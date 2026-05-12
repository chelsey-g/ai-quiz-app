# AI-Expanded Cards Design

## Goal

Add an "Expand with AI" button to the deck page that generates 5–8 additional flashcards covering related concepts, gaps, and gotchas not already in the deck — for any deck regardless of how it was created.

## Architecture

A new API route `POST /api/decks/[id]/expand` reads the deck's existing content and calls Claude to generate supplementary cards. The deck page calls this route and appends the returned cards to its local state without a page reload. The route reuses the existing `generateObject` + `DeckSchema` pipeline with a new prompt focused on filling gaps rather than extracting from source material.

**Tech stack:** Next.js App Router API route, Vercel AI Gateway (`generateObject`), existing `DeckSchema` (returns `title`, `topic_tags`, `cards[]`), Supabase service client for inserts.

---

## API Route: `POST /api/decks/[id]/expand`

**File:** `src/app/api/decks/[id]/expand/route.ts`

**Auth:** Requires authenticated user. Verifies `deck.user_id === user.id` — returns 403 if not the owner.

**Request:** No body required. All context is read from the deck row.

**Logic:**
1. Fetch deck (`title`, `topic_tags`, `user_id`) and all existing card fronts from Supabase using the service client.
2. Call `generateObject` with `DeckSchema` and a gap-filling prompt (see below).
3. Insert the new cards into the `cards` table with `deck_id = id`.
4. Increment `card_count` on the deck by the number of new cards.
5. Return `{ cards: newCards, addedCount }`.

**Prompt design:**

System:
```
You are a study content generator. Given a deck title, its topic tags, and a list of questions it already covers, generate additional flashcards that fill gaps — covering related concepts, common gotchas, edge cases, and deeper details not already addressed. Every card must be self-contained.
```

User:
```
Deck: {title}
Topics: {topic_tags.join(", ")}

Already covered (do not duplicate):
{existing fronts, one per line}

Generate 5–8 new cards.
```

**Error handling:** If generation fails, return 500 with the error message. The deck is not modified if the insert fails.

**Response shape:**
```ts
{ cards: Card[], addedCount: number }
```

---

## UI: Deck Page

**File:** `src/app/decks/[id]/page.tsx`

**Placement:** In the same row as the "Add card" button, to its right.

**States:**
- `idle` — "Expand with AI" button visible
- `expanding` — button replaced with a spinner + "Generating cards…" text; the deck is non-interactive during this time
- `done` — button reappears; new cards are appended to `allCards` and highlighted with a brief fade-in ring for 2 seconds so the user can see what was added

**State variables added:**
- `expanding: boolean`
- `newCardIds: Set<string>` — tracks recently added card IDs for the highlight animation; cleared after 2s

**On success:** `setAllCards(prev => [...prev, ...newCards])`, update `deck.card_count`, set `newCardIds` to the new IDs, schedule a 2s timeout to clear them.

**On error:** Show an inline error message below the button.

**Distractor generation:** After inserting new cards, kick off `generateAndSaveDistractorsForDeck` for the deck (same fire-and-forget pattern as the other generation routes). This is done server-side in the API route.

---

## Files

| Action | File |
|--------|------|
| Create | `src/app/api/decks/[id]/expand/route.ts` |
| Modify | `src/app/decks/[id]/page.tsx` |

No schema changes needed — new cards use the existing `cards` table.

---

## Out of scope

- Expand button on cards that belong to someone else (community decks you forked are yours, so the button will appear on those too — that's fine)
- Limiting how many times you can expand (no rate limiting for now)
- Streaming the new cards in one-by-one
