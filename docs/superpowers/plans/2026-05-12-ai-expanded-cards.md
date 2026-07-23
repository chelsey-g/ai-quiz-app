# AI-Expanded Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an "Expand with AI" button to the deck page that generates 5–8 additional gap-filling flashcards and appends them to the deck with a brief highlight animation.

**Architecture:** A new `POST /api/decks/[id]/expand` route reads the deck's title, topic tags, and existing card fronts, calls `generateObject` with a gap-filling prompt, inserts the new cards, updates `card_count`, and fires off distractor generation. The deck page calls this route, appends the returned cards to local state, and highlights new cards with a 2-second ring animation.

**Tech Stack:** Next.js App Router API route, Vercel AI Gateway (`generateObject`), Zod schema, Supabase server client, `generateAndSaveDistractorsForDeck` service, React state.

---

## Files

| Action | File |
|--------|------|
| Create | `src/app/api/decks/[id]/expand/route.ts` |
| Modify | `src/app/decks/[id]/page.tsx` |

---

### Task 1: Create the expand API route

**Files:**
- Create: `src/app/api/decks/[id]/expand/route.ts`

- [ ] **Step 1: Create the route file**

```typescript
// src/app/api/decks/[id]/expand/route.ts
import { createClient } from "@/lib/supabase/server";
import { generateObject } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { z } from "zod";
import { NextRequest } from "next/server";
import { generateAndSaveDistractorsForDeck } from "@/lib/services/distractors";

const ExpandSchema = z.object({
  cards: z
    .array(
      z.object({
        front: z.string().describe("Question or term — one sentence max"),
        back: z.string().describe("Concise but complete answer or definition"),
      })
    )
    .min(5)
    .max(8),
});

const EXPAND_SYSTEM_PROMPT =
  "You are a study content generator. Given a deck title, its topic tags, and a list of questions it already covers, " +
  "generate additional flashcards that fill gaps — covering related concepts, common gotchas, edge cases, and deeper details not already addressed. " +
  "Every card must be self-contained.";

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

  const { data: deck, error: deckError } = await supabase
    .from("decks")
    .select("id, title, topic_tags, user_id, card_count")
    .eq("id", id)
    .single();

  if (deckError || !deck) return Response.json({ error: "Deck not found" }, { status: 404 });
  if (deck.user_id !== user.id) return Response.json({ error: "Forbidden" }, { status: 403 });

  const { data: existingCards } = await supabase
    .from("cards")
    .select("front")
    .eq("deck_id", id);

  const existingFronts = (existingCards ?? []).map((c) => c.front);
  const tags = (deck.topic_tags as string[] | null) ?? [];

  const userPrompt =
    `Deck: ${deck.title}\n` +
    `Topics: ${tags.join(", ")}\n\n` +
    `Already covered (do not duplicate):\n` +
    existingFronts.map((f) => `- ${f}`).join("\n") +
    `\n\nGenerate 5–8 new cards.`;

  let generated: z.infer<typeof ExpandSchema>;
  try {
    const { object } = await generateObject({
      model: gateway("openai/gpt-4o-mini"),
      providerOptions: {
        gateway: { models: ["anthropic/claude-haiku-4.5", "anthropic/claude-sonnet-4-6"] },
      },
      schema: ExpandSchema,
      system: EXPAND_SYSTEM_PROMPT,
      prompt: userPrompt,
    });
    generated = object;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "AI generation failed";
    return Response.json({ error: msg }, { status: 500 });
  }

  const inserts = generated.cards.map((c) => ({
    deck_id: id,
    front: c.front,
    back: c.back,
    card_type: "flashcard",
  }));

  const { data: newCards, error: insertError } = await supabase
    .from("cards")
    .insert(inserts)
    .select();

  if (insertError || !newCards) {
    return Response.json({ error: insertError?.message ?? "Insert failed" }, { status: 500 });
  }

  await supabase
    .from("decks")
    .update({ card_count: deck.card_count + newCards.length })
    .eq("id", id);

  generateAndSaveDistractorsForDeck(id, deck.title).catch(() => {});

  return Response.json({ cards: newCards, addedCount: newCards.length });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/chelseygowac/ai-quiz-app && npx tsc --noEmit 2>&1 | head -30`
Expected: no errors (or only pre-existing errors unrelated to this new file)

- [ ] **Step 3: Commit**

```bash
git add src/app/api/decks/[id]/expand/route.ts
git commit -m "feat(expand): add POST /api/decks/[id]/expand route"
```

---

### Task 2: Add expand state and handler to deck page

**Files:**
- Modify: `src/app/decks/[id]/page.tsx` (state vars around line 354, handler around line 640, CardRowProps around line 94)

- [ ] **Step 1: Add `isNew` to CardRowProps interface**

Find the `CardRowProps` interface (around line 94). Add `isNew?: boolean` after the existing props:

```typescript
interface CardRowProps {
  card: Card;
  isEditing: boolean;
  isDeleting: boolean;
  isSaving: boolean;
  isDeletingInProgress: boolean;
  isNew?: boolean;   // ← add this line
  editFront: string;
  // ... rest unchanged
```

- [ ] **Step 2: Destructure `isNew` in CardRow and apply highlight**

Find the `CardRow` function signature (around line 114) and add `isNew = false` to the destructured props:

```typescript
function CardRow({
  card,
  isEditing,
  isDeleting,
  isSaving,
  isDeletingInProgress,
  isNew = false,   // ← add this line
  editFront,
  // ... rest unchanged
}: CardRowProps) {
```

