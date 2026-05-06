import { generateObject } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";

const MODEL_PRIORITY = [
  { provider: "openai" as const, model: "gpt-4o-mini" },
  { provider: "anthropic" as const, model: "claude-haiku-4-5-20251001" },
  { provider: "anthropic" as const, model: "claude-sonnet-4-6" },
  { provider: "openai" as const, model: "gpt-4o" },
];

const SYSTEM_PROMPT =
  "You generate high-quality multiple-choice distractors for flashcards. " +
  "For each card, produce exactly 3 wrong answers that: " +
  "(1) are the same TYPE and FORMAT as the correct answer — if it's a year, give years; a name, give plausible names; a technical term, give a related term from the same domain; " +
  "(2) represent common misconceptions or near-misses a learner might hold; " +
  "(3) are similar in length and tone to the correct answer; " +
  "(4) would genuinely fool someone who half-knows the material — seeing all 4 options they should be uncertain without having studied this specific fact. " +
  "Never copy, lightly rephrase, or echo the correct answer. No labels like 'Wrong:'.";

export type DistractorItem = { cardId: string; front: string; back: string };

function buildSchema(n: number) {
  return z.object({
    results: z
      .array(
        z.object({
          cardId: z.string(),
          distractors: z.array(z.string()).length(3),
        }),
      )
      .length(n),
  });
}

function norm(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function filterDistractors(correct: string, raw: string[]): string[] {
  const ck = norm(correct);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of raw) {
    const t = r.trim();
    if (!t) continue;
    const k = norm(t);
    if (k === ck || seen.has(k)) continue;
    seen.add(k);
    out.push(t);
    if (out.length >= 3) break;
  }
  return out;
}

/**
 * Generate distractors for a batch of cards. Returns a map of cardId → string[3].
 * Cards with fewer than 3 usable distractors are omitted from the result.
 */
export async function generateDistractors(
  items: DistractorItem[],
  deckTitle?: string | null,
): Promise<Record<string, string[]>> {
  if (items.length === 0) return {};

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  const anthropic = anthropicKey ? createAnthropic({ apiKey: anthropicKey }) : null;
  const openai = openaiKey ? createOpenAI({ apiKey: openaiKey }) : null;

  const lines = items
    .map(
      (item, i) =>
        `[${i + 1}] cardId="${item.cardId}"\nQuestion: ${item.front}\nCorrect answer (do NOT repeat): ${item.back}`,
    )
    .join("\n\n---\n\n");

  const prompt =
    (deckTitle?.trim() ? `Deck: ${deckTitle.trim()}\n\n` : "") +
    `${lines}\n\nReturn one row per cardId above, in any order.`;

  const schema = buildSchema(items.length);
  const backById = new Map(items.map((i) => [i.cardId, i.back]));

  for (const { provider, model } of MODEL_PRIORITY) {
    const client = provider === "anthropic" ? anthropic : openai;
    if (!client) continue;
    try {
      const { object } = await generateObject({
        model: client(model),
        schema,
        system: SYSTEM_PROMPT,
        prompt,
      });

      const out: Record<string, string[]> = {};
      for (const row of object.results) {
        const id = row.cardId.trim();
        const correct = backById.get(id);
        if (!correct) continue;
        const cleaned = filterDistractors(correct, row.distractors);
        if (cleaned.length >= 3) out[id] = cleaned;
      }
      return out;
    } catch {
      // try next model
    }
  }

  return {};
}
