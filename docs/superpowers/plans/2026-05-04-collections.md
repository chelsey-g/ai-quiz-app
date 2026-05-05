# Collections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users create named groups of decks (collections), toggle each public or private, and display public collections on the profile page.

**Architecture:** Migration adds `collections` + `collection_decks` tables with full RLS. Six API routes handle CRUD. A `CollectionPopover` client component floats alongside each deck card on the dashboard. The profile page gains a `CollectionsSection` client island that loads server-side and handles visibility toggles client-side.

**Tech Stack:** Next.js 16 App Router, Supabase Postgres + RLS, Tailwind v4, React client islands

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `supabase/migrations/20260504000002_collections.sql` | Create | Tables + indexes + RLS |
| `src/lib/database.types.ts` | Modify | Add collections + collection_decks types |
| `src/app/api/collections/route.ts` | Create | GET (list) + POST (create) |
| `src/app/api/collections/[id]/route.ts` | Create | PATCH (rename/toggle) + DELETE |
| `src/app/api/collections/[id]/decks/route.ts` | Create | POST (add deck) + DELETE (remove deck) |
| `src/components/collection-popover.tsx` | Create | Folder icon + popover with checkboxes |
| `src/app/page.tsx` | Modify | Render CollectionPopover per deck card |
| `src/components/collections-section.tsx` | Create | Client island for profile page |
| `src/app/profile/page.tsx` | Modify | Fetch + render CollectionsSection |

---

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260504000002_collections.sql`

- [ ] **Step 1: Write the migration**

```sql
-- collections table
create table if not exists collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  is_public boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists collections_user_id_idx on collections (user_id);

-- collection_decks junction
create table if not exists collection_decks (
  collection_id uuid not null references collections on delete cascade,
  deck_id uuid not null references decks on delete cascade,
  added_at timestamptz not null default now(),
  primary key (collection_id, deck_id)
);

create index if not exists collection_decks_deck_id_idx on collection_decks (deck_id);

-- RLS: collections
alter table collections enable row level security;

create policy "collections_select" on collections
  for select using (auth.uid() = user_id or is_public = true);

create policy "collections_insert" on collections
  for insert with check (auth.uid() = user_id);

create policy "collections_update" on collections
  for update using (auth.uid() = user_id);

create policy "collections_delete" on collections
  for delete using (auth.uid() = user_id);

-- RLS: collection_decks
alter table collection_decks enable row level security;

create policy "collection_decks_select" on collection_decks
  for select using (
    exists (
      select 1 from collections c
      where c.id = collection_id
        and (c.user_id = auth.uid() or c.is_public = true)
    )
  );

create policy "collection_decks_insert" on collection_decks
  for insert with check (
    exists (
      select 1 from collections c
      where c.id = collection_id and c.user_id = auth.uid()
    )
  );

create policy "collection_decks_delete" on collection_decks
  for delete using (
    exists (
      select 1 from collections c
      where c.id = collection_id and c.user_id = auth.uid()
    )
  );
```

- [ ] **Step 2: Apply the migration via Supabase MCP**

Use `mcp__plugin_supabase_supabase__apply_migration` with the file contents above.

Expected: migration applies without error.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260504000002_collections.sql
git commit -m "feat(db): add collections and collection_decks tables with RLS"
```

---

### Task 2: Update Database Types

**Files:**
- Modify: `src/lib/database.types.ts`

- [ ] **Step 1: Add collections and collection_decks types**

In `src/lib/database.types.ts`, inside `Tables: {` (keep alphabetical order — insert after `cards`, before `decks`):

