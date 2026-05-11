"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

type SentAttempt = {
  id: string;
  user_id: string;
  status: string;
  score: number | null;
  total: number | null;
};

type SentChallenge = {
  id: string;
  title: string;
  created_at: string;
  challenge_attempts: SentAttempt[];
};

type ReceivedChallenge = {
  id: string;
  status: string;
  score: number | null;
  total: number | null;
  challenge_id: string;
  challenges: { id: string; title: string; challenger_id: string } | null;
};

type Profile = { display_name: string | null };
type Profiles = Record<string, Profile>;

type Tab = "received" | "sent" | "completed";

function statusBadge(status: string) {
  const cls =
    status === "completed"
      ? "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20"
      : status === "in_progress"
      ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20"
      : status === "declined"
      ? "bg-destructive/10 text-destructive border-destructive/20"
      : "bg-muted/40 text-muted-foreground border-border/40";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${cls}`}>
      {status === "in_progress" ? "in progress" : status}
    </span>
  );
}

export default function ChallengesPage() {
  const [tab, setTab] = useState<Tab>("received");
  const [sent, setSent] = useState<SentChallenge[]>([]);
  const [received, setReceived] = useState<ReceivedChallenge[]>([]);
  const [profiles, setProfiles] = useState<Profiles>({});
  const [loading, setLoading] = useState(true);
  const [declining, setDeclining] = useState<string | null>(null);

  const fetchChallenges = useCallback(() => {
    fetch("/api/challenges")
      .then((r) => r.json())
      .then((d) => {
        setSent(d.sent ?? []);
        setReceived(d.received ?? []);
        setProfiles(d.profiles ?? {});
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchChallenges();
    function handleVisibility() {
      if (document.visibilityState === "visible") fetchChallenges();
    }
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [fetchChallenges]);

  async function decline(attemptId: string) {
    setDeclining(attemptId);
    await fetch(`/api/challenges/attempts/${attemptId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "declined" }),
    });
    setReceived((prev) => prev.map((r) => r.id === attemptId ? { ...r, status: "declined" } : r));
    setDeclining(null);
  }

  const displayName = (userId: string, fallback = "Someone") =>
    profiles[userId]?.display_name ?? fallback;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-10">
      <h1 className="font-heading text-2xl font-bold text-foreground mb-6">Challenges</h1>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-muted/30 p-1 mb-6 w-fit">
        {(["received", "completed", "sent"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors capitalize ${
              tab === t ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl border border-border/40 bg-muted/20" />
          ))}
        </div>
      ) : tab === "received" ? (
        (() => {
          const active = received.filter((r) => r.status !== "completed" && r.status !== "declined");
          return active.length === 0 ? (
            <p className="text-sm text-muted-foreground/60 text-center py-12">No active challenges</p>
          ) : (
            <div className="flex flex-col gap-3">
              {active.map((r) => {
                const challengerName = displayName(r.challenges?.challenger_id ?? "", "Someone");
                return (
                  <div key={r.id} className="flex items-center justify-between rounded-xl border border-border/40 bg-card/60 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">{r.challenges?.title ?? "Challenge"}</p>
                      <p className="text-xs text-muted-foreground/50 mt-0.5">from {challengerName}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {statusBadge(r.status)}
                      <Link
                        href={`/challenges/${r.id}/play`}
                        className="rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors"
                        style={{
                          borderColor: "color-mix(in oklch, var(--dashboard-accent-teal) 45%, transparent)",
                          color: "var(--dashboard-accent-teal-strong)",
                        }}
                      >
                        {r.status === "in_progress" ? "Continue" : "Take quiz"}
                      </Link>
                      <button
                        onClick={() => decline(r.id)}
                        disabled={declining === r.id}
                        className="rounded-lg border border-border/40 px-3 py-1.5 text-xs font-medium text-muted-foreground/60 hover:text-destructive hover:border-destructive/30 transition-colors disabled:opacity-40"
                      >
                        {declining === r.id ? "…" : "Decline"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()
      ) : tab === "completed" ? (
        (() => {
          const done = received.filter((r) => r.status === "completed" || r.status === "declined");
          return done.length === 0 ? (
            <p className="text-sm text-muted-foreground/60 text-center py-12">No completed challenges yet</p>
          ) : (
            <div className="flex flex-col gap-3">
              {done.map((r) => {
                const challengerName = displayName(r.challenges?.challenger_id ?? "", "Someone");
                return (
                  <div key={r.id} className="flex items-center justify-between rounded-xl border border-border/40 bg-card/60 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">{r.challenges?.title ?? "Challenge"}</p>
                      <p className="text-xs text-muted-foreground/50 mt-0.5">from {challengerName}</p>
                      {r.status === "completed" && r.score !== null && r.total !== null && (
                        <p className="text-xs text-muted-foreground/60 mt-0.5">Score: {r.score}/{r.total}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {statusBadge(r.status)}
                      {r.status === "completed" && (
                        <Link
                          href={`/challenges/${r.id}/play`}
                          className="rounded-lg border border-border/40 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                        >
                          Retake
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()
      ) : (
        sent.length === 0 ? (
          <p className="text-sm text-muted-foreground/60 text-center py-12">You haven&apos;t sent any challenges yet</p>
        ) : (
          <div className="flex flex-col gap-4">
            {sent.map((c) => (
              <div key={c.id} className="rounded-xl border border-border/40 bg-card/60 px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-foreground">{c.title}</p>
                  <Link
                    href={`/challenges/${c.id}/results`}
                    className="text-xs text-muted-foreground/60 hover:text-foreground transition-colors"
                  >
                    View results →
                  </Link>
                </div>
                <div className="flex flex-col gap-1.5">
                  {c.challenge_attempts.map((a) => {
                    const name = displayName(a.user_id, a.user_id.slice(0, 8) + "…");
                    return (
                      <div key={a.id} className="flex items-center justify-between text-xs text-muted-foreground/70">
                        <span>{name}</span>
                        <div className="flex items-center gap-2">
                          {a.status === "completed" && a.score !== null && (
                            <span>{a.score}/{a.total}</span>
                          )}
                          {statusBadge(a.status)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
