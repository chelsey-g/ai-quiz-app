# Challenges Feature — Design Spec

**Date:** 2026-05-07
**Status:** Approved

## Overview

One user creates a quiz challenge from an existing deck (full deck or custom card subset), sends it to one or more other Quizly users, recipients are notified in-app, they take the quiz, and results (score + per-card breakdown) are sent back to the challenger.

---

## Data Model

### `challenges`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK |
| `challenger_id` | `uuid` | → `auth.users` |
| `title` | `text` | Optional custom title, defaults to deck name |
| `deck_id` | `uuid` | → `decks`, nullable |
| `card_ids` | `uuid[]` | Nullable — null means whole deck |
| `status` | `text` | `open` \| `closed` |
| `created_at` | `timestamptz` | |
| `expires_at` | `timestamptz` | Nullable |

### `challenge_attempts`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK |
| `challenge_id` | `uuid` | → `challenges` |
| `user_id` | `uuid` | → `auth.users` — the challenged user |
| `status` | `text` | `pending` \| `in_progress` \| `completed` |
| `score` | `int` | Nullable until completed |
| `total` | `int` | Total cards in the challenge |
| `card_results` | `jsonb` | `[{card_id, correct, chosen_answer}]` |
| `started_at` | `timestamptz` | Nullable |
| `completed_at` | `timestamptz` | Nullable |

### `notifications`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK |
| `user_id` | `uuid` | → `auth.users` — recipient |
| `type` | `text` | `challenge_received` \| `challenge_completed` |
| `payload` | `jsonb` | `{challenge_id, attempt_id, from_user_display_name}` |
| `read` | `bool` | Default `false` |
| `created_at` | `timestamptz` | |

**RLS rules:**
- `notifications`: users select/update their own rows only
- `challenges`: challenger selects their own; challenged users select challenges where they have an attempt
- `challenge_attempts`: user selects their own attempts; challenger selects attempts for challenges they own

**Realtime:** enabled on `notifications` for instant badge updates.

---

## Challenge Creation Flow

Entry point: "Challenge" button on `/decks/[id]` page.

Multi-step sheet:

1. **Pick cards** — full deck selected by default; user can deselect individual cards. Card fronts shown in a checklist.
2. **Pick recipients** — search Quizly users by display name. Multi-select. Minimum 1.
3. **Confirm + send** — summary of deck/cards and recipient list. On submit:
   - Insert 1 `challenges` row
   - Insert 1 `challenge_attempts` row per recipient (status: `pending`)
   - Insert 1 `notifications` row per recipient (type: `challenge_received`)
   - Show success toast to challenger

Challenge appears in challenger's `/challenges` sent tab immediately.

---

## Challenge Play Flow

**Entry:** Notification panel → click challenge notification → `/challenges/[attemptId]/play`

**Behaviour:**
- Reuses existing MC quiz mode (multiple choice with distractors)
- Linear, no skipping
- Each answer written to `card_results` in the attempt immediately (progress safe on refresh)
- `status` → `in_progress` on first answer; `completed` on last card
- On completion: `score`, `total`, `completed_at` written; a `challenge_completed` notification inserted for the challenger

**Post-completion screen:** Score (X/Y), per-card breakdown (card front, correct answer, what they chose), "Back to Dashboard" button.

---

## Results & Notifications UI

### `/challenges/[challengeId]/results`

- Challenge title + deck name
- List of recipients: name, status (pending / in progress / completed), score
- Completed rows are expandable: shows per-card breakdown
- Linked from both the sent tab and `challenge_completed` notifications

### `/challenges` page

Two tabs:

- **Received** — attempts addressed to the current user; pending attempts shown first
- **Sent** — challenges created by the current user, with attempt status summary per recipient

### Notification panel

- Bell icon in sidebar header; badge shows unread count
- Supabase Realtime subscription on `notifications` for the logged-in user
- Two rendered styles: received challenge vs. completed challenge result
- Clicking a notification navigates to relevant page + marks it read
- "Mark all read" button

---

## Pages & Components

| New | Path / Component |
|---|---|
| Page | `/challenges` (received + sent tabs) |
| Page | `/challenges/[attemptId]/play` |
| Page | `/challenges/[challengeId]/results` |
| Component | `<ChallengeSheet>` — multi-step creation (deck picker, user picker, confirm) |
| Component | `<NotificationPanel>` — slide-in panel, Realtime subscription |
| Component | `<NotificationBadge>` — bell + unread count in sidebar |
| API route | `POST /api/challenges` — create challenge + attempts + notifications |
| API route | `PATCH /api/challenges/attempts/[id]` — update attempt progress + completion |

---

## Out of Scope

- Email notifications (in-app only)
- Time limits on challenges
- Leaderboards / aggregate stats across multiple challenges
