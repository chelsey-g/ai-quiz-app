# Public Profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add public profile pages at `/u/[username]` showing core info, public decks, and a challenge button, plus a username field on signup and settings.

**Architecture:** A `username` column is added to `profiles` (unique, nullable for existing users). A public API route `GET /api/users/[username]` serves profile + public decks with no auth required. The public page is a Next.js server component; the challenge button and fork button are small client islands. Signup collects username upfront; settings lets existing users set one.

**Tech Stack:** Next.js App Router (server components + client islands), Supabase Postgres, Tailwind v4, existing ChallengeSheet component.

---

## File Map

| Action | File | Purpose |
|--------|------|---------|
| Create | `supabase/migrations/20260515000001_add_username.sql` | Add `username TEXT UNIQUE` to profiles |
| Create | `src/lib/utils/username.ts` | Shared username validation regex + helper |
| Create | `src/lib/utils/username.test.ts` | Unit tests for validation |
| Modify | `src/app/api/profile/route.ts` | GET returns `username`; PATCH validates + saves it |
| Modify | `src/app/auth/actions.ts` | `signUp` saves `username` + `display_name` to profiles |
| Modify | `src/app/auth/signup/page.tsx` | Add username + display_name fields |
| Modify | `src/app/settings/page.tsx` | Add username field to profile section |
| Create | `src/app/api/users/[username]/route.ts` | GET public profile + public decks (no auth) |
| Modify | `src/app/api/users/search/route.ts` | Also search by `username` ilike |
| Modify | `src/components/challenge-sheet.tsx` | Accept `initialRecipients` prop; skip recipients step when pre-filled |
| Create | `src/components/challenge-button.tsx` | Client island: deck picker → ChallengeSheet on public profile |
| Create | `src/components/fork-button.tsx` | Client island: fork a deck from public profile |
| Create | `src/app/u/[username]/page.tsx` | Server-rendered public profile page |
| Modify | `src/app/profile/page.tsx` | Add "View public profile" / "Set username" link |

---

### Task 1: Username utility + tests

**Files:**
- Create: `src/lib/utils/username.ts`
- Create: `src/lib/utils/username.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/utils/username.test.ts
import { describe, it, expect } from "vitest";
import { isValidUsername, USERNAME_ERROR } from "./username";

describe("isValidUsername", () => {
  it("accepts 3-char lowercase alphanumeric", () => {
    expect(isValidUsername("abc")).toBe(true);
  });
  it("accepts 20-char username", () => {
    expect(isValidUsername("a".repeat(20))).toBe(true);
  });
  it("accepts underscores", () => {
    expect(isValidUsername("my_name")).toBe(true);
  });
  it("accepts numbers", () => {
    expect(isValidUsername("user123")).toBe(true);
  });
  it("rejects 2-char username", () => {
    expect(isValidUsername("ab")).toBe(false);
  });
  it("rejects 21-char username", () => {
    expect(isValidUsername("a".repeat(21))).toBe(false);
  });
  it("rejects uppercase", () => {
    expect(isValidUsername("UserName")).toBe(false);
  });
  it("rejects hyphens", () => {
    expect(isValidUsername("user-name")).toBe(false);
  });
  it("rejects spaces", () => {
    expect(isValidUsername("user name")).toBe(false);
  });
  it("rejects empty string", () => {
    expect(isValidUsername("")).toBe(false);
  });
  it("exports a non-empty USERNAME_ERROR string", () => {
    expect(typeof USERNAME_ERROR).toBe("string");
    expect(USERNAME_ERROR.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --reporter=verbose src/lib/utils/username.test.ts`
Expected: FAIL — `isValidUsername` not found

- [ ] **Step 3: Implement the utility**

```typescript
// src/lib/utils/username.ts
export const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
export const USERNAME_ERROR = "3–20 characters: lowercase letters, numbers, and underscores only.";

export function isValidUsername(s: string): boolean {
  return USERNAME_RE.test(s);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --reporter=verbose src/lib/utils/username.test.ts`
