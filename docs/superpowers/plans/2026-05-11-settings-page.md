# Settings Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Settings page with profile editing, appearance, study preferences, notification preferences, and account management; move the notification bell to a top bar above main content; add Settings to the sidebar nav; strip ProfileEditor from the Profile page.

**Architecture:** Single `settings/page.tsx` client component loads all profile data from `GET /api/profile` on mount and saves per-section via `PATCH /api/profile`. A new `TopBar` component renders the notification bell + settings gear link above the scrollable main content on every page. The sidebar loses its notification panel and theme toggle from the footer; gains a Settings nav entry. The profile page keeps all stats content but drops the ProfileEditor.

**Tech Stack:** Next.js App Router client components, Supabase (server + admin clients), `next-themes` (already installed), Tailwind v4, existing `ProfileEditor` component, existing `NotificationPanel` component.

---

## File Map

| Action | File | Purpose |
|--------|------|---------|
| Create | `supabase/migrations/20260511000001_add_notification_prefs.sql` | Add `notification_prefs` jsonb column |
| Modify | `src/app/api/profile/route.ts` | GET returns all fields; PATCH handles new fields; add DELETE handler |
| Modify | `src/components/notification-panel.tsx` | Fix dropdown position for top bar context |
| Create | `src/components/top-bar.tsx` | Notification bell + settings gear above all pages |
| Modify | `src/app/layout.tsx` | Integrate TopBar into authenticated layout |
| Modify | `src/components/app-sidebar.tsx` | Add Settings nav link; remove NotificationPanel + ThemeToggle from footer |
| Create | `src/app/settings/page.tsx` | Full settings page with all sections |
| Modify | `src/app/profile/page.tsx` | Remove ProfileEditor; keep stats only |

---

### Task 1: DB migration — add notification_prefs column

**Files:**
- Create: `supabase/migrations/20260511000001_add_notification_prefs.sql`

- [ ] **Step 1: Create the migration file**

```sql
alter table profiles
  add column if not exists notification_prefs jsonb
    not null default '{"challenge_received": true, "challenge_completed": true}';
```

- [ ] **Step 2: Apply via Supabase MCP**

Use the `mcp__plugin_supabase_supabase__apply_migration` tool with:
- `name`: `add_notification_prefs`
- `query`: the SQL above

- [ ] **Step 3: Verify column exists**

Run in Supabase SQL editor (or via `execute_sql`):
```sql
select column_name, data_type, column_default
from information_schema.columns
where table_name = 'profiles' and column_name = 'notification_prefs';
```
Expected: one row, `data_type = jsonb`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260511000001_add_notification_prefs.sql
git commit -m "feat(settings): add notification_prefs jsonb column to profiles"
```

---

### Task 2: Extend /api/profile — GET returns all fields, PATCH handles new fields, DELETE removes account

**Files:**
- Modify: `src/app/api/profile/route.ts`

The current GET only returns `display_name`. PATCH only handles `display_name` and `avatar_url`. We need to extend both and add a DELETE handler that removes the user account.

- [ ] **Step 1: Replace the entire file with this content**

```typescript
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest } from "next/server";

