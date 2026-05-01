"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type PublicDeck = {
  id: string;
  title: string;
  topic_tags: string[];
  card_count: number;
  created_at: string;
  publisher_name: string | null;
};

function popularTags(decks: PublicDeck[]): string[] {
  const counts: Record<string, number> = {};
  for (const deck of decks) {
    for (const tag of deck.topic_tags) {
      counts[tag] = (counts[tag] ?? 0) + 1;
    }
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tag]) => tag);
}

function DeckCard({
  deck,
  forkingId,
  onFork,
  onTagClick,
}: {
  deck: PublicDeck;
  forkingId: string | null;
  onFork: (id: string) => void;
  onTagClick: (tag: string) => void;
}) {
  return (
    <div className="flex flex-col justify-between rounded-2xl border border-border/50 bg-card p-5 transition-all duration-200 hover:border-primary/30 hover:shadow-[0_8px_24px_-8px_oklch(0.77_0.195_68_/_0.15)]">
      <div>
        <h3 className="font-heading text-base font-bold leading-snug text-foreground line-clamp-2">
          {deck.title}
        </h3>
        <p className="mt-1 text-[11px] text-muted-foreground/55">
          by {deck.publisher_name ?? "Anonymous"}
        </p>
        {deck.topic_tags.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {deck.topic_tags.slice(0, 3).map((tag) => (
              <button
                key={tag}
                onClick={() => onTagClick(tag)}
                className="rounded-full border border-border/50 bg-muted/30 px-2 py-0.5 text-[10px] text-muted-foreground/65 transition-colors hover:border-primary/30 hover:text-primary"
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="mt-4 flex items-center justify-between">
        <span className="text-xs text-muted-foreground/55">
          {deck.card_count} {deck.card_count === 1 ? "card" : "cards"}
        </span>
        <button
          onClick={() => onFork(deck.id)}
          disabled={forkingId === deck.id}
          className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20 disabled:opacity-60"
        >
          {forkingId === deck.id ? "Forking…" : "Fork"}
        </button>
      </div>
    </div>
  );
}

export default function CommunityPage() {
  const router = useRouter();

  const [recentDecks, setRecentDecks] = useState<PublicDeck[]>([]);
  const [recentLoading, setRecentLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [results, setResults] = useState<PublicDeck[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  const [forkingId, setForkingId] = useState<string | null>(null);

  // Load recent decks on mount
  useEffect(() => {
    fetch("/api/community")
      .then((r) => r.json())
      .then((json) => setRecentDecks(json.decks ?? []))
      .finally(() => setRecentLoading(false));
  }, []);

  const tags = popularTags(recentDecks);
  const isFiltering = searched || activeTag !== null;
  const displayDecks = isFiltering ? results : recentDecks.slice(0, 9);
  const sectionLabel = activeTag
    ? `Decks tagged "${activeTag}"`
    : searched && query
    ? `Results for "${query}"`
    : "Recently published";

  async function search(q: string, tag?: string) {
    setSearching(true);
    setSearched(true);
    const term = tag ?? q;
    const res = await fetch(`/api/community?q=${encodeURIComponent(term)}`);
    const json = await res.json();
    setResults(json.decks ?? []);
    setSearching(false);
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setActiveTag(null);
    await search(query);
  }

  async function handleTagClick(tag: string) {
    setActiveTag(tag);
    setQuery("");
    setSearched(false);
    await search("", tag);
  }

  function handleClear() {
    setQuery("");
    setActiveTag(null);
    setSearched(false);
    setResults([]);
  }

  async function handleFork(deckId: string) {
    setForkingId(deckId);
    const res = await fetch("/api/community/fork", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deckId }),
    });
    if (res.status === 401) {
      setForkingId(null);
      router.push("/login");
      return;
    }
    if (res.ok) {
      const { deckId: newId } = await res.json();
      router.push(`/decks/${newId}`);
    }
    setForkingId(null);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:py-10">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-bold text-foreground">Community</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Browse public decks and fork them to your dashboard.
        </p>
      </div>

      {/* Search bar */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by topic or title…"
          className="flex-1 rounded-xl border border-border/50 bg-muted/20 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/20"
        />
        <button
          type="submit"
          disabled={searching}
          className="rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {searching ? "Searching…" : "Search"}
        </button>
      </form>

      {/* Popular tags */}
      {tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <button
              key={tag}
              onClick={() => handleTagClick(tag)}
              className="rounded-full px-3 py-1 text-xs font-medium transition-colors"
              style={
                activeTag === tag
                  ? {
                      border: "1px solid oklch(0.77 0.195 68 / 0.6)",
                      background: "oklch(0.77 0.195 68 / 0.12)",
                      color: "oklch(0.77 0.195 68)",
                    }
                  : {
                      border: "1px solid oklch(0.77 0.195 68 / 0.3)",
                      color: "oklch(0.77 0.195 68 / 0.7)",
                    }
              }
            >
              {tag}
            </button>
          ))}
          {isFiltering && (
            <button
              onClick={handleClear}
              className="rounded-full border border-border/40 px-3 py-1 text-xs font-medium text-muted-foreground/60 transition-colors hover:border-border hover:text-foreground"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* Section */}
      <div className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground/60">
            {sectionLabel}
          </p>
          {!isFiltering && recentDecks.length > 9 && (
            <button
              onClick={() => search("")}
              className="text-[10px] text-muted-foreground/50 transition-colors hover:text-foreground"
            >
              View all {recentDecks.length}
            </button>
          )}
        </div>

        {/* Loading skeleton */}
        {(recentLoading || searching) && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-36 animate-pulse rounded-2xl border border-border/40 bg-card/60"
                style={{ animationDelay: `${i * 60}ms` }}
              />
            ))}
          </div>
        )}

        {/* Empty state after search */}
        {!recentLoading && !searching && isFiltering && displayDecks.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/50 py-16 text-center">
            <p className="text-sm font-medium text-foreground">No decks found</p>
            <p className="mt-1 text-xs text-muted-foreground/60">
              Try a different search or browse by tag
            </p>
            <button
              onClick={handleClear}
              className="mt-4 rounded-lg border border-border/50 px-4 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Back to recent
            </button>
          </div>
        )}

        {/* No public decks at all */}
        {!recentLoading && !searching && !isFiltering && recentDecks.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/50 py-16 text-center">
            <p className="text-sm font-medium text-foreground">No public decks yet</p>
            <p className="mt-1 text-xs text-muted-foreground/60">
              Be the first — publish a deck from its detail page.
            </p>
          </div>
        )}

        {/* Deck grid */}
        {!recentLoading && !searching && displayDecks.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {displayDecks.map((deck) => (
              <DeckCard
                key={deck.id}
                deck={deck}
                forkingId={forkingId}
                onFork={handleFork}
                onTagClick={handleTagClick}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
