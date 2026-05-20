# Kata Redesign — Deck-Free Topic + Skill Picker

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the deck-dependent Kata feature with a standalone practice page where users pick topics and skill level to generate JavaScript coding problems on demand.

**Architecture:** `/kata/page.tsx` becomes a single client component with a topic/level picker that collapses into a summary bar after generating. The generate API route swaps `deckId` for `{ topics, difficulty }`. A new global history route replaces the per-deck one. One DB migration makes `deck_id` nullable.

**Tech Stack:** Next.js 16 App Router, Supabase, Vercel AI Gateway, CodeMirror (`@uiw/react-codemirror`), localStorage

---

## File Map

| Action | File |
|---|---|
| Create | `supabase/migrations/20260520000001_kata_deck_id_nullable.sql` |
| Modify | `src/app/api/kata/generate/route.ts` |
| Create | `src/app/api/kata/history/route.ts` |
| Delete | `src/app/api/kata/[deckId]/history/route.ts` |
| Rewrite | `src/app/kata/page.tsx` |
| Delete | `src/app/kata/[deckId]/page.tsx` |
| Delete | `src/app/kata/[deckId]/kata-workspace.tsx` |
| Unchanged | `src/app/api/kata/run/route.ts` |
| Unchanged | `src/components/kata-editor.tsx` |

---

### Task 1: DB Migration — make deck_id nullable + regenerate types

**Files:**
- Create: `supabase/migrations/20260520000001_kata_deck_id_nullable.sql`
- Modify: `src/lib/database.types.ts` (regenerated)

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260520000001_kata_deck_id_nullable.sql
ALTER TABLE kata_attempts ALTER COLUMN deck_id DROP NOT NULL;
```

- [ ] **Step 2: Apply the migration via Supabase MCP**

Use `mcp__plugin_supabase_supabase__apply_migration` with:
- `project_id`: `wlghyvhrzdhfnkykhcoj`
- `name`: `kata_deck_id_nullable`
- `query`: the SQL above

- [ ] **Step 3: Regenerate TypeScript types**

```bash
npx supabase gen types typescript --project-id wlghyvhrzdhfnkykhcoj > src/lib/database.types.ts
```

Then open `src/lib/database.types.ts` and verify the first line is `export type Json = ...` (no npm noise). Strip any leading lines like `npm warn exec` or `npm notice` if present.

- [ ] **Step 4: Verify deck_id is now nullable in types**

Search `database.types.ts` for `kata_attempts`. The `Row` type should show:
```ts
deck_id: string | null
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260520000001_kata_deck_id_nullable.sql src/lib/database.types.ts
git commit -m "feat(kata): make deck_id nullable for deck-free kata generation"
```

---

### Task 2: Update generate route — new body shape and prompt

**Files:**
- Modify: `src/app/api/kata/generate/route.ts`

- [ ] **Step 1: Replace the full file content**

```ts
// src/app/api/kata/generate/route.ts
import { NextRequest } from "next/server";
import { generateObject } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { createClient } from "@/lib/supabase/server";
import { KataSchema } from "@/lib/ai/schema";

const ALLOWED_TOPICS = [
  "JavaScript",
  "React",
  "TypeScript",
  "Node.js",
  "Data Structures",
  "Algorithms",
  "CSS / DOM",
];
const ALLOWED_DIFFICULTIES = ["easy", "medium", "hard"];

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const topics = Array.isArray(b.topics)
    ? (b.topics as unknown[]).filter((t): t is string => typeof t === "string")
    : null;
  const difficulty = typeof b.difficulty === "string" ? b.difficulty : null;

  if (
    !topics ||
    topics.length === 0 ||
    !topics.every((t) => ALLOWED_TOPICS.includes(t))
  ) {
    return Response.json(
      { error: "topics must be a non-empty array of allowed values" },
      { status: 400 }
    );
  }
  if (!difficulty || !ALLOWED_DIFFICULTIES.includes(difficulty)) {
    return Response.json(
      { error: "difficulty must be easy, medium, or hard" },
      { status: 400 }
    );
  }

  const difficultyLabel =
    difficulty === "easy"
      ? "beginner"
      : difficulty === "medium"
      ? "intermediate"
      : "advanced";

  const { object } = await generateObject({
    model: gateway("openai/gpt-4o-mini"),
    providerOptions: {
      gateway: {
        models: [
          "anthropic/claude-haiku-4.5",
          "anthropic/claude-sonnet-4-6",
          "openai/gpt-4o",
        ],
      },
    },
    schema: KataSchema,
    system:
      "You are a coding challenge author. Create a single self-contained JavaScript coding kata. " +
      "The function stub must use a standard `function` declaration (not an arrow function) so it can be called by name. " +
      "Include a JSDoc comment above the function with @param and @returns types. " +
      "The body must be empty (just a comment `// your code here`). " +
      "Test cases must cover the happy path and at least one edge case (empty input, single element, zero, etc.).",
    prompt: `Generate a JavaScript coding kata at ${difficultyLabel} level covering these topics: ${topics.join(", ")}.`,
  });

  const { data: attempt, error } = await supabase
    .from("kata_attempts")
    .insert({
      deck_id: null,
      user_id: user.id,
      problem_title: object.problem_title,
      problem_description: object.problem_description,
      function_stub: object.function_stub,
      difficulty: object.difficulty,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      test_cases: object.test_cases as any,
      total_count: object.test_cases.length,
    })
    .select()
    .single();

  if (error || !attempt) {
    return Response.json({ error: "Failed to save kata" }, { status: 500 });
  }

  const { test_cases: _hidden, ...clientKata } = attempt;
  return Response.json(clientKata, { status: 201 });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/kata/generate/route.ts
