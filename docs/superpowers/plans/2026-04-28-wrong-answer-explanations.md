---
assigned-to: both
status: complete
---

# Wrong Answer Explanations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When the quiz results screen loads, automatically fire a single AI call that streams explanations for every wrong answer inline — no button required.

**Architecture:** A new `POST /api/quiz/explain` route handler accepts all wrong answers in one request and returns a newline-delimited JSON (NDJSON) stream. Each line is `{"cardId":"...","chunk":"..."}`. The client reads the stream with a native `fetch` + `ReadableStream` reader and routes incoming chunks to per-card state, rendering text as it arrives. Both quiz pages (`/quiz/[deckId]/page.tsx` and `/quiz/quick/page.tsx`) use identical explanation logic — a shared custom hook `useWrongAnswerExplanations` avoids duplication.

**Tech Stack:** Next.js 16 App Router route handler, Vercel AI SDK `streamText` (`ai` v6), `@ai-sdk/openai` (gpt-4o-mini first, `@ai-sdk/anthropic` claude-haiku fallback), React custom hook, Tailwind v4

---

## File Map

| File | Change |
|---|---|
| `src/app/api/quiz/explain/route.ts` | Create — POST handler, streams NDJSON explanations |
| `src/hooks/use-wrong-answer-explanations.ts` | Create — custom hook, fetch + stream reader, per-card state |
| `src/app/quiz/[deckId]/page.tsx` | Modify — call hook on results mount, render explanations in wrong-answer rows |
| `src/app/quiz/quick/page.tsx` | Modify — same as above |

---

### Task 1: Create POST /api/quiz/explain route handler

**Files:**
- Create: `src/app/api/quiz/explain/route.ts`

This route accepts a JSON body of wrong answers, calls `streamText` with a cheapest-first model priority, and writes an NDJSON stream: one line per text chunk, formatted as `{"cardId":"<id>","chunk":"<text>"}`. A sentinel line `{"cardId":"<id>","done":true}` is emitted when a card's explanation is complete.

- [ ] **Step 1: Create `src/app/api/quiz/explain/route.ts`**

```ts
import { streamText } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { NextRequest } from "next/server";

type WrongAnswer = {
  cardId: string;
  question: string;
  correctAnswer: string;
  userAnswer: string;
};

const MODEL_PRIORITY = [
  { provider: "openai" as const, model: "gpt-4o-mini" },
  { provider: "anthropic" as const, model: "claude-haiku-4-5-20251001" },
];

async function explainOneCard(
  wrong: WrongAnswer,
  controller: ReadableStreamDefaultController<Uint8Array>
): Promise<void> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  const anthropic = anthropicKey ? createAnthropic({ apiKey: anthropicKey }) : null;
  const openai = openaiKey ? createOpenAI({ apiKey: openaiKey }) : null;

  const encoder = new TextEncoder();

  const prompt =
    `Question: ${wrong.question}\n` +
    `Correct answer: ${wrong.correctAnswer}\n` +
    `Student answered: ${wrong.userAnswer}\n\n` +
    `Explain in 1–2 sentences why the correct answer is right and where the student went wrong. Be concise and direct.`;

  const errors: string[] = [];

  for (const { provider, model } of MODEL_PRIORITY) {
    const client = provider === "anthropic" ? anthropic : openai;
    if (!client) continue;

    try {
      const result = streamText({
        model: client(model),
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
      return;
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      errors.push(`${provider}/${model}: ${reason}`);
      console.warn(`explain: model failed, trying next. ${provider}/${model}: ${reason}`);
    }
  }

  // All models failed — emit an error sentinel so the client can show a fallback
  const errLine =
    JSON.stringify({ cardId: wrong.cardId, error: "Could not generate explanation." }) + "\n";
  controller.enqueue(encoder.encode(errLine));
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { wrongAnswers: WrongAnswer[] };

  if (!body.wrongAnswers || !Array.isArray(body.wrongAnswers) || body.wrongAnswers.length === 0) {
    return Response.json({ error: "No wrong answers provided" }, { status: 400 });
  }

  // Cap at 10 explanations to limit cost
  const wrongAnswers = body.wrongAnswers.slice(0, 10);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // Explain cards sequentially to avoid hammering the API
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

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/chelseygowac/ai-quiz-app && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/quiz/explain/route.ts
git commit -m "feat(explanations): add POST /api/quiz/explain streaming route"
```

---

### Task 2: Create useWrongAnswerExplanations hook

**Files:**
- Create: `src/hooks/use-wrong-answer-explanations.ts`

This hook accepts the `answers` array from the results screen. It fires the fetch automatically when `answers` is non-empty (no button). It returns `explanations: Record<string, string>` (cardId → accumulated text so far) and `explanationsLoading: boolean` (true until the stream closes or errors).

- [ ] **Step 1: Create `src/hooks/use-wrong-answer-explanations.ts`**

