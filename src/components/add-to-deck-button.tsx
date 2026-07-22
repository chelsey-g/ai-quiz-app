"use client";

import { useState } from "react";
import { useChatWidget } from "@/components/chat-provider";

type AddState = "idle" | "picking" | "saving" | "done" | "error";

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}

function Spinner({ className }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className ?? ""}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z"
      />
    </svg>
  );
}

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
    return (
      <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
        <CheckIcon className="h-3.5 w-3.5" />
        Added to deck
      </div>
    );
  }

  if (state === "picking") {
    if (decks.length === 0) {
      return <p className="mt-2 text-xs text-muted-foreground">No decks yet — create one first.</p>;
    }
    return (
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {decks.map((deck) => (
          <button
            key={deck.id}
            type="button"
            onClick={() => addToDeck(deck.id)}
            className="rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground shadow-sm transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
          >
            {deck.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setState("idle")}
          className="rounded-full px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="mt-2 flex items-center gap-2">
      <button
        type="button"
        disabled={state === "saving"}
        onClick={() => (deckId ? addToDeck(deckId) : setState("picking"))}
        className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary shadow-sm transition-colors hover:border-primary/50 hover:bg-primary/10 disabled:pointer-events-none disabled:opacity-60"
      >
        {state === "saving" ? <Spinner className="h-3.5 w-3.5" /> : <PlusIcon className="h-3.5 w-3.5" />}
        {state === "saving" ? "Adding…" : "Add to deck"}
      </button>
      {state === "error" && <span className="text-xs text-destructive">Couldn't add — try again.</span>}
    </div>
  );
}