```typescript
      collection_decks: {
        Row: {
          added_at: string
          collection_id: string
          deck_id: string
        }
        Insert: {
          added_at?: string
          collection_id: string
          deck_id: string
        }
        Update: {
          added_at?: string
          collection_id?: string
          deck_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collection_decks_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_decks_deck_id_fkey"
            columns: ["deck_id"]
            isOneToOne: false
            referencedRelation: "decks"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          created_at: string
          id: string
          is_public: boolean
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_public?: boolean
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_public?: boolean
          name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/chelseygowac/ai-quiz-app && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors about collections or collection_decks.

- [ ] **Step 3: Commit**

```bash
git add src/lib/database.types.ts
git commit -m "feat(types): add collections and collection_decks to database types"
```

---

### Task 3: GET + POST /api/collections

**Files:**
- Create: `src/app/api/collections/route.ts`

`GET /api/collections` lists the current user's collections. Accepts optional `?deck_id=X` — when provided, each collection includes `contains_deck: boolean`. Response: `{ collections: CollectionWithMeta[] }`.

`POST /api/collections` creates a new collection. Body: `{ name: string }`. Response: the created row.

- [ ] **Step 1: Create the route file**

```typescript
import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const deckId = req.nextUrl.searchParams.get("deck_id");

  const { data, error } = await supabase
    .from("collections")
    .select("id, name, is_public, created_at, collection_decks(deck_id)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (error) return Response.json({ error: error.message }, { status: 500 });

  const collections = (data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    is_public: c.is_public,
    created_at: c.created_at,
    deck_count: c.collection_decks.length,
    contains_deck: deckId
      ? c.collection_decks.some((cd) => cd.deck_id === deckId)
      : undefined,
  }));

  return Response.json({ collections });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return Response.json({ error: "Name is required" }, { status: 400 });

  const { data, error } = await supabase
    .from("collections")
    .insert({ user_id: user.id, name })
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json(data, { status: 201 });
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /Users/chelseygowac/ai-quiz-app && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/collections/route.ts
git commit -m "feat(api): GET + POST /api/collections"
```

---

### Task 4: PATCH + DELETE /api/collections/[id]

**Files:**
- Create: `src/app/api/collections/[id]/route.ts`

`PATCH` accepts `{ name?: string; is_public?: boolean }` — at least one field required. `DELETE` removes the collection (cascade deletes `collection_decks` rows, decks unaffected).

- [ ] **Step 1: Create the route file**

```typescript
import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const updates: { name?: string; is_public?: boolean } = {};

  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (!name) return Response.json({ error: "Name cannot be blank" }, { status: 400 });
    updates.name = name;
  }
  if (typeof body.is_public === "boolean") {
    updates.is_public = body.is_public;
  }

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("collections")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!data) return Response.json({ error: "Not found" }, { status: 404 });

  return Response.json(data);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase
    .from("collections")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return Response.json({ error: error.message }, { status: 500 });

  return new Response(null, { status: 204 });
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /Users/chelseygowac/ai-quiz-app && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/collections/[id]/route.ts
git commit -m "feat(api): PATCH + DELETE /api/collections/[id]"
```

---

### Task 5: POST + DELETE /api/collections/[id]/decks

**Files:**
- Create: `src/app/api/collections/[id]/decks/route.ts`

`POST` body: `{ deck_id: string }` — adds deck to collection (upsert, so adding again is a no-op). `DELETE` body: `{ deck_id: string }` — removes deck from collection.

- [ ] **Step 1: Create the route file**

```typescript
import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: collection_id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const deck_id = typeof body.deck_id === "string" ? body.deck_id.trim() : "";
  if (!deck_id) return Response.json({ error: "deck_id is required" }, { status: 400 });

  // Verify the collection belongs to the user (RLS enforces this, but return 404 instead of 403)
  const { data: col } = await supabase
    .from("collections")
    .select("id")
    .eq("id", collection_id)
    .eq("user_id", user.id)
    .single();
  if (!col) return Response.json({ error: "Not found" }, { status: 404 });

  const { error } = await supabase
    .from("collection_decks")
    .upsert({ collection_id, deck_id }, { onConflict: "collection_id,deck_id" });

  if (error) return Response.json({ error: error.message }, { status: 500 });

  return new Response(null, { status: 204 });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: collection_id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const deck_id = typeof body.deck_id === "string" ? body.deck_id.trim() : "";
  if (!deck_id) return Response.json({ error: "deck_id is required" }, { status: 400 });

  // Verify collection ownership
  const { data: col } = await supabase
    .from("collections")
    .select("id")
    .eq("id", collection_id)
    .eq("user_id", user.id)
    .single();
  if (!col) return Response.json({ error: "Not found" }, { status: 404 });

  const { error } = await supabase
    .from("collection_decks")
    .delete()
    .eq("collection_id", collection_id)
    .eq("deck_id", deck_id);

  if (error) return Response.json({ error: error.message }, { status: 500 });

  return new Response(null, { status: 204 });
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /Users/chelseygowac/ai-quiz-app && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/collections/[id]/decks/route.ts
git commit -m "feat(api): POST + DELETE /api/collections/[id]/decks"
```

---

### Task 6: CollectionPopover Component

**Files:**
- Create: `src/components/collection-popover.tsx`

Folder icon button that opens a popover. On open, fetches `GET /api/collections?deck_id=X`. Renders a checkbox list — toggling immediately calls POST or DELETE. "New collection…" input at bottom — Enter creates collection + adds deck. Closes on outside click or Escape.

- [ ] **Step 1: Create the component**

```typescript
"use client";

