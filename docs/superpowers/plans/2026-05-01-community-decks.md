# Community Decks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Public deck marketplace where users can browse, search, and fork other users' decks.

**Architecture:** `profiles` table auto-created on signup, `is_public` column on `decks`, two new API routes (`GET /api/community`, `POST /api/community/fork`), and a `/community` page. Browsing is unauthenticated; forking requires auth.

**Tech Stack:** Next.js 16 App Router, Supabase Postgres + RLS, Tailwind v4, TypeScript

---

## File Map

| Action | File |
|--------|------|
| Create | `supabase/migrations/20260501000000_community_decks.sql` |
| Modify | `src/lib/database.types.ts` |
| Create | `src/app/api/community/route.ts` |
| Create | `src/app/api/community/fork/route.ts` |
| Create | `src/app/community/page.tsx` |
| Modify | `src/app/decks/[id]/page.tsx` |
| Modify | `src/app/api/decks/[id]/route.ts` |
| Modify | `src/components/app-sidebar.tsx` |

---

### Task 1: Migration — profiles table + is_public column + RLS

**Files:**
- Create: `supabase/migrations/20260501000000_community_decks.sql`

- [ ] **Step 1: Create the migration file**

```bash
supabase migration new community_decks
```

Rename the generated file to `20260501000000_community_decks.sql` if the timestamp differs.

- [ ] **Step 2: Write the migration SQL**

```sql
-- profiles table
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "profiles_select_all" on profiles
  for select using (true);

create policy "profiles_update_own" on profiles
  for update using (auth.uid() = id);

-- auto-create profile on signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- is_public on decks
alter table decks add column if not exists is_public boolean not null default false;

-- RLS policy: anyone can read public decks
create policy "decks_select_public" on decks
  for select using (is_public = true);
```

- [ ] **Step 3: Apply the migration locally**

```bash
supabase db push
```

Expected: migration applied with no errors.

- [ ] **Step 4: Verify**

```bash
supabase db query "select column_name from information_schema.columns where table_name = 'decks' and column_name = 'is_public';"
```

Expected: one row with `is_public`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260501000000_community_decks.sql
git commit -m "feat(db): add profiles table, is_public on decks, community RLS policies"
```

---

### Task 2: Update TypeScript types

**Files:**
- Modify: `src/lib/database.types.ts`

- [ ] **Step 1: Regenerate types**

```bash
supabase gen types typescript --local > src/lib/database.types.ts
```

- [ ] **Step 2: Verify `is_public` and `profiles` appear**

```bash
grep -n "is_public\|profiles" src/lib/database.types.ts
```

Expected: `is_public` in decks Row/Insert/Update, and a `profiles` table entry.

- [ ] **Step 3: Commit**

```bash
git add src/lib/database.types.ts
git commit -m "chore: regenerate types for community decks"
```

---

### Task 3: GET /api/community — search public decks

**Files:**
- Create: `src/app/api/community/route.ts`

- [ ] **Step 1: Create the route**

```typescript
import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const supabase = await createClient();

  let query = supabase
    .from("decks")
    .select("id, title, topic_tags, card_count, created_at, user_id, profiles(display_name)")
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .limit(50);

  if (q) {
    query = query.or(`title.ilike.%${q}%,topic_tags.cs.{${q}}`);
  }

  const { data, error } = await query;

  if (error) return Response.json({ error: error.message }, { status: 500 });

  const decks = (data ?? []).map((d) => {
    const { profiles, ...deck } = d as typeof d & { profiles: { display_name: string | null } | null };
    return { ...deck, publisher_name: profiles?.display_name ?? null };
  });

  return Response.json({ decks });
}
```

- [ ] **Step 2: Test manually**

```bash
curl "http://localhost:3000/api/community?q=biology"
```

Expected: `{ decks: [...] }` (may be empty if no public decks yet).

- [ ] **Step 3: Commit**

```bash
git add src/app/api/community/route.ts
git commit -m "feat(api): add GET /api/community for searching public decks"
```

---

### Task 4: POST /api/community/fork

**Files:**
- Create: `src/app/api/community/fork/route.ts`

- [ ] **Step 1: Create the route**

```typescript
import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const deckId = typeof body.deckId === "string" ? body.deckId : null;
  if (!deckId) return Response.json({ error: "deckId is required" }, { status: 400 });

  // Verify source deck is public
  const { data: source, error: srcErr } = await supabase
    .from("decks")
    .select("id, title, topic_tags, card_count")
    .eq("id", deckId)
    .eq("is_public", true)
    .single();

  if (srcErr || !source) return Response.json({ error: "Deck not found" }, { status: 404 });

  // Copy deck
  const { data: newDeck, error: deckErr } = await supabase
    .from("decks")
    .insert({
      title: source.title,
      topic_tags: source.topic_tags,
      card_count: source.card_count,
      user_id: user.id,
      is_public: false,
    })
    .select("id")
    .single();

  if (deckErr || !newDeck) return Response.json({ error: deckErr?.message ?? "Insert failed" }, { status: 500 });

  // Copy cards
  const { data: sourceCards, error: cardsErr } = await supabase
    .from("cards")
    .select("front, back, card_type, tags")
    .eq("deck_id", deckId);

  if (cardsErr) return Response.json({ error: cardsErr.message }, { status: 500 });

  if (sourceCards && sourceCards.length > 0) {
    const { error: insertErr } = await supabase.from("cards").insert(
      sourceCards.map((c) => ({
        deck_id: newDeck.id,
        front: c.front,
        back: c.back,
        card_type: c.card_type,
        tags: c.tags ?? [],
        times_seen: 0,
        times_correct: 0,
      }))
    );
    if (insertErr) return Response.json({ error: insertErr.message }, { status: 500 });
  }

  return Response.json({ deckId: newDeck.id }, { status: 201 });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/community/fork/route.ts
