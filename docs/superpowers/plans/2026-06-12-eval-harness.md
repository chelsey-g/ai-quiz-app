# Card-Generation Eval Harness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `npm run evals` runs the production card-generation pipeline against fixed sample inputs and scores card *quality* (not just schema validity), so prompt/model regressions are caught before users see them.

**Architecture:** Design decisions already made with the user: evals exercise the **production path only** (one `generateCards()` call per fixture, exactly as prod), the LLM judge is **claude-sonnet-4-6** via the AI Gateway, and runs are **manual (`npm run evals`) plus a weekly routine** (routine is set up separately by the session owner — out of scope here). The harness is a standalone script, NOT a vitest suite: scores drift rather than pass/fail, so it produces a dated JSON report in `evals/results/` (committed — it's the drift history) and compares against the previous run. Deterministic scorers are pure functions with unit tests; the judge is a `generateObject` call with a Zod rubric. Context: the fallback chain can mask bad output — gpt-4o-mini once returned string-serialized arrays that were schema-valid (commit `f1d2c59`); "Gemini succeeded" and "Gemini produced good cards" are different events.

**Tech Stack:** TypeScript via `tsx`, Vercel AI SDK (`ai` + `@ai-sdk/gateway`), Zod, Vitest (deterministic scorers only). Env from `.env.local` via Node's `process.loadEnvFile` (Node 24 — no dotenv dependency).

**Cost per run:** ~7 generation calls + ~7 judge calls — pennies.

---

### Task 1: Fixtures

**Files:**
- Create: `evals/fixtures/rich-note.md`
- Create: `evals/fixtures/sparse-note.md`
- Create: `evals/fixtures/nontech-note.md`
- Create: `evals/fixtures/file-sample.md`
- Create: `evals/fixtures/index.ts`

- [ ] **Step 1: Write the note fixtures**

`evals/fixtures/rich-note.md` — dense technical content, should yield 8–15 grounded cards:

```markdown
# PostgreSQL Indexing Notes

B-tree is the default index type — good for equality and range queries (`<`, `<=`, `=`, `>=`, `>`), and for `ORDER BY` that matches the index order. Hash indexes only handle equality and are rarely worth it.

Partial indexes index a subset of rows: `CREATE INDEX ON orders (created_at) WHERE status = 'pending'` — much smaller, and the planner uses it only when the WHERE clause implies the predicate.

Covering indexes (`INCLUDE` columns) let index-only scans return data without visiting the heap, but only when the visibility map shows pages as all-visible — so they degrade on heavily-updated tables until VACUUM runs.

Expression indexes index a computed value: `CREATE INDEX ON users (lower(email))`. The query must use the exact same expression to match.

GIN indexes suit multi-value columns (arrays, jsonb, full-text tsvector). They're slow to build and update but fast to query. GiST is for geometric/range types and nearest-neighbor.

`EXPLAIN (ANALYZE, BUFFERS)` shows whether an index is actually used. Common reasons it isn't: the planner estimates a seq scan is cheaper (small table, low selectivity), a type mismatch defeats the index, or the expression doesn't match an expression index.

Index bloat: updates that can't use HOT (heap-only tuples) create new index entries; REINDEX CONCURRENTLY rebuilds without blocking writes.
```

`evals/fixtures/sparse-note.md` — thin content; a good generator yields FEW cards rather than padding:

```markdown
# Meeting note

HTTP 301 = permanent redirect, 302 = temporary. Browsers cache 301s aggressively.
```

`evals/fixtures/nontech-note.md` — non-software content; checks prompts don't assume code:

```markdown
# Coffee brewing

Espresso uses ~9 bars of pressure and a fine grind; extraction takes 25–30 seconds for a double shot. Under-extraction tastes sour, over-extraction tastes bitter.

Pour-over (V60, Chemex) needs a medium grind and a 1:15–1:17 coffee-to-water ratio. Bloom with twice the coffee's weight in water for 30–45 seconds to degas CO2.

French press is immersion brewing: coarse grind, 4 minutes steep. Lower acidity, heavier body because metal filters pass oils that paper traps.

Water at 92–96°C extracts best; boiling water scorches light roasts. Freshly roasted beans need 5–14 days of rest before peak flavor.
```

`evals/fixtures/file-sample.md` — exercises `mode: "file"` (the import path):

```markdown
# React useEffect

Effects run after render. The dependency array controls when: `[]` = once on mount, `[x]` = when x changes, omitted = every render.

Cleanup functions run before the next effect and on unmount — clear timers and subscriptions there. Stale closures happen when an effect reads state captured at definition time; fix with the dependency array or functional updates.

StrictMode double-invokes effects in development to surface missing cleanup.
```

- [ ] **Step 2: Write the fixture index**

```typescript
// evals/fixtures/index.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";

export type Fixture = {
  id: string;
  mode: "file" | "topic" | "notes";
  content: string;
  filePath: string; // title for notes mode, path for file mode, "" for topic
  /** Source text the judge checks faithfulness against; null for topic mode. */
  source: string | null;
};

const dir = join(import.meta.dirname);
const read = (f: string) => readFileSync(join(dir, f), "utf8");

export function loadFixtures(): Fixture[] {
  const rich = read("rich-note.md");
  const sparse = read("sparse-note.md");
  const nontech = read("nontech-note.md");
  const file = read("file-sample.md");
  return [
    { id: "notes-rich", mode: "notes", content: rich, filePath: "Postgres Indexing", source: rich },
    { id: "notes-sparse", mode: "notes", content: sparse, filePath: "", source: sparse },
    { id: "notes-nontech", mode: "notes", content: nontech, filePath: "Coffee Brewing", source: nontech },
    { id: "file-react", mode: "file", content: file, filePath: "notes/react-useeffect.md", source: file },
    { id: "topic-rust", mode: "topic", content: "Rust ownership and borrowing", filePath: "", source: null },
    { id: "topic-dns", mode: "topic", content: "How DNS resolution works", filePath: "", source: null },
    { id: "topic-niche", mode: "topic", content: "CRDTs (conflict-free replicated data types)", filePath: "", source: null },
  ];
}
```

- [ ] **Step 3: Commit**

```bash
git add evals/fixtures
git commit -m "feat(evals): fixture inputs covering all three generation modes"
```

### Task 2: Deterministic scorers (TDD)

**Files:**
- Create: `evals/scorers/deterministic.ts`
- Test: `evals/scorers/deterministic.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// evals/scorers/deterministic.test.ts
import { describe, it, expect } from "vitest";
import { findDuplicateFronts, selfContainmentFlags, trivialAnswerFlags, cardCountIssue } from "./deterministic";

const c = (front: string, back = "A real answer here") => ({ front, back });

describe("findDuplicateFronts", () => {
  it("catches near-duplicate fronts differing in case/punctuation", () => {
    const dupes = findDuplicateFronts([c("What is a B-tree?"), c("what is a b-tree"), c("What is GIN?")]);
    expect(dupes).toEqual([["What is a B-tree?", "what is a b-tree"]]);
  });
  it("returns empty for distinct fronts", () => {
    expect(findDuplicateFronts([c("A?"), c("B?")])).toEqual([]);
  });
});

describe("selfContainmentFlags", () => {
  it("flags cards that reference other cards or 'above'", () => {
    const flagged = selfContainmentFlags([
      c("As mentioned above, what does VACUUM do?"),
      c("See the previous card for context. What is bloat?"),
      c("What is a covering index?"),
    ]);
    expect(flagged).toHaveLength(2);
  });
});

describe("trivialAnswerFlags", () => {
  it("flags empty and near-empty backs", () => {
    expect(trivialAnswerFlags([c("Q?", ""), c("Q2?", "ok"), c("Q3?", "A complete answer.")])).toHaveLength(2);
  });
});

describe("cardCountIssue", () => {
  it("accepts counts within the mode's prompt-contract range", () => {
    expect(cardCountIssue("topic", 12)).toBeNull();
  });
  it("flags counts outside the range", () => {
    expect(cardCountIssue("topic", 3)).toMatch(/expected 10–15/);
    expect(cardCountIssue("notes", 30)).toMatch(/expected 8–15/);
  });
  it("allows zero cards for file/notes (no-learnable-content escape hatch)", () => {
    expect(cardCountIssue("file", 0)).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run evals/scorers/deterministic.test.ts` — FAIL, module not found.

- [ ] **Step 3: Implement**

```typescript
// evals/scorers/deterministic.ts
type CardLike = { front: string; back: string };

const normalize = (s: string) =>
  s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").replace(/\s+/g, " ").trim();

/** Groups of fronts that normalize to the same string. */
export function findDuplicateFronts(cards: CardLike[]): string[][] {
  const groups = new Map<string, string[]>();
  for (const card of cards) {
    const key = normalize(card.front);
    groups.set(key, [...(groups.get(key) ?? []), card.front]);
  }
  return [...groups.values()].filter((g) => g.length > 1);
}

const REFERENCE_PATTERNS =
  /\b(as mentioned|see above|the above|previous card|earlier card|aforementioned|see the previous)\b/i;

/** Cards whose front references other cards/context — violates the self-contained contract. */
export function selfContainmentFlags(cards: CardLike[]): CardLike[] {
  return cards.filter((c) => REFERENCE_PATTERNS.test(c.front) || REFERENCE_PATTERNS.test(c.back));
}

/** Cards whose back is empty or too short to be an answer. */
export function trivialAnswerFlags(cards: CardLike[]): CardLike[] {
  return cards.filter((c) => normalize(c.back).length < 4);
}

// Ranges from the prompt contracts in src/lib/ai/generate-cards.ts.
const COUNT_RANGES: Record<string, { min: number; max: number; zeroOk: boolean; label: string }> = {
  file: { min: 5, max: 15, zeroOk: true, label: "expected 5–15" },
  topic: { min: 10, max: 15, zeroOk: false, label: "expected 10–15" },
  notes: { min: 8, max: 15, zeroOk: true, label: "expected 8–15" },
};

/** Null if the card count honors the mode's prompt contract, else a description. */
export function cardCountIssue(mode: "file" | "topic" | "notes", count: number): string | null {
  const r = COUNT_RANGES[mode];
  if (count === 0 && r.zeroOk) return null;
  if (count >= r.min && count <= r.max) return null;
  return `card count ${count} out of range (${r.label})`;
}
```

- [ ] **Step 4: Run tests — expect PASS — then commit**

Run: `npx vitest run evals/scorers/deterministic.test.ts`

```bash
git add evals/scorers/deterministic.ts evals/scorers/deterministic.test.ts
git commit -m "feat(evals): deterministic scorers — dupes, self-containment, trivial answers, count contract"
```

### Task 3: LLM judge

**Files:**
- Create: `evals/scorers/judge.ts`

- [ ] **Step 1: Implement the judge**

```typescript
// evals/scorers/judge.ts
import { generateObject } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { z } from "zod";

const JudgeSchema = z.object({
  cards: z.array(
    z.object({
      quality: z.number().min(1).max(5).describe("1 = unusable, 3 = acceptable, 5 = excellent study card"),
      issues: z.array(z.string()).describe("Empty if none. E.g. 'not in source', 'ambiguous question', 'answer leaks into question'"),
    })
  ),
  summary: z.string().describe("Two sentences: overall quality, and the single most important problem if any"),
});

export type JudgeResult = z.infer<typeof JudgeSchema> & { meanQuality: number };

const JUDGE_SYSTEM = `You are a strict reviewer of AI-generated flashcards. Score each card 1–5:
- Self-contained: understandable with no other card and no source at hand.
- Answerable: the front asks one unambiguous thing; the back actually answers it.
- Faithful: when SOURCE NOTES are provided, every fact must come from them — invented facts cap quality at 2 and get the issue "not in source". When no source is given (topic mode), judge factual accuracy instead.
Judge each card on its own merits. Order of cards must not affect scores.`;

export async function judgeDeck(
  cards: { front: string; back: string }[],
  source: string | null
): Promise<JudgeResult> {
  const { object } = await generateObject({
    model: gateway("anthropic/claude-sonnet-4-6"),
    schema: JudgeSchema,
    system: JUDGE_SYSTEM,
    prompt:
      (source ? `SOURCE NOTES:\n${source}\n\n` : "No source notes — topic mode; judge factual accuracy.\n\n") +
      `CARDS (judge each, in order):\n` +
      cards.map((c, i) => `${i + 1}. FRONT: ${c.front}\n   BACK: ${c.back}`).join("\n"),
  });
  // The judge sometimes returns a different card count than sent; align defensively.
  const scored = object.cards.slice(0, cards.length);
  const meanQuality = scored.length
    ? scored.reduce((s, c) => s + c.quality, 0) / scored.length
    : 0;
  return { ...object, cards: scored, meanQuality };
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `npx tsc --noEmit` — clean.

```bash
git add evals/scorers/judge.ts
git commit -m "feat(evals): sonnet-4-6 LLM judge with faithfulness rubric"
```

### Task 4: Runner with drift comparison

**Files:**
- Create: `evals/run.ts`
- Create: `evals/results/.gitkeep`
- Modify: `package.json` (script + tsx devDependency)

- [ ] **Step 1: Install tsx**

Run: `npm install -D tsx`

- [ ] **Step 2: Implement the runner**

```typescript
// evals/run.ts
// Usage: npm run evals
// Runs the PRODUCTION generation path per fixture, scores, writes a dated
// report to evals/results/, and compares against the previous report.
process.loadEnvFile(".env.local");

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { generateCards } from "../src/lib/ai/generate-cards";
import { loadFixtures } from "./fixtures";
import { findDuplicateFronts, selfContainmentFlags, trivialAnswerFlags, cardCountIssue } from "./scorers/deterministic";
import { judgeDeck } from "./scorers/judge";

const RESULTS_DIR = join(import.meta.dirname, "results");
const DRIFT_THRESHOLD = 0.5;

type FixtureReport = {
  id: string;
  hardFailure: string | null;
  cardCount: number;
  deterministic: { duplicates: string[][]; notSelfContained: number; trivialAnswers: number; countIssue: string | null };
  judge: { meanQuality: number; summary: string; worstIssues: string[] } | null;
  ms: number;
};

function isAuthError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /401|unauthorized|OIDC|credential|api key/i.test(msg);
}

