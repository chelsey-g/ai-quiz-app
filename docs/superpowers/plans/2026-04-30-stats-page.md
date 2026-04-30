# Stats Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a `/stats` page with global study statistics and charts, plus add a compact per-deck stats section to the existing deck detail page.

**Architecture:** A new server-side `getGlobalStats` service handles all data aggregation; a thin `/api/stats` route exposes it. The stats page is a server component that passes pre-fetched data to a client `StatsCharts` component for Recharts rendering. Per-deck stats are added to the existing `/api/decks/[id]` GET response so the deck detail page gets them in its existing fetch.

**Tech Stack:** Next.js 16 App Router, Recharts, Supabase, Tailwind v4, TypeScript

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/lib/services/stats.ts` | Create | All stats computation logic |
| `src/app/api/stats/route.ts` | Create | Thin GET /api/stats route |
| `src/app/stats/stats-charts.tsx` | Create | Client component — Recharts bar + line charts |
| `src/app/stats/page.tsx` | Create | Server component — hero tiles, charts, deck table |
| `src/app/api/decks/[id]/route.ts` | Modify | Add deckStats to GET response |
| `src/lib/services/decks.ts` | Modify | Add per-deck stats to getDeckById return |
| `src/app/decks/[id]/page.tsx` | Modify | Add collapsible stats section |
| `src/components/app-sidebar.tsx` | Modify | Add Stats nav link |

---

## Task 1: Install recharts + add Stats nav link

**Files:**
- Modify: `package.json`
- Modify: `src/components/app-sidebar.tsx`

- [ ] **Step 1: Install recharts**

```bash
cd /Users/chelseygowac/ai-quiz-app && npm install recharts
```

Expected: recharts added to `node_modules` and `package.json` dependencies.

- [ ] **Step 2: Add Stats link to NAV_LINKS in sidebar**

In `src/components/app-sidebar.tsx`, add to the `NAV_LINKS` array after the "Decks" entry:

```tsx
{
  href: "/stats",
  label: "Stats",
  icon: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.5V19a1 1 0 001 1h3a1 1 0 001-1v-5.5M9 8.5V19a1 1 0 001 1h3a1 1 0 001-1V8.5M15 11V19a1 1 0 001 1h3a1 1 0 001-1v-8" />
    </svg>
  ),
},
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json src/components/app-sidebar.tsx
git commit -m "feat(stats): install recharts, add Stats nav link"
```

---

## Task 2: Create stats service

**Files:**
- Create: `src/lib/services/stats.ts`

- [ ] **Step 1: Create the file**

```typescript
// src/lib/services/stats.ts
import { createClient } from "@/lib/supabase/server";
import { computeStreak } from "@/lib/streak";
import type { StreakStatus } from "@/lib/streak";

export type GlobalStats = {
  totals: {
    sessions: number;
    studyTimeMinutes: number;
    accuracy: number | null;
    cardsMastered: number;
    streakDays: number;
    streakStatus: StreakStatus;
  };
  activityByWeek: { week: string; count: number }[];
  accuracyByDay: { date: string; pct: number }[];
  deckStats: {
    deckId: string;
    title: string;
    sessions: number;
    accuracy: number | null;
    mastered: number;
    total: number;
    lastStudied: string | null;
  }[];
};

export type DeckStatsResult = {
  sessions: number;
  accuracy: number | null;
  mastered: number;
  lastStudied: string | null;
};

