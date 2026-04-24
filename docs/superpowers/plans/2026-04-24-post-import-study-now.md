---
assigned-to: both
status: ready
context: "The deck ID is already selected from the Supabase insert (newDeck.id) — it just needs to be added to the result payload and rendered. Keep the existing card layout intact."
---

# Post-Import "Study Now" Action Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Study deck" link to each successful import result card so users can navigate directly to their new deck without returning to the dashboard.

**Architecture:** Two surgical changes — the API route returns `deckId` in each successful result, and the import UI renders a "Study deck" link using that ID. No new files, no new routes, no new components.

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind v4, `next/link`

---

## File Map

| File | Change |
|---|---|
| `src/app/api/import/route.ts` | Add `deckId?: string` to inline result type; add `deckId: newDeck.id` to success result push |
| `src/app/import/page.tsx` | Add `deckId?: string` to `ImportResult` interface; import `Link`; render "Study deck" link on ok results |

---

### Task 1: Expose deck ID in the import API response

**Assigned to:** Engineer

**Files:**
- Modify: `src/app/api/import/route.ts`

- [ ] **Step 1: Add `deckId` to the inline result type**

Open `src/app/api/import/route.ts`. Find the `results` array declaration (lines 38–46). Add `deckId?: string` to the type:

```ts
const results: Array<{
  file: string;
  status: "ok" | "error";
  title?: string;
  deckId?: string;
  cardCount?: number;
  provider?: string;
  model?: string;
  error?: string;
}> = [];
```

- [ ] **Step 2: Add `deckId` to the success result push**

Find the `results.push(...)` call for successful imports (lines 97–104). Add `deckId: newDeck.id`:

```ts
results.push({
  file: file.name,
  status: "ok",
  title: deck.title,
  deckId: newDeck.id,
  cardCount: deck.cards.length,
  provider,
  model,
});
```

- [ ] **Step 3: Verify TypeScript compiles cleanly**

Run:
```bash
npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/import/route.ts
git commit -m "feat: include deckId in import API result"
```

---

### Task 2: Render "Study deck" link in import result cards

**Assigned to:** UI Designer

**Files:**
- Modify: `src/app/import/page.tsx`

- [ ] **Step 1: Add `deckId` to the `ImportResult` interface and import `Link`**

Open `src/app/import/page.tsx`. Update the `ImportResult` interface at the top of the file to include `deckId`:

```ts
interface ImportResult {
  file: string;
  status: "ok" | "error";
  title?: string;
  deckId?: string;
  cardCount?: number;
  provider?: string;
  model?: string;
  error?: string;
}
```

Add the `Link` import below the existing imports:

```ts
import Link from "next/link";
```

- [ ] **Step 2: Render the "Study deck" link in the result card**

Find the result card JSX inside `results.map(...)`. Locate the section that renders the model/provider line for successful results:

```tsx
{result.status === "ok" && result.model && (
  <p className="mt-1 text-xs text-muted-foreground/40">
    via {result.provider}/{result.model}
  </p>
)}
```

Add the "Study deck" link immediately after it, still within the left column `<div>`:

```tsx
{result.status === "ok" && result.deckId && (
  <Link
    href={`/decks/${result.deckId}`}
    className="mt-2 inline-flex items-center text-xs font-medium text-primary hover:underline"
  >
    Study deck →
  </Link>
)}
```

The full updated left column block should look like this:

```tsx
<div className="min-w-0 flex-1">
  <p className="truncate text-sm font-medium text-foreground">
    {result.title ?? result.file}
  </p>
  <p className="mt-0.5 text-xs text-muted-foreground/55">{result.file}</p>
  {result.status === "ok" && result.model && (
    <p className="mt-1 text-xs text-muted-foreground/40">
      via {result.provider}/{result.model}
    </p>
  )}
  {result.status === "ok" && result.deckId && (
    <Link
      href={`/decks/${result.deckId}`}
      className="mt-2 inline-flex items-center text-xs font-medium text-primary hover:underline"
    >
      Study deck →
    </Link>
  )}
  {result.status === "error" && (
    <p className="mt-1 text-xs text-destructive">{result.error}</p>
  )}
</div>
```

- [ ] **Step 3: Verify TypeScript compiles cleanly**

Run:
```bash
npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 4: Manually verify the result card renders correctly**

Start the dev server (`npm run dev`) and import a `.md` file. After import completes:
- The result card should show the deck title, filename, model info, and a "Study deck →" link
- Clicking the link should navigate to `/decks/[deckId]`
- Error result cards (if any) should show no Study link

- [ ] **Step 5: Commit**

```bash
git add src/app/import/page.tsx
git commit -m "feat: add Study deck link to import result cards"
```
