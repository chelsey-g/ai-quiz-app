# Notes Editor — Design Spec

**Date:** 2026-04-24
**Status:** Ready for implementation

## Problem

Both existing creation flows have friction:
- **Import** requires users to have a `.md` file on disk — many users have notes in other forms (pasted from slides, copied from docs, typed into a notes app).
- **Generate from topic** produces generic AI cards with no grounding in the user's own material.

The Notes Editor bridges the gap: paste your actual notes → get cards that reflect your specific material, instantly.

## Solution

A `/notes` page with a large textarea (up to 10,000 characters), an optional deck title field, and a Generate button. On submit, the content is sent to a new `/api/notes` POST route, which runs the existing AI pipeline and saves the resulting deck to the user's account. The result is a single result card with a "Study deck" link — identical in shape to the generate-topic result.

## Scope

Five precise changes:

1. **New mode in `generateCards`** — add `"notes"` as a third mode value, with a broad, subject-agnostic system prompt
2. **New API route** — `POST /api/notes` accepting `{ content: string; title?: string }`
3. **New page** — `src/app/notes/page.tsx` with textarea + optional title field + result UI
4. **Sidebar update** — add "Notes" nav link in position 2 (after Decks, before Generate)
5. **`generateCards` signature** — extend mode union type to include `"notes"`

## generateCards Changes

Add a `NOTES_SYSTEM_PROMPT` constant:

```
"You are a study content generator. Given notes on any subject, extract the key concepts, 
facts, and ideas and generate flashcards for active recall practice. Generate 8–15 cards 
depending on content depth. If an optional title is provided, use it as the deck title; 
otherwise, infer a clear, specific title from the content. Every card must be self-contained."
```

Extend the `mode` parameter type: `"file" | "topic" | "notes"`.

In the user prompt for `"notes"` mode: include the optional title hint if provided, then the raw content.

## API Route — `POST /api/notes`

**File:** `src/app/api/notes/route.ts`

Request body:
```ts
{ content: string; title?: string }
```

- Validates: `content` required, 1–10,000 chars; `title` optional, max 120 chars
- Calls `generateCards(content, titleHint, "notes")` — passes `title` (or empty string) as the `filePath` argument (repurposed as a hint; the notes prompt uses it if provided)
- Inserts `note` row with `source_path: "notes-editor/<uuid>"`
- Inserts `deck` row with `user_id`
- Inserts `cards`
- Returns `{ deckId, title, cardCount, provider, model }`

Auth: requires authenticated user (same pattern as import and generate-topic routes).

## Page — `/notes`

**File:** `src/app/notes/page.tsx`

States: `idle | generating | done | error` (same shape as generate page).

### Idle state

Two inputs stacked vertically inside a rounded card:

1. **Title (optional)** — single-line text input, placeholder "e.g. Week 3 — Photosynthesis", max 120 chars
2. **Notes textarea** — large, resizable-vertical textarea, placeholder "Paste or type your notes here…", max 10,000 chars. Character counter appears at 8,000+ chars showing `X / 10,000`.

Generate button below (full-width, disabled until textarea has at least 20 chars of content).

### Generating state

Same spinner card as generate page ("Generating deck… This usually takes 5–15 seconds.").

### Done state

Same result card as generate page:
- Deck title (truncated)
- Card count · via provider/model
- "Study deck →" link to `/decks/[id]`
- "Generate from more notes" button to reset

### Error state

Inline error message below the form, same styling as generate page.

## Sidebar Update

`src/components/app-sidebar.tsx` — add Notes link to `NAV_LINKS` array in position 2 (index 1):

```ts
{
  href: "/notes",
  label: "Notes",
  icon: <pencil/edit SVG>,
}
```

Order becomes: Decks → Notes → Generate → Import.

Icon: pencil/edit icon (consistent stroke style with existing icons, `h-4 w-4`, `strokeWidth={1.75}`).

## Data Flow

```
User types notes + optional title
  → POST /api/notes { content, title? }
    → auth check
    → generateCards(content, title || "", "notes")
      → NOTES_SYSTEM_PROMPT + cheapest-first model fallback
      → returns { deck, provider, model }
    → insert note (source_path: "notes-editor/<uuid>")
    → insert deck (note_id, user_id, title, topic_tags)
    → insert cards
    → return { deckId, title, cardCount, provider, model }
  → page shows result card with Study deck link
```

## Constraints & Watch-outs

- `generateCards` filePath argument is repurposed as a title hint in notes mode — this is intentional and documented in the prompt. The "file" mode still uses it as a file path; no conflict.
- Do NOT modify the import or generate-topic routes — this is additive only.
- The `notes` table `source_path` column has a unique constraint on `(source_path, github_sha)` — using UUID prevents collisions even if the same content is submitted twice.
- Character limit of 10,000 enforced both client-side (textarea maxLength) and server-side (validation in route).
- No autosave, no draft persistence — MVP is fully stateless.
- `AppSidebar` uses `as const` on `NAV_LINKS` — adding a new entry is straightforward; no type changes needed since the array is only iterated.