import { useEffect, useRef, useState, useCallback } from "react";

type CollectionMeta = {
  id: string;
  name: string;
  is_public: boolean;
  deck_count: number;
  contains_deck: boolean;
};

export function CollectionPopover({ deckId }: { deckId: string }) {
  const [open, setOpen] = useState(false);
  const [collections, setCollections] = useState<CollectionMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [toggling, setToggling] = useState<Set<string>>(new Set());
  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchCollections = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/collections?deck_id=${deckId}`);
    if (res.ok) {
      const data = await res.json();
      setCollections(data.collections);
    }
    setLoading(false);
  }, [deckId]);

  useEffect(() => {
    if (open) fetchCollections();
  }, [open, fetchCollections]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        !buttonRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  async function handleToggle(col: CollectionMeta) {
    if (toggling.has(col.id)) return;
    setToggling((prev) => new Set(prev).add(col.id));

    // Optimistic update
    setCollections((prev) =>
      prev.map((c) =>
        c.id === col.id ? { ...c, contains_deck: !c.contains_deck } : c
      )
    );

    const method = col.contains_deck ? "DELETE" : "POST";
    await fetch(`/api/collections/${col.id}/decks`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deck_id: deckId }),
    });

    setToggling((prev) => {
      const next = new Set(prev);
      next.delete(col.id);
      return next;
    });
  }

  async function handleCreate(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    const name = newName.trim();
    if (!name || creating) return;
    setCreating(true);

    // Create collection
    const createRes = await fetch("/api/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });

    if (createRes.ok) {
      const col = await createRes.json();
      // Add deck to new collection
      await fetch(`/api/collections/${col.id}/decks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deck_id: deckId }),
      });

      setCollections((prev) => [
        ...prev,
        {
          id: col.id,
          name: col.name,
          is_public: col.is_public,
          deck_count: 1,
          contains_deck: true,
        },
      ]);
      setNewName("");
    }

    setCreating(false);
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-label="Add to collection"
        className="flex h-7 w-7 items-center justify-center rounded-lg border border-border/40 bg-card/80 text-muted-foreground/50 transition-all hover:border-primary/30 hover:text-primary/70"
      >
        <svg
          className="h-3.5 w-3.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.75}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v8.25"
          />
        </svg>
      </button>

      {open && (
        <div
          ref={popoverRef}
          className="absolute bottom-full left-0 mb-2 z-50 w-56 rounded-xl border border-border bg-card shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 pt-3 pb-1">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground/55 mb-2">
              Collections
            </p>

            {loading ? (
              <div className="space-y-1.5 pb-2">
                {[1, 2].map((i) => (
                  <div key={i} className="h-6 rounded bg-muted/40 animate-pulse" />
                ))}
              </div>
            ) : collections.length === 0 ? (
              <p className="pb-2 text-xs text-muted-foreground/50">No collections yet</p>
            ) : (
              <ul className="space-y-0.5 pb-1 max-h-48 overflow-y-auto">
                {collections.map((col) => (
                  <li key={col.id}>
                    <button
                      onClick={() => handleToggle(col)}
                      disabled={toggling.has(col.id)}
                      className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted/40 disabled:opacity-50"
                    >
                      {/* Checkbox */}
                      <span
                        className="flex h-4 w-4 flex-none items-center justify-center rounded border transition-all"
                        style={
                          col.contains_deck
                            ? {
                                background: "oklch(0.77 0.195 68)",
                                borderColor: "oklch(0.77 0.195 68)",
                              }
                            : {
                                background: "transparent",
                                borderColor: "oklch(0.77 0.195 68 / 0.4)",
                              }
                        }
                      >
                        {col.contains_deck && (
                          <svg
                            className="h-2.5 w-2.5"
                            viewBox="0 0 12 12"
                            fill="none"
                            stroke="oklch(0.09 0.006 65)"
                            strokeWidth={2.5}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <path d="M2 6l3 3 5-5" />
                          </svg>
                        )}
                      </span>
                      <span className="flex-1 truncate text-foreground/80">{col.name}</span>
                      <span className="text-[10px] text-muted-foreground/40 tabular-nums">
                        {col.deck_count}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border-t border-border/50 px-3 py-2">
            <input
              ref={inputRef}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={handleCreate}
              disabled={creating}
              placeholder="New collection…"
              className="w-full rounded-lg bg-muted/30 px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/40 disabled:opacity-50"
            />
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /Users/chelseygowac/ai-quiz-app && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/collection-popover.tsx
git commit -m "feat(ui): CollectionPopover — folder icon + checkbox list + create"
```

---

### Task 7: Dashboard Integration

**Files:**
- Modify: `src/app/page.tsx`

Add `CollectionPopover` alongside each deck card in the grid. The popover button sits in the top-right corner of each card wrapper. In select mode the popover is hidden.

- [ ] **Step 1: Add the import**

At the top of `src/app/page.tsx`, add:

```typescript
import { CollectionPopover } from "@/components/collection-popover";
```

- [ ] **Step 2: Wrap each deck card with a relative container that includes the popover**

Find the deck grid render (around line 585-594 in `src/app/page.tsx`):

```typescript
{sortedDecks.map((deck, i) => (
  <div key={deck.id} className="animate-card-in h-full" style={{ animationDelay: `${i * 50}ms` }}>
    <DeckCard
      deck={deck}
      selectMode={selectMode}
      selected={selectedIds.has(deck.id)}
      onSelect={() => toggleDeck(deck.id)}
    />
  </div>
))}
```

Replace with:

```typescript
{sortedDecks.map((deck, i) => (
  <div key={deck.id} className="animate-card-in relative h-full" style={{ animationDelay: `${i * 50}ms` }}>
    <DeckCard
      deck={deck}
      selectMode={selectMode}
      selected={selectedIds.has(deck.id)}
      onSelect={() => toggleDeck(deck.id)}
    />
    {!selectMode && (
      <div className="absolute bottom-3 right-3 z-10">
        <CollectionPopover deckId={deck.id} />
      </div>
    )}
  </div>
))}
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd /Users/chelseygowac/ai-quiz-app && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(dashboard): add CollectionPopover to each deck card"
```

---

### Task 8: CollectionsSection Component

**Files:**
- Create: `src/components/collections-section.tsx`

Client island for the profile page. Receives `initialCollections` from the server. Each collection card shows name, deck count, and a public/private toggle button. Toggle optimistically updates `is_public` via PATCH. If no collections exist, shows a prompt.

- [ ] **Step 1: Create the component**

```typescript
"use client";

import { useState } from "react";

type CollectionRow = {
  id: string;
  name: string;
  is_public: boolean;
  deck_count: number;
};

export function CollectionsSection({
  initialCollections,
}: {
  initialCollections: CollectionRow[];
}) {
  const [collections, setCollections] = useState(initialCollections);
  const [toggling, setToggling] = useState<Set<string>>(new Set());

  async function handleTogglePublic(col: CollectionRow) {
    if (toggling.has(col.id)) return;
    setToggling((prev) => new Set(prev).add(col.id));

    const next = !col.is_public;
    // Optimistic update
    setCollections((prev) =>
      prev.map((c) => (c.id === col.id ? { ...c, is_public: next } : c))
    );

    const res = await fetch(`/api/collections/${col.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_public: next }),
    });

    if (!res.ok) {
      // Revert on error
      setCollections((prev) =>
        prev.map((c) => (c.id === col.id ? { ...c, is_public: col.is_public } : c))
      );
    }

    setToggling((prev) => {
      const s = new Set(prev);
      s.delete(col.id);
      return s;
    });
  }

  return (
    <div>
      <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground/60">
        Collections
      </p>

      {collections.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/40 px-4 py-5 text-center">
          <p className="text-sm text-muted-foreground/60">
            No collections yet. Create one from the dashboard, then toggle it public to show it here.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {collections.map((col) => (
            <div
              key={col.id}
              className="flex items-center justify-between rounded-xl border border-border/40 bg-card/60 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="font-heading text-sm font-semibold text-foreground truncate">
                  {col.name}
                </p>
                <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                  {col.deck_count} {col.deck_count === 1 ? "deck" : "decks"}
                </p>
              </div>

              <button
                onClick={() => handleTogglePublic(col)}
                disabled={toggling.has(col.id)}
                className="ml-4 flex flex-none items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-all disabled:opacity-50"
                style={
                  col.is_public
                    ? {
                        borderColor: "oklch(0.77 0.195 68 / 0.4)",
                        color: "oklch(0.77 0.195 68 / 0.9)",
                        background: "oklch(0.77 0.195 68 / 0.08)",
                      }
                    : {
                        borderColor: "oklch(0.225 0.011 65 / 0.4)",
                        color: "oklch(0.50 0.018 72)",
                        background: "transparent",
                      }
                }
              >
                {col.is_public ? (
                  <>
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Public
                  </>
                ) : (
                  <>
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                    Private
                  </>
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /Users/chelseygowac/ai-quiz-app && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/collections-section.tsx
git commit -m "feat(ui): CollectionsSection — profile page collection list with public toggle"
```

---

### Task 9: Profile Page Integration

**Files:**
- Modify: `src/app/profile/page.tsx`

Fetch the user's collections server-side (including deck count), then render `CollectionsSection` below the stats grid. 

- [ ] **Step 1: Update the server data fetch**

In `src/app/profile/page.tsx`, update the `Promise.all` to also fetch collections:

```typescript
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getGlobalStats } from "@/lib/services/stats";
import { ProfileEditor } from "@/components/profile-editor";
import { CollectionsSection } from "@/components/collections-section";
```

Replace the `Promise.all` block and add collections fetch:

```typescript
  const [profileResult, stats, collectionsResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("id", user.id)
      .single(),
    getGlobalStats(user.id),
    supabase
      .from("collections")
      .select("id, name, is_public, collection_decks(deck_id)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true }),
  ]);

  const profile = profileResult.data;
  const collections = (collectionsResult.data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    is_public: c.is_public,
    deck_count: c.collection_decks.length,
  }));
```

- [ ] **Step 2: Add CollectionsSection below stats**

In the return JSX, after the stats `<div>`, add:

```typescript
      <div className="mt-8">
        <CollectionsSection initialCollections={collections} />
      </div>
```

The full updated file:

```typescript
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getGlobalStats } from "@/lib/services/stats";
import { ProfileEditor } from "@/components/profile-editor";
import { CollectionsSection } from "@/components/collections-section";

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/40 bg-card/60 px-4 py-3">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground/55">{label}</p>
      <p className="font-heading mt-1 text-2xl font-bold tabular-nums text-foreground">{value}</p>
    </div>
  );
}

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const [profileResult, stats, collectionsResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("id", user.id)
      .single(),
    getGlobalStats(user.id),
    supabase
      .from("collections")
      .select("id, name, is_public, collection_decks(deck_id)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true }),
  ]);

  const profile = profileResult.data;
  const collections = (collectionsResult.data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    is_public: c.is_public,
    deck_count: c.collection_decks.length,
  }));

  const streakValue =
    stats.totals.streakStatus === "none" || stats.totals.streakDays === 0
      ? "—"
      : `${stats.totals.streakDays}d`;

  const streakColor =
    stats.totals.streakStatus === "active"
      ? "text-primary"
      : stats.totals.streakStatus === "at_risk"
      ? "text-amber-400"
      : "text-foreground";

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-8">
        <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">Profile</h1>
      </div>

      <div className="mb-8">
        <ProfileEditor
          userId={user.id}
          userEmail={user.email ?? ""}
          initialDisplayName={profile?.display_name ?? null}
          initialAvatarUrl={profile?.avatar_url ?? null}
        />
      </div>

      <div>
        <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground/60">
          Stats
        </p>
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-border/40 bg-card/60 px-4 py-3">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground/55">Streak</p>
            <p className={`font-heading mt-1 text-2xl font-bold tabular-nums ${streakColor}`}>
              {streakValue}
            </p>
          </div>
          <Tile label="Sessions" value={stats.totals.sessions.toString()} />
          <Tile
            label="Accuracy"
            value={stats.totals.accuracy !== null ? `${stats.totals.accuracy}%` : "—"}
          />
        </div>
      </div>

      <div className="mt-8">
        <CollectionsSection initialCollections={collections} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd /Users/chelseygowac/ai-quiz-app && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/profile/page.tsx
git commit -m "feat(profile): add CollectionsSection below stats"
```
