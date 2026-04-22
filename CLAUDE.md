@AGENTS.md

# Quizly — AI Quiz App

An AI-powered study app that transforms notes into interactive flashcard decks.

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 16 (App Router), Tailwind v4, ShadCN |
| Database | Supabase (Postgres + Auth) — project ref: `wlghyvhrzdhfnkykhcoj` |
| Backend | Supabase Edge Functions (Deno) |
| AI | Vercel AI SDK — `@ai-sdk/anthropic` + `@ai-sdk/openai` |
| Hosting | Vercel |

## Project Structure

```
src/
  app/
    page.tsx                  # Dashboard — deck grid
    layout.tsx                # App shell with nav
    import/page.tsx           # Drag-and-drop .md file importer
    decks/[id]/page.tsx       # Deck detail + flashcard study mode
    api/
      import/route.ts         # POST — accepts .md files, runs AI pipeline
      decks/route.ts          # GET — all decks (service role, no auth yet)
      decks/[id]/route.ts     # GET — single deck + cards
  components/
    deck-card.tsx             # Deck grid card component
    ui/                       # ShadCN components
  lib/
    ai/
      generate-cards.ts       # Cost-based model router + generateObject call
      schema.ts               # Zod schema for Claude/OpenAI response
    supabase/
      client.ts               # Browser client
      server.ts               # Server client (cookie-based)
    database.types.ts         # Generated Supabase types

supabase/
  functions/ingest/index.ts   # Edge function — GitHub webhook handler
  migrations/                 # SQL migrations
```

## AI Pipeline

Cards are generated via `src/lib/ai/generate-cards.ts`. Models are tried cheapest-first:

```
gpt-4o-mini ($0.15) → claude-haiku ($0.80) → claude-sonnet ($3.00) → gpt-4o ($2.50)
```

`generateObject` + Zod schema validates the response — never parses raw JSON.

## Database Schema

```
notes      — raw source content (title, source_path, raw_content, github_sha)
decks      — generated study deck per note (title, topic_tags, card_count)
cards      — individual flashcards (front, back, card_type, times_seen, times_correct)
sessions   — study sessions (deck_id, started_at, completed_at, score)
```

RLS is enabled on all tables. Currently `user_id` is null (no auth yet) — API routes use the service role key to bypass RLS.

## Current State

- ✅ Import page — upload .md files → AI generates flashcards → saved to Supabase
- ✅ Dashboard — deck grid with title, tags, card count
- ✅ Flashcard study mode — flip cards, knew it / still learning, session summary
- ✅ Cost-based model routing — cheapest model tried first, fallback on failure
- ✅ GitHub webhook edge function — deployed but webhook not wired up yet
- ❌ Auth — not implemented yet, all data is anonymous (user_id = null)
- ❌ Notes editor page — planned: textarea in app, write notes → generate cards + AI-expanded cards
- ❌ AI-expanded cards — after generating from user notes, Claude should also generate extra cards on the same topics

## What's Next

1. **Auth** — Supabase Auth so each user has their own decks
2. **Notes editor page** — write/paste notes in the app, hit Generate, cards appear
3. **AI-expanded cards** — Claude generates additional cards beyond what the user wrote
4. **Study session tracking** — persist knew it/still learning results to the `sessions` table

## Key Decisions

- **No GitHub webhook for MVP** — using direct import instead. Webhook edge function exists but isn't the primary flow.
- **Service role key in API routes** — intentional until auth is added. Once auth lands, scope queries by `user_id` and drop the service role usage.
- **No OpenRouter** — direct `@ai-sdk/anthropic` + `@ai-sdk/openai` with cost-based priority list. User owns both API keys.
- **Separate API routes for all Supabase reads** — browser client + anon key blocked by RLS, so server-side routes use service role key.

## Principles

- Never expose `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, or `SUPABASE_SERVICE_ROLE_KEY` to the frontend
- Always use `generateObject` + Zod schema — never parse raw AI text
- Handle AI errors gracefully — model fallback, never silent failure
- Keep edge functions single-purpose
