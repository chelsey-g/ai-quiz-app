# Kata Practice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a code practice mode to Quizly — AI generates a JavaScript kata from the deck's content, the user solves it in a split-pane browser editor, and Vercel Sandbox executes it against hidden test cases saved server-side.

**Architecture:** Three API routes handle the lifecycle: `classify-code` (fire-and-forget after deck creation to set `is_code_deck`), `generate` (creates a `kata_attempts` row and returns problem sans test cases), and `run` (executes user code in an isolated Vercel Sandbox Node.js instance). The `/kata/[deckId]` page is a server component that renders a `KataWorkspace` client component which auto-generates on mount. A Code button on deck cards links there when `is_code_deck = true`.

**Tech Stack:** `@vercel/sandbox` (isolated Node.js execution), `@uiw/react-codemirror` + `@codemirror/lang-javascript` (browser editor), Vercel AI Gateway via `@ai-sdk/gateway` (kata generation + deck classification), Supabase (kata_attempts table + RLS), Vitest (unit tests).

---

## File Map

**New files:**
- `supabase/migrations/20260519000001_kata.sql` — adds `is_code_deck` to decks, creates `kata_attempts` table with RLS
- `src/app/api/decks/[id]/classify-code/route.ts` — POST: AI classifies deck and updates `is_code_deck`; exports `classifyCodeDeck()` for internal use
- `src/app/api/kata/generate/route.ts` — POST `{ deckId }`: generates kata, saves to `kata_attempts`, returns problem sans `test_cases`
- `src/app/api/kata/run/route.ts` — POST `{ attempt_id, user_code }`: runs code in Vercel Sandbox, updates attempt, returns results
- `src/app/api/kata/[deckId]/history/route.ts` — GET: list past kata attempts for a deck
- `src/components/kata-editor.tsx` — CodeMirror JS editor (client component)
- `src/app/kata/[deckId]/page.tsx` — split-pane kata page: server shell + `KataWorkspace` client component

**Modified files:**
- `src/lib/ai/schema.ts` — add `KataSchema` + `CodeClassificationSchema`
- `src/components/deck-card.tsx` — add Code button row when `deck.is_code_deck = true`
- `src/app/api/decks/route.ts` — fire `classifyCodeDeck()` after deck creation (no await)
- `src/lib/database.types.ts` — regenerated from Supabase after migration

---

### Task 1: DB Migration — `is_code_deck` + `kata_attempts`

**Files:**
- Create: `supabase/migrations/20260519000001_kata.sql`
- Modify: `src/lib/database.types.ts` (regenerated)

- [ ] **Step 1: Write migration file**

```sql
-- supabase/migrations/20260519000001_kata.sql
alter table decks add column is_code_deck boolean not null default false;

create table kata_attempts (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references decks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  problem_title text not null,
  problem_description text not null,
  function_stub text not null,
  difficulty text not null default 'easy',
  test_cases jsonb not null,
  user_code text,
  results jsonb,
  passed_count int not null default 0,
  total_count int not null default 0,
  created_at timestamptz not null default now()
);

alter table kata_attempts enable row level security;

create policy "Users can manage their own kata attempts"
  on kata_attempts for all
  using (user_id = auth.uid());

create index kata_attempts_deck_id_idx on kata_attempts (deck_id);
create index kata_attempts_user_id_idx on kata_attempts (user_id);
```

- [ ] **Step 2: Apply migration**

Run: `npx supabase db push --project-ref wlghyvhrzdhfnkykhcoj`

Expected: migration applied without error, `is_code_deck` column exists on `decks`, `kata_attempts` table created.

If `supabase` CLI is not available, use the MCP tool `mcp__plugin_supabase_supabase__apply_migration` with the SQL above and project ref `wlghyvhrzdhfnkykhcoj`.

- [ ] **Step 3: Regenerate TypeScript types**

Run: `npx supabase gen types typescript --project-id wlghyvhrzdhfnkykhcoj > src/lib/database.types.ts`

