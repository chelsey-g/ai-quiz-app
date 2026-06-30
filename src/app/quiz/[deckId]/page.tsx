"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CardText } from "@/components/card-text";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Database } from "@/lib/database.types";
import { useWrongAnswerExplanations } from "@/hooks/use-wrong-answer-explanations";
import {
  savePausedDeckQuiz,
  loadPausedDeckQuiz,
  clearPausedDeckQuiz,
  formatPausedTime,
  type PausedDeckQuiz,
} from "@/lib/utils/paused-quiz";

type Deck = Database["public"]["Tables"]["decks"]["Row"];
type Card = Database["public"]["Tables"]["cards"]["Row"];

type QuizMode = "multiple-choice" | "type" | "random";
type ResolvedMode = "multiple-choice" | "type";
type QuizPhase = "mode-select" | "quiz" | "results";
type CardLimit = 5 | 10 | 20 | "all";

type AnswerRecord = {
  cardId: string;
  correct: boolean;
  userAnswer: string;
  card: Card;
};

function selectWeakCards(cards: Card[], limit: CardLimit = 10): Card[] {
  if (cards.length === 0) return [];
  const unseen = cards.filter((c) => c.times_seen === 0);
  const seen = cards
    .filter((c) => c.times_seen > 0)
    .sort((a, b) => a.times_correct / a.times_seen - b.times_correct / b.times_seen);
  const ordered = [...seen, ...unseen];
  return limit === "all" ? ordered : ordered.slice(0, limit);
}

function shuffleAnswers(correct: string, distractors: string[]): string[] {
  const ck = correct.trim().toLowerCase().replace(/\s+/g, " ");
  const seen = new Set([ck]);
  const deduped: string[] = [];
  for (const d of distractors) {
    const t = d.trim();
    if (!t) continue;
    const k = t.toLowerCase().replace(/\s+/g, " ");
    if (seen.has(k)) continue;
    seen.add(k);
    deduped.push(t);
    if (deduped.length >= 3) break;
  }
  return [...deduped, correct.trim()].sort(() => Math.random() - 0.5);
}

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

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function gradeTypeAnswer(userAnswer: string, correct: string): boolean {
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  const a = norm(userAnswer);
  const b = norm(correct);
  if (a === b) return true;
  const maxLen = Math.max(a.length, b.length);
  return maxLen > 0 && levenshtein(a, b) / maxLen <= 0.2;
}