git commit -m "feat(kata): generate from topics+difficulty instead of deck cards"
```

---

### Task 3: New global history route + delete old per-deck route

**Files:**
- Create: `src/app/api/kata/history/route.ts`
- Delete: `src/app/api/kata/[deckId]/history/route.ts`

- [ ] **Step 1: Create the new history route**

```ts
// src/app/api/kata/history/route.ts
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(_req: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("kata_attempts")
    .select("id, problem_title, difficulty, passed_count, total_count, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json(data ?? []);
}
```

- [ ] **Step 2: Delete the old per-deck history route**

```bash
rm src/app/api/kata/[deckId]/history/route.ts
rmdir src/app/api/kata/[deckId]
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/kata/history/route.ts
git add -u src/app/api/kata/
git commit -m "feat(kata): add global history route, remove per-deck history route"
```

---

### Task 4: Rewrite /kata/page.tsx as topic-picker + workspace

**Files:**
- Rewrite: `src/app/kata/page.tsx`

- [ ] **Step 1: Replace the full file content**

```tsx
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

          <button
            onClick={generate}
            disabled={isGenerating || prefs.topics.length === 0}
            className="rounded-lg px-6 py-2 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-40"
            style={{ background: "#a78bfa", color: "#1e1b4b" }}
          >
            {isGenerating ? "Generating…" : "Generate Problem"}
          </button>

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
```

- [ ] **Step 2: Commit**

```bash
git add src/app/kata/page.tsx
git commit -m "feat(kata): rewrite kata page with topic/skill picker and localStorage prefs"
```

---

### Task 5: Delete /kata/[deckId] files

**Files:**
- Delete: `src/app/kata/[deckId]/page.tsx`
- Delete: `src/app/kata/[deckId]/kata-workspace.tsx`

- [ ] **Step 1: Delete the files**

```bash
rm src/app/kata/[deckId]/page.tsx
rm src/app/kata/[deckId]/kata-workspace.tsx
rmdir src/app/kata/[deckId]
```

- [ ] **Step 2: Commit**

```bash
git add -u src/app/kata/
git commit -m "chore(kata): remove deck-based kata routes"
```

---

### Task 6: TypeScript check + smoke test

**Files:** None modified

- [ ] **Step 1: Run TypeScript check**

```bash
npx tsc --noEmit 2>&1
```

Expected: no errors. Fix any type errors before proceeding.

- [ ] **Step 2: Run existing tests**

```bash
npm test 2>&1
```

Expected: all tests pass.

- [ ] **Step 3: Smoke test**

Start the dev server (`npm run dev`) and verify:
1. Navigate to `/kata` — topic chips and skill level selector render
2. Toggle topics on/off — active state updates immediately; can't deselect the last topic
3. Change skill level — segmented control updates
4. Click "Generate Problem" — button shows "Generating…", picker collapses to summary bar, skeleton loaders appear in split pane, problem loads
5. Click "Change" in summary bar — picker re-expands with same selections
6. Click "↻ New Problem" — generates a fresh problem with current settings
7. Edit code in editor, press Ctrl+Enter (or ▶ Run) — results panel appears with pass/fail per test
8. Refresh page — topic/level selections are restored from localStorage
9. Check Recent Attempts section — appears below picker after running code
