# Quiz Mode — Design Spec

**Date:** 2026-04-28
**Status:** Approved

## Overview

A timed, scored quiz experience at `/quiz/[deckId]` that automatically selects the user's weakest cards and grades answers objectively. Distinct from the flashcard study session — no self-rating, answers are marked correct/wrong automatically, results show a full answer review.

## Architecture

**Route:** `src/app/quiz/[deckId]/page.tsx` — client component, mirrors the structure of `src/app/decks/[id]/page.tsx`.

**Entry point:** Deck detail page gets a "Take a quiz" button alongside "Start session." Navigates to `/quiz/[deckId]`.

**Data:** Reads from existing `/api/decks/[id]` for cards. Writes results to existing `/api/sessions` when done. No new API routes needed.

## Weak Card Selection

Runs client-side from the already-loaded card list at quiz start:

1. Cards with `times_seen >= 3` — sorted by `times_correct / times_seen` ascending (worst performers first)
2. Remaining slots filled with unseen cards (`times_seen === 0`) — new cards get tested
3. Capped at 10 cards total

First few quizzes will include unseen cards. Once cards have been seen enough times, worst performers float to the top automatically. No new database columns needed.

## Quiz Flow

### Phase 1: Mode Selection
Same modal as flashcard study mode. Options:
- **Multiple choice** — pick from 4 options (disabled if deck < 4 cards)
- **Type answer** — write it out, auto-graded
- **Random** — mix of both per card

Flip card is not offered — it requires self-rating which defeats the scoring model.

### Phase 2: Active Quiz

One question at a time, no going back.

**Top bar:**
- Question count: `7 / 18`
- Countdown timer + progress bar
  - Timer counts up (elapsed), not down — records total time taken
  - Progress bar fills as questions are answered
  - Bar turns amber when 70% of questions answered, no per-card time pressure

**Multiple choice:**
- 4 options generated client-side (3 distractors + correct), same `generateMcOptions` helper as flashcards
- Correct answer → green highlight, auto-advances after 700ms
- Wrong answer → red highlight, correct revealed in green, auto-advances after 700ms

**Type answer:**
- Textarea, Enter to submit
- Grading: case-insensitive exact match OR contains the correct answer as substring (lenient)
- After submit: shows correct answer, auto-advances after 1.5s

All answers recorded immediately as `{ cardId, correct: boolean, userAnswer: string }`.

### Phase 3: Results Screen

**Header:**
- Score percentage (large, amber)
- `X/Y correct · Nm Ns` inline below

**Answer review (scrollable):**
- Every question listed in order
- Green row = correct, red row = wrong
- Wrong rows show: your answer (red) + correct answer (green)

**Actions:**
- "Retry missed" — starts a new quiz with only the wrong cards, same mode
- "Back to deck" — returns to `/decks/[deckId]`

## Session & Card Stat Updates

After quiz completes, same calls as study session:
- `POST /api/sessions` with `score = correct / total`, `started_at`, `completed_at`
- Each card's `times_seen` and `times_correct` updated via the sessions route

This means weak card detection improves automatically with every quiz taken.

## File Map

| File | Change |
|---|---|
| `src/app/quiz/[deckId]/page.tsx` | New — full quiz client component |
| `src/app/decks/[id]/page.tsx` | Add "Take a quiz" button linking to `/quiz/[deckId]` |

## What's Not In Scope

- Per-question time limits
- Configurable quiz length
- Leaderboards or sharing
- Adaptive generation (separate spec)
