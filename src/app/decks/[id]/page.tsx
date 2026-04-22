"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Database } from "@/lib/database.types";

type Deck = Database["public"]["Tables"]["decks"]["Row"];
type Card = Database["public"]["Tables"]["cards"]["Row"];

type StudyState = "idle" | "studying" | "done";

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
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState<Set<string>>(new Set());
  const [unknown, setUnknown] = useState<Set<string>>(new Set());
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const sessionSavedRef = useRef(false);

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

  // The active study queue is the due cards
  const studyQueue = dueCards;
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

  function startStudy() {
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
        <div className="h-6 w-48 rounded bg-card animate-pulse" />
        <div className="h-4 w-24 rounded bg-card animate-pulse" />
        <div className="mt-8 h-64 rounded-xl bg-card animate-pulse" />
      </div>
    );
  }

  if (error || !deck) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <p className="text-sm text-destructive">{error ?? "Deck not found"}</p>
        <Button variant="ghost" size="sm" className="mt-4" onClick={() => router.push("/")}>
          Back to decks
        </Button>
      </div>
    );
  }

  // ── Idle — deck overview ──────────────────────────────────────────────────
  if (studyState === "idle") {
    const hasDue = dueCards.length > 0;
    const next = nextDueDate(allCards);

    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <button
          onClick={() => router.push("/")}
          className="mb-6 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Decks
        </button>
        <h1 className="text-2xl font-semibold tracking-tight">{deck.title}</h1>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {deck.topic_tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs font-normal">
              {tag}
            </Badge>
          ))}
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          {deck.card_count} {deck.card_count === 1 ? "card" : "cards"}
        </p>

        {hasDue ? (
          <div className="mt-8">
            <Button onClick={startStudy}>
              Study now · {dueCards.length} due
            </Button>
          </div>
        ) : (
          <div className="mt-8 rounded-xl border border-border bg-card px-6 py-5">
            <p className="font-medium">Nothing due right now</p>
            {next ? (
              <p className="mt-1 text-sm text-muted-foreground">
                Next card due {formatRelativeDate(next)}
              </p>
            ) : allCards.length === 0 ? (
              <p className="mt-1 text-sm text-muted-foreground">No cards in this deck yet.</p>
            ) : null}
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
      <div className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-xl font-semibold tracking-tight">Session complete</h1>
        <p className="mt-1 text-sm text-muted-foreground">{deck.title}</p>

        <div className="mt-8 grid grid-cols-2 gap-4">
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-3xl font-semibold">{knownCount}</p>
            <p className="mt-1 text-sm text-muted-foreground">knew it</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-3xl font-semibold">{unknownCount}</p>
            <p className="mt-1 text-sm text-muted-foreground">still learning</p>
          </div>
        </div>

        <p className="mt-4 text-sm text-muted-foreground">{pct}% correct this session</p>

        <div className="mt-8 flex gap-3">
          <Button variant="outline" onClick={() => router.push("/")}>
            Back to decks
          </Button>
        </div>
      </div>
    );
  }

  // ── Studying ──────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <button
          onClick={() => { setStudyState("idle"); setCurrentIndex(0); setFlipped(false); }}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← {deck.title}
        </button>
        <span className="text-sm text-muted-foreground">
          {currentIndex + 1} / {studyQueue.length}
        </span>
      </div>

      {/* Progress bar */}
      <div className="mb-6 h-1 w-full rounded-full bg-border">
        <div
          className="h-1 rounded-full bg-foreground transition-all duration-300"
          style={{ width: `${((currentIndex) / studyQueue.length) * 100}%` }}
        />
      </div>

      {/* Flashcard */}
      <div
        className="relative cursor-pointer select-none"
        style={{ perspective: "1200px" }}
        onClick={() => setFlipped((f) => !f)}
      >
        <div
          className="relative h-64 w-full transition-transform duration-500"
          style={{
            transformStyle: "preserve-3d",
            transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
          }}
        >
          {/* Front */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center rounded-xl border border-border bg-card px-8 text-center"
            style={{ backfaceVisibility: "hidden" }}
          >
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-4">Question</p>
            <p className="text-lg font-medium leading-snug">{currentCard.front}</p>
            <p className="mt-6 text-xs text-muted-foreground">Click to reveal</p>
          </div>

          {/* Back */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center rounded-xl border border-border bg-card px-8 text-center"
            style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
          >
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-4">Answer</p>
            <p className="text-lg leading-snug">{currentCard.back}</p>
          </div>
        </div>
      </div>

      {/* Actions — only show after flip */}
      <div className={`mt-6 flex gap-3 transition-opacity duration-200 ${flipped ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
        <Button
          variant="outline"
          className="flex-1 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={markUnknown}
        >
          Still learning
        </Button>
        <Button className="flex-1" onClick={markKnown}>
          Knew it
        </Button>
      </div>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        Space to flip · ← still learning · → knew it
      </p>
    </div>
  );
}
