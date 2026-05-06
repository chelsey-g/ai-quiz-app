"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { DeckCard, type DeckWithStats } from "@/components/deck-card";
import { CollectionPopover } from "@/components/collection-popover";
import { Button } from "@/components/ui/button";

type Collection = {
  id: string;
  name: string;
  is_public: boolean;
  created_at: string;
};

export default function CollectionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [collection, setCollection] = useState<Collection | null>(null);
  const [decks, setDecks] = useState<DeckWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/collections/${id}`);
      if (!res.ok) {
        setError("Collection not found");
        setLoading(false);
        return;
      }
      const { collection, decks } = await res.json();
      setCollection(collection);
      setDecks(decks);
      setLoading(false);
    }
    load();
  }, [id]);

  async function handleSaveName() {
    const name = nameInput.trim();
    setEditingName(false);
    if (!name || !collection || name === collection.name) return;
    await fetch(`/api/collections/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setCollection((prev) => (prev ? { ...prev, name } : prev));
  }

  async function handleDelete() {
    await fetch(`/api/collections/${id}`, { method: "DELETE" });
    router.push("/collections");
  }

  async function handleRemoveDeck(deckId: string) {
    setRemovingId(deckId);
    await fetch(`/api/collections/${id}/decks`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deck_id: deckId }),
    });
    setDecks((prev) => prev.filter((d) => d.id !== deckId));
    setRemovingId(null);
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10 space-y-4">
        <div className="h-7 w-48 rounded-lg bg-card/80 animate-pulse" />
        <div className="h-4 w-24 rounded-lg bg-card/60 animate-pulse" />
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-40 rounded-2xl border border-border/40 bg-card/60 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !collection) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        <p className="text-sm text-destructive">{error ?? "Not found"}</p>
        <Button variant="ghost" size="sm" className="mt-4" onClick={() => router.push("/collections")}>
          ← Collections
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10 animate-fade-up">
      <button
        onClick={() => router.push("/collections")}
        className="mb-8 flex items-center gap-1.5 text-xs text-muted-foreground/60 transition-colors hover:text-foreground"
      >
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Collections
      </button>

      <div className="mb-8 flex flex-wrap items-start justify-between gap-3">
        <div>
          {editingName ? (
            <input
              autoFocus
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onBlur={handleSaveName}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); handleSaveName(); }
                if (e.key === "Escape") setEditingName(false);
              }}
              className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl w-full bg-transparent border-b-2 border-primary/50 focus:outline-none pb-0.5"
            />
          ) : (
            <div className="group flex items-center gap-2">
              <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                {collection.name}
              </h1>
              <button
                type="button"
                onClick={() => { setNameInput(collection.name); setEditingName(true); }}
                className="flex h-7 w-7 items-center justify-center rounded-lg opacity-0 transition-all group-hover:opacity-100 hover:bg-muted/40"
                title="Rename collection"
              >
                <svg className="h-3.5 w-3.5 text-muted-foreground/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                </svg>
              </button>
            </div>
          )}
          <p className="mt-1.5 text-sm text-muted-foreground/60">
            {decks.length} {decks.length === 1 ? "deck" : "decks"}
          </p>
        </div>

        <div>
          {showDeleteConfirm ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground/70">Delete collection?</span>
              <button
                onClick={handleDelete}
                className="rounded-md px-2.5 py-1 text-xs font-medium transition-colors"
                style={{
                  background: "oklch(0.55 0.2 27 / 0.12)",
                  border: "1px solid oklch(0.55 0.2 27 / 0.4)",
                  color: "oklch(0.75 0.18 27)",
                }}
              >
                Confirm
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="rounded-md border px-2.5 py-1 text-xs font-medium text-muted-foreground/70 hover:text-foreground"
                style={{ border: "1px solid oklch(0.5 0.01 65 / 0.3)" }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="rounded-md border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-destructive/5"
              style={{
                borderColor: "color-mix(in oklch, var(--destructive) 35%, transparent)",
                color: "var(--destructive)",
              }}
            >
              Delete collection
            </button>
          )}
        </div>
      </div>

      {decks.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/50 py-20 text-center">
          <p className="text-sm font-medium text-foreground">No decks in this collection</p>
          <p className="mt-1.5 text-sm text-muted-foreground/60">
            Add decks using the folder icon on any deck card.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {decks.map((deck, i) => (
            <div
              key={deck.id}
              className="animate-card-in h-full"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className="relative h-full">
                <DeckCard
                  deck={deck}
                  topAction={<CollectionPopover deckId={deck.id} />}
                />
                <button
                  onClick={() => handleRemoveDeck(deck.id)}
                  disabled={removingId === deck.id}
                  className="absolute bottom-3 right-3 z-10 rounded-md border px-2 py-1 text-[10px] font-medium transition-colors hover:bg-destructive/5 disabled:opacity-40"
                  style={{
                    borderColor: "color-mix(in oklch, var(--destructive) 30%, transparent)",
                    color: "var(--destructive)",
                  }}
                >
                  {removingId === deck.id ? "Removing…" : "Remove"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
