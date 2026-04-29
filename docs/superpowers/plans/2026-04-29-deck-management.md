# Deck Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add inline card editing, card/deck deletion, card creation, and deck rename to the existing deck detail page.

**Architecture:** Four new/modified API routes handle mutations (PATCH/DELETE deck, PATCH/DELETE card, POST card). A new `CardList` component renders below the study controls on the deck detail page, managing its own expansion state while lifting mutations up via callbacks to the parent which owns `allCards` state.

**Tech Stack:** Next.js 16 App Router, Supabase (server client + service role), TypeScript, Tailwind v4

---

## File Map

| File | Change |
|---|---|
| `src/app/api/decks/[id]/route.ts` | Add `PATCH` (rename deck) + `DELETE` (delete deck) |
| `src/app/api/cards/[id]/route.ts` | Create — `PATCH` (edit card) + `DELETE` (delete card) |
| `src/app/api/decks/[id]/cards/route.ts` | Create — `POST` (add card to deck) |
| `src/components/card-list.tsx` | Create — CardList component with inline expansion |
| `src/app/decks/[id]/page.tsx` | Integrate CardList + deck rename/delete UI |

---

### Task 1: PATCH + DELETE on `/api/decks/[id]`

**Files:**
- Modify: `src/app/api/decks/[id]/route.ts`

The existing file only has `GET`. Add `PATCH` to rename a deck and `DELETE` to delete it. Deleting a deck cascades to cards and sessions automatically via FK.

- [ ] **Step 1: Read the existing route file**

Open `src/app/api/decks/[id]/route.ts`. It currently exports only `GET`. You will add two more exports.

- [ ] **Step 2: Add PATCH and DELETE handlers**

Replace the full contents of `src/app/api/decks/[id]/route.ts` with:

```typescript
import { createClient } from "@/lib/supabase/server";
import { getDeckById } from "@/lib/services/decks";
import { NextRequest } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { deck, cards } = await getDeckById(id, user.id);
    return Response.json({ deck, cards });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const status = (err as Error & { status?: number }).status ?? 500;
    return Response.json({ error: message }, { status });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const title = typeof body.title === "string" ? body.title.trim() : null;
  if (!title) return Response.json({ error: "title is required" }, { status: 400 });

  const { error } = await supabase
    .from("decks")
    .update({ title })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  // Verify ownership before deleting
  const { data: deck, error: fetchError } = await supabase
    .from("decks")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !deck) {
    return Response.json({ error: "Deck not found" }, { status: 404 });
  }

  const { error } = await supabase.from("decks").delete().eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
```

- [ ] **Step 3: Type-check**

```bash
cd /Users/chelseygowac/ai-quiz-app && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/decks/[id]/route.ts
git commit -m "feat(deck-mgmt): add PATCH rename + DELETE deck API routes"
```

---

### Task 2: PATCH + DELETE on `/api/cards/[id]`

**Files:**
- Create: `src/app/api/cards/[id]/route.ts`

Auth-check that the card's deck belongs to the current user before mutating. For DELETE, also decrement `decks.card_count` by 1 (the DB won't do this automatically since `card_count` is a denormalized column).

- [ ] **Step 1: Create the directory and file**

Create `src/app/api/cards/[id]/route.ts` with:

```typescript
import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";

async function getCardAndVerifyOwner(cardId: string, userId: string) {
  const supabase = await createClient();
  const { data: card, error } = await supabase
    .from("cards")
    .select("id, deck_id, decks!inner(user_id)")
    .eq("id", cardId)
    .single();

  if (error || !card) return { card: null, supabase };

  const deckUserId = (card.decks as unknown as { user_id: string | null }).user_id;
  if (deckUserId !== userId) return { card: null, supabase };

  return { card, supabase };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { card } = await getCardAndVerifyOwner(id, user.id);
  if (!card) return Response.json({ error: "Card not found" }, { status: 404 });

  const body = await req.json();
  const front = typeof body.front === "string" ? body.front.trim() : null;
  const back = typeof body.back === "string" ? body.back.trim() : null;

  if (!front || !back) {
    return Response.json({ error: "front and back are required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("cards")
    .update({ front, back })
    .eq("id", id);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { card } = await getCardAndVerifyOwner(id, user.id);
  if (!card) return Response.json({ error: "Card not found" }, { status: 404 });

  const deckId = card.deck_id;

  const { error: deleteError } = await supabase.from("cards").delete().eq("id", id);
  if (deleteError) return Response.json({ error: deleteError.message }, { status: 500 });

  // Decrement denormalized card_count
  await supabase.rpc("decrement_card_count", { deck_id_param: deckId }).maybeSingle();
  // If RPC doesn't exist, fall back to raw update (subtract 1, floor at 0)
  // We'll handle this with a direct select+update approach instead of RPC:
  const { data: deck } = await supabase
    .from("decks")
    .select("card_count")
    .eq("id", deckId)
    .single();
  if (deck) {
    await supabase
      .from("decks")
      .update({ card_count: Math.max(0, deck.card_count - 1) })
      .eq("id", deckId);
  }

  return Response.json({ ok: true });
}
```

