# AI Endpoint Rate Limiting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Per-user rate limits on every endpoint that spends money (LLM calls, sandbox spawns), so one authenticated user can't run up the bill.

**Architecture:** No rate limiting exists anywhere. Nine routes make AI-gateway calls or spawn Vercel Sandboxes; all are authenticated but unmetered. Approach: a Postgres-backed sliding-window counter — one `rate_limit_hits` table plus a `check_rate_limit` RPC (SECURITY DEFINER, keyed on `auth.uid()`), called through the user-scoped Supabase client before the expensive work. Postgres is chosen over in-memory (useless on serverless — every instance has its own memory) and over Redis/Upstash (new dependency for a solo-MVP-scale problem; the counter query is trivial at this traffic).

**Tech Stack:** Postgres (Supabase migration), TypeScript helper, applied per-route.

---

### Task 1: Migration — table + RPC

**Files:**
- Create: `supabase/migrations/20260612000001_rate_limiting.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Per-user sliding-window rate limiting for expensive (AI / sandbox) routes.
create table if not exists rate_limit_hits (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  route text not null,
  created_at timestamptz not null default now()
);

create index if not exists rate_limit_hits_lookup
  on rate_limit_hits (user_id, route, created_at desc);

alter table rate_limit_hits enable row level security;
-- No policies: only the SECURITY DEFINER function below touches this table.

-- Returns true if the call is allowed (and records it), false if over the limit.
create or replace function check_rate_limit(
  p_route text,
  p_max int,
  p_window_seconds int
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_count int;
begin
  if v_user is null then
    return false;
  end if;

  select count(*) into v_count
  from rate_limit_hits
  where user_id = v_user
    and route = p_route
    and created_at > now() - make_interval(secs => p_window_seconds);

  if v_count >= p_max then
    return false;
  end if;

  insert into rate_limit_hits (user_id, route) values (v_user, p_route);

  -- Opportunistic cleanup: drop this user's rows older than an hour.
  delete from rate_limit_hits
  where user_id = v_user and created_at < now() - interval '1 hour';

  return true;
end;
$$;

revoke all on function check_rate_limit(text, int, int) from anon;
grant execute on function check_rate_limit(text, int, int) to authenticated;
```

- [ ] **Step 2: Apply the migration**

Run: `npx supabase db push` (project ref `wlghyvhrzdhfnkykhcoj` — this targets the LIVE database; if a local stack is running, verify with `npx supabase migration up` first).
Expected: migration applies cleanly.

- [ ] **Step 3: Regenerate DB types**

Run: `npx supabase gen types typescript --project-id wlghyvhrzdhfnkykhcoj > src/lib/database.types.ts`
Then: `npx tsc --noEmit` — expected clean. (Past sessions saw npm noise prepended to this file — check the first line is a TypeScript comment/type, strip anything before it.)

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260612000001_rate_limiting.sql src/lib/database.types.ts
git commit -m "feat(rate-limit): sliding-window counter table + check_rate_limit RPC"
```

### Task 2: TypeScript helper

**Files:**
- Create: `src/lib/rate-limit.ts`
- Test: `src/lib/rate-limit.test.ts`

- [ ] **Step 1: Write the failing test** (limits config is pure and worth pinning)

```typescript
// src/lib/rate-limit.test.ts
import { describe, it, expect } from "vitest";
import { RATE_LIMITS } from "./rate-limit";

