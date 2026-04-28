---
assigned-to: both
status: ready
context: "computeStreak is a pure utility in src/lib/streak.ts (engineer task); StatBanner expands from 3→4 cols with a flame SVG tile (ui-designer task). The engineer must land Task 1–4 first before the UI task touches page.tsx, since the DashboardStats type needs streakDays/streakStatus."
---

# Streak Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Compute a user's study streak from existing `sessions.completed_at` data and display it as a fourth stat tile on the dashboard banner, with active/at-risk/none visual states.

**Architecture:** A pure `computeStreak` utility derives streak days and status from an array of UTC timestamp strings. `getDashboardStats` calls a new unlimited Supabase query for all session dates, invokes `computeStreak`, and adds `streakDays`/`streakStatus` to its return value. The dashboard `StatBanner` expands from 3 to 4 columns and renders the streak tile.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase (server client), Tailwind v4, inline SVG for flame icon, vitest for unit-testing the pure utility.

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `src/lib/streak.ts` | **Create** | Pure `computeStreak` utility — no Supabase dependency |
| `src/lib/streak.test.ts` | **Create** | Vitest unit tests for `computeStreak` |
| `src/lib/services/dashboard.ts` | **Modify** | Add streak query + call `computeStreak`, extend return type |
| `src/app/page.tsx` | **Modify** | Update local `DashboardStats` type, expand `StatBanner` to 4 cols + streak tile |
| `vitest.config.ts` | **Create** | Vitest config (since no test runner exists yet) |
| `package.json` | **Modify** | Add vitest dev dependency and `test` script |

---

## Task 1: Install vitest and create config

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: Install vitest**

```bash
cd /Users/chelseygowac/ai-quiz-app && npm install --save-dev vitest
```

Expected output: vitest added to `devDependencies`.

- [ ] **Step 2: Add test script to package.json**

Open `package.json`. In the `"scripts"` block, add:

```json
"test": "vitest run",
"test:watch": "vitest"
```

The scripts block should look like:

```json
"scripts": {
  "dev": "next dev --port 3001",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "test": "vitest run",
  "test:watch": "vitest"
},
```

- [ ] **Step 3: Create vitest.config.ts**

Create `/Users/chelseygowac/ai-quiz-app/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

- [ ] **Step 4: Verify vitest runs (no tests yet)**

```bash
cd /Users/chelseygowac/ai-quiz-app && npm test
```

Expected: `No test files found` or similar zero-test pass. No error exit code.

- [ ] **Step 5: Commit**

```bash
cd /Users/chelseygowac/ai-quiz-app && git add package.json package-lock.json vitest.config.ts && git commit -m "chore: add vitest for unit testing"
```

---

## Task 2: Write the failing `computeStreak` tests

**Files:**
- Create: `src/lib/streak.test.ts`

- [ ] **Step 1: Create the test file**

Create `/Users/chelseygowac/ai-quiz-app/src/lib/streak.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { computeStreak } from "./streak";

// Helper: build a UTC ISO string for N days ago
function daysAgo(n: number): string {
  const d = new Date();
  d.setUTCHours(12, 0, 0, 0); // noon UTC — stable time within the day
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString();
}

