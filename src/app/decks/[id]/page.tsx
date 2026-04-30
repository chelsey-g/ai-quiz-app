"use client";

import { useEffect, useState, useCallback, useRef, useId } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Database } from "@/lib/database.types";
import type { DeckStatsResult } from "@/lib/services/stats";

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
    .slice(0, Math.min(3, allCards.length - 1));
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

interface CardRowProps {
  card: Card;
  isEditing: boolean;
  isDeleting: boolean;
  isSaving: boolean;
  isDeletingInProgress: boolean;
  editFront: string;
  editBack: string;
  onEditFrontChange: (v: string) => void;
  onEditBackChange: (v: string) => void;
  onEditStart: (card: Card) => void;
  onEditSave: (id: string) => void;
  onEditCancel: () => void;
  onDeleteStart: (id: string) => void;
  onDeleteConfirm: (id: string) => void;
  onDeleteCancel: () => void;
}

function CardRow({
  card,
  isEditing,
  isDeleting,
  isSaving,
  isDeletingInProgress,
  editFront,
  editBack,
  onEditFrontChange,
  onEditBackChange,
  onEditStart,
  onEditSave,
  onEditCancel,
  onDeleteStart,
  onDeleteConfirm,
  onDeleteCancel,
}: CardRowProps) {
  if (isEditing) {
    return (
      <div
        className="rounded-xl border bg-card px-4 py-3 space-y-2.5"
        style={{ borderColor: "oklch(0.65 0.18 265 / 0.3)" }}
      >
        <textarea
          autoFocus
          value={editFront}
          onChange={(e) => onEditFrontChange(e.target.value)}
          rows={2}
          placeholder="Front (question)"
          className="w-full resize-none rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        <textarea
          value={editBack}
          onChange={(e) => onEditBackChange(e.target.value)}
          rows={2}
          placeholder="Back (answer)"
          className="w-full resize-none rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            disabled={!editFront.trim() || !editBack.trim() || isSaving}
            onClick={() => onEditSave(card.id)}
          >
            {isSaving ? "Saving..." : "Save"}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onEditCancel}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  if (isDeleting) {
    return (
      <div
        className="rounded-xl border bg-card px-4 py-3"
        style={{ borderColor: "oklch(0.55 0.2 27 / 0.35)" }}
      >
        <p className="text-sm font-medium text-foreground">{card.front}</p>
        <p className="mt-1.5 text-sm text-muted-foreground/80">{card.back}</p>
        <div className="mt-3 flex items-center gap-2.5">
          <p className="text-xs text-muted-foreground/70">Delete this card?</p>
          <button
            disabled={isDeletingInProgress}
            onClick={() => onDeleteConfirm(card.id)}
            className="rounded-md px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50"
            style={{ background: "oklch(0.55 0.2 27 / 0.12)", border: "1px solid oklch(0.55 0.2 27 / 0.4)", color: "oklch(0.75 0.18 27)" }}
          >
            {isDeletingInProgress ? "Deleting..." : "Confirm"}
          </button>
          <button
            onClick={onDeleteCancel}
            className="rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground/70 transition-colors hover:text-foreground"
            style={{ border: "1px solid oklch(0.5 0.01 65 / 0.3)" }}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="group rounded-xl border bg-card px-4 py-3 flex items-start gap-3"
      style={{ borderColor: "oklch(0.77 0.195 68 / 0.2)" }}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{card.front}</p>
        <p className="mt-1.5 text-sm text-muted-foreground/80">{card.back}</p>
      </div>
      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <button
          onClick={() => onEditStart(card)}
          className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-[oklch(0.65_0.18_265_/_0.12)]"
          style={{ color: "oklch(0.65 0.18 265 / 0.7)" }}
          title="Edit card"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
          </svg>
        </button>
        <button
          onClick={() => onDeleteStart(card.id)}
          className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-[oklch(0.55_0.2_27_/_0.12)]"
          style={{ color: "oklch(0.55 0.2 27 / 0.7)" }}
          title="Delete card"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function DeckStatsBar({ stats, totalCards }: { stats: DeckStatsResult; totalCards: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-5 rounded-xl border border-border/40 bg-card/40">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground/60">
          Stats
        </span>
        <svg
          className={`h-3.5 w-3.5 text-muted-foreground/40 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="grid grid-cols-4 gap-3 border-t border-border/30 px-4 pb-4 pt-3">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50">Sessions</p>
            <p className="font-heading mt-0.5 text-lg font-bold tabular-nums text-foreground">{stats.sessions}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50">Accuracy</p>
            <p className="font-heading mt-0.5 text-lg font-bold tabular-nums text-foreground">
              {stats.accuracy !== null ? `${stats.accuracy}%` : "—"}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50">Mastered</p>
            <p className="font-heading mt-0.5 text-lg font-bold tabular-nums text-foreground">
              {stats.mastered} / {totalCards}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50">Last studied</p>
            <p className="font-heading mt-0.5 text-lg font-bold text-foreground">
              {stats.lastStudied
                ? new Date(stats.lastStudied).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                : "Never"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DeckPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [deck, setDeck] = useState<Deck | null>(null);
  const [allCards, setAllCards] = useState<Card[]>([]);
  const [dueCards, setDueCards] = useState<Card[]>([]);
  const [deckStats, setDeckStats] = useState<DeckStatsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showAddCard, setShowAddCard] = useState(false);
  const [cardFront, setCardFront] = useState("");
  const [cardBack, setCardBack] = useState("");
  const [cardTags, setCardTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [addingCard, setAddingCard] = useState(false);
  const [addCardError, setAddCardError] = useState<string | null>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);

  const [studyState, setStudyState] = useState<StudyState>("idle");
  const [studyMode, setStudyMode] = useState<StudyMode>("due");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState<Set<string>>(new Set());
  const [unknown, setUnknown] = useState<Set<string>>(new Set());
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const sessionSavedRef = useRef(false);
  const [cardHistory, setCardHistory] = useState<{ index: number; wasKnown: boolean | null }[]>([]);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const [activeTag, setActiveTag] = useState<string | null>(null);

  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [deletingCardId, setDeletingCardId] = useState<string | null>(null);
  const [editFront, setEditFront] = useState("");
  const [editBack, setEditBack] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingInProgress, setDeletingInProgress] = useState<string | null>(null);

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
        const { deck, cards, deckStats } = await res.json() as { deck: Deck; cards: Card[]; deckStats: DeckStatsResult };
        setDeck(deck);
        setAllCards(cards);
        setDueCards(cards.filter(isDue));
        setDeckStats(deckStats ?? null);
      }
      setLoading(false);
    }
    load();
  }, [id]);

  const cardLevelTags = [...new Set(allCards.flatMap((c) => (c as Card & { tags?: string[] }).tags ?? []))];
  const allTags = [...new Set([...(deck?.topic_tags ?? []), ...cardLevelTags])];
  const tagFilteredCards = activeTag
    ? (() => {
        const byCardTag = allCards.filter((c) => ((c as Card & { tags?: string[] }).tags ?? []).includes(activeTag));
        return byCardTag.length > 0 ? byCardTag : allCards;
      })()
    : allCards;
  const isDeckLevelTag = activeTag !== null && !cardLevelTags.includes(activeTag);
  const tagFilteredDue = activeTag && !isDeckLevelTag
    ? dueCards.filter((c) => ((c as Card & { tags?: string[] }).tags ?? []).includes(activeTag))
    : dueCards;
  const studyQueue = studyMode === "all" ? tagFilteredCards : tagFilteredDue;
  const currentCard = studyQueue[currentIndex];
  const currentCardMode: ResolvedMode =
    studyState === "studying" && currentCard
      ? (cardModes[currentCard.id] ?? "flip")
      : "flip";

  const markKnown = useCallback(() => {
    setCardHistory((h) => [...h, { index: currentIndex, wasKnown: true }]);
    setKnown((prev) => new Set([...prev, currentCard.id]));
    setUnknown((prev) => { const s = new Set(prev); s.delete(currentCard.id); return s; });
    advance();
  }, [currentCard, currentIndex, studyQueue]);

  const markUnknown = useCallback(() => {
    setCardHistory((h) => [...h, { index: currentIndex, wasKnown: false }]);
    setUnknown((prev) => new Set([...prev, currentCard.id]));
    setKnown((prev) => { const s = new Set(prev); s.delete(currentCard.id); return s; });
    advance();
  }, [currentCard, currentIndex, studyQueue]);

  function goBack() {
    if (cardHistory.length === 0) return;
    const last = cardHistory[cardHistory.length - 1];
    const prevCard = studyQueue[last.index];
    if (prevCard) {
      if (last.wasKnown === true) setKnown((prev) => { const s = new Set(prev); s.delete(prevCard.id); return s; });
      if (last.wasKnown === false) setUnknown((prev) => { const s = new Set(prev); s.delete(prevCard.id); return s; });
    }
    setCardHistory((h) => h.slice(0, -1));
    setCurrentIndex(last.index);
    setFlipped(false);
    setTypedAnswer("");
    setAnswerSubmitted(false);
    setSelectedMcOption(null);
    if (studyState === "done") setStudyState("studying");
  }

  function advance() {
    setTypedAnswer("");
    setAnswerSubmitted(false);
    setSelectedMcOption(null);
    if (currentIndex + 1 >= studyQueue.length) {
      setStudyState("done");
    } else {
      setCurrentIndex((i) => i + 1);
      setFlipped(false);
    }
  }

  function startStudy(mode: AnswerMode = answerMode) {
    sessionSavedRef.current = false;
    setCurrentIndex(0);
    setFlipped(false);
    setKnown(new Set());
    setUnknown(new Set());
    setCardHistory([]);
    setStartedAt(new Date().toISOString());
    setTypedAnswer("");
    setAnswerSubmitted(false);
    setSelectedMcOption(null);
    setAnswerMode(mode);
    setShowModeModal(false);

    const fixedModes: ResolvedMode[] = ["flip", "type", "multiple-choice"];
    const resolvedModes: Record<string, ResolvedMode> = {};
    const resolvedMcOptions: Record<string, string[]> = {};

    studyQueue.forEach((card) => {
      let cardMode: ResolvedMode =
        mode === "random"
          ? fixedModes[Math.floor(Math.random() * fixedModes.length)]
          : (mode as ResolvedMode);

      // Fall back to flip if not enough cards for MC distractors
      if (cardMode === "multiple-choice" && tagFilteredCards.length < 2) {
        cardMode = "flip";
      }

      resolvedModes[card.id] = cardMode;

      if (cardMode === "multiple-choice") {
        resolvedMcOptions[card.id] = generateMcOptions(tagFilteredCards, card);
      }
    });

    setCardModes(resolvedModes);
    setMcOptions(resolvedMcOptions);
    setStudyState("studying");
  }

  function startEditCard(card: Card) {
    setEditingCardId(card.id);
    setEditFront(card.front ?? "");
    setEditBack(card.back ?? "");
    setDeletingCardId(null);
  }

  function cancelEdit() {
    setEditingCardId(null);
    setEditFront("");
    setEditBack("");
  }

  async function handleSaveEdit(cardId: string) {
    if (!editFront.trim() || !editBack.trim()) return;
    setSavingEdit(true);
    const res = await fetch(`/api/cards/${cardId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ front: editFront.trim(), back: editBack.trim() }),
    });
    setSavingEdit(false);
    if (res.ok) {
      setAllCards((prev) =>
        prev.map((c) => c.id === cardId ? { ...c, front: editFront.trim(), back: editBack.trim() } : c)
      );
      setDueCards((prev) =>
        prev.map((c) => c.id === cardId ? { ...c, front: editFront.trim(), back: editBack.trim() } : c)
      );
      cancelEdit();
    }
  }

  async function handleConfirmDelete(cardId: string) {
    setDeletingInProgress(cardId);
    const res = await fetch(`/api/cards/${cardId}`, { method: "DELETE" });
    setDeletingInProgress(null);
    if (res.ok) {
      setAllCards((prev) => prev.filter((c) => c.id !== cardId));
      setDueCards((prev) => prev.filter((c) => c.id !== cardId));
      setDeck((prev) => prev ? { ...prev, card_count: Math.max(0, prev.card_count - 1) } : prev);
      setDeletingCardId(null);
    }
  }

  async function handleAddCard(e: React.FormEvent) {
    e.preventDefault();
    if (!cardFront.trim() || !cardBack.trim() || !deck) return;
    setAddingCard(true);
    setAddCardError(null);
    const res = await fetch(`/api/decks/${deck.id}/cards`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ front: cardFront.trim(), back: cardBack.trim(), tags: cardTags }),
    });
    setAddingCard(false);
    if (!res.ok) {
      const data = await res.json();
      setAddCardError(data.error ?? "Failed to add card");
      return;
    }
    const newCard = await res.json();
    setAllCards((prev) => [...prev, newCard]);
    setDueCards((prev) => [...prev, newCard]);
    setDeck((prev) => prev ? { ...prev, card_count: prev.card_count + 1 } : prev);
    setCardFront("");
    setCardBack("");
    setCardTags([]);
    setTagInput("");
    setShowAddCard(false);
  }

  function addTag(tag: string) {
    const t = tag.trim();
    if (t && !cardTags.includes(t)) setCardTags((prev) => [...prev, t]);
    setTagInput("");
    setShowSuggestions(false);
    tagInputRef.current?.focus();
  }

  function removeTag(tag: string) {
    setCardTags((prev) => prev.filter((t) => t !== tag));
  }

  function handleTagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if ((e.key === "Enter" || e.key === ",") && tagInput.trim()) {
      e.preventDefault();
      addTag(tagInput);
    } else if (e.key === "Backspace" && !tagInput && cardTags.length > 0) {
      setCardTags((prev) => prev.slice(0, -1));
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  }

  const tagSuggestions = allTags.filter(
    (t) => !cardTags.includes(t) && t.toLowerCase().includes(tagInput.toLowerCase())
  );

  useEffect(() => {
    if (studyState !== "studying") return;

    function onKey(e: KeyboardEvent) {
      if (currentCardMode === "flip") {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          setFlipped((f) => !f);
        }
        if (e.key === "ArrowRight" && flipped) markKnown();
        if (e.key === "ArrowLeft" && flipped) markUnknown();
      }

      if (currentCardMode === "type" && answerSubmitted) {
        if (e.key === "ArrowRight") markKnown();
        if (e.key === "ArrowLeft") markUnknown();
      }

      if (currentCardMode === "multiple-choice") {
        const options = mcOptions[currentCard?.id ?? ""] ?? [];
        if (selectedMcOption === null) {
          const idx = ["1", "2", "3", "4"].indexOf(e.key);
          if (idx !== -1 && options[idx]) {
            setSelectedMcOption(options[idx]);
          }
        } else {
          if (e.key === "Enter" || e.key === "ArrowRight") {
            selectedMcOption === currentCard.back ? markKnown() : markUnknown();
          }
        }
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    studyState,
    flipped,
    markKnown,
    markUnknown,
    currentCardMode,
    answerSubmitted,
    selectedMcOption,
    mcOptions,
    currentCard,
  ]);

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

  // ── Mode selection modal ──────────────────────────────────────────────────
  const modeModal = (
    <Dialog open={showModeModal} onOpenChange={setShowModeModal}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-heading text-base font-semibold">
            How do you want to answer?
          </DialogTitle>
        </DialogHeader>
        <div className="mt-2 grid grid-cols-2 gap-3">
          {(
            [
              {
                mode: "flip" as AnswerMode,
                label: "Flip card",
                description: "Reveal & self-assess",
              },
              {
                mode: "type" as AnswerMode,
                label: "Type answer",
                description: "Write it out",
              },
              {
                mode: "multiple-choice" as AnswerMode,
                label: "Multiple choice",
                description: "Pick from options",
                disabled: tagFilteredCards.length < 2,
              },
              {
                mode: "random" as AnswerMode,
                label: "Random",
                description: "Mix it up",
              },
            ] as Array<{ mode: AnswerMode; label: string; description: string; disabled?: boolean }>
          ).map(({ mode, label, description, disabled }) => (
            <button
              key={mode}
              disabled={disabled}
              onClick={() => !disabled && startStudy(mode)}
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
          <p className="mt-3 text-sm text-muted-foreground/60">
            {deck.card_count} {deck.card_count === 1 ? "card" : "cards"}
          </p>
        </div>

        {/* Per-deck stats */}
        {deckStats && deck && (
          <DeckStatsBar stats={deckStats} totalCards={deck.card_count} />
        )}

        {/* Tag filters */}
        {allTags.length > 0 && (
          <div className="mb-6 flex flex-wrap gap-2">
            <button
              onClick={() => setActiveTag(null)}
              className="rounded-full px-3 py-1 text-xs font-medium transition-colors"
              style={activeTag === null
                ? { border: "1px solid oklch(0.77 0.195 68 / 0.6)", background: "oklch(0.77 0.195 68 / 0.12)", color: "oklch(0.77 0.195 68)" }
                : { border: "1px solid oklch(0.77 0.195 68 / 0.35)", color: "oklch(0.77 0.195 68 / 0.75)" }}
            >
              All
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                className="rounded-full px-3 py-1 text-xs font-medium transition-colors"
                style={activeTag === tag
                  ? { border: "1px solid oklch(0.77 0.195 68 / 0.6)", background: "oklch(0.77 0.195 68 / 0.12)", color: "oklch(0.77 0.195 68)" }
                  : { border: "1px solid oklch(0.77 0.195 68 / 0.35)", color: "oklch(0.77 0.195 68 / 0.75)" }}
              >
                {tag}
              </button>
            ))}
          </div>
        )}

        {/* Cards for selected tag */}
        {activeTag && (
          <div className="mb-6 space-y-2">
            <p className="text-[10px] uppercase tracking-widest" style={{ color: "oklch(0.77 0.195 68 / 0.65)" }}>
              {isDeckLevelTag ? `All ${tagFilteredCards.length} cards` : `${tagFilteredCards.length} ${tagFilteredCards.length === 1 ? "card" : "cards"}`} · {activeTag}
            </p>
            {tagFilteredCards.map((card) => (
              <CardRow
                key={card.id}
                card={card}
                isEditing={editingCardId === card.id}
                isDeleting={deletingCardId === card.id}
                isSaving={savingEdit && editingCardId === card.id}
                isDeletingInProgress={deletingInProgress === card.id}
                editFront={editFront}
                editBack={editBack}
                onEditFrontChange={setEditFront}
                onEditBackChange={setEditBack}
                onEditStart={startEditCard}
                onEditSave={handleSaveEdit}
                onEditCancel={cancelEdit}
                onDeleteStart={(id) => { setDeletingCardId(id); setEditingCardId(null); }}
                onDeleteConfirm={handleConfirmDelete}
                onDeleteCancel={() => setDeletingCardId(null)}
              />
            ))}
          </div>
        )}

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
                    {tagFilteredDue.length} {tagFilteredDue.length === 1 ? "card" : "cards"} due
                    {activeTag ? ` · ${activeTag}` : " now"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Button onClick={() => { setStudyMode("due"); setShowModeModal(true); }} size="lg" disabled={tagFilteredDue.length === 0}>
                    Start session
                  </Button>
                  <Link
                    href={`/quiz/${id}`}
                    className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors hover:bg-[oklch(0.65_0.18_265_/_0.08)]" style={{ border: "1px solid oklch(0.65 0.18 265 / 0.4)", color: "oklch(0.65 0.18 265 / 0.85)" }}
                  >
                    Take a quiz
                  </Link>
                </div>
              </div>
            </div>
            {tagFilteredCards.length > tagFilteredDue.length && (
              <button
                onClick={() => { setStudyMode("all"); setShowModeModal(true); }}
                className="w-full rounded-xl py-2.5 text-center text-xs font-medium transition-colors hover:bg-[oklch(0.65_0.18_265_/_0.08)]"
                style={{ border: "1px solid oklch(0.65 0.18 265 / 0.4)", color: "oklch(0.65 0.18 265 / 0.85)" }}
              >
                Retest all {tagFilteredCards.length} cards{activeTag ? ` · ${activeTag}` : ""}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-card px-6 py-5">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-heading font-semibold text-foreground">
                    {activeTag ? `All caught up · ${activeTag}` : "All caught up"}
                  </p>
                  {next ? (
                    <p className="mt-1 text-sm text-muted-foreground/70">
                      Next card due {formatRelativeDate(next)}
                    </p>
                  ) : tagFilteredCards.length === 0 ? (
                    <p className="mt-1 text-sm text-muted-foreground/70">
                      {activeTag ? `No cards tagged "${activeTag}".` : "No cards in this deck yet."}
                    </p>
                  ) : null}
                </div>
                {tagFilteredCards.length > 0 && (
                  <div className="flex items-center gap-3">
                    <Button variant="outline" onClick={() => { setStudyMode("all"); setShowModeModal(true); }}>
                      Retest all
                    </Button>
                    <Link
                      href={`/quiz/${id}`}
                      className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors hover:bg-[oklch(0.65_0.18_265_/_0.08)]" style={{ border: "1px solid oklch(0.65 0.18 265 / 0.4)", color: "oklch(0.65 0.18 265 / 0.85)" }}
                    >
                      Take a quiz
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        {/* Add card section */}
        <div className="mt-8">
          {!showAddCard ? (
            <button
              onClick={() => { setShowAddCard(true); setAddCardError(null); }}
              className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-medium transition-colors hover:bg-[oklch(0.77_0.195_68_/_0.08)]"
              style={{ border: "1px solid oklch(0.77 0.195 68 / 0.4)", color: "oklch(0.77 0.195 68 / 0.85)" }}
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add card
            </button>
          ) : (
            <form onSubmit={handleAddCard} className="space-y-3 rounded-2xl border border-border/50 bg-card p-5">
              <p className="font-heading text-sm font-semibold text-foreground">Add a card</p>
              <textarea
                autoFocus
                value={cardFront}
                onChange={(e) => setCardFront(e.target.value)}
                placeholder="Front (question)"
                rows={2}
                className="w-full resize-none rounded-xl border border-border bg-muted/30 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <textarea
                value={cardBack}
                onChange={(e) => setCardBack(e.target.value)}
                placeholder="Back (answer)"
                rows={2}
                className="w-full resize-none rounded-xl border border-border bg-muted/30 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40"
              />

              {/* Tag input */}
              <div className="relative">
                <div
                  className="flex min-h-[40px] flex-wrap items-center gap-1.5 rounded-xl border border-border bg-muted/30 px-3 py-2 focus-within:ring-2 focus-within:ring-primary/40 cursor-text"
                  onClick={() => tagInputRef.current?.focus()}
                >
                  {cardTags.map((tag) => (
                    <span
                      key={tag}
                      className="flex items-center gap-1 rounded-full border border-border/60 bg-muted/50 px-2.5 py-0.5 text-[11px] text-foreground/80"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); removeTag(tag); }}
                        className="ml-0.5 text-muted-foreground/50 hover:text-foreground"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  <input
                    ref={tagInputRef}
                    value={tagInput}
                    onChange={(e) => { setTagInput(e.target.value); setShowSuggestions(true); }}
                    onKeyDown={handleTagKeyDown}
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                    placeholder={cardTags.length === 0 ? "Add labels (e.g. Chapter 1)" : ""}
                    className="min-w-[120px] flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
                  />
                </div>
                {showSuggestions && (tagSuggestions.length > 0 || tagInput.trim()) && (
                  <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-border bg-card shadow-lg">
                    {tagSuggestions.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onMouseDown={() => addTag(s)}
                        className="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-muted/50"
                      >
                        {s}
                      </button>
                    ))}
                    {tagInput.trim() && !cardTags.includes(tagInput.trim()) && !allTags.includes(tagInput.trim()) && (
                      <button
                        type="button"
                        onMouseDown={() => addTag(tagInput)}
                        className="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-muted/50"
                      >
                        <span className="text-muted-foreground/60">Create </span>
                        &ldquo;{tagInput.trim()}&rdquo;
                      </button>
                    )}
                  </div>
                )}
              </div>

              {addCardError && <p className="text-xs text-destructive">{addCardError}</p>}
              <div className="flex items-center gap-2">
                <Button type="submit" size="sm" disabled={!cardFront.trim() || !cardBack.trim() || addingCard}>
                  {addingCard ? "Saving…" : "Save card"}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => { setShowAddCard(false); setCardFront(""); setCardBack(""); setCardTags([]); setTagInput(""); }}>
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </div>

        {/* All cards list */}
        {!activeTag && allCards.length > 0 && (
          <div className="mt-8 space-y-2">
            <p className="text-[10px] uppercase tracking-widest" style={{ color: "oklch(0.77 0.195 68 / 0.65)" }}>
              {allCards.length} {allCards.length === 1 ? "card" : "cards"}
            </p>
            {allCards.map((card) => (
              <CardRow
                key={card.id}
                card={card}
                isEditing={editingCardId === card.id}
                isDeleting={deletingCardId === card.id}
                isSaving={savingEdit && editingCardId === card.id}
                isDeletingInProgress={deletingInProgress === card.id}
                editFront={editFront}
                editBack={editBack}
                onEditFrontChange={setEditFront}
                onEditBackChange={setEditBack}
                onEditStart={startEditCard}
                onEditSave={handleSaveEdit}
                onEditCancel={cancelEdit}
                onDeleteStart={(id) => { setDeletingCardId(id); setEditingCardId(null); }}
                onDeleteConfirm={handleConfirmDelete}
                onDeleteCancel={() => setDeletingCardId(null)}
              />
            ))}
          </div>
        )}

        {modeModal}
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
          {cardHistory.length > 0 && (
            <Button variant="outline" onClick={goBack}>
              ↩ Undo last
            </Button>
          )}
          {unknownCount > 0 && (
            <Button variant="outline" onClick={() => setShowModeModal(true)}>
              Study again
            </Button>
          )}
          <Button onClick={() => { setStudyMode("all"); setShowModeModal(true); }}>
            Retest all
          </Button>
        </div>
        {modeModal}
      </div>
    );
  }

  // ── Studying ──────────────────────────────────────────────────────────────
  const progressPct = (currentIndex / studyQueue.length) * 100;

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      {/* Exit confirmation */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-xl">
            <h2 className="font-heading text-base font-semibold text-foreground">Exit session?</h2>
            <p className="mt-1.5 text-sm text-muted-foreground/70">
              You&apos;ve rated {cardHistory.length} {cardHistory.length === 1 ? "card" : "cards"}. Progress won&apos;t be saved if you exit now.
            </p>
            <div className="mt-5 flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowExitConfirm(false)}>
                Keep going
              </Button>
              <Button variant="outline" className="flex-1 border-destructive/40 text-destructive hover:bg-destructive/5" onClick={() => { setShowExitConfirm(false); setStudyState("idle"); setCurrentIndex(0); setFlipped(false); setCardHistory([]); }}>
                Exit
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Header row */}
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => cardHistory.length > 0 ? setShowExitConfirm(true) : (setStudyState("idle"), setCurrentIndex(0), setFlipped(false))}
            className="flex items-center gap-1.5 text-xs text-muted-foreground/60 transition-colors hover:text-foreground"
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            {deck.title}
          </button>
          {cardHistory.length > 0 && (
            <button
              onClick={goBack}
              className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors hover:bg-[oklch(0.65_0.18_265_/_0.08)]"
              style={{ border: "1px solid oklch(0.65 0.18 265 / 0.4)", color: "oklch(0.65 0.18 265 / 0.85)" }}
              title="Undo last rating"
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
              </svg>
              Undo
            </button>
          )}
        </div>
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

      {/* Flashcard — flip mode */}
      {currentCardMode === "flip" && (
        <>
          <div
            className="relative cursor-pointer select-none"
            style={{ perspective: "1200px" }}
            onClick={() => setFlipped((f) => !f)}
          >
            <div
              className="relative h-72 w-full transition-transform duration-500"
              style={{
                transformStyle: "preserve-3d",
                transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
              }}
            >
              {/* Front */}
              <div
                className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl border border-border bg-card px-8 text-center"
                style={{ backfaceVisibility: "hidden" }}
              >
                <p className="mb-5 text-[10px] font-medium uppercase tracking-[0.15em] text-primary/70">
                  Question
                </p>
                <p className="text-lg font-medium leading-relaxed text-foreground">
                  {currentCard.front}
                </p>
                <p className="mt-8 text-[10px] text-muted-foreground/50">
                  tap or press space to reveal
                </p>
              </div>
              {/* Back */}
              <div
                className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl border border-primary/20 bg-card px-8 text-center"
                style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
              >
                <p className="mb-5 text-[10px] font-medium uppercase tracking-[0.15em] text-primary/70">
                  Answer
                </p>
                <p className="text-lg leading-relaxed text-foreground">{currentCard.back}</p>
              </div>
            </div>
          </div>

          <div
            className={`mt-5 flex gap-3 transition-all duration-300 ${
              flipped ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1 pointer-events-none"
            }`}
          >
            <Button
              variant="outline"
              className="flex-1 border-border text-muted-foreground hover:border-destructive/40 hover:bg-destructive/5 hover:text-destructive"
              onClick={markUnknown}
            >
              Still learning
              <span className="ml-1.5 text-[10px] opacity-40">←</span>
            </Button>
            <Button className="flex-1" onClick={markKnown}>
              Knew it
              <span className="ml-1.5 text-[10px] opacity-60">→</span>
            </Button>
          </div>

          <p className="mt-4 text-center text-[10px] text-muted-foreground/40">
            space to flip · ← still learning · → knew it
          </p>
        </>
      )}

      {/* Flashcard — type mode */}
      {currentCardMode === "type" && (
        <>
          <div className="rounded-2xl border border-border bg-card px-8 py-8">
            <p className="mb-4 text-[10px] font-medium uppercase tracking-[0.15em] text-primary/70 text-center">
              Question
            </p>
            <p className="text-lg font-medium leading-relaxed text-foreground text-center">
              {currentCard.front}
            </p>

            {!answerSubmitted ? (
              <div className="mt-6">
                <textarea
                  autoFocus
                  value={typedAnswer}
                  onChange={(e) => setTypedAnswer(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (typedAnswer.trim()) setAnswerSubmitted(true);
                    }
                  }}
                  placeholder="Type your answer…"
                  rows={3}
                  className="w-full resize-none rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
                <Button
                  className="mt-3 w-full"
                  disabled={!typedAnswer.trim()}
                  onClick={() => setAnswerSubmitted(true)}
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

          {answerSubmitted && (
            <div className="mt-5 flex gap-3">
              <Button
                variant="outline"
                className="flex-1 border-border text-muted-foreground hover:border-destructive/40 hover:bg-destructive/5 hover:text-destructive"
                onClick={markUnknown}
              >
                Still learning
                <span className="ml-1.5 text-[10px] opacity-40">←</span>
              </Button>
              <Button className="flex-1" onClick={markKnown}>
                Knew it
                <span className="ml-1.5 text-[10px] opacity-60">→</span>
              </Button>
            </div>
          )}

          {answerSubmitted && (
            <p className="mt-4 text-center text-[10px] text-muted-foreground/40">
              ← still learning · → knew it
            </p>
          )}
        </>
      )}

      {/* Flashcard — multiple choice mode */}
      {currentCardMode === "multiple-choice" && (
        <>
          <div className="rounded-2xl border border-border bg-card px-8 py-8">
            <p className="mb-4 text-[10px] font-medium uppercase tracking-[0.15em] text-primary/70 text-center">
              Question
            </p>
            <p className="text-lg font-medium leading-relaxed text-foreground text-center">
              {currentCard.front}
            </p>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-2">
            {(mcOptions[currentCard.id] ?? []).map((option, idx) => {
              const isCorrect = option === currentCard.back;
              const isSelected = selectedMcOption === option;
              const revealed = selectedMcOption !== null;

              let buttonClass =
                "w-full rounded-xl border px-4 py-3 text-left text-sm transition-colors focus:outline-none";

              if (!revealed) {
                buttonClass +=
                  " border-border text-foreground hover:border-primary/50 hover:bg-muted/50";
              } else if (isCorrect) {
                buttonClass += " border-green-500/50 bg-green-500/10 text-green-700 dark:text-green-400";
              } else if (isSelected) {
                buttonClass += " border-destructive/50 bg-destructive/10 text-destructive";
              } else {
                buttonClass += " border-border/40 text-muted-foreground opacity-50";
              }

              return (
                <button
                  key={idx}
                  disabled={revealed}
                  className={buttonClass}
                  onClick={() => {
                    if (revealed) return;
                    setSelectedMcOption(option);
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

          {selectedMcOption && (
            <div className="mt-5 flex gap-3">
              <Button
                className="flex-1"
                onClick={() => selectedMcOption === currentCard.back ? markKnown() : markUnknown()}
              >
                Continue
                <span className="ml-1.5 text-[10px] opacity-60">→</span>
              </Button>
            </div>
          )}

          <p className="mt-4 text-center text-[10px] text-muted-foreground/40">
            {selectedMcOption ? "enter or → to continue" : "1 · 2 · 3 · 4 to select"}
          </p>
        </>
      )}

      {modeModal}
    </div>
  );
}