Expected: 11 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/username.ts src/lib/utils/username.test.ts
git commit -m "feat(username): add validation utility + tests"
```

---

### Task 2: DB migration — add username column

**Files:**
- Create: `supabase/migrations/20260515000001_add_username.sql`

- [ ] **Step 1: Create the migration**

```sql
-- supabase/migrations/20260515000001_add_username.sql
alter table profiles
  add column if not exists username text unique;

create index if not exists profiles_username_idx on profiles (username);
```

- [ ] **Step 2: Apply the migration**

Run: `npx supabase db push`
Expected: Migration applied successfully

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260515000001_add_username.sql
git commit -m "feat(db): add username column to profiles"
```

---

### Task 3: Update profile API to handle username

**Files:**
- Modify: `src/app/api/profile/route.ts`

- [ ] **Step 1: Update GET to return username**

In the `GET` handler, change the `.select(...)` call and add `username` to the returned object:

```typescript
// Change this line:
const { data, error } = await supabase
  .from("profiles")
  .select("display_name, avatar_url, default_study_mode, daily_goal, notification_prefs")
  .eq("id", user.id)
  .single();

// To:
const { data, error } = await supabase
  .from("profiles")
  .select("display_name, avatar_url, default_study_mode, daily_goal, notification_prefs, username")
  .eq("id", user.id)
  .single();
```

Add `username` to the return object:
```typescript
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
  username: (data as { username?: string | null } | null)?.username ?? null,
});
```

- [ ] **Step 2: Update PATCH to validate and save username**

Add the import at the top of the file:
```typescript
import { isValidUsername, USERNAME_ERROR } from "@/lib/utils/username";
```

Add this block inside the `PATCH` handler, after the `notification_prefs` block and before the `Object.keys(updates).length === 0` check:

```typescript
if ("username" in body) {
  const username =
    typeof body.username === "string" ? body.username.trim().toLowerCase() : null;
  if (!username || !isValidUsername(username)) {
    return Response.json({ error: USERNAME_ERROR }, { status: 400 });
  }
  (updates as Record<string, unknown>).username = username;
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/app/api/profile/route.ts
git commit -m "feat(profile): GET returns username; PATCH validates and saves it"
```

---

### Task 4: Username on signup

**Files:**
- Modify: `src/app/auth/actions.ts`
- Modify: `src/app/auth/signup/page.tsx`

- [ ] **Step 1: Update the signUp server action**

Replace the entire `signUp` function in `src/app/auth/actions.ts`:

```typescript
export async function signUp(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const username = ((formData.get("username") as string | null) ?? "").trim().toLowerCase();
  const displayName = ((formData.get("display_name") as string | null) ?? "").trim();

  if (!isValidUsername(username)) {
    redirect(`/auth/signup?error=${encodeURIComponent(USERNAME_ERROR)}`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: getEmailRedirectTo() },
  });

  if (error) {
    redirect(`/auth/signup?error=${encodeURIComponent(error.message)}`);
  }

  if (data.user) {
    const { error: profileError } = await supabase.from("profiles").upsert({
      id: data.user.id,
      username,
      display_name: displayName || null,
    });

    if (profileError) {
      const msg =
        profileError.code === "23505"
          ? "That username is already taken."
          : profileError.message;
      redirect(`/auth/signup?error=${encodeURIComponent(msg)}`);
    }
  }

  if (data.session) {
    redirect("/");
  }

  redirect(
    `/auth/signup?message=${encodeURIComponent("Check your email to confirm your account.")}`
  );
}
```

Add the import at the top of `src/app/auth/actions.ts`:
```typescript
import { isValidUsername, USERNAME_ERROR } from "@/lib/utils/username";
```

- [ ] **Step 2: Add username + display_name fields to signup form**

Replace the `<form>` contents in `src/app/auth/signup/page.tsx`:

