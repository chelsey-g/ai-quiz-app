"use client";

import { useCallback, useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";

type Tab = "topic" | "notes" | "import" | "manual";
type GenState = "idle" | "generating" | "done" | "error";
type ImportState = "idle" | "processing" | "done";

interface DeckResult {
  deckId: string;
  title: string;
  cardCount: number;
  provider: string;
  model: string;
}

interface ImportResult {
  file: string;
  status: "ok" | "error";
  title?: string;
  deckId?: string;
  cardCount?: number;
  provider?: string;
  model?: string;
  error?: string;
}

const MAX_NOTES_CHARS = 10000;
const COUNTER_THRESHOLD = 8000;

function ResultCard({ result, onReset, resetLabel }: { result: DeckResult; onReset: () => void; resetLabel: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-card p-6">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/65 to-transparent" />
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="truncate font-heading text-sm font-semibold text-foreground">{result.title}</p>
          <p className="mt-1 text-xs text-muted-foreground/55">
            {result.cardCount} cards · via {result.provider}/{result.model}
          </p>
          <Link href={`/decks/${result.deckId}`} className="mt-3 inline-flex items-center text-xs font-medium text-primary hover:underline">
            Study deck →
          </Link>
        </div>
        <span className="shrink-0 rounded-full bg-primary/14 px-2 py-0.5 text-[10px] font-medium text-primary">
          {result.cardCount} cards
        </span>
      </div>
      <Button variant="outline" size="sm" onClick={onReset} className="mt-5 w-full">
        {resetLabel}
      </Button>
    </div>
  );
}

function Spinner() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-card p-8 text-center">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
      <div className="mb-4 flex justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
      </div>
      <p className="text-sm font-medium text-foreground">Generating deck…</p>
      <p className="mt-1 text-xs text-muted-foreground/55">This usually takes 5–15 seconds.</p>
    </div>
  );
}

function ErrorBanner({ msg }: { msg: string }) {
  return (
    <div className="rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-3">
      <p className="text-xs text-destructive">{msg}</p>
    </div>
  );
}

// ── Topic tab ─────────────────────────────────────────────────────────────────

const RANDOM_TOPICS = [
  "React hooks",
  "CSS Grid",
  "TypeScript generics",
  "System design fundamentals",
  "Big-O notation",
  "REST API design",
  "SQL joins",
  "Git internals",
  "Docker basics",
  "Data structures: trees",
  "Data structures: graphs",
  "Object-oriented design patterns",
  "Async JavaScript",
  "Next.js App Router",
  "Testing with Jest",
  "Binary search",
  "Recursion",
  "Database indexing",
  "HTTP caching",
  "WebSockets",
  "GraphQL basics",
  "Python decorators",
  "Concurrency vs parallelism",
  "CI/CD pipelines",
];

type Difficulty = "easy" | "medium" | "hard";
const DIFFICULTIES: { id: Difficulty; label: string }[] = [
  { id: "easy", label: "Easy" },
  { id: "medium", label: "Medium" },
  { id: "hard", label: "Hard" },
];

