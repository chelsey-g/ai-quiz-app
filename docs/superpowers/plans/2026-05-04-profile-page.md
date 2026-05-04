# Profile Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/profile` page showing the user's avatar, display name, and a minimal stats snapshot (streak, sessions, accuracy), with avatar upload via Supabase Storage and inline display name editing.

**Architecture:** Server component fetches profile + stats in parallel and renders stat tiles directly. A `ProfileEditor` client island handles all mutations (avatar upload to Supabase Storage, display name PATCH). No client-side data fetching on load.

**Tech Stack:** Next.js 16 App Router, Supabase (Postgres + Storage), Tailwind v4, ShadCN Button component

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `supabase/migrations/20260504000000_add_avatar_url.sql` | Create | Add `avatar_url` column + `avatars` storage bucket + policies |
| `src/lib/database.types.ts` | Modify | Add `avatar_url` to profiles Row/Insert/Update |
| `src/app/api/profile/route.ts` | Modify | Extend PATCH to accept and save `avatar_url` |
| `src/components/profile-editor.tsx` | Create | Client island: avatar upload + display name edit form |
| `src/app/profile/page.tsx` | Create | Server page: auth check, parallel data fetch, render |
| `src/components/app-sidebar.tsx` | Modify | Add Profile nav link + make footer email a link |

---

## Task 1: Database migration — add avatar_url and avatars storage bucket

**Files:**
- Create: `supabase/migrations/20260504000000_add_avatar_url.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/20260504000000_add_avatar_url.sql

-- Add avatar_url to profiles
alter table profiles add column if not exists avatar_url text;

-- Create avatars storage bucket (public reads)
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict do nothing;

-- RLS: anyone can read avatars
do $$ begin
  create policy "avatars_public_read" on storage.objects
    for select using (bucket_id = 'avatars');
exception when duplicate_object then null;
end $$;

-- RLS: authenticated users can upload to their own folder
do $$ begin
  create policy "avatars_insert_own" on storage.objects
    for insert with check (
      bucket_id = 'avatars'
      and auth.role() = 'authenticated'
      and (storage.foldername(name))[1] = auth.uid()::text
    );
exception when duplicate_object then null;
end $$;

-- RLS: authenticated users can update their own avatars
do $$ begin
  create policy "avatars_update_own" on storage.objects
    for update using (
      bucket_id = 'avatars'
      and auth.uid()::text = (storage.foldername(name))[1]
    );
exception when duplicate_object then null;
end $$;
```

- [ ] **Step 2: Apply the migration via Supabase MCP**

Use the `mcp__plugin_supabase_supabase__apply_migration` tool with:
- `project_id`: `wlghyvhrzdhfnkykhcoj`
- `name`: `add_avatar_url`
- `query`: the full SQL above

- [ ] **Step 3: Verify the column exists**

