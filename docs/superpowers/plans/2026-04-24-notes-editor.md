---
assigned-to: both
status: ready
context: "Additive feature — do NOT touch import or generate-topic routes. generateCards gains a third mode 'notes'. The filePath arg is repurposed as a title hint in notes mode (intentional). AppSidebar NAV_LINKS uses 'as const' — safe to add a new entry. notes table source_path unique constraint: use UUID to avoid conflicts."
---

# Notes Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/notes` page where users paste their study notes, hit Generate, and get an AI-generated flashcard deck — no file upload needed.

**Architecture:** A new `"notes"` mode is added to `generateCards` with a broad, subject-agnostic system prompt. A new `POST /api/notes` route handles auth, validation, and DB writes (identical pattern to `/api/generate-topic`). A new `/notes` page provides the UI with a textarea + optional title + single result card. The sidebar gains a Notes nav link at position 2.

**Tech Stack:** Next.js 16 App Router, Supabase (server client + service role client), Vercel AI SDK (`generateCards`), Tailwind v4, ShadCN Button + Link.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `src/lib/ai/generate-cards.ts` | Add `"notes"` mode, `NOTES_SYSTEM_PROMPT`, notes user prompt |
| Create | `src/app/api/notes/route.ts` | POST handler — auth, validate, generateCards, insert note/deck/cards |
| Create | `src/app/notes/page.tsx` | Notes editor UI — textarea, title, states, result card |
| Modify | `src/components/app-sidebar.tsx` | Add Notes nav link at index 1 |

---

## Engineer Tasks

### Task E1: Add `"notes"` mode to `generateCards`

**Files:**
- Modify: `src/lib/ai/generate-cards.ts`

- [ ] **Step 1: Add `NOTES_SYSTEM_PROMPT` and extend mode type**

Open `src/lib/ai/generate-cards.ts`. After the `TOPIC_SYSTEM_PROMPT` constant, add:

```ts
const NOTES_SYSTEM_PROMPT =
  "You are a study content generator. Given notes on any subject, extract the key concepts, " +
  "facts, and ideas and generate flashcards for active recall practice. Generate 8–15 cards " +
  "depending on content depth. If an optional title is provided, use it as the deck title; " +
  "otherwise, infer a clear, specific title from the content. Every card must be self-contained.";
```

Change the function signature from:

```ts
export async function generateCards(
  content: string,
  filePath: string,
  mode: "file" | "topic" = "file"
```

to:

```ts
export async function generateCards(
  content: string,
  filePath: string,
  mode: "file" | "topic" | "notes" = "file"
```

- [ ] **Step 2: Wire the notes system prompt and user prompt**

In the body of `generateCards`, find the lines:

```ts
  const systemPrompt = mode === "topic" ? TOPIC_SYSTEM_PROMPT : FILE_SYSTEM_PROMPT;
  const userPrompt =
    mode === "topic"
      ? `Topic: ${content}`
      : `File: ${filePath}\n\n${content}`;
```

Replace them with:

```ts
  const systemPrompt =
    mode === "topic"
      ? TOPIC_SYSTEM_PROMPT
      : mode === "notes"
        ? NOTES_SYSTEM_PROMPT
        : FILE_SYSTEM_PROMPT;

  const userPrompt =
    mode === "topic"
      ? `Topic: ${content}`
      : mode === "notes"
        ? (filePath ? `Title: ${filePath}\n\n` : "") + `Notes:\n${content}`
        : `File: ${filePath}\n\n${content}`;
```

- [ ] **Step 3: Verify TypeScript compiles cleanly**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/ai/generate-cards.ts
git commit -m "feat(ai): add notes mode to generateCards with subject-agnostic system prompt"
```

---

### Task E2: Create `POST /api/notes` route

**Files:**
- Create: `src/app/api/notes/route.ts`

- [ ] **Step 1: Create the route file**

Create `src/app/api/notes/route.ts` with the following content:

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
  const content: string =
    typeof body.content === "string" ? body.content.trim() : "";
  const title: string =
    typeof body.title === "string" ? body.title.trim() : "";

  if (!content || content.length < 1) {
    return Response.json({ error: "content is required" }, { status: 400 });
  }
  if (content.length > 10000) {
    return Response.json(
      { error: "content must be 10,000 characters or fewer" },
      { status: 400 }
    );
  }
  if (title.length > 120) {
    return Response.json(
      { error: "title must be 120 characters or fewer" },
      { status: 400 }
    );
  }

  const db = serviceClient();

  try {
    const { deck, provider, model } = await generateCards(
      content,
      title,
      "notes"
    );

    const sourcePath = `notes-editor/${randomUUID()}`;

    const { data: note, error: noteError } = await db
      .from("notes")
      .insert({
        user_id: user.id,
        title: deck.title,
        source_path: sourcePath,
        raw_content: content,
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
      if (cardsError)
        throw new Error(`Cards insert failed: ${cardsError.message}`);
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
    console.error("notes route error:", message);
    return Response.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles cleanly**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Smoke-test the route**

Start the dev server (`npm run dev`) and — while signed in — run in a separate terminal:

```bash
curl -s -X POST http://localhost:3001/api/notes \
  -H "Content-Type: application/json" \
  -H "Cookie: $(cat /tmp/trove-cookie 2>/dev/null || echo '')" \
  -d '{"content":"Photosynthesis converts light energy into chemical energy stored in glucose. Chlorophyll absorbs red and blue light. The light-dependent reactions occur in the thylakoid membrane. The Calvin cycle occurs in the stroma.","title":"Biology Notes"}' \
  | jq .
