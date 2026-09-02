# Generate from Topic Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

---
assigned-to: agent
status: complete
context: >
  User chose Option A — create a new deck every time, using `topic-generate/<uuid>` as the
  source_path for the notes row. No deduplication, no schema changes. The existing
  `notes.source_path` unique constraint is on `(source_path, github_sha)` — using a fresh
  UUID each time means every generation is a distinct row and there are no conflicts.

---

**Goal:** Add a "Generate from Topic" flow — a page where the user types a topic (e.g. "React hooks") and Trove generates a full flashcard deck about it using AI, saving it the same way the file-import flow does.

**Architecture:** A new page at `/generate` renders a form. On submit it calls a new API route `POST /api/generate-topic` which calls the existing `generateCards` function with a synthetic prompt, then saves a `notes` row (`source_path = topic-generate/<uuid>`) and a `decks`+`cards` row — identical shape to what the import route produces. The nav gets a "Generate" link alongside "Import".

**Tech Stack:** Next.js App Router (client page + route handler), `generateCards` from `src/lib/ai/generate-cards.ts`, Supabase service client, existing Zod schema, Tailwind v4 + ShadCN Button.

---

## File Map

| Status | Path | Responsibility |
|--------|------|----------------|
| Create | `src/app/generate/page.tsx` | Client page — topic input form + loading/result states |
| Create | `src/app/api/generate-topic/route.ts` | POST handler — auth, AI call, DB writes, response |
| Modify | `src/lib/ai/generate-cards.ts` | Accept optional `mode` param to distinguish topic vs file prompt |
| Modify | `src/app/layout.tsx` | Add "Generate" nav link |

---

## Task 1: Extend `generateCards` to accept a topic prompt

`generateCards` currently takes `content` (markdown body) and `filePath`. When generating from a topic there is no file — we need a different system prompt and a different user prompt. The cleanest change is a third optional argument `mode: "file" | "topic"` that selects the prompt template. Keeping one function avoids duplicating the model-fallback loop.

**Files:**
- Modify: `src/lib/ai/generate-cards.ts`

- [ ] **Step 1: Open the file and read it**

  Confirm the existing signature: `generateCards(content: string, filePath: string)`.

- [ ] **Step 2: Add the `mode` param and topic system prompt**

  Replace the file content with:

  ```ts
  import { generateObject } from "ai";
  import { createAnthropic } from "@ai-sdk/anthropic";
  import { createOpenAI } from "@ai-sdk/openai";
  import { DeckSchema, type GeneratedDeck } from "./schema";

  const FILE_SYSTEM_PROMPT =
    "You are a study content generator. Given a Markdown note about software engineering, " +
    "extract key concepts and generate flashcards for active recall practice. " +
    "Generate 5–15 cards depending on content depth. If the note has no learnable concepts, return an empty cards array.";

  const TOPIC_SYSTEM_PROMPT =
    "You are a study content generator. Given a topic name, generate comprehensive flashcards " +
    "for active recall practice covering the most important concepts, APIs, patterns, and gotchas. " +
    "Generate 10–15 cards. Every card must be self-contained — do not reference other cards.";

  // Ordered cheapest → most capable. Each entry skipped if its key isn't set.
  const MODEL_PRIORITY = [
    { provider: "openai" as const, model: "gpt-4o-mini" },
    { provider: "anthropic" as const, model: "claude-haiku-4-5-20251001" },
    { provider: "anthropic" as const, model: "claude-sonnet-4-6" },
    { provider: "openai" as const, model: "gpt-4o" },
  ];

  export async function generateCards(
    content: string,
    filePath: string,
    mode: "file" | "topic" = "file"
  ): Promise<{ deck: GeneratedDeck; provider: string; model: string }> {
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    const anthropic = anthropicKey ? createAnthropic({ apiKey: anthropicKey }) : null;
    const openai = openaiKey ? createOpenAI({ apiKey: openaiKey }) : null;

    const systemPrompt = mode === "topic" ? TOPIC_SYSTEM_PROMPT : FILE_SYSTEM_PROMPT;
    const userPrompt =
      mode === "topic"
        ? `Topic: ${content}`
        : `File: ${filePath}\n\n${content}`;

    const errors: string[] = [];

    for (const { provider, model } of MODEL_PRIORITY) {
      const client = provider === "anthropic" ? anthropic : openai;
      if (!client) continue;

      try {
        const { object } = await generateObject({
          model: client(model),
          schema: DeckSchema,
          system: systemPrompt,
          prompt: userPrompt,
        });
        return { deck: object, provider, model };
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        errors.push(`${provider}/${model}: ${reason}`);
        console.warn(`Model failed, trying next. ${provider}/${model}: ${reason}`);
      }
    }

    throw new Error(`All models failed:\n${errors.join("\n")}`);
  }
  ```