Then find the normal-state card div (around line 195 — the one with `className="group rounded-xl border bg-card..."`) and update its `style` to include the ring:

```typescript
      style={{
        borderColor:
          "color-mix(in oklch, var(--dashboard-accent-teal) 30%, transparent)",
        boxShadow: isNew
          ? "0 0 0 2px color-mix(in oklch, var(--dashboard-accent-teal) 65%, transparent)"
          : "none",
        transition: "box-shadow 0.8s ease-out",
      }}
```

- [ ] **Step 3: Add state variables for expanding**

Find the state variable block (around line 354 — after `showStudyEdit`). Add three new state vars after the existing ones:

```typescript
  const [expanding, setExpanding] = useState(false);
  const [newCardIds, setNewCardIds] = useState<Set<string>>(new Set());
  const [expandError, setExpandError] = useState<string | null>(null);
```

- [ ] **Step 4: Add the `handleExpand` function**

Find `handleAddCard` (around line 611). Add `handleExpand` immediately after it (before `handleSaveEdit`):

```typescript
  async function handleExpand() {
    if (!deck) return;
    setExpanding(true);
    setExpandError(null);
    try {
      const res = await fetch(`/api/decks/${deck.id}/expand`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setExpandError(data.error ?? "Expansion failed");
        return;
      }
      const newCards: Card[] = data.cards;
      setAllCards((prev) => [...prev, ...newCards]);
      setDeck((prev) =>
        prev ? { ...prev, card_count: prev.card_count + newCards.length } : prev
      );
      const ids = new Set<string>(newCards.map((c) => c.id));
      setNewCardIds(ids);
      setTimeout(() => setNewCardIds(new Set()), 2000);
    } catch {
      setExpandError("Expansion failed. Please try again.");
    } finally {
      setExpanding(false);
    }
  }
```

- [ ] **Step 5: Update the "Add card" section to show both buttons in a row**

Find the `{/* Add card section */}` block (around line 1112). Replace the current `{!showAddCard ? (` branch so it wraps both buttons in a flex row:

Current:
```tsx
        {/* Add card section */}
        <div className="mt-8">
          {!showAddCard ? (
            <button
              onClick={() => { setShowAddCard(true); setAddCardError(null); }}
              className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-medium transition-colors hover:bg-[oklch(0.77_0.195_68_/_0.08)]"
              style={{
                border:
                  "1px solid color-mix(in oklch, var(--dashboard-accent-amber) 45%, transparent)",
                color:
                  "color-mix(in oklch, var(--dashboard-accent-amber) 75%, var(--foreground) 25%)",
              }}
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add card
            </button>
```

Replace with:
```tsx
        {/* Add card section */}
        <div className="mt-8">
          {!showAddCard ? (
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => { setShowAddCard(true); setAddCardError(null); }}
                disabled={expanding}
                className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-medium transition-colors hover:bg-[oklch(0.77_0.195_68_/_0.08)] disabled:opacity-40"
                style={{
                  border:
                    "1px solid color-mix(in oklch, var(--dashboard-accent-amber) 45%, transparent)",
                  color:
                    "color-mix(in oklch, var(--dashboard-accent-amber) 75%, var(--foreground) 25%)",
                }}
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Add card
              </button>
              <button
                onClick={handleExpand}
                disabled={expanding}
                className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-medium transition-colors hover:bg-[oklch(0.7_0.19_173_/_0.08)] disabled:opacity-40"
                style={{
                  border: "1px solid color-mix(in oklch, var(--dashboard-accent-teal) 45%, transparent)",
                  color: "color-mix(in oklch, var(--dashboard-accent-teal) 75%, var(--foreground) 25%)",
                }}
              >
                {expanding ? (
                  <>
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Generating cards…
                  </>
                ) : (
                  <>
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                    </svg>
                    Expand with AI
                  </>
                )}
              </button>
              {expandError && (
                <p className="w-full text-xs text-destructive">{expandError}</p>
              )}
            </div>
```

- [ ] **Step 6: Pass `isNew` to SortableCardRow**

Find the `SortableCardRow` call in the cards list (around line 1279). Add the `isNew` prop:

```tsx
                      <SortableCardRow
                        key={card.id}
                        card={card}
                        isEditing={editingCardId === card.id}
                        isDeleting={deletingCardId === card.id}
                        isSaving={savingEdit && editingCardId === card.id}
                        isDeletingInProgress={deletingInProgress === card.id}
                        isNew={newCardIds.has(card.id)}
                        editFront={editFront}
                        editBack={editBack}
                        onEditFrontChange={setEditFront}
                        onEditBackChange={setEditBack}
                        onEditStart={startEditCard}
                        onEditSave={handleSaveEdit}
                        onEditCancel={cancelEdit}
                        onDeleteStart={(cardId) => { setDeletingCardId(cardId); setEditingCardId(null); }}
                        onDeleteConfirm={handleConfirmDelete}
                        onDeleteCancel={() => setDeletingCardId(null)}
                      />
```

- [ ] **Step 7: Verify TypeScript compiles**

Run: `cd /Users/chelseygowac/ai-quiz-app && npx tsc --noEmit 2>&1 | head -30`
Expected: no errors (or only pre-existing errors unrelated to these changes)

- [ ] **Step 8: Commit**

```bash
git add "src/app/decks/[id]/page.tsx"
git commit -m "feat(expand): add Expand with AI button and card highlight to deck page"
```
