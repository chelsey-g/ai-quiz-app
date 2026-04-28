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
import { useWrongAnswerExplanations } from "@/hooks/use-wrong-answer-explanations";

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

  const { explanations, explanationsLoading } = useWrongAnswerExplanations(
    phase === "results" ? answers : []
  );

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
                    <div className="mt-1.5 space-y-2">
                      <p className="text-destructive/80">Your answer: {answer.userAnswer}</p>
                      <p className="text-green-600 dark:text-green-400">
                        Correct: {answer.card.back}
                      </p>
                      <div className="mt-2 rounded-lg bg-muted/40 px-3 py-2">
                        <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground/60">
                          Why
                        </p>
                        {explanations[answer.cardId] ? (
                          <p className="text-xs leading-relaxed text-muted-foreground">
                            {explanations[answer.cardId]}
                            {explanationsLoading && !explanations[answer.cardId]?.endsWith(" ") && (
                              <span className="ml-0.5 inline-block h-3 w-0.5 animate-pulse bg-muted-foreground/40 align-middle" />
                            )}
                          </p>
                        ) : explanationsLoading ? (
                          <div className="space-y-1.5">
                            <div className="h-2.5 w-full animate-pulse rounded bg-muted-foreground/20" />
                            <div className="h-2.5 w-4/5 animate-pulse rounded bg-muted-foreground/20" />
                          </div>
                        ) : null}
                      </div>
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