```tsx
<form action={signUp} className="space-y-4">
  <div className="space-y-1.5">
    <label htmlFor="display_name" className="text-xs font-medium text-foreground/70">
      Display name
    </label>
    <input
      id="display_name"
      name="display_name"
      type="text"
      autoComplete="name"
      placeholder="Your name"
      maxLength={30}
      className="w-full rounded-xl border border-input/70 bg-background/50 px-3 py-2 text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-ring/70 transition-all"
    />
  </div>
  <div className="space-y-1.5">
    <label htmlFor="username" className="text-xs font-medium text-foreground/70">
      Username <span className="text-muted-foreground/40">(3–20 chars, lowercase)</span>
    </label>
    <div className="flex items-center rounded-xl border border-input/70 bg-background/50 px-3 py-2 focus-within:ring-2 focus-within:ring-ring/70 transition-all">
      <span className="mr-1 text-sm text-muted-foreground/50">@</span>
      <input
        id="username"
        name="username"
        type="text"
        required
        autoComplete="username"
        placeholder="yourname"
        maxLength={20}
        pattern="[a-z0-9_]{3,20}"
        className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground/40 focus:outline-none"
      />
    </div>
  </div>
  <div className="space-y-1.5">
    <label htmlFor="email" className="text-xs font-medium text-foreground/70">
      Email
    </label>
    <input
      id="email"
      name="email"
      type="email"
      required
      autoComplete="email"
      placeholder="you@example.com"
      className="w-full rounded-xl border border-input/70 bg-background/50 px-3 py-2 text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-ring/70 transition-all"
    />
  </div>
  <div className="space-y-1.5">
    <label htmlFor="password" className="text-xs font-medium text-foreground/70">
      Password
    </label>
    <input
      id="password"
      name="password"
      type="password"
      required
      autoComplete="new-password"
      placeholder="••••••••"
      className="w-full rounded-xl border border-input/70 bg-background/50 px-3 py-2 text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-ring/70 transition-all"
    />
  </div>
  <button type="submit" className={buttonVariants({ className: "w-full" })}>
    Create account
  </button>
</form>
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/app/auth/actions.ts src/app/auth/signup/page.tsx
git commit -m "feat(signup): collect username and display name on account creation"
```

---

### Task 5: Username field in Settings

**Files:**
- Modify: `src/app/settings/page.tsx`

- [ ] **Step 1: Extend ProfileData type and add username state**

In `src/app/settings/page.tsx`, update `ProfileData`:
```typescript
type ProfileData = {
  display_name: string | null;
  avatar_url: string | null;
  default_study_mode: "flip" | "type";
  daily_goal: number | null;
  notification_prefs: NotificationPrefs;
  email: string;
  username: string | null;
};
```

Add state after the existing state declarations:
```typescript
const [username, setUsername] = useState("");
const [usernameSaving, setUsernameSaving] = useState(false);
const [usernameSaved, setUsernameSaved] = useState(false);
const [usernameError, setUsernameError] = useState<string | null>(null);
```

- [ ] **Step 2: Populate username from loaded profile**

In the `useEffect` that sets state from profile data, add:
```typescript
setUsername(profile.username ?? "");
```

- [ ] **Step 3: Add save handler**

Add this function inside `SettingsPage` (after the existing save handlers):
```typescript
async function saveUsername() {
  setUsernameSaving(true);
  setUsernameError(null);
  setUsernameSaved(false);
  const res = await fetch("/api/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: username.trim().toLowerCase() }),
  });
  const data = await res.json();
  setUsernameSaving(false);
  if (!res.ok) {
    setUsernameError(data.error ?? "Failed to save");
  } else {
    setUsernameSaved(true);
    setTimeout(() => setUsernameSaved(false), 2000);
  }
}
```

- [ ] **Step 4: Add username section to the Profile section JSX**

Find the Profile section in the settings page JSX (it contains `<ProfileEditor>`). Add the username field immediately after `<ProfileEditor>`:

