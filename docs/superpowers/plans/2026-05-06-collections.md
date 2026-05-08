# Collections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the cluttered flat deck grid on the dashboard with smart sections (Jump Back In, Needs More Practice, Recently Added), and build a dedicated Collections page for organizing and browsing all decks.

**Architecture:** Add a `getDecksByCollection` service + `GET /api/collections/[id]` endpoint. Strip the deck grid from `src/app/page.tsx` and replace with curated smart sections. Build `/collections`, `/collections/all`, and `/collections/[id]` pages. Add Collections to the sidebar nav.

**Tech Stack:** Next.js App Router, Supabase, Tailwind v4, existing `DeckCard` + `CollectionPopover` components.

---

## File Map

**Create:**
- `src/app/collections/page.tsx` — browse all collections + create/rename/delete
- `src/app/collections/all/page.tsx` — flat all-decks view (replaces old dashboard grid)
- `src/app/collections/[id]/page.tsx` — deck grid scoped to one collection

**Modify:**
- `src/lib/services/decks.ts` — add `getDecksByCollection(collectionId, userId)`
- `src/app/api/collections/[id]/route.ts` — add `GET` handler
- `src/app/page.tsx` — remove deck grid, add smart sections
- `src/components/app-sidebar.tsx` — add Collections nav link

---

## Task 1: Add `getDecksByCollection` to decks service + GET collection endpoint

**Files:**
- Modify: `src/lib/services/decks.ts`
- Modify: `src/app/api/collections/[id]/route.ts`

- [ ] **Step 1: Add `getDecksByCollection` to `src/lib/services/decks.ts`**

Add after the existing `getDeckById` function:

```ts
export async function getDecksByCollection(
  collectionId: string,
  userId: string
): Promise<DeckWithStats[]> {
  const supabase = await createClient();

  const { data: membership, error: membershipError } = await supabase
    .from("collection_decks")
    .select("deck_id")
    .eq("collection_id", collectionId);

  if (membershipError) throw new Error(membershipError.message);

  const deckIds = (membership ?? []).map((m) => m.deck_id);
  if (deckIds.length === 0) return [];

  const { data, error } = await supabase
    .from("decks")
    .select("*, cards(times_seen, times_correct)")
    .eq("user_id", userId)
    .in("id", deckIds)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((deck) => {
    const cards = (deck.cards ?? []) as Pick<Card, "times_seen" | "times_correct">[];
    const totalSeen = cards.reduce((s, c) => s + c.times_seen, 0);
    const totalCorrect = cards.reduce((s, c) => s + c.times_correct, 0);
    const unattemptedCount = cards.filter((c) => c.times_seen === 0).length;
    const { cards: _, ...deckBase } = deck;
    return {
      ...deckBase,
      total_seen: totalSeen,
      total_correct: totalCorrect,
      unattempted_count: unattemptedCount,
    } as DeckWithStats;
  });
}
```

- [ ] **Step 2: Add `GET` handler to `src/app/api/collections/[id]/route.ts`**

Add before the existing `PATCH` export:

```ts
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { data: collection, error: colError } = await supabase
    .from("collections")
    .select("id, name, is_public, created_at")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (colError || !collection)
    return Response.json({ error: "Not found" }, { status: 404 });

  try {
    const { getDecksByCollection } = await import("@/lib/services/decks");
    const decks = await getDecksByCollection(id, user.id);
    return Response.json({ collection, decks });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
```

Also add the missing import at the top of the file (it already imports `NextRequest` and `createClient` — confirm both are present):

```ts
import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";
```

- [ ] **Step 3: Verify dev server compiles without errors**

```bash
cd /Users/chelseygowac/ai-quiz-app && npm run dev 2>&1 | head -30
```

Expected: no TypeScript errors on the new code.

- [ ] **Step 4: Commit**

```bash
git add src/lib/services/decks.ts "src/app/api/collections/[id]/route.ts"
git commit -m "feat(api): add getDecksByCollection service + GET /api/collections/[id]"
```

---

## Task 2: Add Collections to sidebar nav

**Files:**
- Modify: `src/components/app-sidebar.tsx`

- [ ] **Step 1: Update `NAV_LINKS` in `src/components/app-sidebar.tsx`**

Replace the existing `NAV_LINKS` array (lines 12–58) with:

```ts
const NAV_LINKS = [
  {
    href: "/",
    label: "Dashboard",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    href: "/collections",
    label: "Collections",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v8.25" />
      </svg>
    ),
  },
  {
    href: "/create",
    label: "Create",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
      </svg>
    ),
  },
  {
    href: "/stats",
    label: "Stats",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.5V19a1 1 0 001 1h3a1 1 0 001-1v-5.5M9 8.5V19a1 1 0 001 1h3a1 1 0 001-1V8.5M15 11V19a1 1 0 001 1h3a1 1 0 001-1v-8" />
      </svg>
    ),
  },
  {
    href: "/community",
    label: "Community",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
      </svg>
    ),
  },
  {
    href: "/profile",
    label: "Profile",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
      </svg>
    ),
  },
] as const;
```

