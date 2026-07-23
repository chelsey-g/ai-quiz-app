# Plan 003: Add user ownership filter to updateCardStats

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat fce2489..HEAD -- src/lib/services/card-stats.ts src/app/api/sessions/route.ts`
> If either file changed, compare the "Current state" excerpts before proceeding.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW — adding the filter is purely additive; owned cards still update, unowned cards are silently ignored (same as current behavior for unknown card IDs)
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `fce2489`, 2026-06-12

## Why this matters

`updateCardStats` in `src/lib/services/card-stats.ts` accepts an array of `{ cardId, correct }` pairs and increments `times_seen`/`times_correct` on each card using the service-role key — bypassing RLS entirely. It does not verify that the cards belong to the calling user.

`/api/sessions` (the main caller) validates that the *deck* belongs to the user, but does not validate that the individual `cardId`s in `results[]` belong to that deck or user. An authenticated user could craft a request referencing another user's card IDs and corrupt their statistics.

The fix: pass `userId` into `updateCardStats` and filter the fetch query to only cards owned by that user (via the `decks` join), so unowned IDs are silently dropped.

## Current state

**File**: `src/lib/services/card-stats.ts` — uses service-role client, no ownership filter:

```ts
// src/lib/services/card-stats.ts:15-26
export async function updateCardStats(results: CardResult[]): Promise<void> {
  if (results.length === 0) return;
  const db = serviceClient();
  const cardIds = results.map((r) => r.cardId);
  const now = new Date().toISOString();

  const { data: existingCards, error: fetchError } = await db
    .from("cards")
    .select("id, times_seen, times_correct")
    .in("id", cardIds);
    // ← no ownership check; fetches ANY card by ID

  if (fetchError || !existingCards) return;
```

**File**: `src/app/api/sessions/route.ts` — validates deck ownership but not card ownership:

```ts
// src/app/api/sessions/route.ts:28-46
const { data: deck } = await supabase
  .from("decks")
  .select("id")
  .eq("id", deckId)
  .eq("user_id", user.id)   // ← deck ownership verified
  .single();

if (!deck) {
  return Response.json({ error: "Forbidden" }, { status: 403 });
}

try {
  await saveSession({
    userId: user.id,
    deckId,
    score,
    startedAt,
    results: results ?? [],   // ← results cardIds NOT validated against user ownership
  });
```

**Also relevant**: `src/app/api/cards/stats/route.ts` — the quick-quiz stats endpoint. It already has an ownership filter (lines 34–42) but uses a double `.select()` call that is confusing. This plan also cleans that up.

The service layer function `saveSession` in `src/lib/services/sessions.ts` calls `updateCardStats` at its end. Check that file for the call site.

## Commands you will need

| Purpose    | Command            | Expected on success   |
|------------|--------------------|-----------------------|
| Typecheck  | `npx tsc --noEmit` | exit 0, no output     |
| Tests      | `npm test`         | all pass              |
| Lint       | `npm run lint`     | exit 0                |

## Scope

**In scope**:
- `src/lib/services/card-stats.ts` — add `userId` parameter, add ownership filter to fetch
- `src/lib/services/sessions.ts` — update call to `updateCardStats` to pass `userId`
- `src/app/api/cards/stats/route.ts` — clean up the double `.select()` bug
- `src/app/api/sessions/route.ts` — verify `userId` flows through (likely already does via `saveSession`)

**Out of scope**:
- The `/api/sessions` deck ownership check — it is correct and should not be changed
- Any UI code
- Database schema — no migration needed

## Git workflow

- Branch: `fix/card-stats-ownership`
- Commit: `fix(security): scope card stat updates to requesting user`
- Do NOT push unless instructed

## Steps

### Step 1: Update `updateCardStats` signature to accept `userId`

In `src/lib/services/card-stats.ts`, add `userId: string` as the first parameter and add an ownership filter to the Supabase query:

```ts
import { createClient as createServiceClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

type DB = Database;

function serviceClient() {
  return createServiceClient<DB>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export type CardResult = { cardId: string; correct: boolean };

export async function updateCardStats(userId: string, results: CardResult[]): Promise<void> {
  if (results.length === 0) return;
  const db = serviceClient();
  const cardIds = results.map((r) => r.cardId);
  const now = new Date().toISOString();

  const { data: existingCards, error: fetchError } = await db
    .from("cards")
    .select("id, times_seen, times_correct, decks!inner(user_id)")
    .in("id", cardIds)
    .eq("decks.user_id", userId);

  if (fetchError || !existingCards) return;

  const cardMap = new Map(existingCards.map((c) => [c.id, c]));
  await Promise.all(
    results.map(({ cardId, correct }) => {
      const card = cardMap.get(cardId);
      if (!card) return Promise.resolve();
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
}
```

**Verify**: `npx tsc --noEmit` — will fail until callers are updated (expected). Move to step 2 immediately.

### Step 2: Update callers of `updateCardStats`

Find all call sites: `grep -rn "updateCardStats" src/`

For each call site, add the user ID as the first argument.

**In `src/lib/services/sessions.ts`**: Find the call to `updateCardStats`. It likely looks like:
```ts
await updateCardStats(results);
```
Change to:
```ts
await updateCardStats(userId, results);
```
`saveSession` should already receive `userId` in its arguments — confirm this. If not, add it to the function signature and update the caller in `/api/sessions/route.ts`.

**In `src/app/api/cards/stats/route.ts`** (the quick-quiz endpoint): Find the call to `updateCardStats` around line 46. The file also has a double `.select()` bug on lines 34–39 — fix both at once.

Replace the ownership-filter block (lines 33–46) with:
```ts
if (cardIds.length > 0) {
  await updateCardStats(user.id, body.results);
} else {
  // no-op
}
return Response.json({ ok: true });
```
Wait — the current code filters `body.results` to owned cards, then passes the filtered list to `updateCardStats`. Since `updateCardStats` now filters internally, you can simplify `/api/cards/stats/route.ts` to just call:
```ts
await updateCardStats(user.id, body.results);
return Response.json({ ok: true });
```
The ownership filtering now lives entirely inside `updateCardStats`.

Remove the now-unnecessary ownership-filter block (lines 33–43) from that file.

**Verify**: `npx tsc --noEmit` → exit 0

### Step 3: Run tests

```bash
npm test
```

Expected: all existing tests pass (no tests exist for `card-stats.ts` yet, but the type signatures must be correct).

### Step 4: Commit

```bash
git add src/lib/services/card-stats.ts src/lib/services/sessions.ts src/app/api/cards/stats/route.ts
git commit -m "fix(security): scope card stat updates to requesting user"
```

## Test plan

No existing tests for `card-stats.ts`. Manual verification:
1. Complete a quiz — stats should still update normally on your own cards.
2. (Requires two accounts or a direct API call): POSTing to `/api/sessions` with `results` containing card IDs from another user's deck should silently drop those card IDs — their `times_seen` should not increment.

For a future automated test, model it after `src/lib/services/stats.test.ts` — mock the Supabase client, call `updateCardStats("user-a", [{cardId: "card-owned-by-user-b", correct: true}])` and assert that no update was issued.

## Done criteria

- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm test` exits 0
- [ ] `updateCardStats` signature is `(userId: string, results: CardResult[])`
- [ ] The fetch query in `updateCardStats` includes `.eq("decks.user_id", userId)`
- [ ] `grep -rn "updateCardStats" src/` shows all call sites pass a user ID
- [ ] `plans/README.md` status row updated to DONE

## STOP conditions

- `saveSession` in `src/lib/services/sessions.ts` does not receive a `userId` parameter and the change would require propagating it through more files than expected — stop and report
- The Supabase inner join `decks!inner(user_id)` causes a TypeScript type error that requires schema changes — stop and report
- `npm test` fails on an existing test after your changes

## Maintenance notes

- `updateCardStats` uses the service-role key to bypass RLS. The ownership filter added here replicates what RLS would enforce if the user-scoped client were used instead. If this service is ever refactored to use the user-scoped client, the explicit filter becomes redundant but harmless.
- If a "shared deck" feature is added (multiple users can study the same deck), this filter must be revisited — card ownership would need to be checked against membership, not just `decks.user_id`.