```tsx
{/* Username */}
<div className="mt-5 space-y-2">
  <label className="block text-xs font-medium text-foreground/70">
    Username
    <span className="ml-1 text-muted-foreground/40">(3–20 chars, lowercase, underscores ok)</span>
  </label>
  <div className="flex gap-2">
    <div className="flex flex-1 items-center rounded-xl border border-border/60 bg-muted/20 px-3 py-2 focus-within:ring-2 focus-within:ring-ring/70 transition-all">
      <span className="mr-1 text-sm text-muted-foreground/50">@</span>
      <input
        type="text"
        value={username}
        onChange={(e) => { setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "")); setUsernameSaved(false); setUsernameError(null); }}
        placeholder="yourname"
        maxLength={20}
        className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none"
      />
    </div>
    <button
      onClick={saveUsername}
      disabled={usernameSaving || username.length < 3}
      className="rounded-xl border border-border/50 px-4 py-2 text-sm font-medium transition-colors hover:bg-muted/40 disabled:opacity-50"
    >
      {usernameSaving ? "Saving…" : usernameSaved ? "Saved ✓" : "Save"}
    </button>
  </div>
  {usernameError && <p className="text-xs text-destructive">{usernameError}</p>}
  {username.length >= 3 && !usernameError && !usernameSaving && (
    <p className="text-xs text-muted-foreground/50">
      Your profile: <span className="font-mono">/u/{username.trim().toLowerCase()}</span>
    </p>
  )}
</div>
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/app/settings/page.tsx
git commit -m "feat(settings): add username field to profile section"
```

---

### Task 6: Public profile API route

**Files:**
- Create: `src/app/api/users/[username]/route.ts`

- [ ] **Step 1: Create the route**

```typescript
// src/app/api/users/[username]/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const supabase = await createClient();

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, username, created_at")
    .eq("username", username.toLowerCase())
    .single();

  if (error || !profile) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const { data: decks } = await supabase
    .from("decks")
    .select("id, title, topic_tags, card_count, created_at")
    .eq("user_id", profile.id)
    .eq("is_public", true)
    .order("created_at", { ascending: false });

  const publicDecks = decks ?? [];
  const totalCards = publicDecks.reduce((sum, d) => sum + (d.card_count ?? 0), 0);

  return Response.json({
    profile,
    decks: publicDecks,
    deckCount: publicDecks.length,
    totalCards,
  });
}
```

- [ ] **Step 2: Update users/search to also match by username**

In `src/app/api/users/search/route.ts`, replace the query:

```typescript
// Replace:
const { data, error } = await supabase
  .from("profiles")
  .select("id, display_name, avatar_url")
  .ilike("display_name", `%${q}%`)
  .neq("id", user.id)
  .limit(10);

// With:
const { data, error } = await supabase
  .from("profiles")
  .select("id, display_name, avatar_url, username")
  .or(`display_name.ilike.%${q}%,username.ilike.%${q}%`)
  .neq("id", user.id)
  .limit(10);
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add "src/app/api/users/[username]/route.ts" src/app/api/users/search/route.ts
git commit -m "feat(api): public profile route + username search"
```

---

### Task 7: Modify ChallengeSheet for initialRecipients

**Files:**
- Modify: `src/components/challenge-sheet.tsx`

- [ ] **Step 1: Add initialRecipients prop**

Update the `Props` type:
```typescript
type Props = {
  open: boolean;
  onClose: () => void;
  deckId: string;
  deckTitle: string;
  cards: Card[];
  initialRecipients?: UserResult[];
};
```

Update the function signature:
```typescript
export function ChallengeSheet({ open, onClose, deckId, deckTitle, cards, initialRecipients }: Props) {
```

- [ ] **Step 2: Pre-populate recipients in the useEffect**

