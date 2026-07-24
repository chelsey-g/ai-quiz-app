"use client";

import { useRef, useState } from "react";
import { useChatWidget } from "@/components/chat-provider";

type AddState = "idle" | "saving" | "done" | "error";
type SummarizedCard = { front: string; back: string };

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
  const { deckId, deckTitle } = useChatWidget();
  const [state, setState] = useState<AddState>("idle");
  const [savedDeckTitle, setSavedDeckTitle] = useState<string | null>(null);
  const summarized = useRef<SummarizedCard | null>(null);

  async function getSummarizedCard(): Promise<SummarizedCard> {
    if (summarized.current) return summarized.current;

    const res = await fetch("/api/chat/summarize-card", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: front, answer: back }),
    });
    if (!res.ok) throw new Error("Failed to summarize");
    const card = (await res.json()) as SummarizedCard;
    summarized.current = card;
    return card;
  }

  async function handleClick() {
    setState("saving");
    try {
      // On a deck page, save there. Otherwise fall back to a dedicated
      // "Chat Notes" deck (created on first use) — no picker, no choice needed.
      let targetDeckId = deckId;
      let targetDeckTitle = deckTitle;

      if (!targetDeckId) {
        const deckRes = await fetch("/api/decks/chat-notes", { method: "POST" });
        if (!deckRes.ok) throw new Error("Failed to get Chat Notes deck");
        const deck = (await deckRes.json()) as { id: string; title: string };
        targetDeckId = deck.id;
        targetDeckTitle = deck.title;
      }

      const card = await getSummarizedCard();
      const res = await fetch(`/api/decks/${targetDeckId}/cards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(card),
      });
      if (!res.ok) throw new Error("Failed to add card");

      setSavedDeckTitle(targetDeckTitle);
      setState("done");
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
        <CheckIcon className="h-3.5 w-3.5" />
        {savedDeckTitle ? `Added to "${savedDeckTitle}"` : "Added to deck"}
      </div>
    );
  }

  return (
    <div className="mt-2 flex items-center gap-2">
      <button
        type="button"
        disabled={state === "saving"}
        onClick={handleClick}
        className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary shadow-sm transition-colors hover:border-primary/50 hover:bg-primary/10 disabled:pointer-events-none disabled:opacity-60"
      >
        {state === "saving" ? <Spinner className="h-3.5 w-3.5" /> : <PlusIcon className="h-3.5 w-3.5" />}
        {state === "saving" ? "Adding…" : "Add to deck"}
      </button>
      {state === "error" && <span className="text-xs text-destructive">Couldn't add — try again.</span>}
    </div>
  );
}
