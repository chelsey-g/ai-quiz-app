"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = { deckId: string };

export function ForkButton({ deckId }: Props) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "forking" | "error">("idle");

  async function handleFork() {
    setState("forking");
    try {
      const res = await fetch("/api/community/fork", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deckId }),
      });
      if (res.status === 401) {
        router.push("/auth/login");
        return;
      }
      if (res.ok) {
        const { deckId: newId } = await res.json();
        router.push(`/decks/${newId}`);
        return;
      }
    } catch {
      // fall through to error state
    }
    setState("error");
  }

  if (state === "error") {
    return (
      <button
        onClick={() => setState("idle")}
        className="rounded-lg border border-destructive/40 px-3 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/5"
        title="Fork failed — click to retry"
      >
        Failed, retry?
      </button>
    );
  }

  return (
    <button
      onClick={handleFork}
      disabled={state === "forking"}
      className="rounded-lg border border-border/40 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-50"
    >
      {state === "forking" ? "Saving…" : "Fork"}
    </button>
  );
}
