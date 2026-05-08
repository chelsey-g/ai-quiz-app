"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { Database } from "@/lib/database.types";

type Card = Database["public"]["Tables"]["cards"]["Row"];
type ChallengeAttempt = Database["public"]["Tables"]["challenge_attempts"]["Row"];
type Challenge = Database["public"]["Tables"]["challenges"]["Row"];

type CardResult = { card_id: string; correct: boolean; chosen_answer: string };

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

export default function ChallengPlayPage() {
  const { id: attemptId } = useParams<{ id: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState<ChallengeAttempt | null>(null);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [mcOptions, setMcOptions] = useState<Record<string, string[]>>({});

  const [phase, setPhase] = useState<"quiz" | "done">("quiz");
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<CardResult[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [started, setStarted] = useState(false);

  const savingRef = useRef(false);

  useEffect(() => {
    fetch(`/api/challenges/attempts/${attemptId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error); return; }
        setAttempt(d.attempt);
        setChallenge(d.challenge);
        const c: Card[] = d.cards ?? [];
        setCards(c);
        const opts: Record<string, string[]> = {};
        c.forEach((card) => { opts[card.id] = buildOptions(c, card); });
        setMcOptions(opts);
        if (d.attempt.status === "completed") setPhase("done");
        if (d.attempt.card_results && Array.isArray(d.attempt.card_results)) {
          setResults(d.attempt.card_results as CardResult[]);
        }
      })
      .catch(() => setError("Failed to load challenge"))
      .finally(() => setLoading(false));
  }, [attemptId]);

  async function pick(option: string) {
    if (selected || !cards[index]) return;
    const card = cards[index];
    const correct = option === card.back;
    const result: CardResult = { card_id: card.id, correct, chosen_answer: option };
    const newResults = [...results, result];

    setSelected(option);
    setResults(newResults);

    if (!started) {
      setStarted(true);
      await fetch(`/api/challenges/attempts/${attemptId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "in_progress" }),
      });
    }

    const isLast = index + 1 >= cards.length;

    if (isLast && !savingRef.current) {
      savingRef.current = true;
      const score = newResults.filter((r) => r.correct).length;
      await fetch(`/api/challenges/attempts/${attemptId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed", score, total: cards.length, card_results: newResults }),
      });
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
    setIndex((i) => i + 1);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col">
        <div className="border-b border-border bg-background/80">
          <div className="mx-auto flex h-12 max-w-2xl items-center px-6">
            <div className="h-3 w-24 animate-pulse rounded bg-muted/40" />
          </div>
        </div>
        <div className="mx-auto w-full max-w-2xl px-6 py-10">
          <div className="h-32 animate-pulse rounded-2xl border border-border/40 bg-muted/20" />
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

  if (phase === "done") {
    const score = results.filter((r) => r.correct).length;
    const total = cards.length;
    const pct = total > 0 ? Math.round((score / total) * 100) : 0;
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <div className="text-center mb-8">
          <p className="font-heading text-6xl font-bold text-primary">{pct}%</p>
          <p className="font-heading mt-3 text-lg font-bold text-foreground">
            {pct >= 90 ? "Excellent!" : pct >= 70 ? "Good work!" : "Keep practicing"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground/70">{score}/{total} correct</p>
          <p className="mt-1 text-xs text-muted-foreground/50">Results sent to {challenge.challenger_id.slice(0, 8)}…</p>
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
                        <p className="text-xs text-destructive/80">You chose: {r.chosen_answer}</p>
                        <p className="text-xs text-green-600 dark:text-green-400">Correct: {card.back}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <Button className="w-full" onClick={() => router.push("/challenges")}>
          Back to Challenges
        </Button>
      </div>
    );
  }

  const card = cards[index];
  const options = mcOptions[card?.id] ?? [];
  const progress = index / cards.length;

  return (
    <div className="flex min-h-screen flex-col">
      {/* Top bar */}
      <div className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-12 max-w-2xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push("/challenges")}
              className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Exit
            </button>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">{index + 1} / {cards.length}</span>
            <div className="h-1.5 w-32 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${progress * 100}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Challenge label */}
      <div className="mx-auto w-full max-w-2xl px-6 pt-6">
        <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground/50 mb-1">
          Challenge: {challenge.title}
        </p>
      </div>

      {/* Question */}
      <div className="mx-auto w-full max-w-2xl flex-1 px-6 pb-10">
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
              <button key={idx} disabled={revealed} className={cls} onClick={() => pick(option)}>
                <span className="mr-2 text-[10px] font-semibold text-muted-foreground/60">{idx + 1}.</span>
                {option}
              </button>
            );
          })}
        </div>
        {selected && index + 1 < cards.length && (
          <div className="mt-4">
            <Button className="w-full" onClick={advance}>Continue →</Button>
          </div>
        )}
      </div>
    </div>
  );
}
