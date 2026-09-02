# Deck Chat Assistant Design

**Date:** 2026-07-21
**Status:** Approved

## Overview

A floating chat widget, available on every authenticated page, that lets the user ask a general study assistant anything, and `@`-mention a specific card from the deck they're currently viewing to pull its exact content into context for follow-up questions. No chat history is persisted to the database — conversation state lives in memory for the session and survives in-app navigation but resets on a full page refresh.

## Architecture

A `ChatProvider` client component is mounted once in the root layout (`src/app/layout.tsx`), inside the existing authenticated branch, alongside `AppSidebar`/`TopBar`. It holds:

- The AI SDK v6 `useChat` state (messages, streaming status).
- Open/closed state for the widget panel.
- The current deck's available cards (for `@`-mention search).

Because the provider lives in the layout rather than in a page, it is not remounted on client-side navigation — this is what gives "accessible anywhere, survives navigation" for free, with no extra persistence layer. A hard refresh naturally clears it.

The provider uses `usePathname()` to detect a deck-scoped route:

- `/decks/[id]`
- `/quiz/[deckId]`

When the matched id changes, it fetches the existing `GET /api/decks/[id]` endpoint (already RLS-scoped, already returns `{ deck, cards }`) to populate the mention-search list. No new endpoint is needed for this. Off a deck route (dashboard, settings, `/quiz/quick`, kata, etc.), there is no available-cards list and `@` shows an empty state ("Open a deck to reference its cards").

The deck-route-matching logic is a small pure function (path → `deckId | null`) worth unit testing directly.

## `@`-Mention Flow

Typing `@` in the chat input opens an inline autocomplete, filtered client-side by front-text match over the current deck's already-fetched cards. Selecting a card attaches it as a small removable chip on the in-progress message. Multiple mentions per message are allowed.

On send, the client posts to a new route:

```
POST /api/chat
Body: { messages: UIMessage[], deckId?: string, mentionedCardIds?: string[] }
```

The server never trusts client-supplied card *text* — only ids. If `mentionedCardIds` is present, it re-fetches those specific cards through the existing RLS-scoped deck service (`getDeckById`) and filters to the requested ids, so a user can never smuggle another user's card content into the prompt via a tampered request body.

**System prompt is layered:**

1. Base: "You are Trove's study assistant, a general helper for studying and using the app."
2. If `deckId` present: light ambient note only — e.g. "The user is currently viewing the deck '`<title>`'." No card dump.
3. If `mentionedCardIds` resolved to cards: explicit blocks per card ("front: ... / back: ..."), framed as "the user is asking specifically about these flashcards."

Follow-up questions don't require re-mentioning a card — the full conversation, including earlier turns where a card's content was injected into context, stays in the `useChat` message history for that session, so the model retains it naturally.

**Streaming:** standard AI SDK v6 chat pattern — `convertToModelMessages(messages)` → `streamText(...)` → `result.toUIMessageStreamResponse()`. Model: same gateway + fallback chain used elsewhere in the app (`openai/gpt-4o-mini` primary, gateway fallbacks `anthropic/claude-haiku-4.5` → `anthropic/claude-sonnet-4-6` → `openai/gpt-4o`).

**Auth:** `/api/chat` requires a signed-in user (matches every other AI route); the widget itself only renders in the authenticated branch of the root layout.

## UI

A floating bubble button, fixed bottom-right, present on every authenticated page. Clicking opens a panel (shadcn-styled, consistent with existing dialog/sheet visual language) containing:

- A header showing "Trove Assistant", or "Asking about: `<deck title>`" when a deck is currently active.
- A scrollable message list.
- The mention-aware input (with chip rendering for attached cards).

Closing the panel just hides it — messages and any in-flight state remain alive underneath until an actual page refresh.

## Error Handling

Mirrors the existing `/api/quiz/explain` pattern: if every model in the gateway fallback chain fails, the route streams a graceful in-bubble message ("Sorry, I couldn't process that — try again.") rather than surfacing a raw 500 to the widget.

## Rate Limiting

`/api/chat` is a new AI-spend route and ships **unmetered**, consistent with the nine existing AI/sandbox routes today (the rate-limiting plan, `docs/superpowers/plans/2026-06-12-ai-rate-limiting.md`, exists but hasn't been implemented yet). This spec adds `/api/chat` as a noted follow-up entry for that plan rather than building the rate limiter as part of this feature.

## Testing

- Unit test the deck-route-matching function (pure: pathname → deckId | null).
- Everything else (streaming behavior, mention search/autocomplete, server-side RLS re-verification of mentioned cards) is best verified by running the dev server and exercising the widget manually — no meaningful additional unit-testable logic.

## Non-Goals (v1)

- Cross-deck `@`-mention search (mentions are scoped to the currently-viewed deck only).
- Database-persisted chat history (in-memory only; resets on refresh).
- Tool-calling / agentic behavior (e.g. the bot querying other decks or stats on its own).
- Rate limiting on `/api/chat` (tracked as a follow-up on the existing rate-limiting plan).