export async function getGlobalStats(userId: string): Promise<GlobalStats> {
  const supabase = await createClient();

  const { data: decks } = await supabase
    .from("decks")
    .select("id, title")
    .eq("user_id", userId);

  if (!decks || decks.length === 0) {
    return {
      totals: { sessions: 0, studyTimeMinutes: 0, accuracy: null, cardsMastered: 0, streakDays: 0, streakStatus: "none" },
      activityByWeek: buildActivityByWeek([]),
      accuracyByDay: [],
      deckStats: [],
    };
  }

  const deckIds = decks.map((d) => d.id);

  const [{ data: sessions }, { data: cards }] = await Promise.all([
    supabase
      .from("sessions")
      .select("id, deck_id, score, started_at, completed_at")
      .eq("user_id", userId)
      .not("completed_at", "is", null),
    supabase
      .from("cards")
      .select("deck_id, times_seen, times_correct, interval_days")
      .in("deck_id", deckIds),
  ]);

  const completedSessions = (sessions ?? []) as {
    id: string;
    deck_id: string;
    score: number | null;
    started_at: string;
    completed_at: string;
  }[];
  const allCards = (cards ?? []) as {
    deck_id: string;
    times_seen: number;
    times_correct: number;
    interval_days: number;
  }[];

  // Totals
  const totalSessions = completedSessions.length;

  let studyTimeMs = 0;
  for (const s of completedSessions) {
    studyTimeMs += new Date(s.completed_at).getTime() - new Date(s.started_at).getTime();
  }
  const studyTimeMinutes = Math.round(studyTimeMs / 60000);

  const totalSeen = allCards.reduce((sum, c) => sum + c.times_seen, 0);
  const totalCorrect = allCards.reduce((sum, c) => sum + c.times_correct, 0);
  const accuracy = totalSeen > 0 ? Math.round((totalCorrect / totalSeen) * 100) : null;
  const cardsMastered = allCards.filter((c) => c.interval_days >= 21).length;

  const { streakDays, streakStatus } = computeStreak(
    completedSessions.map((s) => s.completed_at)
  );

  // Per-deck stats
  const deckStats = decks.map((deck) => {
    const deckSessions = completedSessions.filter((s) => s.deck_id === deck.id);
    const deckCards = allCards.filter((c) => c.deck_id === deck.id);
    const deckSeen = deckCards.reduce((sum, c) => sum + c.times_seen, 0);
    const deckCorrect = deckCards.reduce((sum, c) => sum + c.times_correct, 0);
    const deckAccuracy = deckSeen > 0 ? Math.round((deckCorrect / deckSeen) * 100) : null;
    const mastered = deckCards.filter((c) => c.interval_days >= 21).length;
    const sortedSessions = [...deckSessions].sort((a, b) =>
      b.completed_at.localeCompare(a.completed_at)
    );
    const lastStudied = sortedSessions[0]?.completed_at ?? null;

    return {
      deckId: deck.id,
      title: deck.title,
      sessions: deckSessions.length,
      accuracy: deckAccuracy,
      mastered,
      total: deckCards.length,
      lastStudied,
    };
  });

  deckStats.sort((a, b) => {
    if (!a.lastStudied && !b.lastStudied) return 0;
    if (!a.lastStudied) return 1;
    if (!b.lastStudied) return -1;
    return b.lastStudied.localeCompare(a.lastStudied);
  });

  return {
    totals: { sessions: totalSessions, studyTimeMinutes, accuracy, cardsMastered, streakDays, streakStatus },
    activityByWeek: buildActivityByWeek(completedSessions.map((s) => s.completed_at)),
    accuracyByDay: buildAccuracyByDay(completedSessions),
    deckStats,
  };
}

export async function getDeckStats(deckId: string, userId: string): Promise<DeckStatsResult> {
  const supabase = await createClient();

  const [{ data: sessions }, { data: cards }] = await Promise.all([
    supabase
      .from("sessions")
      .select("completed_at")
      .eq("deck_id", deckId)
      .eq("user_id", userId)
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false }),
    supabase
      .from("cards")
      .select("times_seen, times_correct, interval_days")
      .eq("deck_id", deckId),
  ]);

  const completedSessions = (sessions ?? []) as { completed_at: string }[];
  const deckCards = (cards ?? []) as { times_seen: number; times_correct: number; interval_days: number }[];

  const totalSeen = deckCards.reduce((sum, c) => sum + c.times_seen, 0);
  const totalCorrect = deckCards.reduce((sum, c) => sum + c.times_correct, 0);
  const accuracy = totalSeen > 0 ? Math.round((totalCorrect / totalSeen) * 100) : null;
  const mastered = deckCards.filter((c) => c.interval_days >= 21).length;
  const lastStudied = completedSessions[0]?.completed_at ?? null;

  return { sessions: completedSessions.length, accuracy, mastered, lastStudied };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildActivityByWeek(completedAts: string[]): { week: string; count: number }[] {
  const now = new Date();
  const dayOfWeek = now.getUTCDay();
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const thisMonday = new Date(now);
  thisMonday.setUTCDate(now.getUTCDate() - daysToMonday);
  thisMonday.setUTCHours(0, 0, 0, 0);

  const weeks: { week: string; count: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const weekStart = new Date(thisMonday);
    weekStart.setUTCDate(thisMonday.getUTCDate() - i * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekStart.getUTCDate() + 7);

    const count = completedAts.filter((ts) => {
      const d = new Date(ts);
      return d >= weekStart && d < weekEnd;
    }).length;

    const label = weekStart.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
    weeks.push({ week: label, count });
  }
  return weeks;
}

