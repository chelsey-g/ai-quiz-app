# Plan 002: Fix unawaited quiz session saves and missing response error checks

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat fce2489..HEAD -- src/app/quiz/quick/page.tsx "src/app/quiz/[deckId]/page.tsx"`
> If either file changed, compare the "Current state" excerpts before proceeding.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW — making `advanceToNext` async and awaiting the save delays the results screen by a network round-trip, but that is correct behavior; users should not see results until the data is persisted
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `fce2489`, 2026-06-12

## Why this matters

Two quiz pages call their session-save functions without `await` before calling `setPhase("results")`. If the user navigates away, closes the tab, or the component unmounts in the milliseconds between the phase transition and the save completing, the session data is permanently lost. The user sees the results screen but nothing was recorded — streaks, accuracy, and stats are silently wrong.

A second related bug: `saveStats` fires multiple `fetch()` calls via `Promise.all` but never checks `res.ok`. A 401 (session expired) or 500 is treated as success. Both issues are fixed here.

## Current state

**File 1**: `src/app/quiz/quick/page.tsx`

`advanceToNext` (lines 258–264) — sync function, unawaited save:
```ts
// src/app/quiz/quick/page.tsx:258-264
function advanceToNext() {
  const isLast = currentIndex + 1 >= cards.length;
  if (isLast) {
    if (timerRef.current) clearInterval(timerRef.current);
    if (startedAt) saveStats(answers, startedAt);  // ← not awaited
    setPhase("results");
```

`saveStats` (lines 193–214) — async but fetch responses unchecked:
```ts
// src/app/quiz/quick/page.tsx:200-213
await Promise.all(
  [...byDeck.entries()].map(([deckId, records]) =>
    fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ... }),
    })
    // ← no .then(r => { if (!r.ok) throw new Error(...) })
  )
);
```

**File 2**: `src/app/quiz/[deckId]/page.tsx`

`advanceToNext` (lines 240–258) — also passes the save without await:
```ts
// src/app/quiz/[deckId]/page.tsx:245-251
function advanceToNext(...) {
  const isLast = currentIndex + 1 >= currentQuizCards.length;
  if (isLast) {
    if (timerRef.current) clearInterval(timerRef.current);
    if (currentStartedAt) saveQuizSession(currentAnswers, currentStartedAt);  // ← not awaited
    setPhase("results");
```

## Commands you will need

| Purpose    | Command            | Expected on success   |
|------------|--------------------|-----------------------|
| Typecheck  | `npx tsc --noEmit` | exit 0, no output     |
| Lint       | `npm run lint`     | exit 0                |

## Scope

**In scope**:
- `src/app/quiz/quick/page.tsx` — fix `advanceToNext` and `saveStats`
- `src/app/quiz/[deckId]/page.tsx` — fix `advanceToNext` and `saveQuizSession`

**Out of scope**:
- Any other quiz pages — only these two have the unawaited pattern
- The API routes themselves — they are not changed here

## Git workflow

- Branch: `fix/unawaited-quiz-saves`
- Commit: `fix(quiz): await session saves before showing results`
- Do NOT push unless instructed

## Steps

### Step 1: Fix `advanceToNext` and `saveStats` in quick/page.tsx

Make `advanceToNext` async and await the save. Also add `res.ok` checks to `saveStats` so HTTP errors surface instead of being swallowed.

Find and replace the `saveStats` function body (lines 193–214). The updated version:

```ts
async function saveStats(answersSnapshot: AnswerRecord[], startedAtSnapshot: string) {
  const byDeck = new Map<string, AnswerRecord[]>();
  for (const a of answersSnapshot) {
    const did = a.card.deck_id;
    if (!byDeck.has(did)) byDeck.set(did, []);
    byDeck.get(did)!.push(a);
  }
  await Promise.all(
    [...byDeck.entries()].map(async ([deckId, records]) => {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deckId,
          score: records.filter((r) => r.correct).length,
          startedAt: startedAtSnapshot,
          results: records.map((r) => ({ cardId: r.cardId, correct: r.correct })),
        }),
      });
      if (!res.ok) {
        console.error(`saveStats: /api/sessions returned ${res.status} for deck ${deckId}`);
      }
    })
  );
}
```

Find and replace the `advanceToNext` function (lines 258–270). Make it async and await the save:

```ts
async function advanceToNext() {
  const isLast = currentIndex + 1 >= cards.length;
  if (isLast) {
    if (timerRef.current) clearInterval(timerRef.current);
    if (startedAt) await saveStats(answers, startedAt);
    setPhase("results");
  } else {
    setCurrentIndex((i) => i + 1);
    setTypedAnswer("");
    setAnswerSubmitted(false);
    setAiGrading(false);
    setGradeResult(null);
    setSelectedOption(null);
  }
}
```

All call sites of `advanceToNext` in this file use it as an `onClick` handler (e.g. `onClick={advanceToNext}`). React event handlers can be async — no change needed at call sites.

**Verify**: `npx tsc --noEmit` → exit 0

### Step 2: Fix `advanceToNext` and `saveQuizSession` in [deckId]/page.tsx

Open `src/app/quiz/[deckId]/page.tsx`. Find `advanceToNext` (around line 240). It currently receives `currentQuizCards`, `currentAnswers`, `currentStartedAt` as parameters and calls `saveQuizSession` without await.

Make it async and await the save:

```ts
async function advanceToNext(
  currentQuizCards: Card[],
  currentAnswers: AnswerRecord[],
  currentStartedAt: string | null,
) {
  const isLast = currentIndex + 1 >= currentQuizCards.length;
  if (isLast) {
    if (timerRef.current) clearInterval(timerRef.current);
    if (currentStartedAt) await saveQuizSession(currentAnswers, currentStartedAt);
    setPhase("results");
  } else {
    setCurrentIndex((i) => i + 1);
    setTypedAnswer("");
    setAnswerSubmitted(false);
    setAiGrading(false);
    setGradeResult(null);
    setSelectedOption(null);
  }
}
```

Also find `saveQuizSession` in this file and add the same `res.ok` check:

```ts
async function saveQuizSession(answersSnapshot: AnswerRecord[], startedAtSnapshot: string) {
  const score = answersSnapshot.filter((a) => a.correct).length;
  const res = await fetch("/api/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      deckId: id,
      score,
      startedAt: startedAtSnapshot,
      results: answersSnapshot.map((a) => ({ cardId: a.cardId, correct: a.correct })),
    }),
  });
  if (!res.ok) {
    console.error(`saveQuizSession: /api/sessions returned ${res.status}`);
  }
}
```

**Verify**: `npx tsc --noEmit` → exit 0

### Step 3: Commit

```bash
git add src/app/quiz/quick/page.tsx "src/app/quiz/[deckId]/page.tsx"
git commit -m "fix(quiz): await session saves before showing results, check res.ok"
```

## Test plan

No automated test infrastructure for these components. Manual verification:
1. Complete a quiz on a deck page — results screen should appear (slightly after clicking Continue on last card, while save is in flight). Check the profile page to confirm the session appears.
2. Complete a quick quiz — same check.
3. With DevTools Network throttled to "Slow 3G", note that the results screen now waits a moment rather than appearing instantly — this is correct behavior.

## Done criteria

- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm run lint` exits 0
- [ ] `advanceToNext` in both quiz pages is `async function`
- [ ] `saveStats` / `saveQuizSession` calls are preceded by `await`
- [ ] Both save functions check `res.ok` and log errors
- [ ] `plans/README.md` status row updated to DONE

## STOP conditions

- The code at the cited lines doesn't match the excerpts (codebase drifted)
- Making `advanceToNext` async causes a TypeScript error that isn't fixable within scope
- You discover `advanceToNext` is called somewhere other than React event handlers in a way that can't accept a Promise

## Maintenance notes

- If a loading/saving state indicator is ever added to the results screen, the await here is the right hook point — add a `setSaving(true)` before and `setSaving(false)` after.
- The `console.error` on failed saves is a placeholder — a future plan should surface this to the user with a toast/retry UI.
