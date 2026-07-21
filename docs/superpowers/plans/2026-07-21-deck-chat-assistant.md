# Deck Chat Assistant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A floating chat widget available on every authenticated page, letting the user ask a general study assistant anything, and `@`-mention a specific card from the deck they're currently viewing to pull its exact content into context.

**Architecture:** A `ChatProvider` client component mounted once in the root layout holds chat state (`@ai-sdk/react`'s `useChat`) so it survives in-app navigation without any persistence layer. It watches the current route to know which deck (if any) is active, fetching that deck's cards via the existing `GET /api/decks/[id]` endpoint for `@`-mention search. A new `POST /api/chat` route streams responses via the AI Gateway, re-verifying any mentioned card ids server-side (never trusting client-supplied card text) before injecting them into the system prompt.

**Tech Stack:** Next.js 16 App Router, AI SDK v6 (`ai`) + `@ai-sdk/react` (new dependency) + `@ai-sdk/gateway`, Supabase (RLS-scoped server client), Tailwind v4.

## Global Constraints

- Deck-scoped routes are exactly `/decks/[id]` and `/quiz/[deckId]` — explicitly excluding `/quiz/quick` (multi-deck, no single deck id).
- No new endpoint for card listing — reuse the existing `GET /api/decks/[id]` (`{ deck, cards, deckStats }`).
- The server never trusts client-supplied card front/back text — only ids. It re-fetches via `getDeckById(deckId, user.id)` (RLS-scoped) and filters to the requested ids.
- No database persistence of chat messages — state lives only in the `ChatProvider` React context, reset on a full page refresh.
- Model chain matches the rest of the app: `openai/gpt-4o-mini` primary, gateway fallbacks `anthropic/claude-haiku-4.5` → `anthropic/claude-sonnet-4-6` → `openai/gpt-4o`.
- `/api/chat` ships **unmetered**, consistent with the app's other AI routes today — add a follow-up note to `docs/superpowers/plans/2026-06-12-ai-rate-limiting.md` rather than building the rate limiter now.
- The widget only renders in the authenticated branch of `src/app/layout.tsx`; `/api/chat` still independently requires a signed-in user (matches every other AI route's own auth check).
- Use Tailwind utility classes mapped to existing design tokens (`bg-background`, `text-foreground`, `border-border`, `bg-primary`, `text-primary-foreground`, `bg-muted`, `text-muted-foreground`, `bg-card`) — never hardcode color values inline.
- Component files are flat, kebab-case, under `src/components/` (no subfolders), matching the existing convention (`notification-panel.tsx`, `top-bar.tsx`, etc). Pure utility logic goes in `src/lib/utils/`, matching `paused-quiz.ts`, `shuffle-answers.ts`.

---

### Task 1: Add `@ai-sdk/react` dependency

**Files:**
- Modify: `package.json`, `package-lock.json`

**Interfaces:**
- Produces: the `useChat` hook (from `@ai-sdk/react`) and `DefaultChatTransport` (from `ai`), used starting in Task 4.

The installed `ai` package is `^6.0.168`. `@ai-sdk/react` v4.x targets `ai` v7 — it must **not** be installed. `@ai-sdk/react` v3.x is the version line built against `ai` v6 (confirmed: `@ai-sdk/react@3.0.234` depends on `ai@6.0.232`, which satisfies the app's existing `^6.0.168` range).

- [ ] **Step 1: Install the correct major version**

Run: `npm install @ai-sdk/react@^3.0.234`

Expected: `package.json` gains `"@ai-sdk/react": "^3.0.234"` under `dependencies`. Confirm the installed major version:

Run: `npm ls @ai-sdk/react`
Expected: shows `@ai-sdk/react@3.x.x` (NOT `4.x.x`) with no unmet-peer errors.

- [ ] **Step 2: Confirm it resolves cleanly against the existing `ai` version**

Run: `npm ls ai`
Expected: a single resolved `ai` version in the `6.x` line (npm should dedupe rather than install two copies). If you see `ai@7.x` anywhere in the tree, Step 1 installed the wrong major — re-run `npm install @ai-sdk/react@3.0.234` (exact version) to force it.

Run: `npx tsc --noEmit`
Expected: clean, no new type errors.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add @ai-sdk/react for chat widget"
```

---

### Task 2: Deck-route matcher

**Files:**
- Create: `src/lib/utils/deck-route.ts`
- Test: `src/lib/utils/deck-route.test.ts`

**Interfaces:**
- Produces: `matchDeckRoute(pathname: string): string | null` — used by `ChatProvider` in Task 4.

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/utils/deck-route.test.ts
import { describe, it, expect } from "vitest";
import { matchDeckRoute } from "./deck-route";

describe("matchDeckRoute", () => {
  it("matches /decks/[id]", () => {
    expect(matchDeckRoute("/decks/abc-123")).toBe("abc-123");
  });

  it("matches nested deck routes like /decks/[id]/edit", () => {
    expect(matchDeckRoute("/decks/abc-123/edit")).toBe("abc-123");
  });

  it("matches /quiz/[deckId]", () => {
    expect(matchDeckRoute("/quiz/abc-123")).toBe("abc-123");
  });

  it("does not treat /quiz/quick as a deck id", () => {
    expect(matchDeckRoute("/quiz/quick")).toBeNull();
  });

  it("returns null for unrelated routes", () => {
    expect(matchDeckRoute("/dashboard")).toBeNull();
    expect(matchDeckRoute("/settings")).toBeNull();
    expect(matchDeckRoute("/kata")).toBeNull();
    expect(matchDeckRoute("/")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/utils/deck-route.test.ts`
Expected: FAIL — `./deck-route` module not found.

- [ ] **Step 3: Write the implementation**

```typescript
// src/lib/utils/deck-route.ts

/**
 * Returns the active deck id when `pathname` is a single-deck route
 * (/decks/[id] or /quiz/[deckId]), or null otherwise.
 * /quiz/quick is multi-deck and explicitly excluded.
 */
export function matchDeckRoute(pathname: string): string | null {
  const deckMatch = pathname.match(/^\/decks\/([^/]+)/);
  if (deckMatch) return deckMatch[1];

  const quizMatch = pathname.match(/^\/quiz\/([^/]+)/);
  if (quizMatch && quizMatch[1] !== "quick") return quizMatch[1];

  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/utils/deck-route.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/deck-route.ts src/lib/utils/deck-route.test.ts
git commit -m "feat(chat): add deck-route matcher for chat widget deck scoping"
```

---

### Task 3: `/api/chat` route

**Files:**
- Create: `src/app/api/chat/route.ts`
- Modify: `docs/superpowers/plans/2026-06-12-ai-rate-limiting.md`

**Interfaces:**
- Consumes: `getDeckById(deckId: string, userId: string): Promise<{ deck: Deck; cards: Card[]; deckStats: DeckStatsResult }>` from `src/lib/services/decks.ts` (existing — `Card` has `id`, `front`, `back`; `Deck` has `title`).
- Produces: `POST /api/chat` accepting `{ messages: UIMessage[]; deckId?: string; mentionedCardIds?: string[] }`, streaming a `toUIMessageStreamResponse()`.

No unit test for this file — consistent with the app's other streaming AI routes (`/api/quiz/explain`, `/api/generate-topic`), which are verified manually rather than unit tested.

- [ ] **Step 1: Write the route**

```typescript
// src/app/api/chat/route.ts
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDeckById } from "@/lib/services/decks";

const BASE_SYSTEM_PROMPT =
  "You are Quizly's study assistant. Help the user study, understand concepts, " +
  "and use the app. Be concise and direct. No markdown tables.";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as {
    messages: UIMessage[];
    deckId?: string;
    mentionedCardIds?: string[];
  };

  let systemPrompt = BASE_SYSTEM_PROMPT;

  if (body.deckId) {
    try {
      const { deck, cards } = await getDeckById(body.deckId, user.id);
      systemPrompt += `\n\nThe user is currently viewing the deck "${deck.title}".`;

      if (body.mentionedCardIds && body.mentionedCardIds.length > 0) {
        const mentioned = cards.filter((c) => body.mentionedCardIds!.includes(c.id));
        if (mentioned.length > 0) {
          const cardBlocks = mentioned
            .map((c) => `- Front: ${c.front}\n  Back: ${c.back}`)
            .join("\n");
          systemPrompt += `\n\nThe user is asking specifically about these flashcards:\n${cardBlocks}`;
        }
      }
    } catch {
      // Deck not found, or not owned by this user — fall back to general context.
    }
  }

  const result = streamText({
    model: gateway("openai/gpt-4o-mini"),
    providerOptions: {
      gateway: { models: ["anthropic/claude-haiku-4.5", "anthropic/claude-sonnet-4-6", "openai/gpt-4o"] },
    },
    system: systemPrompt,
    messages: await convertToModelMessages(body.messages),
  });

  return result.toUIMessageStreamResponse({
    onError: () => "Sorry, I couldn't process that — try again.",
  });
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Manual verification**

Start the dev server (`npm run dev`), sign in via the browser, open devtools → Application/Storage → Cookies, and copy the `sb-*-auth-token` cookie value(s) for `localhost:3000`. Then:

```bash
curl -N -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -H "Cookie: <paste your sb-*-auth-token cookie(s) here>" \
  -d '{"messages":[{"id":"1","role":"user","parts":[{"type":"text","text":"Say hello in exactly one word."}]}]}'
```

Expected: a stream of UI-message-protocol chunks (SSE-style lines) ending with a short assistant reply — not a 401 or 500.

Also confirm unauthenticated calls are rejected:

```bash
curl -i -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"id":"1","role":"user","parts":[{"type":"text","text":"hi"}]}]}'
```

Expected: `HTTP/1.1 401` with `{"error":"Unauthorized"}`.

- [ ] **Step 4: Note `/api/chat` as a rate-limiting follow-up**

In `docs/superpowers/plans/2026-06-12-ai-rate-limiting.md`, under the `### Non-goals` section at the end of the file, add a bullet:

