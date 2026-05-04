# Profile Page Design

**Date:** 2026-05-04  
**Status:** Approved

## Overview

Add a `/profile` page to Quizly that shows the authenticated user's identity (avatar + display name) and a minimal stats snapshot (streak, sessions, accuracy). The page is accessible from a new sidebar nav link and from the clickable email in the sidebar footer.

## Architecture

### New files

- `src/app/profile/page.tsx` — server component; fetches authed user, profile row, and 3 stats in parallel; renders page shell
- `src/components/profile-editor.tsx` — client island; owns avatar upload and display name edit form

### Changed files

- `src/components/app-sidebar.tsx` — add Profile to `NAV_LINKS` (person icon, between Community and footer); make footer email a `<Link href="/profile">`
- `src/app/api/profile/route.ts` — extend `PATCH` to also accept and save `avatar_url`
- `src/lib/database.types.ts` — add `avatar_url: string | null` to profiles Row/Insert/Update

### Supabase changes (migration)

- Add `avatar_url text` column to `profiles` table
- Create `avatars` storage bucket: public reads, authenticated writes scoped to `avatars/{user_id}/avatar`

### Data flow

1. Server component gets user from Supabase auth; unauthenticated users are redirected to `/auth/login`
2. Fetches `profiles` row (`display_name`, `avatar_url`) and calls `getGlobalStats(user.id)` in parallel
3. Renders stat tiles directly in the server component (read-only, no client JS needed)
4. Passes only profile data (`display_name`, `avatar_url`, `userEmail`) to `ProfileEditor` client island
5. All mutations (avatar upload, name update) happen client-side; no client-side fetches on initial load

## Page Layout

Container: `mx-auto max-w-5xl px-4 py-8` — matches Stats page.

### Identity card (top)

- Circular avatar, 120px
  - If `avatar_url` exists: `<img>` with the public Supabase Storage URL
  - Otherwise: styled initials circle using first letter of `display_name` or email
- "Upload photo" button below avatar
  - Triggers hidden file input
  - Uploads to `avatars/{user_id}/avatar` in Supabase Storage
  - On success: PATCHes `avatar_url` on the profile, updates UI optimistically
  - During upload: spinner replaces button
- To the right of avatar:
  - Display name (large, bold heading)
  - User email (muted, smaller)
  - "Edit name" button

### Edit name form

- Clicking "Edit name" reveals a text input pre-filled with current display name
- Save / Cancel buttons
- Save calls `PATCH /api/profile` with `{ display_name }`; updates optimistically, collapses form on success
- Save button disabled when input is blank or whitespace-only
- Character count shown below input; max 30 chars (enforced by API)
- On PATCH failure: inline error shown, form stays open for retry

### Stats snapshot (bottom)

Three tiles in a row reusing the `Tile` component pattern from `src/app/stats/page.tsx`:

| Tile | Value |
|---|---|
| Streak | `streakDays` days (colored by status) |
| Sessions | total sessions count |
| Accuracy | overall accuracy % or — |

Data comes from `getGlobalStats` called server-side — no extra query needed.

## Sidebar Changes

- Add `{ href: "/profile", label: "Profile", icon: <person svg> }` to `NAV_LINKS` between Community and footer
- Wrap footer email `<p>` → `<Link href="/profile">` with hover underline

## Error Handling & Edge Cases

| Scenario | Behavior |
|---|---|
| Unauthenticated visit | Server component redirects to `/auth/login` |
| No `profiles` row yet | `GET /api/profile` returns `{ display_name: null, avatar_url: null }`; page renders with initials from email, empty name field |
| Avatar file not an image | Client validates before upload; inline error shown, no request made |
| Avatar file > 2MB | Client validates before upload; inline error shown, no request made |
| Storage upload fails | Inline error below avatar, reverts to previous state |
| Display name PATCH fails | Inline error inside form, form stays open |
| Same avatar path reused | Uploading to same path (`avatars/{user_id}/avatar`) overwrites — no cleanup needed |