export default function QuizPage() {
  const { deckId: id } = useParams<{ deckId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedIds = searchParams.get("cards")?.split(",").filter(Boolean) ?? [];

  const [deck, setDeck] = useState<Deck | null>(null);
  const [allCards, setAllCards] = useState<Card[]>([]);
  const [quizCards, setQuizCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [cardLimit, setCardLimit] = useState<CardLimit>(10);
  const [shuffle, setShuffle] = useState(false);
  const [phase, setPhase] = useState<QuizPhase>("mode-select");
  const [quizMode, setQuizMode] = useState<QuizMode>("multiple-choice");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const modePickedRef = useRef(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  // Per-question state
  const [typedAnswer, setTypedAnswer] = useState("");
  const [answerSubmitted, setAnswerSubmitted] = useState(false);
  const [aiGrading, setAiGrading] = useState(false);
  const [gradeResult, setGradeResult] = useState<boolean | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [cardModes, setCardModes] = useState<Record<string, ResolvedMode>>({});
  const [mcOptions, setMcOptions] = useState<Record<string, string[]>>({});
  const [flaggedIds, setFlaggedIds] = useState<Set<string>>(new Set());
  const [pausedQuiz, setPausedQuiz] = useState<PausedDeckQuiz | null>(null);

  const { explanations, explanationsLoading } = useWrongAnswerExplanations(
    phase === "results" ? answers : []
  );

  useEffect(() => {
    const paused = loadPausedDeckQuiz(id);
    if (paused) setPausedQuiz(paused);
  }, [id]);

  useEffect(() => {
    fetch(`/api/decks/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setDeck(data.deck);
        setAllCards(data.cards);
        if (preselectedIds.length > 0) {
          const order = new Map(preselectedIds.map((cid, i) => [cid, i]));
          const pinned = (data.cards as Card[])
            .filter((c) => order.has(c.id))
            .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
          setQuizCards(pinned);
          setCardLimit("all");
        } else {
          setQuizCards(selectWeakCards(data.cards, 10));
        }
        setFlaggedIds(new Set(data.cards.filter((c: Card) => c.flagged).map((c: Card) => c.id)));
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load deck");
        setLoading(false);
      });
  }, [id]);

  useEffect(() => {
    if (allCards.length > 0 && preselectedIds.length === 0) {
      setQuizCards(selectWeakCards(allCards, cardLimit));
    }
  }, [allCards, cardLimit]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    };
  }, []);

  // ── Session save ──────────────────────────────────────────────────────────

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

    const wrongCardIds = answersSnapshot.filter((a) => !a.correct).map((a) => a.cardId);
    if (wrongCardIds.length > 0) {
      fetch(`/api/decks/${id}/sync-missed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardIds: wrongCardIds }),
      }).catch(() => {});
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  function formatElapsed(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  function startQuiz(mode: QuizMode) {
    modePickedRef.current = true;
    const resolvedModes: Record<string, ResolvedMode> = {};
    const resolvedMcOptions: Record<string, string[]> = {};
    const fixedModes: ResolvedMode[] = ["multiple-choice", "type"];

    const orderedCards = shuffle ? [...quizCards].sort(() => Math.random() - 0.5) : quizCards;
    setQuizCards(orderedCards);

    orderedCards.forEach((card) => {
      const cardMode: ResolvedMode =
        mode === "random"
          ? fixedModes[Math.floor(Math.random() * fixedModes.length)]
          : mode;
      resolvedModes[card.id] = cardMode;
      if (cardMode === "multiple-choice") {
        resolvedMcOptions[card.id] = generateMcOptions(allCards, card);
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
  ): AnswerRecord[] {
    const newAnswers = [...currentAnswers, { cardId: card.id, correct, userAnswer, card }];
    setAnswers(newAnswers);
    return newAnswers;
  }

  function saveTypedAnswer(cardId: string, answer: string, correct: boolean) {
    fetch(`/api/cards/${cardId}/typed-answer`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answer, correct }),
    }).catch(() => {});
  }

  async function handleTypeSubmit() {
    if (answerSubmitted || !typedAnswer.trim() || !currentCard) return;
    setAnswerSubmitted(true);

    const heuristic = gradeTypeAnswer(typedAnswer, currentCard.back);
    if (heuristic) {
      setGradeResult(true);
      recordAnswer(currentCard, true, typedAnswer, answers);
      saveTypedAnswer(currentCard.id, typedAnswer, true);
      return;
    }

    setAiGrading(true);
    try {
      const res = await fetch("/api/quiz/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: currentCard.front,
          userAnswer: typedAnswer,
          correctAnswer: currentCard.back,
        }),
      });
      if (!res.ok) throw new Error(`Grade API error: ${res.status}`);
      const data = await res.json();
      const correct = data.correct === true;
      setGradeResult(correct);
      recordAnswer(currentCard, correct, typedAnswer, answers);
      saveTypedAnswer(currentCard.id, typedAnswer, correct);
    } catch {
      setGradeResult(false);
      recordAnswer(currentCard, false, typedAnswer, answers);
      saveTypedAnswer(currentCard.id, typedAnswer, false);
    } finally {
      setAiGrading(false);
    }
  }

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

  function goBack() {
    if (advanceTimerRef.current) { clearTimeout(advanceTimerRef.current); advanceTimerRef.current = null; }
    if (answers.length === 0 && currentIndex === 0) return;
    const prevIndex = currentIndex > 0 ? currentIndex - 1 : 0;
    const prevAnswer = answers[answers.length - 1];
    const newAnswers = answers.slice(0, -1);
    setAnswers(newAnswers);
    setCurrentIndex(prevIndex);
    setTypedAnswer(prevAnswer?.userAnswer ?? "");
    setAnswerSubmitted(false);
    setAiGrading(false);
    setGradeResult(null);
    setSelectedOption(null);
    if (phase === "results") setPhase("quiz");
  }

  function exitQuiz() {
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    setShowExitConfirm(false);
    router.push(`/decks/${id}`);
  }

  function pauseQuiz() {
    if (!deck) return;
    savePausedDeckQuiz({
      type: "deck",
      deckId: id,
      deckTitle: deck.title,
      quizCards: quizCards as unknown[],
      allCards: allCards as unknown[],
      answers: answers as unknown[],
      cardModes,
      currentIndex,
      quizMode,
      cardLimit,
      startedAt,
      pausedAt: new Date().toISOString(),
    });
    if (timerRef.current) clearInterval(timerRef.current);
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    router.push(`/decks/${id}`);
  }

  function resumeQuiz() {
    if (!pausedQuiz) return;
    const cards = pausedQuiz.quizCards as Card[];
    const resolvedMcOptions: Record<string, string[]> = {};
    cards.forEach((card) => {
      if (pausedQuiz.cardModes[card.id] === "multiple-choice") {
        resolvedMcOptions[card.id] = generateMcOptions(pausedQuiz.allCards as Card[], card);
      }
    });
    setQuizCards(cards);
    setAllCards(pausedQuiz.allCards as Card[]);
    setAnswers(pausedQuiz.answers as AnswerRecord[]);
    setCurrentIndex(pausedQuiz.currentIndex);
    setQuizMode(pausedQuiz.quizMode as QuizMode);
    setCardModes(pausedQuiz.cardModes as Record<string, ResolvedMode>);
    setMcOptions(resolvedMcOptions);
    setCardLimit(pausedQuiz.cardLimit as CardLimit);
    setStartedAt(pausedQuiz.startedAt);
    setTypedAnswer("");
    setAnswerSubmitted(false);
    setSelectedOption(null);
    setGradeResult(null);
    setElapsed(0);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    modePickedRef.current = true;
    clearPausedDeckQuiz(id);
    setPausedQuiz(null);
    setPhase("quiz");
  }

  async function toggleFlag(cardId: string) {
    const next = !flaggedIds.has(cardId);
    setFlaggedIds((prev) => { const s = new Set(prev); next ? s.add(cardId) : s.delete(cardId); return s; });
    await fetch(`/api/cards/${cardId}/flag`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ flagged: next }),
    });
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
        resolvedMcOptions[card.id] = generateMcOptions(allCards, card);
      }
    });

    setQuizCards(missedCards);
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

  // ── Loading / error states ────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col">
        {/* Top bar skeleton */}
        <div className="border-b border-border bg-background/80">
          <div className="mx-auto flex h-12 max-w-2xl items-center justify-between px-4 sm:px-6">
            <div className="h-3 w-16 animate-pulse rounded bg-muted/40" />
            <div className="flex items-center gap-3">
              <div className="h-1.5 w-32 animate-pulse rounded-full bg-muted/40" />
              <div className="h-3 w-10 animate-pulse rounded bg-muted/40" />
            </div>
          </div>
        </div>
        {/* Question card skeleton */}
        <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
          <div className="rounded-2xl border border-border/40 bg-card/60 px-8 py-8 animate-pulse">
            <div className="mx-auto mb-5 h-2.5 w-20 rounded bg-muted/40" />
            <div className="mx-auto h-5 w-3/4 rounded bg-muted/40" />
            <div className="mx-auto mt-2 h-5 w-1/2 rounded bg-muted/40" />
          </div>
          <div className="mt-4 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-12 animate-pulse rounded-xl border border-border/40 bg-card/60"
                style={{ animationDelay: `${i * 60}ms` }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !deck) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-destructive">{error ?? "Deck not found"}</p>
      </div>
    );
  }

  // ── Derived state ─────────────────────────────────────────────────────────

  const canMultipleChoice = allCards.length >= 2;
  const currentCard = quizCards[currentIndex];
  const currentCardMode: ResolvedMode = currentCard
    ? (cardModes[currentCard.id] ?? "type")
    : "type";
  const progress = quizCards.length > 0 ? Math.min(1, currentIndex / quizCards.length) : 0;
  const correctCount = answers.filter((a) => a.correct).length;
  const scorePercent =
    answers.length > 0 ? Math.round((correctCount / answers.length) * 100) : 0;

  // ── Mode selection modal ──────────────────────────────────────────────────

  const modeModal = (
    <Dialog open={phase === "mode-select"} onOpenChange={() => { if (!modePickedRef.current) router.push(`/decks/${id}`); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-heading text-base font-semibold">
            How do you want to answer?
          </DialogTitle>
        </DialogHeader>
        {preselectedIds.length === 0 && (
          <div className="flex flex-wrap gap-2">
            {([5, 10, 20, "all"] as CardLimit[])
              .filter((n) => n === "all" || (n as number) <= allCards.length)
              .map((n) => (
                <button
                  key={n}
                  onClick={() => setCardLimit(n)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    cardLimit === n
                      ? "border-primary/60 bg-primary/10 text-primary"
                      : "border-border/50 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  }`}
                >
                  {n === "all" ? `All ${allCards.length}` : n}
                </button>
              ))}
          </div>
        )}
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground/70">
            {preselectedIds.length > 0
              ? `Quizzing ${quizCards.length} hand-picked card${quizCards.length !== 1 ? "s" : ""}.`
              : `Quizzing ${quizCards.length} card${quizCards.length !== 1 ? "s" : ""} — ${shuffle ? "shuffled" : "weakest first"}.`}
          </p>
          <button
            onClick={() => setShuffle((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors"
            style={shuffle ? {
              background: "color-mix(in oklch, var(--dashboard-accent-teal) 12%, transparent)",
              border: "1px solid color-mix(in oklch, var(--dashboard-accent-teal) 50%, transparent)",
              color: "var(--dashboard-accent-teal-strong)",
            } : {
              border: "1px solid oklch(0.5 0.01 250 / 0.25)",
              color: "oklch(0.55 0.01 250 / 0.6)",
            }}
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 3h5m0 0v5m0-5l-6 6M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-1" />
            </svg>
            Shuffle
          </button>
        </div>
        {pausedQuiz && (
          <div className="rounded-xl border p-4" style={{ borderColor: "color-mix(in oklch, var(--dashboard-accent-teal) 40%, transparent)", background: "color-mix(in oklch, var(--dashboard-accent-teal) 8%, transparent)" }}>
            <p className="text-xs font-semibold text-foreground">Paused quiz — {formatPausedTime(pausedQuiz.pausedAt)}</p>
            <p className="mt-0.5 text-xs text-muted-foreground/70">
              Question {pausedQuiz.currentIndex + 1} of {(pausedQuiz.quizCards as unknown[]).length} · {pausedQuiz.quizMode}
            </p>
            <div className="mt-3 flex gap-2">
              <Button size="sm" className="flex-1" onClick={resumeQuiz}>Resume</Button>
              <Button size="sm" variant="outline" className="flex-1" onClick={() => { clearPausedDeckQuiz(id); setPausedQuiz(null); }}>
                Discard
              </Button>
            </div>
          </div>
        )}
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
      {/* Exit confirmation */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-xl">
            <h2 className="font-heading text-base font-semibold text-foreground">Exit quiz?</h2>
            <p className="mt-1.5 text-sm text-muted-foreground/70">
              You&apos;ve answered {answers.length} of {quizCards.length} questions. Progress won&apos;t be saved.
            </p>
            <div className="mt-5 flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowExitConfirm(false)}>
                Keep going
              </Button>
              <Button variant="outline" className="flex-1 border-destructive/40 text-destructive hover:bg-destructive/5" onClick={exitQuiz}>
                Exit
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Top bar */}
      <div className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-12 max-w-2xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => answers.length > 0 ? setShowExitConfirm(true) : exitQuiz()}
              className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors hover:bg-destructive/5"
              style={{ border: "1px solid oklch(0.55 0.2 27 / 0.5)", color: "oklch(0.55 0.2 27 / 0.9)" }}
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Exit
            </button>
            {(answers.length > 0 || currentIndex > 0) && (
              <button
                onClick={goBack}
                className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors"
                style={{
                  border:
                    "1px solid color-mix(in oklch, var(--dashboard-accent-teal) 45%, transparent)",
                  color: "var(--dashboard-accent-teal-strong)",
                  background:
                    "color-mix(in oklch, var(--dashboard-accent-teal) 0%, transparent)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background =
                    "color-mix(in oklch, var(--dashboard-accent-teal) 10%, transparent)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background =
                    "color-mix(in oklch, var(--dashboard-accent-teal) 0%, transparent)";
                }}
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                </svg>
                Undo
              </button>
            )}
            <button
              onClick={pauseQuiz}
              className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-muted-foreground/60 transition-colors hover:text-muted-foreground"
              style={{ border: "1px solid color-mix(in oklch, var(--border) 60%, transparent)" }}
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none" />
                <rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none" />
              </svg>
              Pause
            </button>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">{currentIndex + 1} / {quizCards.length}</span>
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
            <div className="relative rounded-2xl border border-border bg-card px-8 py-8 text-center">
              <button
                onClick={() => toggleFlag(currentCard.id)}
                className="absolute right-3 top-3 rounded-lg p-1.5 transition-colors hover:bg-primary/10"
                title={flaggedIds.has(currentCard.id) ? "Remove flag" : "Flag for review"}
                style={{ color: flaggedIds.has(currentCard.id) ? "oklch(0.72 0.18 30)" : "rgba(255,255,255,0.45)" }}
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill={flaggedIds.has(currentCard.id) ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                  <line x1="4" y1="22" x2="4" y2="15" />
                </svg>
              </button>
              <p className="mb-4 text-[10px] font-medium uppercase tracking-[0.15em] text-primary/70">
                Question
              </p>
              <CardText text={currentCard.front} className="text-lg font-medium leading-relaxed text-foreground" />
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
                  <div
                    key={idx}
                    role="button"
                    tabIndex={revealed ? -1 : 0}
                    aria-disabled={revealed}
                    className={cls + (revealed ? " cursor-default" : " cursor-pointer")}
                    onClick={() => {
                      if (revealed) return;
                      setSelectedOption(option);
                      recordAnswer(currentCard, isCorrect, option, answers);
                    }}
                    onKeyDown={(e) => {
                      if (revealed) return;
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedOption(option);
                        recordAnswer(currentCard, isCorrect, option, answers);
                      }
                    }}
                  >
                    <span className="mb-1 block text-[10px] font-semibold text-muted-foreground/60">
                      {idx + 1}.
                    </span>
                    <CardText text={option} className="text-sm" />
                  </div>
                );
              })}
            </div>
            {selectedOption && (
              <div className="mt-4">
                <Button className="w-full" onClick={() => advanceToNext(quizCards, answers, startedAt)}>
                  Continue →
                </Button>
              </div>
            )}
          </>
        )}

        {currentCardMode === "type" && (
          <div className="relative rounded-2xl border border-border bg-card px-8 py-8">
            <button
              onClick={() => toggleFlag(currentCard.id)}
              className="absolute right-3 top-3 rounded-lg p-1.5 transition-colors hover:bg-primary/10"
              title={flaggedIds.has(currentCard.id) ? "Remove flag" : "Flag for review"}
              style={{ color: flaggedIds.has(currentCard.id) ? "oklch(0.72 0.18 30)" : "rgba(255,255,255,0.45)" }}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill={flaggedIds.has(currentCard.id) ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                <line x1="4" y1="22" x2="4" y2="15" />
              </svg>
            </button>
            <p className="mb-4 text-center text-[10px] font-medium uppercase tracking-[0.15em] text-primary/70">
              Question
            </p>
            <CardText text={currentCard.front} className="text-center text-lg font-medium leading-relaxed text-foreground" />
            {!answerSubmitted ? (
              <div className="mt-6">
                <textarea
                  autoFocus
                  value={typedAnswer}
                  onChange={(e) => setTypedAnswer(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && typedAnswer.trim()) {
                      e.preventDefault();
                      handleTypeSubmit();
                    }
                  }}
                  placeholder="Type your answer…"
                  rows={3}
                  className="w-full resize-none rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
                {currentCard.last_typed_answer && (
                  <details className="mt-2 group/hint">
                    <summary className="cursor-pointer select-none list-none flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground/50 hover:text-muted-foreground/80 transition-colors w-fit">
                      <svg className="w-3 h-3 transition-transform group-open/hint:rotate-90" fill="none" viewBox="0 0 6 10" stroke="currentColor" strokeWidth="1.5"><path d="M1 1l4 4-4 4" /></svg>
                      Last time:
                      {currentCard.last_answer_correct === true && <span className="text-green-500/80">✓ correct</span>}
                      {currentCard.last_answer_correct === false && <span className="text-destructive/70">✗ wrong</span>}
                    </summary>
                    <p className="mt-1.5 text-xs text-muted-foreground/60 italic pl-4">{currentCard.last_typed_answer}</p>
                  </details>
                )}
                <Button
                  className="mt-3 w-full"
                  disabled={!typedAnswer.trim()}
                  onClick={handleTypeSubmit}
                >
                  Submit
                </Button>
              </div>
            ) : (
              <div className="mt-6 space-y-3">
                <div
                  className="rounded-xl px-4 py-3 transition-colors"
                  style={{
                    background: gradeResult === true
                      ? "color-mix(in oklch, var(--dashboard-accent-teal) 12%, transparent)"
                      : gradeResult === false
                      ? "color-mix(in oklch, var(--destructive) 10%, transparent)"
                      : "color-mix(in oklch, var(--muted) 40%, transparent)",
                    border: gradeResult === true
                      ? "1px solid color-mix(in oklch, var(--dashboard-accent-teal) 50%, transparent)"
                      : gradeResult === false
                      ? "1px solid color-mix(in oklch, var(--destructive) 40%, transparent)"
                      : "1px solid transparent",
                  }}
                >
                  <p
                    className="text-[10px] font-medium uppercase tracking-[0.12em]"
                    style={{
                      color: gradeResult === true
                        ? "var(--dashboard-accent-teal-strong)"
                        : gradeResult === false
                        ? "var(--destructive)"
                        : "var(--muted-foreground)",
                    }}
                  >
                    {aiGrading ? "Checking…" : gradeResult === true ? "Correct" : gradeResult === false ? "Incorrect" : "Your answer"}
                  </p>
                  <p className="mt-1 text-sm text-foreground">{typedAnswer}</p>
                </div>
                {gradeResult === false && (
                  <div className="rounded-xl border border-green-500/30 bg-green-500/5 px-4 py-3">
                    <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-green-600 dark:text-green-400">
                      Correct answer
                    </p>
                    <CardText text={currentCard.back} className="mt-1 text-sm text-foreground" />
                  </div>
                )}
                <Button className="w-full" onClick={() => advanceToNext(quizCards, answers, startedAt)}>
                  Continue →
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  // ── Results phase ─────────────────────────────────────────────────────────

  function getScoreFeedback(pct: number): { headline: string; subtext: string; headlineClass: string } {
    if (pct >= 90) {
      return {
        headline: "Excellent!",
        subtext: "You've got this material down.",
        headlineClass: "text-primary",
      };
    } else if (pct >= 70) {
      return {
        headline: "Good work!",
        subtext: "Keep at it — a few more sessions and you'll nail it.",
        headlineClass: "text-foreground",
      };
    } else {
      return {
        headline: "Keep practicing",
        subtext: "Check the explanations below to understand what tripped you up.",
        headlineClass: "text-muted-foreground",
      };
    }
  }

  const resultsPhase = phase === "results" && (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-10">
      {/* Score header */}
      <div className="mb-8 text-center">
        <p className="font-heading text-6xl font-bold text-primary">{scorePercent}%</p>
        {(() => {
          const feedback = getScoreFeedback(scorePercent);
          return (
            <>
              <p className={`font-heading mt-3 text-lg font-bold ${feedback.headlineClass}`}>
                {feedback.headline}
              </p>
              <p className="mt-1 text-sm text-muted-foreground/70">{feedback.subtext}</p>
            </>
          );
        })()}
        <p className="mt-3 text-sm text-muted-foreground">
          {correctCount}/{answers.length} correct · {formatElapsed(elapsed)}
        </p>
      </div>

      {/* Actions */}
      <div className="mb-8 flex gap-3">
        {answers.some((a) => !a.correct) && (
          <Button className="flex-1" onClick={retryMissed}>
            Retry missed
          </Button>
        )}
        <Button variant="outline" className="flex-1" onClick={goBack}>
          ↩ Undo last
        </Button>
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => router.push(`/decks/${id}`)}
        >
          Back to deck
        </Button>
      </div>

      {/* Answer review */}
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
                  <CardText text={answer.card.front} className="font-medium text-foreground" />
                  {!answer.correct && (
                    <div className="mt-1.5 space-y-2">
                      <p className="text-destructive/80">
                        Your answer: {answer.userAnswer}
                      </p>
                      <div className="text-green-600 dark:text-green-400 text-sm">
                        Correct: <CardText text={answer.card.back} />
                      </div>
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

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      {modeModal}
      {quizPhase}
      {resultsPhase}
    </div>
  );
}
