"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

type PageState = "idle" | "generating" | "done" | "error";

interface GenerateResult {
  deckId: string;
  title: string;
  cardCount: number;
  provider: string;
  model: string;
}

export default function GeneratePage() {
  const [topic, setTopic] = useState("");
  const [state, setState] = useState<PageState>("idle");
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = topic.trim();
    if (!trimmed) return;

    setState("generating");
    setResult(null);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/generate-topic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: trimmed }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Generation failed");
      }

      setResult(data as GenerateResult);
      setState("done");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setState("error");
    }
  }

  function reset() {
    setState("idle");
    setTopic("");
    setResult(null);
    setErrorMsg(null);
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <div className="mb-10">
        <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">
          Generate from Topic
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground/70">
          Enter any topic and Quizly will generate a study deck using AI.
        </p>
      </div>

      {(state === "idle" || state === "error") && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-card p-6">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border/80 to-transparent" />
            <label
              htmlFor="topic"
              className="mb-2 block text-xs font-medium uppercase tracking-widest text-muted-foreground/55"
            >
              Topic
            </label>
            <input
              id="topic"
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. React hooks, CSS Grid, TypeScript generics"
              maxLength={200}
              className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/35 focus:outline-none"
              autoFocus
            />
            {topic.length > 160 && (
              <p className="mt-2 text-right text-[10px] text-muted-foreground/45">
                {topic.length}/200
              </p>
            )}
          </div>

          {state === "error" && errorMsg && (
            <div className="rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-3">
              <p className="text-xs text-destructive">{errorMsg}</p>
            </div>
          )}

          <Button
            type="submit"
            disabled={!topic.trim()}
            className="w-full"
          >
            Generate deck
          </Button>
        </form>
      )}

      {state === "generating" && (
        <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-card p-8 text-center">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
          <div className="mb-4 flex justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
          </div>
          <p className="text-sm font-medium text-foreground">Generating deck…</p>
          <p className="mt-1 text-xs text-muted-foreground/55">
            This usually takes 5–15 seconds.
          </p>
        </div>
      )}

      {state === "done" && result && (
        <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-card p-6">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/65 to-transparent" />
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="truncate font-heading text-sm font-semibold text-foreground">
                {result.title}
              </p>
              <p className="mt-1 text-xs text-muted-foreground/55">
                {result.cardCount} cards · via {result.provider}/{result.model}
              </p>
              <Link
                href={`/decks/${result.deckId}`}
                className="mt-3 inline-flex items-center text-xs font-medium text-primary hover:underline"
              >
                Study deck →
              </Link>
            </div>
            <span className="shrink-0 rounded-full bg-primary/14 px-2 py-0.5 text-[10px] font-medium text-primary">
              {result.cardCount} cards
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={reset}
            className="mt-5 w-full"
          >
            Generate another
          </Button>
        </div>
      )}
    </div>
  );
}
