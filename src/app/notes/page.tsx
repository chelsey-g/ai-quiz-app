"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

type PageState = "idle" | "generating" | "done" | "error";

interface NotesResult {
  deckId: string;
  title: string;
  cardCount: number;
  provider: string;
  model: string;
}

const MAX_CHARS = 10000;
const COUNTER_THRESHOLD = 8000;
const MIN_CHARS = 20;

export default function NotesPage() {
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [state, setState] = useState<PageState>("idle");
  const [result, setResult] = useState<NotesResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedNotes = notes.trim();
    if (trimmedNotes.length < MIN_CHARS) return;

    setState("generating");
    setResult(null);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: trimmedNotes,
          ...(title.trim() ? { title: title.trim() } : {}),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Generation failed");
      }

      setResult(data as NotesResult);
      setState("done");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setState("error");
    }
  }

  function reset() {
    setState("idle");
    setTitle("");
    setNotes("");
    setResult(null);
    setErrorMsg(null);
  }

  const charsRemaining = MAX_CHARS - notes.length;
  const showCounter = notes.length >= COUNTER_THRESHOLD;

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <div className="mb-10">
        <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">
          Notes Editor
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground/70">
          Paste or type your notes and Trove will generate a study deck from
          your material.
        </p>
      </div>

      {(state === "idle" || state === "error") && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-card p-6 space-y-5">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border/80 to-transparent" />

            {/* Optional title */}
            <div>
              <label
                htmlFor="deck-title"
                className="mb-2 block text-xs font-medium uppercase tracking-widest text-muted-foreground/55"
              >
                Deck title <span className="normal-case text-muted-foreground/35">(optional)</span>
              </label>
              <input
                id="deck-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Week 3 — Photosynthesis"
                maxLength={120}
                className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/35 focus:outline-none"
              />
            </div>

            {/* Divider */}
            <div className="h-px bg-border/30" />

            {/* Notes textarea */}
            <div>
              <label
                htmlFor="notes-content"
                className="mb-2 block text-xs font-medium uppercase tracking-widest text-muted-foreground/55"
              >
                Notes
              </label>
              <textarea
                id="notes-content"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Paste or type your notes here…"
                maxLength={MAX_CHARS}
                rows={12}
                className="w-full resize-y bg-transparent text-sm text-foreground placeholder:text-muted-foreground/35 focus:outline-none"
              />
              {showCounter && (
                <p
                  className={`mt-1 text-right text-[10px] tabular-nums ${
                    charsRemaining < 500
                      ? "text-destructive/70"
                      : "text-muted-foreground/45"
                  }`}
                >
                  {notes.length.toLocaleString()} / {MAX_CHARS.toLocaleString()}
                </p>
              )}
            </div>
          </div>

          {state === "error" && errorMsg && (
            <div className="rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-3">
              <p className="text-xs text-destructive">{errorMsg}</p>
            </div>
          )}

          <Button
            type="submit"
            disabled={notes.trim().length < MIN_CHARS}
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
            Generate from more notes
          </Button>
        </div>
      )}
    </div>
  );
}