function TopicTab() {
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [state, setState] = useState<GenState>("idle");
  const [result, setResult] = useState<DeckResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function randomizeTopic() {
    const pick = RANDOM_TOPICS[Math.floor(Math.random() * RANDOM_TOPICS.length)];
    setTopic(pick);
  }

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
        body: JSON.stringify({ topic: trimmed, difficulty }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      setResult(data as DeckResult);
      setState("done");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setState("error");
    }
  }

  if (state === "generating") return <Spinner />;

  if (state === "done" && result) {
    return <ResultCard result={result} onReset={() => { setState("idle"); setTopic(""); setResult(null); }} resetLabel="Generate another" />;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-card p-6">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border/80 to-transparent" />
        <div className="mb-2 flex items-center justify-between">
          <label htmlFor="topic" className="block text-xs font-medium uppercase tracking-widest text-muted-foreground/55">
            Topic
          </label>
          <button
            type="button"
            onClick={randomizeTopic}
            className="flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 3h5m0 0v5m0-5l-6 6M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-1" />
            </svg>
            Surprise me
          </button>
        </div>
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
          <p className="mt-2 text-right text-[10px] text-muted-foreground/45">{topic.length}/200</p>
        )}
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-card p-6">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border/80 to-transparent" />
        <label className="mb-2 block text-xs font-medium uppercase tracking-widest text-muted-foreground/55">
          Difficulty
        </label>
        <div className="flex gap-2">
          {DIFFICULTIES.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setDifficulty(id)}
              className={`flex-1 rounded-lg border py-1.5 text-xs font-medium transition-colors ${
                difficulty === id
                  ? "border-primary/60 bg-primary/10 text-primary"
                  : "border-border/50 text-muted-foreground hover:border-primary/40 hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {state === "error" && errorMsg && <ErrorBanner msg={errorMsg} />}
      <Button type="submit" disabled={!topic.trim()} className="w-full">
        Generate deck
      </Button>
    </form>
  );
}

// ── Notes tab ─────────────────────────────────────────────────────────────────

function NotesTab() {
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [state, setState] = useState<GenState>("idle");
  const [result, setResult] = useState<DeckResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = notes.trim();
    if (trimmed.length < 20) return;
    setState("generating");
    setResult(null);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: trimmed, ...(title.trim() ? { title: title.trim() } : {}) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      setResult(data as DeckResult);
      setState("done");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setState("error");
    }
  }

  if (state === "generating") return <Spinner />;

  if (state === "done" && result) {
    return <ResultCard result={result} onReset={() => { setState("idle"); setTitle(""); setNotes(""); setResult(null); }} resetLabel="Generate from more notes" />;
  }

  const charsRemaining = MAX_NOTES_CHARS - notes.length;
  const showCounter = notes.length >= COUNTER_THRESHOLD;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-card p-6 space-y-5">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border/80 to-transparent" />
        <div>
          <label htmlFor="deck-title" className="mb-2 block text-xs font-medium uppercase tracking-widest text-muted-foreground/55">
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
        <div className="h-px bg-border/30" />
        <div>
          <label htmlFor="notes-content" className="mb-2 block text-xs font-medium uppercase tracking-widest text-muted-foreground/55">
            Notes
          </label>
          <textarea
            id="notes-content"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Paste or type your notes here…"
            maxLength={MAX_NOTES_CHARS}
            rows={12}
            className="w-full resize-y bg-transparent text-sm text-foreground placeholder:text-muted-foreground/35 focus:outline-none"
          />
          {showCounter && (
            <p className={`mt-1 text-right text-[10px] tabular-nums ${charsRemaining < 500 ? "text-destructive/70" : "text-muted-foreground/45"}`}>
              {notes.length.toLocaleString()} / {MAX_NOTES_CHARS.toLocaleString()}
            </p>
          )}
        </div>
      </div>
      {state === "error" && errorMsg && <ErrorBanner msg={errorMsg} />}
      <Button type="submit" disabled={notes.trim().length < 20} className="w-full">
        Generate deck
      </Button>
    </form>
  );
}

// ── Import tab ────────────────────────────────────────────────────────────────

function ImportTab() {
  const [state, setState] = useState<ImportState>("idle");
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const processFiles = useCallback(async (files: File[]) => {
    const mdFiles = files.filter((f) => f.name.endsWith(".md"));
    if (mdFiles.length === 0) return;
    setState("processing");
    setProgress(0);
    setResults([]);
    const fileData = await Promise.all(mdFiles.map(async (f) => ({ name: f.name, content: await f.text() })));
    const batchSize = 5;
    const allResults: ImportResult[] = [];
    for (let i = 0; i < fileData.length; i += batchSize) {
      const batch = fileData.slice(i, i + batchSize);
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: batch }),
      });
      const data = await res.json();
      allResults.push(...data.results);
      setProgress(Math.round(((i + batch.length) / fileData.length) * 100));
      setResults([...allResults]);
    }
    setState("done");
  }, []);

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    processFiles(Array.from(e.target.files ?? []));
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    processFiles(Array.from(e.dataTransfer.files));
  }, [processFiles]);

  const succeeded = results.filter((r) => r.status === "ok");
  const failed = results.filter((r) => r.status === "error");
  const totalCards = succeeded.reduce((sum, r) => sum + (r.cardCount ?? 0), 0);

  return (
    <div className="space-y-6">
      {state === "idle" && (
        <label
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          className={`group relative flex cursor-pointer flex-col items-center justify-center gap-5 overflow-hidden rounded-2xl border-2 border-dashed p-16 text-center transition-all duration-200 ${
            isDragging ? "border-primary/60 bg-primary/5 scale-[1.01]" : "border-border/40 hover:border-primary/30 hover:bg-muted/10"
          }`}
        >
          {isDragging && <div className="absolute inset-0 bg-gradient-to-b from-primary/6 to-transparent pointer-events-none" />}
          <div className={`relative flex h-14 w-14 items-center justify-center rounded-2xl border transition-all duration-200 ${
            isDragging ? "border-primary/40 bg-primary/12 scale-110" : "border-border/50 bg-card group-hover:border-primary/30 group-hover:bg-primary/6"
          }`}>
            <svg className={`h-6 w-6 transition-colors duration-200 ${isDragging ? "text-primary" : "text-muted-foreground/60 group-hover:text-primary/70"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12l-3-3m0 0l-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">{isDragging ? "Drop to import" : "Drop .md files here"}</p>
            <p className="mt-1 text-xs text-muted-foreground/55">or click to browse your files</p>
          </div>
          <input type="file" accept=".md" multiple className="hidden" onChange={onFileInput} />
        </label>
      )}

      {state === "processing" && (
        <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-card p-6">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
          <div className="mb-5 flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">Generating decks…</p>
            <span className="font-heading text-sm font-semibold tabular-nums text-primary">{progress}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/60">
            <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
          {results.length > 0 && (
            <p className="mt-3 text-xs text-muted-foreground/55">{results.length} {results.length === 1 ? "file" : "files"} processed so far</p>
          )}
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-2">
          {state === "done" && (
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">{succeeded.length} {succeeded.length === 1 ? "deck" : "decks"} created</p>
                <p className="mt-0.5 text-xs text-muted-foreground/60">{totalCards} cards total{failed.length > 0 && ` · ${failed.length} failed`}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => { setState("idle"); setResults([]); }}>
                Import more
              </Button>
            </div>
          )}
          {results.map((result) => (
            <div key={result.file} className={`relative overflow-hidden rounded-xl border px-4 py-3 ${result.status === "error" ? "border-destructive/25 bg-destructive/5" : "border-border/50 bg-card"}`}>
              {result.status === "ok" && <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{result.title ?? result.file}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground/55">{result.file}</p>
                  {result.status === "ok" && result.model && <p className="mt-1 text-xs text-muted-foreground/40">via {result.provider}/{result.model}</p>}
                  {result.status === "ok" && result.deckId && (
                    <Link href={`/decks/${result.deckId}`} className="mt-2 inline-flex items-center text-xs font-medium text-primary hover:underline">Study deck →</Link>
                  )}
                  {result.status === "error" && <p className="mt-1 text-xs text-destructive">{result.error}</p>}
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${result.status === "ok" ? "bg-primary/14 text-primary" : "bg-destructive/10 text-destructive"}`}>
                  {result.status === "ok" ? `${result.cardCount} cards` : "failed"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Manual tab ───────────────────────────────────────────────────────────────

type CardEntry = { id: string; front: string; back: string; generating: boolean };

function ManualTab() {
  const [title, setTitle] = useState("");
  const [cards, setCards] = useState<CardEntry[]>([
    { id: crypto.randomUUID(), front: "", back: "", generating: false },
  ]);
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<DeckResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const latestFrontRef = useRef<HTMLTextAreaElement | null>(null);

  function addCard() {
    setCards((prev) => [...prev, { id: crypto.randomUUID(), front: "", back: "", generating: false }]);
    setTimeout(() => latestFrontRef.current?.focus(), 50);
  }

  function removeCard(id: string) {
    setCards((prev) => prev.filter((c) => c.id !== id));
  }

  function updateCard(id: string, patch: Partial<CardEntry>) {
    setCards((prev) => prev.map((c) => c.id === id ? { ...c, ...patch } : c));
  }

  async function generateAnswer(id: string) {
    const card = cards.find((c) => c.id === id);
    if (!card?.front.trim()) return;
    updateCard(id, { generating: true, back: "" });
    try {
      const res = await fetch("/api/cards/generate-answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: card.front.trim(), deckTitle: title.trim() || "My Deck" }),
      });
      if (!res.ok || !res.body) { updateCard(id, { generating: false }); return; }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let text = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        updateCard(id, { back: text });
      }
    } finally {
      updateCard(id, { generating: false });
    }
  }

  async function handleCreate() {
    const validCards = cards.filter((c) => c.front.trim() && c.back.trim());
    if (!title.trim() || validCards.length === 0) return;
    setCreating(true);
    setError(null);
    try {
      const deckRes = await fetch("/api/decks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim() }),
      });
      if (!deckRes.ok) throw new Error("Failed to create deck");
      const deck = await deckRes.json();
      const bulkRes = await fetch(`/api/decks/${deck.id}/cards/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cards: validCards.map((c) => ({ front: c.front.trim(), back: c.back.trim() })) }),
      });
      if (!bulkRes.ok) throw new Error("Failed to save cards");
      const bulkData = await bulkRes.json();
      setResult({ deckId: deck.id, title: title.trim(), cardCount: bulkData.addedCount, provider: "—", model: "manual" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setCreating(false);
    }
  }

  if (result) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-card p-6">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/65 to-transparent" />
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="truncate font-heading text-sm font-semibold text-foreground">{result.title}</p>
            <p className="mt-1 text-xs text-muted-foreground/55">{result.cardCount} cards</p>
            <Link href={`/decks/${result.deckId}`} className="mt-3 inline-flex items-center text-xs font-medium text-primary hover:underline">
              Study deck →
            </Link>
          </div>
          <span className="shrink-0 rounded-full bg-primary/14 px-2 py-0.5 text-[10px] font-medium text-primary">
            {result.cardCount} cards
          </span>
        </div>
        <Button variant="outline" size="sm" className="mt-5 w-full" onClick={() => {
          setResult(null); setTitle(""); setError(null);
          setCards([{ id: crypto.randomUUID(), front: "", back: "", generating: false }]);
        }}>
          Build another deck
        </Button>
      </div>
    );
  }

  const validCount = cards.filter((c) => c.front.trim() && c.back.trim()).length;
  const anyGenerating = cards.some((c) => c.generating);

  return (
    <div className="space-y-4">
      {/* Deck title */}
      <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-card p-5">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border/80 to-transparent" />
        <label className="mb-2 block text-xs font-medium uppercase tracking-widest text-muted-foreground/55">
          Deck title
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. JavaScript Fundamentals"
          maxLength={120}
          autoFocus
          className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/35 focus:outline-none"
        />
      </div>

      {/* Card rows */}
      <div className="space-y-3">
        {cards.map((card, idx) => (
          <div
            key={card.id}
            className="relative overflow-hidden rounded-2xl border border-border/50 bg-card p-5"
          >
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border/60 to-transparent" />
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/40">
                Card {idx + 1}
              </span>
              {cards.length > 1 && (
                <button
                  onClick={() => removeCard(card.id)}
                  className="text-muted-foreground/30 hover:text-destructive/70 transition-colors"
                  title="Remove card"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Question */}
            <textarea
              ref={idx === cards.length - 1 ? latestFrontRef : undefined}
              value={card.front}
              onChange={(e) => updateCard(card.id, { front: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && card.front.trim() && !card.back.trim()) {
                  e.preventDefault();
                  generateAnswer(card.id);
                }
              }}
              placeholder="Question…"
              rows={2}
              className="w-full resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground/35 focus:outline-none"
            />

            {/* Divider + generate button */}
            <div className="my-3 flex items-center gap-3">
              <div className="h-px flex-1 bg-border/30" />
              <button
                onClick={() => generateAnswer(card.id)}
                disabled={!card.front.trim() || card.generating}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-medium transition-all disabled:opacity-40"
                style={{ border: "1px solid var(--primary)", color: "var(--primary)", opacity: !card.front.trim() ? 0.3 : 1 }}
              >
                {card.generating ? (
                  <>
                    <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Generating…
                  </>
                ) : (
                  <>
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                    </svg>
                    {card.back ? "Regenerate" : "Generate answer"}
                  </>
                )}
              </button>
              <div className="h-px flex-1 bg-border/30" />
            </div>

            {/* Answer */}
            <textarea
              value={card.back}
              onChange={(e) => updateCard(card.id, { back: e.target.value })}
              placeholder="Answer — or hit Generate above…"
              rows={3}
              className="w-full resize-none bg-transparent text-sm text-muted-foreground/80 placeholder:text-muted-foreground/30 focus:outline-none"
            />
          </div>
        ))}
      </div>

      <button
        onClick={addCard}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border/50 py-3 text-sm text-muted-foreground/50 transition-colors hover:border-primary/40 hover:text-primary/70"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        Add card
      </button>

      {error && <ErrorBanner msg={error} />}

      <Button
        className="w-full"
        disabled={!title.trim() || validCount === 0 || creating || anyGenerating}
        onClick={handleCreate}
      >
        {creating ? "Creating…" : `Create deck · ${validCount} card${validCount !== 1 ? "s" : ""}`}
      </Button>
    </div>
  );
}

