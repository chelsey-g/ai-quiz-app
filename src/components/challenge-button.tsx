"use client";

import { useState } from "react";
import { ChallengeSheet } from "@/components/challenge-sheet";
import type { Database } from "@/lib/database.types";

type Card = Database["public"]["Tables"]["cards"]["Row"];
type Deck = { id: string; title: string; card_count: number };
type UserResult = { id: string; display_name: string | null; avatar_url: string | null };

type Props = {
  targetUserId: string;
  targetDisplayName: string | null;
  targetAvatarUrl: string | null;
};

export function ChallengeButton({ targetUserId, targetDisplayName, targetAvatarUrl }: Props) {
  const [phase, setPhase] = useState<"idle" | "picking" | "challenging">("idle");
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loadingDecks, setLoadingDecks] = useState(false);
  const [selectedDeck, setSelectedDeck] = useState<Deck | null>(null);
  const [deckCards, setDeckCards] = useState<Card[]>([]);
  const [loadingCards, setLoadingCards] = useState(false);

  const targetUser: UserResult = {
    id: targetUserId,
    display_name: targetDisplayName,
    avatar_url: targetAvatarUrl,
  };

  async function handleOpen() {
    setPhase("picking");
    setLoadingDecks(true);
    try {
      const res = await fetch("/api/decks");
      const data = await res.json();
      setDecks(Array.isArray(data) ? data : []);
    } finally {
      setLoadingDecks(false);
    }
  }

  async function handlePickDeck(deck: Deck) {
    setSelectedDeck(deck);
    setLoadingCards(true);
    try {
      const res = await fetch(`/api/decks/${deck.id}`);
      const data = await res.json();
      setDeckCards(data.cards ?? []);
    } finally {
      setLoadingCards(false);
      setPhase("challenging");
    }
  }

  function handleClose() {
    setPhase("idle");
    setSelectedDeck(null);
    setDeckCards([]);
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className="rounded-xl border border-border/50 bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/40"
      >
        Challenge
      </button>

      {/* Deck picker modal */}
      {phase === "picking" && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => setPhase("idle")}
          />
          <div className="relative z-10 w-full max-w-sm rounded-t-2xl border border-border bg-card p-5 shadow-2xl sm:rounded-2xl">
            <h2 className="mb-1 font-heading text-sm font-semibold text-foreground">
              Pick a deck to challenge with
            </h2>
            <p className="mb-4 text-xs text-muted-foreground/60">
              Challenging {targetDisplayName ?? "this user"}
            </p>
            {loadingDecks ? (
              <p className="py-6 text-center text-xs text-muted-foreground/50">Loading…</p>
            ) : decks.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground/50">
                You have no decks yet. Create one first.
              </p>
            ) : (
              <div className="flex max-h-64 flex-col gap-2 overflow-y-auto">
                {decks.map((deck) => (
                  <button
                    key={deck.id}
                    onClick={() => handlePickDeck(deck)}
                    disabled={loadingCards}
                    className="flex items-center justify-between rounded-xl border border-border/40 px-4 py-3 text-left text-sm transition-colors hover:border-primary/30 hover:bg-muted/30 disabled:opacity-50"
                  >
                    <span className="truncate font-medium text-foreground">{deck.title}</span>
                    <span className="ml-2 shrink-0 text-xs text-muted-foreground/50">
                      {deck.card_count} cards
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ChallengeSheet with pre-filled recipient */}
      {selectedDeck && (
        <ChallengeSheet
          open={phase === "challenging"}
          onClose={handleClose}
          deckId={selectedDeck.id}
          deckTitle={selectedDeck.title}
          cards={deckCards}
          initialRecipients={[targetUser]}
        />
      )}
    </>
  );
}