Wait — the RPC call above will fail if the function doesn't exist. Replace the DELETE handler with just the select+update approach (no RPC):

```typescript
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { card } = await getCardAndVerifyOwner(id, user.id);
  if (!card) return Response.json({ error: "Card not found" }, { status: 404 });

  const deckId = card.deck_id;

  const { error: deleteError } = await supabase.from("cards").delete().eq("id", id);
  if (deleteError) return Response.json({ error: deleteError.message }, { status: 500 });

  // Decrement denormalized card_count (floor at 0)
  const { data: deck } = await supabase
    .from("decks")
    .select("card_count")
    .eq("id", deckId)
    .single();

  if (deck) {
    await supabase
      .from("decks")
      .update({ card_count: Math.max(0, deck.card_count - 1) })
      .eq("id", deckId);
  }

  return Response.json({ ok: true });
}
```

Use the complete file below (combining both handlers, no RPC):

```typescript
import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";

async function getCardAndVerifyOwner(cardId: string, userId: string) {
  const supabase = await createClient();
  const { data: card, error } = await supabase
    .from("cards")
    .select("id, deck_id, decks!inner(user_id)")
    .eq("id", cardId)
    .single();

  if (error || !card) return { card: null, supabase };

  const deckUserId = (card.decks as unknown as { user_id: string | null }).user_id;
  if (deckUserId !== userId) return { card: null, supabase };

  return { card, supabase };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { card } = await getCardAndVerifyOwner(id, user.id);
  if (!card) return Response.json({ error: "Card not found" }, { status: 404 });

  const body = await req.json();
  const front = typeof body.front === "string" ? body.front.trim() : null;
  const back = typeof body.back === "string" ? body.back.trim() : null;

  if (!front || !back) {
    return Response.json({ error: "front and back are required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("cards")
    .update({ front, back })
    .eq("id", id);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { card } = await getCardAndVerifyOwner(id, user.id);
  if (!card) return Response.json({ error: "Card not found" }, { status: 404 });

  const deckId = card.deck_id;

  const { error: deleteError } = await supabase.from("cards").delete().eq("id", id);
  if (deleteError) return Response.json({ error: deleteError.message }, { status: 500 });

  const { data: deck } = await supabase
    .from("decks")
    .select("card_count")
    .eq("id", deckId)
    .single();

  if (deck) {
    await supabase
      .from("decks")
      .update({ card_count: Math.max(0, deck.card_count - 1) })
      .eq("id", deckId);
  }

  return Response.json({ ok: true });
}
```

- [ ] **Step 2: Type-check**

```bash
cd /Users/chelseygowac/ai-quiz-app && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/cards/[id]/route.ts
git commit -m "feat(deck-mgmt): add PATCH edit + DELETE card API routes"
```

---

### Task 3: POST `/api/decks/[id]/cards`

**Files:**
- Create: `src/app/api/decks/[id]/cards/route.ts`

Adds a new card to the deck. Verifies ownership, inserts card, increments `decks.card_count`.

- [ ] **Step 1: Create the file**

Create `src/app/api/decks/[id]/cards/route.ts`:

```typescript
import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: deckId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  // Verify deck ownership
  const { data: deck, error: deckError } = await supabase
    .from("decks")
    .select("id, card_count")
    .eq("id", deckId)
    .eq("user_id", user.id)
    .single();

  if (deckError || !deck) {
    return Response.json({ error: "Deck not found" }, { status: 404 });
  }

  const body = await req.json();
  const front = typeof body.front === "string" ? body.front.trim() : null;
  const back = typeof body.back === "string" ? body.back.trim() : null;

  if (!front || !back) {
    return Response.json({ error: "front and back are required" }, { status: 400 });
  }

  const { data: card, error: insertError } = await supabase
    .from("cards")
    .insert({ deck_id: deckId, front, back, card_type: "basic" })
    .select()
    .single();

  if (insertError || !card) {
    return Response.json({ error: insertError?.message ?? "Insert failed" }, { status: 500 });
  }

  await supabase
    .from("decks")
    .update({ card_count: deck.card_count + 1 })
    .eq("id", deckId);

  return Response.json(card, { status: 201 });
}
```

