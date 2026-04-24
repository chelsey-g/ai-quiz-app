"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

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

type ImportState = "idle" | "processing" | "done";

export default function ImportPage() {
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

    const fileData = await Promise.all(
      mdFiles.map(async (f) => ({ name: f.name, content: await f.text() }))
    );

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

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      processFiles(Array.from(e.dataTransfer.files));
    },
    [processFiles]
  );

  const succeeded = results.filter((r) => r.status === "ok");
  const failed = results.filter((r) => r.status === "error");
  const totalCards = succeeded.reduce((sum, r) => sum + (r.cardCount ?? 0), 0);

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-10">
        <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">
          Import Notes
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground/70">
          Upload Markdown files to generate AI-powered study decks.
        </p>
      </div>

      {state === "idle" && (
        <label
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          className={`group relative flex cursor-pointer flex-col items-center justify-center gap-5 overflow-hidden rounded-2xl border-2 border-dashed p-16 text-center transition-all duration-200 ${
            isDragging
              ? "border-primary/60 bg-primary/5 scale-[1.01]"
              : "border-border/40 hover:border-primary/30 hover:bg-muted/10"
          }`}
        >
          {isDragging && (
            <div className="absolute inset-0 bg-gradient-to-b from-primary/6 to-transparent pointer-events-none" />
          )}

          <div className={`relative flex h-14 w-14 items-center justify-center rounded-2xl border transition-all duration-200 ${
            isDragging
              ? "border-primary/40 bg-primary/12 scale-110"
              : "border-border/50 bg-card group-hover:border-primary/30 group-hover:bg-primary/6"
          }`}>
            <svg
              className={`h-6 w-6 transition-colors duration-200 ${isDragging ? "text-primary" : "text-muted-foreground/60 group-hover:text-primary/70"}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12l-3-3m0 0l-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          </div>

          <div>
            <p className="text-sm font-medium text-foreground">
              {isDragging ? "Drop to import" : "Drop .md files here"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground/55">
              or click to browse your files
            </p>
          </div>

          <input
            type="file"
            accept=".md"
            multiple
            className="hidden"
            onChange={onFileInput}
          />
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
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          {results.length > 0 && (
            <p className="mt-3 text-xs text-muted-foreground/55">
              {results.length} {results.length === 1 ? "file" : "files"} processed so far
            </p>
          )}
        </div>
      )}

      {results.length > 0 && (
        <div className="mt-6 space-y-2">
          {state === "done" && (
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">
                  {succeeded.length} {succeeded.length === 1 ? "deck" : "decks"} created
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground/60">
                  {totalCards} cards total
                  {failed.length > 0 && ` · ${failed.length} failed`}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setState("idle"); setResults([]); }}
              >
                Import more
              </Button>
            </div>
          )}

          {results.map((result) => (
            <div
              key={result.file}
              className={`relative overflow-hidden rounded-xl border px-4 py-3 ${
                result.status === "error"
                  ? "border-destructive/25 bg-destructive/5"
                  : "border-border/50 bg-card"
              }`}
            >
              {result.status === "ok" && (
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
              )}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {result.title ?? result.file}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground/55">{result.file}</p>
                  {result.status === "ok" && result.model && (
                    <p className="mt-1 text-xs text-muted-foreground/40">
                      via {result.provider}/{result.model}
                    </p>
                  )}
                  {result.status === "ok" && result.deckId && (
                    <Link
                      href={`/decks/${result.deckId}`}
                      className="mt-2 inline-flex items-center text-xs font-medium text-primary hover:underline"
                    >
                      Study deck →
                    </Link>
                  )}
                  {result.status === "error" && (
                    <p className="mt-1 text-xs text-destructive">{result.error}</p>
                  )}
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    result.status === "ok"
                      ? "bg-primary/14 text-primary"
                      : "bg-destructive/10 text-destructive"
                  }`}
                >
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
