---
assigned-to: ui-designer
status: complete
context: "New page at /quiz/quick. Fetches all user cards client-side via /api/decks (already returns deck list with card counts). Needs a second fetch to gather actual card rows — uses /api/decks/[id] per deck or a new /api/cards/weak endpoint (see decision below). No session row written; only card stats updated via a new POST /api/cards/stats endpoint. The existing /api/sessions route requires deck_id and always inserts a session row, so we need a separate lightweight endpoint."
---

# Quick Quiz Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a cross-deck "Quick Quiz" at `/quiz/quick` that pulls the user's weakest cards from all decks, runs them through the same MC/type quiz UI, and updates per-card stats on completion — without creating a session row (no `deck_id` to attach it to).

**Decisions made:**
- **Route:** `/quiz/quick` — static segment, no param needed
- **Card loading:** New `GET /api/cards/weak` endpoint — returns up to 20 of the user's weakest cards across all decks. Avoids N fan-out fetches to `/api/decks/[id]`. Weak = lowest `times_correct / times_seen` ratio among seen cards, with unseen cards appended.
- **Session tracking:** Option B — skip the session row entirely. Call a new `POST /api/cards/stats` endpoint that only runs the card stat updates (times_seen, times_correct, SM-2 fields). The existing `saveSession` in `src/lib/services/sessions.ts` does both; we extract the card-update logic into a shared helper.
- **Quiz UI:** Reuse the exact same MC/type/random/results patterns from `/quiz/[deckId]/page.tsx`. No new abstractions — copy the relevant logic into the new page component to keep it self-contained.
- **Entry point:** Add a "Quick Quiz" button/link to the dashboard (`src/app/page.tsx`) in the header area.
- **Card limit:** 20 cards per Quick Quiz session (configurable constant in the page).
- **MC fallback:** If the user has fewer than 4 cards total, disable MC mode (same rule as deck quiz).

---

## File Map

| File | Change |
|---|---|
| `src/app/api/cards/weak/route.ts` | Create — GET weak cards across all user decks |
| `src/app/api/cards/stats/route.ts` | Create — POST card stat updates without session row |
| `src/lib/services/card-stats.ts` | Create — shared card stat update logic (extracted from saveSession) |
| `src/lib/services/sessions.ts` | Modify — refactor card update loop to call shared helper |
| `src/app/quiz/quick/page.tsx` | Create — Quick Quiz client component |
| `src/app/page.tsx` | Modify — add "Quick Quiz" button to dashboard header |

---

### Task 1: Extract card stat update logic into a shared service

**Why first:** Both the existing sessions flow and the new Quick Quiz need to update card stats. Extract it now so both callers share one implementation.

**Files:**
- Create: `src/lib/services/card-stats.ts`
- Modify: `src/lib/services/sessions.ts`

- [ ] **Step 1: Create `src/lib/services/card-stats.ts`**

```ts
import { createClient as createServiceClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { sm2, qualityFromCorrect } from "@/lib/sm2";

type DB = Database;

function serviceClient() {
  return createServiceClient<DB>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export type CardResult = { cardId: string; correct: boolean };

/**
 * Updates times_seen, times_correct, and SM-2 scheduling fields for each card.
 * Uses the service-role key to bypass RLS.
 * Called by both saveSession (deck quiz) and updateCardStats (quick quiz).
 */
export async function updateCardStats(results: CardResult[]): Promise<void> {
  if (results.length === 0) return;
  const db = serviceClient();
  const cardIds = results.map((r) => r.cardId);
  const now = new Date().toISOString();

  const { data: existingCards, error: fetchError } = await db
    .from("cards")
    .select("id, times_seen, times_correct, repetitions, ease_factor, interval_days")
    .in("id", cardIds);

  if (fetchError || !existingCards) return;

  const cardMap = new Map(existingCards.map((c) => [c.id, c]));
  await Promise.all(
    results.map(({ cardId, correct }) => {
      const card = cardMap.get(cardId);
      if (!card) return Promise.resolve();
      const scheduling = sm2(card, qualityFromCorrect(correct));
      return db
        .from("cards")
        .update({
          times_seen: card.times_seen + 1,
          times_correct: card.times_correct + (correct ? 1 : 0),
          last_seen_at: now,
          repetitions: scheduling.repetitions,
          ease_factor: scheduling.ease_factor,
          interval_days: scheduling.interval_days,
          next_review_at: scheduling.next_review_at,
        })
        .eq("id", cardId);
    })
  );
}
```

