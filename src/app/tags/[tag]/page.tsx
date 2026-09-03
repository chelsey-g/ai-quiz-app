"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { DeckCard, type DeckWithStats } from "@/components/deck-card";
import { CollectionPopover } from "@/components/collection-popover";

export default function TagPage() {
  const { tag } = useParams<{ tag: string }>();
  const router = useRouter();
  const decoded = decodeURIComponent(tag);

  const [decks, setDecks] = useState<DeckWithStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/tags/${encodeURIComponent(decoded)}`);
      if (!res.ok) { setLoading(false); return; }
      const data = await res.json();
      setDecks(data.decks ?? []);
      setLoading(false);
    }
    load();
  }, [decoded]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10 animate-fade-up">
      <button
        onClick={() => router.back()}
        className="mb-8 flex items-center gap-1.5 text-xs text-muted-foreground/60 transition-colors hover:text-foreground"
      >
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      <div className="mb-8 flex items-baseline gap-3">
        <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {decoded}
        </h1>
        {!loading && (
          <span className="text-sm text-muted-foreground/60">
            {decks.length} {decks.length === 1 ? "deck" : "decks"}
          </span>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-40 rounded-2xl border border-border/40 bg-card/60 animate-pulse" />
          ))}
        </div>
      ) : decks.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/50 py-20 text-center">
          <p className="text-sm font-medium text-foreground">No decks tagged &ldquo;{decoded}&rdquo;</p>
          <p className="mt-1.5 text-sm text-muted-foreground/60">Tags are added automatically when you generate or import a deck.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {decks.map((deck, i) => (
            <div
              key={deck.id}
              className="animate-card-in h-full"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <DeckCard deck={deck} topAction={<CollectionPopover deckId={deck.id} />} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
