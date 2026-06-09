"use client";

import { useEffect, useState, useCallback, useRef, useId } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { CardText } from "@/components/card-text";
import { Button } from "@/components/ui/button";
import { ChallengeSheet } from "@/components/challenge-sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DndContext,
  closestCenter,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Database } from "@/lib/database.types";
import type { DeckStatsResult } from "@/lib/services/stats";

type Deck = Database["public"]["Tables"]["decks"]["Row"];
type Card = Database["public"]["Tables"]["cards"]["Row"];

type StudyState = "idle" | "studying" | "done";
type ContentFilter = "fresh" | "practiced" | "mix";
type AnswerMode = "flip" | "type" | "multiple-choice" | "random";
type ResolvedMode = "flip" | "type" | "multiple-choice";

function AutoTextarea({ value, onChange, className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, [value]);
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={onChange}
      rows={1}
      className={className}
      style={{ overflow: "hidden", resize: "none" }}
      {...props}
    />
  );
}

function FlagButton({ flagged, onToggle }: { flagged: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      className="absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-muted/40"
      title={flagged ? "Remove flag" : "Flag for review"}
    >
      <svg
        className="h-4 w-4"
        viewBox="0 0 24 24"
        fill={flagged ? "oklch(0.65 0.18 30)" : "none"}
        stroke={flagged ? "oklch(0.65 0.18 30)" : "oklch(0.55 0.01 65 / 0.7)"}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
        <line x1="4" y1="22" x2="4" y2="15" />
      </svg>
    </button>
  );
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

function isFresh(card: Card): boolean {
  return card.times_seen === 0;
}

function gradeTypeAnswer(userAnswer: string, correct: string): boolean {
  const norm = (s: string) => s.trim().toLowerCase();
  return (
    norm(userAnswer) === norm(correct) ||
    norm(correct).includes(norm(userAnswer)) ||
    norm(userAnswer).includes(norm(correct))
  );
}

interface CardRowProps {
  card: Card;
  isEditing: boolean;
  isDeleting: boolean;
  isSaving: boolean;
  isDeletingInProgress: boolean;
  isNew?: boolean;
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
  dragListeners?: Record<string, unknown>;
  dragAttributes?: Record<string, unknown>;
}

function CardRow({
  card,
  isEditing,
  isDeleting,
  isSaving,
  isDeletingInProgress,
  isNew = false,
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
  dragListeners,
  dragAttributes,
}: CardRowProps) {
  if (isEditing) {
    return (
      <div
        className="rounded-xl border bg-card px-4 py-3 space-y-2"
        style={{ borderColor: "color-mix(in oklch, var(--dashboard-accent-teal) 40%, transparent)" }}
        onBlur={(e) => {
          if (!isSaving && !e.currentTarget.contains(e.relatedTarget as Node)) {
            onEditSave(card.id);
          }
        }}
      >
        <AutoTextarea
          autoFocus
          value={editFront}
          onChange={(e) => onEditFrontChange(e.target.value)}
          placeholder="Front (question)"
          onKeyDown={(e) => { if (e.key === "Escape") onEditCancel(); }}
          className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        <AutoTextarea
          value={editBack}
          onChange={(e) => onEditBackChange(e.target.value)}
          placeholder="Back (answer)"
          onKeyDown={(e) => { if (e.key === "Escape") onEditCancel(); }}
          className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        <p className="text-[10px] text-muted-foreground/40">Tab to switch fields · Esc to cancel · click away to save</p>
      </div>
    );
  }

  if (isDeleting) {
    return (
      <div
        className="rounded-xl border bg-card px-4 py-3"
        style={{ borderColor: "oklch(0.55 0.2 27 / 0.35)" }}
      >
        <CardText text={card.front} className="text-sm font-medium text-foreground break-words" />
        <CardText text={card.back} className="mt-1.5 text-sm text-muted-foreground/80 break-words" />
        <div className="mt-3 flex items-center gap-2.5">
          <p className="text-xs text-muted-foreground/70">Delete this card?</p>
          <button
            disabled={isDeletingInProgress}
            onClick={() => onDeleteConfirm(card.id)}
            className="rounded-lg px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50"
            style={{ background: "oklch(0.55 0.2 27 / 0.12)", border: "1px solid oklch(0.55 0.2 27 / 0.4)", color: "oklch(0.75 0.18 27)" }}
          >
            {isDeletingInProgress ? "Deleting..." : "Confirm"}
          </button>
          <button
            onClick={onDeleteCancel}
            className="rounded-lg px-2.5 py-1 text-xs font-medium text-muted-foreground/70 transition-colors hover:text-foreground"
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
      className={`group rounded-xl border bg-card px-4 py-3 flex items-start gap-3${dragListeners ? " cursor-grab active:cursor-grabbing" : ""}`}
      style={{
        borderColor:
          "color-mix(in oklch, var(--dashboard-accent-teal) 30%, transparent)",
        boxShadow: isNew
          ? "0 0 0 2px color-mix(in oklch, var(--dashboard-accent-teal) 65%, transparent)"
          : "none",
        transition: "box-shadow 0.8s ease-out",
      }}
      {...(dragListeners as React.HTMLAttributes<HTMLDivElement> | undefined)}
      {...(dragAttributes as React.HTMLAttributes<HTMLDivElement> | undefined)}
    >
      <div className="flex-1 min-w-0">
        <CardText text={card.front} className="text-sm font-medium text-foreground break-words" />
        <CardText text={card.back} className="mt-1.5 text-sm text-muted-foreground/80 break-words" />
      </div>
      <div className="flex items-center gap-1 shrink-0 opacity-100 transition-opacity duration-200 sm:opacity-0 sm:group-hover:opacity-100">
        <button
          onClick={() => onEditStart(card)}
          className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors"
          style={{
            color:
              "color-mix(in oklch, var(--dashboard-accent-teal-strong) 72%, var(--muted-foreground) 28%)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background =
              "color-mix(in oklch, var(--dashboard-accent-teal) 12%, transparent)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
          }}
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

function SortableCardRow(props: CardRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: props.card.id });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        zIndex: isDragging ? 10 : undefined,
        position: "relative",
      }}
    >
      <CardRow {...props} dragListeners={listeners as unknown as Record<string, unknown>} dragAttributes={attributes as unknown as Record<string, unknown>} />
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
        <div className="grid grid-cols-2 gap-3 border-t border-border/30 px-4 pb-4 pt-3 sm:grid-cols-4">
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
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50">Seen</p>
            <p className="font-heading mt-0.5 text-lg font-bold tabular-nums text-foreground">
              {stats.seen} / {totalCards}
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
  const [deckStats, setDeckStats] = useState<DeckStatsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [challengeOpen, setChallengeOpen] = useState(false);

  const [showAddCard, setShowAddCard] = useState(false);
  const [cardFront, setCardFront] = useState("");
  const [cardBack, setCardBack] = useState("");
  const [cardTags, setCardTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [addingCard, setAddingCard] = useState(false);
  const [addCardError, setAddCardError] = useState<string | null>(null);
  const [generatingAnswer, setGeneratingAnswer] = useState(false);
  const tagInputRef = useRef<HTMLInputElement>(null);

  const [studyState, setStudyState] = useState<StudyState>("idle");
  const [contentFilter, setContentFilter] = useState<ContentFilter>("mix");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState<Set<string>>(new Set());
  const [unknown, setUnknown] = useState<Set<string>>(new Set());
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const sessionSavedRef = useRef(false);
  const [cardHistory, setCardHistory] = useState<{ index: number; wasKnown: boolean | null }[]>([]);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const [cardsOpen, setCardsOpen] = useState(true);

  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [deletingCardId, setDeletingCardId] = useState<string | null>(null);
  const [editFront, setEditFront] = useState("");
  const [editBack, setEditBack] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingInProgress, setDeletingInProgress] = useState<string | null>(null);
  const [showStudyEdit, setShowStudyEdit] = useState(false);

  const [expanding, setExpanding] = useState(false);
  const [newCardIds, setNewCardIds] = useState<Set<string>>(new Set());
  const [expandError, setExpandError] = useState<string | null>(null);

  const [flaggedIds, setFlaggedIds] = useState<Set<string>>(new Set());

  const [isPublic, setIsPublic] = useState(false);
  const [togglingPublic, setTogglingPublic] = useState(false);

  const [showDeleteDeck, setShowDeleteDeck] = useState(false);

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState("");

  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionInput, setDescriptionInput] = useState("");

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } })
  );

  const [activeQueue, setActiveQueue] = useState<Card[]>([]);

  const [showModeModal, setShowModeModal] = useState(false);
  const [answerMode, setAnswerMode] = useState<AnswerMode | null>(null);
  const [typedAnswer, setTypedAnswer] = useState("");
  const [answerSubmitted, setAnswerSubmitted] = useState(false);
  const [typeAiGrading, setTypeAiGrading] = useState(false);
  const [typeGradeResult, setTypeGradeResult] = useState<boolean | null>(null);
  const [selectedMcOption, setSelectedMcOption] = useState<string | null>(null);
  const [cardModes, setCardModes] = useState<Record<string, ResolvedMode>>({});
  const [mcOptions, setMcOptions] = useState<Record<string, string[]>>({});
  const [generatingMc, setGeneratingMc] = useState(false);
  const pendingModeRef = useRef<AnswerMode | null>(null);

  useEffect(() => {
    if (!generatingMc) return;
    let cancelled = false;
    async function poll() {
      let attempts = 0;
      while (!cancelled && attempts < 15) {
        await new Promise(r => setTimeout(r, 2000));
        if (cancelled) break;
        const res = await fetch(`/api/decks/${id}`);
        if (!res.ok || cancelled) break;
        const { cards: fresh } = await res.json();
        if (cancelled) break;
        setAllCards(fresh);
        attempts++;
        if (!fresh.some((c: Card) => c.mc_status === "pending")) {
          setGeneratingMc(false);
          const mode = pendingModeRef.current;
          pendingModeRef.current = null;
          if (mode) launchStudy(mode, fresh);
          break;
        }
      }
      if (!cancelled && attempts >= 15) {
        setGeneratingMc(false);
        const mode = pendingModeRef.current;
        pendingModeRef.current = null;
        if (mode) launchStudy(mode, allCards);
      }
    }
    poll();
    return () => { cancelled = true; };
  }, [generatingMc, id]);

  useEffect(() => {
    async function load() {
      const [deckRes, profileRes] = await Promise.all([
        fetch(`/api/decks/${id}`),
        fetch("/api/profile"),
      ]);
      if (!deckRes.ok) {
        const { error } = await deckRes.json();
        setError(error ?? "Deck not found");
      } else {
        const { deck, cards, deckStats } = await deckRes.json() as { deck: Deck; cards: Card[]; deckStats: DeckStatsResult };
        setDeck(deck);
        setIsPublic((deck as any).is_public ?? false);
        setAllCards(cards);
        setFlaggedIds(new Set(cards.filter((c: Card) => c.flagged).map((c: Card) => c.id)));
        setDeckStats(deckStats ?? null);
      }
      if (profileRes.ok) {
        const profile = await profileRes.json() as { default_study_mode?: string };
        const saved = profile.default_study_mode;
        setAnswerMode((saved === "flip" || saved === "type") ? saved : "flip");
      } else {
        setAnswerMode("flip");
      }
      setLoading(false);
    }
    load();
  }, [id]);

  const allTags = [...new Set(deck?.topic_tags ?? [])];
  const freshCards = allCards.filter(isFresh);
  const practicedCards = allCards.filter((c) => !isFresh(c));
  const studyQueue =
    contentFilter === "fresh" ? freshCards
    : contentFilter === "practiced" ? [...practicedCards].sort((a, b) => {
        const accA = a.times_seen > 0 ? a.times_correct / a.times_seen : 0;
        const accB = b.times_seen > 0 ? b.times_correct / b.times_seen : 0;
        return accA - accB;
      })
    : [...allCards].sort(() => Math.random() - 0.5);
  const currentCard = studyState === "studying" ? activeQueue[currentIndex] : studyQueue[currentIndex];
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
    const prevCard = activeQueue[last.index];
    if (prevCard) {
      if (last.wasKnown === true) setKnown((prev) => { const s = new Set(prev); s.delete(prevCard.id); return s; });
      if (last.wasKnown === false) setUnknown((prev) => { const s = new Set(prev); s.delete(prevCard.id); return s; });
    }
    setCardHistory((h) => h.slice(0, -1));
    setCurrentIndex(last.index);
    setFlipped(false);
    setTypedAnswer("");
    setAnswerSubmitted(false);
    setTypeAiGrading(false);
    setTypeGradeResult(null);
    setSelectedMcOption(null);
    if (studyState === "done") setStudyState("studying");
  }

  async function toggleFlag(cardId: string) {
    const next = !flaggedIds.has(cardId);
    setFlaggedIds((prev) => {
      const s = new Set(prev);
      if (next) s.add(cardId); else s.delete(cardId);
      return s;
    });
    await fetch(`/api/cards/${cardId}/flag`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ flagged: next }),
    });
  }

  async function handleTypeSubmit() {
    if (answerSubmitted || !typedAnswer.trim() || !currentCard) return;
    setAnswerSubmitted(true);

    const heuristic = gradeTypeAnswer(typedAnswer, currentCard.back);
    if (heuristic) {
      setTypeGradeResult(true);
      return;
    }

    setTypeAiGrading(true);
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
      const data = await res.json();
      setTypeGradeResult(data.correct === true);
    } catch {
      setTypeGradeResult(false);
    } finally {
      setTypeAiGrading(false);
    }
  }

  function advance() {
    setTypedAnswer("");
    setAnswerSubmitted(false);
    setTypeAiGrading(false);
    setTypeGradeResult(null);
    setSelectedMcOption(null);
    if (currentIndex + 1 >= activeQueue.length) {
      setStudyState("done");
    } else {
      setCurrentIndex((i) => i + 1);
      setFlipped(false);
    }
  }

  function startStudy(answerModeOverride: AnswerMode = answerMode ?? "flip") {
    const needsMc = answerModeOverride === "multiple-choice" || answerModeOverride === "random";
    const hasPending = needsMc && allCards.some(c => c.mc_status === "pending" || c.mc_status === "failed");
    if (hasPending) {
      pendingModeRef.current = answerModeOverride;
      setShowModeModal(false);
      setGeneratingMc(true);
      return;
    }
    launchStudy(answerModeOverride, allCards);
  }

  function launchStudy(answerModeOverride: AnswerMode, cards: Card[]) {
    sessionSavedRef.current = false;
    setCurrentIndex(0);
    setFlipped(false);
    setKnown(new Set());
    setUnknown(new Set());
    setCardHistory([]);
    setStartedAt(new Date().toISOString());
    setTypedAnswer("");
    setAnswerSubmitted(false);
    setTypeAiGrading(false);
    setTypeGradeResult(null);
    setSelectedMcOption(null);
    setAnswerMode(answerModeOverride);
    setShowModeModal(false);

    const fresh = cards.filter(isFresh);
    const practiced = cards.filter(c => !isFresh(c));

    // Capture the queue once — prevents re-renders from reshuffling it mid-session
    const capturedQueue: Card[] =
      contentFilter === "fresh"
        ? fresh
        : contentFilter === "practiced"
        ? [...practiced].sort((a, b) => {
            const accA = a.times_seen > 0 ? a.times_correct / a.times_seen : 0;
            const accB = b.times_seen > 0 ? b.times_correct / b.times_seen : 0;
            return accA - accB;
          })
        : [...cards].sort(() => Math.random() - 0.5);
    setActiveQueue(capturedQueue);

    const fixedModes: ResolvedMode[] = ["flip", "type", "multiple-choice"];
    const resolvedModes: Record<string, ResolvedMode> = {};
    const resolvedMcOptions: Record<string, string[]> = {};

    capturedQueue.forEach((card) => {
      let cardMode: ResolvedMode =
        answerModeOverride === "random"
          ? fixedModes[Math.floor(Math.random() * fixedModes.length)]
          : (answerModeOverride as ResolvedMode);

      if (cardMode === "multiple-choice" && (cards.length < 2 || card.mc_status !== "ready")) {
        cardMode = "flip";
      }

      resolvedModes[card.id] = cardMode;

      if (cardMode === "multiple-choice") {
        resolvedMcOptions[card.id] = generateMcOptions(cards, card);
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
    if (!editFront.trim() || !editBack.trim()) { cancelEdit(); return; }
    setSavingEdit(true);
    const res = await fetch(`/api/cards/${cardId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ front: editFront.trim(), back: editBack.trim() }),
    });
    setSavingEdit(false);
    if (res.ok) {
      const updated = { front: editFront.trim(), back: editBack.trim() };
      setAllCards((prev) => prev.map((c) => c.id === cardId ? { ...c, ...updated } : c));
      setActiveQueue((prev) => prev.map((c) => c.id === cardId ? { ...c, ...updated } : c));
      cancelEdit();
    }
  }

  async function handleConfirmDelete(cardId: string) {
    setDeletingInProgress(cardId);
    const res = await fetch(`/api/cards/${cardId}`, { method: "DELETE" });
    setDeletingInProgress(null);
    if (res.ok) {
      setAllCards((prev) => prev.filter((c) => c.id !== cardId));
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
    setDeck((prev) => prev ? { ...prev, card_count: prev.card_count + 1 } : prev);
    setCardFront("");
    setCardBack("");
    setCardTags([]);
    setTagInput("");
    setShowAddCard(false);
  }

  async function handleExpand() {
    if (!deck) return;
    setExpanding(true);
    setExpandError(null);
    try {
      const res = await fetch(`/api/decks/${deck.id}/expand`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setExpandError(data.error ?? "Expansion failed");
        return;
      }
      const newCards: Card[] = data.cards;
      setAllCards((prev) => [...prev, ...newCards]);
      setDeck((prev) =>
        prev ? { ...prev, card_count: prev.card_count + newCards.length } : prev
      );
      const ids = new Set<string>(newCards.map((c) => c.id));
      setNewCardIds(ids);
      setTimeout(() => setNewCardIds(new Set()), 2000);
    } catch {
      setExpandError("Expansion failed. Please try again.");
    } finally {
      setExpanding(false);
    }
  }

  async function handleGenerateAnswer() {
    if (!cardFront.trim() || !deck) return;
    setGeneratingAnswer(true);
    setCardBack("");
    try {
      const res = await fetch("/api/cards/generate-answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: cardFront.trim(),
          deckTitle: deck.title,
          tags: deck.topic_tags ?? [],
        }),
      });
      if (!res.ok || !res.body) return;
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let text = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        setCardBack(text);
      }
    } finally {
      setGeneratingAnswer(false);
    }
  }

  async function handleSaveTitle() {
    const trimmed = titleInput.trim();
    setEditingTitle(false);
    if (!trimmed || !deck || trimmed === deck.title) return;
    const res = await fetch(`/api/decks/${deck.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: trimmed }),
    });
    if (res.ok) {
      setDeck((prev) => prev ? { ...prev, title: trimmed } : prev);
    }
  }

  async function handleSaveDescription() {
    const description = descriptionInput.trim() || null;
    setEditingDescription(false);
    if (!deck || description === deck.description) return;
    const res = await fetch(`/api/decks/${deck.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description }),
    });
    if (res.ok) {
      setDeck((prev) => prev ? { ...prev, description } : prev);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = allCards.findIndex((c) => c.id === active.id);
    const newIdx = allCards.findIndex((c) => c.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    const reordered = arrayMove(allCards, oldIdx, newIdx);
    setAllCards(reordered);
    fetch(`/api/decks/${id}/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardIds: reordered.map((c) => c.id) }),
    });
  }

  async function handleDeleteDeck() {
    if (!deck) return;
    await fetch(`/api/decks/${deck.id}`, { method: "DELETE" });
    router.push("/");
  }

  async function handleTogglePublic() {
    setTogglingPublic(true);
    const next = !isPublic;
    const res = await fetch(`/api/decks/${deck?.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_public: next }),
    });
    if (res.ok) {
      setIsPublic(next);
    } else {
      const data = await res.json().catch(() => ({}));
      setError((data as { error?: string }).error ?? "Failed to update visibility");
    }
    setTogglingPublic(false);
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
      if (showStudyEdit) return;
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
    showStudyEdit,
  ]);

  useEffect(() => {
    if (studyState !== "done" || !deck || !startedAt || sessionSavedRef.current) return;
    sessionSavedRef.current = true;
    const score = known.size;
    const results = activeQueue
      .filter((c) => known.has(c.id) || unknown.has(c.id))
      .map((c) => ({ cardId: c.id, correct: known.has(c.id) }));
    fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deckId: deck.id, score, startedAt, results }),
    });
  }, [studyState, deck, startedAt, known, unknown, activeQueue]);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10 space-y-4">
        <div className="h-7 w-56 rounded-lg bg-card/80 animate-pulse" />
        <div className="h-4 w-28 rounded-lg bg-card/60 animate-pulse" />
        <div className="mt-8 h-80 rounded-2xl bg-card/60 animate-pulse" />
      </div>
    );
  }

  if (error || !deck) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
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
            Start session
          </DialogTitle>
        </DialogHeader>

        {/* Content filter */}
        <div className="mt-3">
          <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground/60">What to study</p>
          <div className="grid grid-cols-3 gap-2">
            {([
              { filter: "fresh" as ContentFilter, label: "Fresh", description: `${freshCards.length} unseen` },
              { filter: "practiced" as ContentFilter, label: "Practiced", description: `${practicedCards.length} seen`, },
              { filter: "mix" as ContentFilter, label: "Mix", description: "Everything" },
            ]).map(({ filter, label, description }) => (
              <button
                key={filter}
                onClick={() => setContentFilter(filter)}
                className={`rounded-xl border p-3 text-left transition-colors focus:outline-none ${
                  contentFilter === filter
                    ? "border-primary/50 bg-primary/10"
                    : "border-border hover:border-primary/30 hover:bg-muted/40"
                }`}
              >
                <p className="font-heading text-sm font-semibold text-foreground">{label}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground/70">{description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Answer mode */}
        <div className="mt-4">
          <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground/60">How to answer</p>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { mode: "flip" as AnswerMode, label: "Flip card", description: "Reveal & self-assess" },
                { mode: "type" as AnswerMode, label: "Type answer", description: "Write it out" },
                { mode: "multiple-choice" as AnswerMode, label: "Multiple choice", description: "Pick from options", disabled: allCards.length < 2 },
                { mode: "random" as AnswerMode, label: "Random", description: "Mix it up" },
              ] as Array<{ mode: AnswerMode; label: string; description: string; disabled?: boolean }>
            ).map(({ mode, label, description, disabled }) => (
              <button
                key={mode}
                disabled={disabled}
                onClick={() => setAnswerMode(mode)}
                className={`rounded-xl border p-3 text-left transition-colors ${
                  disabled
                    ? "cursor-not-allowed border-border/40 opacity-40"
                    : (answerMode ?? "flip") === mode
                    ? "border-primary/50 bg-primary/10"
                    : "border-border hover:border-primary/30 hover:bg-muted/40 focus:outline-none"
                }`}
              >
                <p className="font-heading text-sm font-semibold text-foreground">{label}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{description}</p>
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => startStudy(answerMode ?? "flip")}
          disabled={studyQueue.length === 0}
          className="mt-4 w-full rounded-xl bg-primary py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {studyQueue.length === 0 ? "No cards to study" : `Start · ${studyQueue.length} ${studyQueue.length === 1 ? "card" : "cards"}`}
        </button>
      </DialogContent>
    </Dialog>
  );

  // ── Generating MC distractors overlay ────────────────────────────────────
  if (generatingMc) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-card px-10 py-8 shadow-xl">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
          <p className="text-sm font-medium text-foreground">Generating multiple choice questions…</p>
          <p className="text-xs text-muted-foreground">This only happens once per deck</p>
        </div>
      </div>
    );
  }

  // ── Idle — deck overview ──────────────────────────────────────────────────
  if (studyState === "idle") {
    const totalFresh = allCards.filter(isFresh).length;
    const totalPracticed = allCards.length - totalFresh;

    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10 animate-fade-up">
        <ChallengeSheet
          open={challengeOpen}
          onClose={() => setChallengeOpen(false)}
          deckId={id}
          deckTitle={deck?.title ?? ""}
          cards={allCards}
        />
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
          {editingTitle ? (
            <input
              autoFocus
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              onBlur={handleSaveTitle}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); handleSaveTitle(); }
                if (e.key === "Escape") setEditingTitle(false);
              }}
              className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl w-full bg-transparent border-b-2 border-primary/50 focus:outline-none pb-0.5"
            />
          ) : (
            <div className="group flex items-center gap-2">
              <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                {deck.title}
              </h1>
              <button
                type="button"
                onClick={() => { setTitleInput(deck.title); setEditingTitle(true); }}
                className="flex h-7 w-7 items-center justify-center rounded-lg opacity-0 transition-all group-hover:opacity-100 hover:bg-muted/40"
                title="Rename deck"
              >
                <svg className="h-3.5 w-3.5 text-muted-foreground/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                </svg>
              </button>
            </div>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <p className="text-sm text-muted-foreground/60">
              {deck.card_count} {deck.card_count === 1 ? "card" : "cards"}
            </p>
            <button
              onClick={handleTogglePublic}
              disabled={togglingPublic}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                isPublic
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border/50 bg-muted/30 text-muted-foreground hover:border-primary/30 hover:text-foreground"
              }`}
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                {isPublic ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" />
                )}
              </svg>
              {isPublic ? "Public" : "Private"}
            </button>
            {showDeleteDeck ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground/60">Delete deck?</span>
                <button
                  onClick={handleDeleteDeck}
                  className="rounded-full px-3 py-1 text-xs font-medium transition-colors"
                  style={{
                    background: "oklch(0.55 0.2 27 / 0.12)",
                    border: "1px solid oklch(0.55 0.2 27 / 0.4)",
                    color: "oklch(0.75 0.18 27)",
                  }}
                >
                  Confirm
                </button>
                <button
                  onClick={() => setShowDeleteDeck(false)}
                  className="rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground/60 hover:text-foreground transition-colors"
                  style={{ borderColor: "oklch(0.5 0.01 65 / 0.3)" }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowDeleteDeck(true)}
                className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors"
                style={{
                  background: "oklch(0.55 0.2 27 / 0.15)",
                  border: "1px solid oklch(0.55 0.2 27 / 0.4)",
                  color: "oklch(0.75 0.18 27)",
                }}
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete
              </button>
            )}
          </div>
        </div>

        {/* Per-deck stats */}
        {deckStats && deck && (
          <DeckStatsBar stats={deckStats} totalCards={deck.card_count} />
        )}

        {/* Tags */}
        {allTags.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {allTags.map((tag) => (
              <Link
                key={tag}
                href={`/tags/${encodeURIComponent(tag)}`}
                className="rounded-full px-3 py-1 text-xs font-medium transition-colors"
                style={{
                  border: "1px solid color-mix(in oklch, var(--dashboard-accent-coral) 38%, transparent)",
                  color: "color-mix(in oklch, var(--dashboard-accent-coral) 78%, var(--muted-foreground) 22%)",
                }}
              >
                {tag}
              </Link>
            ))}
          </div>
        )}

        {/* Description */}
        <div className="mb-6">
          {editingDescription ? (
            <textarea
              autoFocus
              value={descriptionInput}
              onChange={(e) => setDescriptionInput(e.target.value)}
              onBlur={handleSaveDescription}
              onKeyDown={(e) => {
                if (e.key === "Escape") setEditingDescription(false);
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleSaveDescription(); }
              }}
              rows={3}
              placeholder="Add a description…"
              className="w-full max-w-xl resize-none rounded-lg border border-primary/30 bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          ) : (
            <div
              className="group flex cursor-pointer items-start gap-2"
              onClick={() => { setDescriptionInput(deck.description ?? ""); setEditingDescription(true); }}
            >
              <p className={`max-w-xl text-sm leading-relaxed ${deck.description ? "text-muted-foreground/70" : "text-muted-foreground/30 italic"}`}>
                {deck.description ?? "Add a description…"}
              </p>
              <svg
                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/30 opacity-0 transition-opacity group-hover:opacity-100"
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
              </svg>
            </div>
          )}
        </div>

        {/* Cards for selected tag */}
        <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-card p-6">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-heading text-base font-semibold text-foreground">Start session</p>
              <p className="mt-0.5 text-sm text-muted-foreground/70">
                {allCards.filter(isFresh).length} fresh · {allCards.filter((c) => !isFresh(c)).length} practiced
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-3">
              <Button
                onClick={() => setShowModeModal(true)}
                size="lg"
                disabled={allCards.length === 0}
                className="w-full sm:w-auto"
              >
                Start session
              </Button>
              <Link
                href={`/quiz/${id}`}
                className="w-full sm:w-auto inline-flex items-center justify-center whitespace-nowrap rounded-lg h-9 px-2.5 text-sm font-medium transition-colors"
                style={{
                  border:
                    "1px solid color-mix(in oklch, var(--dashboard-accent-teal) 45%, transparent)",
                  color: "var(--dashboard-accent-teal-strong)",
                  background:
                    "color-mix(in oklch, var(--dashboard-accent-teal) 0%, transparent)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background =
                    "color-mix(in oklch, var(--dashboard-accent-teal) 9%, transparent)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background =
                    "color-mix(in oklch, var(--dashboard-accent-teal) 0%, transparent)";
                }}
              >
                Take a quiz
              </Link>
              <Button
                variant="outline"
                size="lg"
                className="w-full sm:w-auto"
                onClick={() => setChallengeOpen(true)}
                disabled={allCards.length === 0}
              >
                Challenge
              </Button>
            </div>
          </div>
        </div>
        {/* Add card section */}
        <div className="mt-8">
          {!showAddCard ? (
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => { setShowAddCard(true); setAddCardError(null); }}
                disabled={expanding}
                className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-medium transition-colors hover:bg-[oklch(0.77_0.195_68_/_0.08)] disabled:opacity-40"
                style={{
                  border:
                    "1px solid color-mix(in oklch, var(--dashboard-accent-amber) 45%, transparent)",
                  color:
                    "color-mix(in oklch, var(--dashboard-accent-amber) 75%, var(--foreground) 25%)",
                }}
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Add card
              </button>
              <button
                onClick={handleExpand}
                disabled={expanding}
                className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-medium transition-colors hover:bg-[oklch(0.7_0.19_173_/_0.08)] disabled:opacity-40"
                style={{
                  border: "1px solid color-mix(in oklch, var(--dashboard-accent-teal) 45%, transparent)",
                  color: "color-mix(in oklch, var(--dashboard-accent-teal) 75%, var(--foreground) 25%)",
                }}
              >
                {expanding ? (
                  <>
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Generating cards…
                  </>
                ) : (
                  <>
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                    </svg>
                    Expand with AI
                  </>
                )}
              </button>
              {expandError && (
                <p className="w-full text-xs text-destructive">{expandError}</p>
              )}
            </div>
          ) : (
            <form onSubmit={handleAddCard} className="space-y-3 rounded-2xl border border-border/50 bg-card p-5">
              <p className="font-heading text-sm font-semibold text-foreground">Add a card</p>
              <AutoTextarea
                autoFocus
                value={cardFront}
                onChange={(e) => setCardFront(e.target.value)}
                placeholder="Front (question)"
                className="w-full rounded-xl border border-border bg-muted/30 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <div className="space-y-1">
                <AutoTextarea
                  value={cardBack}
                  onChange={(e) => setCardBack(e.target.value)}
                  placeholder="Back (answer)"
                  className="w-full rounded-xl border border-border bg-muted/30 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
                {cardFront.trim() && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleGenerateAnswer}
                      disabled={generatingAnswer}
                      className="flex items-center gap-1 text-[11px] font-medium transition-opacity disabled:opacity-40 hover:opacity-70"
                      style={{ color: "var(--primary)" }}
                    >
                      {generatingAnswer ? (
                        <>
                          <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                          </svg>
                          Generating…
                        </>
                      ) : (
                        <>
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                          </svg>
                          Generate with AI
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

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
        {allCards.length > 0 && (
          <div className="mt-8 rounded-xl border border-border/40 bg-card/40">
            <button
              onClick={() => setCardsOpen((v) => !v)}
              className="flex w-full items-center justify-between px-4 py-3 text-left"
            >
              <div className="flex items-center gap-2">
                <span
                  className="text-[10px] font-medium uppercase tracking-[0.15em]"
                  style={{
                    color:
                      "color-mix(in oklch, var(--dashboard-accent-coral) 70%, var(--muted-foreground) 30%)",
                  }}
                >
                  {allCards.length} {allCards.length === 1 ? "card" : "cards"}
                </span>
                <span className="text-[10px] text-muted-foreground/40">· drag to reorder</span>
              </div>
              <svg
                className={`h-3.5 w-3.5 text-muted-foreground/40 transition-transform duration-200 ${cardsOpen ? "rotate-180" : ""}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {cardsOpen && (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={allCards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2 border-t border-border/30 px-4 pb-4 pt-3">
                    {allCards.map((card) => (
                      <SortableCardRow
                        key={card.id}
                        card={card}
                        isEditing={editingCardId === card.id}
                        isDeleting={deletingCardId === card.id}
                        isSaving={savingEdit && editingCardId === card.id}
                        isDeletingInProgress={deletingInProgress === card.id}
                        isNew={newCardIds.has(card.id)}
                        editFront={editFront}
                        editBack={editBack}
                        onEditFrontChange={setEditFront}
                        onEditBackChange={setEditBack}
                        onEditStart={startEditCard}
                        onEditSave={handleSaveEdit}
                        onEditCancel={cancelEdit}
                        onDeleteStart={(cardId) => { setDeletingCardId(cardId); setEditingCardId(null); }}
                        onDeleteConfirm={handleConfirmDelete}
                        onDeleteCancel={() => setDeletingCardId(null)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
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
    const pct = activeQueue.length > 0 ? Math.round((knownCount / activeQueue.length) * 100) : 0;

    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10 animate-fade-up">
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
          <Button onClick={() => setShowModeModal(true)}>
            Retest all
          </Button>
        </div>
        {modeModal}
      </div>
    );
  }

  // ── Studying ──────────────────────────────────────────────────────────────
  const progressPct = (currentIndex / activeQueue.length) * 100;

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <ChallengeSheet
        open={challengeOpen}
        onClose={() => setChallengeOpen(false)}
        deckId={id}
        deckTitle={deck?.title ?? ""}
        cards={allCards}
      />
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
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { startEditCard(currentCard); setShowStudyEdit(true); }}
            className="flex items-center gap-1 text-xs text-muted-foreground/40 transition-colors hover:text-muted-foreground"
            title="Edit this card"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
            </svg>
            Edit
          </button>
          <span className="font-heading text-sm font-semibold tabular-nums text-foreground">
            {currentIndex + 1}
            <span className="text-muted-foreground/50 font-normal"> / {activeQueue.length}</span>
          </span>
        </div>
      </div>

      {/* Study edit dialog */}
      <Dialog open={showStudyEdit} onOpenChange={(open) => { if (!open) { cancelEdit(); setShowStudyEdit(false); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading text-base font-semibold">Edit card</DialogTitle>
          </DialogHeader>
          <div className="mt-2 space-y-3">
            <AutoTextarea
              autoFocus
              value={editFront}
              onChange={(e) => setEditFront(e.target.value)}
              placeholder="Front (question)"
              className="w-full rounded-xl border border-border bg-muted/30 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <AutoTextarea
              value={editBack}
              onChange={(e) => setEditBack(e.target.value)}
              placeholder="Back (answer)"
              className="w-full rounded-xl border border-border bg-muted/30 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <div className="mt-4 flex gap-2">
            <Button
              size="sm"
              disabled={!editFront.trim() || !editBack.trim() || savingEdit}
              onClick={async () => { await handleSaveEdit(editingCardId!); setShowStudyEdit(false); }}
            >
              {savingEdit ? "Saving…" : "Save"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { cancelEdit(); setShowStudyEdit(false); }}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
            <FlagButton flagged={flaggedIds.has(currentCard.id)} onToggle={() => toggleFlag(currentCard.id)} />
            {/* Sizer: drives outer container height.
                Not flipped → min-h-72 only (front stays compact).
                Flipped → back content shown, grows if long. */}
            <div className="invisible pointer-events-none px-8 py-6 flex flex-col min-h-72" aria-hidden>
              {flipped && (
                <>
                  <p className="mb-4 text-[10px]">placeholder</p>
                  <CardText text={currentCard.back} className="text-lg leading-relaxed break-words" />
                </>
              )}
            </div>

            {/* 3D flip wrapper — absolutely covers the sizer */}
            <div
              className="absolute inset-0 transition-transform duration-500"
              style={{
                transformStyle: "preserve-3d",
                transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
              }}
            >
              {/* Front */}
              <div
                className="absolute inset-0 flex flex-col items-start rounded-2xl border border-border bg-card px-8 py-6 text-center overflow-hidden"
                style={{ backfaceVisibility: "hidden" }}
              >
                <p className="mb-4 w-full text-[10px] font-medium uppercase tracking-[0.15em] text-primary/70">
                  Question
                </p>
                <CardText text={currentCard.front} className="w-full text-lg font-medium leading-relaxed text-foreground break-words" />
                <p className="mt-auto pt-4 w-full text-[10px] text-muted-foreground/50">
                  tap or press space to reveal
                </p>
              </div>
              {/* Back */}
              <div
                className="absolute inset-0 flex flex-col items-start rounded-2xl border border-primary/20 bg-card px-8 py-6 text-center overflow-hidden"
                style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
              >
                <p className="mb-4 w-full text-[10px] font-medium uppercase tracking-[0.15em] text-primary/70">
                  Answer
                </p>
                <CardText text={currentCard.back} className="w-full text-lg leading-relaxed text-foreground break-words" />
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

          <p className="mt-4 text-center text-[10px] text-muted-foreground/40 hidden sm:block">
            space to flip · ← still learning · → knew it
          </p>
          {cardHistory.length > 0 && (
            <div className="mt-3 flex justify-center">
              <button
                onClick={goBack}
                className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors"
                style={{
                  border: "1px solid color-mix(in oklch, var(--dashboard-accent-teal) 45%, transparent)",
                  color: "var(--dashboard-accent-teal-strong)",
                  background: "color-mix(in oklch, var(--dashboard-accent-teal) 0%, transparent)",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "color-mix(in oklch, var(--dashboard-accent-teal) 10%, transparent)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "color-mix(in oklch, var(--dashboard-accent-teal) 0%, transparent)"; }}
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                </svg>
                Undo
              </button>
            </div>
          )}
        </>
      )}

      {/* Flashcard — type mode */}
      {currentCardMode === "type" && (
        <>
          <div className="relative rounded-2xl border border-border bg-card px-8 py-8">
            <FlagButton flagged={flaggedIds.has(currentCard.id)} onToggle={() => toggleFlag(currentCard.id)} />
            <p className="mb-4 text-[10px] font-medium uppercase tracking-[0.15em] text-primary/70 text-center">
              Question
            </p>
            <CardText text={currentCard.front} className="text-lg font-medium leading-relaxed text-foreground text-center" />

            {!answerSubmitted ? (
              <div className="mt-6">
                <textarea
                  autoFocus
                  value={typedAnswer}
                  onChange={(e) => setTypedAnswer(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (typedAnswer.trim()) handleTypeSubmit();
                    }
                  }}
                  placeholder="Type your answer…"
                  rows={3}
                  className="w-full resize-none rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
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
                    background: typeGradeResult === true
                      ? "color-mix(in oklch, var(--dashboard-accent-teal) 12%, transparent)"
                      : typeGradeResult === false
                      ? "color-mix(in oklch, var(--destructive) 10%, transparent)"
                      : "color-mix(in oklch, var(--muted) 40%, transparent)",
                    border: typeGradeResult === true
                      ? "1px solid color-mix(in oklch, var(--dashboard-accent-teal) 50%, transparent)"
                      : typeGradeResult === false
                      ? "1px solid color-mix(in oklch, var(--destructive) 40%, transparent)"
                      : "1px solid transparent",
                  }}
                >
                  <p
                    className="text-[10px] font-medium uppercase tracking-[0.12em]"
                    style={{
                      color: typeGradeResult === true
                        ? "var(--dashboard-accent-teal-strong)"
                        : typeGradeResult === false
                        ? "var(--destructive)"
                        : "var(--muted-foreground)",
                    }}
                  >
                    {typeAiGrading ? "Checking…" : typeGradeResult === true ? "Correct" : typeGradeResult === false ? "Incorrect" : "Your answer"}
                  </p>
                  <p className="mt-1 text-sm text-foreground">{typedAnswer}</p>
                </div>
                <div className="rounded-xl border border-primary/20 bg-card px-4 py-3">
                  <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-primary/70">
                    Correct answer
                  </p>
                  <CardText text={currentCard.back} className="mt-1 text-sm text-foreground" />
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
            <p className="mt-4 text-center text-[10px] text-muted-foreground/40 hidden sm:block">
              ← still learning · → knew it
            </p>
          )}
          {cardHistory.length > 0 && (
            <div className="mt-3 flex justify-center">
              <button
                onClick={goBack}
                className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors"
                style={{
                  border: "1px solid color-mix(in oklch, var(--dashboard-accent-teal) 45%, transparent)",
                  color: "var(--dashboard-accent-teal-strong)",
                  background: "color-mix(in oklch, var(--dashboard-accent-teal) 0%, transparent)",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "color-mix(in oklch, var(--dashboard-accent-teal) 10%, transparent)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "color-mix(in oklch, var(--dashboard-accent-teal) 0%, transparent)"; }}
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                </svg>
                Undo
              </button>
            </div>
          )}
        </>
      )}

      {/* Flashcard — multiple choice mode */}
      {currentCardMode === "multiple-choice" && (
        <>
          <div className="relative rounded-2xl border border-border bg-card px-8 py-8">
            <FlagButton flagged={flaggedIds.has(currentCard.id)} onToggle={() => toggleFlag(currentCard.id)} />
            <p className="mb-4 text-[10px] font-medium uppercase tracking-[0.15em] text-primary/70 text-center">
              Question
            </p>
            <CardText text={currentCard.front} className="text-lg font-medium leading-relaxed text-foreground text-center" />
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

          <p className="mt-4 text-center text-[10px] text-muted-foreground/40 hidden sm:block">
            {selectedMcOption ? "enter or → to continue" : "1 · 2 · 3 · 4 to select"}
          </p>
          {cardHistory.length > 0 && (
            <div className="mt-3 flex justify-center">
              <button
                onClick={goBack}
                className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors"
                style={{
                  border: "1px solid color-mix(in oklch, var(--dashboard-accent-teal) 45%, transparent)",
                  color: "var(--dashboard-accent-teal-strong)",
                  background: "color-mix(in oklch, var(--dashboard-accent-teal) 0%, transparent)",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "color-mix(in oklch, var(--dashboard-accent-teal) 10%, transparent)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "color-mix(in oklch, var(--dashboard-accent-teal) 0%, transparent)"; }}
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                </svg>
                Undo
              </button>
            </div>
          )}
        </>
      )}

      {modeModal}
    </div>
  );
}
