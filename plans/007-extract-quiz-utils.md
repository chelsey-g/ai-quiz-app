# Plan 007: Extract duplicated quiz utility functions into shared modules

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat fce2489..HEAD -- src/app/quiz/quick/page.tsx "src/app/quiz/[deckId]/page.tsx" "src/app/decks/[id]/page.tsx" "src/app/challenges/[id]/play/page.tsx" src/lib/utils/`
> If any of these files changed, re-read the current-state excerpts at the
> cited lines before proceeding — the line numbers may have shifted.

## Status

- **Priority**: P3
- **Effort**: L
- **Risk**: LOW — pure extraction, zero logic changes; the existing
  `shuffle-answers.test.ts` already proves the algorithm is correct
- **Depends on**: none (independent of plans 001–006)
- **Category**: tech-debt
- **Planned at**: commit `fce2489`, 2026-06-12

## Why this matters

Three utility functions are copy-pasted verbatim across four page files
(3,362 lines combined):

| Function | Files that define a local copy |
|---|---|
| `shuffleAnswers` | `quiz/quick/page.tsx:54`, `quiz/[deckId]/page.tsx:41`, `decks/[id]/page.tsx:89`, `challenges/[id]/play/page.tsx:16` |
| `gradeTypeAnswer` | `quiz/quick/page.tsx:81`, `quiz/[deckId]/page.tsx:68`, `decks/[id]/page.tsx:120`, `challenges/[id]/play/page.tsx:43` |
| `generateMcOptions` | `quiz/quick/page.tsx:70`, `quiz/[deckId]/page.tsx:57`, `decks/[id]/page.tsx:105` |

`shuffleAnswers` was already extracted to `src/lib/utils/shuffle-answers.ts`
and has 9 passing tests in `src/lib/utils/shuffle-answers.test.ts` — but no
page file imports it; they all still define a local copy. This plan:

1. Adds `gradeTypeAnswer` to `src/lib/utils/grade-type-answer.ts` with tests
2. Adds `generateMcOptions` to `src/lib/utils/generate-mc-options.ts` with tests
3. Switches all four pages from local definitions to shared imports (including
   `shuffleAnswers`, which has been waiting since the file was created)

Any future bug fix or improvement to these functions will then apply everywhere
automatically.

## Current state

**`src/lib/utils/shuffle-answers.ts`** — already extracted, not yet imported:
```ts
// src/lib/utils/shuffle-answers.ts:9-25
export function shuffleAnswers(correct: string, distractors: string[]): string[] {
  const ck = norm(correct);
  const seen = new Set([ck]);
  const deduped: string[] = [];
  for (const d of distractors) {
    const t = d.trim();
    if (!t) continue;
    const k = norm(t);
    if (seen.has(k)) continue;
    seen.add(k);
    deduped.push(t);
    if (deduped.length >= 3) break;
  }
  return [...deduped, correct.trim()].sort(() => Math.random() - 0.5);
}
```

**`gradeTypeAnswer`** — identical across all four pages (shown from `quiz/quick/page.tsx:81`):
```ts
function gradeTypeAnswer(userAnswer: string, correct: string): boolean {
  const norm = (s: string) => s.trim().toLowerCase();
  return (
    norm(userAnswer) === norm(correct) ||
    norm(correct).includes(norm(userAnswer)) ||
    norm(userAnswer).includes(norm(correct))
  );
}
```

**`generateMcOptions`** — identical across three pages (shown from `quiz/quick/page.tsx:70`):
```ts
function generateMcOptions(allCards: Card[], targetCard: Card): string[] {
  if (targetCard.mc_status === "ready" && targetCard.mc_distractors && targetCard.mc_distractors.length >= 3) {
    return shuffleAnswers(targetCard.back, targetCard.mc_distractors);
  }
  const fallback = allCards
    .filter((c) => c.id !== targetCard.id)
    .map((c) => c.back)
    .sort(() => Math.random() - 0.5);
  return shuffleAnswers(targetCard.back, fallback);
}
```

`generateMcOptions` references a `Card` type. In all three pages this is the
local `Card` type derived from `Database["public"]["Tables"]["cards"]["Row"]`.
The shared utility must accept a type with the fields it actually uses:
`id`, `back`, `mc_status`, `mc_distractors`. Use a minimal structural type
(not the full generated `Card`) so it is decoupled from the DB type.

## Commands you will need

| Purpose    | Command            | Expected on success   |
|------------|--------------------|-----------------------|
| Typecheck  | `npx tsc --noEmit` | exit 0, no output     |
| Tests      | `npm test`         | all pass              |
| Lint       | `npm run lint`     | exit 0                |

## Scope

**In scope**:
- Create `src/lib/utils/grade-type-answer.ts`
- Create `src/lib/utils/grade-type-answer.test.ts`
- Create `src/lib/utils/generate-mc-options.ts`
- Create `src/lib/utils/generate-mc-options.test.ts`
- `src/app/quiz/quick/page.tsx` — remove local definitions, add imports
- `src/app/quiz/[deckId]/page.tsx` — remove local definitions, add imports
- `src/app/decks/[id]/page.tsx` — remove local definitions, add imports
- `src/app/challenges/[id]/play/page.tsx` — remove local definitions, add imports

**Out of scope**:
- `src/lib/utils/shuffle-answers.ts` — already correct; do NOT modify it
- Any logic changes to the three functions — copy exactly, do not improve
- Any other refactoring in the page files — only the three local function
  definitions are removed; everything else stays untouched

## Git workflow

- Branch: `refactor/extract-quiz-utils`
- Commit order (one commit per step, or combine steps 1–4 in a single commit):
  - `refactor(utils): extract gradeTypeAnswer to shared module`
  - `refactor(utils): extract generateMcOptions to shared module`
  - `refactor(quiz): replace local quiz util definitions with shared imports`

## Steps

### Step 1: Create `src/lib/utils/grade-type-answer.ts`

Create the file with the extracted function. The logic is identical to all four
page copies:

```ts
export function gradeTypeAnswer(userAnswer: string, correct: string): boolean {
  const norm = (s: string) => s.trim().toLowerCase();
  return (
    norm(userAnswer) === norm(correct) ||
    norm(correct).includes(norm(userAnswer)) ||
    norm(userAnswer).includes(norm(correct))
  );
}
```

**Verify**: `npx tsc --noEmit` → exit 0

### Step 2: Create `src/lib/utils/grade-type-answer.test.ts`

Model after `src/lib/utils/shuffle-answers.test.ts` — same import style, same
describe/it structure. The tests should cover the three matching branches:

```ts
import { describe, it, expect } from "vitest";
import { gradeTypeAnswer } from "./grade-type-answer";