```ts
import { useEffect, useRef, useState } from "react";

type AnswerRecord = {
  cardId: string;
  correct: boolean;
  userAnswer: string;
  card: {
    id: string;
    front: string;
    back: string;
  };
};

type ExplanationChunk =
  | { cardId: string; chunk: string; done?: never; error?: never }
  | { cardId: string; done: true; chunk?: never; error?: never }
  | { cardId: string; error: string; chunk?: never; done?: never };

/**
 * Automatically fetches and streams wrong-answer explanations from
 * POST /api/quiz/explain when the answers array becomes non-empty.
 *
 * Returns:
 *   explanations — Record<cardId, accumulatedText>
 *   explanationsLoading — true while the stream is open
 */
export function useWrongAnswerExplanations(answers: AnswerRecord[]) {
  const [explanations, setExplanations] = useState<Record<string, string>>({});
  const [explanationsLoading, setExplanationsLoading] = useState(false);
  // Tracks the sorted card-ID fingerprint of the last fetch so we don't re-fetch
  // the same set but DO re-fetch when a retry-missed produces a different set.
  const lastFetchedFingerprintRef = useRef<string | null>(null);

  useEffect(() => {
    const wrongAnswers = answers.filter((a) => !a.correct);
    if (wrongAnswers.length === 0) return;

    // Build a stable fingerprint from the sorted card IDs of wrong answers
    const fingerprint = wrongAnswers
      .map((a) => a.cardId)
      .sort()
      .join(",");

    if (fingerprint === lastFetchedFingerprintRef.current) return;
    lastFetchedFingerprintRef.current = fingerprint;

    // Clear stale explanations from any previous quiz
    setExplanations({});
    setExplanationsLoading(true);

    const payload = wrongAnswers.map((a) => ({
      cardId: a.cardId,
      question: a.card.front,
      correctAnswer: a.card.back,
      userAnswer: a.userAnswer,
    }));

    let cancelled = false;

    async function fetchExplanations() {
      try {
        const res = await fetch("/api/quiz/explain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wrongAnswers: payload }),
        });

        if (!res.ok || !res.body) {
          setExplanationsLoading(false);
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done || cancelled) break;

          buffer += decoder.decode(value, { stream: true });

          // Process all complete lines in the buffer
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? ""; // keep any incomplete trailing line

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
              const parsed: ExplanationChunk = JSON.parse(trimmed);
              if (parsed.chunk) {
                setExplanations((prev) => ({
                  ...prev,
                  [parsed.cardId]: (prev[parsed.cardId] ?? "") + parsed.chunk,
                }));
              }
              if (parsed.error) {
                setExplanations((prev) => ({
                  ...prev,
                  [parsed.cardId]: "Could not generate explanation.",
                }));
              }
              // parsed.done is informational — we keep reading until the stream closes
            } catch {
              // Malformed line — skip it
            }
          }
        }
      } catch {
        // Network error or abort — fail silently; explanations just stay empty
      } finally {
        if (!cancelled) setExplanationsLoading(false);
      }
    }

    fetchExplanations();

    return () => {
      cancelled = true;
    };
  }, [answers]);

  return { explanations, explanationsLoading };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/chelseygowac/ai-quiz-app && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/use-wrong-answer-explanations.ts
git commit -m "feat(explanations): add useWrongAnswerExplanations hook"
```

---

### Task 3: Wire explanations into /quiz/[deckId]/page.tsx

**Files:**
- Modify: `src/app/quiz/[deckId]/page.tsx`

- [ ] **Step 1: Add the hook import**

In `src/app/quiz/[deckId]/page.tsx`, add this import at the top of the file alongside the other imports:

```tsx
import { useWrongAnswerExplanations } from "@/hooks/use-wrong-answer-explanations";
```

- [ ] **Step 2: Call the hook inside QuizPage**

Inside the `QuizPage` component, after all existing `useState` and `useRef` declarations but before the first `useEffect`, add:

```tsx
const { explanations, explanationsLoading } = useWrongAnswerExplanations(
  phase === "results" ? answers : []
);
```

Passing an empty array when not on the results phase ensures the hook does nothing until the phase is actually `"results"`.

- [ ] **Step 3: Add explanation rendering in the answer review section**

In the `resultsPhase` JSX block, find the wrong-answer detail section. The current wrong-answer block looks like this:

```tsx
{!answer.correct && (
  <div className="mt-1.5 space-y-1">
    <p className="text-destructive/80">
      Your answer: {answer.userAnswer}
    </p>
    <p className="text-green-600 dark:text-green-400">
      Correct: {answer.card.back}
    </p>
  </div>
)}
```

Replace it with:

```tsx
{!answer.correct && (
  <div className="mt-1.5 space-y-2">
    <p className="text-destructive/80">
      Your answer: {answer.userAnswer}
    </p>
    <p className="text-green-600 dark:text-green-400">
      Correct: {answer.card.back}
    </p>
    <div className="mt-2 rounded-lg bg-muted/40 px-3 py-2">
      <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground/60">
        Why
      </p>
      {explanations[answer.cardId] ? (
        <p className="text-xs leading-relaxed text-muted-foreground">
          {explanations[answer.cardId]}
          {explanationsLoading && !explanations[answer.cardId]?.endsWith(" ") && (
            <span className="ml-0.5 inline-block h-3 w-0.5 animate-pulse bg-muted-foreground/40 align-middle" />
          )}
        </p>
      ) : explanationsLoading ? (
        <div className="space-y-1.5">
          <div className="h-2.5 w-full animate-pulse rounded bg-muted-foreground/20" />
          <div className="h-2.5 w-4/5 animate-pulse rounded bg-muted-foreground/20" />
        </div>
      ) : null}
    </div>
  </div>
)}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/chelseygowac/ai-quiz-app && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/quiz/\[deckId\]/page.tsx
git commit -m "feat(explanations): stream wrong-answer explanations on quiz results screen"
```

