---
assigned-to: both
status: complete
context: "Option C chosen — persistent left sidebar replaces the top nav for authenticated users; layout.tsx must become a two-column layout; a new GET /api/dashboard endpoint supplies global stats + recently-studied deck IDs + per-deck due-card counts so the page can do one extra fetch on top of /api/decks."
---

# Dashboard Redesign (Option C — Sidebar + Sections) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat deck-grid dashboard with a sidebar-nav layout that surfaces "Continue studying", "Due today", and "All decks" sections plus a global stats banner.

**Architecture:** A new `GET /api/dashboard` route aggregates global stats, recently-studied deck IDs (from the `sessions` table), and per-deck due-card counts (cards where `next_review_at <= now()` OR `next_review_at IS NULL AND times_seen > 0`). The existing `/api/decks` route is unchanged. `layout.tsx` grows into a two-column authenticated shell (sidebar + scrollable main). `page.tsx` fetches both endpoints in parallel, then renders three content sections. The sidebar is a new server component. `DeckCard` gains an optional `dueCount` prop.

**Tech Stack:** Next.js 16 App Router, Supabase server client, Tailwind v4, ShadCN (no new packages needed), existing `DeckWithStats` type.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/app/api/dashboard/route.ts` | GET — global stats + recently-studied deck IDs + per-deck due counts |
| Create | `src/components/app-sidebar.tsx` | Persistent sidebar server component — logo, nav links, user info, sign-out |
| Modify | `src/app/layout.tsx` | Two-column layout for auth'd users; unauthenticated keeps minimal centered header |
| Modify | `src/app/page.tsx` | Fetch `/api/dashboard` + `/api/decks` in parallel; render three sections |
| Modify | `src/components/deck-card.tsx` | Add optional `dueCount` prop; render due-badge when > 0 |

---

## Engineer Tasks

### Task E1: `GET /api/dashboard` route

**Files:**
- Create: `src/app/api/dashboard/route.ts`

This route returns a single JSON object:

```ts
{
  totalCards: number;          // sum of card_count across all user's decks
  totalSeen: number;           // sum of times_seen across all user's cards
  totalCorrect: number;        // sum of times_correct across all user's cards
  cardsDueToday: number;       // count of cards where due condition is met (across all decks)
  recentDeckIds: string[];     // up to 5 deck IDs ordered by most-recent completed session
  dueCounts: Record<string, number>; // deck_id → count of due cards in that deck
}
```

A card is "due" when: `next_review_at <= now()` AND `times_seen > 0`.
Cards with `times_seen = 0` are "new" and shown separately via `unattempted_count` on deck cards — they are NOT counted as "due".

- [ ] **Step 1: Create the route file**

Create `src/app/api/dashboard/route.ts`:

```ts
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch all cards for the user's decks in one query
  const { data: cards, error: cardsError } = await supabase
    .from("cards")
    .select("deck_id, times_seen, times_correct, next_review_at")
    .in(
      "deck_id",
      (
        await supabase
          .from("decks")
          .select("id")
          .eq("user_id", user.id)
      ).data?.map((d) => d.id) ?? []
    );

  if (cardsError) {
    return Response.json({ error: cardsError.message }, { status: 500 });
  }

  const now = new Date().toISOString();
  const allCards = cards ?? [];

  // Global stats
  const totalCards = allCards.length;
  const totalSeen = allCards.reduce((s, c) => s + c.times_seen, 0);
  const totalCorrect = allCards.reduce((s, c) => s + c.times_correct, 0);

  // Due condition: times_seen > 0 AND next_review_at <= now
  const isDue = (c: { times_seen: number; next_review_at: string | null }) =>
    c.times_seen > 0 && c.next_review_at !== null && c.next_review_at <= now;

  const cardsDueToday = allCards.filter(isDue).length;

  // Per-deck due counts
  const dueCounts: Record<string, number> = {};
  for (const card of allCards) {
    if (isDue(card)) {
      dueCounts[card.deck_id] = (dueCounts[card.deck_id] ?? 0) + 1;
    }
  }

  // Recently studied: up to 5 distinct deck_ids ordered by most recent completed session
  const { data: sessions, error: sessionsError } = await supabase
    .from("sessions")
    .select("deck_id, completed_at")
    .eq("user_id", user.id)
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: false })
    .limit(20);

  if (sessionsError) {
    return Response.json({ error: sessionsError.message }, { status: 500 });
  }

  const seen = new Set<string>();
  const recentDeckIds: string[] = [];
  for (const s of sessions ?? []) {
    if (!seen.has(s.deck_id) && recentDeckIds.length < 5) {
      seen.add(s.deck_id);
      recentDeckIds.push(s.deck_id);
    }
  }

  return Response.json({
    totalCards,
    totalSeen,
    totalCorrect,
    cardsDueToday,
    recentDeckIds,
    dueCounts,
  });
}
```

- [ ] **Step 2: Verify it loads without error**

Start the dev server (`npm run dev`) and visit `http://localhost:3001/api/dashboard` while signed in. Expected: JSON object with the six keys. If not signed in, expect `{"error":"Unauthorized"}` with 401.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/dashboard/route.ts
git commit -m "feat(api): add GET /api/dashboard — global stats, due counts, recent sessions"
```

---

### Task E2: Refactor cards sub-query in dashboard route (cleanup)

The nested `await` inside `.in()` in Task E1 is readable but does two round-trips. Refactor to sequential fetches for clarity.

**Files:**
- Modify: `src/app/api/dashboard/route.ts`

- [ ] **Step 1: Replace nested query with two sequential fetches**

Replace the full `GET` body with:

```ts
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 1. Get all deck IDs for this user
  const { data: decks, error: decksError } = await supabase
    .from("decks")
    .select("id")
    .eq("user_id", user.id);

  if (decksError) {
    return Response.json({ error: decksError.message }, { status: 500 });
  }

  const deckIds = (decks ?? []).map((d) => d.id);

  if (deckIds.length === 0) {
    return Response.json({
      totalCards: 0,
      totalSeen: 0,
      totalCorrect: 0,
      cardsDueToday: 0,
      recentDeckIds: [],
      dueCounts: {},
    });
  }

  // 2. Fetch cards + recent sessions in parallel
  const [{ data: cards, error: cardsError }, { data: sessions, error: sessionsError }] =
    await Promise.all([
      supabase
        .from("cards")
        .select("deck_id, times_seen, times_correct, next_review_at")
        .in("deck_id", deckIds),
      supabase
        .from("sessions")
        .select("deck_id, completed_at")
        .eq("user_id", user.id)
        .not("completed_at", "is", null)
        .order("completed_at", { ascending: false })
        .limit(20),
    ]);

  if (cardsError) {
    return Response.json({ error: cardsError.message }, { status: 500 });
  }
  if (sessionsError) {
    return Response.json({ error: sessionsError.message }, { status: 500 });
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
  for (const s of sessions ?? []) {
    if (!seen.has(s.deck_id) && recentDeckIds.length < 5) {
      seen.add(s.deck_id);
      recentDeckIds.push(s.deck_id);
    }
  }

  return Response.json({
    totalCards,
    totalSeen,
    totalCorrect,
    cardsDueToday,
    recentDeckIds,
    dueCounts,
  });
}
```

- [ ] **Step 2: Verify the endpoint still returns correct data**

Visit `http://localhost:3001/api/dashboard` while signed in. Confirm all six keys are present and `dueCounts` only includes decks with reviewed cards.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/dashboard/route.ts
git commit -m "refactor(api): remove nested await in dashboard route — sequential fetches"
```

---

## UI Designer Tasks

### Task U1: Add `dueCount` prop to `DeckCard`

**Files:**
- Modify: `src/components/deck-card.tsx`

The existing `DeckCard` already shows an `unattempted_count` badge. Add a parallel `dueCount` badge for cards due for review.

- [ ] **Step 1: Update the `DeckCard` component**

Open `src/components/deck-card.tsx`. Update the function signature and the badge area:

```tsx
export function DeckCard({
  deck,
  dueCount = 0,
}: {
  deck: DeckWithStats;
  dueCount?: number;
}) {
```

In the stats row (the `<div className="flex items-center justify-between">` around line 84), add the due badge after the "new" badge:

```tsx
<span className="flex items-center gap-2 text-xs text-muted-foreground/65">
  {deck.card_count} {deck.card_count === 1 ? "card" : "cards"}
  {deck.unattempted_count > 0 && (
    <span className="rounded-full bg-primary/14 px-1.5 py-0.5 text-[10px] font-medium text-primary">
      {deck.unattempted_count} new
    </span>
  )}
  {dueCount > 0 && (
    <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
      {dueCount} due
    </span>
  )}
</span>
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/deck-card.tsx
git commit -m "feat(ui): add dueCount badge to DeckCard"
```

---

### Task U2: Build `AppSidebar` server component

**Files:**
- Create: `src/components/app-sidebar.tsx`

This is a server component — it receives `user` as a prop (passed from `layout.tsx` which already fetches the user). It renders: logo at top, nav links in middle, user email + sign-out form at bottom.

- [ ] **Step 1: Create the sidebar component**

Create `src/components/app-sidebar.tsx`:

```tsx
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { signOut } from "@/app/auth/actions";
import type { User } from "@supabase/supabase-js";

const NAV_LINKS = [
  {
    href: "/",
    label: "Decks",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h12M6 10h12M6 14h8" />
      </svg>
    ),
  },
  {
    href: "/generate",
    label: "Generate",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
      </svg>
    ),
  },
  {
    href: "/import",
    label: "Import",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 12V4m0 8l-3-3m3 3l3-3" />
      </svg>
    ),
  },
] as const;