type NotificationPrefs = {
  challenge_received: boolean;
  challenge_completed: boolean;
};

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("profiles")
    .select("display_name, avatar_url, default_study_mode, daily_goal, notification_prefs")
    .eq("id", user.id)
    .single();

  if (error && error.code !== "PGRST116") {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({
    display_name: data?.display_name ?? null,
    avatar_url: data?.avatar_url ?? null,
    default_study_mode: (data?.default_study_mode as string | null) ?? "flip",
    daily_goal: (data?.daily_goal as number | null) ?? null,
    notification_prefs: (data?.notification_prefs as NotificationPrefs | null) ?? {
      challenge_received: true,
      challenge_completed: true,
    },
    email: user.email ?? "",
  });
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const updates: Record<string, unknown> = {};

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

  if ("default_study_mode" in body) {
    if (body.default_study_mode !== "flip" && body.default_study_mode !== "type") {
      return Response.json({ error: "default_study_mode must be flip or type" }, { status: 400 });
    }
    updates.default_study_mode = body.default_study_mode;
  }

  if ("daily_goal" in body) {
    const daily_goal = body.daily_goal === null ? null : Number(body.daily_goal);
    if (daily_goal !== null && (isNaN(daily_goal) || daily_goal < 1)) {
      return Response.json({ error: "daily_goal must be a positive integer" }, { status: 400 });
    }
    updates.daily_goal = daily_goal;
  }

  if ("notification_prefs" in body && typeof body.notification_prefs === "object" && body.notification_prefs !== null) {
    updates.notification_prefs = {
      challenge_received: Boolean((body.notification_prefs as NotificationPrefs).challenge_received ?? true),
      challenge_completed: Boolean((body.notification_prefs as NotificationPrefs).challenge_completed ?? true),
    };
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

export async function DELETE() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ ok: true });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/chelseygowac/ai-quiz-app && npx tsc --noEmit 2>&1 | grep "api/profile" | head -10
```
Expected: no output (no errors for this file).

- [ ] **Step 3: Commit**

```bash
git add src/app/api/profile/route.ts
git commit -m "feat(settings): extend profile API with new fields + DELETE for account removal"
```

---

### Task 3: Fix notification panel dropdown positioning

**Files:**
- Modify: `src/components/notification-panel.tsx`

The dropdown currently uses `fixed bottom-20 left-3` — anchored to the sidebar's bottom-left. When rendered in the top bar it must open below the bell button, not float to a fixed sidebar position.

- [ ] **Step 1: Replace the dropdown position class**

In `src/components/notification-panel.tsx`, find this class string on the open dropdown div:
```
"fixed bottom-20 left-3 z-50 w-72 rounded-xl border border-border bg-background shadow-xl overflow-hidden"
```

Replace with:
```
"absolute top-full right-0 z-50 mt-2 w-72 rounded-xl border border-border bg-background shadow-xl overflow-hidden"
```

The outer `<div className="relative" ref={panelRef}>` already provides the positioning context, so `absolute top-full right-0` will pin the dropdown below and right-aligned to the bell button.

- [ ] **Step 2: Commit**

```bash
git add src/components/notification-panel.tsx
git commit -m "fix(notifications): reposition dropdown below button instead of fixed sidebar position"
```

---

### Task 4: Create TopBar component

**Files:**
- Create: `src/components/top-bar.tsx`

- [ ] **Step 1: Create the file**

```typescript
"use client";

import Link from "next/link";
import { NotificationPanel } from "@/components/notification-panel";
import type { User } from "@supabase/supabase-js";

function GearIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.43l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

export function TopBar({ user }: { user: User }) {
  return (
    <header className="sticky top-0 z-30 flex h-12 shrink-0 items-center justify-end border-b border-border/40 bg-background/80 px-3 backdrop-blur-sm md:px-4">
      <div className="flex items-center gap-0.5">
        <NotificationPanel userId={user.id} />
        <Link
          href="/settings"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground/70 transition-colors hover:bg-muted/40 hover:text-foreground"
          aria-label="Settings"
        >
          <GearIcon />
        </Link>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/chelseygowac/ai-quiz-app && npx tsc --noEmit 2>&1 | grep "top-bar" | head -10
```
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/components/top-bar.tsx
git commit -m "feat(settings): add TopBar component with notification bell and settings link"
```

---

### Task 5: Update layout.tsx to include TopBar

**Files:**
- Modify: `src/app/layout.tsx`

Currently the authenticated layout is:
```tsx
<AppSidebar user={user} />
<main className="flex-1 overflow-y-auto pt-12 md:pt-0">{children}</main>
```
The `pt-12` compensates for the mobile hamburger button. The `TopBar` (h-12) now provides that space, so we can drop the padding.

- [ ] **Step 1: Add TopBar import at the top of layout.tsx**

After the existing imports, add:
```typescript
import { TopBar } from "@/components/top-bar";
```

- [ ] **Step 2: Replace the authenticated section's inner layout**

Find:
```tsx
<AppSidebar user={user} />
<main className="flex-1 overflow-y-auto pt-12 md:pt-0">{children}</main>
```

Replace with:
```tsx
<AppSidebar user={user} />
<div className="flex min-h-0 flex-1 flex-col">
  <TopBar user={user} />
  <main className="flex-1 overflow-y-auto">{children}</main>
</div>
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/chelseygowac/ai-quiz-app && npx tsc --noEmit 2>&1 | grep "layout" | head -10
```
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat(settings): integrate TopBar into app layout above scrollable main"
```

---

### Task 6: Update AppSidebar — add Settings nav, remove notification/theme from footer

**Files:**
- Modify: `src/components/app-sidebar.tsx`

- [ ] **Step 1: Add Settings entry to NAV_LINKS**

In `src/components/app-sidebar.tsx`, the `NAV_LINKS` array ends with the Profile entry. Add a Settings entry after Profile, before the closing `] as const`:

```typescript
{
  href: "/settings",
  label: "Settings",
  icon: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.43l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
},
```

- [ ] **Step 2: Replace the sidebar footer section**

Find the footer div (starting with `<div className="border-t border-border/40 pt-3 mt-3">`):
```tsx
<div className="border-t border-border/40 pt-3 mt-3">
  <Link
    href="/profile"
    onClick={onNavClick}
    className="truncate block px-3 text-[11px] text-muted-foreground/50 mb-2 hover:text-muted-foreground transition-colors"
  >
    {user.email}
  </Link>
  <div className="flex items-center gap-2">
    <form action={signOut} className="flex-1">
      <button
        type="submit"
        className={buttonVariants({ variant: "outline", size: "sm" }) + " w-full text-xs"}
      >
        Sign out
      </button>
    </form>
    <NotificationPanel userId={user.id} />
    <ThemeToggle />
  </div>
</div>
```

Replace with:
```tsx
<div className="border-t border-border/40 pt-3 mt-3">
  <Link
    href="/profile"
    onClick={onNavClick}
    className="truncate block px-3 text-[11px] text-muted-foreground/50 mb-2 hover:text-muted-foreground transition-colors"
  >
    {user.email}
  </Link>
  <form action={signOut}>
    <button
      type="submit"
      className={buttonVariants({ variant: "outline", size: "sm" }) + " w-full text-xs"}
    >
      Sign out
    </button>
  </form>
</div>
```

- [ ] **Step 3: Remove unused imports**

Remove these two import lines from the top of `app-sidebar.tsx`:
```typescript
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationPanel } from "@/components/notification-panel";
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/chelseygowac/ai-quiz-app && npx tsc --noEmit 2>&1 | grep "app-sidebar" | head -10
```
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add src/components/app-sidebar.tsx
git commit -m "feat(settings): add Settings nav item; remove notification bell and theme toggle from sidebar footer"
```