- [ ] **Step 2: Type-check**

```bash
cd /Users/chelseygowac/ai-quiz-app && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/decks/[id]/cards/route.ts
git commit -m "feat(deck-mgmt): add POST add-card API route"
```

---

### Task 4: CardList component

**Files:**
- Create: `src/components/card-list.tsx`

Renders a list of cards with inline expand-to-edit. Manages its own `expandedId` and `addingNew` state. Calls parent callbacks for actual mutations.

- [ ] **Step 1: Create `src/components/card-list.tsx`**

```typescript
"use client";

import { useState } from "react";
import type { Database } from "@/lib/database.types";

type Card = Database["public"]["Tables"]["cards"]["Row"];

interface CardListProps {
  cards: Card[];
  onCardUpdate: (cardId: string, front: string, back: string) => Promise<void>;
  onCardDelete: (cardId: string) => Promise<void>;
  onCardAdd: (front: string, back: string) => Promise<void>;
}

function AccuracyBadge({ card }: { card: Card }) {
  if (card.times_seen === 0) return null;
  const pct = Math.round((card.times_correct / card.times_seen) * 100);
  return (
    <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
      {pct}%
    </span>
  );
}

function CardRow({
  card,
  isExpanded,
  onExpand,
  onSave,
  onDelete,
}: {
  card: Card;
  isExpanded: boolean;
  onExpand: () => void;
  onSave: (front: string, back: string) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [front, setFront] = useState(card.front);
  const [back, setBack] = useState(card.back);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const dirty = front.trim() !== card.front || back.trim() !== card.back;

  async function handleSave() {
    if (!front.trim() || !back.trim()) return;
    setSaving(true);
    setErr(null);
    try {
      await onSave(front.trim(), back.trim());
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await onDelete();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Delete failed");
      setDeleting(false);
    }
  }

  if (!isExpanded) {
    return (
      <button
        onClick={onExpand}
        className="w-full flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-card px-4 py-3 text-left transition-colors hover:border-primary/30 hover:bg-muted/30"
      >
        <span className="min-w-0 flex-1 truncate text-sm text-foreground">
          {card.front}
        </span>
        <AccuracyBadge card={card} />
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-primary/30 bg-card px-4 py-4 space-y-3">
      {err && (
        <p className="text-xs text-destructive">{err}</p>
      )}
      <div className="space-y-1.5">
        <label className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/55">
          Front
        </label>
        <textarea
          value={front}
          onChange={(e) => setFront(e.target.value)}
          rows={2}
          className="w-full resize-none rounded-lg border border-input/70 bg-background/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-ring/70"
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/55">
          Back
        </label>
        <textarea
          value={back}
          onChange={(e) => setBack(e.target.value)}
          rows={2}
          className="w-full resize-none rounded-lg border border-input/70 bg-background/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-ring/70"
        />
      </div>
      <div className="flex items-center justify-between">
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="text-xs text-destructive/70 transition-colors hover:text-destructive disabled:opacity-50"
        >
          {deleting ? "Deleting…" : "Delete card"}
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={onExpand}
            className="rounded-lg border border-border/60 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted/40"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!dirty || saving || !front.trim() || !back.trim()}
            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function NewCardForm({
  onSave,
  onCancel,
}: {
  onSave: (front: string, back: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleSave() {
    if (!front.trim() || !back.trim()) return;
    setSaving(true);
    setErr(null);
    try {
      await onSave(front.trim(), back.trim());
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-primary/30 bg-card px-4 py-4 space-y-3">
      {err && <p className="text-xs text-destructive">{err}</p>}
      <div className="space-y-1.5">
        <label className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/55">
          Front
        </label>
        <textarea
          autoFocus
          value={front}
          onChange={(e) => setFront(e.target.value)}
          rows={2}
          placeholder="Question or term…"
          className="w-full resize-none rounded-lg border border-input/70 bg-background/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-ring/70"
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/55">
          Back
        </label>
        <textarea
          value={back}
          onChange={(e) => setBack(e.target.value)}
          rows={2}
          placeholder="Answer or definition…"
          className="w-full resize-none rounded-lg border border-input/70 bg-background/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-ring/70"
        />
      </div>
      <div className="flex items-center justify-end gap-2">
        <button
          onClick={onCancel}
          className="rounded-lg border border-border/60 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted/40"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !front.trim() || !back.trim()}
          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity disabled:opacity-40"
        >
          {saving ? "Saving…" : "Add card"}
        </button>
      </div>
    </div>
  );
}

export function CardList({
  cards,
  onCardUpdate,
  onCardDelete,
  onCardAdd,
}: CardListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [addingNew, setAddingNew] = useState(false);

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  return (
    <div className="mt-10">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-heading text-sm font-semibold text-foreground">
          Cards{" "}
          <span className="font-normal text-muted-foreground/55">({cards.length})</span>
        </h2>
      </div>

      <div className="space-y-2">
        {cards.map((card) => (
          <CardRow
            key={card.id}
            card={card}
            isExpanded={expandedId === card.id}
            onExpand={() => toggleExpand(card.id)}
            onSave={async (front, back) => {
              await onCardUpdate(card.id, front, back);
              setExpandedId(null);
            }}
            onDelete={async () => {
              await onCardDelete(card.id);
            }}
          />
        ))}

        {addingNew && (
          <NewCardForm
            onSave={async (front, back) => {
              await onCardAdd(front, back);
              setAddingNew(false);
            }}
            onCancel={() => setAddingNew(false)}
          />
        )}
      </div>

      {!addingNew && (
        <button
          onClick={() => {
            setExpandedId(null);
            setAddingNew(true);
          }}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border/50 py-3 text-xs text-muted-foreground/60 transition-colors hover:border-primary/30 hover:text-primary"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add card
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd /Users/chelseygowac/ai-quiz-app && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/card-list.tsx
git commit -m "feat(deck-mgmt): add CardList component with inline edit/add"
```