Also update the active-check logic — the Collections link must not match `/` so change the `isActive` check to handle `/collections` properly. The existing check `href === "/" ? pathname === href : pathname.startsWith(href)` already handles this correctly since `/collections` is not `/`.

- [ ] **Step 2: Verify nav renders with Collections link between Dashboard and Create**

Open `http://localhost:3000` and confirm the sidebar shows: Dashboard, Collections, Create, Stats, Community, Profile.

- [ ] **Step 3: Commit**

```bash
git add src/components/app-sidebar.tsx
git commit -m "feat(nav): add Collections link to sidebar, rename Decks → Dashboard"
```

---

## Task 3: Strip deck grid from Dashboard, add smart sections

**Files:**
- Modify: `src/app/page.tsx`

The dashboard currently fetches `/api/decks` and `/api/dashboard`. Keep both fetches — the deck data powers the smart sections. Remove the flat deck grid, sort controls, and select/delete mode entirely. Add "Needs More Practice" and "Recently Added" sections.

- [ ] **Step 1: Replace `src/app/page.tsx` with the updated version**

```tsx
"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { buttonVariants, Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DeckCard, type DeckWithStats } from "@/components/deck-card";
import { CollectionPopover } from "@/components/collection-popover";
import { useRouter } from "next/navigation";

type DashboardStats = {
  totalCards: number;
  totalSeen: number;
  totalCorrect: number;
  freshCards: number;
  recentDeckIds: string[];
  streakDays: number;
  streakStatus: "active" | "at_risk" | "none";
};

function FlameIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
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
    <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
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
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground/55">Fresh</p>
        <p className="font-heading mt-1 text-2xl font-bold tabular-nums text-foreground">
          {stats.freshCards}
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

function JumpBackInCard({ deck }: { deck: DeckWithStats }) {
  return (
    <Link href={`/decks/${deck.id}`} className="block group mb-8">
      <div
        className="relative overflow-hidden rounded-2xl border bg-card transition-all duration-300 hover:-translate-y-0.5"
        style={{
          borderColor: "color-mix(in oklch, var(--dashboard-accent-teal) 45%, transparent)",
          boxShadow: "0 0 0 0 transparent",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.boxShadow =
            "0 16px 40px -12px color-mix(in oklch, var(--dashboard-accent-teal) 24%, transparent)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.boxShadow = "0 0 0 0 transparent";
        }}
      >
        <div
          className="absolute inset-x-0 top-0 h-px opacity-80 group-hover:opacity-100 transition-all duration-300"
          style={{
            backgroundImage:
              "linear-gradient(to right, transparent, color-mix(in oklch, var(--dashboard-accent-teal) 85%, transparent), transparent)",
          }}
        />
        <div className="flex items-center gap-5 px-6 py-5">
          <div
            className="flex h-10 w-10 flex-none items-center justify-center rounded-xl border transition-all duration-300 group-hover:scale-105"
            style={{
              borderColor: "color-mix(in oklch, var(--dashboard-accent-teal) 40%, transparent)",
              background: "color-mix(in oklch, var(--dashboard-accent-teal) 14%, transparent)",
            }}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} style={{ color: "var(--dashboard-accent-teal-strong)" }} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p
              className="font-heading text-[10px] font-semibold uppercase tracking-[0.15em] mb-0.5"
              style={{ color: "color-mix(in oklch, var(--dashboard-accent-teal-strong) 82%, var(--foreground) 18%)" }}
            >
              Jump back in
            </p>
            <h3 className="font-heading text-sm font-semibold text-foreground truncate">{deck.title}</h3>
            {deck.topic_tags.length > 0 && (
              <p className="mt-0.5 text-xs text-muted-foreground/55 truncate">
                {deck.topic_tags.slice(0, 3).join(" · ")}
              </p>
            )}
          </div>
          <svg className="h-4 w-4 text-muted-foreground/40 transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-muted-foreground/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </div>
      </div>
    </Link>
  );
}

function NewDeckDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (deckId: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTitle("");
      setErr(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setErr(null);
    const res = await fetch("/api/decks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim() }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json();
      setErr(data.error ?? "Failed to create deck");
      return;
    }
    const deck = await res.json();
    onCreated(deck.id);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-heading text-base font-semibold">New deck</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="mt-3 space-y-4">
          <input
            ref={inputRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Deck title"
            className="w-full rounded-xl border border-border bg-muted/30 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          {err && <p className="text-xs text-destructive">{err}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
            <Button type="submit" size="sm" disabled={!title.trim() || saving}>
              {saving ? "Creating…" : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeckSection({
  title,
  decks,
  seeAllHref,
  emptyMessage,
}: {
  title: string;
  decks: DeckWithStats[];
  seeAllHref?: string;
  emptyMessage?: string;
}) {
  if (decks.length === 0 && !emptyMessage) return null;
  return (
    <div className="mb-10">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground/60">
          {title}
        </p>
        {seeAllHref && decks.length > 0 && (
          <Link
            href={seeAllHref}
            className="text-[10px] font-medium transition-colors hover:text-foreground"
            style={{ color: "var(--dashboard-accent-teal-strong)" }}
          >
            See all →
          </Link>
        )}
      </div>
      {decks.length === 0 ? (
        <p className="text-sm text-muted-foreground/50">{emptyMessage}</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {decks.map((deck, i) => (
            <div key={deck.id} className="animate-card-in h-full" style={{ animationDelay: `${i * 50}ms` }}>
              <DeckCard
                deck={deck}
                topAction={<CollectionPopover deckId={deck.id} />}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();
  const [decks, setDecks] = useState<DeckWithStats[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNewDeck, setShowNewDeck] = useState(false);

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

  const jumpDeck =
    stats && decks.length > 0
      ? (stats.recentDeckIds
          .map((id) => decks.find((d) => d.id === id))
          .find((d): d is DeckWithStats => d !== undefined) ?? null)
      : null;

  const needsPracticeDecks = decks
    .filter((d) => d.total_seen > 0 && d.total_correct / d.total_seen < 0.7)
    .sort((a, b) => a.total_correct / a.total_seen - b.total_correct / b.total_seen)
    .slice(0, 6);

  const recentlyAddedDecks = [...decks]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 6);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      {/* Page header */}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">
            Dashboard
          </h1>
        </div>
        {!loading && !error && (
          <div className="flex flex-wrap items-center gap-2">
            {decks.length > 0 && (
              <>
                <Link
                  href="/quiz/quick"
                  className="inline-flex items-center justify-center rounded-md border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted/40 hover:text-foreground"
                  style={{
                    borderColor: "color-mix(in oklch, var(--dashboard-accent-teal) 50%, transparent)",
                    color: "var(--dashboard-accent-teal-strong)",
                  }}
                >
                  Quick Quiz
                </Link>
                <Link
                  href="/import"
                  className="inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium transition-colors hover:opacity-90"
                  style={{
                    background: "var(--dashboard-accent-amber)",
                    color: "var(--dashboard-accent-ink)",
                  }}
                >
                  Import
                </Link>
              </>
            )}
            <button
              onClick={() => setShowNewDeck(true)}
              className="inline-flex items-center justify-center rounded-md border px-3 py-2 text-sm font-medium transition-colors hover:bg-primary/10 hover:text-primary"
              style={{
                borderColor: "color-mix(in oklch, var(--dashboard-accent-rose) 52%, transparent)",
                color: "var(--dashboard-accent-rose)",
              }}
            >
              + New deck
            </button>
          </div>
        )}
      </div>

      {/* Loading skeletons */}
      {loading && (
        <div className="space-y-8">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 rounded-xl border border-border/40 bg-card/60 animate-pulse" />
            ))}
          </div>
          <div className="h-20 rounded-2xl border border-border/40 bg-card/60 animate-pulse" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-40 rounded-2xl border border-border/40 bg-card/60 animate-pulse" style={{ animationDelay: `${i * 60}ms` }} />
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
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/50 py-28 text-center animate-fade-up">
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 shadow-[0_0_24px_oklch(0.77_0.195_68_/_0.10)]">
            <svg className="h-6 w-6 text-primary" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path d="M10 1.5C10 1.5 10.9 7.2 13.8 9.5C16.4 11.6 20 11 20 11C20 11 16.4 10.4 13.8 12.5C10.9 14.8 10 20 10 20C10 20 9.1 14.8 6.2 12.5C3.6 10.4 0 11 0 11C0 11 3.6 11.6 6.2 9.5C9.1 7.2 10 1.5 10 1.5Z" />
            </svg>
          </div>
          <h2 className="font-heading text-xl font-bold tracking-tight text-foreground">
            Start learning something new
          </h2>
          <p className="mt-2.5 max-w-sm text-sm text-muted-foreground/70">
            Generate flashcards from a topic, paste your notes, or import a Markdown file.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <button onClick={() => setShowNewDeck(true)} className={buttonVariants({ size: "sm" })}>
              + New deck
            </button>
            <Link href="/generate" className={buttonVariants({ variant: "outline", size: "sm" })}>
              Generate from topic
            </Link>
            <Link href="/notes" className={buttonVariants({ variant: "outline", size: "sm" })}>
              Paste notes
            </Link>
            <Link href="/import" className={buttonVariants({ variant: "outline", size: "sm" })}>
              Import file
            </Link>
          </div>
        </div>
      )}

      <NewDeckDialog
        open={showNewDeck}
        onClose={() => setShowNewDeck(false)}
        onCreated={(id) => {
          setShowNewDeck(false);
          router.push(`/decks/${id}`);
        }}
      />

      {/* Main content — only when loaded with data */}
      {!loading && !error && decks.length > 0 && stats && (
        <div>
          <StatBanner stats={stats} />

          {jumpDeck && <JumpBackInCard deck={jumpDeck} />}

          <DeckSection
            title="Needs more practice"
            decks={needsPracticeDecks}
            seeAllHref="/collections/all"
          />

          <DeckSection
            title="Recently added"
            decks={recentlyAddedDecks}
            seeAllHref="/collections/all"
          />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify in browser — dashboard shows stat banner, jump back in, smart sections (no flat deck grid)**

Open `http://localhost:3000`. Confirm the flat "Your decks" grid is gone and replaced with smart sections.

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(dashboard): replace flat deck grid with smart sections (needs practice, recently added)"
```

---

## Task 4: Collections browse page

**Files:**
- Create: `src/app/collections/page.tsx`

- [ ] **Step 1: Create `src/app/collections/page.tsx`**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type CollectionMeta = {
  id: string;
  name: string;
  is_public: boolean;
  created_at: string;
  deck_count: number;
};

function FolderIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v8.25" />
    </svg>
  );
}

export default function CollectionsPage() {
  const router = useRouter();
  const [collections, setCollections] = useState<CollectionMeta[]>([]);
  const [totalDecks, setTotalDecks] = useState(0);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function load() {
      const [colRes, deckRes] = await Promise.all([
        fetch("/api/collections"),
        fetch("/api/decks"),
      ]);
      if (colRes.ok) {
        const { collections } = await colRes.json();
        setCollections(collections);
      }
      if (deckRes.ok) {
        const decks = await deckRes.json();
        setTotalDecks(decks.length);
      }
      setLoading(false);
    }
    load();
  }, []);

  useEffect(() => {
    if (!menuOpenId) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenId(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpenId]);

  async function handleCreate(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    const name = newName.trim();
    if (!name || creating) return;
    setCreating(true);
    const res = await fetch("/api/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      const col = await res.json();
      setCollections((prev) => [
        ...prev,
        { id: col.id, name: col.name, is_public: col.is_public, created_at: col.created_at, deck_count: 0 },
      ]);
      setNewName("");
    }
    setCreating(false);
  }

  async function handleRename(id: string) {
    const name = renameValue.trim();
    setRenamingId(null);
    if (!name) return;
    await fetch(`/api/collections/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setCollections((prev) => prev.map((c) => (c.id === id ? { ...c, name } : c)));
  }

  async function handleDelete(id: string) {
    await fetch(`/api/collections/${id}`, { method: "DELETE" });
    setCollections((prev) => prev.filter((c) => c.id !== id));
    setDeletingId(null);
    setMenuOpenId(null);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10 animate-fade-up">
      <div className="mb-8">
        <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">
          Collections
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground/70">
          Organize your decks into groups
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 rounded-2xl border border-border/40 bg-card/60 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* All Decks — always pinned first */}
          <Link href="/collections/all" className="group block h-full">
            <div
              className="dashboard-card-hover h-full rounded-2xl border border-border/50 bg-card p-5"
            >
              <div
                className="flex h-9 w-9 items-center justify-center rounded-xl border"
                style={{
                  borderColor: "color-mix(in oklch, var(--dashboard-accent-teal) 40%, transparent)",
                  background: "color-mix(in oklch, var(--dashboard-accent-teal) 12%, transparent)",
                }}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} style={{ color: "var(--dashboard-accent-teal-strong)" }} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                </svg>
              </div>
              <h3 className="font-heading mt-3 text-base font-bold text-foreground">All Decks</h3>
              <p className="mt-1 text-sm text-muted-foreground/60">
                {totalDecks} {totalDecks === 1 ? "deck" : "decks"}
              </p>
            </div>
          </Link>

          {/* User collections */}
          {collections.map((col) => (
            <div key={col.id} className="group relative h-full">
              {renamingId === col.id ? (
                <div className="h-full rounded-2xl border border-primary/40 bg-card p-5">
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => handleRename(col.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRename(col.id);
                      if (e.key === "Escape") setRenamingId(null);
                    }}
                    className="w-full bg-transparent font-heading text-base font-bold text-foreground focus:outline-none"
                  />
                  <p className="mt-1 text-sm text-muted-foreground/60">
                    {col.deck_count} {col.deck_count === 1 ? "deck" : "decks"}
                  </p>
                </div>
              ) : deletingId === col.id ? (
                <div className="h-full rounded-2xl border border-destructive/30 bg-card p-5">
                  <p className="text-sm font-medium text-foreground">{col.name}</p>
                  <p className="mt-2 text-xs text-muted-foreground/70">Delete this collection? Decks are not deleted.</p>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => handleDelete(col.id)}
                      className="rounded-md px-2.5 py-1 text-xs font-medium transition-colors"
                      style={{
                        background: "oklch(0.55 0.2 27 / 0.12)",
                        border: "1px solid oklch(0.55 0.2 27 / 0.4)",
                        color: "oklch(0.75 0.18 27)",
                      }}
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => setDeletingId(null)}
                      className="rounded-md border px-2.5 py-1 text-xs font-medium text-muted-foreground/70 transition-colors hover:text-foreground"
                      style={{ border: "1px solid oklch(0.5 0.01 65 / 0.3)" }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <Link href={`/collections/${col.id}`} className="block h-full">
                    <div className="dashboard-card-hover h-full rounded-2xl border border-border/50 bg-card p-5">
                      <div
                        className="flex h-9 w-9 items-center justify-center rounded-xl border"
                        style={{
                          borderColor: "color-mix(in oklch, var(--dashboard-accent-coral) 40%, transparent)",
                          background: "color-mix(in oklch, var(--dashboard-accent-coral) 10%, transparent)",
                        }}
                      >
                        <FolderIcon
                          className="h-4 w-4"
                          style={{ color: "var(--dashboard-accent-coral)" } as React.CSSProperties}
                        />
                      </div>
                      <h3 className="font-heading mt-3 text-base font-bold text-foreground pr-6">
                        {col.name}
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground/60">
                        {col.deck_count} {col.deck_count === 1 ? "deck" : "decks"}
                      </p>
                    </div>
                  </Link>
                  {/* ··· menu */}
                  <div className="absolute right-3 top-3 z-10" ref={menuOpenId === col.id ? menuRef : null}>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setMenuOpenId(menuOpenId === col.id ? null : col.id);
                      }}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground/40 opacity-0 transition-all group-hover:opacity-100 hover:bg-muted/40 hover:text-foreground"
                    >
                      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                        <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z" />
                      </svg>
                    </button>
                    {menuOpenId === col.id && (
                      <div className="absolute right-0 top-full mt-1 w-36 rounded-xl border border-border bg-card shadow-xl z-50">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setRenamingId(col.id);
                            setRenameValue(col.name);
                            setMenuOpenId(null);
                          }}
                          className="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-muted/40 rounded-t-xl"
                        >
                          Rename
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletingId(col.id);
                            setMenuOpenId(null);
                          }}
                          className="w-full px-3 py-2 text-left text-sm rounded-b-xl"
                          style={{ color: "var(--destructive)" }}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}

          {/* New collection input card */}
          <div className="rounded-2xl border border-dashed border-border/50 bg-card/40 p-5">
            <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground/50">
              New collection
            </p>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={handleCreate}
              disabled={creating}
              placeholder="Name and press Enter…"
              className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none disabled:opacity-50"
            />
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Navigate to `http://localhost:3000/collections`**