describe("computeStreak", () => {
  it("returns none with 0 days when no sessions exist", () => {
    const result = computeStreak([]);
    expect(result).toEqual({ streakDays: 0, streakStatus: "none" });
  });

  it("returns active with 1 day when studied today", () => {
    const result = computeStreak([daysAgo(0)]);
    expect(result).toEqual({ streakDays: 1, streakStatus: "active" });
  });

  it("returns at_risk with 1 day when studied only yesterday", () => {
    const result = computeStreak([daysAgo(1)]);
    expect(result).toEqual({ streakDays: 1, streakStatus: "at_risk" });
  });

  it("returns none when most recent session was 2 days ago", () => {
    const result = computeStreak([daysAgo(2)]);
    expect(result).toEqual({ streakDays: 0, streakStatus: "none" });
  });

  it("counts a multi-day active streak when studied today and previous consecutive days", () => {
    const result = computeStreak([daysAgo(0), daysAgo(1), daysAgo(2), daysAgo(3)]);
    expect(result).toEqual({ streakDays: 4, streakStatus: "active" });
  });

  it("counts a multi-day at_risk streak starting from yesterday", () => {
    const result = computeStreak([daysAgo(1), daysAgo(2), daysAgo(3)]);
    expect(result).toEqual({ streakDays: 3, streakStatus: "at_risk" });
  });

  it("stops counting at a gap — gap 2 days ago", () => {
    // Studied today and yesterday, but not 2 days ago, and studied 3 days ago
    const result = computeStreak([daysAgo(0), daysAgo(1), daysAgo(3)]);
    expect(result).toEqual({ streakDays: 2, streakStatus: "active" });
  });

  it("deduplicates multiple sessions on the same day", () => {
    // Three sessions today — should still count as 1 day
    const result = computeStreak([daysAgo(0), daysAgo(0), daysAgo(0)]);
    expect(result).toEqual({ streakDays: 1, streakStatus: "active" });
  });

  it("handles sessions far in the past with no recent activity", () => {
    const result = computeStreak([daysAgo(30), daysAgo(31)]);
    expect(result).toEqual({ streakDays: 0, streakStatus: "none" });
  });

  it("counts a long streak correctly", () => {
    const sessions = Array.from({ length: 14 }, (_, i) => daysAgo(i));
    const result = computeStreak(sessions);
    expect(result).toEqual({ streakDays: 14, streakStatus: "active" });
  });
});
```

- [ ] **Step 2: Run the tests to confirm they fail**

```bash
cd /Users/chelseygowac/ai-quiz-app && npm test
```

Expected: FAIL — `Cannot find module './streak'` or similar. All 10 tests should fail.

---

## Task 3: Implement `computeStreak`

**Files:**
- Create: `src/lib/streak.ts`

- [ ] **Step 1: Create the utility**

Create `/Users/chelseygowac/ai-quiz-app/src/lib/streak.ts`:

```ts
export type StreakStatus = "active" | "at_risk" | "none";

export type StreakResult = {
  streakDays: number;
  streakStatus: StreakStatus;
};

/**
 * Computes the user's study streak from an array of UTC ISO timestamp strings.
 *
 * Rules:
 * - One or more sessions on the same UTC calendar day = 1 studied day.
 * - "active"   — studied today; streak count starts from today.
 * - "at_risk"  — studied yesterday but not today; streak count starts from yesterday.
 * - "none"     — no session today or yesterday; streak is 0.
 *
 * Dates are compared in UTC. No timezone conversion is applied.
 */
export function computeStreak(completedAts: string[]): StreakResult {
  if (completedAts.length === 0) {
    return { streakDays: 0, streakStatus: "none" };
  }

  // Deduplicate into UTC date strings (YYYY-MM-DD)
  const studiedDays = new Set(
    completedAts.map((ts) => ts.slice(0, 10)) // "2026-04-28T..." → "2026-04-28"
  );

  const todayStr = utcDateString(new Date());
  const yesterdayStr = utcDateString(offsetDays(new Date(), -1));

  let streakStatus: StreakStatus;
  let startDateStr: string;

  if (studiedDays.has(todayStr)) {
    streakStatus = "active";
    startDateStr = todayStr;
  } else if (studiedDays.has(yesterdayStr)) {
    streakStatus = "at_risk";
    startDateStr = yesterdayStr;
  } else {
    return { streakDays: 0, streakStatus: "none" };
  }

  // Walk backwards from startDate counting consecutive days
  let count = 0;
  let cursor = new Date(startDateStr + "T00:00:00Z");

  while (studiedDays.has(utcDateString(cursor))) {
    count++;
    cursor = offsetDays(cursor, -1);
  }

  return { streakDays: count, streakStatus };
}

/** Returns "YYYY-MM-DD" in UTC for the given Date */
function utcDateString(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Returns a new Date offset by `days` days (positive = future, negative = past) */
function offsetDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}
```

- [ ] **Step 2: Run the tests**

```bash
cd /Users/chelseygowac/ai-quiz-app && npm test
```

Expected: All 10 tests pass. No failures.

- [ ] **Step 3: Commit**

```bash
cd /Users/chelseygowac/ai-quiz-app && git add src/lib/streak.ts src/lib/streak.test.ts && git commit -m "feat: add computeStreak utility with unit tests"
```

---

## Task 4: Extend `getDashboardStats` with streak data

**Files:**
- Modify: `src/lib/services/dashboard.ts`

- [ ] **Step 1: Open `src/lib/services/dashboard.ts` and update the `DashboardStats` type**

The current type definition (lines 3–10) is:

```ts
export type DashboardStats = {
  totalCards: number;
  totalSeen: number;
  totalCorrect: number;
  cardsDueToday: number;
  recentDeckIds: string[];
  dueCounts: Record<string, number>;
};
```

Replace it with:

```ts
import type { StreakStatus } from "@/lib/streak";