---

### Task 5: Integrate CardList + deck rename/delete into deck detail page

**Files:**
- Modify: `src/app/decks/[id]/page.tsx`

Add three things to the idle state view:
1. Inline deck rename (pencil icon → input → save)
2. Delete deck button with confirmation dialog
3. `<CardList>` below the study controls

The page already has `allCards` state. Add callbacks that call the new API routes and update `allCards` + `deck` optimistically.

- [ ] **Step 1: Add imports and new state to `DeckPage`**

At the top of `src/app/decks/[id]/page.tsx`, add `CardList` to the imports:

```typescript
import { CardList } from "@/components/card-list";
```

Inside `DeckPage`, after the existing state declarations, add:

```typescript
const [editingTitle, setEditingTitle] = useState(false);
const [titleDraft, setTitleDraft] = useState("");
const [titleSaving, setTitleSaving] = useState(false);
const [showDeleteDeckDialog, setShowDeleteDeckDialog] = useState(false);
const [deletingDeck, setDeletingDeck] = useState(false);
```

- [ ] **Step 2: Add mutation callbacks**

Inside `DeckPage`, after the state declarations, add these four async functions (before the `useEffect` hooks):

```typescript
async function handleRenameTitle() {
  if (!deck || !titleDraft.trim() || titleDraft.trim() === deck.title) {
    setEditingTitle(false);
    return;
  }
  setTitleSaving(true);
  const res = await fetch(`/api/decks/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: titleDraft.trim() }),
  });
  if (res.ok) {
    setDeck((d) => d ? { ...d, title: titleDraft.trim() } : d);
  }
  setTitleSaving(false);
  setEditingTitle(false);
}

async function handleDeleteDeck() {
  setDeletingDeck(true);
  const res = await fetch(`/api/decks/${id}`, { method: "DELETE" });
  if (res.ok) {
    router.push("/");
  } else {
    setDeletingDeck(false);
    setShowDeleteDeckDialog(false);
  }
}