```markdown
- `/api/chat` (deck chat assistant, added 2026-07-21) is not yet covered — add a `"chat"` entry to `RATE_LIMITS` and apply `enforceRateLimit` there when this plan is implemented.
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/chat/route.ts docs/superpowers/plans/2026-06-12-ai-rate-limiting.md
git commit -m "feat(chat): add POST /api/chat streaming route with deck + mention context"
```

---

### Task 4: `ChatProvider`

**Files:**
- Create: `src/components/chat-provider.tsx`

**Interfaces:**
- Consumes: `matchDeckRoute` (Task 2), `useChat`/`DefaultChatTransport` from `@ai-sdk/react`/`ai` (Task 1).
- Produces:
  - `export type MentionableCard = { id: string; front: string }`
  - `export function ChatProvider({ children }: { children: React.ReactNode })`
  - `export function useChatWidget()` returning `{ open: boolean; setOpen: (open: boolean) => void; deckId: string | null; deckTitle: string | null; availableCards: MentionableCard[]; messages; sendMessage; status }` — `messages`, `sendMessage`, `status` are the values returned by `useChat()`, spread through as-is (do not manually re-type them; let TypeScript infer from `useChat`'s return so Tasks 5–6 get the real, correct signatures).
  - Throws if called outside `ChatProvider`.

No unit test — this is React wiring around already-tested (Task 2) and third-party (`useChat`) logic, consistent with the spec's testing scope.

- [ ] **Step 1: Write the provider**

```tsx
// src/components/chat-provider.tsx
"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { matchDeckRoute } from "@/lib/utils/deck-route";

export type MentionableCard = { id: string; front: string };

function useChatController() {
  const pathname = usePathname();
  const deckId = useMemo(() => matchDeckRoute(pathname), [pathname]);

  const [open, setOpen] = useState(false);
  const [deckTitle, setDeckTitle] = useState<string | null>(null);
  const [availableCards, setAvailableCards] = useState<MentionableCard[]>([]);

  useEffect(() => {
    if (!deckId) {
      setDeckTitle(null);
      setAvailableCards([]);
      return;
    }

    let cancelled = false;

    fetch(`/api/decks/${deckId}`)
      .then((r) => r.json())
      .then((data: { deck?: { title?: string }; cards?: { id: string; front: string }[] }) => {
        if (cancelled) return;
        setDeckTitle(data.deck?.title ?? null);
        setAvailableCards((data.cards ?? []).map((c) => ({ id: c.id, front: c.front })));
      })
      .catch(() => {
        if (cancelled) return;
        setDeckTitle(null);
        setAvailableCards([]);
      });

    return () => {
      cancelled = true;
    };
  }, [deckId]);

  const chat = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });

  return { open, setOpen, deckId, deckTitle, availableCards, ...chat };
}

type ChatContextValue = ReturnType<typeof useChatController>;

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const value = useChatController();
  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChatWidget() {
  const ctx = useContext(ChatContext);
  if (!ctx) {
    throw new Error("useChatWidget must be used within ChatProvider");
  }
  return ctx;
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/chat-provider.tsx
git commit -m "feat(chat): add ChatProvider with deck-scoped mention data"
```

---

### Task 5: `MentionInput` component

**Files:**
- Create: `src/components/mention-input.tsx`

**Interfaces:**
- Consumes: `useChatWidget()` → `deckId`, `availableCards: MentionableCard[]`, `sendMessage`, `status` (Task 4).
- Produces: `export function MentionInput()` — self-contained composer with `@`-mention autocomplete, rendered inside `ChatWidget` (Task 6).

- [ ] **Step 1: Write the component**

```tsx
// src/components/mention-input.tsx
"use client";

import { useRef, useState } from "react";
import { useChatWidget, type MentionableCard } from "@/components/chat-provider";

const MENTION_PATTERN = /(?:^|\s)@(\w*)$/;

function MentionSuggestions({
  cards,
  onSelect,
}: {
  cards: MentionableCard[];
  onSelect: (card: MentionableCard) => void;
}) {
  if (cards.length === 0) {
    return (
      <div className="border-t border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
        No matching cards. Open a deck to reference its cards.
      </div>
    );
  }

  return (
    <div className="max-h-40 overflow-y-auto border-t border-border bg-card">
      {cards.map((card) => (
        <button
          key={card.id}
          type="button"
          onClick={() => onSelect(card)}
          className="block w-full truncate px-3 py-2 text-left text-sm text-foreground hover:bg-muted"
        >
          {card.front}
        </button>
      ))}
    </div>
  );
}

export function MentionInput() {
  const { deckId, availableCards, sendMessage, status } = useChatWidget();
  const [text, setText] = useState("");
  const [mentions, setMentions] = useState<MentionableCard[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const mentionMatch = text.match(MENTION_PATTERN);
  const query = mentionMatch?.[1]?.toLowerCase() ?? "";
  const filteredCards = mentionMatch
    ? availableCards.filter(
        (card) =>
          !mentions.some((m) => m.id === card.id) &&
          card.front.toLowerCase().includes(query)
      )
    : [];

  function selectMention(card: MentionableCard) {
    setText((current) => current.replace(MENTION_PATTERN, (match) => (match.startsWith(" ") ? " " : "")));
    setMentions((current) => [...current, card]);
    inputRef.current?.focus();
  }

  function removeMention(id: string) {
    setMentions((current) => current.filter((m) => m.id !== id));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;

    sendMessage(
      { text: trimmed },
      {
        body: {
          deckId: deckId ?? undefined,
          mentionedCardIds: mentions.map((m) => m.id),
        },
      }
    );
    setText("");
    setMentions([]);
  }

  return (
    <div className="border-t border-border">
      {mentions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-3 pt-2">
          {mentions.map((card) => (
            <span
              key={card.id}
              className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
            >
              {card.front.length > 24 ? `${card.front.slice(0, 24)}…` : card.front}
              <button type="button" onClick={() => removeMention(card.id)} aria-label="Remove reference">
                &times;
              </button>
            </span>
          ))}
        </div>
      )}

      {mentionMatch && <MentionSuggestions cards={filteredCards} onSelect={selectMention} />}

      <form onSubmit={handleSubmit} className="flex items-center gap-2 p-3">
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ask anything, or @ to reference a card…"
          disabled={status !== "ready"}
          className="h-8 flex-1 rounded-lg border border-border bg-background px-2.5 text-sm text-foreground outline-none focus-visible:border-ring"
        />
        <button
          type="submit"
          disabled={status !== "ready" || !text.trim()}
          className="h-8 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/mention-input.tsx
git commit -m "feat(chat): add mention-aware chat input with @ autocomplete"
```

---

### Task 6: `ChatWidget` component

**Files:**
- Create: `src/components/chat-widget.tsx`

**Interfaces:**
- Consumes: `useChatWidget()` → `open`, `setOpen`, `deckTitle`, `messages`, `status` (Task 4); `MentionInput` (Task 5).
- Produces: `export function ChatWidget()` — the floating bubble button + panel, meant to be rendered once inside `ChatProvider` (Task 7).

- [ ] **Step 1: Write the component**

```tsx
// src/components/chat-widget.tsx
"use client";

import { useEffect, useRef } from "react";
import { useChatWidget } from "@/components/chat-provider";
import { MentionInput } from "@/components/mention-input";

function BubbleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8-1.4 0-2.727-.278-3.906-.777L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
      />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

export function ChatWidget() {
  const { open, setOpen, deckTitle, messages, status } = useChatWidget();
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, setOpen]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="fixed bottom-5 right-5 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105"
        aria-label={open ? "Close chat" : "Open chat"}
      >
        {open ? <CloseIcon className="h-5 w-5" /> : <BubbleIcon className="h-5 w-5" />}
      </button>

      {open && (
        <div
          ref={panelRef}
          className="fixed bottom-20 right-5 z-50 flex h-[28rem] w-80 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xl sm:w-96"
        >
          <div className="border-b border-border px-4 py-3">
            <p className="font-heading text-sm font-semibold text-foreground">
              {deckTitle ? `Asking about: ${deckTitle}` : "Quizly Assistant"}
            </p>
          </div>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {messages.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Ask me anything, or type @ to reference a specific card.
              </p>
            )}
            {messages.map((message) => (
              <div key={message.id} className={message.role === "user" ? "text-right" : "text-left"}>
                <div
                  className={
                    message.role === "user"
                      ? "inline-block max-w-[85%] rounded-lg bg-primary px-3 py-2 text-left text-sm text-primary-foreground"
                      : "inline-block max-w-[85%] rounded-lg bg-muted px-3 py-2 text-left text-sm text-foreground"
                  }
                >
                  {message.parts.map((part, index) =>
                    part.type === "text" ? <span key={index}>{part.text}</span> : null
                  )}
                </div>
              </div>
            ))}
            {status === "submitted" && <p className="text-sm text-muted-foreground">Thinking…</p>}
          </div>

          <MentionInput />
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/chat-widget.tsx
git commit -m "feat(chat): add floating chat widget UI"
```

---

### Task 7: Wire into root layout + end-to-end verification

**Files:**
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Consumes: `ChatProvider`, `ChatWidget` (Tasks 4 & 6).

- [ ] **Step 1: Mount the provider and widget in the authenticated branch**

In `src/app/layout.tsx`, add the imports:

```typescript
import { ChatProvider } from "@/components/chat-provider";
import { ChatWidget } from "@/components/chat-widget";
```

Wrap the existing authenticated branch's content (the `<div className="flex h-full">...</div>` block) with `ChatProvider`, and render `<ChatWidget />` inside it:

```tsx
          {user ? (
            <ChatProvider>
              <div className="flex h-full">
                <AppSidebar user={user} />
                <div className="flex min-h-0 flex-1 flex-col">
                  <TopBar user={user} />
                  <main className="flex-1 overflow-y-auto">{children}</main>
                </div>
              </div>
              <ChatWidget />
            </ChatProvider>
          ) : (
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: all tests pass, including the new `deck-route.test.ts`.

- [ ] **Step 4: Manual end-to-end verification**

Start the dev server (`npm run dev`) and sign in.

1. From the dashboard (no deck open), click the bottom-right bubble. Header should read "Quizly Assistant". Ask a general question (e.g. "What is spaced repetition?") and confirm a streamed reply appears.
2. Navigate to any deck at `/decks/[id]`. Confirm the widget stays open with prior messages intact, and the header now reads "Asking about: `<deck title>`".
3. In the input, type `@` followed by a few letters from one of that deck's card fronts. Confirm the autocomplete list appears filtered to matching cards.
4. Select a card. Confirm a chip appears above the input showing the card's front text, and it's removable via its `×` button.
5. Send a follow-up like "explain this card in simpler terms" with the chip attached. Confirm the assistant's reply is clearly grounded in that specific card's content (not a generic answer).
6. Send a second follow-up with no new mention. Confirm the assistant still has the earlier card's content in context (conversation history carries it).
7. Navigate to a non-deck page (e.g. `/settings`). Confirm the bubble is present, the header reverts to "Quizly Assistant", and typing `@` shows "No matching cards. Open a deck to reference its cards."
8. Refresh the browser tab entirely. Confirm the conversation is cleared (in-memory only, as designed).

- [ ] **Step 5: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat(chat): mount chat widget in root layout"
```
