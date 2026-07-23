# Plan 001: Require authentication on /api/quiz/explain

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat fce2489..HEAD -- src/app/api/quiz/explain/route.ts`
> If the file changed since this plan was written, compare the "Current state"
> excerpts against the live code before proceeding; on a mismatch, treat it as
> a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW — adding an auth guard cannot break the feature for authenticated users; only unauthenticated callers are rejected
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `fce2489`, 2026-06-12

## Why this matters

`POST /api/quiz/explain` streams LLM explanations via Vercel AI Gateway using the app's API credentials. It currently has zero authentication — any HTTP client, with no session cookie, can call it thousands of times and burn the LLM budget. The fix is a single auth check at the top of the handler, identical to every other protected route in this codebase.

## Current state

**File**: `src/app/api/quiz/explain/route.ts` — streams wrong-answer explanations; the only route in `src/app/api/quiz/` with no `getUser()` call.

Current POST handler (lines 52–78):
```ts
// src/app/api/quiz/explain/route.ts:52-58
export async function POST(req: NextRequest) {
  const body = (await req.json()) as { wrongAnswers: WrongAnswer[] };

  if (!body.wrongAnswers || !Array.isArray(body.wrongAnswers) || body.wrongAnswers.length === 0) {
    return Response.json({ error: "No wrong answers provided" }, { status: 400 });
  }
  // ... no auth check anywhere
```

Auth pattern used by every other protected route (e.g. `src/app/api/cards/weak/route.ts:18-26`):
```ts
import { createClient } from "@/lib/supabase/server";
// ...
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  // ... rest of handler
```

## Commands you will need

| Purpose    | Command                  | Expected on success        |
|------------|--------------------------|----------------------------|
| Typecheck  | `npx tsc --noEmit`       | exit 0, no output          |
| Lint       | `npm run lint`           | exit 0                     |

## Scope

**In scope**:
- `src/app/api/quiz/explain/route.ts`

**Out of scope**:
- `src/app/api/quiz/grade/route.ts` — separate route; check if it also needs auth but do NOT change it in this plan
- Any client-side code — the client already sends cookies with every `fetch`; no client changes needed

## Git workflow

- Branch: `fix/auth-explain-endpoint`
- Commit message style: `fix(security): require auth on /api/quiz/explain` (match repo's conventional commits)
- Do NOT push or open a PR unless instructed

## Steps

### Step 1: Add the auth guard

In `src/app/api/quiz/explain/route.ts`, add the Supabase import and auth check at the top of the `POST` handler. The full file after the change:

```ts
import { streamText } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

type WrongAnswer = {
  cardId: string;
  question: string;
  correctAnswer: string;
  userAnswer: string;
};

async function explainOneCard(
  wrong: WrongAnswer,
  controller: ReadableStreamDefaultController<Uint8Array>
): Promise<void> {
  const encoder = new TextEncoder();

  const prompt =
    `Question: ${wrong.question}\n` +
    `Correct answer: ${wrong.correctAnswer}\n` +
    `Student answered: ${wrong.userAnswer}\n\n` +
    `Explain in 1–2 sentences why the correct answer is right and where the student went wrong. Be concise and direct.`;

  try {
    const result = streamText({
      model: gateway("openai/gpt-4o-mini"),
      providerOptions: {
        gateway: { models: ["anthropic/claude-haiku-4.5"] },
      },
      system:
        "You are a concise tutor. Given a quiz question, the correct answer, and what a student answered, " +
        "explain in 1–2 plain sentences why the correct answer is right and where the student's reasoning " +
        "went wrong. Do not repeat the question or answers back verbatim. No markdown.",
      prompt,
    });

    for await (const chunk of result.textStream) {
      const line = JSON.stringify({ cardId: wrong.cardId, chunk }) + "\n";
      controller.enqueue(encoder.encode(line));
    }

    const doneLine = JSON.stringify({ cardId: wrong.cardId, done: true }) + "\n";
    controller.enqueue(encoder.encode(doneLine));
  } catch (err) {
    console.warn(`explain: all models failed for card ${wrong.cardId}:`, err);
    const errLine =
      JSON.stringify({ cardId: wrong.cardId, error: "Could not generate explanation." }) + "\n";
    controller.enqueue(encoder.encode(errLine));
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as { wrongAnswers: WrongAnswer[] };

  if (!body.wrongAnswers || !Array.isArray(body.wrongAnswers) || body.wrongAnswers.length === 0) {
    return Response.json({ error: "No wrong answers provided" }, { status: 400 });
  }

  // Cap at 10 explanations to limit cost
  const wrongAnswers = body.wrongAnswers.slice(0, 10);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const wrong of wrongAnswers) {
        await explainOneCard(wrong, controller);
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Transfer-Encoding": "chunked",
      "Cache-Control": "no-store",
    },
  });
}
```

**Verify**: `npx tsc --noEmit` → exit 0, no errors

### Step 2: Also check /api/quiz/grade for the same gap

Open `src/app/api/quiz/grade/route.ts`. If it also lacks a `getUser()` call, add the same auth guard (same pattern as step 1). If it already has auth, skip.

**Verify**: `npx tsc --noEmit` → exit 0

### Step 3: Commit

```bash
git add src/app/api/quiz/explain/route.ts src/app/api/quiz/grade/route.ts
git commit -m "fix(security): require auth on /api/quiz/explain and grade"
```

## Test plan

No automated test infrastructure exists for API routes in this repo. Manual verification:
1. In a browser DevTools Network tab while logged out, send a POST to `/api/quiz/explain` with a valid body — expect `401 Unauthorized`.
2. Log in, run a quiz to the results screen — explanations should still stream correctly.

## Done criteria

- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm run lint` exits 0
- [ ] `src/app/api/quiz/explain/route.ts` contains `createClient` import and `getUser()` call before any body parsing
- [ ] `git diff HEAD -- src/app/api/quiz/explain/route.ts` shows only the auth guard addition
- [ ] `plans/README.md` status row updated to DONE

## STOP conditions

- The file at `src/app/api/quiz/explain/route.ts` doesn't match the excerpt above (codebase drifted)
- TypeScript errors appear after the edit that aren't caused by this change
- You discover the explain endpoint is called from server-side code where a session cookie won't be available

## Maintenance notes

- If a public/anonymous "demo" mode is ever added, this route would need to be revisited to allow unauthenticated access with rate limiting.
- The `grade` route (`src/app/api/quiz/grade/route.ts`) should be checked in step 2 — it may have the same gap.
