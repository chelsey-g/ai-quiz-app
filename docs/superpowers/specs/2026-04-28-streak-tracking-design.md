# Streak Tracking — Design Spec

**Date:** 2026-04-28
**Status:** Approved

---

## Overview

Track consecutive days the user has studied (completed at least one session). Show the streak count prominently on the dashboard stats banner. Reset if the user misses a day. Introduce an "at risk" state for days when the streak is alive but not yet secured.

The feature is purely computed — no new database columns are needed. All logic derives from existing `sessions.completed_at` timestamps.

---

## Data Layer

### Source of truth

`sessions.completed_at` — a UTC timestamp written when a session finishes. One or more sessions on the same calendar day (UTC) counts as a single studied day.

### Streak algorithm

1. Fetch all `completed_at` values for the user where `completed_at IS NOT NULL`. No row limit (unlike the existing 20-row limit used for `recentDeckIds`).
2. Convert each timestamp to a UTC date string (`YYYY-MM-DD`).
3. Deduplicate into a `Set<string>`.
4. Get today's UTC date string and yesterday's.
5. Determine `streakStatus`:
   - If today is in the set → `"active"`
   - Else if yesterday is in the set → `"at_risk"` (studied yesterday, not yet today)
   - Else → `"none"` (missed yesterday and today, streak is broken)
6. Count `streakDays`:
   - If `"active"`: walk backwards from today, counting each consecutive day present in the set.
   - If `"at_risk"`: walk backwards from yesterday, same logic.
   - If `"none"`: `0`.

### Timezone note

Dates are computed in UTC on the server. This is acceptable for MVP. A timezone-aware streak would require a user preferences table that does not yet exist.

---

## Type Changes

`DashboardStats` in `src/lib/services/dashboard.ts` gains two new fields:

```ts
streakDays: number;
streakStatus: "active" | "at_risk" | "none";
```

The dashboard page (`src/app/page.tsx`) already types `DashboardStats` locally — that local type will be updated to match, or the import refactored to use the shared type from the service.

---

## Service Changes — `getDashboardStats`

A new query runs in parallel with the existing cards/sessions queries:

```ts
supabase
  .from("sessions")
  .select("completed_at")
  .eq("user_id", userId)
  .not("completed_at", "is", null)
```

No `.limit()` — we need all session dates to count a long streak correctly.

The existing sessions query (for `recentDeckIds`) keeps its `.limit(20)` and `.select("deck_id, completed_at")`. These two queries are independent and run in `Promise.all`.

A pure utility function `computeStreak(completedAts: string[])` is extracted to make testing straightforward. It returns `{ streakDays, streakStatus }`.

---

## Dashboard UI Changes

### StatBanner — 4-column grid

The current `grid-cols-3` becomes `grid-cols-4`. A fourth tile is added:

**Label:** "Streak"
**Value:** `{N} days` (or `—` when `streakStatus === "none"` and `streakDays === 0`)

**Color / state:**
- `active` (studied today): primary orange warm tone — same as the brand primary (`oklch(0.57 0.22 62)`)
- `at_risk` (studied yesterday, not today): amber (`text-amber-400`) with a subtle CSS `animate-pulse` on the flame icon only — draws attention without being alarming
- `none`: muted foreground, value shows `—`

**Flame icon:** Inline SVG (no new dependency). A simple path-based flame shape, ~16×16px, placed to the left of or above the number value.

**Copy:**
- 0 / none: label "Streak", value "—", subtext hidden
- at_risk: label "Streak", value `"{N} days"`, subtext "at risk" in amber
- active: label "Streak", value `"{N} days"`, no subtext needed

---

## Sidebar

Not included in this feature. The sidebar (`AppSidebar`) is a client component that receives `user` from the server layout. Adding streak there would require a second API fetch in the layout or prop-drilling stats from the dashboard, both of which add coupling with no proportional benefit. The dashboard banner is the right primary home for the streak. Revisit if a "stats sidebar widget" becomes a future feature.

---

## Error Handling

The streak query runs in the same `Promise.all` as the existing cards/sessions queries in `getDashboardStats`. If it fails, the existing error path (`throw new Error(...)`) covers it. No special streak-specific error handling needed — the dashboard already shows a generic error state.

---

## What This Is Not

- No streak freeze / shield mechanic (Duolingo-style)
- No streak milestone celebrations or badges
- No push notifications or reminders
- No user timezone support (UTC for now)
- No historical streak chart

These are valid future additions but out of scope for this iteration.
