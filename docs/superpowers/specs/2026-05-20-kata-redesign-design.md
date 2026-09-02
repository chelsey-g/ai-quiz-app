# Kata Redesign — Deck-Free Practice with Topic + Skill Picker

## Goal

Replace the deck-dependent Kata feature with a standalone practice mode where users pick JavaScript topics and a skill level to generate coding problems on demand.

## Architecture

### Pages and routing

- `/kata` — single page, handles both picker and workspace states. Full rewrite to a client component.
- `/kata/[deckId]` — **deleted**. Both `page.tsx` and `kata-workspace.tsx` removed.

### API routes

| Route | Change |
|---|---|
| `POST /api/kata/generate` | Body changes from `{ deckId }` to `{ topics: string[], difficulty: "easy"\|"medium"\|"hard" }`. No deck lookup. Prompt built from topics + difficulty only. |
| `GET /api/kata/history` | New route (replaces `/api/kata/[deckId]/history`). Returns last 20 attempts for the authenticated user globally — no deck filter. |
| `POST /api/kata/run` | **Unchanged.** |

### Database

One migration:

```sql
ALTER TABLE kata_attempts ALTER COLUMN deck_id DROP NOT NULL;
```

Existing rows retain their `deck_id` values. New attempts insert `NULL` for `deck_id`.

No other schema changes. `is_code_deck` and the classify-code route are left untouched.

### Files

**Deleted:**
- `src/app/kata/[deckId]/page.tsx`
- `src/app/kata/[deckId]/kata-workspace.tsx`

**Rewritten:**
- `src/app/kata/page.tsx` — full client component (see UI section)
- `src/app/api/kata/generate/route.ts` — new body shape, new prompt
- `src/app/api/kata/[deckId]/history/route.ts` → `src/app/api/kata/history/route.ts`

**Unchanged:**
- `src/app/api/kata/run/route.ts`
- `src/components/kata-editor.tsx`

## UI Flow

### Topic list (fixed, 7 options)

- JavaScript
- React
- TypeScript
- Node.js
- Data Structures
- Algorithms
- CSS / DOM

### Skill levels

| Label | DB value |
|---|---|
| Beginner | `easy` |
| Intermediate | `medium` |
| Advanced | `hard` |

### Picker state

Shown on load and whenever the user expands the picker after generating a problem.

- Multi-select topic chips — at least one must be selected. Active chips use the app's purple accent.
- Segmented control for skill level: Beginner / Intermediate / Advanced — single select.
- "Generate Problem" button. Disabled if no topic is selected. Shows a spinner while generating.

### Workspace state

Shown after a successful generate.

- A compact summary bar replaces the full picker: `"JavaScript, React · Intermediate · [Change]"`. Clicking "Change" re-expands the picker without clearing the current problem.
- Split-pane layout: problem description (left, ~38%), CodeMirror editor (right, ~62%).
- Run button + test results panel below the editor (same as current implementation).
- "New Problem" button in the header regenerates using current picker settings.

### History

Rendered at the bottom of the page. Same visual treatment as the current implementation (title, difficulty badge, score %, date). Not grouped by deck.

## Preference Persistence

- localStorage key: `trove:kata:prefs`
- Shape: `{ topics: string[], difficulty: "easy" | "medium" | "hard" }`
- Defaults (when key is absent): `{ topics: ["JavaScript"], difficulty: "easy" }`
- Written on every topic toggle or level change.
- Read on mount before first render.

## Generate API — New Prompt

```
Generate a JavaScript coding kata at [difficulty] level covering these topics: [topics].
The function stub must use a standard `function` declaration (not an arrow function) so it can be called by name.
Include a JSDoc comment above the function with @param and @returns types.
The body must be empty (just a comment `// your code here`).
Test cases must cover the happy path and at least one edge case (empty input, single element, zero, etc.).
```

## Validation

The generate route rejects requests where:
- `topics` is missing, empty, or contains values outside the allowed 7-topic list (prevents prompt injection)
- `difficulty` is not one of `"easy"`, `"medium"`, `"hard"`

Returns 400 with a descriptive error message in both cases.

## Error Handling

- Generate failure: show inline error message with a "Try again" button. Picker stays expanded.
- Run failure: same as current — error state in results panel.
- History fetch failure: silently renders empty history (non-critical).
