"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type PublicDeck = {
  id: string;
  title: string;
  topic_tags: string[];
  card_count: number;
  created_at: string;
  user_id: string | null;
  publisher_name: string | null;
  publisher_avatar_url: string | null;
  already_forked: boolean;
};

function PublisherAvatar({ name, avatarUrl }: { name: string | null; avatarUrl: string | null }) {
  const initial = (name ?? "A").charAt(0).toUpperCase();
  return (
    <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border/40 bg-primary/15 align-middle">
      {avatarUrl ? (
        <img src={avatarUrl} alt={name ?? "avatar"} className="h-full w-full object-cover" />
      ) : (
        <span className="text-[8px] font-bold leading-none text-primary">{initial}</span>
      )}
    </span>
  );
}

type PreviewCard = { id: string; front: string; back: string };

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

function PreviewModal({
  deck,
  cards,
  loading,
  forkingId,
  currentUserId,
  onFork,
  onClose,
}: {
  deck: PublicDeck;
  cards: PreviewCard[];
  loading: boolean;
  forkingId: string | null;
  currentUserId: string | null;
  onFork: (id: string) => void;
  onClose: () => void;
}) {
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());

  function toggleReveal(cardId: string) {
    setRevealedIds((prev) => {
      const next = new Set(prev);
      next.has(cardId) ? next.delete(cardId) : next.add(cardId);
      return next;
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative z-10 flex w-full flex-col rounded-t-2xl border border-border bg-card shadow-2xl sm:max-w-xl sm:rounded-2xl"
           style={{ maxHeight: "85dvh" }}>
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border/50 px-5 py-4">
          <div className="min-w-0 pr-4">
            <h2 className="font-heading text-base font-bold leading-snug text-foreground line-clamp-2">
              {deck.title}
            </h2>
            <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground/55">
              <PublisherAvatar name={deck.publisher_name} avatarUrl={deck.publisher_avatar_url} />
              {deck.user_id === currentUserId && deck.publisher_name ? (
                <Link href="/profile" className="hover:text-foreground transition-colors" onClick={onClose}>
                  {deck.publisher_name}
                </Link>
              ) : (
                deck.publisher_name ?? "Anonymous"
              )}
              {" · "}{deck.card_count} {deck.card_count === 1 ? "card" : "cards"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground/60 transition-colors hover:bg-muted/40 hover:text-foreground"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Card list */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-xl border border-border/40 bg-muted/30" />
            ))
          ) : cards.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground/60">No cards in this deck.</p>
          ) : (
            cards.map((card, idx) => {
              const revealed = revealedIds.has(card.id);
              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => toggleReveal(card.id)}
                  className="w-full rounded-xl border border-border/40 bg-card px-4 py-3 text-left transition-colors hover:border-primary/30 hover:bg-muted/20"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">
                        <span className="mr-2 text-[10px] font-medium uppercase tracking-widest text-muted-foreground/50">{idx + 1}</span>
                        {card.front}
                      </p>
                      {revealed && (
                        <p className="mt-2 text-sm text-muted-foreground/80 border-t border-border/40 pt-2">
                          {card.back}
                        </p>
                      )}
                    </div>
                    <svg
                      className={`h-4 w-4 shrink-0 mt-1 text-muted-foreground/30 transition-transform ${revealed ? "rotate-180" : ""}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border/50 px-5 py-4">
          {deck.already_forked ? (
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground/60">Already in your library</p>
              <span className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                Forked ✓
              </span>
            </div>
          ) : (
            <button
              onClick={() => onFork(deck.id)}
              disabled={forkingId === deck.id}
              className="w-full rounded-xl bg-primary py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {forkingId === deck.id ? "Forking…" : "Fork to my library"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function DeckCard({
  deck,
  forkingId,
  currentUserId,
  onFork,
  onTagClick,
  onPreview,
}: {
  deck: PublicDeck;
  forkingId: string | null;
  currentUserId: string | null;
  onFork: (id: string) => void;
  onTagClick: (tag: string) => void;
  onPreview: (deck: PublicDeck) => void;
}) {
  return (
    <div className="flex flex-col justify-between rounded-2xl border border-border/50 bg-card p-5 transition-all duration-200 hover:border-primary/30 hover:shadow-[0_8px_24px_-8px_oklch(0.77_0.195_68_/_0.15)]">
      <button
        type="button"
        className="text-left"
        onClick={() => onPreview(deck)}
      >
        <h3 className="font-heading text-base font-bold leading-snug text-foreground line-clamp-2">
          {deck.title}
        </h3>
        <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground/55">
          <PublisherAvatar name={deck.publisher_name} avatarUrl={deck.publisher_avatar_url} />
          {deck.user_id === currentUserId && deck.publisher_name ? (
            <Link
              href="/profile"
              className="hover:text-foreground transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              {deck.publisher_name}
            </Link>
          ) : (
            deck.publisher_name ?? "Anonymous"
          )}
        </p>
        {deck.topic_tags.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {deck.topic_tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                onClick={(e) => { e.stopPropagation(); onTagClick(tag); }}
                className="cursor-pointer rounded-full border border-border/50 bg-muted/30 px-2 py-0.5 text-[10px] text-muted-foreground/65 transition-colors hover:border-primary/30 hover:text-primary"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </button>
      <div className="mt-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => onPreview(deck)}
          className="text-xs text-muted-foreground/55 hover:text-primary transition-colors"
        >
          {deck.card_count} {deck.card_count === 1 ? "card" : "cards"} · Preview
        </button>
        {deck.already_forked ? (
          <span className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            Forked ✓
          </span>
        ) : (
          <button
            onClick={() => onFork(deck.id)}
            disabled={forkingId === deck.id}
            className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20 disabled:opacity-60"
          >
            {forkingId === deck.id ? "Forking…" : "Fork"}
          </button>
        )}
      </div>
    </div>
  );
}

export default function CommunityPage() {
  const router = useRouter();

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [recentDecks, setRecentDecks] = useState<PublicDeck[]>([]);
  const [recentLoading, setRecentLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [results, setResults] = useState<PublicDeck[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  const [forkingId, setForkingId] = useState<string | null>(null);

  const [previewDeck, setPreviewDeck] = useState<PublicDeck | null>(null);
  const [previewCards, setPreviewCards] = useState<PreviewCard[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Load recent decks on mount
  useEffect(() => {
    fetch("/api/community")
      .then((r) => r.json())
      .then((json) => {
        setRecentDecks(json.decks ?? []);
        setCurrentUserId(json.current_user_id ?? null);
      })
      .finally(() => setRecentLoading(false));
  }, []);

  // Close preview on Escape
  useEffect(() => {
    if (!previewDeck) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setPreviewDeck(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [previewDeck]);

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

  async function handlePreview(deck: PublicDeck) {
    setPreviewDeck(deck);
    setPreviewCards([]);
    setPreviewLoading(true);
    const res = await fetch(`/api/community/${deck.id}`);
    const json = await res.json();
    setPreviewCards(json.cards ?? []);
    setPreviewLoading(false);
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
      setPreviewDeck(null);
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
                      border:
                        "1px solid color-mix(in oklch, var(--dashboard-accent-coral) 62%, transparent)",
                      background:
                        "color-mix(in oklch, var(--dashboard-accent-coral) 14%, transparent)",
                      color: "var(--dashboard-accent-coral)",
                    }
                  : {
                      border:
                        "1px solid color-mix(in oklch, var(--dashboard-accent-coral) 35%, transparent)",
                      color:
                        "color-mix(in oklch, var(--dashboard-accent-coral) 75%, var(--muted-foreground) 25%)",
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
                currentUserId={currentUserId}
                onFork={handleFork}
                onTagClick={handleTagClick}
                onPreview={handlePreview}
              />
            ))}
          </div>
        )}
      </div>

      {/* Preview modal */}
      {previewDeck && (
        <PreviewModal
          deck={previewDeck}
          cards={previewCards}
          loading={previewLoading}
          forkingId={forkingId}
          currentUserId={currentUserId}
          onFork={handleFork}
          onClose={() => setPreviewDeck(null)}
        />
      )}
    </div>
  );
}