Find the `useEffect` that runs when `open` changes. Update the `setRecipients` line:
```typescript
// Before:
setRecipients([]);
// After:
setRecipients(initialRecipients ?? []);
```

- [ ] **Step 3: Skip recipients step when pre-populated**

Find the "Next →" button on the cards step (currently does `setStep("recipients")`):
```typescript
// Before:
onClick={() => setStep("recipients")}
// After:
onClick={() => setStep(initialRecipients?.length ? "confirm" : "recipients")}
```

Find the back button logic (currently: `step === "confirm" ? "recipients" : "cards"`):
```typescript
// Before:
onClick={() => setStep(step === "confirm" ? "recipients" : "cards")}
// After:
onClick={() => setStep(step === "confirm" ? (initialRecipients?.length ? "cards" : "recipients") : "cards")}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/components/challenge-sheet.tsx
git commit -m "feat(challenge-sheet): accept initialRecipients prop to pre-fill recipient"
```

---

### Task 8: ChallengeButton client component

**Files:**
- Create: `src/components/challenge-button.tsx`

- [ ] **Step 1: Create the component**

```tsx
// src/components/challenge-button.tsx
"use client";

import { useState } from "react";
import { ChallengeSheet } from "@/components/challenge-sheet";
import type { Database } from "@/lib/database.types";

type Card = Database["public"]["Tables"]["cards"]["Row"];
type Deck = { id: string; title: string; card_count: number };
type UserResult = { id: string; display_name: string | null; avatar_url: string | null };

type Props = {
  targetUserId: string;
  targetDisplayName: string | null;
  targetAvatarUrl: string | null;
};

export function ChallengeButton({ targetUserId, targetDisplayName, targetAvatarUrl }: Props) {
  const [phase, setPhase] = useState<"idle" | "picking" | "challenging">("idle");
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loadingDecks, setLoadingDecks] = useState(false);
  const [selectedDeck, setSelectedDeck] = useState<Deck | null>(null);
  const [deckCards, setDeckCards] = useState<Card[]>([]);
  const [loadingCards, setLoadingCards] = useState(false);

  const targetUser: UserResult = {
    id: targetUserId,
    display_name: targetDisplayName,
    avatar_url: targetAvatarUrl,
  };

  async function handleOpen() {
    setPhase("picking");
    setLoadingDecks(true);
    try {
      const res = await fetch("/api/decks");
      const data = await res.json();
      setDecks(Array.isArray(data) ? data : []);
    } finally {
      setLoadingDecks(false);
    }
  }

  async function handlePickDeck(deck: Deck) {
    setSelectedDeck(deck);
    setLoadingCards(true);
    try {
      const res = await fetch(`/api/decks/${deck.id}`);
      const data = await res.json();
      setDeckCards(data.cards ?? []);
    } finally {
      setLoadingCards(false);
      setPhase("challenging");
    }
  }

  function handleClose() {
    setPhase("idle");
    setSelectedDeck(null);
    setDeckCards([]);
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className="rounded-xl border border-border/50 bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/40"
      >
        Challenge
      </button>

      {/* Deck picker modal */}
      {phase === "picking" && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => setPhase("idle")}
          />
          <div className="relative z-10 w-full max-w-sm rounded-t-2xl border border-border bg-card p-5 shadow-2xl sm:rounded-2xl">
            <h2 className="mb-1 font-heading text-sm font-semibold text-foreground">
              Pick a deck to challenge with
            </h2>
            <p className="mb-4 text-xs text-muted-foreground/60">
              Challenging {targetDisplayName ?? "this user"}
            </p>
            {loadingDecks ? (
              <p className="py-6 text-center text-xs text-muted-foreground/50">Loading…</p>
            ) : decks.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground/50">
                You have no decks yet. Create one first.
              </p>
            ) : (
              <div className="flex max-h-64 flex-col gap-2 overflow-y-auto">
                {decks.map((deck) => (
                  <button
                    key={deck.id}
                    onClick={() => handlePickDeck(deck)}
                    disabled={loadingCards}
                    className="flex items-center justify-between rounded-xl border border-border/40 px-4 py-3 text-left text-sm transition-colors hover:border-primary/30 hover:bg-muted/30 disabled:opacity-50"
                  >
                    <span className="truncate font-medium text-foreground">{deck.title}</span>
                    <span className="ml-2 shrink-0 text-xs text-muted-foreground/50">
                      {deck.card_count} cards
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ChallengeSheet with pre-filled recipient */}
      {selectedDeck && (
        <ChallengeSheet
          open={phase === "challenging"}
          onClose={handleClose}
          deckId={selectedDeck.id}
          deckTitle={selectedDeck.title}
          cards={deckCards}
          initialRecipients={[targetUser]}
        />
      )}
    </>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/challenge-button.tsx
git commit -m "feat: ChallengeButton client island for public profile"
```