function buildAccuracyByDay(
  sessions: { completed_at: string; score: number | null }[]
): { date: string; pct: number }[] {
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setUTCDate(now.getUTCDate() - 30);

  const recent = sessions.filter(
    (s) => new Date(s.completed_at) >= thirtyDaysAgo && s.score !== null
  );

  const byDay = new Map<string, number[]>();
  for (const s of recent) {
    const date = s.completed_at.slice(0, 10);
    if (!byDay.has(date)) byDay.set(date, []);
    byDay.get(date)!.push(Math.round((s.score ?? 0) * 100));
  }

  return Array.from(byDay.entries())
    .map(([date, scores]) => ({
      date,
      pct: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/chelseygowac/ai-quiz-app && npx tsc --noEmit 2>&1 | grep "services/stats"
```

Expected: no output (no errors in the new file).

- [ ] **Step 3: Commit**

```bash
git add src/lib/services/stats.ts
git commit -m "feat(stats): add stats service with global and per-deck aggregations"
```

---

## Task 3: Create GET /api/stats route

**Files:**
- Create: `src/app/api/stats/route.ts`

- [ ] **Step 1: Create the route**

```typescript
// src/app/api/stats/route.ts
import { createClient } from "@/lib/supabase/server";
import { getGlobalStats } from "@/lib/services/stats";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const stats = await getGlobalStats(user.id);
    return Response.json(stats);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/stats/route.ts
git commit -m "feat(stats): add GET /api/stats route"
```

---

## Task 4: Create StatsCharts client component

**Files:**
- Create: `src/app/stats/stats-charts.tsx`

- [ ] **Step 1: Create the charts component**

```tsx
// src/app/stats/stats-charts.tsx
"use client";

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

const TOOLTIP_STYLE = {
  background: "var(--card)",
  border: "1px solid oklch(0.5 0 0 / 0.2)",
  borderRadius: "8px",
  fontSize: "12px",
  color: "var(--foreground)",
};

export function StatsCharts({
  activityByWeek,
  accuracyByDay,
}: {
  activityByWeek: { week: string; count: number }[];
  accuracyByDay: { date: string; pct: number }[];
}) {
  const hasActivity = activityByWeek.some((w) => w.count > 0);
  const hasAccuracy = accuracyByDay.length > 0;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {/* Activity bar chart */}
      <div className="rounded-2xl border border-border/40 bg-card/60 p-5">
        <p className="mb-4 text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground/60">
          Sessions per week
        </p>
        {hasActivity ? (
          <ResponsiveContainer width="100%" height={160}>
            <BarChart
              data={activityByWeek}
              margin={{ top: 0, right: 0, left: -24, bottom: 0 }}
            >
              <CartesianGrid vertical={false} stroke="oklch(0.5 0 0 / 0.08)" />
              <XAxis
                dataKey="week"
                tick={{ fontSize: 10, fill: "oklch(0.6 0 0 / 0.6)" }}
                tickLine={false}
                axisLine={false}
                interval={2}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "oklch(0.6 0 0 / 0.6)" }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                cursor={{ fill: "oklch(0.5 0 0 / 0.05)" }}
              />
              <Bar dataKey="count" name="Sessions" fill="oklch(0.77 0.195 68)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-40 items-center justify-center">
            <p className="text-sm text-muted-foreground/40">No study sessions yet</p>
          </div>
        )}
      </div>

      {/* Accuracy line chart */}
      <div className="rounded-2xl border border-border/40 bg-card/60 p-5">
        <p className="mb-4 text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground/60">
          Accuracy (last 30 days)
        </p>
        {hasAccuracy ? (
          <ResponsiveContainer width="100%" height={160}>
            <LineChart
              data={accuracyByDay}
              margin={{ top: 0, right: 0, left: -24, bottom: 0 }}
            >
              <CartesianGrid stroke="oklch(0.5 0 0 / 0.08)" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "oklch(0.6 0 0 / 0.6)" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(d: string) =>
                  new Date(d + "T00:00:00Z").toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })
                }
                interval="preserveStartEnd"
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 10, fill: "oklch(0.6 0 0 / 0.6)" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => `${v}%`}
              />
              <Tooltip
                formatter={(v: number) => [`${v}%`, "Accuracy"]}
                contentStyle={TOOLTIP_STYLE}
              />
              <Line
                type="monotone"
                dataKey="pct"
                stroke="oklch(0.65 0.18 265)"
                strokeWidth={2}
                dot={false}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-40 items-center justify-center">
            <p className="text-sm text-muted-foreground/40">No data yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/chelseygowac/ai-quiz-app && npx tsc --noEmit 2>&1 | grep "stats-charts"
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/app/stats/stats-charts.tsx
git commit -m "feat(stats): add StatsCharts client component with recharts"
```

---

## Task 5: Create /stats page

**Files:**
- Create: `src/app/stats/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
// src/app/stats/page.tsx
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getGlobalStats } from "@/lib/services/stats";
import { StatsCharts } from "./stats-charts";
import type { StreakStatus } from "@/lib/streak";

function Tile({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-xl border border-border/40 bg-card/60 px-4 py-3">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground/55">{label}</p>
      <p
        className={`font-heading mt-1 text-2xl font-bold tabular-nums ${
          highlight ? "text-amber-400" : "text-foreground"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function StreakTile({ streakDays, streakStatus }: { streakDays: number; streakStatus: StreakStatus }) {
  const value = streakStatus === "none" || streakDays === 0 ? "—" : `${streakDays}`;
  const label = streakDays === 1 ? "day" : "days";
  const color =
    streakStatus === "active"
      ? "text-primary"
      : streakStatus === "at_risk"
      ? "text-amber-400"
      : "text-foreground";

  return (
    <div className="rounded-xl border border-border/40 bg-card/60 px-4 py-3">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground/55">Streak</p>
      <div className="mt-1 flex items-baseline gap-1">
        <p className={`font-heading text-2xl font-bold tabular-nums ${color}`}>{value}</p>
        {streakDays > 0 && streakStatus !== "none" && (
          <span className={`font-heading text-sm font-medium ${color} opacity-70`}>{label}</span>
        )}
      </div>
      {streakStatus === "at_risk" && (
        <p className="mt-0.5 text-[10px] text-amber-400/80">at risk</p>
      )}
    </div>
  );
}

function formatStudyTime(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default async function StatsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const stats = await getGlobalStats(user.id);

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8">
        <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">Stats</h1>
      </div>

      {/* Hero tiles */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Tile label="Sessions" value={stats.totals.sessions.toString()} />
        <Tile label="Study time" value={formatStudyTime(stats.totals.studyTimeMinutes)} />
        <Tile
          label="Accuracy"
          value={stats.totals.accuracy !== null ? `${stats.totals.accuracy}%` : "—"}
        />
        <Tile label="Mastered" value={stats.totals.cardsMastered.toString()} />
        <StreakTile
          streakDays={stats.totals.streakDays}
          streakStatus={stats.totals.streakStatus}
        />
      </div>

      {/* Charts */}
      <div className="mb-8">
        <StatsCharts
          activityByWeek={stats.activityByWeek}
          accuracyByDay={stats.accuracyByDay}
        />
      </div>

      {/* Deck breakdown */}
      <div>
        <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground/60">
          Deck breakdown
        </p>
        <div className="overflow-hidden rounded-2xl border border-border/40">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/40 bg-muted/20">
                <th className="px-4 py-3 text-left text-[10px] uppercase tracking-widest text-muted-foreground/55 font-medium">
                  Deck
                </th>
                <th className="px-4 py-3 text-right text-[10px] uppercase tracking-widest text-muted-foreground/55 font-medium">
                  Sessions
                </th>
                <th className="px-4 py-3 text-right text-[10px] uppercase tracking-widest text-muted-foreground/55 font-medium">
                  Accuracy
                </th>
                <th className="px-4 py-3 text-right text-[10px] uppercase tracking-widest text-muted-foreground/55 font-medium">
                  Mastered
                </th>
                <th className="px-4 py-3 text-right text-[10px] uppercase tracking-widest text-muted-foreground/55 font-medium">
                  Last studied
                </th>
              </tr>
            </thead>
            <tbody>
              {stats.deckStats.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground/40">
                    No decks yet — create one to start tracking stats.
                  </td>
                </tr>
              ) : (
                stats.deckStats.map((d) => (
                  <tr key={d.deckId} className="border-b border-border/20 last:border-0 hover:bg-muted/10 transition-colors">
                    <td className="px-4 py-3">
                      <Link
                        href={`/decks/${d.deckId}`}
                        className="font-medium text-foreground hover:text-primary transition-colors"
                      >
                        {d.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {d.sessions}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {d.accuracy !== null ? `${d.accuracy}%` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {d.mastered} / {d.total}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {d.lastStudied ? formatDate(d.lastStudied) : "Never"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/chelseygowac/ai-quiz-app && npx tsc --noEmit 2>&1 | grep "stats/"
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/app/stats/page.tsx
git commit -m "feat(stats): add /stats page with hero tiles and deck breakdown table"
```

---

## Task 6: Add per-deck stats to deck detail API + UI

**Files:**
- Modify: `src/lib/services/decks.ts`
- Modify: `src/app/api/decks/[id]/route.ts`
- Modify: `src/app/decks/[id]/page.tsx`

- [ ] **Step 1: Update getDeckById in decks service to include deck stats**

In `src/lib/services/decks.ts`, update the `getDeckById` function to also query sessions and return `deckStats`:

```typescript
// Add this import at the top of src/lib/services/decks.ts
import { getDeckStats } from "@/lib/services/stats";
import type { DeckStatsResult } from "@/lib/services/stats";
```

Replace the existing `getDeckById` function signature and return type:

```typescript
export async function getDeckById(
  deckId: string,
  userId: string
): Promise<{ deck: Deck; cards: Card[]; deckStats: DeckStatsResult }> {
  const supabase = await createClient();

  const [
    { data: deck, error: deckError },
    { data: cards, error: cardsError },
    deckStats,
  ] = await Promise.all([
    supabase
      .from("decks")
      .select("*")
      .eq("id", deckId)
      .eq("user_id", userId)
      .single(),
    supabase
      .from("cards")
      .select("*")
      .eq("deck_id", deckId)
      .order("created_at"),
    getDeckStats(deckId, userId),
  ]);

  if (deckError) {
    const notFound = deckError.code === "PGRST116";
    const err = new Error(deckError.message) as Error & { status?: number };
    err.status = notFound ? 404 : 500;
    throw err;
  }

  if (cardsError) {
    throw new Error(cardsError.message);
  }

  return { deck: deck as Deck, cards: (cards ?? []) as Card[], deckStats };
}
```

- [ ] **Step 2: Update GET /api/decks/[id] to pass deckStats through**

In `src/app/api/decks/[id]/route.ts`, the GET handler already calls `getDeckById`. Update the response to include `deckStats`:

```typescript
// In the GET handler, replace:
const { deck, cards } = await getDeckById(id, user.id);
return Response.json({ deck, cards });

// With:
const { deck, cards, deckStats } = await getDeckById(id, user.id);
return Response.json({ deck, cards, deckStats });
```

- [ ] **Step 3: Add collapsible stats section to deck detail page**

In `src/app/decks/[id]/page.tsx`, add a `DeckStatsResult` type import and a `DeckStatsBar` component. Then wire in the `deckStats` from the fetch response.

Add the type import at the top of the file (with existing imports):
```typescript
import type { DeckStatsResult } from "@/lib/services/stats";
```

Add the `DeckStatsBar` component before the `export default` function:

```tsx
function DeckStatsBar({ stats, totalCards }: { stats: DeckStatsResult; totalCards: number }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-5 rounded-xl border border-border/40 bg-card/40">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground/60">
          Stats
        </span>
        <svg
          className={`h-3.5 w-3.5 text-muted-foreground/40 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="grid grid-cols-4 gap-3 border-t border-border/30 px-4 pb-4 pt-3">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50">Sessions</p>
            <p className="font-heading mt-0.5 text-lg font-bold tabular-nums text-foreground">
              {stats.sessions}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50">Accuracy</p>
            <p className="font-heading mt-0.5 text-lg font-bold tabular-nums text-foreground">
              {stats.accuracy !== null ? `${stats.accuracy}%` : "—"}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50">Mastered</p>
            <p className="font-heading mt-0.5 text-lg font-bold tabular-nums text-foreground">
              {stats.mastered} / {totalCards}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50">Last studied</p>
            <p className="font-heading mt-0.5 text-lg font-bold text-foreground">
              {stats.lastStudied
                ? new Date(stats.lastStudied).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                : "Never"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
```

In the fetch call inside the page component, update to destructure `deckStats`:

Find the fetch inside `useEffect`:
```typescript
// Find:
const data = await res.json();
setDeck(data.deck);
setAllCards(data.cards);

// Replace with:
const data = await res.json();
setDeck(data.deck);
setAllCards(data.cards);
setDeckStats(data.deckStats ?? null);
```

Add state for `deckStats` near the other state declarations:
```typescript
const [deckStats, setDeckStats] = useState<DeckStatsResult | null>(null);
```

Render `DeckStatsBar` just before the cards section (after the deck header, before the tag filter pills). Find the section that renders the deck title/header and insert after it:
```tsx
{deckStats && deck && (
  <DeckStatsBar stats={deckStats} totalCards={deck.card_count} />
)}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/chelseygowac/ai-quiz-app && npx tsc --noEmit
```

Expected: no output (zero errors).

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/decks.ts src/app/api/decks/[id]/route.ts src/app/decks/[id]/page.tsx
git commit -m "feat(stats): add per-deck stats section to deck detail page"
```