export type DashboardStats = {
  totalCards: number;
  totalSeen: number;
  totalCorrect: number;
  cardsDueToday: number;
  recentDeckIds: string[];
  dueCounts: Record<string, number>;
  streakDays: number;
  streakStatus: StreakStatus;
};
```

The import goes at the top of the file, after the existing `import { createClient }` line.

- [ ] **Step 2: Add the `computeStreak` import and streak query**

The full updated `src/lib/services/dashboard.ts` should be:

```ts
import { createClient } from "@/lib/supabase/server";
import { computeStreak } from "@/lib/streak";
import type { StreakStatus } from "@/lib/streak";

export type DashboardStats = {
  totalCards: number;
  totalSeen: number;
  totalCorrect: number;
  cardsDueToday: number;
  recentDeckIds: string[];
  dueCounts: Record<string, number>;
  streakDays: number;
  streakStatus: StreakStatus;
};

/**
 * Returns global study stats for the given user. Mirrors the logic in
 * GET /api/dashboard — deck IDs, card aggregates, due counts, recent sessions,
 * and current study streak.
 */
export async function getDashboardStats(userId: string): Promise<DashboardStats> {
  const supabase = await createClient();

  const { data: decks, error: decksError } = await supabase
    .from("decks")
    .select("id")
    .eq("user_id", userId);

  if (decksError) {
    throw new Error(decksError.message);
  }

  const deckIds = (decks ?? []).map((d) => d.id);

  if (deckIds.length === 0) {
    return {
      totalCards: 0,
      totalSeen: 0,
      totalCorrect: 0,
      cardsDueToday: 0,
      recentDeckIds: [],
      dueCounts: {},
      streakDays: 0,
      streakStatus: "none",
    };
  }

  const [
    { data: cards, error: cardsError },
    { data: recentSessions, error: recentSessionsError },
    { data: allSessionDates, error: allSessionDatesError },
  ] = await Promise.all([
    supabase
      .from("cards")
      .select("deck_id, times_seen, times_correct, next_review_at")
      .in("deck_id", deckIds),
    supabase
      .from("sessions")
      .select("deck_id, completed_at")
      .eq("user_id", userId)
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false })
      .limit(20),
    supabase
      .from("sessions")
      .select("completed_at")
      .eq("user_id", userId)
      .not("completed_at", "is", null),
  ]);

  if (cardsError) {
    throw new Error(cardsError.message);
  }
  if (recentSessionsError) {
    throw new Error(recentSessionsError.message);
  }
  if (allSessionDatesError) {
    throw new Error(allSessionDatesError.message);
  }

  const now = new Date().toISOString();
  const allCards = cards ?? [];

  const totalCards = allCards.length;
  const totalSeen = allCards.reduce((s, c) => s + c.times_seen, 0);
  const totalCorrect = allCards.reduce((s, c) => s + c.times_correct, 0);

  const isDue = (c: { times_seen: number; next_review_at: string | null }) =>
    c.times_seen > 0 && c.next_review_at !== null && c.next_review_at <= now;

  const cardsDueToday = allCards.filter(isDue).length;

  const dueCounts: Record<string, number> = {};
  for (const card of allCards) {
    if (isDue(card)) {
      dueCounts[card.deck_id] = (dueCounts[card.deck_id] ?? 0) + 1;
    }
  }

  const seen = new Set<string>();
  const recentDeckIds: string[] = [];
  for (const s of recentSessions ?? []) {
    if (!seen.has(s.deck_id) && recentDeckIds.length < 5) {
      seen.add(s.deck_id);
      recentDeckIds.push(s.deck_id);
    }
  }

  const completedAts = (allSessionDates ?? [])
    .map((s) => s.completed_at)
    .filter((ts): ts is string => ts !== null);

  const { streakDays, streakStatus } = computeStreak(completedAts);

  return {
    totalCards,
    totalSeen,
    totalCorrect,
    cardsDueToday,
    recentDeckIds,
    dueCounts,
    streakDays,
    streakStatus,
  };
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/chelseygowac/ai-quiz-app && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/chelseygowac/ai-quiz-app && git add src/lib/services/dashboard.ts && git commit -m "feat: add streak data to getDashboardStats"
```

---

## Task 5: Update dashboard page — type and StatBanner UI

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Update the local `DashboardStats` type in `page.tsx`**

At the top of `src/app/page.tsx`, find the local type definition:

```ts
type DashboardStats = {
  totalCards: number;
  totalSeen: number;
  totalCorrect: number;
  cardsDueToday: number;
  recentDeckIds: string[];
  dueCounts: Record<string, number>;
};
```

Replace it with:

```ts
type DashboardStats = {
  totalCards: number;
  totalSeen: number;
  totalCorrect: number;
  cardsDueToday: number;
  recentDeckIds: string[];
  dueCounts: Record<string, number>;
  streakDays: number;
  streakStatus: "active" | "at_risk" | "none";
};
```

- [ ] **Step 2: Replace the `StatBanner` component**

Find the existing `StatBanner` function in `src/app/page.tsx`:

```tsx
function StatBanner({ stats }: { stats: DashboardStats }) {
  const accuracy =
    stats.totalSeen > 0
      ? Math.round((stats.totalCorrect / stats.totalSeen) * 100)
      : null;

  return (
    <div className="mb-8 grid grid-cols-3 gap-3">
      <div className="rounded-xl border border-border/40 bg-card/60 px-4 py-3">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground/55">Total cards</p>
        <p className="font-heading mt-1 text-2xl font-bold tabular-nums text-foreground">
          {stats.totalCards}
        </p>
      </div>
      <div className="rounded-xl border border-border/40 bg-card/60 px-4 py-3">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground/55">Accuracy</p>
        <p className="font-heading mt-1 text-2xl font-bold tabular-nums text-foreground">
          {accuracy !== null ? `${accuracy}%` : "—"}
        </p>
      </div>
      <div className="rounded-xl border border-border/40 bg-card/60 px-4 py-3">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground/55">Due today</p>
        <p
          className={`font-heading mt-1 text-2xl font-bold tabular-nums ${
            stats.cardsDueToday > 0 ? "text-amber-400" : "text-foreground"
          }`}
        >
          {stats.cardsDueToday}
        </p>
      </div>
    </div>
  );
}
```

Replace it with:

```tsx
function FlameIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 2C12 2 13.5 8 17 10.5C20 12.7 24 12 24 12C24 12 20 11.3 17 13.5C13.5 16 12 22 12 22C12 22 10.5 16 7 13.5C4 11.3 0 12 0 12C0 12 4 12.7 7 10.5C10.5 8 12 2 12 2Z" />
    </svg>
  );
}

