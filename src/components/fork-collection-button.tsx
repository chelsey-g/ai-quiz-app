"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = { collectionId: string; deckCount: number };

export function ForkCollectionButton({ collectionId, deckCount }: Props) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "forking" | "done" | "error">("idle");

  async function handleFork(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    setState("forking");
    try {
      const res = await fetch("/api/community/fork-collection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collectionId }),
      });
      if (res.status === 401) { router.push("/auth/login"); return; }
      if (res.ok) {
        const { collectionId: newId } = await res.json();
        router.push(`/collections/${newId}`);
        return;
      }
    } catch { /* fall through */ }
    setState("error");
  }

  return (
    <button
      onClick={handleFork}
      disabled={state === "forking"}
      className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
      style={{
        background: state === "done"
          ? "color-mix(in oklch, var(--dashboard-accent-teal) 12%, transparent)"
          : "oklch(0.5 0.01 65 / 0.08)",
        border: state === "done"
          ? "1px solid color-mix(in oklch, var(--dashboard-accent-teal) 40%, transparent)"
          : "1px solid oklch(0.5 0.01 65 / 0.25)",
        color: state === "done"
          ? "var(--dashboard-accent-teal-strong)"
          : "var(--foreground)",
      }}
    >
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        {state === "done" ? (
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        ) : (
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
        )}
      </svg>
      {state === "forking"
        ? `Saving ${deckCount} ${deckCount === 1 ? "deck" : "decks"}…`
        : state === "done"
        ? "Saved to my library"
        : state === "error"
        ? "Failed — retry?"
        : `Fork collection · ${deckCount} ${deckCount === 1 ? "deck" : "decks"}`}
    </button>
  );
}