async function handleCardUpdate(cardId: string, front: string, back: string) {
  const res = await fetch(`/api/cards/${cardId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ front, back }),
  });
  if (!res.ok) {
    const { error } = await res.json();
    throw new Error(error ?? "Update failed");
  }
  setAllCards((prev) =>
    prev.map((c) => (c.id === cardId ? { ...c, front, back } : c))
  );
}

async function handleCardDelete(cardId: string) {
  const res = await fetch(`/api/cards/${cardId}`, { method: "DELETE" });
  if (!res.ok) {
    const { error } = await res.json();
    throw new Error(error ?? "Delete failed");
  }
  setAllCards((prev) => prev.filter((c) => c.id !== cardId));
  setDeck((d) => d ? { ...d, card_count: Math.max(0, d.card_count - 1) } : d);
}

async function handleCardAdd(front: string, back: string) {
  const res = await fetch(`/api/decks/${id}/cards`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ front, back }),
  });
  if (!res.ok) {
    const { error } = await res.json();
    throw new Error(error ?? "Add failed");
  }
  const newCard = await res.json();
  setAllCards((prev) => [...prev, newCard]);
  setDeck((d) => d ? { ...d, card_count: d.card_count + 1 } : d);
}
```

- [ ] **Step 3: Update the idle state view**

In the idle state JSX (the `if (studyState === "idle")` block), replace the deck header section:

**Find this:**
```tsx
        <div className="mb-8">
          <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">
            {deck.title}
          </h1>
          {deck.topic_tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {deck.topic_tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-border/50 bg-muted/30 px-2 py-0.5 text-[10px] text-muted-foreground/70"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
          <p className="mt-3 text-sm text-muted-foreground/60">
            {deck.card_count} {deck.card_count === 1 ? "card" : "cards"}
          </p>
        </div>
```

**Replace with:**
```tsx
        <div className="mb-8">
          <div className="flex items-start justify-between gap-3">
            {editingTitle ? (
              <div className="flex flex-1 items-center gap-2">
                <input
                  autoFocus
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRenameTitle();
                    if (e.key === "Escape") setEditingTitle(false);
                  }}
                  className="flex-1 rounded-xl border border-input/70 bg-background/50 px-3 py-1.5 font-heading text-2xl font-bold tracking-tight text-foreground focus:outline-none focus:ring-2 focus:ring-ring/70"
                />
                <button
                  onClick={handleRenameTitle}
                  disabled={titleSaving}
                  className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
                >
                  {titleSaving ? "Saving…" : "Save"}
                </button>
                <button
                  onClick={() => setEditingTitle(false)}
                  className="rounded-lg border border-border/60 px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted/40"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex flex-1 items-center gap-2 group">
                <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">
                  {deck.title}
                </h1>
                <button
                  onClick={() => { setTitleDraft(deck.title); setEditingTitle(true); }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity rounded-md p-1 text-muted-foreground/50 hover:text-foreground"
                  aria-label="Rename deck"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                  </svg>
                </button>
              </div>
            )}
            <button
              onClick={() => setShowDeleteDeckDialog(true)}
              className="mt-1 shrink-0 text-xs text-muted-foreground/40 transition-colors hover:text-destructive"
            >
              Delete deck
            </button>
          </div>
          {deck.topic_tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {deck.topic_tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-border/50 bg-muted/30 px-2 py-0.5 text-[10px] text-muted-foreground/70"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
          <p className="mt-3 text-sm text-muted-foreground/60">
            {deck.card_count} {deck.card_count === 1 ? "card" : "cards"}
          </p>
        </div>
```

- [ ] **Step 4: Add CardList and delete dialog to idle state**

At the end of the idle state return, just before the closing `</div>` of the outer wrapper (after `{modeModal}`), add:

```tsx
        {/* Delete deck confirmation */}
        <Dialog open={showDeleteDeckDialog} onOpenChange={setShowDeleteDeckDialog}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="font-heading text-base font-semibold">
                Delete this deck?
              </DialogTitle>
            </DialogHeader>
            <p className="mt-1 text-sm text-muted-foreground/70">
              This will permanently delete <strong className="text-foreground">{deck.title}</strong> and all {deck.card_count} {deck.card_count === 1 ? "card" : "cards"}. This cannot be undone.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowDeleteDeckDialog(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={deletingDeck}
                onClick={handleDeleteDeck}
                className="border-destructive/40 text-destructive hover:bg-destructive/5"
              >
                {deletingDeck ? "Deleting…" : "Delete deck"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Card management */}
        <CardList
          cards={allCards}
          onCardUpdate={handleCardUpdate}
          onCardDelete={handleCardDelete}
          onCardAdd={handleCardAdd}
        />
```

- [ ] **Step 5: Type-check**

```bash
cd /Users/chelseygowac/ai-quiz-app && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Start dev server and verify in browser**

```bash
cd /Users/chelseygowac/ai-quiz-app && npm run dev
```

Navigate to a deck at `http://localhost:3001/decks/<id>`.

Verify:
1. Card list appears below study controls
2. Clicking a card expands the edit form
3. Editing and saving updates the card text
4. Deleting a card removes it from the list
5. "+ Add card" form works
6. Hovering the title reveals the pencil icon; clicking allows renaming
7. "Delete deck" opens a confirmation dialog; confirming navigates to `/`

- [ ] **Step 7: Commit**

```bash
git add src/app/decks/[id]/page.tsx
git commit -m "feat(deck-mgmt): integrate CardList + rename/delete deck into deck detail page"
```
