# Stats Page Design

**Date:** 2026-04-30  
**Status:** Approved

## Overview

A `/stats` page showing global study statistics with historical charts, plus a compact stats section added to the existing `/decks/[id]` deck detail page. Stats are scoped to the authenticated user.

## Pages affected

- **New:** `src/app/stats/page.tsx`
- **New:** `src/app/api/stats/route.ts`
- **Modified:** `src/app/decks/[id]/page.tsx` — add collapsible stats section
- **Modified:** `src/app/api/decks/[id]/route.ts` — include per-deck stats in response

## `/stats` page layout

### Hero stat tiles (top row)
Five tiles in the same style as the dashboard banner (`rounded-xl border border-border/40 bg-card/60`):

| Tile | Value | Source |
|---|---|---|
| Total Sessions | count of completed sessions | `sessions` table |
| Study Time | sum of `completed_at - started_at` in minutes | `sessions` table |
| Overall Accuracy | `sum(times_correct) / sum(times_seen)` % | `cards` table |
| Cards Mastered | cards with `interval_days >= 21` | `cards` table |
| Streak | days + status (active/at_risk/none) | existing `computeStreak` |

### Charts (below tiles)

Two charts using **Recharts**, rendered client-side:

1. **Activity bar chart** — sessions per week, last 12 weeks. X = week label ("Apr 7"), Y = session count. Bar fill: `oklch(0.77 0.195 68)` (orange).
2. **Accuracy line chart** — daily accuracy % for last 30 days. Each day = average score across sessions that day. Line color: `oklch(0.65 0.18 265)` (blue-violet). Days with no sessions are gaps (not zero).

Both charts show an empty state ("No study sessions yet") when data is absent.

### Deck breakdown table (below charts)

A table listing all decks with per-deck stats:

- Deck title (links to `/decks/[id]`)
- Sessions count
- Accuracy %
- Mastered cards (e.g. "18 / 24")
- Last studied date

Sorted by last studied descending (most recent first). Decks with no sessions appear at the bottom.

## Per-deck stats on `/decks/[id]`

A compact collapsible "Stats" section added near the top of the deck detail page (above the card list, below the deck header). Collapsed by default. Shows:

- Sessions count
- Accuracy %
- Cards mastered (e.g. "6 / 20")
- Last studied date

No chart — just four small stat tiles. Clicking "Stats" toggles open/closed.

## API

### `GET /api/stats`

New endpoint. Requires auth. Returns:

```ts
{
  totals: {
    sessions: number;
    studyTimeMinutes: number;
    accuracy: number | null;     // null if no cards seen
    cardsMastered: number;
    streakDays: number;
    streakStatus: "active" | "at_risk" | "none";
  };
  activityByWeek: { week: string; count: number }[];   // 12 entries
  accuracyByDay: { date: string; pct: number }[];       // up to 30 entries
  deckStats: {
    deckId: string;
    title: string;
    sessions: number;
    accuracy: number | null;
    mastered: number;
    total: number;
    lastStudied: string | null;
  }[];
}
```

All queries use the server Supabase client scoped to the authenticated `user_id`.

### `GET /api/decks/[id]` (modified)

Add per-deck stats to the existing response:

```ts
{
  deck: Deck;
  cards: Card[];
  deckStats: {           // new
    sessions: number;
    accuracy: number | null;
    mastered: number;
    lastStudied: string | null;
  };
}
```

## Data definitions

- **Cards mastered:** `interval_days >= 21` (SM-2 interval of 3+ weeks — card has been reviewed multiple times successfully)
- **Accuracy:** `times_correct / times_seen * 100`, rounded to nearest integer. `null` when `times_seen === 0`.
- **Study time:** `sum(completed_at - started_at)` in minutes across all completed sessions, rounded to nearest minute.
- **Daily accuracy:** average of `score` field across all sessions completed on that UTC calendar day.

## Charts library

Install `recharts` (`npm install recharts`). Use `ResponsiveContainer` + `BarChart`/`LineChart`. Charts are client components. The stats page itself can be a server component that passes fetched data as props to a client `StatsCharts` component.

## Design system

- Orange `oklch(0.77 0.195 68)` — bar chart fill, primary actions
- Blue-violet `oklch(0.65 0.18 265)` — line chart, secondary actions
- Tailwind v4, ShadCN, dark mode throughout
- Match existing tile/card styles from dashboard
