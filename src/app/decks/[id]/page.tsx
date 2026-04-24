"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Database } from "@/lib/database.types";

type Deck = Database["public"]["Tables"]["decks"]["Row"];
type Card = Database["public"]["Tables"]["cards"]["Row"];

type StudyState = "idle" | "studying" | "done";
type StudyMode = "due" | "all";
type AnswerMode = "flip" | "type" | "multiple-choice" | "random";
type ResolvedMode = "flip" | "type" | "multiple-choice";

function generateMcOptions(allCards: Card[], targetCard: Card): string[] {
  const distractors = allCards
    .filter((c) => c.id !== targetCard.id)
    .map((c) => c.back)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);
  return [...distractors, targetCard.back].sort(() => Math.random() - 0.5);
}

function isDue(card: Card): boolean {
  if (!card.next_review_at) return true;
  return new Date(card.next_review_at) <= new Date();
}

function nextDueDate(cards: Card[]): Date | null {
  const upcoming = cards
    .filter((c) => c.next_review_at && !isDue(c))
    .map((c) => new Date(c.next_review_at!));
  if (upcoming.length === 0) return null;
  return upcoming.reduce((min, d) => (d < min ? d : min));
}

function formatRelativeDate(date: Date): string {
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 1) return "tomorrow";
  if (diffDays <= 7) return `in ${diffDays} days`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function DeckPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [deck, setDeck] = useState<Deck | null>(null);
  const [allCards, setAllCards] = useState<Card[]>([]);
  const [dueCards, setDueCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [studyState, setStudyState] = useState<StudyState>("idle");
  const [studyMode, setStudyMode] = useState<StudyMode>("due");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState<Set<string>>(new Set());
  const [unknown, setUnknown] = useState<Set<string>>(new Set());
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const sessionSavedRef = useRef(false);

  const [showModeModal, setShowModeModal] = useState(false);
  const [answerMode, setAnswerMode] = useState<AnswerMode>("flip");
  const [typedAnswer, setTypedAnswer] = useState("");
  const [answerSubmitted, setAnswerSubmitted] = useState(false);
  const [selectedMcOption, setSelectedMcOption] = useState<string | null>(null);
  const [cardModes, setCardModes] = useState<Record<string, ResolvedMode>>({});
  const [mcOptions, setMcOptions] = useState<Record<string, string[]>>({});

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/decks/${id}`);
      if (!res.ok) {
        const { error } = await res.json();
        setError(error ?? "Deck not found");
      } else {
        const { deck, cards } = await res.json() as { deck: Deck; cards: Card[] };
        setDeck(deck);
        setAllCards(cards);
        setDueCards(cards.filter(isDue));
      }
      setLoading(false);
    }
    load();
  }, [id]);

  const studyQueue = studyMode === "all" ? allCards : dueCards;
  const currentCard = studyQueue[currentIndex];

  const markKnown = useCallback(() => {
    setKnown((prev) => new Set([...prev, currentCard.id]));
    setUnknown((prev) => { const s = new Set(prev); s.delete(currentCard.id); return s; });
    advance();
  }, [currentCard, studyQueue]);

  const markUnknown = useCallback(() => {
    setUnknown((prev) => new Set([...prev, currentCard.id]));
    setKnown((prev) => { const s = new Set(prev); s.delete(currentCard.id); return s; });
    advance();
  }, [currentCard, studyQueue]);

  function advance() {
    if (currentIndex + 1 >= studyQueue.length) {
      setStudyState("done");
    } else {
      setCurrentIndex((i) => i + 1);
      setFlipped(false);
    }
  }

  function startStudy(mode: StudyMode = "due") {
    setStudyMode(mode);
    sessionSavedRef.current = false;
    setCurrentIndex(0);
    setFlipped(false);
    setKnown(new Set());
    setUnknown(new Set());
    setStartedAt(new Date().toISOString());
    setStudyState("studying");
  }

  useEffect(() => {
    if (studyState !== "studying") return;
    function onKey(e: KeyboardEvent) {
      if (e.key === " " || e.key === "Enter") { e.preventDefault(); setFlipped((f) => !f); }
      if (e.key === "ArrowRight" && flipped) markKnown();
      if (e.key === "ArrowLeft" && flipped) markUnknown();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [studyState, flipped, markKnown, markUnknown]);

  useEffect(() => {
    if (studyState !== "done" || !deck || !startedAt || sessionSavedRef.current) return;
    sessionSavedRef.current = true;
    const score = studyQueue.length > 0 ? Math.round((known.size / studyQueue.length) * 100) : 0;
    const results = studyQueue
      .filter((c) => known.has(c.id) || unknown.has(c.id))
      .map((c) => ({ cardId: c.id, correct: known.has(c.id) }));
    fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deckId: deck.id, score, startedAt, results }),
    });
  }, [studyState, deck, startedAt, known, unknown, studyQueue]);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10 space-y-4">
        <div className="h-7 w-56 rounded-lg bg-card/80 animate-pulse" />
        <div className="h-4 w-28 rounded-lg bg-card/60 animate-pulse" />
        <div className="mt-8 h-80 rounded-2xl bg-card/60 animate-pulse" />
      </div>
    );
  }

  if (error || !deck) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <p className="text-sm text-destructive">{error ?? "Deck not found"}</p>
        <Button variant="ghost" size="sm" className="mt-4" onClick={() => router.push("/")}>
          ← Back to decks
        </Button>
      </div>
    );
  }

  // ── Idle — deck overview ──────────────────────────────────────────────────
  if (studyState === "idle") {
    const hasDue = dueCards.length > 0;
    const next = nextDueDate(allCards);

    return (
      <div className="mx-auto max-w-3xl px-6 py-10 animate-fade-up">
        <button
          onClick={() => router.push("/")}
          className="mb-8 flex items-center gap-1.5 text-xs text-muted-foreground/60 transition-colors hover:text-foreground"
        >
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          All decks
        </button>

        <div className="mb-8">
          <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">
            {deck.title}
          </h1>
          {deck.topic_tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {deck.topic_tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-border/50 bg-muted/30 px-2 py-0.5 text-[10px] text-muted-foreground/70"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
          <p className="mt-3 text-sm text-muted-foreground/60">
            {deck.card_count} {deck.card_count === 1 ? "card" : "cards"}
          </p>
        </div>

        {hasDue ? (
          <div className="space-y-3">
            <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-card p-6">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-heading text-base font-semibold text-foreground">
                    Ready to study
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground/70">
                    {dueCards.length} {dueCards.length === 1 ? "card" : "cards"} due now
                  </p>
                </div>
                <Button onClick={() => startStudy("due")} size="lg">
                  Start session
                </Button>
              </div>
            </div>
            {allCards.length > dueCards.length && (
              <button
                onClick={() => startStudy("all")}
                className="w-full text-center text-xs text-muted-foreground/50 transition-colors hover:text-muted-foreground"
              >
                Retest all {allCards.length} cards
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-card px-6 py-5">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-heading font-semibold text-foreground">All caught up</p>
                  {next ? (
                    <p className="mt-1 text-sm text-muted-foreground/70">
                      Next card due {formatRelativeDate(next)}
                    </p>
                  ) : allCards.length === 0 ? (
                    <p className="mt-1 text-sm text-muted-foreground/70">No cards in this deck yet.</p>
                  ) : null}
                </div>
                {allCards.length > 0 && (
                  <Button variant="outline" onClick={() => startStudy("all")}>
                    Retest all
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Done ──────────────────────────────────────────────────────────────────
  if (studyState === "done") {
    const knownCount = known.size;
    const unknownCount = unknown.size;
    const pct = studyQueue.length > 0 ? Math.round((knownCount / studyQueue.length) * 100) : 0;

    return (
      <div className="mx-auto max-w-3xl px-6 py-10 animate-fade-up">
        <div className="mb-1.5 text-xs text-muted-foreground/50">{deck.title}</div>
        <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">
          Session complete
        </h1>

        <div className="mt-8 relative overflow-hidden rounded-2xl border border-border/50 bg-card p-8">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

          <div className="mb-6 text-center">
            <p className="font-heading text-6xl font-bold tracking-tight text-foreground tabular-nums">
              {pct}%
            </p>
            <p className="mt-1 text-sm text-muted-foreground/60">accuracy this session</p>
          </div>

          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/60">
            <div
              className="h-full rounded-full bg-primary transition-all duration-1000 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-border/40 bg-muted/25 p-4 text-center">
              <p className="font-heading text-2xl font-bold tabular-nums text-foreground">{knownCount}</p>
              <p className="mt-0.5 text-xs text-muted-foreground/60">knew it</p>
            </div>
            <div className="rounded-xl border border-border/40 bg-muted/25 p-4 text-center">
              <p className="font-heading text-2xl font-bold tabular-nums text-foreground">{unknownCount}</p>
              <p className="mt-0.5 text-xs text-muted-foreground/60">still learning</p>
            </div>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <Button variant="outline" onClick={() => router.push("/")}>
            Back to decks
          </Button>
          {unknownCount > 0 && (
            <Button variant="outline" onClick={() => startStudy(studyMode)}>
              Study again
            </Button>
          )}
          <Button onClick={() => startStudy("all")}>
            Retest all
          </Button>
        </div>
      </div>
    );
  }

  // ── Studying ──────────────────────────────────────────────────────────────
  const progressPct = (currentIndex / studyQueue.length) * 100;

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      {/* Header row */}
      <div className="mb-5 flex items-center justify-between">
        <button
          onClick={() => { setStudyState("idle"); setCurrentIndex(0); setFlipped(false); }}
          className="flex items-center gap-1.5 text-xs text-muted-foreground/60 transition-colors hover:text-foreground"
        >
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          {deck.title}
        </button>
        <span className="font-heading text-sm font-semibold tabular-nums text-foreground">
          {currentIndex + 1}
          <span className="text-muted-foreground/50 font-normal"> / {studyQueue.length}</span>
        </span>
      </div>

      {/* Progress bar */}
      <div className="mb-7 h-px w-full rounded-full bg-border/60">
        <div
          className="h-px rounded-full bg-primary transition-all duration-300"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Flashcard */}
      <div
        className="relative cursor-pointer select-none"
        style={{ perspective: "1200px" }}
        onClick={() => setFlipped((f) => !f)}
      >
        <div
          className="relative h-80 w-full transition-transform duration-500"
          style={{
            transformStyle: "preserve-3d",
            transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
          }}
        >
          {/* Front */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden rounded-2xl border border-border/50 bg-card px-8 text-center"
            style={{ backfaceVisibility: "hidden" }}
          >
            <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-primary/6 to-transparent pointer-events-none" />
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
            <p className="mb-5 text-[10px] font-medium uppercase tracking-[0.18em] text-primary/55">
              Question
            </p>
            <p className="text-xl font-medium leading-relaxed text-foreground">
              {currentCard.front}
            </p>
            <p className="mt-10 text-[10px] text-muted-foreground/35 tracking-wide">
              tap or press space to reveal
            </p>
          </div>

          {/* Back */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden rounded-2xl border border-primary/25 bg-card px-8 text-center"
            style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
          >
            <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-primary/8 to-transparent pointer-events-none" />
            <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-primary/4 to-transparent pointer-events-none" />
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
            <p className="mb-5 text-[10px] font-medium uppercase tracking-[0.18em] text-primary/55">
              Answer
            </p>
            <p className="text-xl leading-relaxed text-foreground">
              {currentCard.back}
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div
        className={`mt-5 flex gap-3 transition-all duration-300 ${
          flipped ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1.5 pointer-events-none"
        }`}
      >
        <Button
          variant="outline"
          className="flex-1 rounded-xl border-border/50 text-muted-foreground hover:border-rose-500/30 hover:bg-rose-500/5 hover:text-rose-400"
          onClick={markUnknown}
        >
          Still learning
          <kbd className="ml-2 text-[10px] opacity-35 font-sans not-italic">←</kbd>
        </Button>
        <Button className="flex-1 rounded-xl" onClick={markKnown}>
          Knew it
          <kbd className="ml-2 text-[10px] opacity-55 font-sans not-italic">→</kbd>
        </Button>
      </div>

      <p className="mt-4 text-center text-[10px] text-muted-foreground/30 tracking-wide">
        space to flip · ← still learning · → knew it
      </p>
    </div>
  );
}
