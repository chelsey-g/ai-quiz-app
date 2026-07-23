# Fix Card-Stats Ownership Bypass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop authenticated users from mutating other users' card stats, and stop card-stat writes from failing silently.

**Architecture:** `updateCardStats` in `src/lib/services/card-stats.ts` uses the service-role client with no ownership scoping. `POST /api/sessions` validates deck ownership but never checks that `results[].cardId` belong to that user — so any logged-in user can inflate `times_seen`/`times_correct`/`last_seen_at` on ANY card in the database. Fix: `updateCardStats` takes a `userId` and filters card IDs to those owned by the user (via the cards→decks join) before updating. Errors throw instead of returning silently. `POST /api/cards/stats` already does its own ownership filter (with a buggy double-`.select()` chain) — that filter moves into the service and the route simplifies.

**Tech Stack:** TypeScript, Supabase JS client, Vitest.

**Severity: HIGH — do this plan before the others.**

---

### Task 1: Pure ownership-filter helper with tests

**Files:**
- Create: `src/lib/services/card-stats.helpers.ts`
- Test: `src/lib/services/card-stats.helpers.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/services/card-stats.helpers.test.ts
import { describe, it, expect } from "vitest";
import { filterOwnedResults } from "./card-stats.helpers";

describe("filterOwnedResults", () => {
  const results = [
    { cardId: "a", correct: true },
    { cardId: "b", correct: false },
    { cardId: "c", correct: true },
  ];

  it("keeps only results whose cardId is in the owned set", () => {
    expect(filterOwnedResults(results, new Set(["a", "c"]))).toEqual([
      { cardId: "a", correct: true },
      { cardId: "c", correct: true },
    ]);
  });

  it("returns empty array when nothing is owned", () => {
    expect(filterOwnedResults(results, new Set())).toEqual([]);
  });

  it("returns empty array for empty results", () => {
    expect(filterOwnedResults([], new Set(["a"]))).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/services/card-stats.helpers.test.ts`
Expected: FAIL — module `./card-stats.helpers` not found.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/services/card-stats.helpers.ts
export type CardResult = { cardId: string; correct: boolean };

/** Keep only results whose card the user owns. Pure — DB lookup happens in the caller. */
export function filterOwnedResults(
  results: CardResult[],
  ownedIds: Set<string>
): CardResult[] {
  return results.filter((r) => ownedIds.has(r.cardId));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/services/card-stats.helpers.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/card-stats.helpers.ts src/lib/services/card-stats.helpers.test.ts
git commit -m "feat(card-stats): add pure ownership-filter helper"
```

### Task 2: Scope updateCardStats to the owning user and surface errors

**Files:**
- Modify: `src/lib/services/card-stats.ts` (entire file — replacement below)

- [ ] **Step 1: Replace the implementation**

The current file fetches cards by ID with NO ownership check and swallows every error (`if (fetchError || !existingCards) return;` and unchecked `Promise.all` updates). Replace the whole file with:

```typescript
// src/lib/services/card-stats.ts
import { createClient as createServiceClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { filterOwnedResults, type CardResult } from "./card-stats.helpers";

export type { CardResult };

function serviceClient() {
  return createServiceClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Increments per-card stats for the given results. Service-role client is
 * required because RLS blocks cross-row updates, so ownership MUST be
 * enforced here: only cards belonging to `userId` (via decks.user_id) are
 * ever updated. Throws on any DB error — callers return 500.
 */
export async function updateCardStats(
  userId: string,
  results: CardResult[]
): Promise<void> {
  if (results.length === 0) return;
  const db = serviceClient();
  const cardIds = results.map((r) => r.cardId);
  const now = new Date().toISOString();

  const { data: ownedCards, error: fetchError } = await db
    .from("cards")
    .select("id, times_seen, times_correct, decks!inner(user_id)")
    .in("id", cardIds)
    .eq("decks.user_id", userId);

  if (fetchError) throw new Error(fetchError.message);

  const cardMap = new Map((ownedCards ?? []).map((c) => [c.id, c]));
  const owned = filterOwnedResults(results, new Set(cardMap.keys()));

  const updates = await Promise.all(
    owned.map(({ cardId, correct }) => {
      const card = cardMap.get(cardId)!;
      return db
        .from("cards")
        .update({
          times_seen: card.times_seen + 1,
          times_correct: card.times_correct + (correct ? 1 : 0),
          last_seen_at: now,
        })
        .eq("id", cardId);
    })
  );

  const failed = updates.find((u) => u.error);
  if (failed?.error) throw new Error(failed.error.message);
}
```

- [ ] **Step 2: Update caller — saveSession**

In `src/lib/services/sessions.ts`, the call `await updateCardStats(results);` (currently near line 45) becomes:

```typescript
    await updateCardStats(userId, results);
```

`userId` is already in scope (destructured from `data` at the top of `saveSession`).

- [ ] **Step 3: Update caller — POST /api/cards/stats**

In `src/app/api/cards/stats/route.ts`, delete the manual ownership-filter block (the `if (cardIds.length > 0) { ... }` block containing the buggy chained double-`.select()`, currently lines 31–43) and change the call to pass the user ID. The body of the handler after validation becomes:

```typescript
  try {
    await updateCardStats(user.id, body.results);
    return Response.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
```

Also remove the now-unused `const cardIds = ...` line that fed the deleted block (keep the `auth.getUser()` usage — that stays).

- [ ] **Step 4: Typecheck + full test run**

Run: `npx tsc --noEmit && npm test`
Expected: no type errors; all tests pass. If `tsc` complains about the `decks!inner(user_id)` row shape, the select's generated type includes a `decks` field — it is unused, so destructure it away or cast the map values as `{ id: string; times_seen: number; times_correct: number }`.

- [ ] **Step 5: Manual verification of the actual vulnerability fix**

With the dev server running (`npm run dev`, port 3001) and logged in as a test user, POST to `/api/sessions` a valid own `deckId` but a `results` array containing a card ID from ANOTHER user's deck (grab one via Supabase dashboard). Expected: 200 OK, but the foreign card's `times_seen` is UNCHANGED in the database. Before this fix it would increment.

- [ ] **Step 6: Commit**

```bash
git add src/lib/services/card-stats.ts src/lib/services/sessions.ts src/app/api/cards/stats/route.ts
git commit -m "fix(security): scope card-stat updates to owning user, surface DB errors"
```

### Non-goals (deliberately out of scope)

- Atomic increments (read-modify-write race between concurrent sessions of the SAME user) — real but low-impact; a future migration can move increments into an RPC.
- Validating that cardIds belong to the *specific deck* in `/api/sessions` — ownership by user is the security boundary; deck-level pedantry adds queries for no security gain.
