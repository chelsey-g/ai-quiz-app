// src/app/kata/[deckId]/kata-workspace.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";

const KataEditor = dynamic(() => import("@/components/kata-editor"), { ssr: false });

type KataResult = {
  passed: boolean;
  input: unknown;
  expected: unknown;
  actual?: unknown;
  error?: string;
};

type Kata = {
  id: string;
  problem_title: string;
  problem_description: string;
  function_stub: string;
  difficulty: "easy" | "medium" | "hard";
  total_count: number;
};

const DIFFICULTY_STYLE: Record<string, { bg: string; border: string; color: string }> = {
  easy: {
    bg: "oklch(0.62 0.19 142 / 0.1)",
    border: "oklch(0.62 0.19 142 / 0.25)",
    color: "#4ade80",
  },
  medium: {
    bg: "oklch(0.75 0.17 60 / 0.1)",
    border: "oklch(0.75 0.17 60 / 0.25)",
    color: "#fbbf24",
  },
  hard: {
    bg: "oklch(0.62 0.22 25 / 0.1)",
    border: "oklch(0.62 0.22 25 / 0.25)",
    color: "#f87171",
  },
};

export default function KataWorkspace({
  deckId,
  deckTitle,
  deckTags,
}: {
  deckId: string;
  deckTitle: string;
  deckTags: string[];
}) {
  const [kata, setKata] = useState<Kata | null>(null);
  const [userCode, setUserCode] = useState("");
  const [results, setResults] = useState<KataResult[] | null>(null);
  const [passedCount, setPassedCount] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [generateError, setGenerateError] = useState(false);

  const generate = useCallback(async () => {
    setIsGenerating(true);
    setKata(null);
    setResults(null);
    setGenerateError(false);
    try {
      const res = await fetch("/api/kata/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deckId }),
      });
      if (!res.ok) throw new Error("Generation failed");
      const data: Kata = await res.json();
      setKata(data);
      setUserCode(data.function_stub);
    } catch {
      setGenerateError(true);
    } finally {
      setIsGenerating(false);
    }
  }, [deckId]);

  useEffect(() => {
    generate();
  }, [generate]);

  const run = useCallback(async () => {
    if (!kata || isRunning) return;
    setIsRunning(true);
    setResults(null);
    try {
      const res = await fetch("/api/kata/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attempt_id: kata.id, user_code: userCode }),
      });
      if (!res.ok) throw new Error("Run failed");
      const data = await res.json();
      setResults(data.results ?? null);
      setPassedCount(data.passed_count ?? 0);
    } catch {
      // silently fail
    } finally {
      setIsRunning(false);
    }
  }, [kata, userCode, isRunning]);

  // Ctrl+Enter / Cmd+Enter to run
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        run();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [run]);

  const diff = kata?.difficulty ?? "easy";
  const diffStyle = DIFFICULTY_STYLE[diff] ?? DIFFICULTY_STYLE.easy;
  const allPassed = results !== null && passedCount === results.length;

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Header */}
      <div
        className="flex shrink-0 items-center gap-3 border-b px-4 py-2.5"
        style={{ borderColor: "oklch(1 0 0 / 0.07)" }}
      >
        <Link
          href={`/decks/${deckId}`}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <span>←</span>
          <span className="font-medium">{deckTitle}</span>
        </Link>
        <span className="text-muted-foreground/30">·</span>
        <span className="text-xs text-muted-foreground/50">Code Practice</span>

        <div className="ml-auto flex items-center gap-3">
          {kata && (
            <span
              className="rounded-full border px-2.5 py-0.5 text-[11px] font-medium"
              style={{
                background: diffStyle.bg,
                borderColor: diffStyle.border,
                color: diffStyle.color,
              }}
            >
              {kata.difficulty}
            </span>
          )}
          <button
            onClick={generate}
            disabled={isGenerating}
            className="rounded-full border px-3 py-1 text-[11px] transition-opacity hover:opacity-80 disabled:opacity-40"
            style={{
              background: "oklch(0.62 0.19 295 / 0.1)",
              borderColor: "oklch(0.62 0.19 295 / 0.25)",
              color: "#a78bfa",
            }}
          >
            {isGenerating ? "Generating…" : "↻ New kata"}
          </button>
        </div>
      </div>

      {/* Problem title bar */}
      {kata && (
        <div
          className="flex shrink-0 items-center gap-3 border-b px-4 py-2.5"
          style={{ borderColor: "oklch(1 0 0 / 0.07)" }}
        >
          <span className="text-sm font-semibold text-foreground">
            {kata.problem_title}
          </span>
          <span className="ml-auto text-[10px] text-muted-foreground/50">
            {kata.total_count} hidden test{kata.total_count !== 1 ? "s" : ""}
          </span>
        </div>
      )}

      {/* Split pane */}
      <div className="flex min-h-0 flex-1">
        {/* Left: problem description */}
        <div
          className="flex w-[38%] shrink-0 flex-col gap-4 overflow-y-auto border-r p-4"
          style={{ borderColor: "oklch(1 0 0 / 0.07)" }}
        >
          {isGenerating || !kata ? (
            <div className="space-y-3">
              {generateError ? (
                <p className="text-sm text-muted-foreground/60">
                  Generation failed.{" "}
                  <button
                    onClick={generate}
                    className="underline underline-offset-2 hover:text-foreground transition-colors"
                  >
                    Try again
                  </button>
                </p>
              ) : (
                <>
                  <div className="h-3 w-1/3 animate-pulse rounded bg-muted/40" />
                  <div className="h-3 w-full animate-pulse rounded bg-muted/30" />
                  <div className="h-3 w-4/5 animate-pulse rounded bg-muted/30" />
                  <div className="h-3 w-full animate-pulse rounded bg-muted/30" />
                </>
              )}
            </div>
          ) : (
            <>
              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-[#a78bfa]">
                  Problem
                </p>
                <p className="text-sm leading-relaxed text-foreground/90">
                  {kata.problem_description}
                </p>
              </div>
              {deckTags.length > 0 && (
                <div className="mt-auto pt-4">
                  <p className="text-[10px] text-muted-foreground/40">
                    Deck: {deckTitle}
                    {deckTags.length > 0 && " · " + deckTags.slice(0, 3).join(" · ")}
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Right: editor + run bar + results */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Editor */}
          <div
            className="min-h-0 flex-1 overflow-auto"
            style={{ background: "oklch(0.08 0 0 / 0.35)" }}
          >
            {isGenerating || !kata ? (
              <div className="space-y-2 p-4">
                <div className="h-3 w-1/4 animate-pulse rounded bg-muted/30" />
                <div className="h-3 w-2/5 animate-pulse rounded bg-muted/30" />
                <div className="h-3 w-1/3 animate-pulse rounded bg-muted/20" />
              </div>
            ) : (
              <KataEditor value={userCode} onChange={setUserCode} />
            )}
          </div>

          {/* Run bar */}
          <div
            className="flex shrink-0 items-center gap-3 border-t px-4 py-2.5"
            style={{
              borderColor: "oklch(1 0 0 / 0.07)",
              background: "oklch(0.08 0 0 / 0.2)",
            }}
          >
            <button
              onClick={run}
              disabled={!kata || isRunning}
              className="rounded-md px-4 py-1.5 text-xs font-semibold transition-opacity hover:opacity-90 disabled:opacity-40"
              style={{ background: "#a78bfa", color: "#1e1b4b" }}
            >
              {isRunning ? "Running…" : "▶ Run"}
            </button>
            <span className="text-[11px] text-muted-foreground/50">Ctrl+Enter</span>
            {results !== null && (
              <span
                className="ml-auto text-[11px] font-medium"
                style={{ color: allPassed ? "#4ade80" : "#f87171" }}
              >
                {passedCount} / {results.length} tests passed
              </span>
            )}
          </div>

          {/* Results panel */}
          {results !== null && (
            <div
              className="shrink-0 overflow-y-auto border-t px-4 py-3"
              style={{
                borderColor: "oklch(1 0 0 / 0.07)",
                background: "oklch(0.08 0 0 / 0.15)",
                maxHeight: "200px",
              }}
            >
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                Results
              </p>
              <div className="space-y-1.5">
                {results.map((r, i) => (
                  <div key={i} className="flex flex-wrap items-baseline gap-2 text-[11px]">
                    <span style={{ color: r.passed ? "#4ade80" : "#f87171", fontSize: "13px" }}>
                      {r.passed ? "✓" : "✗"}
                    </span>
                    <span className="text-muted-foreground/60">test {i + 1}</span>
                    <code
                      className="rounded px-1.5 py-0.5"
                      style={{
                        background: "oklch(1 0 0 / 0.05)",
                        color: "oklch(0.9 0 0)",
                        fontFamily: "var(--font-mono, monospace)",
                        fontSize: "11px",
                      }}
                    >
                      input: {JSON.stringify(r.input)}
                    </code>
                    {!r.passed && (
                      <>
                        <span className="text-muted-foreground/50">
                          expected {JSON.stringify(r.expected)}
                        </span>
                        {r.error ? (
                          <span style={{ color: "#f87171" }}>error: {r.error}</span>
                        ) : (
                          <span style={{ color: "#f87171" }}>
                            got {JSON.stringify(r.actual)}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
