"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { DeckCard, type DeckWithStats } from "@/components/deck-card";
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
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [renamingDeckId, setRenamingDeckId] = useState<string | null>(null);
  const [renameInput, setRenameInput] = useState("");

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

  async function handleRenameDeck(deckId: string) {
    const name = renameInput.trim();
    setRenamingDeckId(null);
    if (!name) return;
    await fetch(`/api/decks/${deckId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: name }),
    });
    setDecks((prev) => prev.map((d) => d.id === deckId ? { ...d, title: name } : d));
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
              <div className="group/card relative h-full">
                {renamingDeckId === deck.id ? (
                  <div className="flex h-full min-h-[10rem] flex-col items-start justify-center gap-3 rounded-2xl border border-border/40 bg-card/60 p-5">
                    <p className="text-xs font-medium text-muted-foreground/60">Rename deck</p>
                    <input
                      autoFocus
                      value={renameInput}
                      onChange={(e) => setRenameInput(e.target.value)}
                      onBlur={() => handleRenameDeck(deck.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") { e.preventDefault(); handleRenameDeck(deck.id); }
                        if (e.key === "Escape") setRenamingDeckId(null);
                      }}
                      className="w-full bg-transparent text-sm font-medium text-foreground border-b border-primary/40 focus:outline-none pb-0.5"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleRenameDeck(deck.id)}
                        className="rounded-md px-2.5 py-1 text-xs font-medium"
                        style={{
                          background: "oklch(0.55 0.15 200 / 0.12)",
                          border: "1px solid oklch(0.55 0.15 200 / 0.4)",
                          color: "var(--dashboard-accent-teal-strong)",
                        }}
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setRenamingDeckId(null)}
                        className="rounded-md border px-2.5 py-1 text-xs font-medium text-muted-foreground/70 hover:text-foreground"
                        style={{ border: "1px solid oklch(0.5 0.01 65 / 0.3)" }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <DeckCard deck={deck} />
                )}

                {renamingDeckId !== deck.id && (
                  <div className="absolute right-2 top-2 z-10">
                    <button
                      onClick={() => setMenuOpenId(menuOpenId === deck.id ? null : deck.id)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg opacity-0 transition-all group-hover/card:opacity-100 hover:bg-muted/40"
                      style={{ background: menuOpenId === deck.id ? "oklch(0.5 0.01 65 / 0.12)" : undefined }}
                    >
                      <svg className="h-4 w-4 text-muted-foreground/60" fill="currentColor" viewBox="0 0 20 20">
                        <circle cx="10" cy="4" r="1.5" />
                        <circle cx="10" cy="10" r="1.5" />
                        <circle cx="10" cy="16" r="1.5" />
                      </svg>
                    </button>

                    {menuOpenId === deck.id && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setMenuOpenId(null)} />
                        <div
                          className="absolute right-0 top-8 z-20 min-w-[160px] rounded-xl border border-border/40 bg-card/95 py-1 shadow-lg backdrop-blur-sm"
                        >
                          <button
                            onClick={() => {
                              setMenuOpenId(null);
                              setRenameInput(deck.title);
                              setRenamingDeckId(deck.id);
                            }}
                            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs text-foreground/80 hover:bg-muted/40"
                          >
                            <svg className="h-3.5 w-3.5 text-muted-foreground/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                            </svg>
                            Rename
                          </button>
                          <button
                            onClick={() => {
                              setMenuOpenId(null);
                              handleRemoveDeck(deck.id);
                            }}
                            disabled={removingId === deck.id}
                            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs hover:bg-destructive/5 disabled:opacity-40"
                            style={{ color: "var(--destructive)" }}
                          >
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            {removingId === deck.id ? "Removing…" : "Remove from collection"}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
