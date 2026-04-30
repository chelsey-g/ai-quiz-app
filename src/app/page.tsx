"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { buttonVariants, Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DeckCard, type DeckWithStats } from "@/components/deck-card";
import { useRouter } from "next/navigation";

type DashboardStats = {
  totalCards: number;
  totalSeen: number;
  totalCorrect: number;
  cardsDueToday: number;
  recentDeckIds: string[];
  dueCounts: Record<string, number>;
  streakDays: number;
  streakStatus: "active" | "at_risk" | "none";
};

function FlameIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 2C12 2 13.5 8 17 10.5C20 12.7 24 12 24 12C24 12 20 11.3 17 13.5C13.5 16 12 22 12 22C12 22 10.5 16 7 13.5C4 11.3 0 12 0 12C0 12 4 12.7 7 10.5C10.5 8 12 2 12 2Z" />
    </svg>
  );
}

function StatBanner({ stats }: { stats: DashboardStats }) {
  const accuracy =
    stats.totalSeen > 0
      ? Math.round((stats.totalCorrect / stats.totalSeen) * 100)
      : null;

  const streakValue =
    stats.streakStatus === "none" || stats.streakDays === 0
      ? "—"
      : `${stats.streakDays}`;

  const streakLabel =
    stats.streakStatus === "none" || stats.streakDays === 0
      ? null
      : stats.streakDays === 1
      ? "day"
      : "days";

  const streakColor =
    stats.streakStatus === "active"
      ? "text-primary"
      : stats.streakStatus === "at_risk"
      ? "text-amber-400"
      : "text-foreground";

  const streakSubtext =
    stats.streakStatus === "at_risk" ? (
      <p className="mt-0.5 text-[10px] text-amber-400/80">at risk</p>
    ) : null;

  return (
    <div className="mb-8 grid grid-cols-4 gap-3">
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
      <div className="rounded-xl border border-border/40 bg-card/60 px-4 py-3">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground/55">Streak</p>
        <div className="mt-1 flex items-baseline gap-1">
          <FlameIcon
            className={`h-5 w-5 flex-none ${streakColor} ${
              stats.streakStatus === "at_risk" ? "animate-pulse" : ""
            }`}
          />
          <p className={`font-heading text-2xl font-bold tabular-nums ${streakColor}`}>
            {streakValue}
          </p>
          {streakLabel && (
            <span className={`font-heading text-sm font-medium ${streakColor} opacity-70`}>
              {streakLabel}
            </span>
          )}
        </div>
        {streakSubtext}
      </div>
    </div>
  );
}

function JumpBackInCard({
  deck,
  dueCount,
}: {
  deck: DeckWithStats;
  dueCount: number;
}) {
  return (
    <Link href={`/decks/${deck.id}`} className="block group mb-8">
      <div
        className="relative overflow-hidden rounded-2xl border bg-card transition-all duration-300 hover:-translate-y-0.5"
        style={{
          borderColor: "oklch(0.65 0.18 265 / 0.35)",
          boxShadow: "0 0 0 0 transparent",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.boxShadow =
            "0 16px 40px -12px oklch(0.65 0.18 265 / 0.18)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.boxShadow = "0 0 0 0 transparent";
        }}
      >
        {/* Blue-violet top accent line */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[oklch(0.65_0.18_265/_0.7)] to-transparent transition-all duration-300 group-hover:via-[oklch(0.65_0.18_265/_1)]" />

        <div className="flex items-center gap-5 px-6 py-5">
          {/* Icon */}
          <div
            className="flex h-10 w-10 flex-none items-center justify-center rounded-xl border transition-all duration-300 group-hover:scale-105"
            style={{
              borderColor: "oklch(0.65 0.18 265 / 0.3)",
              background: "oklch(0.65 0.18 265 / 0.1)",
            }}
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.75}
              style={{ color: "oklch(0.65 0.18 265)" }}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z"
              />
            </svg>
          </div>

          {/* Text */}
          <div className="min-w-0 flex-1">
            <p
              className="font-heading text-[10px] font-semibold uppercase tracking-[0.15em] mb-0.5"
              style={{ color: "oklch(0.65 0.18 265 / 0.8)" }}
            >
              Jump back in
            </p>
            <h3 className="font-heading text-sm font-semibold text-foreground truncate">
              {deck.title}
            </h3>
            {deck.topic_tags.length > 0 && (
              <p className="mt-0.5 text-xs text-muted-foreground/55 truncate">
                {deck.topic_tags.slice(0, 3).join(" · ")}
              </p>
            )}
          </div>

          {/* Right side — due badge + arrow */}
          <div className="flex flex-none items-center gap-3">
            {dueCount > 0 && (
              <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-[10px] font-semibold text-amber-400">
                {dueCount} due
              </span>
            )}
            <svg
              className="h-4 w-4 text-muted-foreground/40 transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-muted-foreground/70"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.75}
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </div>
        </div>
      </div>
    </Link>
  );
}

function NewDeckDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (deckId: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTitle("");
      setErr(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setErr(null);
    const res = await fetch("/api/decks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim() }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json();
      setErr(data.error ?? "Failed to create deck");
      return;
    }
    const deck = await res.json();
    onCreated(deck.id);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-heading text-base font-semibold">New deck</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="mt-3 space-y-4">
          <input
            ref={inputRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Deck title"
            className="w-full rounded-xl border border-border bg-muted/30 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          {err && <p className="text-xs text-destructive">{err}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
            <Button type="submit" size="sm" disabled={!title.trim() || saving}>
              {saving ? "Creating…" : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function HomePage() {
  const router = useRouter();
  const [decks, setDecks] = useState<DeckWithStats[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNewDeck, setShowNewDeck] = useState(false);

  // Bulk select state
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function toggleSelectMode() {
    setSelectMode((v) => !v);
    setSelectedIds(new Set());
    setConfirmDelete(false);
  }

  function toggleDeck(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function handleDeleteSelected() {
    if (selectedIds.size === 0) return;
    setDeleting(true);
    const ids = Array.from(selectedIds);
    await Promise.all(
      ids.map((id) =>
        fetch(`/api/decks/${id}`, { method: "DELETE" }).catch(() => null),
      ),
    );
    setDecks((prev) => prev.filter((d) => !selectedIds.has(d.id)));
    setSelectedIds(new Set());
    setSelectMode(false);
    setConfirmDelete(false);
    setDeleting(false);
  }

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

  // Derived: jump-back-in deck — most recently studied that still has content
  const jumpDeck =
    stats && decks.length > 0
      ? (stats.recentDeckIds
          .map((id) => decks.find((d) => d.id === id))
          .find((d): d is DeckWithStats => d !== undefined) ?? null)
      : null;

  // Unified sorted deck list:
  // 1. Decks with dueCount > 0 — sorted desc by due count
  // 2. Recently studied decks (no due cards)
  // 3. Everything else
  const sortedDecks = stats
    ? (() => {
        const recentSet = new Set(stats.recentDeckIds);
        const withDue = decks
          .filter((d) => (stats.dueCounts[d.id] ?? 0) > 0)
          .sort((a, b) => (stats.dueCounts[b.id] ?? 0) - (stats.dueCounts[a.id] ?? 0));
        const recentNoDue = decks.filter(
          (d) => recentSet.has(d.id) && (stats.dueCounts[d.id] ?? 0) === 0,
        );
        const dueIds = new Set(withDue.map((d) => d.id));
        const recentNoDueIds = new Set(recentNoDue.map((d) => d.id));
        const rest = decks.filter((d) => !dueIds.has(d.id) && !recentNoDueIds.has(d.id));
        return [...withDue, ...recentNoDue, ...rest];
      })()
    : decks;

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
        {!loading && !error && (
          <div className="flex items-center gap-2">
            {decks.length > 0 && !selectMode && (
              <>
                <Link
                  href="/quiz/quick"
                  className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted/40 hover:text-foreground"
                  style={{
                    borderColor: "oklch(0.65 0.18 265 / 0.35)",
                    color: "oklch(0.65 0.18 265 / 0.85)",
                  }}
                >
                  Quick Quiz
                </Link>
                <Link
                  href="/import"
                  className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors hover:opacity-90"
                  style={{ background: "oklch(0.77 0.195 68)", color: "oklch(0.15 0.05 68)" }}
                >
                  Import notes
                </Link>
              </>
            )}
            {!selectMode && (
              <button
                onClick={() => setShowNewDeck(true)}
                className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-primary/10 hover:text-primary"
                style={{ borderColor: "oklch(0.77 0.195 68 / 0.35)", color: "oklch(0.77 0.195 68 / 0.85)" }}
              >
                + New deck
              </button>
            )}
          </div>
        )}
      </div>

      {/* Loading skeletons */}
      {loading && (
        <div className="space-y-8">
          <div className="grid grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 rounded-xl border border-border/40 bg-card/60 animate-pulse" />
            ))}
          </div>
          <div className="h-20 rounded-2xl border border-border/40 bg-card/60 animate-pulse" />
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
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/50 py-28 text-center animate-fade-up">
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 shadow-[0_0_24px_oklch(0.77_0.195_68_/_0.10)]">
            <svg
              className="h-6 w-6 text-primary"
              fill="currentColor"
              viewBox="0 0 20 20"
              aria-hidden="true"
            >
              <path d="M10 1.5C10 1.5 10.9 7.2 13.8 9.5C16.4 11.6 20 11 20 11C20 11 16.4 10.4 13.8 12.5C10.9 14.8 10 20 10 20C10 20 9.1 14.8 6.2 12.5C3.6 10.4 0 11 0 11C0 11 3.6 11.6 6.2 9.5C9.1 7.2 10 1.5 10 1.5Z" />
            </svg>
          </div>
          <h2 className="font-heading text-xl font-bold tracking-tight text-foreground">
            Start learning something new
          </h2>
          <p className="mt-2.5 max-w-sm text-sm text-muted-foreground/70">
            Generate flashcards from a topic, paste your notes, or import a Markdown file.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => setShowNewDeck(true)}
              className={buttonVariants({ size: "sm" })}
            >
              + New deck
            </button>
            <Link
              href="/generate"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Generate from topic
            </Link>
            <Link
              href="/notes"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Paste notes
            </Link>
            <Link
              href="/import"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Import file
            </Link>
          </div>
        </div>
      )}

      <NewDeckDialog
        open={showNewDeck}
        onClose={() => setShowNewDeck(false)}
        onCreated={(id) => {
          setShowNewDeck(false);
          router.push(`/decks/${id}`);
        }}
      />

      {/* Main content — only when loaded with data */}
      {!loading && !error && decks.length > 0 && stats && (
        <div>
          {/* Stats banner */}
          <StatBanner stats={stats} />

          {/* Jump back in — hero CTA if recently studied */}
          {jumpDeck && (
            <JumpBackInCard
              deck={jumpDeck}
              dueCount={stats.dueCounts[jumpDeck.id] ?? 0}
            />
          )}

          {/* Deck grid header row */}
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground/60">
              Your decks
            </p>
            <div className="flex items-center gap-2">
              {selectMode && (
                <button
                  onClick={() => {
                    const allSelected = selectedIds.size === sortedDecks.length;
                    setSelectedIds(allSelected ? new Set() : new Set(sortedDecks.map((d) => d.id)));
                  }}
                  className="rounded-md border px-3 py-1 text-xs font-medium transition-colors hover:bg-primary/10"
                  style={{ borderColor: "oklch(0.77 0.195 68 / 0.35)", color: "oklch(0.77 0.195 68 / 0.85)" }}
                >
                  {selectedIds.size === sortedDecks.length ? "Deselect all" : "Select all"}
                </button>
              )}
              {selectMode ? (
                <button
                  onClick={toggleSelectMode}
                  className="rounded-md border px-3 py-1 text-xs font-medium transition-colors hover:bg-muted/40"
                  style={{ borderColor: "oklch(0.225 0.011 65)", color: "oklch(0.50 0.018 72)" }}
                >
                  Cancel
                </button>
              ) : (
                <button
                  onClick={toggleSelectMode}
                  className="rounded-md border px-3 py-1 text-xs font-medium transition-colors hover:bg-primary/10"
                  style={{ borderColor: "oklch(0.77 0.195 68 / 0.35)", color: "oklch(0.77 0.195 68 / 0.85)" }}
                >
                  Select
                </button>
              )}
            </div>
          </div>

          {/* Unified deck grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sortedDecks.map((deck, i) => (
              <div key={deck.id} className="animate-card-in" style={{ animationDelay: `${i * 50}ms` }}>
                <DeckCard
                  deck={deck}
                  dueCount={stats.dueCounts[deck.id] ?? 0}
                  selectMode={selectMode}
                  selected={selectedIds.has(deck.id)}
                  onSelect={() => toggleDeck(deck.id)}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Floating action bar — visible when 1+ decks are selected */}
      {selectMode && selectedIds.size > 0 && (
        <div className="fixed bottom-8 left-1/2 z-50 -translate-x-1/2">
          <div
            className="flex items-center gap-4 rounded-2xl border border-border bg-card/95 px-5 py-3.5 shadow-xl backdrop-blur-md select-none"
            style={{ minWidth: "320px", maxWidth: "420px" }}
          >
            {confirmDelete ? (
              /* Confirm state */
              <>
                <p className="flex-1 text-sm text-muted-foreground">
                  Are you sure? This can&apos;t be undone.
                </p>
                <button
                  onClick={() => setConfirmDelete(false)}
                  disabled={deleting}
                  className="rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground/70 transition-colors hover:text-foreground disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteSelected}
                  disabled={deleting}
                  className="rounded-md border px-3 py-1.5 text-xs font-semibold transition-all duration-200 hover:opacity-90 disabled:opacity-50"
                  style={{
                    border: "1px solid oklch(0.65 0.2 27 / 0.6)",
                    color: "oklch(0.75 0.2 27)",
                  }}
                >
                  {deleting ? "Deleting…" : "Confirm"}
                </button>
              </>
            ) : (
              /* Default state */
              <>
                <p className="flex-1 text-sm font-medium text-muted-foreground">
                  <span className="font-heading font-semibold text-foreground">
                    {selectedIds.size}
                  </span>{" "}
                  {selectedIds.size === 1 ? "deck" : "decks"} selected
                </p>
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="rounded-md border px-3.5 py-1.5 text-xs font-semibold transition-all duration-200 hover:opacity-90"
                  style={{
                    border: "1px solid oklch(0.65 0.2 27 / 0.6)",
                    color: "oklch(0.75 0.2 27)",
                  }}
                >
                  Delete
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