git commit -m "feat(api): add POST /api/community/fork to copy a public deck"
```

---

### Task 5: PATCH /api/decks/[id] — support is_public toggle

**Files:**
- Modify: `src/app/api/decks/[id]/route.ts`

The existing PATCH only handles `title`. Extend it to also accept `is_public`.

- [ ] **Step 1: Update PATCH handler**

Replace the body parsing block (after `const body = await req.json();`) with:

```typescript
const body = await req.json();
const updates: { title?: string; is_public?: boolean } = {};

if (typeof body.title === "string") {
  const title = body.title.trim();
  if (!title) return Response.json({ error: "title cannot be empty" }, { status: 400 });
  updates.title = title;
}

if (typeof body.is_public === "boolean") {
  updates.is_public = body.is_public;
}

if (Object.keys(updates).length === 0) {
  return Response.json({ error: "No valid fields to update" }, { status: 400 });
}

const { error, count } = await supabase
  .from("decks")
  .update(updates, { count: "exact" })
  .eq("id", id)
  .eq("user_id", user.id);
```

Remove the old `const title = ...` and `if (!title) ...` lines and the original `.update({ title }, ...)` call.

- [ ] **Step 2: Commit**

```bash
git add src/app/api/decks/[id]/route.ts
git commit -m "feat(api): extend PATCH /api/decks/[id] to accept is_public toggle"
```

---

### Task 6: Publish toggle on deck detail page

**Files:**
- Modify: `src/app/decks/[id]/page.tsx`

- [ ] **Step 1: Add isPublic state and toggle handler**

After the existing state declarations near the top of the client component, add:

```typescript
const [isPublic, setIsPublic] = useState(deck.is_public ?? false);
const [togglingPublic, setTogglingPublic] = useState(false);