Expected: `src/lib/database.types.ts` updated. Verify it contains `is_code_deck: boolean` in the `decks` Row type and `kata_attempts` table entries.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260519000001_kata.sql src/lib/database.types.ts
git commit -m "feat(kata): add is_code_deck to decks and kata_attempts table"
```

---

### Task 2: AI Schemas — `KataSchema` + `CodeClassificationSchema`

**Files:**
- Modify: `src/lib/ai/schema.ts`

- [ ] **Step 1: Write a failing test for function name extraction**

Create `src/lib/kata.test.ts`:

```ts
import { describe, it, expect } from "vitest";

function parseFunctionName(stub: string): string | null {
  return stub.match(/function\s+(\w+)/)?.[1] ?? null;
}

describe("parseFunctionName", () => {
  it("parses a simple function declaration", () => {
    expect(parseFunctionName("function reverseStr(str) { }")).toBe("reverseStr");
  });

  it("parses a jsdoc-annotated stub", () => {
    const stub = `/**\n * @param {string} str\n */\nfunction reverseStr(str) {\n  // your code here\n}`;
    expect(parseFunctionName(stub)).toBe("reverseStr");
  });

  it("returns null when no function keyword", () => {
    expect(parseFunctionName("const x = (y) => y")).toBeNull();
  });

  it("handles camelCase and underscored names", () => {
    expect(parseFunctionName("function find_max(arr) {}")).toBe("find_max");
    expect(parseFunctionName("function twoSum(nums, target) {}")).toBe("twoSum");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --reporter=verbose src/lib/kata.test.ts`

Expected: FAIL — "Cannot find module './kata'" or similar (test file references nothing yet, but the inline helper means they should actually pass — the test verifies the regex, not an import). If all pass, that's fine; tests document the contract for the regex used in the run route.

- [ ] **Step 3: Add schemas to `src/lib/ai/schema.ts`**

```ts
import { z } from "zod";

export const DeckSchema = z.object({
  title: z.string().describe("Short descriptive title for this note"),
  topic_tags: z.array(z.string()).describe("Main technologies or concepts covered"),
  cards: z
    .array(
      z.object({
        front: z.string().describe("Question or term — one sentence max"),
        back: z.string().describe("Concise but complete answer or definition"),
        card_type: z.enum(["flashcard", "mcq", "free_text"]).default("flashcard"),
      })
    )
    .describe("5–15 flashcards depending on content depth"),
});

export type GeneratedDeck = z.infer<typeof DeckSchema>;

export const CodeClassificationSchema = z.object({
  is_code_deck: z
    .boolean()
    .describe(
      "true only if this deck is primarily about programming or software development (JavaScript, TypeScript, algorithms, data structures, web APIs, etc.)"
    ),
});

export type CodeClassification = z.infer<typeof CodeClassificationSchema>;

export const KataSchema = z.object({
  problem_title: z.string().describe("Short name for the challenge, e.g. 'Reverse a String'"),
  problem_description: z
    .string()
    .describe("2–4 sentence explanation of the task with one input/output example inline"),
  function_stub: z
    .string()
    .describe(
      "Complete JSDoc-annotated JavaScript function signature with empty body — no implementation. Must start with a JSDoc comment and a `function` declaration."
    ),
  test_cases: z
    .array(
      z.object({
        input: z.unknown().describe("Single argument to pass to the function"),
        expected: z.unknown().describe("Expected return value"),
      })
    )
    .min(3)
    .max(5)
    .describe("3–5 test cases; first 1–2 should be simple, last 1–2 should be edge cases"),
  difficulty: z.enum(["easy", "medium", "hard"]),
});

export type GeneratedKata = z.infer<typeof KataSchema>;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --reporter=verbose src/lib/kata.test.ts`

Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/schema.ts src/lib/kata.test.ts
git commit -m "feat(kata): add KataSchema, CodeClassificationSchema, and function name parser tests"
```

---

### Task 3: Deck Classification Route

**Files:**
- Create: `src/app/api/decks/[id]/classify-code/route.ts`

- [ ] **Step 1: Create the route**

```ts
// src/app/api/decks/[id]/classify-code/route.ts
import { NextRequest } from "next/server";
import { generateObject } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { createClient } from "@/lib/supabase/server";
import { CodeClassificationSchema } from "@/lib/ai/schema";

export async function classifyCodeDeck(deckId: string): Promise<void> {
  const supabase = await createClient();

  const { data: deck } = await supabase
    .from("decks")
    .select("title, topic_tags")
    .eq("id", deckId)
    .single();

  if (!deck) return;

  const { data: cards } = await supabase
    .from("cards")
    .select("front")
    .eq("deck_id", deckId)
    .limit(10);

  const cardSamples = (cards ?? []).map((c) => c.front).join("\n- ");

  const { object } = await generateObject({
    model: gateway("openai/gpt-4o-mini"),
    providerOptions: {
      gateway: { models: ["anthropic/claude-haiku-4.5"] },
    },
    schema: CodeClassificationSchema,
    system:
      "You classify study decks. Respond true only if the deck is primarily about programming or software development topics (JavaScript, TypeScript, algorithms, data structures, browser APIs, Node.js, etc.). Respond false for math, history, science, language learning, and all other topics.",
    prompt: `Deck title: ${deck.title}\nTags: ${(deck.topic_tags ?? []).join(", ")}\nSample card fronts:\n- ${cardSamples}`,
  });

  await supabase
    .from("decks")
    .update({ is_code_deck: object.is_code_deck })
    .eq("id", deckId);
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await classifyCodeDeck(id);
    return Response.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Classification failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: no errors in the new file.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/decks/[id]/classify-code/route.ts
git commit -m "feat(kata): add classify-code route + classifyCodeDeck utility"
```

---

### Task 4: Kata Generation Route

**Files:**
- Create: `src/app/api/kata/generate/route.ts`

- [ ] **Step 1: Create the route**

```ts
// src/app/api/kata/generate/route.ts
import { NextRequest } from "next/server";
import { generateObject } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { createClient } from "@/lib/supabase/server";
import { KataSchema } from "@/lib/ai/schema";

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const deckId = typeof body.deckId === "string" ? body.deckId : null;
  if (!deckId) return Response.json({ error: "deckId is required" }, { status: 400 });

  const { data: deck } = await supabase
    .from("decks")
    .select("title, topic_tags")
    .eq("id", deckId)
    .single();

  if (!deck) return Response.json({ error: "Deck not found" }, { status: 404 });

  const { data: cards } = await supabase
    .from("cards")
    .select("front, back")
    .eq("deck_id", deckId)
    .limit(8);

  const cardSamples = (cards ?? [])
    .map((c) => `Q: ${c.front}\nA: ${c.back}`)
    .join("\n\n");

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
      "You are a coding challenge author. Given a JavaScript study deck, create a single self-contained coding kata. " +
      "The function stub must use a standard `function` declaration (not an arrow function) so it can be called by name. " +
      "Include a JSDoc comment above the function with @param and @returns types. " +
      "The body must be empty (just a comment `// your code here`). " +
      "Test cases must cover happy path and at least one edge case (empty input, single element, zero, etc.).",
    prompt: `Deck title: ${deck.title}\nTags: ${(deck.topic_tags ?? []).join(", ")}\n\nSample cards:\n${cardSamples}`,
  });

  const { data: attempt, error } = await supabase
    .from("kata_attempts")
    .insert({
      deck_id: deckId,
      user_id: user.id,
      problem_title: object.problem_title,
      problem_description: object.problem_description,
      function_stub: object.function_stub,
      difficulty: object.difficulty,
      test_cases: object.test_cases,
      total_count: object.test_cases.length,
    })
    .select()
    .single();

  if (error || !attempt) {
    return Response.json({ error: "Failed to save kata" }, { status: 500 });
  }

  // Never send test_cases to the client
  const { test_cases: _hidden, ...clientKata } = attempt;
  return Response.json(clientKata, { status: 201 });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/kata/generate/route.ts
git commit -m "feat(kata): add kata generation route"
```

---

### Task 5: Install `@vercel/sandbox` + Kata Run Route

**Files:**
- Modify: `package.json` (dependency added)
- Create: `src/app/api/kata/run/route.ts`

- [ ] **Step 1: Install Vercel Sandbox**

Run: `npm install @vercel/sandbox`

Expected: `@vercel/sandbox` appears in `package.json` dependencies, `node_modules/@vercel/sandbox` exists.

- [ ] **Step 2: Create the run route**

```ts
// src/app/api/kata/run/route.ts
import { NextRequest } from "next/server";
import { Sandbox } from "@vercel/sandbox";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { attempt_id, user_code } = body;

  if (typeof attempt_id !== "string" || typeof user_code !== "string") {
    return Response.json({ error: "attempt_id and user_code are required" }, { status: 400 });
  }

  // Fetch attempt — includes test_cases (never sent to client)
  const { data: attempt } = await supabase
    .from("kata_attempts")
    .select("*")
    .eq("id", attempt_id)
    .eq("user_id", user.id)
    .single();

  if (!attempt) return Response.json({ error: "Attempt not found" }, { status: 404 });

  const fnName = attempt.function_stub.match(/function\s+(\w+)/)?.[1];
  if (!fnName) {
    return Response.json({ error: "Could not parse function name from stub" }, { status: 400 });
  }

  const testCases = attempt.test_cases as Array<{ input: unknown; expected: unknown }>;

  // Build a self-contained Node.js harness
  const harness = `
${user_code}

const __tests = ${JSON.stringify(testCases)};
const __results = __tests.map(t => {
  try {
    const actual = ${fnName}(t.input);
    const passed = JSON.stringify(actual) === JSON.stringify(t.expected);
    return { passed, input: t.input, expected: t.expected, actual };
  } catch (e) {
    return { passed: false, input: t.input, expected: t.expected, error: e.message };
  }
});
process.stdout.write(JSON.stringify(__results));
`;

  let results: Array<{
    passed: boolean;
    input: unknown;
    expected: unknown;
    actual?: unknown;
    error?: string;
  }> = [];

  const sandbox = await Sandbox.create({ runtime: "node24", networkPolicy: "deny-all" });

  try {
    await sandbox.writeFiles([{ path: "solution.js", content: Buffer.from(harness) }]);
    const result = await sandbox.runCommand("node", ["solution.js"]);
    const stdout = await result.stdout();
    results = JSON.parse(stdout);
  } catch {
    // If sandbox or parse fails, return empty results with all failed
    results = testCases.map((t) => ({
      passed: false,
      input: t.input,
      expected: t.expected,
      error: "Execution error",
    }));
  } finally {
    await sandbox.stop();
  }

  const passed_count = results.filter((r) => r.passed).length;
  const total_count = results.length;

  await supabase
    .from("kata_attempts")
    .update({ user_code, results, passed_count, total_count })
    .eq("id", attempt_id);

  return Response.json({ results, passed_count, total_count });
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: no errors. If `@vercel/sandbox` has no types, add `"skipLibCheck": true` to `tsconfig.json` (it likely already exists).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/app/api/kata/run/route.ts
git commit -m "feat(kata): add kata run route with Vercel Sandbox execution"
```

---

### Task 6: Kata History Route

**Files:**
- Create: `src/app/api/kata/[deckId]/history/route.ts`

- [ ] **Step 1: Create the route**

```ts
// src/app/api/kata/[deckId]/history/route.ts
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ deckId: string }> }
) {
  const { deckId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("kata_attempts")
    .select("id, problem_title, difficulty, passed_count, total_count, created_at")
    .eq("deck_id", deckId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json(data ?? []);
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/kata/[deckId]/history/route.ts
git commit -m "feat(kata): add kata history route"
```

---

### Task 7: Install CodeMirror + `kata-editor.tsx`

**Files:**
- Modify: `package.json`
- Create: `src/components/kata-editor.tsx`

- [ ] **Step 1: Install CodeMirror packages**

Run: `npm install @uiw/react-codemirror @codemirror/lang-javascript`

Expected: both packages in `package.json`, `node_modules/@uiw/react-codemirror` exists.

- [ ] **Step 2: Create the editor component**

```tsx
// src/components/kata-editor.tsx
"use client";

import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { EditorView } from "@codemirror/view";

const theme = EditorView.theme({
  "&": {
    fontSize: "13px",
    fontFamily: "var(--font-mono, ui-monospace, monospace)",
    background: "transparent",
    height: "100%",
  },
  ".cm-content": { padding: "12px 0" },
  ".cm-gutters": {
    background: "transparent",
    borderRight: "1px solid oklch(1 0 0 / 0.06)",
    color: "oklch(0.5 0 0)",
  },
  ".cm-activeLineGutter": { background: "oklch(1 0 0 / 0.04)" },
  ".cm-activeLine": { background: "oklch(1 0 0 / 0.03)" },
  ".cm-cursor": { borderLeftColor: "#a78bfa" },
  ".cm-selectionBackground": { background: "oklch(0.62 0.19 295 / 0.25) !important" },
});

export default function KataEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (val: string) => void;
}) {
  return (
    <CodeMirror
      value={value}
      height="100%"
      extensions={[javascript(), theme]}
      onChange={onChange}
      basicSetup={{
        lineNumbers: true,
        foldGutter: false,
        dropCursor: false,
        allowMultipleSelections: false,
        indentOnInput: true,
        bracketMatching: true,
        closeBrackets: true,
        autocompletion: false,
        highlightActiveLine: true,
        highlightSelectionMatches: false,
        tabSize: 2,
      }}
      theme="dark"
    />
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/components/kata-editor.tsx
git commit -m "feat(kata): add CodeMirror-based kata editor component"
```

---

### Task 8: Kata Page (`/kata/[deckId]`)

**Files:**
- Create: `src/app/kata/[deckId]/page.tsx`

- [ ] **Step 1: Create the page file**

```tsx
// src/app/kata/[deckId]/page.tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import KataWorkspace from "./kata-workspace";

export default async function KataPage({
  params,
}: {
  params: Promise<{ deckId: string }>;
}) {
  const { deckId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: deck } = await supabase
    .from("decks")
    .select("id, title, topic_tags, is_code_deck")
    .eq("id", deckId)
    .single();

  if (!deck || !deck.is_code_deck) redirect(`/decks/${deckId}`);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <KataWorkspace
        deckId={deck.id}
        deckTitle={deck.title}
        deckTags={deck.topic_tags ?? []}
      />
    </div>
  );
}
```

- [ ] **Step 2: Create the `KataWorkspace` client component**

```tsx
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

  const generate = useCallback(async () => {
    setIsGenerating(true);
    setKata(null);
    setResults(null);
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
      // silently leave kata null — user sees skeleton
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
      const data = await res.json();
      setResults(data.results);
      setPassedCount(data.passed_count);
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
              <div className="h-3 w-1/3 animate-pulse rounded bg-muted/40" />
              <div className="h-3 w-full animate-pulse rounded bg-muted/30" />
              <div className="h-3 w-4/5 animate-pulse rounded bg-muted/30" />
              <div className="h-3 w-full animate-pulse rounded bg-muted/30" />
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
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/kata/[deckId]/page.tsx src/app/kata/[deckId]/kata-workspace.tsx
git commit -m "feat(kata): add kata practice page with split-pane editor"
```

---

### Task 9: Wire Code Button + Classify-Code Trigger

**Files:**
- Modify: `src/components/deck-card.tsx`
- Modify: `src/app/api/decks/route.ts`

- [ ] **Step 1: Add Code button to `DeckCard`**

In `src/components/deck-card.tsx`, the non-select-mode card renders tags and stats. Add a Code button row at the bottom of the `<div className="p-5">` section, before the closing `</div>`, inside the non-select branch (after the stats block). The `is_code_deck` field is on the `Deck` type from `database.types.ts` after the migration.

Locate the `<div className="mt-4 space-y-3">` stats block (around line 264). After its closing `</div>` and before `</div> </div> </div>` (closes `p-5`), add:

```tsx
{deck.is_code_deck && (
  <div className="mt-3 pt-3" style={{ borderTop: "1px solid oklch(1 0 0 / 0.06)" }}>
    <Link
      href={`/kata/${deck.id}`}
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1 text-[11px] font-medium transition-opacity hover:opacity-80"
      style={{
        background: "oklch(0.62 0.19 142 / 0.08)",
        borderColor: "oklch(0.62 0.19 142 / 0.22)",
        color: "#4ade80",
      }}
    >
      <span>&lt;/&gt;</span>
      <span>Code</span>
    </Link>
  </div>
)}
```

This goes in **both** the `selectMode` card inner section and the default card section. Since both share `cardInner` for the select mode branch, only add it in the non-select default card branch (the second render path starting at `return (<div className="relative h-full group">...`), inside the `<div className="p-5">` block after the stats div.

- [ ] **Step 2: Fire `classifyCodeDeck` from deck creation POST**

In `src/app/api/decks/route.ts`, add the import and fire-and-forget call:

```ts
import { createClient } from "@/lib/supabase/server";
import { getDecks } from "@/lib/services/decks";
import { NextRequest } from "next/server";
import { classifyCodeDeck } from "@/app/api/decks/[id]/classify-code/route";

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const title = typeof body.title === "string" ? body.title.trim() : null;
  if (!title) return Response.json({ error: "title is required" }, { status: 400 });

  const { data: deck, error } = await supabase
    .from("decks")
    .insert({ title, user_id: user.id, topic_tags: [], card_count: 0 })
    .select()
    .single();

  if (error || !deck) return Response.json({ error: error?.message ?? "Insert failed" }, { status: 500 });

  // Fire-and-forget — classify in background, doesn't block response
  classifyCodeDeck(deck.id).catch(() => {});

  return Response.json(deck, { status: 201 });
}

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const decksWithStats = await getDecks(user.id);
    return Response.json(decksWithStats);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/deck-card.tsx src/app/api/decks/route.ts
git commit -m "feat(kata): add Code button to deck cards + classify-code on deck creation"
```

---

### Task 10: Final Type-Check, Smoke Test, and Push

**Files:** No new files.

- [ ] **Step 1: Full TypeScript check**

Run: `npx tsc --noEmit`

Expected: zero errors across all files.

- [ ] **Step 2: Run unit tests**

Run: `npm test`

Expected: all tests pass, including the `kata.test.ts` suite (4 tests).

- [ ] **Step 3: Build check**

Run: `npm run build`

Expected: build completes without errors. Any "Dynamic server usage" warnings for the kata routes are expected and fine.

- [ ] **Step 4: Manual smoke test checklist**

With a local dev server running (`npm run dev`):

1. Create a new deck titled "JavaScript Arrays" — confirm deck creation succeeds and returns immediately (classification runs in background).
2. Wait ~5 seconds, refresh the dashboard — if `is_code_deck` was set to true, the Code button should appear on the deck card.
3. Click the Code button — should navigate to `/kata/[deckId]` and show a loading skeleton.
4. After ~3–5 seconds, kata should appear with a problem title, description, and function stub pre-loaded in the editor.
5. Write a solution, click Run or press Ctrl+Enter — results panel should appear with ✓/✗ indicators.
6. Click ↻ New kata — a new problem should generate.
7. Verify `/api/kata/[deckId]/history` returns JSON with past attempts.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat(kata): complete kata practice feature — deck classification, AI kata generation, Vercel Sandbox execution, split-pane editor"
```