Verify: All Decks card, any existing collections, and the "New collection" input card all render. Creating a collection by typing a name and pressing Enter adds it to the grid.

- [ ] **Step 3: Commit**

```bash
git add src/app/collections/page.tsx
git commit -m "feat(collections): add /collections browse page with create/rename/delete"
```

---

## Task 5: All Decks page (`/collections/all`)

**Files:**
- Create: `src/app/collections/all/page.tsx`

This is the relocated flat deck grid that was removed from the dashboard. It includes sort controls and select/delete mode.

- [ ] **Step 1: Create `src/app/collections/all/page.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DeckCard, type DeckWithStats } from "@/components/deck-card";
import { CollectionPopover } from "@/components/collection-popover";
import { Button } from "@/components/ui/button";

type SortMode = "alpha" | "created" | "studied" | "size";

const SORT_LABELS: Record<SortMode, string> = {
  alpha: "A → Z",
  created: "Newest",
  studied: "Last studied",
  size: "Most cards",
};

type DashboardStats = {
  recentDeckIds: string[];
};

export default function AllDecksPage() {
  const [decks, setDecks] = useState<DeckWithStats[]>([]);
  const [recentDeckIds, setRecentDeckIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("studied");

  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("deck-sort") as SortMode | null;
    if (saved && saved in SORT_LABELS) setSortMode(saved);
  }, []);

  function handleSortChange(mode: SortMode) {
    setSortMode(mode);
    localStorage.setItem("deck-sort", mode);
  }

  useEffect(() => {
    async function load() {
      const [decksRes, statsRes] = await Promise.all([
        fetch("/api/decks"),
        fetch("/api/dashboard"),
      ]);
      if (!decksRes.ok) {
        setError("Failed to load decks");
        setLoading(false);
        return;
      }
      const decksData = await decksRes.json() as DeckWithStats[];
      setDecks(decksData);
      if (statsRes.ok) {
        const statsData = await statsRes.json() as DashboardStats;
        setRecentDeckIds(statsData.recentDeckIds ?? []);
      }
      setLoading(false);
    }
    load();
  }, []);

  function toggleSelectMode() {
    setSelectMode((v) => !v);
    setSelectedIds(new Set());
    setConfirmDelete(false);
  }

  function toggleDeck(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleDeleteSelected() {
    if (selectedIds.size === 0) return;
    setDeleting(true);
    const ids = Array.from(selectedIds);
    await Promise.all(ids.map((id) => fetch(`/api/decks/${id}`, { method: "DELETE" }).catch(() => null)));
    setDecks((prev) => prev.filter((d) => !selectedIds.has(d.id)));
    setSelectedIds(new Set());
    setSelectMode(false);
    setConfirmDelete(false);
    setDeleting(false);
  }

  const sortedDecks = (() => {
    const copy = [...decks];
    if (sortMode === "alpha") return copy.sort((a, b) => a.title.localeCompare(b.title));
    if (sortMode === "created") return copy.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    if (sortMode === "size") return copy.sort((a, b) => b.card_count - a.card_count);
    const recentIndex = Object.fromEntries(recentDeckIds.map((id, i) => [id, i]));
    return copy.sort((a, b) => {
      const ai = recentIndex[a.id] ?? Infinity;
      const bi = recentIndex[b.id] ?? Infinity;
      return ai !== bi ? ai - bi : new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  })();

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10 animate-fade-up">
      <button
        onClick={() => history.back()}
        className="mb-8 flex items-center gap-1.5 text-xs text-muted-foreground/60 transition-colors hover:text-foreground"
      >
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Collections
      </button>

      <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">All Decks</h1>
          {!loading && !error && (
            <p className="mt-1.5 text-sm text-muted-foreground/70">
              {decks.length} {decks.length === 1 ? "deck" : "decks"}
            </p>
          )}
        </div>
      </div>

      {loading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-40 rounded-2xl border border-border/40 bg-card/60 animate-pulse" style={{ animationDelay: `${i * 60}ms` }} />
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground/60 shrink-0">
              Your decks
            </p>
            <div className="flex items-center gap-2">
              {!selectMode && (
                <div className="relative">
                  <select
                    value={sortMode}
                    onChange={(e) => handleSortChange(e.target.value as SortMode)}
                    className="appearance-none rounded-md border border-border/50 bg-card pl-2 pr-7 py-1 text-xs text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 cursor-pointer"
                  >
                    {(Object.keys(SORT_LABELS) as SortMode[]).map((m) => (
                      <option key={m} value={m}>{SORT_LABELS[m]}</option>
                    ))}
                  </select>
                  <svg className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground/70" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 8l4 4 4-4" />
                  </svg>
                </div>
              )}
              {selectMode && (
                <button
                  onClick={() => {
                    const allSelected = selectedIds.size === sortedDecks.length;
                    setSelectedIds(allSelected ? new Set() : new Set(sortedDecks.map((d) => d.id)));
                  }}
                  className="rounded-md border px-3 py-1 text-xs font-medium transition-colors hover:bg-primary/10"
                  style={{
                    borderColor: "color-mix(in oklch, var(--dashboard-accent-teal) 45%, transparent)",
                    color: "var(--dashboard-accent-teal-strong)",
                  }}
                >
                  {selectedIds.size === sortedDecks.length ? "Deselect all" : "Select all"}
                </button>
              )}
              {selectMode ? (
                <button
                  onClick={toggleSelectMode}
                  className="rounded-md border px-3 py-1 text-xs font-medium transition-colors hover:bg-muted/40"
                  style={{
                    borderColor: "color-mix(in oklch, var(--border) 80%, transparent)",
                    color: "color-mix(in oklch, var(--foreground) 62%, var(--muted-foreground) 38%)",
                  }}
                >
                  Cancel
                </button>
              ) : (
                <button
                  onClick={toggleSelectMode}
                  className="rounded-md border px-3 py-1 text-xs font-medium transition-colors hover:bg-primary/10"
                  style={{
                    borderColor: "color-mix(in oklch, var(--dashboard-accent-coral) 45%, transparent)",
                    color: "var(--dashboard-accent-coral)",
                  }}
                >
                  Select
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sortedDecks.map((deck, i) => (
              <div key={deck.id} className="animate-card-in h-full" style={{ animationDelay: `${i * 50}ms` }}>
                <DeckCard
                  deck={deck}
                  selectMode={selectMode}
                  selected={selectedIds.has(deck.id)}
                  onSelect={() => toggleDeck(deck.id)}
                  topAction={!selectMode ? <CollectionPopover deckId={deck.id} /> : undefined}
                />
              </div>
            ))}
          </div>
        </>
      )}

      {/* Floating action bar */}
      {selectMode && selectedIds.size > 0 && (
        <div className="fixed bottom-[max(2rem,env(safe-area-inset-bottom,0px)+0.5rem)] left-1/2 z-50 -translate-x-1/2 w-[calc(100%-2rem)] max-w-[420px]">
          <div className="flex items-center gap-4 rounded-2xl border border-border bg-card/95 px-5 py-3.5 shadow-xl backdrop-blur-md select-none">
            {confirmDelete ? (
              <>
                <p className="flex-1 text-sm text-muted-foreground">Are you sure? This can&apos;t be undone.</p>
                <button onClick={() => setConfirmDelete(false)} disabled={deleting} className="rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground/70 transition-colors hover:text-foreground disabled:opacity-50">
                  Cancel
                </button>
                <button
                  onClick={handleDeleteSelected}
                  disabled={deleting}
                  className="rounded-md border px-3 py-1.5 text-xs font-semibold transition-all duration-200 hover:opacity-90 disabled:opacity-50"
                  style={{ border: "1px solid color-mix(in oklch, var(--dashboard-accent-rose) 65%, transparent)", color: "var(--dashboard-accent-rose)" }}
                >
                  {deleting ? "Deleting…" : "Confirm"}
                </button>
              </>
            ) : (
              <>
                <p className="flex-1 text-sm font-medium text-muted-foreground">
                  <span className="font-heading font-semibold text-foreground">{selectedIds.size}</span>{" "}
                  {selectedIds.size === 1 ? "deck" : "decks"} selected
                </p>
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="rounded-md border px-3.5 py-1.5 text-xs font-semibold transition-all duration-200 hover:opacity-90"
                  style={{ border: "1px solid color-mix(in oklch, var(--dashboard-accent-rose) 65%, transparent)", color: "var(--dashboard-accent-rose)" }}
                >
                  Delete
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Navigate to `http://localhost:3000/collections/all`**