describe("gradeTypeAnswer", () => {
  it("returns true for exact match", () => {
    expect(gradeTypeAnswer("Paris", "Paris")).toBe(true);
  });

  it("returns true for case-insensitive match", () => {
    expect(gradeTypeAnswer("paris", "Paris")).toBe(true);
  });

  it("returns true when user answer is substring of correct", () => {
    expect(gradeTypeAnswer("React", "React.js")).toBe(true);
  });

  it("returns true when correct is substring of user answer", () => {
    expect(gradeTypeAnswer("The React.js library", "React")).toBe(true);
  });

  it("returns false for unrelated answers", () => {
    expect(gradeTypeAnswer("Vue", "React")).toBe(false);
  });

  it("trims whitespace before comparing", () => {
    expect(gradeTypeAnswer("  Paris  ", "Paris")).toBe(true);
  });
});
```

Run: `npm test -- grade-type-answer`
Expected: all pass

### Step 3: Create `src/lib/utils/generate-mc-options.ts`

`generateMcOptions` depends on `shuffleAnswers`. The function only uses four
fields from `Card` — define a minimal local type rather than importing the
full generated DB type:

```ts
import { shuffleAnswers } from "./shuffle-answers";

type McCard = {
  id: string;
  back: string;
  mc_status: string | null;
  mc_distractors: string[] | null;
};