async function evalFixture(f: ReturnType<typeof loadFixtures>[number]): Promise<FixtureReport> {
  const t0 = Date.now();
  try {
    const { deck } = await generateCards(f.content, f.filePath, f.mode);
    const cards = deck.cards;
    const judge = cards.length > 0 ? await judgeDeck(cards, f.source) : null;
    return {
      id: f.id,
      hardFailure: null,
      cardCount: cards.length,
      deterministic: {
        duplicates: findDuplicateFronts(cards),
        notSelfContained: selfContainmentFlags(cards).length,
        trivialAnswers: trivialAnswerFlags(cards).length,
        countIssue: cardCountIssue(f.mode, cards.length),
      },
      judge: judge && {
        meanQuality: Number(judge.meanQuality.toFixed(2)),
        summary: judge.summary,
        worstIssues: judge.cards.filter((c) => c.quality <= 2).flatMap((c) => c.issues).slice(0, 5),
      },
      ms: Date.now() - t0,
    };
  } catch (err) {
    if (isAuthError(err)) {
      console.error("\n✗ Gateway auth failed. Local auth rides on VERCEL_OIDC_TOKEN, which expires (~12h).");
      console.error("  Fix: `vercel env pull` to refresh, or add a non-expiring AI_GATEWAY_API_KEY to .env.local.\n");
      process.exit(1);
    }
    return {
      id: f.id,
      hardFailure: err instanceof Error ? err.message : String(err),
      cardCount: 0,
      deterministic: { duplicates: [], notSelfContained: 0, trivialAnswers: 0, countIssue: null },
      judge: null,
      ms: Date.now() - t0,
    };
  }
}

