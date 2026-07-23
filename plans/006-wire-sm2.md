# Plan 006: Wire SM-2 spaced repetition into card stat updates

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat fce2489..HEAD -- src/lib/services/card-stats.ts src/lib/sm2.ts`
> If `card-stats.ts` changed significantly (plans 003 and/or 004 applied),
> reconcile the "Current state" excerpts before proceeding — the function
> signature and query shape will differ from the original. Specifically:
> - After plan 003: signature is `updateCardStats(userId, results)` and the
>   fetch includes `.eq("decks.user_id", userId)`
> - After plan 004: the N+1 `Promise.all` is replaced by a single `.upsert()`
> Both must be applied before starting this plan. If either is missing, apply
> them first.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED — SM-2 already has full test coverage; the risk is the DB write
  (adding new columns to the upsert payload) and ensuring the default values
  are correct for new cards that have never been reviewed
- **Depends on**: plans/003-card-stats-ownership.md AND plans/004-batch-card-stat-updates.md (both must be applied first)
- **Category**: tech-debt / direction
- **Planned at**: commit `fce2489`, 2026-06-12

## Why this matters

`src/lib/sm2.ts` implements the full SM-2 spaced repetition algorithm and is
covered by 12 passing tests in `src/lib/sm2.test.ts`. The database schema
already has four SM-2 columns on the `cards` table:

```
repetitions     integer  default 0
ease_factor     double   default 2.5
interval_days   integer  default 1
next_review_at  timestamptz  nullable
```

None of these columns are written anywhere in the application. Every card sits
at its initial defaults forever. Wiring SM-2 is a one-function change:
`updateCardStats` already fetches existing card data and writes back
`times_seen`/`times_correct`; it just needs to also read the four SM-2 fields,
pass them through the algorithm, and include the results in the upsert payload.

## Current state (after plans 003 + 004 are applied)

**File**: `src/lib/services/card-stats.ts` — the function will look like this
after plans 003 and 004 land:

```ts
// src/lib/services/card-stats.ts (post-003+004)
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

  await db.from("cards").upsert(updates, { onConflict: "id" });
}
```

**File**: `src/lib/sm2.ts` — fully implemented, never imported outside tests:

```ts
// src/lib/sm2.ts:1-44
export type SM2Card = {
  repetitions: number;
  ease_factor: number;
  interval_days: number;
};

export type SM2Result = SM2Card & {
  next_review_at: string;
};

export function sm2(card: SM2Card, quality: number): SM2Result {
  let { repetitions, ease_factor, interval_days } = card;

  if (quality >= 3) {
    if (repetitions === 0) {
      interval_days = 1;
    } else if (repetitions === 1) {
      interval_days = 6;
    } else {
      interval_days = Math.round(interval_days * ease_factor);
    }
    repetitions += 1;
    ease_factor = ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    if (ease_factor < 1.3) ease_factor = 1.3;
  } else {
    repetitions = 0;
    interval_days = 1;
  }

  const next = new Date();
  next.setDate(next.getDate() + interval_days);
  next.setHours(0, 0, 0, 0);

  return { repetitions, ease_factor, interval_days, next_review_at: next.toISOString() };
}

export function qualityFromCorrect(correct: boolean): number {
  return correct ? 4 : 1;
}
```

**Database types** (`src/lib/database.types.ts`, Row shape for `cards`):
```ts
// The four SM-2 columns already exist in the generated types:
ease_factor: number          // Insert: ease_factor?: number
interval_days: number        // Insert: interval_days?: number
next_review_at: string | null  // Insert: next_review_at?: string | null
repetitions: number          // Insert: repetitions?: number
```

## Commands you will need

| Purpose    | Command            | Expected on success   |
|------------|--------------------|-----------------------|
| Typecheck  | `npx tsc --noEmit` | exit 0, no output     |
| Tests      | `npm test`         | all pass              |

## Scope

**In scope**:
- `src/lib/services/card-stats.ts` — expand the `select` to include SM-2
  columns, run `sm2()` per card, include SM-2 fields in the upsert payload

**Out of scope**:
- `src/lib/sm2.ts` — do NOT modify; it is correct and fully tested
- Any UI code — `next_review_at` is computed here but surfacing it in the UI
  is a separate feature
- The database schema — all four columns already exist with correct defaults
- Any "due for review" filtering / deck-ordering logic — that is a separate plan

## Git workflow

- Branch: `feat/wire-sm2`
- Commit: `feat(card-stats): wire SM-2 scheduling into card stat updates`
- Do NOT push unless instructed

## Steps

### Step 1: Add SM-2 imports to `card-stats.ts`

At the top of `src/lib/services/card-stats.ts`, add:

```ts
import { sm2, qualityFromCorrect } from "@/lib/sm2";
```

The file already imports from `@supabase/supabase-js` and `@/lib/database.types`.

**Verify**: `npx tsc --noEmit` — will succeed (import is valid) but no behavior
change yet. If there is a module-not-found error, check that `@/lib/sm2` resolves
via the `paths` alias in `tsconfig.json` — it should, as `sm2.ts` lives at
`src/lib/sm2.ts`.

### Step 2: Expand the `select` to include SM-2 columns

In `updateCardStats`, change the `.select()` call from:

```ts
.select("id, times_seen, times_correct, decks!inner(user_id)")
```

to:

```ts
.select("id, times_seen, times_correct, repetitions, ease_factor, interval_days, decks!inner(user_id)")
```

The SM-2 columns are on the `cards` table and are always populated (non-null
with DB defaults), so they will always be present in the result.

**Verify**: `npx tsc --noEmit` → exit 0 (the generated types include these
columns in the `Row` shape for `cards`).

### Step 3: Run `sm2()` per card and include results in the upsert payload

Replace the `updates` array construction:

**Before:**
```ts
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
```

**After:**
```ts
const updates = results
  .map(({ cardId, correct }) => {
    const card = cardMap.get(cardId);
    if (!card) return null;

    const quality = qualityFromCorrect(correct);
    const sm2Result = sm2(
      {
        repetitions: card.repetitions,
        ease_factor: card.ease_factor,
        interval_days: card.interval_days,
      },
      quality,
    );

    return {
      id: cardId,
      times_seen: card.times_seen + 1,
      times_correct: card.times_correct + (correct ? 1 : 0),
      last_seen_at: now,
      repetitions: sm2Result.repetitions,
      ease_factor: sm2Result.ease_factor,
      interval_days: sm2Result.interval_days,
      next_review_at: sm2Result.next_review_at,
    };
  })
  .filter((u): u is NonNullable<typeof u> => u !== null);
