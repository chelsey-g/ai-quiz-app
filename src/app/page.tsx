"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { DeckCard } from "@/components/deck-card";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/database.types";

type Deck = Database["public"]["Tables"]["decks"]["Row"];

export default function HomePage() {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    async function fetchDecks() {
      const { data, error } = await supabase
        .from("decks")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        setError(error.message);
      } else {
        setDecks(data ?? []);
      }
      setLoading(false);
    }

    fetchDecks();
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Decks</h1>
          {!loading && !error && decks.length > 0 && (
            <p className="mt-1 text-sm text-muted-foreground">
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
              className="h-36 rounded-lg border border-border bg-card animate-pulse"
            />
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
          <p className="text-sm text-destructive">
            Failed to load decks: {error}
          </p>
        </div>
      )}

      {!loading && !error && decks.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-24 text-center">
          <h2 className="text-sm font-medium text-foreground">No decks yet</h2>
          <p className="mt-1.5 max-w-xs text-sm text-muted-foreground">
            Import your Markdown notes to generate AI-powered study decks.
          </p>
          <Link
            href="/import"
            className={buttonVariants({ size: "sm" }) + " mt-6"}
          >
            Import notes
          </Link>
        </div>
      )}

      {!loading && !error && decks.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {decks.map((deck) => (
            <DeckCard key={deck.id} deck={deck} />
          ))}
        </div>
      )}
    </div>
  );
}