// ── Page shell ────────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string }[] = [
  { id: "topic", label: "Topic" },
  { id: "notes", label: "Notes" },
  { id: "import", label: "Import" },
  { id: "manual", label: "Manual" },
];

function CreatePageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const rawTab = searchParams.get("tab") as Tab | null;
  const activeTab: Tab = rawTab && ["topic", "notes", "import", "manual"].includes(rawTab) ? rawTab : "topic";

  function setTab(tab: Tab) {
    router.replace(`/create?tab=${tab}`, { scroll: false });
  }

  const descriptions: Record<Tab, string> = {
    topic: "Enter any topic and Trove will generate a study deck using AI.",
    notes: "Paste or type your notes and Trove will generate a study deck from your material.",
    import: "Upload Markdown files to generate AI-powered study decks.",
    manual: "Write your own questions and let AI generate the answers.",
  };

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <div className="mb-8">
        <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">Create a deck</h1>
        <p className="mt-1.5 text-sm text-muted-foreground/70">{descriptions[activeTab]}</p>
      </div>

      {/* Tab bar */}
      <div className="mb-6 flex gap-1 rounded-xl border border-border/40 bg-muted/20 p-1">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex-1 rounded-lg py-1.5 text-sm font-medium transition-all duration-150 ${
              activeTab === id
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground/70 hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === "topic" && <TopicTab />}
      {activeTab === "notes" && <NotesTab />}
      {activeTab === "import" && <ImportTab />}
      {activeTab === "manual" && <ManualTab />}
    </div>
  );
}

export default function CreatePage() {
  return (
    <Suspense>
      <CreatePageInner />
    </Suspense>
  );
}
