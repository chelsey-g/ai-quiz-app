"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { Database } from "@/lib/database.types";

type Card = Database["public"]["Tables"]["cards"]["Row"];
type ChallengeAttempt = Database["public"]["Tables"]["challenge_attempts"]["Row"];
type Challenge = Database["public"]["Tables"]["challenges"]["Row"];

type CardResult = { card_id: string; correct: boolean; chosen_answer: string; overridden?: boolean };
type ResolvedMode = "multiple-choice" | "type";
type Phase = "intro" | "study" | "quiz" | "done";

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

function buildOptions(allCards: Card[], target: Card): string[] {
  if (target.mc_status === "ready" && target.mc_distractors && target.mc_distractors.length >= 3) {
    return shuffleAnswers(target.back, target.mc_distractors);
  }
  const fallback = allCards
    .filter((c) => c.id !== target.id)
    .map((c) => c.back)
    .sort(() => Math.random() - 0.5);
  return shuffleAnswers(target.back, fallback);
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

function resolveCardModes(cards: Card[], quizMode: string): Record<string, ResolvedMode> {
  const modes: Record<string, ResolvedMode> = {};
  for (const card of cards) {
    if (quizMode === "random") {
      modes[card.id] = Math.random() < 0.5 ? "multiple-choice" : "type";
    } else if (quizMode === "type") {
      modes[card.id] = "type";
    } else {
      modes[card.id] = "multiple-choice";
    }
  }
  return modes;
}

function modeLabel(mode: string) {
  if (mode === "type") return "Type answer";
  if (mode === "random") return "Mixed";
  return "Multiple choice";
}

export default function ChallengPlayPage() {
  const { id: attemptId } = useParams<{ id: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState<ChallengeAttempt | null>(null);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [mcOptions, setMcOptions] = useState<Record<string, string[]>>({});
  const [cardModes, setCardModes] = useState<Record<string, ResolvedMode>>({});

  const [phase, setPhase] = useState<Phase>("intro");
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<CardResult[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [typedAnswer, setTypedAnswer] = useState("");
  const [answerSubmitted, setAnswerSubmitted] = useState(false);

  // Study phase state
  const [studyIndex, setStudyIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  // Fork to collection
  const [showFork, setShowFork] = useState(false);
  const [collections, setCollections] = useState<{ id: string; name: string }[]>([]);
  const [collectionsLoading, setCollectionsLoading] = useState(false);
  const [forking, setForking] = useState(false);
  const [forked, setForked] = useState(false);
  const [forkError, setForkError] = useState<string | null>(null);

  const savingRef = useRef(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/challenges/attempts/${attemptId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error); return; }
        setAttempt(d.attempt);
        setChallenge(d.challenge);
        const c: Card[] = d.cards ?? [];
        setCards(c);
        const modes = resolveCardModes(c, d.challenge?.quiz_mode ?? "multiple-choice");
        setCardModes(modes);
        const opts: Record<string, string[]> = {};
        c.forEach((card) => {
          if (modes[card.id] === "multiple-choice") {
            opts[card.id] = buildOptions(c, card);
          }
        });
        setMcOptions(opts);
        if (d.attempt.status === "completed") {
          setResults(d.attempt.card_results as CardResult[] ?? []);
          setPhase("done");
        }
      })
      .catch(() => setError("Failed to load challenge"))
      .finally(() => setLoading(false));
  }, [attemptId]);

  function startStudy() {
    setStudyIndex(0);
    setFlipped(false);
    setPhase("study");
  }

  function startQuiz() {
    setIndex(0);
    setResults([]);
    setSelected(null);
    setTypedAnswer("");
    setAnswerSubmitted(false);
    savingRef.current = false;
    setPhase("quiz");
  }

  function retakeQuiz(c: Card[]) {
    const modes = resolveCardModes(c, challenge?.quiz_mode ?? "multiple-choice");
    setCardModes(modes);
    const opts: Record<string, string[]> = {};
    c.forEach((card) => {
      if (modes[card.id] === "multiple-choice") opts[card.id] = buildOptions(c, card);
    });
    setMcOptions(opts);
    startQuiz();
  }

  const openForkPicker = useCallback(async () => {
    setShowFork(true);
    setCollectionsLoading(true);
    try {
      const res = await fetch("/api/collections");
      const data = await res.json();
      setCollections(data.collections ?? []);
    } catch {
      setCollections([]);
    } finally {
      setCollectionsLoading(false);
    }
  }, []);

  async function forkToCollection(collectionId: string) {
    setForking(true);
    setForkError(null);
    try {
      const res = await fetch(`/api/challenges/attempts/${attemptId}/fork`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collection_id: collectionId }),
      });
      if (res.ok) {
        setForked(true);
        setShowFork(false);
      } else {
        const d = await res.json().catch(() => ({}));
        setForkError(d.error ?? "Failed to save deck. Please try again.");
      }
    } catch {
      setForkError("Failed to save deck. Please try again.");
    } finally {
      setForking(false);
    }
  }

  function studyNext() {
    if (studyIndex + 1 >= cards.length) {
      startQuiz();
    } else {
      setStudyIndex((i) => i + 1);
      setFlipped(false);
    }
  }

  async function pickMC(option: string) {
    if (selected || !cards[index]) return;
    const card = cards[index];
    const correct = option === card.back;
    setSelected(option);
    await submitAnswer(card, correct, option);
  }

  async function submitType() {
    if (answerSubmitted || !cards[index]) return;
    const card = cards[index];
    const correct = gradeTypeAnswer(typedAnswer, card.back);
    setAnswerSubmitted(true);
    await submitAnswer(card, correct, typedAnswer);
  }

  async function submitAnswer(card: Card, correct: boolean, chosenAnswer: string) {
    const result: CardResult = { card_id: card.id, correct, chosen_answer: chosenAnswer };
    const newResults = [...results, result];
    setResults(newResults);

    const isFirst = newResults.length === 1 && attempt?.status === "pending";
    if (isFirst) {
      await fetch(`/api/challenges/attempts/${attemptId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "in_progress" }),
      });
    }

    const isLast = index + 1 >= cards.length;
    if (isLast && !savingRef.current) {
      savingRef.current = true;
      setSaving(true);
      const score = newResults.filter((r) => r.correct).length;
      const res = await fetch(`/api/challenges/attempts/${attemptId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed", score, total: cards.length, card_results: newResults }),
      });
      setSaving(false);
      if (!res.ok) setError("Failed to save your results. Please try again.");
      setPhase("done");
    } else {
      await fetch(`/api/challenges/attempts/${attemptId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ card_results: newResults }),
      });
    }
  }

  function advance() {
    setSelected(null);
    setTypedAnswer("");
    setAnswerSubmitted(false);
    setIndex((i) => i + 1);
  }

  // Lets the user override a wrong typed-answer grade they believe is correct.
  function overrideCurrentAnswer() {
    const card = cards[index];
    if (!card) return;
    setResults((prev) => {
      const idx = prev.length - 1;
      if (idx < 0 || prev[idx].card_id !== card.id) return prev;
      const next = [...prev];
      next[idx] = { ...next[idx], correct: true, overridden: true };
      return next;
    });
    fetch(`/api/challenges/attempts/${attemptId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        card_results: results.map((r, i) =>
          i === results.length - 1 ? { ...r, correct: true, overridden: true } : r
        ),
      }),
    }).catch(() => {});
  }

  function overrideReviewAnswer(index: number) {
    setResults((prev) =>
      prev.map((r, i) => (i === index ? { ...r, correct: true, overridden: true } : r))
    );
  }

  // ── Loading / error ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col">
        <div className="border-b border-border bg-background/80">
          <div className="mx-auto flex h-12 max-w-2xl items-center px-6">
            <div className="h-3 w-24 animate-pulse rounded bg-muted/40" />
          </div>
        </div>
        <div className="mx-auto w-full max-w-2xl px-6 py-10">
          <div className="h-48 animate-pulse rounded-2xl border border-border/40 bg-muted/20" />
        </div>
      </div>
    );
  }

  if (error || !challenge) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-destructive">{error ?? "Challenge not found"}</p>
      </div>
    );
  }

  // ── Intro ──────────────────────────────────────────────────────────────────

  if (phase === "intro") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground/50 mb-2">
              You&apos;ve been challenged
            </p>
            <h1 className="font-heading text-2xl font-bold text-foreground">{challenge.title}</h1>
            <p className="mt-2 text-sm text-muted-foreground/70">
              {cards.length} card{cards.length !== 1 ? "s" : ""} · {modeLabel(challenge.quiz_mode)}
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={startStudy}
              className="w-full rounded-xl border px-5 py-4 text-left transition-colors"
              style={{
                borderColor: "color-mix(in oklch, var(--dashboard-accent-teal) 45%, transparent)",
                background: "color-mix(in oklch, var(--dashboard-accent-teal) 8%, transparent)",
              }}
            >
              <p className="text-sm font-semibold text-foreground">Study first</p>
              <p className="text-xs text-muted-foreground/60 mt-0.5">Review all {cards.length} cards before the quiz</p>
            </button>
            <button
              onClick={startQuiz}
              className="w-full rounded-xl border border-border/50 bg-card px-5 py-4 text-left transition-colors hover:bg-muted/30"
            >
              <p className="text-sm font-semibold text-foreground">Start quiz</p>
              <p className="text-xs text-muted-foreground/60 mt-0.5">Jump straight in</p>
            </button>
          </div>

          <button
            onClick={() => router.push("/challenges")}
            className="mt-6 w-full text-center text-xs text-muted-foreground/50 hover:text-foreground transition-colors"
          >
            Back to challenges
          </button>
        </div>
      </div>
    );
  }

  // ── Study phase ────────────────────────────────────────────────────────────

  if (phase === "study") {
    const studyCard = cards[studyIndex];
    const studyProgress = (studyIndex + (flipped ? 1 : 0)) / cards.length;

    return (
      <div className="flex min-h-screen flex-col">
        <div className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-xl">
          <div className="mx-auto flex h-12 max-w-2xl items-center justify-between px-6">
            <button
              onClick={() => setPhase("intro")}
              className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground/60 uppercase tracking-wide">Study</span>
              <span className="text-xs text-muted-foreground">{studyIndex + 1} / {cards.length}</span>
              <div className="h-1.5 w-28 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary/60 transition-all duration-300" style={{ width: `${studyProgress * 100}%` }} />
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto w-full max-w-2xl flex-1 flex flex-col items-center justify-center px-6 py-10 gap-4">
          <button
            onClick={() => setFlipped((f) => !f)}
            className="w-full rounded-2xl border border-border bg-card px-8 py-10 text-center transition-colors hover:bg-muted/20 cursor-pointer"
          >
            {!flipped ? (
              <>
                <p className="mb-4 text-[10px] font-medium uppercase tracking-[0.15em] text-primary/70">Question</p>
                <p className="text-lg font-medium leading-relaxed text-foreground">{studyCard?.front}</p>
                <p className="mt-6 text-[10px] text-muted-foreground/40">Tap to reveal answer</p>
              </>
            ) : (
              <>
                <p className="mb-4 text-[10px] font-medium uppercase tracking-[0.15em] text-green-600/70 dark:text-green-400/70">Answer</p>
                <p className="text-lg font-medium leading-relaxed text-foreground">{studyCard?.back}</p>
                <p className="mt-6 text-[10px] text-muted-foreground/40">Tap to flip back</p>
              </>
            )}
          </button>

          <div className="flex w-full gap-3">
            {studyIndex > 0 && (
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => { setStudyIndex((i) => i - 1); setFlipped(false); }}
              >
                ← Previous
              </Button>
            )}
            <Button
              className="flex-1"
              onClick={studyNext}
            >
              {studyIndex + 1 >= cards.length ? "Start quiz →" : "Next →"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Done ───────────────────────────────────────────────────────────────────

  if (phase === "done") {
    const score = results.filter((r) => r.correct).length;
    const total = cards.length;
    const pct = total > 0 ? Math.round((score / total) * 100) : 0;
    return (
      <>
        <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
          <div className="text-center mb-8">
            <p className="font-heading text-6xl font-bold text-primary">{pct}%</p>
            <p className="font-heading mt-3 text-lg font-bold text-foreground">
              {pct >= 90 ? "Excellent!" : pct >= 70 ? "Good work!" : "Keep practicing"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground/70">{score}/{total} correct</p>
            <p className="mt-1 text-xs text-muted-foreground/50">Results sent to challenger</p>
          </div>
          <div className="mb-6 flex flex-col gap-2">
            {results.map((r, i) => {
              const card = cards.find((c) => c.id === r.card_id);
              if (!card) return null;
              return (
                <div key={i} className={`rounded-xl border px-4 py-3 ${r.correct ? "border-green-500/30 bg-green-500/5" : "border-destructive/30 bg-destructive/5"}`}>
                  <div className="flex items-start gap-2 text-sm">
                    <span className={r.correct ? "text-green-500" : "text-destructive"}>{r.correct ? "✓" : "✗"}</span>
                    <div>
                      <p className="font-medium text-foreground">{card.front}</p>
                      {!r.correct && (
                        <div className="mt-1 space-y-0.5">
                          <p className="text-xs text-destructive/80">You answered: {r.chosen_answer}</p>
                          <p className="text-xs text-green-600 dark:text-green-400">Correct: {card.back}</p>
                          <button
                            onClick={() => overrideReviewAnswer(i)}
                            className="text-xs font-medium text-primary hover:underline"
                          >
                            Actually, mark mine as correct
                          </button>
                        </div>
                      )}
                      {r.correct && r.overridden && (
                        <p className="mt-1 text-[10px] font-medium text-primary/70">✓ marked correct by you</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => retakeQuiz(cards)}
            >
              Retake quiz
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={openForkPicker}
              disabled={forked}
            >
              {forked ? "Saved to collection ✓" : "Save cards to collection"}
            </Button>
            <Button className="w-full" onClick={() => { router.refresh(); router.push("/challenges"); }}>
              Back to Challenges
            </Button>
          </div>
        </div>

        {showFork && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowFork(false)} />
            <div className="relative z-10 w-full max-w-sm bg-background border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl">
              <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
                <h3 className="text-sm font-semibold text-foreground">Save to collection</h3>
                <button onClick={() => setShowFork(false)} className="text-muted-foreground/60 hover:text-foreground transition-colors">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="px-5 py-4 flex flex-col gap-2 max-h-64 overflow-y-auto">
                {forkError && (
                  <p className="text-xs text-destructive text-center py-2">{forkError}</p>
                )}
                {collectionsLoading ? (
                  <p className="text-xs text-muted-foreground/60 text-center py-4">Loading…</p>
                ) : collections.length === 0 ? (
                  <p className="text-xs text-muted-foreground/60 text-center py-4">No collections yet. Create one first.</p>
                ) : (
                  collections.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => forkToCollection(c.id)}
                      disabled={forking}
                      className="w-full rounded-xl border border-border/40 px-4 py-3 text-left text-sm text-foreground hover:border-primary/30 hover:bg-muted/30 transition-colors disabled:opacity-50"
                    >
                      {c.name}
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // ── Quiz phase ─────────────────────────────────────────────────────────────

  const card = cards[index];
  const cardMode: ResolvedMode = cardModes[card?.id] ?? "multiple-choice";
  const options = mcOptions[card?.id] ?? [];
  const progress = index / cards.length;

  return (
    <div className="flex min-h-screen flex-col">
      <div className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-12 max-w-2xl items-center justify-between px-6">
          <button
            onClick={() => router.push("/challenges")}
            className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Exit
          </button>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">{index + 1} / {cards.length}</span>
            <div className="h-1.5 w-32 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${progress * 100}%` }} />
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-2xl px-6 pt-6">
        <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground/50 mb-1">
          Challenge: {challenge.title}
        </p>
      </div>

      <div className="mx-auto w-full max-w-2xl flex-1 px-6 pb-10">
        {cardMode === "multiple-choice" ? (
          <>
            <div className="rounded-2xl border border-border bg-card px-8 py-8 text-center">
              <p className="mb-4 text-[10px] font-medium uppercase tracking-[0.15em] text-primary/70">Question</p>
              <p className="text-lg font-medium leading-relaxed text-foreground">{card?.front}</p>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-2">
              {options.map((option, idx) => {
                const isCorrect = option === card?.back;
                const isSelected = selected === option;
                const revealed = selected !== null;
                let cls = "w-full rounded-xl border px-4 py-3 text-left text-sm transition-colors focus:outline-none";
                if (!revealed) cls += " border-border text-foreground hover:border-primary/50 hover:bg-muted/50";
                else if (isCorrect) cls += " border-green-500/50 bg-green-500/10 text-green-700 dark:text-green-400";
                else if (isSelected) cls += " border-destructive/50 bg-destructive/10 text-destructive";
                else cls += " border-border/40 text-muted-foreground opacity-50";
                return (
                  <button key={idx} disabled={revealed} className={cls} onClick={() => pickMC(option)}>
                    <span className="mr-2 text-[10px] font-semibold text-muted-foreground/60">{idx + 1}.</span>
                    {option}
                  </button>
                );
              })}
            </div>
            {selected && (
              <div className="mt-4">
                {index + 1 < cards.length ? (
                  <Button className="w-full" onClick={advance}>Continue →</Button>
                ) : saving ? (
                  <div className="flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground/60">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-primary" />
                    Saving…
                  </div>
                ) : null}
              </div>
            )}
          </>
        ) : (
          <div className="rounded-2xl border border-border bg-card px-8 py-8">
            <p className="mb-4 text-center text-[10px] font-medium uppercase tracking-[0.15em] text-primary/70">Question</p>
            <p className="text-center text-lg font-medium leading-relaxed text-foreground">{card?.front}</p>
            {!answerSubmitted ? (
              <div className="mt-6">
                <textarea
                  autoFocus
                  value={typedAnswer}
                  onChange={(e) => setTypedAnswer(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && typedAnswer.trim()) {
                      e.preventDefault();
                      submitType();
                    }
                  }}
                  placeholder="Type your answer…"
                  rows={3}
                  className="w-full resize-none rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
                <Button className="mt-3 w-full" disabled={!typedAnswer.trim()} onClick={submitType}>
                  Submit
                </Button>
              </div>
            ) : (
              <div className="mt-6 space-y-3">
                {(() => {
                  const isCorrect = results[results.length - 1]?.correct ?? gradeTypeAnswer(typedAnswer, card?.back ?? "");
                  return (
                    <>
                      <div className={`rounded-xl px-4 py-3 ${isCorrect ? "border border-green-500/30 bg-green-500/5" : "border border-destructive/30 bg-destructive/5"}`}>
                        <p className={`text-[10px] font-medium uppercase tracking-[0.12em] ${isCorrect ? "text-green-600 dark:text-green-400" : "text-destructive/80"}`}>
                          Your answer
                        </p>
                        <p className="mt-1 text-sm text-foreground">{typedAnswer}</p>
                      </div>
                      {!isCorrect && (
                        <div className="rounded-xl border border-green-500/30 bg-green-500/5 px-4 py-3">
                          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-green-600 dark:text-green-400">Correct answer</p>
                          <p className="mt-1 text-sm text-foreground">{card?.back}</p>
                          <button
                            onClick={overrideCurrentAnswer}
                            className="mt-2 text-xs font-medium text-primary hover:underline"
                          >
                            Actually, mark mine as correct
                          </button>
                        </div>
                      )}
                    </>
                  );
                })()}
                {index + 1 < cards.length ? (
                  <Button className="w-full" onClick={advance}>Continue →</Button>
                ) : saving ? (
                  <div className="flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground/60">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-primary" />
                    Saving…
                  </div>
                ) : null}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
