"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DeckCard, type DeckWithStats } from "@/components/deck-card";
import { CollectionPopover } from "@/components/collection-popover";

type SortMode = "alpha" | "created" | "studied" | "size";

const SORT_LABELS: Record<SortMode, string> = {
  alpha: "A → Z",
  created: "Newest",
  studied: "Last studied",
  size: "Most cards",
};

type DashboardStats = {
  recentDeckIds: string[];
};

export default function AllDecksPage() {
  const router = useRouter();
  const [decks, setDecks] = useState<DeckWithStats[]>([]);
  const [recentDeckIds, setRecentDeckIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("studied");

  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("deck-sort") as SortMode | null;
    if (saved && saved in SORT_LABELS) setSortMode(saved);
  }, []);

  function handleSortChange(mode: SortMode) {
    setSortMode(mode);
    localStorage.setItem("deck-sort", mode);
  }

  useEffect(() => {
    async function load() {
      const [decksRes, statsRes] = await Promise.all([
        fetch("/api/decks"),
        fetch("/api/dashboard"),
      ]);
      if (!decksRes.ok) {
        setError("Failed to load decks");
        setLoading(false);
        return;
      }
      const decksData = (await decksRes.json()) as DeckWithStats[];
      setDecks(decksData);
      if (statsRes.ok) {
        const statsData = (await statsRes.json()) as DashboardStats;
        setRecentDeckIds(statsData.recentDeckIds ?? []);
      }
      setLoading(false);
    }
    load();
  }, []);

  function toggleSelectMode() {
    setSelectMode((v) => !v);
    setSelectedIds(new Set());
    setConfirmDelete(false);
  }

  function toggleDeck(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleDeleteSelected() {
    if (selectedIds.size === 0) return;
    setDeleting(true);
    const ids = Array.from(selectedIds);
    await Promise.all(
      ids.map((id) => fetch(`/api/decks/${id}`, { method: "DELETE" }).catch(() => null))
    );
    setDecks((prev) => prev.filter((d) => !selectedIds.has(d.id)));
    setSelectedIds(new Set());
    setSelectMode(false);
    setConfirmDelete(false);
    setDeleting(false);
  }

  const sortedDecks = (() => {
    const copy = [...decks];
    if (sortMode === "alpha") return copy.sort((a, b) => a.title.localeCompare(b.title));
    if (sortMode === "created")
      return copy.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    if (sortMode === "size") return copy.sort((a, b) => b.card_count - a.card_count);
    const recentIndex = Object.fromEntries(recentDeckIds.map((id, i) => [id, i]));
    return copy.sort((a, b) => {
      const ai = recentIndex[a.id] ?? Infinity;
      const bi = recentIndex[b.id] ?? Infinity;
      return ai !== bi
        ? ai - bi
        : new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  })();

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10 animate-fade-up">
      <Link
        href="/collections"
        className="mb-8 flex items-center gap-1.5 text-xs text-muted-foreground/60 transition-colors hover:text-foreground"
      >
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Collections
      </Link>

      <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">
            All Decks
          </h1>
          {!loading && !error && (
            <p className="mt-1.5 text-sm text-muted-foreground/70">
              {decks.length} {decks.length === 1 ? "deck" : "decks"}
            </p>
          )}
        </div>
      </div>

      {loading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-40 rounded-2xl border border-border/40 bg-card/60 animate-pulse"
              style={{ animationDelay: `${i * 60}ms` }}
            />
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground/60 shrink-0">
              Your decks
            </p>
            <div className="flex items-center gap-2">
              {!selectMode && (
                <div className="relative">
                  <select
                    value={sortMode}
                    onChange={(e) => handleSortChange(e.target.value as SortMode)}
                    className="appearance-none rounded-md border border-border/50 bg-card pl-2 pr-7 py-1 text-xs text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 cursor-pointer"
                  >
                    {(Object.keys(SORT_LABELS) as SortMode[]).map((m) => (
                      <option key={m} value={m}>
                        {SORT_LABELS[m]}
                      </option>
                    ))}
                  </select>
                  <svg
                    className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground/70"
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 8l4 4 4-4" />
                  </svg>
                </div>
              )}
              {selectMode && (
                <button
                  onClick={() => {
                    const allSelected = selectedIds.size === sortedDecks.length;
                    setSelectedIds(
                      allSelected ? new Set() : new Set(sortedDecks.map((d) => d.id))
                    );
                  }}
                  className="rounded-lg border px-3 py-1 text-xs font-medium transition-colors hover:bg-primary/10"
                  style={{
                    borderColor: "color-mix(in oklch, var(--dashboard-accent-teal) 45%, transparent)",
                    color: "var(--dashboard-accent-teal-strong)",
                  }}
                >
                  {selectedIds.size === sortedDecks.length ? "Deselect all" : "Select all"}
                </button>
              )}
              {selectMode ? (
                <button
                  onClick={toggleSelectMode}
                  className="rounded-lg border px-3 py-1 text-xs font-medium transition-colors hover:bg-muted/40"
                  style={{
                    borderColor: "color-mix(in oklch, var(--border) 80%, transparent)",
                    color: "color-mix(in oklch, var(--foreground) 62%, var(--muted-foreground) 38%)",
                  }}
                >
                  Cancel
                </button>
              ) : (
                <button
                  onClick={toggleSelectMode}
                  className="rounded-lg border px-3 py-1 text-xs font-medium transition-colors hover:bg-primary/10"
                  style={{
                    borderColor: "color-mix(in oklch, var(--dashboard-accent-coral) 45%, transparent)",
                    color: "var(--dashboard-accent-coral)",
                  }}
                >
                  Select
                </button>
              )}
            </div>
          </div>

          {decks.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/50 py-20 text-center">
              <p className="text-sm font-medium text-foreground">No decks yet</p>
              <p className="mt-1.5 text-sm text-muted-foreground/60">
                Create a deck from the Dashboard to get started.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {sortedDecks.map((deck, i) => (
                <div
                  key={deck.id}
                  className="animate-card-in h-full"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <DeckCard
                    deck={deck}
                    selectMode={selectMode}
                    selected={selectedIds.has(deck.id)}
                    onSelect={() => toggleDeck(deck.id)}
                    topAction={!selectMode ? <CollectionPopover deckId={deck.id} /> : undefined}
                  />
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Floating action bar */}
      {selectMode && selectedIds.size > 0 && (
        <div className="fixed top-4 left-1/2 z-50 -translate-x-1/2 w-[calc(100%-2rem)] max-w-[420px]">
          <div className="flex items-center gap-4 rounded-2xl border border-border bg-card/95 px-5 py-3.5 shadow-xl backdrop-blur-md select-none">
            {confirmDelete ? (
              <>
                <p className="flex-1 text-sm text-muted-foreground">
                  Are you sure? This can&apos;t be undone.
                </p>
                <button
                  onClick={() => setConfirmDelete(false)}
                  disabled={deleting}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground/70 transition-colors hover:text-foreground disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteSelected}
                  disabled={deleting}
                  className="rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all duration-200 hover:opacity-90 disabled:opacity-50"
                  style={{
                    border: "1px solid color-mix(in oklch, var(--dashboard-accent-rose) 65%, transparent)",
                    color: "var(--dashboard-accent-rose)",
                  }}
                >
                  {deleting ? "Deleting…" : "Confirm"}
                </button>
              </>
            ) : (
              <>
                <p className="flex-1 text-sm font-medium text-muted-foreground">
                  <span className="font-heading font-semibold text-foreground">{selectedIds.size}</span>{" "}
                  {selectedIds.size === 1 ? "deck" : "decks"} selected
                </p>
                <button
                  onClick={() => {
                    const ids = Array.from(selectedIds).join(",");
                    router.push(`/quiz/quick?decks=${ids}&limit=200`);
                  }}
                  className="rounded-lg border px-3.5 py-1.5 text-xs font-semibold transition-all duration-200 hover:opacity-90"
                  style={{
                    border: "1px solid color-mix(in oklch, var(--dashboard-accent-teal) 65%, transparent)",
                    color: "var(--dashboard-accent-teal-strong)",
                  }}
                >
                  Create Quiz
                </button>
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="rounded-lg border px-3.5 py-1.5 text-xs font-semibold transition-all duration-200 hover:opacity-90"
                  style={{
                    border: "1px solid color-mix(in oklch, var(--dashboard-accent-rose) 65%, transparent)",
                    color: "var(--dashboard-accent-rose)",
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