export function generateMcOptions(allCards: McCard[], targetCard: McCard): string[] {
  if (
    targetCard.mc_status === "ready" &&
    targetCard.mc_distractors &&
    targetCard.mc_distractors.length >= 3
  ) {
    return shuffleAnswers(targetCard.back, targetCard.mc_distractors);
  }
  const fallback = allCards
    .filter((c) => c.id !== targetCard.id)
    .map((c) => c.back)
    .sort(() => Math.random() - 0.5);
  return shuffleAnswers(targetCard.back, fallback);
}
```

Because `McCard` is a structural type and the page `Card` types all include
`id`, `back`, `mc_status`, and `mc_distractors`, TypeScript will accept the
page's `Card[]` arguments without any casting.

**Verify**: `npx tsc --noEmit` → exit 0

### Step 4: Create `src/lib/utils/generate-mc-options.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { generateMcOptions } from "./generate-mc-options";

const makeCard = (id: string, back: string, distractors: string[] | null = null) => ({
  id,
  back,
  mc_status: distractors ? "ready" : null,
  mc_distractors: distractors,
});

describe("generateMcOptions", () => {
  it("uses mc_distractors when status is ready and has 3+ distractors", () => {
    const target = makeCard("1", "Paris", ["London", "Berlin", "Rome"]);
    const result = generateMcOptions([target], target);
    expect(result).toHaveLength(4);
    expect(result).toContain("Paris");
  });

  it("falls back to other cards when mc_distractors is null", () => {
    const target = makeCard("1", "Paris");
    const others = [makeCard("2", "London"), makeCard("3", "Berlin"), makeCard("4", "Rome")];
    const result = generateMcOptions([target, ...others], target);
    expect(result).toHaveLength(4);
    expect(result).toContain("Paris");
  });

  it("falls back when distractors has fewer than 3 items", () => {
    const target = makeCard("1", "Paris", ["London"]);
    const others = [makeCard("2", "Berlin"), makeCard("3", "Rome"), makeCard("4", "Tokyo")];
    const result = generateMcOptions([target, ...others], target);
    expect(result).toHaveLength(4);
    expect(result).toContain("Paris");
  });

  it("does not include the target card itself in fallback distractors", () => {
    const target = makeCard("1", "Paris");
    const others = [makeCard("2", "London"), makeCard("3", "Berlin"), makeCard("4", "Rome")];
    const result = generateMcOptions([target, ...others], target);
    const parisCount = result.filter((o) => o === "Paris").length;
    expect(parisCount).toBe(1);
  });
});
```

Run: `npm test -- generate-mc-options`
Expected: all pass

### Step 5: Update `src/app/quiz/quick/page.tsx`

At the top of the file, add imports after the existing import block:

```ts
import { shuffleAnswers } from "@/lib/utils/shuffle-answers";
import { gradeTypeAnswer } from "@/lib/utils/grade-type-answer";
import { generateMcOptions } from "@/lib/utils/generate-mc-options";
```

Then delete the three local function definitions (lines 54–88 at the time of
plan writing — verify exact line numbers after drift check):

```ts
// DELETE these three functions:
function shuffleAnswers(...) { ... }  // ~lines 54-68
function generateMcOptions(...) { ... }  // ~lines 70-79
function gradeTypeAnswer(...) { ... }  // ~lines 81-88
```

The call sites (`shuffleAnswers(...)`, `generateMcOptions(...)`,
`gradeTypeAnswer(...)`) remain unchanged — they are already calling the same
function names.

**Verify**: `npx tsc --noEmit` → exit 0

### Step 6: Update `src/app/quiz/[deckId]/page.tsx`

Same as step 5. Add the same three imports, delete the local definitions at
lines 41–75 (verify after drift check).

**Verify**: `npx tsc --noEmit` → exit 0

### Step 7: Update `src/app/decks/[id]/page.tsx`

Same pattern. Add imports, delete local definitions at lines 89–128 (verify
after drift check).

**Verify**: `npx tsc --noEmit` → exit 0

### Step 8: Update `src/app/challenges/[id]/play/page.tsx`

This page only defines `shuffleAnswers` and `gradeTypeAnswer` (not
`generateMcOptions`). Add two imports:

```ts
import { shuffleAnswers } from "@/lib/utils/shuffle-answers";
import { gradeTypeAnswer } from "@/lib/utils/grade-type-answer";
```

Delete the two local function definitions at lines 16–50 (verify after drift
check).

**Verify**: `npx tsc --noEmit` → exit 0

### Step 9: Run full test suite

```bash
npm test
```

Expected: all pass (including the new tests from steps 2 and 4, and the
existing `shuffle-answers.test.ts`).

### Step 10: Lint

```bash
npm run lint
```

Expected: exit 0. If lint complains about unused variables that were previously
used to call the deleted local functions — those are not possible since we
replaced definitions, not call sites. If lint reports no-shadow or similar,
investigate.

### Step 11: Confirm no local function remnants

```bash
grep -rn "^function shuffleAnswers\|^function gradeTypeAnswer\|^function generateMcOptions" src/app/
```

Expected: no output. All local definitions should be gone.

### Step 12: Commit

```bash
git add \
  src/lib/utils/grade-type-answer.ts \
  src/lib/utils/grade-type-answer.test.ts \
  src/lib/utils/generate-mc-options.ts \
  src/lib/utils/generate-mc-options.test.ts \
  src/app/quiz/quick/page.tsx \
  "src/app/quiz/[deckId]/page.tsx" \
  "src/app/decks/[id]/page.tsx" \
  "src/app/challenges/[id]/play/page.tsx"