export function AppSidebar({ user }: { user: User }) {
  return (
    <aside className="flex h-screen w-56 flex-none flex-col border-r border-border/50 bg-card/40 px-3 py-4">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2.5 px-2 py-1 group mb-6">
        <div className="flex h-6 w-6 items-center justify-center rounded-md border border-primary/25 bg-primary/12 transition-all duration-300 group-hover:bg-primary/20 group-hover:border-primary/40 group-hover:shadow-[0_0_10px_oklch(0.77_0.195_68_/_0.20)]">
          <svg
            className="text-primary w-3.5 h-3.5 transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110"
            fill="currentColor"
            viewBox="0 0 20 20"
            aria-hidden="true"
          >
            <path d="M10 1.5C10 1.5 10.9 7.2 13.8 9.5C16.4 11.6 20 11 20 11C20 11 16.4 10.4 13.8 12.5C10.9 14.8 10 20 10 20C10 20 9.1 14.8 6.2 12.5C3.6 10.4 0 11 0 11C0 11 3.6 11.6 6.2 9.5C9.1 7.2 10 1.5 10 1.5Z" />
          </svg>
        </div>
        <span className="font-heading text-sm font-bold tracking-tight text-foreground">Trove</span>
      </Link>

      {/* Nav */}
      <nav className="flex flex-col gap-0.5 flex-1">
        {NAV_LINKS.map(({ href, label, icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground/80 transition-all duration-150 hover:bg-muted/40 hover:text-foreground"
          >
            {icon}
            {label}
          </Link>
        ))}
      </nav>

      {/* User info + sign out */}
      <div className="border-t border-border/40 pt-3 mt-3">
        <p className="truncate px-3 text-[11px] text-muted-foreground/50 mb-2">{user.email}</p>
        <form action={signOut}>
          <button
            type="submit"
            className={buttonVariants({ variant: "outline", size: "sm" }) + " w-full text-xs"}
          >
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/app-sidebar.tsx
git commit -m "feat(ui): add AppSidebar server component"
```

---

### Task U3: Rework `layout.tsx` — two-column authenticated shell

**Files:**
- Modify: `src/app/layout.tsx`

When the user is authenticated, render a full-height two-column layout: `AppSidebar` on the left (fixed-width, full-height) and a scrollable main on the right. When unauthenticated, keep a minimal centered top bar (just the logo + Sign in button) so the login page looks right.

- [ ] **Step 1: Replace `layout.tsx` body**

Open `src/app/layout.tsx`. Replace the entire `RootLayout` return with:

```tsx
import type { Metadata } from "next";
import { DM_Sans, Syne } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { AppSidebar } from "@/components/app-sidebar";

const dmSans = DM_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "700"],
});

