// src/app/kata/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";

const KataEditor = dynamic(() => import("@/components/kata-editor"), {
  ssr: false,
});

const ALLOWED_TOPICS = [
  "JavaScript",
  "React",
  "TypeScript",
  "Node.js",
  "Data Structures",
  "Algorithms",
  "CSS / DOM",
] as const;

type Difficulty = "easy" | "medium" | "hard";

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: "Beginner",
  medium: "Intermediate",
  hard: "Advanced",
};

const DIFFICULTY_STYLE: Record<
  Difficulty,
  { bg: string; border: string; color: string }
> = {
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

const PREFS_KEY = "quizly:kata:prefs";

type Prefs = { topics: string[]; difficulty: Difficulty };

function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) return JSON.parse(raw) as Prefs;
  } catch {}
  return { topics: ["JavaScript"], difficulty: "easy" };
}

function savePrefs(prefs: Prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {}
}

type Kata = {
  id: string;
  problem_title: string;
  problem_description: string;
  function_stub: string;
  difficulty: Difficulty;
  total_count: number;
};

type KataResult = {
  passed: boolean;
  input: unknown;
  expected: unknown;
  actual?: unknown;
  error?: string;
};

type HistoryItem = {
  id: string;
  problem_title: string;
  difficulty: Difficulty;
  passed_count: number;
  total_count: number;
  created_at: string;
};

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export default function KataPage() {
  const [prefs, setPrefs] = useState<Prefs>({
    topics: ["JavaScript"],
    difficulty: "easy",
  });
  const [pickerOpen, setPickerOpen] = useState(true);
  const [kata, setKata] = useState<Kata | null>(null);
  const [userCode, setUserCode] = useState("");
  const [results, setResults] = useState<KataResult[] | null>(null);
  const [passedCount, setPassedCount] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [generateError, setGenerateError] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    setPrefs(loadPrefs());
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/kata/history");
      if (res.ok) setHistory(await res.json());
    } catch {}
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  function updatePrefs(next: Prefs) {
    setPrefs(next);
    savePrefs(next);
  }

  function toggleTopic(topic: string) {
    if (prefs.topics.includes(topic)) {
      if (prefs.topics.length === 1) return;
      updatePrefs({ ...prefs, topics: prefs.topics.filter((t) => t !== topic) });
    } else {
      updatePrefs({ ...prefs, topics: [...prefs.topics, topic] });
    }
  }

  function setDifficulty(difficulty: Difficulty) {
    updatePrefs({ ...prefs, difficulty });
  }

  const generate = useCallback(async () => {
    setIsGenerating(true);
    setKata(null);
    setResults(null);
    setGenerateError(false);
    setPickerOpen(false);
    try {
      const res = await fetch("/api/kata/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topics: prefs.topics, difficulty: prefs.difficulty }),
      });
      if (!res.ok) throw new Error("Generation failed");
      const data: Kata = await res.json();
      setKata(data);
      setUserCode(data.function_stub);
    } catch {
      setGenerateError(true);
      setPickerOpen(true);
    } finally {
      setIsGenerating(false);
    }
  }, [prefs]);

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
      fetchHistory();
    } catch {
    } finally {
      setIsRunning(false);
    }
  }, [kata, userCode, isRunning, fetchHistory]);

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

  const diff = kata?.difficulty ?? prefs.difficulty;
  const diffStyle = DIFFICULTY_STYLE[diff];
  const allPassed = results !== null && passedCount === results.length;

  return (
    <div
      className={
        pickerOpen
          ? "min-h-screen"
          : "flex h-screen flex-col overflow-hidden"
      }
    >
      {/* ── Picker or compact summary bar ── */}
      {pickerOpen ? (
        <div
          className="border-b px-6 py-6"
          style={{ borderColor: "oklch(1 0 0 / 0.07)" }}
        >
          <h1 className="font-heading text-xl font-bold text-foreground mb-5">
            Kata Practice
          </h1>

          {/* Topic chips */}
          <div className="mb-5">
            <p className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground/50">
              Topics
            </p>
            <div className="flex flex-wrap gap-2">
              {ALLOWED_TOPICS.map((topic) => {
                const active = prefs.topics.includes(topic);
                return (
                  <button
                    key={topic}
                    onClick={() => toggleTopic(topic)}
                    className="rounded-full border px-3 py-1 text-xs font-medium transition-all"
                    style={
                      active
                        ? {
                            background: "oklch(0.62 0.19 295 / 0.15)",
                            borderColor: "oklch(0.62 0.19 295 / 0.4)",
                            color: "#a78bfa",
                          }
                        : {
                            background: "transparent",
                            borderColor: "oklch(1 0 0 / 0.12)",
                            color: "oklch(0.65 0 0)",
                          }
                    }
                  >
                    {topic}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Difficulty segmented control */}
          <div className="mb-6">
            <p className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground/50">
              Skill Level
            </p>
            <div
              className="inline-flex overflow-hidden rounded-lg border"
              style={{ borderColor: "oklch(1 0 0 / 0.12)" }}
            >
              {(["easy", "medium", "hard"] as Difficulty[]).map((d) => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className="px-4 py-1.5 text-xs font-medium transition-all"
                  style={
                    prefs.difficulty === d
                      ? {
                          background: "oklch(0.62 0.19 295 / 0.15)",
                          color: "#a78bfa",
                        }
                      : {
                          background: "transparent",
                          color: "oklch(0.6 0 0)",
                        }
                  }
                >
                  {DIFFICULTY_LABELS[d]}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={generate}
              disabled={isGenerating || prefs.topics.length === 0}
              className="rounded-lg px-6 py-2 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-40"
              style={{ background: "#a78bfa", color: "#1e1b4b" }}
            >
              {isGenerating ? "Generating…" : "Generate Problem"}
            </button>
            {kata && !isGenerating && (
              <button
                onClick={() => setPickerOpen(false)}
                className="text-xs text-muted-foreground/50 transition-colors hover:text-muted-foreground"
              >
                ← Back to problem
              </button>
            )}
          </div>

          {generateError && (
            <p className="mt-3 text-sm" style={{ color: "#f87171" }}>
              Generation failed. Please try again.
            </p>
          )}
        </div>
      ) : (
        /* Compact summary bar */
        <div
          className="flex shrink-0 items-center gap-3 border-b px-6 py-2.5"
          style={{ borderColor: "oklch(1 0 0 / 0.07)" }}
        >
          <span className="text-xs text-muted-foreground/60">
            {prefs.topics.join(", ")} · {DIFFICULTY_LABELS[prefs.difficulty]}
          </span>
          <button
            onClick={() => setPickerOpen(true)}
            className="text-[11px] text-muted-foreground/40 transition-colors hover:text-muted-foreground"
          >
            Change
          </button>
          <div className="ml-auto flex items-center gap-2">
            {kata && (
              <span
                className="rounded-full border px-2.5 py-0.5 text-[11px] font-medium"
                style={{
                  background: diffStyle.bg,
                  borderColor: diffStyle.border,
                  color: diffStyle.color,
                }}
              >
                {DIFFICULTY_LABELS[kata.difficulty]}
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
              {isGenerating ? "Generating…" : "↻ New Problem"}
            </button>
          </div>
        </div>
      )}

      {/* ── Problem title bar (workspace mode only) ── */}
      {!pickerOpen && kata && (
        <div
          className="flex shrink-0 items-center gap-3 border-b px-6 py-2.5"
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

      {/* ── Split-pane workspace ── */}
      {!pickerOpen && (
        <div className="flex min-h-0 flex-1">
          {/* Left: problem description */}
          <div
            className="flex w-[38%] shrink-0 flex-col gap-4 overflow-y-auto border-r p-4"
            style={{ borderColor: "oklch(1 0 0 / 0.07)" }}
          >
            {isGenerating || !kata ? (
              <div className="space-y-3">
                <div className="h-3 w-1/3 animate-pulse rounded bg-muted/40" />
                <div className="h-3 w-full animate-pulse rounded bg-muted/30" />
                <div className="h-3 w-4/5 animate-pulse rounded bg-muted/30" />
                <div className="h-3 w-full animate-pulse rounded bg-muted/30" />
              </div>
            ) : (
              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-[#a78bfa]">
                  Problem
                </p>
                <p className="text-sm leading-relaxed text-foreground/90">
                  {kata.problem_description}
                </p>
              </div>
            )}
          </div>

          {/* Right: editor + run bar + results */}
          <div className="flex flex-1 flex-col overflow-hidden">
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
              <span className="text-[11px] text-muted-foreground/50">
                Ctrl+Enter
              </span>
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
                    <div
                      key={i}
                      className="flex flex-wrap items-baseline gap-2 text-[11px]"
                    >
                      <span
                        style={{
                          color: r.passed ? "#4ade80" : "#f87171",
                          fontSize: "13px",
                        }}
                      >
                        {r.passed ? "✓" : "✗"}
                      </span>
                      <span className="text-muted-foreground/60">
                        test {i + 1}
                      </span>
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
                            <span style={{ color: "#f87171" }}>
                              error: {r.error}
                            </span>
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
      )}

      {/* ── History (picker mode only) ── */}
      {pickerOpen && history.length > 0 && (
        <div className="max-w-3xl px-6 py-8">
          <h2 className="mb-4 font-heading text-sm font-semibold uppercase tracking-widest text-muted-foreground/50">
            Recent Attempts
          </h2>
          <div
            className="overflow-hidden rounded-2xl border"
            style={{ borderColor: "oklch(1 0 0 / 0.08)" }}
          >
            {history.slice(0, 8).map((item, i) => {
              const allP = item.passed_count === item.total_count;
              const pct =
                item.total_count > 0
                  ? Math.round((item.passed_count / item.total_count) * 100)
                  : 0;
              const ds = DIFFICULTY_STYLE[item.difficulty] ?? DIFFICULTY_STYLE.easy;
              return (
                <div
                  key={item.id}
                  className="flex items-center gap-4 px-5 py-3.5 text-sm"
                  style={{
                    borderTop:
                      i > 0 ? "1px solid oklch(1 0 0 / 0.06)" : undefined,
                  }}
                >
                  <span style={{ color: allP ? "#4ade80" : "#f87171" }}>
                    {allP ? "✓" : "✗"}
                  </span>
                  <p className="flex-1 truncate text-[13px] font-medium text-foreground/90">
                    {item.problem_title}
                  </p>
                  <span
                    className="shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium"
                    style={{
                      background: ds.bg,
                      borderColor: ds.border,
                      color: ds.color,
                    }}
                  >
                    {DIFFICULTY_LABELS[item.difficulty]}
                  </span>
                  <span
                    className="shrink-0 text-[12px] font-medium tabular-nums"
                    style={{ color: allP ? "#4ade80" : "oklch(0.7 0 0)" }}
                  >
                    {pct}%
                  </span>
                  <span className="shrink-0 text-[11px] text-muted-foreground/40">
                    {formatDate(item.created_at)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
