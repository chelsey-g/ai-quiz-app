"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type PublicDeck = {
  id: string;
  title: string;
  topic_tags: string[];
  card_count: number;
  created_at: string;
  publisher_name: string | null;
};

export default function CommunityPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [decks, setDecks] = useState<PublicDeck[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [forkingId, setForkingId] = useState<string | null>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setSearched(true);
    const res = await fetch(`/api/community?q=${encodeURIComponent(query)}`);
    const json = await res.json();
    setDecks(json.decks ?? []);
    setLoading(false);
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
      <h1 className="font-heading text-2xl font-bold text-foreground">Community Decks</h1>
      <p className="mt-1 text-sm text-muted-foreground">Search public decks and fork them to your dashboard.</p>

      <form onSubmit={handleSearch} className="mt-6 flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by topic or title…"
          className="flex-1 rounded-xl border border-border/50 bg-muted/20 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/20"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {loading ? "Searching…" : "Search"}
        </button>
      </form>

      {searched && !loading && decks.length === 0 && (
        <p className="mt-12 text-center text-sm text-muted-foreground">No public decks found for &ldquo;{query}&rdquo;.</p>
      )}

      {decks.length > 0 && (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {decks.map((deck) => (
            <div
              key={deck.id}
              className="flex flex-col justify-between rounded-2xl border border-border/50 bg-card p-5"
            >
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
                      <span
                        key={tag}
                        className="rounded-full border border-border/50 bg-muted/30 px-2 py-0.5 text-[10px] text-muted-foreground/65"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs text-muted-foreground/55">
                  {deck.card_count} {deck.card_count === 1 ? "card" : "cards"}
                </span>
                <button
                  onClick={() => handleFork(deck.id)}
                  disabled={forkingId === deck.id}
                  className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20 disabled:opacity-60"
                >
                  {forkingId === deck.id ? "Forking…" : "Fork"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!searched && (
        <p className="mt-16 text-center text-sm text-muted-foreground/50">
          Enter a topic above to discover public decks.
        </p>
      )}
    </div>
  );
}