- [ ] **Step 3: Verify the existing import route still builds**

  ```bash
  cd /Users/chelseygowac/ai-quiz-app && npx tsc --noEmit 2>&1 | head -30
  ```

  Expected: no errors (the new param is optional with a default — callers that omit it are unaffected).

- [ ] **Step 4: Commit**

  ```bash
  git add src/lib/ai/generate-cards.ts
  git commit -m "feat: add topic mode to generateCards with dedicated system prompt"
  ```

---

## Task 2: Create the `POST /api/generate-topic` route handler

This is the server-side half: validate auth, call `generateCards` in topic mode, write `notes` + `decks` + `cards` rows with `source_path = topic-generate/<uuid>`, and return the new deck id and card count.

**Files:**
- Create: `src/app/api/generate-topic/route.ts`

- [ ] **Step 1: Create the file**

  ```ts
  import { NextRequest } from "next/server";
  import { createClient } from "@/lib/supabase/server";
  import { createClient as createServiceClient } from "@supabase/supabase-js";
  import { generateCards } from "@/lib/ai/generate-cards";
  import type { Database } from "@/lib/database.types";
  import { randomUUID } from "crypto";

  function serviceClient() {
    return createServiceClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  export async function POST(request: NextRequest) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const topic: string = typeof body.topic === "string" ? body.topic.trim() : "";

    if (!topic) {
      return Response.json({ error: "topic is required" }, { status: 400 });
    }

    if (topic.length > 200) {
      return Response.json({ error: "topic must be 200 characters or fewer" }, { status: 400 });
    }

    const db = serviceClient();

    try {
      const { deck, provider, model } = await generateCards(topic, "", "topic");

      const sourcePath = `topic-generate/${randomUUID()}`;

      const { data: note, error: noteError } = await db
        .from("notes")
        .insert({
          user_id: user.id,
          title: deck.title,
          source_path: sourcePath,
          raw_content: topic,
          github_sha: null,
          processed_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (noteError) throw new Error(`Note insert failed: ${noteError.message}`);

      const { data: newDeck, error: deckError } = await db
        .from("decks")
        .insert({
          note_id: note.id,
          user_id: user.id,
          title: deck.title,
          topic_tags: deck.topic_tags,
        })
        .select()
        .single();

      if (deckError) throw new Error(`Deck insert failed: ${deckError.message}`);

      if (deck.cards.length > 0) {
        const { error: cardsError } = await db.from("cards").insert(
          deck.cards.map((card) => ({
            deck_id: newDeck.id,
            front: card.front,
            back: card.back,
            card_type: card.card_type,
          }))
        );
        if (cardsError) throw new Error(`Cards insert failed: ${cardsError.message}`);
      }

      return Response.json({
        deckId: newDeck.id,
        title: deck.title,
        cardCount: deck.cards.length,
        provider,
        model,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("generate-topic error:", message);
      return Response.json({ error: message }, { status: 500 });
    }
  }
  ```

- [ ] **Step 2: Type-check**

  ```bash
  cd /Users/chelseygowac/ai-quiz-app && npx tsc --noEmit 2>&1 | head -30
  ```

  Expected: no errors.

- [ ] **Step 3: Commit**

  ```bash
  git add src/app/api/generate-topic/route.ts
  git commit -m "feat: add POST /api/generate-topic route handler"
  ```

---

## Task 3: Build the `/generate` page

A focused client component: a text input for the topic, a Submit button, a loading state while the AI runs, and a success state that links straight to the new deck. Error state shows the message inline.

**Files:**
- Create: `src/app/generate/page.tsx`

- [ ] **Step 1: Create the file**

  ```tsx
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
            Enter any topic and Trove will generate a study deck using AI.
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
  ```

- [ ] **Step 2: Type-check**

  ```bash
  cd /Users/chelseygowac/ai-quiz-app && npx tsc --noEmit 2>&1 | head -30
  ```

  Expected: no errors.

- [ ] **Step 3: Commit**

  ```bash
  git add src/app/generate/page.tsx
  git commit -m "feat: add /generate page with topic input and loading/result states"
  ```

---

## Task 4: Add "Generate" link to the nav

The layout nav currently has "Decks" and "Import" for authenticated users. Add "Generate" between them.