async function handleTogglePublic() {
  setTogglingPublic(true);
  const next = !isPublic;
  const res = await fetch(`/api/decks/${deck.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ is_public: next }),
  });
  if (res.ok) setIsPublic(next);
  setTogglingPublic(false);
}
```

- [ ] **Step 2: Add toggle UI in the deck header**

In the deck header section (near the rename/delete buttons), add:

```tsx
<button
  onClick={handleTogglePublic}
  disabled={togglingPublic}
  className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
    isPublic
      ? "border-primary/40 bg-primary/10 text-primary"
      : "border-border/50 bg-muted/30 text-muted-foreground hover:border-primary/30 hover:text-foreground"
  }`}
>
  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    {isPublic ? (
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
    ) : (
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" />
    )}
  </svg>
  {isPublic ? "Public" : "Private"}
</button>
```

- [ ] **Step 3: Ensure `deck.is_public` is included in the fetched data**

The deck row already returns all columns via `select("*")` in `getDeckById`, so `is_public` will be present after the migration. No service layer changes needed.

- [ ] **Step 4: Commit**

```bash
git add src/app/decks/[id]/page.tsx
git commit -m "feat(ui): add public/private toggle to deck detail page"
```

---

### Task 7: /community page

**Files:**
- Create: `src/app/community/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type PublicDeck = {
  id: string;
  title: string;
  topic_tags: string[];
  card_count: number;
  created_at: string;
  publisher_name: string | null;
};

export default function CommunityPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [decks, setDecks] = useState<PublicDeck[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [forkingId, setForkingId] = useState<string | null>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setSearched(true);
    const res = await fetch(`/api/community?q=${encodeURIComponent(query)}`);
    const json = await res.json();
    setDecks(json.decks ?? []);
    setLoading(false);
  }

  async function handleFork(deckId: string) {
    setForkingId(deckId);
    const res = await fetch("/api/community/fork", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deckId }),
    });
    if (res.status === 401) {
      router.push("/login");
      return;
    }
    if (res.ok) {
      const { deckId: newId } = await res.json();
      router.push(`/decks/${newId}`);
    }
    setForkingId(null);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="font-heading text-2xl font-bold text-foreground">Community Decks</h1>
      <p className="mt-1 text-sm text-muted-foreground">Search public decks and fork them to your dashboard.</p>

      <form onSubmit={handleSearch} className="mt-6 flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by topic or title…"
          className="flex-1 rounded-xl border border-border/50 bg-muted/20 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/20"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {loading ? "Searching…" : "Search"}
        </button>
      </form>

      {searched && !loading && decks.length === 0 && (
        <p className="mt-12 text-center text-sm text-muted-foreground">No public decks found for "{query}".</p>
      )}

      {decks.length > 0 && (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {decks.map((deck) => (
            <div
              key={deck.id}
              className="flex flex-col justify-between rounded-2xl border border-border/50 bg-card p-5"
            >
              <div>
                <h3 className="font-heading text-base font-bold leading-snug text-foreground line-clamp-2">
                  {deck.title}
                </h3>
                <p className="mt-1 text-[11px] text-muted-foreground/55">
                  by {deck.publisher_name ?? "Anonymous"}
                </p>
                {deck.topic_tags.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {deck.topic_tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-border/50 bg-muted/30 px-2 py-0.5 text-[10px] text-muted-foreground/65"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs text-muted-foreground/55">
                  {deck.card_count} {deck.card_count === 1 ? "card" : "cards"}
                </span>
                <button
                  onClick={() => handleFork(deck.id)}
                  disabled={forkingId === deck.id}
                  className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20 disabled:opacity-60"
                >
                  {forkingId === deck.id ? "Forking…" : "Fork"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!searched && (
        <p className="mt-16 text-center text-sm text-muted-foreground/50">
          Enter a topic above to discover public decks.
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify the page loads**

Open `http://localhost:3000/community` — should show the search bar and empty state prompt.

- [ ] **Step 3: Commit**

```bash
git add src/app/community/page.tsx
git commit -m "feat(ui): add /community search page with fork button"
```

---

### Task 8: Add Community to sidebar nav

**Files:**
- Modify: `src/components/app-sidebar.tsx`

- [ ] **Step 1: Add Community to NAV_LINKS**

In `src/components/app-sidebar.tsx`, insert after the Stats entry in `NAV_LINKS`:

```typescript
{
  href: "/community",
  label: "Community",
  icon: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
    </svg>
  ),
},
```

- [ ] **Step 2: Verify sidebar**

Open the app — "Community" should appear in the nav below Stats.

- [ ] **Step 3: Commit**

```bash
git add src/components/app-sidebar.tsx
git commit -m "feat(ui): add Community link to sidebar"
```

---

### Task 9: Set display name from profile settings

**Files:**
- Create: `src/app/api/profile/route.ts`

This allows users to set their display name (shown on community cards).

- [ ] **Step 1: Create the route**

```typescript
import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const display_name = typeof body.display_name === "string" ? body.display_name.trim() : null;
  if (!display_name) return Response.json({ error: "display_name is required" }, { status: 400 });
  if (display_name.length > 30) return Response.json({ error: "display_name max 30 chars" }, { status: 400 });

  const { error } = await supabase
    .from("profiles")
    .upsert({ id: user.id, display_name });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ display_name: data?.display_name ?? null });
}
```

- [ ] **Step 2: Test GET**

```bash
curl -H "Cookie: <your-session-cookie>" http://localhost:3000/api/profile
```

Expected: `{ "display_name": null }` for a user with no display name set.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/profile/route.ts
git commit -m "feat(api): add GET/PATCH /api/profile for display name"
```

---

## Self-Review

**Spec coverage:**
- ✅ `profiles` table + trigger — Task 1
- ✅ `is_public` column + RLS — Task 1
- ✅ TypeScript types — Task 2
- ✅ `GET /api/community` search — Task 3
- ✅ `POST /api/community/fork` — Task 4
- ✅ PATCH deck `is_public` toggle — Task 5
- ✅ Publish toggle UI on deck detail — Task 6
- ✅ `/community` page with search + fork — Task 7
- ✅ Sidebar Community link — Task 8
- ✅ Display name API — Task 9

**Placeholder scan:** None found.

**Type consistency:** `PublicDeck` defined in Task 7 uses fields returned by Task 3 API. `is_public` added to DB in Task 1, types regenerated in Task 2, PATCH extended in Task 5, UI in Task 6 — consistent throughout.
