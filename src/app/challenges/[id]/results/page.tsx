"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type CardShape = { id: string; front: string; back: string };
type Profile = { id: string; display_name: string | null; avatar_url: string | null };
type CardResult = { card_id: string; correct: boolean; chosen_answer: string };
type Attempt = {
  id: string;
  user_id: string;
  status: string;
  score: number | null;
  total: number | null;
  card_results: CardResult[];
};
type Challenge = { id: string; title: string; deck_id: string | null };

function statusBadge(status: string) {
  const cls =
    status === "completed"
      ? "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20"
      : status === "in_progress"
      ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20"
      : "bg-muted/40 text-muted-foreground border-border/40";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${cls}`}>
      {status === "in_progress" ? "in progress" : status}
    </span>
  );
}

export default function ChallengeResultsPage() {
  const { id: challengeId } = useParams<{ id: string }>();
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [cards, setCards] = useState<CardShape[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchResults = useCallback(() => {
    return fetch(`/api/challenges/${challengeId}/results`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error); return; }
        setChallenge(d.challenge);
        setAttempts(d.attempts ?? []);
        setCards(d.cards ?? []);
        setProfiles(d.profiles ?? []);
      })
      .catch(() => setError("Failed to load results"))
      .finally(() => setLoading(false));
  }, [challengeId]);

  useEffect(() => {
    fetchResults();

    const supabase = createClient();
    const channel = supabase
      .channel(`challenge-results:${challengeId}:${Date.now()}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "challenge_attempts",
          filter: `challenge_id=eq.${challengeId}`,
        },
        () => { fetchResults(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [challengeId, fetchResults]);

  function profileFor(userId: string) {
    return profiles.find((p) => p.id === userId);
  }

  function cardFor(cardId: string) {
    return cards.find((c) => c.id === cardId);
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <div className="h-6 w-40 animate-pulse rounded bg-muted/40 mb-6" />
        {[1, 2].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-xl border border-border/40 bg-muted/20 mb-3" />
        ))}
      </div>
    );
  }

  if (error || !challenge) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-destructive">{error ?? "Not found"}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-6">
        <Link href="/challenges" className="text-xs text-muted-foreground/60 hover:text-foreground transition-colors">
          ← Challenges
        </Link>
        <h1 className="font-heading text-2xl font-bold text-foreground mt-2">{challenge.title}</h1>
        <p className="text-sm text-muted-foreground/60 mt-0.5">{cards.length} card{cards.length !== 1 ? "s" : ""} · {attempts.length} recipient{attempts.length !== 1 ? "s" : ""}</p>
      </div>

      <div className="flex flex-col gap-4">
        {attempts.map((a) => {
          const profile = profileFor(a.user_id);
          const name = profile?.display_name ?? a.user_id.slice(0, 8) + "…";
          const isExpanded = expanded === a.id;
          const pct = a.status === "completed" && a.total ? Math.round(((a.score ?? 0) / a.total) * 100) : null;
          const correct = (a.card_results ?? []).filter((r) => r.correct).length;
          const wrong = (a.card_results ?? []).length - correct;

          return (
            <div key={a.id} className="rounded-xl border border-border/40 bg-card/60 overflow-hidden">
              {/* Header row */}
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
                    {name[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{name}</p>
                    {a.status !== "completed" && (
                      <p className="text-xs text-muted-foreground/50 mt-0.5">Hasn&apos;t taken the quiz yet</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {a.status === "completed" && pct !== null ? (
                    <div className="text-right">
                      <p className={`text-lg font-bold ${pct >= 70 ? "text-green-600 dark:text-green-400" : "text-destructive"}`}>
                        {pct}%
                      </p>
                      <p className="text-[10px] text-muted-foreground/50">{a.score}/{a.total} correct</p>
                    </div>
                  ) : (
                    statusBadge(a.status)
                  )}
                </div>
              </div>

              {/* Right / wrong tally + expand toggle */}
              {a.status === "completed" && (
                <>
                  <div className="flex items-center gap-4 px-4 pb-3">
                    <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
                      <span className="font-semibold">{correct}</span> correct
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-destructive">
                      <span className="font-semibold">{wrong}</span> wrong
                    </div>
                    <button
                      onClick={() => setExpanded(isExpanded ? null : a.id)}
                      className="ml-auto text-[10px] text-muted-foreground/50 hover:text-foreground transition-colors"
                    >
                      {isExpanded ? "Hide answers ↑" : "Show answers ↓"}
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-border/30 px-4 py-3 flex flex-col gap-2">
                      {(a.card_results ?? []).map((r, i) => {
                        const card = cardFor(r.card_id);
                        if (!card) return null;
                        return (
                          <div key={i} className={`rounded-lg border px-3 py-2.5 text-xs ${r.correct ? "border-green-500/20 bg-green-500/5" : "border-destructive/20 bg-destructive/5"}`}>
                            <div className="flex items-start gap-2">
                              <span className={`mt-0.5 shrink-0 ${r.correct ? "text-green-500" : "text-destructive"}`}>
                                {r.correct ? "✓" : "✗"}
                              </span>
                              <div className="min-w-0">
                                <p className="font-medium text-foreground">{card.front}</p>
                                {!r.correct && (
                                  <div className="mt-1 space-y-0.5">
                                    <p className="text-destructive/80">Chose: {r.chosen_answer}</p>
                                    <p className="text-green-600 dark:text-green-400">Correct: {card.back}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
