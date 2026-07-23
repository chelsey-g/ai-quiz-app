@AGENTS.md

# Quizly — AI Quiz App

Quizly is an AI-powered study platform: enter a topic or import your own notes to generate flashcards and quizzes, study them with SM-2 spaced repetition, and share decks/collections publicly for forking. Includes quiz modes with AI grading and wrong-answer explanations, coding kata practice with in-browser execution, challenges between users, streaks, and stats.

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 16 (App Router), Tailwind v4, ShadCN |
| Database | Supabase (Postgres + Auth) — project ref: `wlghyvhrzdhfnkykhcoj` |
| AI | Vercel AI SDK v6 via AI Gateway (`@ai-sdk/gateway`) |
| Code execution | Vercel Sandbox (kata test runs) |
| Hosting | Vercel |

## Project Structure (route map, not exhaustive)

```
src/app/
  page.tsx                # Dashboard
  import/                 # .md file importer
  notes/                  # Notes editor → generate cards
  create/, generate/      # Topic-based deck generation
  decks/[id]/             # Deck detail + flashcard study (SM-2)
  quiz/[deckId]/          # Quiz mode (MC + typed, AI grading/explanations)
  quiz/quick/             # Quick quiz (multi-deck)
  collections/, tags/     # Deck organization
  community/              # Public deck/collection browsing
  p/[id]/, c/[id]/        # Public deck / public collection pages (fork support)
  u/[username]/           # Public user profiles
  profile/, settings/     # Own profile (incl. flagged cards), preferences
  challenges/             # User-vs-user quiz challenges + notifications
  kata/                   # Coding kata: topic/skill picker, CodeMirror editor, sandbox runs
  stats/                  # Study stats (accuracy weighted by card count)
  auth/                   # Supabase Auth: login, signup, callback
  api/                    # Route handlers mirror the above (decks, cards, sessions,
                          # quiz/grade, quiz/explain, kata/*, community/*, challenges/*, …)

src/lib/
  ai/generate-cards.ts    # generateObject via AI Gateway, three prompt modes (file/topic/notes)
  ai/schema.ts            # Zod DeckSchema
  sm2.ts, streak.ts       # Spaced repetition + streak logic (unit-tested)
  services/               # decks, sessions, card-stats, stats, distractors, dashboard
  supabase/client.ts      # Browser client (anon key)
  supabase/server.ts      # Server client (cookie-based, user-scoped, RLS applies)
  supabase/admin.ts       # Service-role client — bypasses RLS, server-only

supabase/migrations/      # Source of truth for schema
```

## AI Pipeline

All generation goes through the Vercel AI Gateway with `generateObject` + Zod schema — raw AI text is never parsed directly. Primary model `openai/gpt-4o-mini`, with gateway fallbacks `anthropic/claude-haiku-4.5` → `anthropic/claude-sonnet-4-6` → `openai/gpt-4o` (see `src/lib/ai/generate-cards.ts`).

AI features: card generation (file/topic/notes modes), deck expansion (AI-expanded cards), MC distractor generation, typed-answer grading, wrong-answer explanations, kata generation + hints, code-deck classification.

Caveat: schema-valid ≠ good cards. The fallback chain can mask prompt regressions (e.g. gpt-4o-mini once returned string-serialized arrays for kata test cases).

## Database Schema (high level — migrations are authoritative)

```
notes               — raw source content
decks               — title, topic_tags, card_count, is_public, source_deck_id (forks), is_code_deck
cards               — front/back, tags, sort_order, flagged, mc_distractors/mc_status,
                      SM-2 fields (repetitions, ease_factor, interval_days, next_review_at),
                      times_seen/times_correct
sessions            — completed study sessions (user_id, deck_id, score, total)
profiles            — username (unique), avatar_url, study prefs, notification_prefs
collections         — deck groupings (+ collection_decks join), is_public
challenges          — user-vs-user quizzes (+ challenge_attempts)
notifications       — in-app notifications
kata_attempts       — kata history (deck_id nullable — kata is topic-based)
```

RLS is enabled on all tables; queries are scoped by `user_id` via the cookie-based server client. The service-role client (`supabase/admin.ts` and `services/sessions.ts`) is used only where RLS must be bypassed (e.g. session inserts + cross-user card stat updates). **Admin vs user client misuse is a recurring review item — always justify service-role usage.**

## Current State

Shipped: auth, dashboard, import, notes editor, topic generation, flashcard study, quiz mode (MC + typed with AI grading and explanations), quick quiz, multi-deck quiz, AI-expanded cards, collections, community decks/collections with forking, public profiles, challenges + notifications, kata practice (CodeMirror + Vercel Sandbox), streaks, stats, settings, card flagging.

Unit tests exist for sm2, streak, stats, distractors, kata parsing, shuffle, username (`*.test.ts` in src/lib).

**Known gap: SM-2 is scaffolded but UNWIRED** — `lib/sm2.ts` (tested) and the cards scheduling columns exist, but nothing calls the algorithm; all cards carry default values. See plan `2026-06-12-wire-sm2.md`.

## What's Next

Audit plans from 2026-06-12 (in `docs/superpowers/plans/`, ordered by priority):

1. **fix-card-stats-ownership** — HIGH: authed users can mutate other users' card stats via `/api/sessions`
2. **fork-field-parity** — community forks drop `mc_distractors`/`mc_status`/`sort_order`
3. **wire-sm2** — wire the dormant SM-2 implementation into reviews + study order (depends on 1)
4. **ai-rate-limiting** — per-user limits on the nine AI/sandbox routes
5. **eval-harness** — card-generation quality evals with drift detection

Then: **durable generation jobs** — long-running generation, spec in `docs/superpowers/plans/` (a179b24)

## Key Decisions

- **AI Gateway over direct provider SDKs** (May 2026) — replaced the original hand-rolled free→paid cascade (`@ai-sdk/anthropic`/`@ai-sdk/openai` + Gemini/Groq) with `@ai-sdk/gateway` model fallbacks. Old packages still in package.json but `generate-cards.ts` is gateway-only.
- **Service role only where RLS can't work** — auth shipped; user-scoped server client is the default, admin client is the exception and must be justified.
- **Kata is topic-based, not deck-based** (May 2026) — deck-based kata routes were removed; `kata_attempts.deck_id` is nullable.
- **Plans live in `docs/superpowers/plans/`** — dated implementation plans; shipped plans get an "## Outcome" note (maintained by the daily review routine).
- **No GitHub webhook** — direct import won; the old ingest edge function is not the flow.

## Principles

- Never expose API keys or `SUPABASE_SERVICE_ROLE_KEY` to the frontend
- Always use `generateObject` + Zod schema — never parse raw AI text
- Handle AI errors gracefully — model fallback, never silent failure
- Default to the user-scoped server client; treat service-role usage as exceptional