Verify: all decks render in a grid with sort controls and select/delete mode.

- [ ] **Step 3: Commit**

```bash
git add src/app/collections/all/page.tsx
git commit -m "feat(collections): add /collections/all page — full deck grid with sort and select"
```

---

## Task 6: Collection detail page (`/collections/[id]`)

**Files:**
- Create: `src/app/collections/[id]/page.tsx`

- [ ] **Step 1: Create `src/app/collections/[id]/page.tsx`**

```tsx
"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { DeckCard, type DeckWithStats } from "@/components/deck-card";
import { CollectionPopover } from "@/components/collection-popover";
import { Button } from "@/components/ui/button";

type Collection = {
  id: string;
  name: string;
  is_public: boolean;
  created_at: string;
};

export default function CollectionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [collection, setCollection] = useState<Collection | null>(null);
  const [decks, setDecks] = useState<DeckWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/collections/${id}`);
      if (!res.ok) {
        setError("Collection not found");
        setLoading(false);
        return;
      }
      const { collection, decks } = await res.json();
      setCollection(collection);
      setDecks(decks);
      setLoading(false);
    }
    load();
  }, [id]);

  async function handleSaveName() {
    const name = nameInput.trim();
    setEditingName(false);
    if (!name || !collection || name === collection.name) return;
    await fetch(`/api/collections/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setCollection((prev) => (prev ? { ...prev, name } : prev));
  }

  async function handleDelete() {
    await fetch(`/api/collections/${id}`, { method: "DELETE" });
    router.push("/collections");
  }

  async function handleRemoveDeck(deckId: string) {
    setRemovingId(deckId);
    await fetch(`/api/collections/${id}/decks`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deck_id: deckId }),
    });
    setDecks((prev) => prev.filter((d) => d.id !== deckId));
    setRemovingId(null);
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10 space-y-4">
        <div className="h-7 w-48 rounded-lg bg-card/80 animate-pulse" />
        <div className="h-4 w-24 rounded-lg bg-card/60 animate-pulse" />
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-40 rounded-2xl border border-border/40 bg-card/60 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !collection) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        <p className="text-sm text-destructive">{error ?? "Not found"}</p>
        <Button variant="ghost" size="sm" className="mt-4" onClick={() => router.push("/collections")}>
          ← Collections
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10 animate-fade-up">
      <button
        onClick={() => router.push("/collections")}
        className="mb-8 flex items-center gap-1.5 text-xs text-muted-foreground/60 transition-colors hover:text-foreground"
      >
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Collections
      </button>

      <div className="mb-8 flex flex-wrap items-start justify-between gap-3">
        <div>
          {editingName ? (
            <input
              autoFocus
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onBlur={handleSaveName}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); handleSaveName(); }
                if (e.key === "Escape") setEditingName(false);
              }}
              className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl w-full bg-transparent border-b-2 border-primary/50 focus:outline-none pb-0.5"
            />
          ) : (
            <div className="group flex items-center gap-2">
              <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                {collection.name}
              </h1>
              <button
                type="button"
                onClick={() => { setNameInput(collection.name); setEditingName(true); }}
                className="flex h-7 w-7 items-center justify-center rounded-lg opacity-0 transition-all group-hover:opacity-100 hover:bg-muted/40"
                title="Rename collection"
              >
                <svg className="h-3.5 w-3.5 text-muted-foreground/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                </svg>
              </button>
            </div>
          )}
          <p className="mt-1.5 text-sm text-muted-foreground/60">
            {decks.length} {decks.length === 1 ? "deck" : "decks"}
          </p>
        </div>
        <div>
          {showDeleteConfirm ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground/70">Delete collection?</span>
              <button
                onClick={handleDelete}
                className="rounded-md px-2.5 py-1 text-xs font-medium"
                style={{ background: "oklch(0.55 0.2 27 / 0.12)", border: "1px solid oklch(0.55 0.2 27 / 0.4)", color: "oklch(0.75 0.18 27)" }}
              >
                Confirm
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="rounded-md border px-2.5 py-1 text-xs font-medium text-muted-foreground/70 hover:text-foreground"
                style={{ border: "1px solid oklch(0.5 0.01 65 / 0.3)" }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="rounded-md border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-destructive/5"
              style={{
                borderColor: "color-mix(in oklch, var(--destructive) 35%, transparent)",
                color: "var(--destructive)",
              }}
            >
              Delete collection
            </button>
          )}
        </div>
      </div>

      {decks.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/50 py-20 text-center">
          <p className="text-sm font-medium text-foreground">No decks in this collection</p>
          <p className="mt-1.5 text-sm text-muted-foreground/60">
            Add decks using the folder icon on any deck card.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {decks.map((deck, i) => (
            <div key={deck.id} className="animate-card-in h-full" style={{ animationDelay: `${i * 50}ms` }}>
              <div className="relative h-full">
                <DeckCard
                  deck={deck}
                  topAction={<CollectionPopover deckId={deck.id} />}
                />
                <button
                  onClick={() => handleRemoveDeck(deck.id)}
                  disabled={removingId === deck.id}
                  className="absolute bottom-3 right-3 z-10 rounded-md border px-2 py-1 text-[10px] font-medium transition-colors hover:bg-destructive/5 disabled:opacity-40"
                  style={{
                    borderColor: "color-mix(in oklch, var(--destructive) 30%, transparent)",
                    color: "var(--destructive)",
                  }}
                >
                  {removingId === deck.id ? "Removing…" : "Remove"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Navigate to a collection**

Go to `http://localhost:3000/collections`, click a collection. Verify the deck grid renders, the title is editable inline, and Remove buttons appear on each deck card. Removing a deck removes it from the view without a page reload.

- [ ] **Step 3: Commit**

```bash
git add "src/app/collections/[id]/page.tsx"
git commit -m "feat(collections): add /collections/[id] detail page with rename, delete, remove deck"
```

---

## Task 7: Final wiring and push

- [ ] **Step 1: Check TypeScript compiles clean**

```bash
npx tsc --noEmit 2>&1 | head -40
```

Expected: no errors (or only pre-existing ones unrelated to this feature).

- [ ] **Step 2: Smoke test the full flow**

1. Open `http://localhost:3000` — Dashboard shows smart sections, no flat grid.
2. Click "Collections" in sidebar — collections page loads.
3. Create a new collection — it appears in the grid.
4. Click "All Decks" — flat deck grid with sort/select appears.
5. Go back, click a collection — detail page with its decks.
6. Remove a deck from the collection — it disappears.
7. Rename the collection via the pencil icon — name updates.
8. Delete collection — redirects to `/collections`.

- [ ] **Step 3: Push**

```bash
git push
```

---

## Self-Review

**Spec coverage:**
- ✅ Dashboard smart sections (needs practice, recently added) — Task 3
- ✅ Deck grid removed from dashboard — Task 3
- ✅ `/collections` browse page — Task 4
- ✅ "All Decks" pinned entry — Task 4
- ✅ Create/rename/delete collection — Task 4
- ✅ `/collections/all` flat view — Task 5
- ✅ `/collections/[id]` detail — Task 6
- ✅ Remove deck from collection — Task 6
- ✅ Sidebar "Collections" link — Task 2
- ✅ `GET /api/collections/[id]` — Task 1

**Placeholder scan:** All code blocks are complete. No TBDs.

**Type consistency:** `DeckWithStats` used consistently. `Collection` type defined locally in Task 6 — consistent with fields returned by `GET /api/collections/[id]`. `CollectionMeta` in Task 4 matches `/api/collections` response shape.
