# Plan 004: Batch card stat updates — replace N+1 with single upsert

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat fce2489..HEAD -- src/lib/services/card-stats.ts`
> If the file changed (especially if plan 003 was already executed), compare
> the "Current state" excerpts before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: MED — switching from individual `.update()` calls to a batch `.upsert()` changes atomicity semantics; test carefully
- **Depends on**: plans/003-card-stats-ownership.md (plan 003 changes the same file — execute 003 first, then drift-check before starting this plan)
- **Category**: perf
- **Planned at**: commit `fce2489`, 2026-06-12

## Why this matters

After a 20-card quiz session, `updateCardStats` fires 21 Supabase queries: 1 fetch + 20 individual `.update()` calls via `Promise.all`. With Supabase's Postgres-backed API, each call is a separate HTTP round-trip. A single upsert replaces the 20 update calls with one, reducing DB round-trips by ~95% per session.

## Current state

**File**: `src/lib/services/card-stats.ts` (after plan 003 is applied, signature is `updateCardStats(userId, results)`)

The N+1 pattern (lines 29–42, may shift by a few lines after plan 003):
```ts
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
```

One `.update()` call per card — 20 cards = 20 queries.

## Commands you will need

| Purpose    | Command            | Expected on success   |
|------------|--------------------|-----------------------|
| Typecheck  | `npx tsc --noEmit` | exit 0, no output     |
| Tests      | `npm test`         | all pass              |

## Scope

**In scope**:
- `src/lib/services/card-stats.ts` — replace the `Promise.all` map with a batch upsert

**Out of scope**:
- Callers of `updateCardStats` — the function signature does not change
- SM-2 scheduling fields — do not add SM-2 logic here; that is plan 006

## Git workflow

- Branch: `perf/batch-card-stat-updates`
- Commit: `perf(card-stats): replace N+1 updates with single batch upsert`

## Steps

### Step 1: Replace the `Promise.all` map with a batch upsert

After building `cardMap` from `existingCards`, compute the full updated payload in memory and issue a single `.upsert()`:

```ts
const cardMap = new Map(existingCards.map((c) => [c.id, c]));

const updates = results
  .map(({ cardId, correct }) => {
    const card = cardMap.get(cardId);
    if (!card) return null;
    return {
      id: cardId,
      times_seen: card.times_seen + 1,
      times_correct: card.times_correct + (correct ? 1 : 0),
      last_seen_at: now,
    };
  })
  .filter((u): u is NonNullable<typeof u> => u !== null);

if (updates.length === 0) return;

await db
  .from("cards")
  .upsert(updates, { onConflict: "id" });
```

The `upsert` with `onConflict: "id"` will update existing rows by primary key — functionally identical to the individual `.update()` calls, but in a single query.

**Verify**: `npx tsc --noEmit` → exit 0

### Step 2: Run tests

```bash
npm test
```

Expected: all pass (no tests directly cover `card-stats.ts`, but type correctness is verified).

### Step 3: Commit

```bash
git add src/lib/services/card-stats.ts
git commit -m "perf(card-stats): replace N+1 updates with single batch upsert"
```

## Test plan

No automated tests exist for this function yet. Manual verification:
1. Complete a quiz — open Supabase dashboard → Logs → API logs. Confirm that one session save now generates 2 API calls (1 fetch + 1 upsert) instead of 21+.
2. Verify card stats updated correctly: after a 5-card quiz, check `times_seen` and `times_correct` in the Supabase table editor for those cards.

Future test (model after `src/lib/services/stats.test.ts`): mock the service client, call `updateCardStats("user-id", [{cardId: "x", correct: true}])`, assert that `db.from("cards").upsert` was called once with the correct payload.

## Done criteria

- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm test` exits 0
- [ ] `src/lib/services/card-stats.ts` contains `.upsert(updates` and does NOT contain `Promise.all(` for the update loop
- [ ] `plans/README.md` status row updated to DONE

## STOP conditions

- The `upsert` call causes a TypeScript type error related to `id` being required — inspect the Card type in `src/lib/database.types.ts` and confirm `id` is the primary key; if the type requires all columns, use `Partial<Card>` or cast appropriately
- Plan 003 has NOT been executed yet — the function signature may not match; read the current file and reconcile before proceeding
- `npm test` fails after the change

## Maintenance notes

- When plan 006 (wire SM-2) is executed, it will add SM-2 scheduling fields to the upsert payload. The structure here (build updates array, single upsert) makes that straightforward.
- If the card table ever adds a `version` column for optimistic locking, the upsert pattern here must add a `WHERE version = current_version` check to avoid overwriting concurrent changes.