function previousReport(): { date: string; overallMeanQuality: number } | null {
  const files = readdirSync(RESULTS_DIR).filter((f) => f.endsWith(".json")).sort();
  if (files.length === 0) return null;
  const prev = JSON.parse(readFileSync(join(RESULTS_DIR, files[files.length - 1]), "utf8"));
  return { date: prev.date, overallMeanQuality: prev.overallMeanQuality };
}

async function main() {
  const prev = previousReport(); // read BEFORE writing this run's file
  const fixtures = loadFixtures();
  console.log(`Running ${fixtures.length} fixtures through the production pipeline…\n`);

  const reports: FixtureReport[] = [];
  for (const f of fixtures) {
    const r = await evalFixture(f);
    const judged = r.judge ? `quality ${r.judge.meanQuality}` : r.hardFailure ? `FAILED: ${r.hardFailure}` : "no cards";
    console.log(`  ${r.id.padEnd(14)} ${String(r.cardCount).padStart(2)} cards  ${judged}  (${r.ms}ms)`);
    reports.push(r);
  }

  const judged = reports.filter((r) => r.judge);
  const overallMeanQuality = judged.length
    ? Number((judged.reduce((s, r) => s + r.judge!.meanQuality, 0) / judged.length).toFixed(2))
    : 0;
  const hardFailures = reports.filter((r) => r.hardFailure);
  const detIssues = reports.filter(
    (r) => r.deterministic.duplicates.length || r.deterministic.notSelfContained || r.deterministic.trivialAnswers || r.deterministic.countIssue
  );

  const date = new Date().toISOString().slice(0, 16).replace(":", "");
  const out = { date, overallMeanQuality, hardFailures: hardFailures.length, reports };
  const file = join(RESULTS_DIR, `${date}.json`);
  writeFileSync(file, JSON.stringify(out, null, 2));

  console.log(`\nOverall mean quality: ${overallMeanQuality}  |  hard failures: ${hardFailures.length}  |  fixtures with deterministic issues: ${detIssues.length}`);
  if (prev) {
    const delta = overallMeanQuality - prev.overallMeanQuality;
    console.log(`Previous run (${prev.date}): ${prev.overallMeanQuality}  →  delta ${delta >= 0 ? "+" : ""}${delta.toFixed(2)}`);
    if (delta <= -DRIFT_THRESHOLD) console.log(`⚠ DRIFT: quality dropped ≥ ${DRIFT_THRESHOLD} — inspect ${file}`);
  }
  console.log(`Report: ${file}`);

  if (hardFailures.length > 0) process.exit(1); // broken ≠ drifting
}

main();
```

- [ ] **Step 3: Add the npm script**

In `package.json` scripts:

```json
    "evals": "tsx evals/run.ts"
```

- [ ] **Step 4: Verify end-to-end**

Run: `npm run evals`
Expected: per-fixture lines with card counts and quality scores, a report file in `evals/results/`, exit 0. Run twice — second run prints the delta line. Sanity-check one report by reading the JSON: the `notes-sparse` fixture should have low card count without a count issue being mis-flagged, and `worstIssues` should be empty or plausible.

Also run: `npm test` — the deterministic scorer tests run; nothing in `run.ts` executes (it's not a test file).

- [ ] **Step 5: Commit**

```bash
git add evals package.json package-lock.json
git commit -m "feat(evals): production-path eval runner with judge scoring and drift detection"
```

### Out of scope (owner of the session sets these up after the harness lands)

- The weekly eval routine (scheduled task that runs `npm run evals` and notifies) — created via scheduled-tasks tooling, not in this repo.
- Per-model matrix runs — deliberately rejected in design (production path only).
- CI integration — revisit once the score baseline stabilizes.