---

### Task 7: Create Settings page

**Files:**
- Create: `src/app/settings/page.tsx`

- [ ] **Step 1: Create the directory and file**

```bash
mkdir -p /Users/chelseygowac/ai-quiz-app/src/app/settings
```

- [ ] **Step 2: Write the settings page**

```typescript
"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { createClient } from "@/lib/supabase/client";
import { ProfileEditor } from "@/components/profile-editor";
import { signOut } from "@/app/auth/actions";
import { buttonVariants } from "@/components/ui/button";

type NotificationPrefs = {
  challenge_received: boolean;
  challenge_completed: boolean;
};

type ProfileData = {
  display_name: string | null;
  avatar_url: string | null;
  default_study_mode: "flip" | "type";
  daily_goal: number | null;
  notification_prefs: NotificationPrefs;
  email: string;
};

const DAILY_GOAL_OPTIONS = [5, 10, 15, 20, 25, 30] as const;

function SectionHeading({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {description && <p className="mt-0.5 text-xs text-muted-foreground/60">{description}</p>}
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
        checked ? "bg-primary" : "border border-border/60 bg-muted"
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-4" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

export default function SettingsPage() {
  const [userId, setUserId] = useState("");
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const [studyMode, setStudyMode] = useState<"flip" | "type">("flip");
  const [dailyGoal, setDailyGoal] = useState<number | null>(null);
  const [studySaving, setStudySaving] = useState(false);
  const [studySaved, setStudySaved] = useState(false);

  const [notifPrefs, setNotifPrefs] = useState<NotificationPrefs>({
    challenge_received: true,
    challenge_completed: true,
  });

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
    fetch("/api/profile")
      .then((r) => r.json())
      .then((d: ProfileData) => {
        setProfile(d);
        setStudyMode(d.default_study_mode ?? "flip");
        setDailyGoal(d.daily_goal ?? null);
        setNotifPrefs(
          d.notification_prefs ?? { challenge_received: true, challenge_completed: true }
        );
      })
      .finally(() => setLoading(false));
  }, []);

  async function saveStudyPrefs() {
    setStudySaving(true);
    await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ default_study_mode: studyMode, daily_goal: dailyGoal }),
    });
    setStudySaving(false);
    setStudySaved(true);
    setTimeout(() => setStudySaved(false), 2000);
  }

  async function toggleNotifPref(key: keyof NotificationPrefs) {
    const next = { ...notifPrefs, [key]: !notifPrefs[key] };
    setNotifPrefs(next);
    await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notification_prefs: next }),
    });
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    setDeleteError(null);
    const res = await fetch("/api/profile", { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json();
      setDeleteError(d.error ?? "Failed to delete account.");
      setDeleting(false);
      return;
    }
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/auth/login";
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
        <div className="h-6 w-32 animate-pulse rounded bg-muted/40" />
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-32 animate-pulse rounded-2xl border border-border/40 bg-muted/20" />
        ))}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
      <h1 className="font-heading text-2xl font-bold text-foreground">Settings</h1>

      {/* Profile */}
      <section className="rounded-2xl border border-border/40 bg-card/60 p-5">
        <SectionHeading title="Profile" description="Update your display name and photo." />
        {profile && userId && (
          <ProfileEditor
            userId={userId}
            userEmail={profile.email}
            initialDisplayName={profile.display_name}
            initialAvatarUrl={profile.avatar_url}
          />
        )}
      </section>

      {/* Appearance */}
      <section className="rounded-2xl border border-border/40 bg-card/60 p-5">
        <SectionHeading title="Appearance" description="Choose how Quizly looks." />
        {mounted && (
          <div className="flex gap-2">
            {(["light", "system", "dark"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={`flex-1 rounded-xl border px-3 py-2.5 text-xs font-medium capitalize transition-colors ${
                  theme === t
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border/40 bg-muted/20 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Study preferences */}
      <section className="rounded-2xl border border-border/40 bg-card/60 p-5">
        <SectionHeading
          title="Study preferences"
          description="Defaults used when you start a new study session."
        />
        <div className="space-y-5">
          <div>
            <p className="mb-2 text-xs font-medium text-foreground">Default study mode</p>
            <div className="flex gap-2">
              {(["flip", "type"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setStudyMode(m)}
                  className={`rounded-xl border px-4 py-2 text-xs font-medium transition-colors ${
                    studyMode === m
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border/40 bg-muted/20 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                  }`}
                >
                  {m === "flip" ? "Flip cards" : "Type answer"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium text-foreground">Daily goal</p>
            <div className="flex flex-wrap gap-2">
              {DAILY_GOAL_OPTIONS.map((n) => (
                <button
                  key={n}
                  onClick={() => setDailyGoal(n)}
                  className={`rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${
                    dailyGoal === n
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border/40 bg-muted/20 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                  }`}
                >
                  {n} cards
                </button>
              ))}
              <button
                onClick={() => setDailyGoal(null)}
                className={`rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${
                  dailyGoal === null
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border/40 bg-muted/20 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                }`}
              >
                No goal
              </button>
            </div>
          </div>
          <button
            onClick={saveStudyPrefs}
            disabled={studySaving}
            className="rounded-xl border px-4 py-2 text-xs font-medium transition-colors disabled:opacity-50"
            style={
              studySaved
                ? {
                    borderColor: "color-mix(in oklch, var(--dashboard-accent-teal) 45%, transparent)",
                    color: "var(--dashboard-accent-teal-strong)",
                    background: "color-mix(in oklch, var(--dashboard-accent-teal) 8%, transparent)",
                  }
                : {
                    borderColor: "oklch(0.5 0.01 65 / 0.3)",
                    color: "var(--foreground)",
                  }
            }
          >
            {studySaving ? "Saving…" : studySaved ? "Saved" : "Save preferences"}
          </button>
        </div>
      </section>

      {/* Notifications */}
      <section className="rounded-2xl border border-border/40 bg-card/60 p-5">
        <SectionHeading
          title="Notifications"
          description="Control which notifications you receive."
        />
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-foreground">Challenge received</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground/50">
                When someone sends you a quiz challenge
              </p>
            </div>
            <Toggle
              checked={notifPrefs.challenge_received}
              onChange={() => toggleNotifPref("challenge_received")}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-foreground">Challenge completed</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground/50">
                When someone completes a challenge you sent
              </p>
            </div>
            <Toggle
              checked={notifPrefs.challenge_completed}
              onChange={() => toggleNotifPref("challenge_completed")}
            />
          </div>
        </div>
      </section>

      {/* Account */}
      <section className="rounded-2xl border border-border/40 bg-card/60 p-5">
        <SectionHeading title="Account" />
        <div className="space-y-4">
          <div>
            <p className="mb-1 text-[11px] uppercase tracking-widest text-muted-foreground/50">
              Email
            </p>
            <p className="text-sm text-foreground">{profile?.email ?? "—"}</p>
          </div>
          <div className="border-t border-border/30 pt-4">
            <form action={signOut}>
              <button
                type="submit"
                className={buttonVariants({ variant: "outline", size: "sm" }) + " text-xs"}
              >
                Sign out
              </button>
            </form>
          </div>
          <div className="border-t border-border/30 pt-4">
            <p className="mb-3 text-xs font-semibold text-destructive">Danger zone</p>
            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="rounded-xl border px-4 py-2 text-xs font-medium transition-colors hover:bg-destructive/5"
                style={{
                  borderColor: "color-mix(in oklch, var(--destructive) 35%, transparent)",
                  color: "var(--destructive)",
                }}
              >
                Delete account
              </button>
            ) : (
              <div className="space-y-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
                <p className="text-xs text-destructive/80">
                  This permanently deletes your account and all your data. This cannot be undone.
                </p>
                {deleteError && <p className="text-xs text-destructive">{deleteError}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={handleDeleteAccount}
                    disabled={deleting}
                    className="rounded-xl px-3 py-1.5 text-xs font-medium text-white transition-opacity disabled:opacity-50"
                    style={{ background: "var(--destructive)" }}
                  >
                    {deleting ? "Deleting…" : "Yes, delete my account"}
                  </button>
                  <button
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setDeleteError(null);
                    }}
                    className="rounded-xl border border-border/40 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/chelseygowac/ai-quiz-app && npx tsc --noEmit 2>&1 | grep "settings" | head -20
```
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add src/app/settings/page.tsx
git commit -m "feat(settings): add full Settings page with profile, appearance, study prefs, notifications, account"
```

---

### Task 8: Simplify Profile page — remove ProfileEditor

**Files:**
- Modify: `src/app/profile/page.tsx`

The profile editing (name + avatar) moves to Settings. The Profile page becomes a pure stats view.

- [ ] **Step 1: Remove ProfileEditor from profile/page.tsx**

In `src/app/profile/page.tsx`:

1. Remove this import line:
```typescript
import { ProfileEditor } from "@/components/profile-editor";
```

2. Remove `profileResult` from the `Promise.all` call. Change:
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
```
To:
```typescript
const [stats, collectionsResult] = await Promise.all([
  getGlobalStats(user.id),
  supabase
    .from("collections")
    .select("id, name, is_public, collection_decks(deck_id)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true }),
]);
```

3. Remove the `profile` variable declaration:
```typescript
const profile = profileResult.data;
```

4. Remove the ProfileEditor JSX block (the entire `<div className="mb-8">` that wraps `<ProfileEditor ...>`):
```tsx
<div className="mb-8">
  <ProfileEditor
    userId={user.id}
    userEmail={user.email ?? ""}
    initialDisplayName={profile?.display_name ?? null}
    initialAvatarUrl={profile?.avatar_url ?? null}
  />
</div>
```

- [ ] **Step 2: Verify TypeScript compiles with no errors**

```bash
cd /Users/chelseygowac/ai-quiz-app && npx tsc --noEmit 2>&1 | head -20
```
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/app/profile/page.tsx
git commit -m "feat(settings): strip ProfileEditor from profile page — editing moved to Settings"
```

---

## Self-Review

**Spec coverage check:**
- ✅ `/settings` route — Task 7
- ✅ Settings nav item in sidebar — Task 6
- ✅ Profile section (name + avatar) in settings — Task 7 (uses existing `ProfileEditor`)
- ✅ Appearance section with light/system/dark — Task 7
- ✅ Study prefs section (`default_study_mode`, `daily_goal`) — Tasks 2 + 7
- ✅ Notification prefs section (toggles, `notification_prefs` column) — Tasks 1 + 2 + 7
- ✅ Account section (email, sign out, delete) — Task 7
- ✅ Notification bell moves to top bar — Tasks 3 + 4 + 5 + 6
- ✅ Profile page stripped of ProfileEditor — Task 8
- ✅ `PATCH /api/profile` extended for new fields — Task 2
- ✅ `notification_prefs` migration — Task 1

**Placeholder scan:** No TBD, TODO, or vague steps. All code blocks are complete.

**Type consistency:** `NotificationPrefs` type is defined identically in `api/profile/route.ts` and `settings/page.tsx`. `ProfileData` type in the page matches what the GET route returns. `ProfileEditor` props (`userId`, `userEmail`, `initialDisplayName`, `initialAvatarUrl`) match the component's existing interface.