function StatBanner({ stats }: { stats: DashboardStats }) {
  const accuracy =
    stats.totalSeen > 0
      ? Math.round((stats.totalCorrect / stats.totalSeen) * 100)
      : null;

  const streakValue =
    stats.streakStatus === "none" || stats.streakDays === 0
      ? "—"
      : `${stats.streakDays}`;

  const streakLabel =
    stats.streakStatus === "none" || stats.streakDays === 0
      ? null
      : stats.streakDays === 1
      ? "day"
      : "days";

  const streakColor =
    stats.streakStatus === "active"
      ? "text-primary"
      : stats.streakStatus === "at_risk"
      ? "text-amber-400"
      : "text-foreground";

  const streakSubtext =
    stats.streakStatus === "at_risk" ? (
      <p className="mt-0.5 text-[10px] text-amber-400/80">at risk</p>
    ) : null;

  return (
    <div className="mb-8 grid grid-cols-4 gap-3">
      <div className="rounded-xl border border-border/40 bg-card/60 px-4 py-3">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground/55">Total cards</p>
        <p className="font-heading mt-1 text-2xl font-bold tabular-nums text-foreground">
          {stats.totalCards}
        </p>
      </div>
      <div className="rounded-xl border border-border/40 bg-card/60 px-4 py-3">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground/55">Accuracy</p>
        <p className="font-heading mt-1 text-2xl font-bold tabular-nums text-foreground">
          {accuracy !== null ? `${accuracy}%` : "—"}
        </p>
      </div>
      <div className="rounded-xl border border-border/40 bg-card/60 px-4 py-3">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground/55">Due today</p>
        <p
          className={`font-heading mt-1 text-2xl font-bold tabular-nums ${
            stats.cardsDueToday > 0 ? "text-amber-400" : "text-foreground"
          }`}
        >
          {stats.cardsDueToday}
        </p>
      </div>
      <div className="rounded-xl border border-border/40 bg-card/60 px-4 py-3">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground/55">Streak</p>
        <div className="mt-1 flex items-baseline gap-1">
          <FlameIcon
            className={`h-5 w-5 flex-none ${streakColor} ${
              stats.streakStatus === "at_risk" ? "animate-pulse" : ""
            }`}
          />
          <p className={`font-heading text-2xl font-bold tabular-nums ${streakColor}`}>
            {streakValue}
          </p>
          {streakLabel && (
            <span className={`font-heading text-sm font-medium ${streakColor} opacity-70`}>
              {streakLabel}
            </span>
          )}
        </div>
        {streakSubtext}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Also update the loading skeleton in `page.tsx` to show 4 skeleton tiles**

Find the skeleton block inside the `{loading && (...)}` section:

```tsx
<div className="grid grid-cols-3 gap-3">
  {Array.from({ length: 3 }).map((_, i) => (
    <div key={i} className="h-20 rounded-xl border border-border/40 bg-card/60 animate-pulse" />
  ))}
</div>
```

Replace it with:

```tsx
<div className="grid grid-cols-4 gap-3">
  {Array.from({ length: 4 }).map((_, i) => (
    <div key={i} className="h-20 rounded-xl border border-border/40 bg-card/60 animate-pulse" />
  ))}
</div>
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/chelseygowac/ai-quiz-app && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
cd /Users/chelseygowac/ai-quiz-app && git add src/app/page.tsx && git commit -m "feat: add streak tile to dashboard StatBanner"
```

---

## Task 6: Manual verification

- [ ] **Step 1: Start the dev server**

```bash
cd /Users/chelseygowac/ai-quiz-app && npm run dev
```

Open `http://localhost:3001` in a browser and sign in.

- [ ] **Step 2: Verify the banner shows 4 tiles**

The stats banner should now show: Total cards | Accuracy | Due today | Streak — all in a 4-column grid.

- [ ] **Step 3: Verify streak states**

The streak tile should show:
- `—` with muted color if no sessions have ever been completed
- `N days` in the brand orange/primary color if a session was completed today
- `N days` in amber with "at risk" subtext and a pulsing flame if the last session was yesterday
- `—` with muted color if the last session was 2+ days ago

If you don't have real session data to test `at_risk`, you can temporarily check by inserting a test session via the Supabase dashboard with `completed_at` set to yesterday's date.

- [ ] **Step 4: Run the full test suite**

```bash
cd /Users/chelseygowac/ai-quiz-app && npm test
```

Expected: All 10 unit tests pass.

- [ ] **Step 5: Final commit if any fixes were made**

If step 1–4 required any tweaks, commit them:

```bash
cd /Users/chelseygowac/ai-quiz-app && git add -p && git commit -m "fix: streak tile visual adjustments"
```

---

## Self-Review Notes

- **Spec coverage:** All spec sections covered — streak algorithm (`computeStreak`), type extension (`DashboardStats`), service layer (new query in `getDashboardStats`), 4-column `StatBanner`, active/at_risk/none states, flame icon, "at risk" subtext, no sidebar.
- **No placeholders:** All steps contain exact code. No TBDs.
- **Type consistency:** `StreakStatus` defined in `streak.ts`, imported in `dashboard.ts`, mirrored as inline union in `page.tsx` (no cross-file import needed from the page since it's a simple union). `streakDays` and `streakStatus` are consistent across all files.
- **Empty state:** When `deckIds.length === 0`, the early return in `getDashboardStats` now includes `streakDays: 0, streakStatus: "none"` — covered in Task 4.
