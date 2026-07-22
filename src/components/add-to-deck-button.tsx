"use client";

import { useState } from "react";
import { useChatWidget } from "@/components/chat-provider";

type AddState = "idle" | "picking" | "saving" | "done" | "error";

export function AddToDeckButton({ front, back }: { front: string; back: string }) {
  const { deckId, mentionableItems } = useChatWidget();
  const [state, setState] = useState<AddState>("idle");

  const decks = mentionableItems.filter((item) => item.type === "deck");

  async function addToDeck(targetDeckId: string) {
    setState("saving");
    try {
      const res = await fetch(`/api/decks/${targetDeckId}/cards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ front, back }),
      });
      if (!res.ok) throw new Error("Failed to add card");
      setState("done");
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return <p className="mt-1 text-xs font-medium text-primary">Added to deck ✓</p>;
  }

  if (state === "picking") {
    if (decks.length === 0) {
      return <p className="mt-1 text-xs text-muted-foreground">No decks yet — create one first.</p>;
    }
    return (
      <div className="mt-1 flex flex-wrap gap-1">
        {decks.map((deck) => (
          <button
            key={deck.id}
            type="button"
            onClick={() => addToDeck(deck.id)}
            className="rounded-full border border-border px-2 py-0.5 text-xs text-foreground hover:bg-muted"
          >
            {deck.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setState("idle")}
          className="rounded-full px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="mt-1 flex items-center gap-2">
      <button
        type="button"
        disabled={state === "saving"}
        onClick={() => (deckId ? addToDeck(deckId) : setState("picking"))}
        className="text-xs font-medium text-primary hover:underline disabled:opacity-50"
      >
        {state === "saving" ? "Adding…" : "+ Add to deck"}
      </button>
      {state === "error" && <span className="text-xs text-destructive">Couldn't add — try again.</span>}
    </div>
  );
}