---

### Task 9: ForkButton client component

**Files:**
- Create: `src/components/fork-button.tsx`

- [ ] **Step 1: Create the component**

```tsx
// src/components/fork-button.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = { deckId: string };

export function ForkButton({ deckId }: Props) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "forking" | "done">("idle");

  async function handleFork() {
    setState("forking");
    try {
      const res = await fetch("/api/community/fork", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deckId }),
      });
      if (res.status === 401) {
        router.push("/auth/login");
        return;
      }
      if (res.ok) {
        const { deckId: newId } = await res.json();
        router.push(`/decks/${newId}`);
        return;
      }
    } catch {
      // fall through
    }
    setState("idle");
  }

  if (state === "done") return <span className="text-xs text-primary">Saved ✓</span>;

  return (
    <button
      onClick={handleFork}
      disabled={state === "forking"}
      className="rounded-lg border border-border/40 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-50"
    >
      {state === "forking" ? "Saving…" : "Fork"}
    </button>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/fork-button.tsx
git commit -m "feat: ForkButton client island for public profile deck cards"
```

---

### Task 10: Public profile page

**Files:**
- Create: `src/app/u/[username]/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
// src/app/u/[username]/page.tsx
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChallengeButton } from "@/components/challenge-button";
import { ForkButton } from "@/components/fork-button";

function formatJoinDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, username, created_at")
    .eq("username", username.toLowerCase())
    .single();

  if (!profile) notFound();

  const { data: decks } = await supabase
    .from("decks")
    .select("id, title, topic_tags, card_count, created_at")
    .eq("user_id", profile.id)
    .eq("is_public", true)
    .order("created_at", { ascending: false });

  const publicDecks = decks ?? [];
  const totalCards = publicDecks.reduce((sum, d) => sum + (d.card_count ?? 0), 0);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isOwnProfile = user?.id === profile.id;

  const initial = (profile.display_name ?? profile.username ?? "?").charAt(0).toUpperCase();

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      {/* Profile header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border/40 bg-primary/15 text-lg font-bold text-primary">
            {profile.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatar_url}
                alt={profile.display_name ?? username}
                className="h-full w-full object-cover"
              />
            ) : (
              initial
            )}
          </div>
          <div>
            <h1 className="font-heading text-xl font-bold text-foreground">
              {profile.display_name ?? `@${profile.username}`}
            </h1>
            <p className="text-sm text-muted-foreground/60">@{profile.username}</p>
            <p className="mt-0.5 text-xs text-muted-foreground/40">
              Joined {formatJoinDate(profile.created_at)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isOwnProfile && (
            <Link
              href="/settings"
              className="rounded-xl border border-border/50 px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Edit profile
            </Link>
          )}
          {!isOwnProfile && user && (
            <ChallengeButton
              targetUserId={profile.id}
              targetDisplayName={profile.display_name}
              targetAvatarUrl={profile.avatar_url}
            />
          )}
          {!user && (
            <Link
              href="/auth/login"
              className="rounded-xl border border-border/50 px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Sign in to challenge
            </Link>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="mb-8 flex gap-8">
        <div>
          <p className="font-heading text-2xl font-bold tabular-nums text-foreground">
            {publicDecks.length}
          </p>
          <p className="text-xs text-muted-foreground/55">public decks</p>
        </div>
        <div>
          <p className="font-heading text-2xl font-bold tabular-nums text-foreground">
            {totalCards}
          </p>
          <p className="text-xs text-muted-foreground/55">total cards</p>
        </div>
      </div>

      {/* Decks section */}
      <div>
        <p className="mb-4 text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground/60">
          Public decks
        </p>

        {publicDecks.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/50 py-16 text-center">
            <p className="text-sm text-muted-foreground/60">No public decks yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {publicDecks.map((deck) => (
              <div
                key={deck.id}
                className="relative overflow-hidden rounded-2xl border border-border/50 bg-card p-4"
              >
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border/80 to-transparent" />
                <div className="mb-3 flex items-start justify-between gap-2">
                  <h3 className="font-heading text-sm font-semibold leading-snug text-foreground line-clamp-2">
                    {deck.title}
                  </h3>
                  {!isOwnProfile && <ForkButton deckId={deck.id} />}
                </div>
                {deck.topic_tags && deck.topic_tags.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-1">
                    {(deck.topic_tags as string[]).slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-border/40 px-2 py-0.5 text-[10px] text-muted-foreground/60"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground/50">{deck.card_count} cards</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add "src/app/u/[username]/page.tsx"
git commit -m "feat: public profile page at /u/[username]"
```