git commit -m "refactor(quiz): extract duplicated quiz utils to shared modules"
```

## Test plan

New tests cover the extracted functions directly. The existing 9 tests in
`shuffle-answers.test.ts` continue to cover `shuffleAnswers`. The page files
are not directly testable without a full component test framework, but
TypeScript verification (`tsc --noEmit`) + the `grep` in step 11 confirm the
extraction is complete.

## Done criteria

- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm test` exits 0 (including new tests for `gradeTypeAnswer` and `generateMcOptions`)
- [ ] `npm run lint` exits 0
- [ ] `grep -rn "^function shuffleAnswers\|^function gradeTypeAnswer\|^function generateMcOptions" src/app/` → no output
- [ ] `src/lib/utils/grade-type-answer.ts` exists and exports `gradeTypeAnswer`
- [ ] `src/lib/utils/generate-mc-options.ts` exists and exports `generateMcOptions`
- [ ] `plans/README.md` status row updated to DONE

## STOP conditions

- `npx tsc --noEmit` fails with a structural type mismatch between `McCard`
  and a page's `Card` type — check which field is causing the error; if the
  page's `Card` type uses `string[]` for `mc_distractors` but `McCard` uses
  `string[] | null`, align them
- A page's `Card` type is missing `mc_status` or `mc_distractors` fields
  entirely (unlikely, but would require the `McCard` type to become more
  permissive) — stop and report
- `npm test` fails on a test that imports from a local page path rather than
  `@/lib/utils/` — should not happen for page files, but stop if so

## Maintenance notes

- `gradeTypeAnswer`'s substring-based matching is intentionally lenient. If a
  future plan tightens the grading logic (e.g. Levenshtein distance), change it
  in `grade-type-answer.ts` only — it will apply to all four quiz surfaces.
- `generateMcOptions` uses `Math.random()` for shuffling fallback distractors.
  If a seeded shuffle is ever needed for testing or reproducibility, replace
  `.sort(() => Math.random() - 0.5)` with a seeded PRNG in this one file.
- The `McCard` structural type in `generate-mc-options.ts` is intentionally
  minimal. Do not expand it to include fields not used by the function — doing
  so would tighten the coupling and force updates in callers that don't use
  those fields.
