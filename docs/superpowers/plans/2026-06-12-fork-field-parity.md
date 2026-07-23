# Fork Field Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Forked decks keep their multiple-choice distractors and card order instead of silently losing them.

**Architecture:** Three routes copy cards between decks. `POST /api/community/fork` and `POST /api/community/fork-collection` select/insert only `front, back, card_type, tags` — dropping `mc_distractors`, `mc_status`, and `sort_order`, so forked decks lose MC quiz support and card ordering. `POST /api/challenges/attempts/[id]/fork` copies these fields correctly, proving the right shape. Fix: one shared pure mapper `cardCopyRows()` used by all three routes, with a shared select-column constant so select and insert can't drift apart again.

**Tech Stack:** TypeScript, Supabase JS client, Vitest.

---

### Task 1: Shared card-copy mapper with tests

**Files:**
- Create: `src/lib/services/copy-cards.ts`
- Test: `src/lib/services/copy-cards.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/services/copy-cards.test.ts
import { describe, it, expect } from "vitest";
import { cardCopyRows, CARD_COPY_COLUMNS, type CopyableCard } from "./copy-cards";

const source: CopyableCard = {
  front: "What is RLS?",
  back: "Row Level Security",
  card_type: "flashcard",
  tags: ["supabase"],
  sort_order: 3,
  mc_distractors: ["Rate Limit Service", "Row List Schema"],
  mc_status: "ready",
};

describe("cardCopyRows", () => {
  it("copies content fields and resets stats", () => {
    const [row] = cardCopyRows([source], "deck-123");
    expect(row).toEqual({
      deck_id: "deck-123",
      front: "What is RLS?",
      back: "Row Level Security",
      card_type: "flashcard",
      tags: ["supabase"],
      sort_order: 3,
      mc_distractors: ["Rate Limit Service", "Row List Schema"],
      mc_status: "ready",
      times_seen: 0,
      times_correct: 0,
    });
  });

  it("defaults null tags to empty array", () => {
    const [row] = cardCopyRows([{ ...source, tags: null }], "d");
    expect(row.tags).toEqual([]);
  });

  it("select-columns constant covers every copied content field", () => {
    for (const col of ["front", "back", "card_type", "tags", "sort_order", "mc_distractors", "mc_status"]) {
      expect(CARD_COPY_COLUMNS).toContain(col);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/services/copy-cards.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```typescript
// src/lib/services/copy-cards.ts

/** Columns to SELECT from source cards when forking. Keep in sync with cardCopyRows. */
export const CARD_COPY_COLUMNS =
  "front, back, card_type, tags, sort_order, mc_distractors, mc_status";

export type CopyableCard = {
  front: string;
  back: string;
  card_type: string | null;
  tags: string[] | null;
  sort_order: number | null;
  mc_distractors: string[] | null;
  mc_status: string | null;
};

/** Maps source cards to insert rows for a new deck: content preserved, stats reset. */
export function cardCopyRows(cards: CopyableCard[], targetDeckId: string) {
  return cards.map((c) => ({
    deck_id: targetDeckId,
    front: c.front,
    back: c.back,
    card_type: c.card_type,
    tags: c.tags ?? [],
    sort_order: c.sort_order,
    mc_distractors: c.mc_distractors,
    mc_status: c.mc_status,
    times_seen: 0,
    times_correct: 0,
  }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/services/copy-cards.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/copy-cards.ts src/lib/services/copy-cards.test.ts
git commit -m "feat(fork): shared card-copy mapper preserving MC fields and sort order"
```

### Task 2: Use the mapper in community deck fork

**Files:**
- Modify: `src/app/api/community/fork/route.ts`

- [ ] **Step 1: Apply the change**

Add the import at the top:

```typescript
import { cardCopyRows, CARD_COPY_COLUMNS, type CopyableCard } from "@/lib/services/copy-cards";
```

The source-card select (currently `select("front, back, card_type, tags")`, ~line 53) becomes:

```typescript
    .select(CARD_COPY_COLUMNS)
```

The insert block (currently the `sourceCards.map((c) => ({ ... }))` literal, ~lines 62–72) becomes:

```typescript
    const { error: insertErr } = await supabase
      .from("cards")
      .insert(cardCopyRows(sourceCards as CopyableCard[], newDeck.id));
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/community/fork/route.ts
git commit -m "fix(fork): preserve mc_distractors, mc_status, sort_order when forking a deck"
```

### Task 3: Use the mapper in collection fork

**Files:**
- Modify: `src/app/api/community/fork-collection/route.ts`

- [ ] **Step 1: Apply the change**

Same import as Task 2. Inside the per-deck loop, the card copy block (currently `select("front, back, card_type, tags")` then a `.map` insert literal, ~lines 86–101) becomes:

```typescript
      const { data: sourceCards } = await supabase
        .from("cards")
        .select(CARD_COPY_COLUMNS)
        .eq("deck_id", deck.id);

      if (sourceCards && sourceCards.length > 0) {
        await supabase
          .from("cards")
          .insert(cardCopyRows(sourceCards as CopyableCard[], forkedDeckId));
      }
```

- [ ] **Step 2: Typecheck + tests**

Run: `npx tsc --noEmit && npm test`
Expected: clean, all pass.

- [ ] **Step 3: Manual verification**

Dev server up, logged in: fork a public deck that has MC cards (cards with non-null `mc_distractors`) and a custom card order. In the forked copy: quiz mode shows multiple-choice options (not regenerating), and the card order matches the source. Check the DB rows directly if UI is ambiguous.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/community/fork-collection/route.ts
git commit -m "fix(fork): preserve MC fields and sort order when forking collections"
```

### Task 4 (optional, DRY): Use the mapper in challenge-attempt fork

**Files:**
- Modify: `src/app/api/challenges/attempts/[id]/fork/route.ts`

- [ ] **Step 1: Apply the change**

This route already copies the fields correctly via a hand-rolled literal (~lines 60–76) that also resets SM-2 columns explicitly — those columns have DB defaults, so the explicit reset is redundant. Replace the `cardInserts` literal with:

```typescript
    const cardInserts = cardCopyRows(cards as CopyableCard[], newDeck.id);
```

(Keep the existing `select("*")` here — this route filters by `challenge.card_ids` and needs `id`.)

- [ ] **Step 2: Typecheck, test, commit**

Run: `npx tsc --noEmit && npm test`

```bash
git add "src/app/api/challenges/attempts/[id]/fork/route.ts"
git commit -m "refactor(challenges): reuse shared card-copy mapper in attempt fork"
```