**Files:**
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Add the nav link**

  Find this block in `src/app/layout.tsx`:

  ```tsx
              <nav className="flex items-center gap-0.5">
                  <Link
                    href="/"
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground/80 transition-all duration-150 hover:bg-muted/40 hover:text-foreground"
                  >
                    Decks
                  </Link>
                  <Link
                    href="/import"
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground/80 transition-all duration-150 hover:bg-muted/40 hover:text-foreground"
                  >
                    Import
                  </Link>
                </nav>
  ```

  Replace with:

  ```tsx
              <nav className="flex items-center gap-0.5">
                  <Link
                    href="/"
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground/80 transition-all duration-150 hover:bg-muted/40 hover:text-foreground"
                  >
                    Decks
                  </Link>
                  <Link
                    href="/generate"
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground/80 transition-all duration-150 hover:bg-muted/40 hover:text-foreground"
                  >
                    Generate
                  </Link>
                  <Link
                    href="/import"
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground/80 transition-all duration-150 hover:bg-muted/40 hover:text-foreground"
                  >
                    Import
                  </Link>
                </nav>
  ```

- [ ] **Step 2: Type-check and build**

  ```bash
  cd /Users/chelseygowac/ai-quiz-app && npx tsc --noEmit 2>&1 | head -30
  ```

  Expected: no errors.

- [ ] **Step 3: Commit**

  ```bash
  git add src/app/layout.tsx
  git commit -m "feat: add Generate link to nav"
  ```

---

## Task 5: Manual smoke test

Verify the full flow end-to-end against the running dev server.

**Files:** none

- [ ] **Step 1: Start the dev server**

  ```bash
  cd /Users/chelseygowac/ai-quiz-app && npm run dev
  ```

  Expected: server starts on port 3001 (or whichever port is configured).

- [ ] **Step 2: Sign in and navigate to `/generate`**

  Open `http://localhost:3001/generate` in a browser. Verify:
  - Page heading reads "Generate from Topic"
  - Text input is focused
  - "Generate deck" button is disabled when input is empty

- [ ] **Step 3: Submit a topic**

  Type "React hooks" and click "Generate deck". Verify:
  - Button disappears, spinner appears with "Generating deck…" text
  - After 5–15 seconds the success card appears with a title, card count, and "Study deck →" link
  - "via openai/gpt-4o-mini" (or whichever model ran) is shown

- [ ] **Step 4: Navigate to the deck**

  Click "Study deck →". Verify:
  - Redirects to `/decks/<uuid>`
  - Cards are present and flippable

- [ ] **Step 5: Check the dashboard**

  Navigate to `/` (Decks). Verify:
  - The newly generated deck appears in the grid with correct title and card count

- [ ] **Step 6: Generate another**

  Click "Generate another" on the success card. Verify:
  - Form resets to empty input, idle state

- [ ] **Step 7: Test error path**

  Temporarily break the API key in `.env.local` (e.g. set `OPENAI_API_KEY=bad`), submit a topic. Verify:
  - Error message appears inline below the form
  - Form is still usable (can edit input and retry)
  - Restore the correct API key.

- [ ] **Step 8: Commit (no code changes needed if all passes)**

  If no fixes were needed, no commit required. If you fixed a bug, commit with:

  ```bash
  git add -p
  git commit -m "fix: <describe what you fixed>"
  ```

---

## Self-Review

### Spec coverage

| Requirement | Covered by |
|---|---|
| New deck every time, no deduplication | Task 2 — `insert` (not `upsert`), fresh UUID each call |
| `source_path = topic-generate/<uuid>` | Task 2, `randomUUID()` |
| No schema changes | Confirmed — existing `notes`/`decks`/`cards` schema unchanged |
| AI generates cards from topic | Task 1 — new `TOPIC_SYSTEM_PROMPT` and `mode` param |
| User sees result with link to deck | Task 3 — success state with `Study deck →` link |
| Nav entry for the new page | Task 4 |
| Auth required | Task 2 — 401 if no user |

### Placeholder scan

No TBDs, TODOs, or vague instructions found. Every step includes the exact code or command.

### Type consistency

- `generateCards(content, filePath, mode?)` — `mode` defaults to `"file"`, used as `"topic"` in the route handler.
- `GenerateResult` interface in the page matches the JSON shape returned by the route (`deckId`, `title`, `cardCount`, `provider`, `model`).
- Route handler uses `randomUUID` from Node's built-in `crypto` module — no external dependency needed.
- `db.from("notes").insert(...)` — no `onConflict` clause (intentional; Option A = always insert).
