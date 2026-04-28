"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { DeckCard, type DeckWithStats } from "@/components/deck-card";

type DashboardStats = {
  totalCards: number;
  totalSeen: number;
  totalCorrect: number;
  cardsDueToday: number;
  recentDeckIds: string[];
  dueCounts: Record<string, number>;
};

function StatBanner({ stats }: { stats: DashboardStats }) {
  const accuracy =
    stats.totalSeen > 0
      ? Math.round((stats.totalCorrect / stats.totalSeen) * 100)
      : null;

  return (
    <div className="mb-8 grid grid-cols-3 gap-3">
      <div className="rounded-xl border border-border/40 bg-card/60 px-4 py-3">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground/55">Total cards</p>
        <p className="font-heading mt-1 text-2xl font-bold tabular-nums text-foreground">
          {stats.totalCards}
        </p>
      </div>
      <div className="rounded-xl border border-border/40 bg-card/60 px-4 py-3">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground/55">Accuracy</p>
        <p className="font-heading mt-1 text-2xl font-bold tabular-nums text-foreground">
          {accuracy !== null ? `${accuracy}%` : "—"}
        </p>
      </div>
      <div className="rounded-xl border border-border/40 bg-card/60 px-4 py-3">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground/55">Due today</p>
        <p
          className={`font-heading mt-1 text-2xl font-bold tabular-nums ${
            stats.cardsDueToday > 0 ? "text-amber-400" : "text-foreground"
          }`}
        >
          {stats.cardsDueToday}
        </p>
      </div>
    </div>
  );
}

function SectionHeading({ title }: { title: string }) {
  return (
    <h2 className="font-heading mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
      {title}
    </h2>
  );
}

export default function HomePage() {
  const [decks, setDecks] = useState<DeckWithStats[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAll() {
      const [decksRes, statsRes] = await Promise.all([
        fetch("/api/decks"),
        fetch("/api/dashboard"),
      ]);

      if (!decksRes.ok) {
        const { error } = await decksRes.json();
        setError(error ?? "Failed to load decks");
        setLoading(false);
        return;
      }
      if (!statsRes.ok) {
        const { error } = await statsRes.json();
        setError(error ?? "Failed to load dashboard stats");
        setLoading(false);
        return;
      }

      const [decksData, statsData] = await Promise.all([
        decksRes.json() as Promise<DeckWithStats[]>,
        statsRes.json() as Promise<DashboardStats>,
      ]);

      setDecks(decksData);
      setStats(statsData);
      setLoading(false);
    }

    fetchAll();
  }, []);

  // Derived data (only computed when not loading)
  const deckMap = new Map(decks.map((d) => [d.id, d]));

  const recentDecks =
    stats?.recentDeckIds
      .map((id) => deckMap.get(id))
      .filter((d): d is DeckWithStats => d !== undefined)
      .slice(0, 3) ?? [];

  const dueDecks = stats
    ? decks.filter((d) => (stats.dueCounts[d.id] ?? 0) > 0)
    : [];

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      {/* Page header */}
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">
            Dashboard
          </h1>
          {!loading && !error && decks.length > 0 && (
            <p className="mt-1.5 text-sm text-muted-foreground/70">
              {decks.length} {decks.length === 1 ? "deck" : "decks"}
            </p>
          )}
        </div>
        {!loading && !error && decks.length > 0 && (
          <div className="flex items-center gap-2">
            <Link
              href="/quiz/quick"
              className="inline-flex items-center justify-center rounded-md border border-border bg-transparent px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
            >
              Quick Quiz
            </Link>
            <Link href="/import" className={buttonVariants({ size: "sm" })}>
              Import notes
            </Link>
          </div>
        )}
      </div>

      {/* Loading skeletons */}
      {loading && (
        <div className="space-y-8">
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 rounded-xl border border-border/40 bg-card/60 animate-pulse" />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-40 rounded-2xl border border-border/40 bg-card/60 animate-pulse"
                style={{ animationDelay: `${i * 60}ms` }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3">
          <p className="text-sm text-destructive">Failed to load: {error}</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && decks.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/50 py-28 text-center">
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-primary/25 bg-primary/10">
            <svg
              className="h-5 w-5 text-primary"
              fill="currentColor"
              viewBox="0 0 20 20"
              aria-hidden="true"
            >
              <path d="M10 1.5C10 1.5 10.9 7.2 13.8 9.5C16.4 11.6 20 11 20 11C20 11 16.4 10.4 13.8 12.5C10.9 14.8 10 20 10 20C10 20 9.1 14.8 6.2 12.5C3.6 10.4 0 11 0 11C0 11 3.6 11.6 6.2 9.5C9.1 7.2 10 1.5 10 1.5Z" />
            </svg>
          </div>
          <h2 className="font-heading text-base font-semibold text-foreground">No decks yet</h2>
          <p className="mt-2 max-w-xs text-sm text-muted-foreground/70">
            Import your Markdown notes to generate AI-powered study decks.
          </p>
          <Link href="/import" className={buttonVariants({ size: "sm" }) + " mt-6"}>
            Import notes
          </Link>
        </div>
      )}

      {/* Main content — only when loaded with data */}
      {!loading && !error && decks.length > 0 && stats && (
        <div className="space-y-10">
          {/* Stats banner */}
          <StatBanner stats={stats} />

          {/* Continue studying */}
          {recentDecks.length > 0 && (
            <section>
              <SectionHeading title="Continue studying" />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {recentDecks.map((deck, i) => (
                  <div key={deck.id} className="animate-card-in" style={{ animationDelay: `${i * 50}ms` }}>
                    <DeckCard deck={deck} dueCount={stats.dueCounts[deck.id] ?? 0} />
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Due today */}
          {dueDecks.length > 0 && (
            <section>
              <SectionHeading title="Due today" />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {dueDecks.map((deck, i) => (
                  <div key={deck.id} className="animate-card-in" style={{ animationDelay: `${i * 50}ms` }}>
                    <DeckCard deck={deck} dueCount={stats.dueCounts[deck.id] ?? 0} />
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* All decks */}
          <section>
            <SectionHeading title="All decks" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {decks.map((deck, i) => (
                <div key={deck.id} className="animate-card-in" style={{ animationDelay: `${i * 50}ms` }}>
                  <DeckCard deck={deck} dueCount={stats.dueCounts[deck.id] ?? 0} />
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