---

### Task 4: Wire explanations into /quiz/quick/page.tsx

**Files:**
- Modify: `src/app/quiz/quick/page.tsx`

- [ ] **Step 1: Add the hook import**

In `src/app/quiz/quick/page.tsx`, add this import at the top alongside the other imports:

```tsx
import { useWrongAnswerExplanations } from "@/hooks/use-wrong-answer-explanations";
```

- [ ] **Step 2: Call the hook inside QuickQuizPage**

Inside `QuickQuizPage`, after all existing `useState` and `useRef` declarations but before the first `useEffect`, add:

```tsx
const { explanations, explanationsLoading } = useWrongAnswerExplanations(
  phase === "results" ? answers : []
);
```

- [ ] **Step 3: Add explanation rendering in the answer review section**

In the `resultsPhase` JSX block, find the wrong-answer detail section. The current block looks like this:

```tsx
{!answer.correct && (
  <div className="mt-1.5 space-y-1">
    <p className="text-destructive/80">Your answer: {answer.userAnswer}</p>
    <p className="text-green-600 dark:text-green-400">
      Correct: {answer.card.back}
    </p>
  </div>
)}
```

Replace it with:

```tsx
{!answer.correct && (
  <div className="mt-1.5 space-y-2">
    <p className="text-destructive/80">Your answer: {answer.userAnswer}</p>
    <p className="text-green-600 dark:text-green-400">
      Correct: {answer.card.back}
    </p>
    <div className="mt-2 rounded-lg bg-muted/40 px-3 py-2">
      <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground/60">
        Why
      </p>
      {explanations[answer.cardId] ? (
        <p className="text-xs leading-relaxed text-muted-foreground">
          {explanations[answer.cardId]}
          {explanationsLoading && !explanations[answer.cardId]?.endsWith(" ") && (
            <span className="ml-0.5 inline-block h-3 w-0.5 animate-pulse bg-muted-foreground/40 align-middle" />
          )}
        </p>
      ) : explanationsLoading ? (
        <div className="space-y-1.5">
          <div className="h-2.5 w-full animate-pulse rounded bg-muted-foreground/20" />
          <div className="h-2.5 w-4/5 animate-pulse rounded bg-muted-foreground/20" />
        </div>
      ) : null}
    </div>
  </div>
)}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/chelseygowac/ai-quiz-app && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/quiz/quick/page.tsx
git commit -m "feat(explanations): stream wrong-answer explanations on quick quiz results screen"
```

---

### Task 5: Manual end-to-end smoke test

**Files:** none

- [ ] **Step 1: Start the dev server**

```bash
cd /Users/chelseygowac/ai-quiz-app && npm run dev
```

Expected: server starts on port 3001.

- [ ] **Step 2: Run a deck quiz and get at least one wrong**

1. Open `http://localhost:3001`
2. Click any deck with 4+ cards
3. Click "Take a quiz"
4. Choose "Type answer" or "Multiple choice"
5. Deliberately answer at least one question wrong
6. Finish all questions

- [ ] **Step 3: Verify explanations stream in on the results screen**

On the results screen, within 1–3 seconds of it mounting:
- Wrong-answer rows should show a pulsing skeleton under "Why" while loading
- Text should stream in character by character within each wrong-answer row's "Why" section
- The blinking cursor `|` should disappear once the stream closes
- Correct-answer rows show nothing under "Why"

- [ ] **Step 4: Check the network tab**

In DevTools Network:
- Confirm `POST /api/quiz/explain` fires immediately when the results screen mounts (no user interaction needed)
- Confirm the response is chunked / streamed (not a single response blob)
- Confirm no second request fires if you scroll or re-render

- [ ] **Step 5: Run a Quick Quiz and verify the same behavior**

1. From the dashboard, click "Quick Quiz"
2. Choose any mode, deliberately get at least one wrong
3. Confirm same streaming explanation behavior on the quick quiz results screen

- [ ] **Step 6: Verify retry-missed flow does not double-fetch**

1. After results load with explanations, click "Retry missed"
2. Complete the retry quiz (get something wrong again)
3. Confirm explanations stream in fresh on the second results screen (the fingerprint changes because the wrong card IDs differ, so the hook re-fetches)
4. Confirm no stale explanations from the first run appear

- [ ] **Step 7: Final commit (no code change needed — this is a verification step)**

If any issues found in steps 2–6, fix them and commit with:

```bash
git add -p
git commit -m "fix(explanations): <describe the fix>"
```

If everything passes, no commit needed.