- [ ] **Step 2: Refactor `src/lib/services/sessions.ts` to use the shared helper**

Replace the inline card-update loop in `saveSession` with a call to `updateCardStats`. The function body after the session insert becomes:

```ts
import { updateCardStats } from "@/lib/services/card-stats";

// ... (replace the existing card-update block starting at `if (results.length > 0) {`)
if (results.length > 0) {
  await updateCardStats(results);
}
```

Remove the now-redundant inline `serviceClient`, `sm2`, `qualityFromCorrect`, and card-update logic from `sessions.ts` — `updateCardStats` owns all of that. Keep the `serviceClient` in `card-stats.ts`. The `sessions.ts` service-role client only needed for the session insert can remain or also delegate to a shared helper — keep it simple, leave the session insert inline.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/services/card-stats.ts src/lib/services/sessions.ts
git commit -m "refactor(sessions): extract card stat updates into shared card-stats service"
```

---

### Task 2: Create GET /api/cards/weak endpoint

**Files:**
- Create: `src/app/api/cards/weak/route.ts`

- [ ] **Step 1: Create the route**

```ts
import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";
import type { Database } from "@/lib/database.types";

type Card = Database["public"]["Tables"]["cards"]["Row"];

const WEAK_CARD_LIMIT = 20;

/**
 * GET /api/cards/weak
 * Returns up to WEAK_CARD_LIMIT of the authenticated user's weakest cards
 * across all decks. Weak = lowest times_correct/times_seen ratio (seen cards
 * first, sorted ascending), then unseen cards appended.
 *
 * Query params:
 *   limit — override card count (default 20, max 50)
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const rawLimit = parseInt(url.searchParams.get("limit") ?? "20", 10);
  const limit = Math.min(Math.max(1, rawLimit), 50);

  // Fetch all user's cards in one query (join through decks to scope by user_id)
  const { data: cards, error } = await supabase
    .from("cards")
    .select("*, decks!inner(user_id)")
    .eq("decks.user_id", user.id);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const allCards = (cards ?? []) as Card[];

  // Split seen vs unseen
  const seen = allCards.filter((c) => c.times_seen > 0);
  const unseen = allCards.filter((c) => c.times_seen === 0);

  // Sort seen cards by accuracy ratio ascending (weakest first)
  seen.sort((a, b) => {
    const ratioA = a.times_correct / a.times_seen;
    const ratioB = b.times_correct / b.times_seen;
    return ratioA - ratioB;
  });

  const weak = [...seen, ...unseen].slice(0, limit);

  return Response.json({ cards: weak, total: allCards.length });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/cards/weak/route.ts
git commit -m "feat(quick-quiz): add GET /api/cards/weak endpoint"
```

---

### Task 3: Create POST /api/cards/stats endpoint

**Files:**
- Create: `src/app/api/cards/stats/route.ts`

- [ ] **Step 1: Create the route**

```ts
import { createClient } from "@/lib/supabase/server";
import { updateCardStats } from "@/lib/services/card-stats";
import { NextRequest } from "next/server";

/**
 * POST /api/cards/stats
 * Updates card stat fields (times_seen, times_correct, SM-2 scheduling)
 * without creating a session row. Used by Quick Quiz which spans multiple
 * decks and has no single deck_id to attach to a session.
 *
 * Body: { results: { cardId: string; correct: boolean }[] }
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as {
    results: { cardId: string; correct: boolean }[];
  };

  if (!body.results || !Array.isArray(body.results)) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    await updateCardStats(body.results);
    return Response.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/cards/stats/route.ts
git commit -m "feat(quick-quiz): add POST /api/cards/stats endpoint"
```

---

### Task 4: Create the Quick Quiz page

**Files:**
- Create: `src/app/quiz/quick/page.tsx`

This is the main deliverable. The component mirrors `src/app/quiz/[deckId]/page.tsx` with these differences:
- Fetches from `/api/cards/weak` instead of `/api/decks/[id]`
- No deck context (no deck title, no "Back to deck" link — "Back to decks" goes to `/`)
- On quiz completion, POSTs to `/api/cards/stats` instead of `/api/sessions`
- `allCards` equals `quizCards` (no separate pool for MC distractor generation — if total < 4, MC is disabled)
- The mode modal does not have a "flip" option (Quick Quiz is objective-graded only: MC or type)

- [x] **Step 1: Create `src/app/quiz/quick/page.tsx`**

```tsx
"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Database } from "@/lib/database.types";

type Card = Database["public"]["Tables"]["cards"]["Row"];

type QuizMode = "multiple-choice" | "type" | "random";
type ResolvedMode = "multiple-choice" | "type";
type QuizPhase = "mode-select" | "quiz" | "results";

type AnswerRecord = {
  cardId: string;
  correct: boolean;
  userAnswer: string;
  card: Card;
};

function generateMcOptions(allCards: Card[], targetCard: Card): string[] {
  const distractors = allCards
    .filter((c) => c.id !== targetCard.id)
    .map((c) => c.back)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);
  return [...distractors, targetCard.back].sort(() => Math.random() - 0.5);
}

function gradeTypeAnswer(userAnswer: string, correct: string): boolean {
  const norm = (s: string) => s.trim().toLowerCase();
  return (
    norm(userAnswer) === norm(correct) ||
    norm(correct).includes(norm(userAnswer)) ||
    norm(userAnswer).includes(norm(correct))
  );
}

export default function QuickQuizPage() {
  const router = useRouter();

  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [phase, setPhase] = useState<QuizPhase>("mode-select");
  const [quizMode, setQuizMode] = useState<QuizMode>("multiple-choice");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Per-question state
  const [typedAnswer, setTypedAnswer] = useState("");
  const [answerSubmitted, setAnswerSubmitted] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [cardModes, setCardModes] = useState<Record<string, ResolvedMode>>({});
  const [mcOptions, setMcOptions] = useState<Record<string, string[]>>({});

  useEffect(() => {
    fetch("/api/cards/weak")
      .then((r) => r.json())
      .then((data: { cards: Card[]; total: number }) => {
        setCards(data.cards ?? []);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load cards");
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  async function saveStats(answersSnapshot: AnswerRecord[], startedAtSnapshot: string) {
    void startedAtSnapshot; // not sent to /api/cards/stats but kept for potential future use
    await fetch("/api/cards/stats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        results: answersSnapshot.map((a) => ({ cardId: a.cardId, correct: a.correct })),
      }),
    });
  }

  function formatElapsed(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  function startQuiz(mode: QuizMode) {
    const resolvedModes: Record<string, ResolvedMode> = {};
    const resolvedMcOptions: Record<string, string[]> = {};
    const fixedModes: ResolvedMode[] = ["multiple-choice", "type"];

    cards.forEach((card) => {
      const cardMode: ResolvedMode =
        mode === "random"
          ? fixedModes[Math.floor(Math.random() * fixedModes.length)]
          : mode;
      resolvedModes[card.id] = cardMode;
      if (cardMode === "multiple-choice") {
        resolvedMcOptions[card.id] = generateMcOptions(cards, card);
      }
    });

    setCardModes(resolvedModes);
    setMcOptions(resolvedMcOptions);
    setQuizMode(mode);
    setCurrentIndex(0);
    setAnswers([]);
    setTypedAnswer("");
    setAnswerSubmitted(false);
    setSelectedOption(null);
    setStartedAt(new Date().toISOString());
    setElapsed(0);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    setPhase("quiz");
  }

  function recordAnswer(
    card: Card,
    correct: boolean,
    userAnswer: string,
    currentAnswers: AnswerRecord[],
    currentStartedAt: string | null,
  ) {
    const newAnswers = [...currentAnswers, { cardId: card.id, correct, userAnswer, card }];
    setAnswers(newAnswers);
    const isLast = currentIndex + 1 >= cards.length;
    setTimeout(() => {
      if (isLast) {
        if (timerRef.current) clearInterval(timerRef.current);
        if (currentStartedAt) {
          saveStats(newAnswers, currentStartedAt);
        }
        setPhase("results");
      } else {
        setCurrentIndex((i) => i + 1);
        setTypedAnswer("");
        setAnswerSubmitted(false);
        setSelectedOption(null);
      }
    }, correct ? 700 : 1500);
  }

  function retryMissed() {
    const missedCards = answers.filter((a) => !a.correct).map((a) => a.card);
    if (missedCards.length === 0) return;
    const resolvedModes: Record<string, ResolvedMode> = {};
    const resolvedMcOptions: Record<string, string[]> = {};
    const fixedModes: ResolvedMode[] = ["multiple-choice", "type"];

    missedCards.forEach((card) => {
      const cardMode: ResolvedMode =
        quizMode === "random"
          ? fixedModes[Math.floor(Math.random() * fixedModes.length)]
          : quizMode === "multiple-choice"
          ? "multiple-choice"
          : "type";
      resolvedModes[card.id] = cardMode;
      if (cardMode === "multiple-choice") {
        resolvedMcOptions[card.id] = generateMcOptions(cards, card);
      }
    });

    setCards(missedCards);
    setCardModes(resolvedModes);
    setMcOptions(resolvedMcOptions);
    setCurrentIndex(0);
    setAnswers([]);
    setTypedAnswer("");
    setAnswerSubmitted(false);
    setSelectedOption(null);
    setStartedAt(new Date().toISOString());
    setElapsed(0);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    setPhase("quiz");
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-10 text-center">
        <p className="text-sm text-muted-foreground">
          No cards yet. Import a deck first.
        </p>
        <Button className="mt-4" onClick={() => router.push("/")}>
          Back to decks
        </Button>
      </div>
    );
  }

  const canMultipleChoice = cards.length >= 4;
  const currentCard = cards[currentIndex];
  const currentCardMode: ResolvedMode = currentCard
    ? (cardModes[currentCard.id] ?? "type")
    : "type";
  const progress = answers.length / cards.length;
  const correctCount = answers.filter((a) => a.correct).length;
  const scorePercent =
    answers.length > 0 ? Math.round((correctCount / answers.length) * 100) : 0;

  // ── Mode selection modal ──────────────────────────────────────────────────

  const modeModal = (
    <Dialog open={phase === "mode-select"} onOpenChange={() => router.push("/")}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-heading text-base font-semibold">
            Quick Quiz
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground/70">
          {cards.length} card{cards.length !== 1 ? "s" : ""} — your weakest across all decks.
        </p>
        <div className="mt-2 grid grid-cols-2 gap-3">
          {(
            [
              {
                mode: "multiple-choice" as QuizMode,
                label: "Multiple choice",
                description: "Pick from 4 options",
                disabled: !canMultipleChoice,
              },
              {
                mode: "type" as QuizMode,
                label: "Type answer",
                description: "Write it out",
              },
              {
                mode: "random" as QuizMode,
                label: "Random",
                description: "Mix it up",
                disabled: !canMultipleChoice,
              },
            ] as Array<{ mode: QuizMode; label: string; description: string; disabled?: boolean }>
          ).map(({ mode, label, description, disabled }) => (
            <button
              key={mode}
              disabled={disabled}
              onClick={() => !disabled && startQuiz(mode)}
              className={`rounded-xl border p-4 text-left transition-colors ${
                disabled
                  ? "cursor-not-allowed border-border/40 opacity-40"
                  : "border-border hover:border-primary/50 hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/40"
              }`}
            >
              <p className="font-heading text-sm font-semibold text-foreground">{label}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{description}</p>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );

  // ── Active quiz phase ─────────────────────────────────────────────────────

  const quizPhase = phase === "quiz" && currentCard && (
    <div className="flex min-h-screen flex-col">
      {/* Top bar */}
      <div className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-12 max-w-2xl items-center justify-between px-6">
          <span className="text-xs text-muted-foreground">
            {answers.length + 1} / {cards.length}
          </span>
          <div className="flex items-center gap-3">
            <div className="h-1.5 w-32 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
            <span className="font-mono text-xs text-muted-foreground tabular-nums">
              {formatElapsed(elapsed)}
            </span>
          </div>
        </div>
      </div>

      {/* Question */}
      <div className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
        {currentCardMode === "multiple-choice" && (
          <>
            <div className="rounded-2xl border border-border bg-card px-8 py-8 text-center">
              <p className="mb-4 text-[10px] font-medium uppercase tracking-[0.15em] text-primary/70">
                Question
              </p>
              <p className="text-lg font-medium leading-relaxed text-foreground">
                {currentCard.front}
              </p>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-2">
              {(mcOptions[currentCard.id] ?? []).map((option, idx) => {
                const isCorrect = option === currentCard.back;
                const isSelected = selectedOption === option;
                const revealed = selectedOption !== null;
                let cls =
                  "w-full rounded-xl border px-4 py-3 text-left text-sm transition-colors focus:outline-none";
                if (!revealed) {
                  cls += " border-border text-foreground hover:border-primary/50 hover:bg-muted/50";
                } else if (isCorrect) {
                  cls += " border-green-500/50 bg-green-500/10 text-green-700 dark:text-green-400";
                } else if (isSelected) {
                  cls += " border-destructive/50 bg-destructive/10 text-destructive";
                } else {
                  cls += " border-border/40 text-muted-foreground opacity-50";
                }
                return (
                  <button
                    key={idx}
                    disabled={revealed}
                    className={cls}
                    onClick={() => {
                      if (revealed) return;
                      setSelectedOption(option);
                      recordAnswer(currentCard, isCorrect, option, answers, startedAt);
                    }}
                  >
                    <span className="mr-2 text-[10px] font-semibold text-muted-foreground/60">
                      {idx + 1}.
                    </span>
                    {option}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {currentCardMode === "type" && (
          <div className="rounded-2xl border border-border bg-card px-8 py-8">
            <p className="mb-4 text-center text-[10px] font-medium uppercase tracking-[0.15em] text-primary/70">
              Question
            </p>
            <p className="text-center text-lg font-medium leading-relaxed text-foreground">
              {currentCard.front}
            </p>
            {!answerSubmitted ? (
              <div className="mt-6">
                <textarea
                  autoFocus
                  value={typedAnswer}
                  onChange={(e) => setTypedAnswer(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && typedAnswer.trim()) {
                      e.preventDefault();
                      setAnswerSubmitted(true);
                      const correct = gradeTypeAnswer(typedAnswer, currentCard.back);
                      recordAnswer(currentCard, correct, typedAnswer, answers, startedAt);
                    }
                  }}
                  placeholder="Type your answer…"
                  rows={3}
                  className="w-full resize-none rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
                <Button
                  className="mt-3 w-full"
                  disabled={!typedAnswer.trim()}
                  onClick={() => {
                    setAnswerSubmitted(true);
                    const correct = gradeTypeAnswer(typedAnswer, currentCard.back);
                    recordAnswer(currentCard, correct, typedAnswer, answers, startedAt);
                  }}
                >
                  Submit
                </Button>
              </div>
            ) : (
              <div className="mt-6 space-y-3">
                <div className="rounded-xl bg-muted/40 px-4 py-3">
                  <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                    Your answer
                  </p>
                  <p className="mt-1 text-sm text-foreground">{typedAnswer}</p>
                </div>
                <div className="rounded-xl border border-primary/20 bg-card px-4 py-3">
                  <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-primary/70">
                    Correct answer
                  </p>
                  <p className="mt-1 text-sm text-foreground">{currentCard.back}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  // ── Results phase ─────────────────────────────────────────────────────────

  const resultsPhase = phase === "results" && (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <div className="mb-8 text-center">
        <p className="font-heading text-6xl font-bold text-primary">{scorePercent}%</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {correctCount}/{answers.length} correct · {formatElapsed(elapsed)}
        </p>
      </div>

      <div className="mb-8 flex gap-3">
        {answers.some((a) => !a.correct) && (
          <Button className="flex-1" onClick={retryMissed}>
            Retry missed
          </Button>
        )}
        <Button variant="outline" className="flex-1" onClick={() => router.push("/")}>
          Back to decks
        </Button>
      </div>

      <div>
        <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground/60">
          Review
        </p>
        <div className="flex flex-col gap-2">
          {answers.map((answer, idx) => (
            <div
              key={idx}
              className={`rounded-xl border px-4 py-3 text-sm ${
                answer.correct
                  ? "border-green-500/30 bg-green-500/5"
                  : "border-destructive/30 bg-destructive/5"
              }`}
            >
              <div className="flex items-start gap-2">
                <span className={answer.correct ? "text-green-500" : "text-destructive"}>
                  {answer.correct ? "✓" : "✗"}
                </span>
                <div className="flex-1">
                  <p className="font-medium text-foreground">{answer.card.front}</p>
                  {!answer.correct && (
                    <div className="mt-1.5 space-y-1">
                      <p className="text-destructive/80">Your answer: {answer.userAnswer}</p>
                      <p className="text-green-600 dark:text-green-400">
                        Correct: {answer.card.back}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div>
      {modeModal}
      {quizPhase}
      {resultsPhase}
    </div>
  );
}
```

- [x] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [x] **Step 3: Commit**

```bash
git add "src/app/quiz/quick/page.tsx"
git commit -m "feat(quick-quiz): implement /quiz/quick page"
```

---

### Task 5: Add Quick Quiz entry point to the dashboard

**Files:**
- Modify: `src/app/page.tsx`

- [x] **Step 1: Read the current dashboard header**

Open `src/app/page.tsx` and find the top-level heading / action row.

- [x] **Step 2: Add a "Quick Quiz" link**

Add a link to `/quiz/quick` near the dashboard heading. It should be visually secondary to any primary CTA. Use the same muted link style as the "Take a quiz" link on the deck page:

```tsx
import Link from "next/link";

// Inside the header/action area, alongside existing buttons:
<Link
  href="/quiz/quick"
  className="inline-flex items-center justify-center rounded-md border border-border bg-transparent px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
>
  Quick Quiz
</Link>
```

Exact placement: read `src/app/page.tsx` first and insert adjacent to whatever action buttons already exist in the header row.

- [x] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [x] **Step 4: Manual smoke test**

Start dev server: `npm run dev`

1. Open `http://localhost:3001` — confirm "Quick Quiz" button visible in dashboard header
2. Click "Quick Quiz" — confirm mode modal opens at `/quiz/quick` with card count shown
3. Select "Type answer" — confirm quiz starts with top bar showing `1 / N` and timer ticking
4. Answer all questions — confirm results screen appears with score, time, and answer review
5. Check network tab: confirm `POST /api/cards/stats` fired (NOT `/api/sessions`) when results appeared
6. Confirm NO session row appears in Supabase `sessions` table
7. Confirm card `times_seen` / `times_correct` updated in Supabase `cards` table
8. If 4+ cards exist: select "Multiple choice" mode, confirm options render correctly

- [x] **Step 5: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(quick-quiz): add Quick Quiz entry point to dashboard"
```