describe("RATE_LIMITS", () => {
  it("covers every expensive route", () => {
    const routes = Object.keys(RATE_LIMITS);
    for (const r of [
      "quiz-grade", "quiz-explain", "deck-expand", "generate-topic",
      "generate-answer", "generate-distractors", "kata-generate", "kata-hint", "kata-run",
    ]) {
      expect(routes).toContain(r);
    }
  });

  it("every limit has a positive max and window", () => {
    for (const { max, windowSeconds } of Object.values(RATE_LIMITS)) {
      expect(max).toBeGreaterThan(0);
      expect(windowSeconds).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/rate-limit.test.ts` — FAIL, module not found.

- [ ] **Step 3: Write the implementation**

```typescript
// src/lib/rate-limit.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export const RATE_LIMITS = {
  "quiz-grade":           { max: 30, windowSeconds: 60 },   // per-card during a quiz
  "quiz-explain":         { max: 20, windowSeconds: 60 },
  "deck-expand":          { max: 5,  windowSeconds: 600 },
  "generate-topic":       { max: 10, windowSeconds: 600 },
  "generate-answer":      { max: 20, windowSeconds: 60 },
  "generate-distractors": { max: 10, windowSeconds: 600 },
  "kata-generate":        { max: 10, windowSeconds: 600 },
  "kata-hint":            { max: 10, windowSeconds: 60 },
  "kata-run":             { max: 20, windowSeconds: 60 },   // sandbox spawns
} as const;

export type RateLimitedRoute = keyof typeof RATE_LIMITS;

/**
 * Returns null if allowed, or a ready-to-return 429 Response if over the limit.
 * Call with the USER-SCOPED client (auth.uid() inside the RPC needs the user's JWT).
 * Fails open on RPC error: an outage of the limiter must not take down the feature.
 */
export async function enforceRateLimit(
  supabase: SupabaseClient<Database>,
  route: RateLimitedRoute
): Promise<Response | null> {
  const { max, windowSeconds } = RATE_LIMITS[route];
  const { data: allowed, error } = await supabase.rpc("check_rate_limit", {
    p_route: route,
    p_max: max,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error(`[rate-limit] ${route}: ${error.message}`);
    return null; // fail open
  }
  if (!allowed) {
    return Response.json(
      { error: "Rate limit exceeded — try again shortly" },
      { status: 429 }
    );
  }
  return null;
}
```

- [ ] **Step 4: Run tests, typecheck, commit**

Run: `npx vitest run src/lib/rate-limit.test.ts && npx tsc --noEmit` — PASS/clean.

```bash
git add src/lib/rate-limit.ts src/lib/rate-limit.test.ts
git commit -m "feat(rate-limit): enforceRateLimit helper with per-route limits"
```

### Task 3: Apply to all nine routes

**Files (modify each):**
- `src/app/api/quiz/grade/route.ts` → `"quiz-grade"`
- `src/app/api/quiz/explain/route.ts` → `"quiz-explain"`
- `src/app/api/decks/[id]/expand/route.ts` → `"deck-expand"`
- `src/app/api/generate-topic/route.ts` → `"generate-topic"`
- `src/app/api/cards/generate-answer/route.ts` → `"generate-answer"`
- `src/app/api/cards/[id]/generate-distractors/route.ts` → `"generate-distractors"`
- `src/app/api/kata/generate/route.ts` → `"kata-generate"`
- `src/app/api/kata/hint/route.ts` → `"kata-hint"`
- `src/app/api/kata/run/route.ts` → `"kata-run"`

- [ ] **Step 1: Apply the same two-line pattern to each route**

Each route already has this shape after auth:

```typescript
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
```

Immediately after the auth check (and before any body parsing or AI/sandbox work), insert:

```typescript
  const limited = await enforceRateLimit(supabase, "quiz-grade"); // ← route's own key
  if (limited) return limited;
```

with the import at the top:

```typescript
import { enforceRateLimit } from "@/lib/rate-limit";
```

Use each route's key from the file list above. All nine use the user-scoped `supabase` client created at the top of the handler — pass that client, never the admin client.

- [ ] **Step 2: Typecheck + tests**

Run: `npx tsc --noEmit && npm test` — clean, all pass.

- [ ] **Step 3: Manual verification**

Dev server up, logged in. Hit `/api/quiz/grade` 31 times inside a minute (loop `curl` with the session cookie, or temporarily set `max: 2` locally and click twice). Expected: first N succeed, then `429 {"error":"Rate limit exceeded — try again shortly"}`. Confirm a row count in `rate_limit_hits` matches, and that a second user is NOT blocked by the first user's limit.

- [ ] **Step 4: Commit**

```bash
git add src/app/api
git commit -m "feat(rate-limit): enforce per-user limits on all AI and sandbox routes"
```

### Non-goals

- IP-based limits for unauthenticated traffic — every expensive route already requires auth.
- Vercel WAF / BotID — platform-level concerns, revisit if abuse actually appears.
- Per-plan/tiered quotas — no plans exist; YAGNI.
