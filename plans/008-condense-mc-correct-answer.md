# Plan 008: Condense the correct answer in multiple-choice rendering

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. When done, update the status row for this plan in
> `plans/README.md` (add a row if one doesn't exist yet).

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW — additive column + fallback to current behavior when absent
- **Depends on**: none
- **Category**: quality / UX
- **Planned at**: 2026-08-06, from a direct user request (not the `/improve` audit batch)

## Why this matters

In every multiple-choice rendering (quiz mode, quick quiz, flashcard MC study
mode, challenge play), the correct option is the raw `cards.back` text and the
three wrong options are AI-generated distractors. The distractor prompt
already tries to match distractor length to `back`'s length (±2 words), but
that instruction isn't reliably followed by the model in practice — the user
reports the correct answer is still visibly longer than the wrong answers,
making it identifiable by length alone before reading any of the options.

**User-confirmed direction ("option 2"):** don't shorten `back` itself — it's
used for flashcard study, typed-answer grading, and post-quiz review, where
the fuller answer is wanted. Instead, generate a **condensed variant of the
correct answer**, used only as the correct MC option, and make distractors
match *that* shorter length instead of `back`'s length. `back` stays
untouched everywhere else.

## Current state

**Schema** (`supabase/migrations/`): `cards` has `mc_distractors text[]` and
`mc_status text check (mc_status in ('pending','ready','failed'))` — see
`20260506160933_add_mc_status.sql`. No condensed-answer column exists yet.

**Generation** (`src/lib/services/distractors.ts`): `SINGLE_SYSTEM_PROMPT` /
`BATCH_SYSTEM_PROMPT` instruct the model to count words in `back` and match
distractor length to it. `SingleSchema` / `buildBatchSchema` return only
`distractors: string[]`. `generateAndSaveDistractors` /
`generateAndSaveDistractorsForDeck` write `mc_distractors` + `mc_status` only.

**Rendering** — the same pattern is duplicated in 4 files (this duplication
predates this plan; see plan 007 which will eventually extract it — don't
block on that, just apply the same edit shape in all 4 places):

| File | MC-options builder | Correct-answer equality checks |
|---|---|---|
| `src/app/quiz/[deckId]/page.tsx` | `shuffleAnswers(targetCard.back, targetCard.mc_distractors)` (~L66-73) | `isCorrect = option === currentCard.back` (~L748) |
| `src/app/quiz/quick/page.tsx` | same shape (~L79-86) | equivalent `isCorrect` check in the render loop |
| `src/app/decks/[id]/page.tsx` | same shape (~L106-113) | `isCorrect = option === currentCard.back` (~L2123), plus `selectedMcOption === currentCard.back` used to call `markKnown()/markUnknown()` (~L1039, ~L2164) |
| `src/app/challenges/[id]/play/page.tsx` | same shape (~L33-40) | `option === card.back` (~L222, ~L604) |

None of these should change: typed-answer grading (`gradeTypeAnswer(typedAnswer, card.back)`), flashcard front/back display (`CardText text={card.back}`), and post-answer "Correct: {back}" review text — all stay on the full `back` field by design.

## Changes

### 1. Migration

New file `supabase/migrations/<timestamp>_add_mc_condensed_answer.sql`:

```sql
alter table cards
  add column if not exists mc_condensed_answer text;
```

Nullable, no default, no backfill. Follow the `supabase-postgres-best-practices`
skill for migration conventions before writing it.

### 2. `src/lib/services/distractors.ts`

- Change both schemas to also return the condensed correct answer:
  ```ts
  const SingleSchema = z.object({
    condensedAnswer: z.string(),
    distractors: z.array(z.string()).length(3),
  });
  ```
  and the batch equivalent (`condensedAnswer` per result row).
- Rewrite the LENGTH AND FORM rule in both system prompts: instead of
  "match the correct answer's length," instruct the model to (a) first
  condense the correct answer to its shortest faithful form — same meaning,
  same grammatical category (noun phrase / number / sentence), no invented
  content, still unambiguously correct on its own — and (b) then produce 3
  distractors within ±2 words of the *condensed* form's length, mirroring its
  grammatical form. Keep the existing misconception/plausibility/never-echo
  rules as-is.
- `cleanDistractors(back, raw)` currently dedupes against `back`. It should
  dedupe against the *condensed* answer instead (that's what distractors are
  now being compared for near-duplication against), while still rejecting a
  distractor that exactly matches the original `back` text.
- `generateAndSaveDistractors` / `generateAndSaveDistractorsForDeck`: save
  `mc_condensed_answer` alongside `mc_distractors` and `mc_status: "ready"`.
  On failure, leave `mc_condensed_answer` null (same as today for distractors).

### 3. The 4 rendering call sites

In each file, wherever `targetCard.back` / `currentCard.back` / `card.back` is
passed as the "correct" argument to `shuffleAnswers`, or compared for MC
selection/correctness, swap in a condensed-with-fallback value:

```ts
const mcCorrectAnswer = (c: Card) => c.mc_condensed_answer ?? c.back;
```

(name/placement to match each file's existing conventions) and use
`mcCorrectAnswer(card)` in place of `card.back` in:
- the `shuffleAnswers(...)` call inside the MC-options builder
- `isCorrect = option === ...`
- any `selectedMcOption === ...` check used to decide correctness

Do **not** touch `card.back` usages for: typed-answer grading, flashcard
front/back display, or "Correct: {back}" review/results text.

## Explicitly out of scope for this plan — flag back to the user, don't decide unilaterally

Cards that already have `mc_status = 'ready'` (i.e., every card generated
before this ships) will keep their current long correct answer indefinitely:
nothing re-triggers generation for `'ready'` cards today, and
`/api/cards/[id]/generate-distractors` explicitly no-ops when
`mc_status === "ready"` (see route.ts L26). So this plan **only fixes new
cards** — it does not retroactively shorten existing decks' MC options,
which is what the user was actually looking at when they raised this.

Two follow-up options exist and were not decided in this planning session,
because both have cost/scope implications beyond what was asked:
1. Add a way to force-regenerate a single card's MC data on demand (small:
   drop the ready-guard behind a `force` flag or a "regenerate" UI action).
2. A one-time migration flipping all existing `mc_status = 'ready'` rows back
   to `'pending'` so they regenerate automatically next time each deck is
   opened — this re-runs AI generation for every MC-enabled card across every
   user of the app, a real one-time AI Gateway cost, not just the requesting
   user's own decks.

Do not implement either without asking the user first.

## Verification

1. `npm run lint` / `npx tsc --noEmit` clean.
2. Existing unit tests still pass (`npm test` or equivalent — check
   `package.json` for the script name); distractor-related tests referenced
   in CLAUDE.md ("distractors" test file) must be updated for the new
   `condensedAnswer` field, not just left passing by accident.
3. Manually (or via a script) generate distractors for a test card with a
   long `back` and confirm: `mc_condensed_answer` is populated, is shorter
   than `back`, and each `mc_distractors` entry is within ~±2 words of the
   condensed answer's word count — not `back`'s.
4. Confirm a card with `mc_condensed_answer: null` (pre-existing/legacy path)
   still renders correctly using `back` as the fallback correct option — no
   crash, no regression for ungenerated/legacy cards.