Use `mcp__plugin_supabase_supabase__execute_sql` with:
```sql
select column_name, data_type
from information_schema.columns
where table_name = 'profiles' and column_name = 'avatar_url';
```
Expected: one row with `column_name = avatar_url`, `data_type = text`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260504000000_add_avatar_url.sql
git commit -m "feat(db): add avatar_url to profiles, create avatars storage bucket"
```

---

## Task 2: Update database types

**Files:**
- Modify: `src/lib/database.types.ts`

The `profiles` Row/Insert/Update types need `avatar_url`.

- [ ] **Step 1: Update the profiles Row type**

In `src/lib/database.types.ts`, find the `profiles` Row block and add `avatar_url`:

```typescript
// Before:
profiles: {
  Row: {
    created_at: string
    display_name: string | null
    id: string
  }

// After:
profiles: {
  Row: {
    avatar_url: string | null
    created_at: string
    display_name: string | null
    id: string
  }
```

- [ ] **Step 2: Update the profiles Insert type**

```typescript
// Before:
  Insert: {
    created_at?: string
    display_name?: string | null
    id: string
  }

// After:
  Insert: {
    avatar_url?: string | null
    created_at?: string
    display_name?: string | null
    id: string
  }
```

- [ ] **Step 3: Update the profiles Update type**

```typescript
// Before:
  Update: {
    created_at?: string
    display_name?: string | null
    id?: string
  }

// After:
  Update: {
    avatar_url?: string | null
    created_at?: string
    display_name?: string | null
    id?: string
  }
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/database.types.ts
git commit -m "feat(types): add avatar_url to profiles database types"
```

---

## Task 3: Extend profile API PATCH to accept avatar_url

**Files:**
- Modify: `src/app/api/profile/route.ts`

Currently PATCH only accepts `display_name`. Extend it to also accept `avatar_url`, updating whichever fields are present in the request body.

- [ ] **Step 1: Replace the PATCH handler**

Replace the entire `PATCH` export in `src/app/api/profile/route.ts` with:

```typescript
export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const updates: { display_name?: string; avatar_url?: string } = {};

  if ("display_name" in body) {
    const display_name = typeof body.display_name === "string" ? body.display_name.trim() : null;
    if (!display_name) return Response.json({ error: "display_name is required" }, { status: 400 });
    if (display_name.length > 30) return Response.json({ error: "display_name max 30 chars" }, { status: 400 });
    updates.display_name = display_name;
  }

  if ("avatar_url" in body) {
    const avatar_url = typeof body.avatar_url === "string" ? body.avatar_url.trim() : null;
    if (!avatar_url) return Response.json({ error: "avatar_url is required" }, { status: 400 });
    updates.avatar_url = avatar_url;
  }

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { error } = await supabase
    .from("profiles")
    .upsert({ id: user.id, ...updates });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
```

Keep the existing `GET` handler unchanged.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/profile/route.ts
git commit -m "feat(api): extend profile PATCH to accept avatar_url"
```

---

## Task 4: Build ProfileEditor client component

**Files:**
- Create: `src/components/profile-editor.tsx`

This is the client island that handles avatar upload and display name editing. It takes initial data as props (no client-side fetches on load).

- [ ] **Step 1: Create the file**

```typescript
"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

type Props = {
  userId: string;
  userEmail: string;
  initialDisplayName: string | null;
  initialAvatarUrl: string | null;
};

export function ProfileEditor({ userId, userEmail, initialDisplayName, initialAvatarUrl }: Props) {
  const [displayName, setDisplayName] = useState(initialDisplayName ?? "");
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState(initialDisplayName ?? "");
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameSaving, setNameSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const initials = (displayName || userEmail).charAt(0).toUpperCase();

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setUploadError("File must be an image.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setUploadError("File must be under 2MB.");
      return;
    }

    setUploadError(null);
    setUploading(true);

    const supabase = createClient();
    const path = `${userId}/avatar`;

    const { error: storageError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true });

    if (storageError) {
      setUploadError("Upload failed. Please try again.");
      setUploading(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);

    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ avatar_url: publicUrl }),
    });

    if (!res.ok) {
      setUploadError("Failed to save avatar. Please try again.");
      setUploading(false);
      return;
    }

    // Cache-bust so the browser reloads the image even though the path is the same
    setAvatarUrl(`${publicUrl}?t=${Date.now()}`);
    setUploading(false);
  }

  async function handleSaveName() {
    const trimmed = nameInput.trim();
    if (!trimmed) return;

    setNameSaving(true);
    setNameError(null);

    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ display_name: trimmed }),
    });

    if (!res.ok) {
      const data = await res.json();
      setNameError(data.error ?? "Failed to save.");
      setNameSaving(false);
      return;
    }

    setDisplayName(trimmed);
    setEditing(false);
    setNameSaving(false);
  }

  return (
    <div className="rounded-2xl border border-border/40 bg-card/60 p-6">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
        {/* Avatar column */}
        <div className="flex flex-col items-center gap-2">
          <div className="h-[120px] w-[120px] overflow-hidden rounded-full border-2 border-border/40">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Profile photo" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-primary/15 text-4xl font-bold text-primary">
                {initials}
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarUpload}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="text-xs"
          >
            {uploading ? "Uploading…" : "Upload photo"}
          </Button>
          {uploadError && (
            <p className="max-w-[130px] text-center text-xs text-destructive">{uploadError}</p>
          )}
        </div>

        {/* Name + email + edit */}
        <div className="flex-1 pt-1">
          <h2 className="font-heading text-2xl font-bold text-foreground">
            {displayName || (
              <span className="italic text-muted-foreground/50">No name set</span>
            )}
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground/60">{userEmail}</p>

          {!editing ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setNameInput(displayName);
                setEditing(true);
                setNameError(null);
              }}
              className="mt-3 text-xs"
            >
              Edit name
            </Button>
          ) : (
            <div className="mt-3 space-y-2">
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value.slice(0, 30))}
                className="w-full max-w-xs rounded-lg border border-border/40 bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30"
                placeholder="Your name"
                autoFocus
              />
              <p className="text-[11px] text-muted-foreground/50">{nameInput.length}/30</p>
              {nameError && <p className="text-xs text-destructive">{nameError}</p>}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleSaveName}
                  disabled={!nameInput.trim() || nameSaving}
                  className="text-xs"
                >
                  {nameSaving ? "Saving…" : "Save"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditing(false);
                    setNameError(null);
                  }}
                  className="text-xs"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/profile-editor.tsx
git commit -m "feat(ui): add ProfileEditor client component"
```

---

## Task 5: Build /profile server page

**Files:**
- Create: `src/app/profile/page.tsx`

Server component that auth-guards, fetches profile + stats in parallel, renders stat tiles directly, and passes profile data to `ProfileEditor`.

- [ ] **Step 1: Create the file**

```typescript
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getGlobalStats } from "@/lib/services/stats";
import { ProfileEditor } from "@/components/profile-editor";

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

  const [profileResult, stats] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("id", user.id)
      .single(),
    getGlobalStats(user.id),
  ]);

  const profile = profileResult.data;

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
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Start dev server and verify the page renders**

```bash
npm run dev
```

Visit `http://localhost:3000/profile`. Expected:
- Page loads without errors
- Shows "Profile" heading
- Identity card with initials avatar (or photo if already set) and email
- "Upload photo" and "Edit name" buttons visible
- Three stat tiles below

- [ ] **Step 4: Commit**

```bash
git add src/app/profile/page.tsx
git commit -m "feat: add /profile server page"
```

---

## Task 6: Update sidebar — add Profile nav link and clickable email

**Files:**
- Modify: `src/components/app-sidebar.tsx`

Two changes: (1) add a Profile entry to `NAV_LINKS`, (2) make the footer email a `<Link>` to `/profile`.

- [ ] **Step 1: Add Profile to NAV_LINKS**

In `src/components/app-sidebar.tsx`, find the `NAV_LINKS` array and add a Profile entry after Community:

```typescript
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

- [ ] **Step 2: Make the footer email a link**

Find the footer email `<p>` tag in `SidebarContent`:

```typescript
// Before:
<p className="truncate px-3 text-[11px] text-muted-foreground/50 mb-2">{user.email}</p>

// After:
<Link
  href="/profile"
  onClick={onNavClick}
  className="truncate block px-3 text-[11px] text-muted-foreground/50 mb-2 hover:text-muted-foreground transition-colors"
>
  {user.email}
</Link>
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Verify in browser**

With dev server running, check:
- Sidebar shows "Profile" nav link with person icon
- Clicking it navigates to `/profile`
- Active state (blue left border) applies correctly when on `/profile`
- Footer email is clickable and also navigates to `/profile`
- Mobile hamburger menu also shows Profile and closes on click

- [ ] **Step 5: Commit**

```bash
git add src/components/app-sidebar.tsx
git commit -m "feat(nav): add Profile link to sidebar, make footer email clickable"
```