---

### Task 11: Link private profile → public profile

**Files:**
- Modify: `src/app/profile/page.tsx`

- [ ] **Step 1: Fetch username in the server component**

In `ProfilePage`, the `supabase` client and `user` are already available. Add a username fetch alongside the existing parallel queries:

```typescript
// Add to the Promise.all or as a separate query after the existing ones:
const { data: profileData } = await supabase
  .from("profiles")
  .select("username")
  .eq("id", user.id)
  .single();

const username = (profileData as { username?: string | null } | null)?.username ?? null;
```

- [ ] **Step 2: Render the public profile link**

Find the page header `<h1>` in the JSX (it shows "Profile" or similar). Add this block directly below the heading:

```tsx
<div className="mb-6">
  <div className="flex flex-wrap items-center justify-between gap-2">
    <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">Profile</h1>
    {username ? (
      <Link
        href={`/u/${username}`}
        className="rounded-xl border border-border/50 px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        View public profile →
      </Link>
    ) : (
      <Link
        href="/settings"
        className="rounded-xl border border-border/50 px-4 py-2 text-sm font-medium text-muted-foreground/60 transition-colors hover:text-foreground"
      >
        Set username to get public profile
      </Link>
    )}
  </div>
</div>
```

Note: you will need to wrap the existing `<h1>` inside this `<div>` rather than leaving it standalone — adjust the existing JSX accordingly.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/app/profile/page.tsx
git commit -m "feat(profile): add public profile link / set-username prompt"
```

---

### Task 12: Final type-check and test run

- [ ] **Step 1: Run all tests**

Run: `npm test`
Expected: all tests pass (includes the 11 new username tests)

- [ ] **Step 2: Full type-check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Manual smoke-test checklist**

- Sign up with a new account — username + display name fields appear and save to profiles
- Go to `/settings` — username field shows current value, can update it
- Visit `/u/[your-username]` — profile header, stats, and public decks render
- Visit `/u/nonexistent` — 404 page
- As a different logged-in user, visit a profile — "Challenge" button appears
- Click Challenge → deck picker modal → pick a deck → ChallengeSheet opens with recipient pre-filled
- Click Fork on a public deck → redirects to the forked deck
- As a logged-out visitor, visit a profile — "Sign in to challenge" link appears, no Fork buttons
- Private `/profile` page shows "View public profile →" link if username is set
