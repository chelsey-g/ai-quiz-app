# Kata Practice Design

## Overview

A code practice mode for programming decks. When a deck is classified as a coding deck, a **Code** button appears on its deck card. Clicking it opens a split-pane kata page at `/kata/[deckId]` where AI generates a JavaScript coding challenge on demand. The user writes a solution in an in-browser editor, hits Run, and Vercel Sandbox executes the code against hidden test cases. Results are saved per attempt.

---

## Entry Points

- **Deck card**: A `</ > Code` pill button appears alongside Study and Quiz buttons, but only when `decks.is_code_deck = true`.
- **Deck detail page**: Same Code button in the action row.
- Route: `/kata/[deckId]`

---

## Deck Classification

When a deck is created or imported, the app fires a background POST to `/api/decks/[id]/classify-code`. This route sends the deck's title, `topic_tags`, and up to 10 card fronts to AI with a prompt asking whether this deck covers programming or software development topics. AI responds with `{ is_code_deck: boolean }`. The route updates `decks.is_code_deck` accordingly.

- Classification is fire-and-forget — no spinner, no blocking the deck creation flow.
- The Code button appears on next data fetch once the flag is set.
- Only JavaScript decks are in scope; `is_code_deck` is false for all other topics.

---

## Kata Generation (On-Demand)

When the user navigates to `/kata/[deckId]`, the page POSTs to `/api/kata/generate` with the deck ID.

The API:
1. Fetches the deck's `title`, `topic_tags`, and up to 8 card fronts/backs.
2. Calls AI with a prompt that asks for:
   - `problem_title` — short name for the challenge
   - `problem_description` — 2–4 sentence explanation with one example
   - `function_stub` — the JS function signature with JSDoc comment (no implementation)
   - `test_cases` — array of 3–5 `{ input: any, expected: any }` objects
   - `difficulty` — `"easy" | "medium" | "hard"`
3. Saves the full kata (including test cases) to `kata_attempts`.
4. Returns everything **except** `test_cases` to the client.

Test cases are stored server-side only and never sent to the browser.

The user can hit **↻ New kata** at any time to generate a fresh problem. This creates a new `kata_attempts` row.

---

## Code Execution (Vercel Sandbox)

When the user clicks **Run** (or presses Ctrl+Enter), the client POSTs `{ attempt_id, user_code }` to `/api/kata/run`.

The server:
1. Fetches `test_cases` from the `kata_attempts` row.
2. Builds a self-contained Node.js test harness:

```js
const __tests = /* test_cases from DB */;
(function() {
  /* user_code injected here */
})();
const __fn = eval(`(function(){ ${userCode}; return functionName; })()`); // function name parsed from stub via regex: /function\s+(\w+)/
const __results = __tests.map(t => {
  try {
    const actual = __fn(t.input);
    const passed = JSON.stringify(actual) === JSON.stringify(t.expected);
    return { passed, input: t.input, expected: t.expected, actual };
  } catch(e) {
    return { passed: false, input: t.input, error: e.message };
  }
});
console.log(JSON.stringify(__results));
```

3. Executes this script in Vercel Sandbox (isolated Node.js environment).
4. Parses stdout as JSON — the results array.
5. Updates the `kata_attempts` row: `user_code`, `results`, `passed_count`, `total_count`.
6. Returns `{ results, passed_count, total_count }` to the client.

The user can run multiple times — each run overwrites `user_code` and `results` on the same attempt row.

---

## Data Model

### Migration: `decks` table

```sql
alter table decks add column is_code_deck boolean not null default false;
```

### Migration: `kata_attempts` table

```sql
create table kata_attempts (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references decks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  problem_title text not null,
  problem_description text not null,
  function_stub text not null,
  difficulty text not null default 'easy',
  test_cases jsonb not null,
  user_code text,
  results jsonb,
  passed_count int not null default 0,
  total_count int not null default 0,
  created_at timestamptz not null default now()
);

alter table kata_attempts enable row level security;

create policy "Users can manage their own kata attempts"
  on kata_attempts for all
  using (user_id = auth.uid());
```

---

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/decks/[id]/classify-code` | AI classifies deck, sets `is_code_deck` |
| POST | `/api/kata/generate` | Generate kata for a deck, return problem sans test cases |
| POST | `/api/kata/run` | Execute user code via Vercel Sandbox, save + return results |
| GET | `/api/kata/[deckId]/history` | List past attempts for a deck (passed_count, total_count, created_at) |

---

## Pages & Components

| Path | Description |
|------|-------------|
| `src/app/kata/[deckId]/page.tsx` | Main kata practice page |
| `src/components/deck-card.tsx` | Add Code button (conditional on `is_code_deck`) |
| `src/components/kata-editor.tsx` | CodeMirror editor component (JS syntax highlighting) |

### Kata page layout

- **Header bar**: deck name (link back), difficulty badge, hidden test count, ↻ New kata button
- **Left panel (38%)**: problem title, description, example input/output, deck tags
- **Right panel (62%)**: CodeMirror editor pre-loaded with `function_stub`
- **Run bar** (below editor): Run button, Ctrl+Enter hint, pass summary (`2 / 3 tests passed`)
- **Results panel** (below run bar): one row per test — ✓/✗, input shown, expected vs actual on failure

### Loading states

- On page load: skeleton panels while kata generates (typically 2–4 seconds)
- On Run: button shows "Running…", results panel clears, spinner until Vercel Sandbox responds

---

## Dependencies

- `@uiw/react-codemirror` + `@codemirror/lang-javascript` — code editor with JS syntax highlighting
- Vercel Sandbox API — for isolated code execution (consult current Vercel docs for SDK/REST API)

---

## Out of Scope

- Languages other than JavaScript
- Sharing or challenging others with katas (would layer on the existing challenges system — future work)
- Leaderboards or public kata browsing
- Custom test cases written by the user