```

**Verify**: `npx tsc --noEmit` → exit 0. TypeScript will validate that
`repetitions`, `ease_factor`, `interval_days`, and `next_review_at` match
the `Insert` shape in `database.types.ts`.

### Step 4: Run tests

```bash
npm test
```

Expected: all pass. The existing `sm2.test.ts` covers the algorithm; the
existing `stats.test.ts` (if it mocks the Supabase client) may need updating
if it asserts on the exact upsert payload shape — check and fix if so.

If `src/lib/services/stats.test.ts` asserts on `upsert` being called with a
specific payload that now includes SM-2 fields, update the assertion to include
the new fields. Do not change the test logic — just extend the payload matcher.

### Step 5: Commit

```bash
git add src/lib/services/card-stats.ts
git commit -m "feat(card-stats): wire SM-2 scheduling into card stat updates"
```

## Test plan

The SM-2 algorithm is already fully tested in `src/lib/sm2.test.ts`. No new
unit tests are needed for the algorithm itself.

Manual verification:
1. Complete a 5-card quiz. Open the Supabase table editor, filter `cards` to
   those 5 IDs. Confirm `repetitions`, `ease_factor`, `interval_days`, and
   `next_review_at` have been updated from their defaults.
2. For a card answered correctly: `repetitions` should be 1 (up from 0),
   `interval_days` should be 1, `next_review_at` should be tomorrow at midnight.
3. For a card answered incorrectly: `repetitions` should be 0 (reset),
   `interval_days` should be 1.

Future automated test (model after `src/lib/services/stats.test.ts`): mock the
service client, call `updateCardStats("user", [{cardId: "x", correct: true}])`
with a mocked card having `repetitions: 2, ease_factor: 2.5, interval_days: 6`,
and assert that `db.from("cards").upsert` receives a payload where
`repetitions: 3`, `interval_days: 15`, `ease_factor: 2.6`.

## Done criteria

- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm test` exits 0
- [ ] `src/lib/services/card-stats.ts` imports `sm2` and `qualityFromCorrect` from `@/lib/sm2`
- [ ] The `.select()` call includes `repetitions, ease_factor, interval_days`
- [ ] The upsert payload includes `repetitions`, `ease_factor`, `interval_days`, `next_review_at`
- [ ] `plans/README.md` status row updated to DONE

## STOP conditions

- `npx tsc --noEmit` fails with a type error on the upsert payload — check
  `src/lib/database.types.ts` for the exact column types; `ease_factor` is
  `double precision` in Postgres (TypeScript `number`), confirm no mismatch
- Plans 003 and 004 have NOT been applied — the function signature and upsert
  pattern won't match; apply them first
- `npm test` fails on a test that asserts on the upsert payload in a way that
  can't be simply extended — stop and report the test name and failure message

## Maintenance notes

- `qualityFromCorrect` maps `true → 4` and `false → 1`. This is intentionally
  coarse — quiz pages don't currently capture graded difficulty. If the UI is
  ever updated to let users rate difficulty (1–5), pass the user's rating as
  `quality` directly instead.
- `next_review_at` is computed but not yet used anywhere in the UI to filter
  or sort decks. A future "due for review" feature would query
  `WHERE next_review_at <= now()` and surface those cards first. This plan
  deliberately does not implement that filtering.
- If the `sm2` function's signature changes (e.g., to support a different
  quality scale), update the `qualityFromCorrect` call here as well.