```

Expected shape (values will differ): `{"deckId":"<uuid>","title":"...","cardCount":<number>,"provider":"...","model":"..."}`.

If not signed in via curl, simply check that visiting the route unauthenticated returns `{"error":"Unauthorized"}` with status 401. The full smoke test can be done manually via the UI in the next task.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/notes/route.ts
git commit -m "feat(api): add POST /api/notes — paste notes, generate flashcard deck"
```

---

## UI Designer Tasks

### Task U1: Create `/notes` page

**Files:**
- Create: `src/app/notes/page.tsx`

- [ ] **Step 1: Create the page file**

Create `src/app/notes/page.tsx` with the following content:

```tsx
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
```

- [ ] **Step 2: Verify TypeScript compiles cleanly**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Verify the page renders**

Start the dev server (`npm run dev`) and visit `http://localhost:3001/notes` while signed in.

Confirm:
- Page heading "Notes Editor" with subtitle renders
- Optional title input and notes textarea visible in card
- Character counter does NOT appear until 8,000+ chars are typed
- Generate button is disabled until at least 20 characters are in the textarea
- Submitting shows the spinner state
- After success: result card shows deck title, card count, provider/model, and "Study deck →" link
- "Generate from more notes" button resets to the idle form
- Error state: if the API returns an error, it shows inline below the form

- [ ] **Step 4: Commit**

```bash
git add src/app/notes/page.tsx
git commit -m "feat(ui): add /notes page — paste notes, generate flashcard deck"
```

---

### Task U2: Add Notes link to sidebar

**Files:**
- Modify: `src/components/app-sidebar.tsx`

- [ ] **Step 1: Add the Notes entry to `NAV_LINKS`**

Open `src/components/app-sidebar.tsx`. Find the `NAV_LINKS` array:

```ts
const NAV_LINKS = [
  {
    href: "/",
    label: "Decks",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h12M6 10h12M6 14h8" />
      </svg>
    ),
  },
  {
    href: "/generate",
    label: "Generate",
    ...
```

Insert the Notes entry at index 1 (between Decks and Generate):

```ts
const NAV_LINKS = [
  {
    href: "/",
    label: "Decks",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h12M6 10h12M6 14h8" />
      </svg>
    ),
  },
  {
    href: "/notes",
    label: "Notes",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
  },
  {
    href: "/generate",
    label: "Generate",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
      </svg>
    ),
  },
  {
    href: "/import",
    label: "Import",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 12V4m0 8l-3-3m3 3l3-3" />
      </svg>
    ),
  },
] as const;
```

- [ ] **Step 2: Verify TypeScript compiles cleanly**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Verify the sidebar renders correctly**

Visit `http://localhost:3001` while signed in. Confirm:
- Sidebar shows four nav links in order: Decks, Notes, Generate, Import
- Clicking "Notes" navigates to `/notes`
- The pencil/edit icon renders correctly (pencil square icon at h-4 w-4)

- [ ] **Step 4: Commit**

```bash
git add src/components/app-sidebar.tsx
git commit -m "feat(ui): add Notes nav link to sidebar"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] New `"notes"` mode in `generateCards` with broad system prompt — Task E1
- [x] `NOTES_SYSTEM_PROMPT` constant added — Task E1
- [x] Notes user prompt includes optional title hint — Task E1
- [x] `POST /api/notes` route — auth, validation (content 1–10,000, title max 120), generateCards, note/deck/cards insert — Task E2
- [x] `source_path: "notes-editor/<uuid>"` — Task E2
- [x] Returns `{ deckId, title, cardCount, provider, model }` — Task E2
- [x] `/notes` page — idle state with title input + textarea — Task U1
- [x] Character counter at 8,000+ chars — Task U1
- [x] Generate button disabled until 20+ chars — Task U1
- [x] Generating spinner state — Task U1
- [x] Done state: result card with deck title, card count, provider/model, Study deck link — Task U1
- [x] "Generate from more notes" reset button — Task U1
- [x] Error state inline below form — Task U1
- [x] Notes sidebar link at index 1 (Decks → Notes → Generate → Import) — Task U2
- [x] Pencil/edit icon matching existing stroke style — Task U2

**Placeholder scan:** No TBD, TODO, "similar to", or vague steps found.

**Type consistency:**
- `generateCards(content, title, "notes")` — `title` passed as the `filePath` arg (string), consistent with signature `generateCards(content: string, filePath: string, mode: "file" | "topic" | "notes")`
- `NotesResult` in `page.tsx` keys (`deckId`, `title`, `cardCount`, `provider`, `model`) match exactly what `/api/notes` returns
- `MAX_CHARS`, `COUNTER_THRESHOLD`, `MIN_CHARS` defined as constants at top of page — used consistently throughout
