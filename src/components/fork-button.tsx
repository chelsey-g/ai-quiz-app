"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = { deckId: string; size?: "sm" | "md" };

export function ForkButton({ deckId, size = "sm" }: Props) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "forking" | "done" | "error">("idle");

  async function handleFork(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    setState("forking");
    try {
      const res = await fetch("/api/community/fork", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deckId }),
      });
      if (res.status === 401) { router.push("/auth/login"); return; }
      if (res.status === 409) { setState("done"); return; } // already forked
      if (res.ok) {
        const { deckId: newId } = await res.json();
        router.push(`/decks/${newId}`);
        return;
      }
    } catch { /* fall through */ }
    setState("error");
  }

  if (size === "md") {
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
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
          )}
        </svg>
        {state === "forking" ? "Saving…" : state === "done" ? "Saved" : state === "error" ? "Failed — retry?" : "Fork to my library"}
      </button>
    );
  }

  return (
    <button
      onClick={handleFork}
      disabled={state === "forking" || state === "done"}
      className="rounded-lg border border-border/40 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-50"
    >
      {state === "forking" ? "Saving…" : state === "done" ? "Saved ✓" : state === "error" ? "Retry?" : "Fork"}
    </button>
  );
}
