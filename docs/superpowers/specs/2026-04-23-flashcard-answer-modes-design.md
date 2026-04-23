# Flashcard Answer Modes Design

## Overview

Before starting a study session, users choose how they want to answer flashcards. The choice is presented in a ShadCN Dialog that opens when "Start session" is clicked. Four modes are available: flip card, type answer, multiple choice, and random.

## Mode Selection UX

- "Start session" button opens a ShadCN `Dialog` (no extra page state needed)
- Dialog shows 4 selectable tiles — clicking a tile immediately starts the session in that mode
- No separate "Begin" confirm button; selection is the action
- Default: flip card (current behavior unchanged)

## Study Modes

### Flip Card (default)
Unchanged. Tap to reveal back, then "Knew it" / "Still learning".

### Type Answer
- Front shown with a textarea below
- User types response and submits with Enter or a Submit button
- Correct answer revealed alongside their input
- "Knew it" / "Still learning" buttons appear for self-assessment
- No fuzzy match — user decides if their answer was close enough

### Multiple Choice
- Front shown with 4 shuffled options
- Correct answer = current card's `back`; distractors = 3 random `back` values from other deck cards
- Generated client-side at session start (all cards already loaded)
- Clicking correct option: auto-advances as "known"
- Clicking wrong option: highlights correct answer, auto-advances as "unknown"
- Fallback: if deck has < 4 cards, affected cards use flip mode instead

### Random
- At session start, each card is assigned a random mode from [flip, type, multiple-choice]
- Stored in a per-session `cardModes` map — consistent within the session

## Architecture

All changes stay in `src/app/decks/[id]/page.tsx`. No new API routes, no new component files — ShadCN `Dialog` is already available.

### New state

```typescript
type AnswerMode = "flip" | "type" | "multiple-choice" | "random";

const [showModeModal, setShowModeModal] = useState(false);
const [answerMode, setAnswerMode] = useState<AnswerMode>("flip");
const [typedAnswer, setTypedAnswer] = useState("");
const [answerSubmitted, setAnswerSubmitted] = useState(false);
const [cardModes, setCardModes] = useState<Record<string, "flip" | "type" | "multiple-choice">>({});
const [mcOptions, setMcOptions] = useState<Record<string, string[]>>({});
```

### Session start flow

1. User clicks "Start session" → `setShowModeModal(true)`
2. User clicks a mode tile in the Dialog → `startStudy(selectedMode)`
3. `startStudy` generates `cardModes` and `mcOptions`, resets typed/submitted state, transitions to `"studying"`

### Multiple choice generation (client-side)

```typescript
function generateMcOptions(allCards: Card[], targetCard: Card): string[] {
  const distractors = allCards
    .filter(c => c.id !== targetCard.id)
    .map(c => c.back)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);
  return [...distractors, targetCard.back].sort(() => Math.random() - 0.5);
}
```

### Studying render changes

- **Flip mode**: existing JSX unchanged
- **Type mode**: front + textarea + submit; after submit, show correct answer alongside input + assessment buttons
- **Multiple choice mode**: front + 4 option buttons; after selection, color correct/incorrect, auto-advance

### Keyboard shortcuts

- Flip mode: Space/Enter to flip, ← / → to assess (unchanged)
- Type mode: Enter submits; after reveal, ← / → to assess
- Multiple choice: 1/2/3/4 keys to select option

## Error Handling

- If deck has fewer than 4 cards, fall back to flip mode for cards that lack enough distractors
- 1-card deck: multiple choice not offered in mode selector (or auto-downgraded to flip)

## Testing Plan

Manual verification through full sessions for each mode, confirming session save (score/results) records correctly in all modes.