const syne = Syne({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Trove",
  description: "AI-powered study decks from your notes",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html lang="en" className={`${dmSans.variable} ${syne.variable} h-full antialiased dark`}>
      <body className="h-full bg-background text-foreground">
        {user ? (
          <div className="flex h-full">
            <AppSidebar user={user} />
            <main className="flex-1 overflow-y-auto">{children}</main>
          </div>
        ) : (
          <div className="flex min-h-full flex-col">
            <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl">
              <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-border/80 to-transparent" />
              <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
                <Link href="/" className="flex items-center gap-2.5 group">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md border border-primary/25 bg-primary/12 transition-all duration-300 group-hover:bg-primary/20 group-hover:border-primary/40">
                    <svg
                      className="text-primary w-3.5 h-3.5"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                      aria-hidden="true"
                    >
                      <path d="M10 1.5C10 1.5 10.9 7.2 13.8 9.5C16.4 11.6 20 11 20 11C20 11 16.4 10.4 13.8 12.5C10.9 14.8 10 20 10 20C10 20 9.1 14.8 6.2 12.5C3.6 10.4 0 11 0 11C0 11 3.6 11.6 6.2 9.5C9.1 7.2 10 1.5 10 1.5Z" />
                    </svg>
                  </div>
                  <span className="font-heading text-sm font-bold tracking-tight text-foreground">Trove</span>
                </Link>
                <Link href="/auth/login" className={buttonVariants({ variant: "outline", size: "sm" })}>
                  Sign in
                </Link>
              </div>
            </header>
            <main className="flex-1">{children}</main>
          </div>
        )}
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Verify the layout renders**

Visit `http://localhost:3001` while signed in — you should see the sidebar on the left. Visit while signed out — you should see the minimal top header.

- [ ] **Step 3: Verify no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat(ui): replace top nav with two-column sidebar layout for auth'd users"
```

---

### Task U4: Rework `page.tsx` — stats banner + three content sections

**Files:**
- Modify: `src/app/page.tsx`

The dashboard page now:
1. Fetches `/api/decks` and `/api/dashboard` in parallel
2. Renders a stats banner (total cards, overall accuracy %, cards due today)
3. Renders "Continue studying" — up to 3 deck cards from `recentDeckIds` (only if the user has any sessions)
4. Renders "Due today" — deck cards for decks where `dueCounts[deck.id] > 0` (only if any decks are due)
5. Renders "All decks" — the full grid (existing behaviour)

**Type definitions to add at top of file:**

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

- [ ] **Step 1: Replace `page.tsx` with the new implementation**

Open `src/app/page.tsx` and replace the entire file:

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { DeckCard, type DeckWithStats } from "@/components/deck-card";

type DashboardStats = {
  totalCards: number;
  totalSeen: number;
  totalCorrect: number;
  cardsDueToday: number;
  recentDeckIds: string[];
  dueCounts: Record<string, number>;
};

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

function SectionHeading({ title }: { title: string }) {
  return (
    <h2 className="font-heading mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
      {title}
    </h2>
  );
}

export default function HomePage() {
  const [decks, setDecks] = useState<DeckWithStats[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAll() {
      const [decksRes, statsRes] = await Promise.all([
        fetch("/api/decks"),
        fetch("/api/dashboard"),
      ]);

      if (!decksRes.ok) {
        const { error } = await decksRes.json();
        setError(error ?? "Failed to load decks");
        setLoading(false);
        return;
      }
      if (!statsRes.ok) {
        const { error } = await statsRes.json();
        setError(error ?? "Failed to load dashboard stats");
        setLoading(false);
        return;
      }

      const [decksData, statsData] = await Promise.all([
        decksRes.json() as Promise<DeckWithStats[]>,
        statsRes.json() as Promise<DashboardStats>,
      ]);

      setDecks(decksData);
      setStats(statsData);
      setLoading(false);
    }

    fetchAll();
  }, []);

  // Derived data (only computed when not loading)
  const deckMap = new Map(decks.map((d) => [d.id, d]));

  const recentDecks =
    stats?.recentDeckIds
      .map((id) => deckMap.get(id))
      .filter((d): d is DeckWithStats => d !== undefined)
      .slice(0, 3) ?? [];

  const dueDecks = stats
    ? decks.filter((d) => (stats.dueCounts[d.id] ?? 0) > 0)
    : [];

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      {/* Page header */}
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">
            Dashboard
          </h1>
          {!loading && !error && decks.length > 0 && (
            <p className="mt-1.5 text-sm text-muted-foreground/70">
              {decks.length} {decks.length === 1 ? "deck" : "decks"}
            </p>
          )}
        </div>
        {!loading && !error && decks.length > 0 && (
          <Link href="/import" className={buttonVariants({ size: "sm" })}>
            Import notes
          </Link>
        )}
      </div>

      {/* Loading skeletons */}
      {loading && (
        <div className="space-y-8">
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 rounded-xl border border-border/40 bg-card/60 animate-pulse" />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-40 rounded-2xl border border-border/40 bg-card/60 animate-pulse"
                style={{ animationDelay: `${i * 60}ms` }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3">
          <p className="text-sm text-destructive">Failed to load: {error}</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && decks.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/50 py-28 text-center">
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-primary/25 bg-primary/10">
            <svg
              className="h-5 w-5 text-primary"
              fill="currentColor"
              viewBox="0 0 20 20"
              aria-hidden="true"
            >
              <path d="M10 1.5C10 1.5 10.9 7.2 13.8 9.5C16.4 11.6 20 11 20 11C20 11 16.4 10.4 13.8 12.5C10.9 14.8 10 20 10 20C10 20 9.1 14.8 6.2 12.5C3.6 10.4 0 11 0 11C0 11 3.6 11.6 6.2 9.5C9.1 7.2 10 1.5 10 1.5Z" />
            </svg>
          </div>
          <h2 className="font-heading text-base font-semibold text-foreground">No decks yet</h2>
          <p className="mt-2 max-w-xs text-sm text-muted-foreground/70">
            Import your Markdown notes to generate AI-powered study decks.
          </p>
          <Link href="/import" className={buttonVariants({ size: "sm" }) + " mt-6"}>
            Import notes
          </Link>
        </div>
      )}

      {/* Main content — only when loaded with data */}
      {!loading && !error && decks.length > 0 && stats && (
        <div className="space-y-10">
          {/* Stats banner */}
          <StatBanner stats={stats} />

          {/* Continue studying */}
          {recentDecks.length > 0 && (
            <section>
              <SectionHeading title="Continue studying" />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {recentDecks.map((deck, i) => (
                  <div key={deck.id} className="animate-card-in" style={{ animationDelay: `${i * 50}ms` }}>
                    <DeckCard deck={deck} dueCount={stats.dueCounts[deck.id] ?? 0} />
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Due today */}
          {dueDecks.length > 0 && (
            <section>
              <SectionHeading title="Due today" />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {dueDecks.map((deck, i) => (
                  <div key={deck.id} className="animate-card-in" style={{ animationDelay: `${i * 50}ms` }}>
                    <DeckCard deck={deck} dueCount={stats.dueCounts[deck.id] ?? 0} />
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* All decks */}
          <section>
            <SectionHeading title="All decks" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {decks.map((deck, i) => (
                <div key={deck.id} className="animate-card-in" style={{ animationDelay: `${i * 50}ms` }}>
                  <DeckCard deck={deck} dueCount={stats.dueCounts[deck.id] ?? 0} />
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify the page renders correctly**

Visit `http://localhost:3001`. Confirm:
- Stats banner shows three tiles (Total cards, Accuracy, Due today)
- "Continue studying" section only appears after you have completed at least one study session
- "Due today" section only appears if any cards are past their `next_review_at`
- "All decks" always shows the full grid
- Loading skeletons appear during fetch
- Empty state shows when user has no decks

- [ ] **Step 3: Verify no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(ui): dashboard — stats banner, continue studying, due today, all decks sections"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] Persistent left sidebar with nav links (Decks, Generate, Import) — Task U2, U3
- [x] User info at bottom of sidebar — Task U2
- [x] Stats banner: total cards, overall accuracy, cards due today — Task U4 `StatBanner`
- [x] "Continue studying" section (recently studied decks, up to 3) — Task U4, data from `recentDeckIds`
- [x] "Due today" section (decks with due cards) — Task U4, data from `dueCounts`
- [x] "All decks" full grid — Task U4
- [x] Due count badge on deck cards — Task U1
- [x] New API endpoint for sessions + due counts — Tasks E1 + E2
- [x] Unauthenticated layout unchanged — Task U3 (minimal header fallback)

**Placeholder scan:** No TBD, TODO, or vague steps found.

**Type consistency:**
- `DeckWithStats` — imported from `@/components/deck-card`, used in both `page.tsx` and `deck-card.tsx`. Consistent.
- `DashboardStats` — defined locally in `page.tsx`, returned by `/api/dashboard`. Keys match exactly: `totalCards`, `totalSeen`, `totalCorrect`, `cardsDueToday`, `recentDeckIds`, `dueCounts`.
- `dueCount` prop on `DeckCard` — defined in Task U1, consumed in Tasks U4. Named consistently.
- `dueCounts[deck.id]` — `deck.id` is `string`, `dueCounts` is `Record<string, number>`. Consistent.
