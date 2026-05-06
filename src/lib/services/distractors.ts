import { generateObject } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const MODEL_PRIORITY = [
  { provider: "openai" as const, model: "gpt-4o-mini" },
  { provider: "anthropic" as const, model: "claude-haiku-4-5-20251001" },
  { provider: "anthropic" as const, model: "claude-sonnet-4-6" },
  { provider: "openai" as const, model: "gpt-4o" },
];

const SINGLE_SYSTEM_PROMPT =
  "You generate high-quality multiple-choice distractors for a single flashcard. " +
  "Produce exactly 3 wrong answers that: " +
  "(1) are the same TYPE and FORMAT as the correct answer — if it's a year, give years; a name, give plausible names; a technical term, give a related term from the same domain; " +
  "(2) represent common misconceptions or near-misses a learner might hold; " +
  "(3) are similar in length and tone to the correct answer; " +
  "(4) would genuinely fool someone who half-knows the material. " +
  "Never copy, rephrase, or echo the correct answer.";

const BATCH_SYSTEM_PROMPT =
  "You generate high-quality multiple-choice distractors for flashcards in batch. " +
  "For each card, produce exactly 3 wrong answers that: " +
  "(1) are the same TYPE and FORMAT as the correct answer — if it's a year, give years; a name, give plausible names; a technical term, give a related term from the same domain; " +
  "(2) represent common misconceptions or near-misses a learner might hold; " +
  "(3) are similar in length and tone to the correct answer; " +
  "(4) would genuinely fool someone who half-knows the material. " +
  "Never copy, rephrase, or echo the correct answer. Return one entry per cardId, in any order.";

const SingleSchema = z.object({
  distractors: z.array(z.string()).length(3),
});

function buildBatchSchema(n: number) {
  return z.object({
    results: z.array(z.object({
      cardId: z.string(),
      distractors: z.array(z.string()).length(3),
    })).length(n),
  });
}

function norm(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function cleanDistractors(back: string, raw: string[]): string[] {
  const ck = norm(back);
  const seen = new Set([ck]);
  const out: string[] = [];
  for (const d of raw) {
    const t = d.trim();
    if (!t) continue;
    const k = norm(t);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
    if (out.length >= 3) break;
  }
  return out;
}

function getClients() {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  return {
    anthropic: anthropicKey ? createAnthropic({ apiKey: anthropicKey }) : null,
    openai: openaiKey ? createOpenAI({ apiKey: openaiKey }) : null,
  };
}

async function callAISingle(front: string, back: string, deckTitle?: string | null): Promise<string[] | null> {
  const { anthropic, openai } = getClients();
  const prompt =
    (deckTitle?.trim() ? `Deck: ${deckTitle.trim()}\n\n` : "") +
    `Question: ${front}\nCorrect answer (do NOT repeat): ${back}`;

  for (const { provider, model } of MODEL_PRIORITY) {
    const client = provider === "anthropic" ? anthropic : openai;
    if (!client) continue;
    try {
      const { object } = await generateObject({ model: client(model), schema: SingleSchema, system: SINGLE_SYSTEM_PROMPT, prompt });
      const clean = cleanDistractors(back, object.distractors);
      if (clean.length >= 3) return clean;
    } catch { /* try next */ }
  }
  return null;
}

async function callAIBatch(
  items: { cardId: string; front: string; back: string }[],
  deckTitle?: string | null,
): Promise<Record<string, string[]>> {
  if (items.length === 0) return {};
  const { anthropic, openai } = getClients();
  const schema = buildBatchSchema(items.length);

  const lines = items
    .map((item, i) => `[${i + 1}] cardId="${item.cardId}"\nQuestion: ${item.front}\nCorrect answer (do NOT repeat): ${item.back}`)
    .join("\n\n---\n\n");
  const prompt = (deckTitle?.trim() ? `Deck: ${deckTitle.trim()}\n\n` : "") + lines;

  for (const { provider, model } of MODEL_PRIORITY) {
    const client = provider === "anthropic" ? anthropic : openai;
    if (!client) continue;
    try {
      const { object } = await generateObject({ model: client(model), schema, system: BATCH_SYSTEM_PROMPT, prompt });
      const out: Record<string, string[]> = {};
      const backById = new Map(items.map(i => [i.cardId, i.back]));
      for (const row of object.results) {
        const correct = backById.get(row.cardId);
        if (!correct) continue;
        const clean = cleanDistractors(correct, row.distractors);
        if (clean.length >= 3) out[row.cardId] = clean;
      }
      return out;
    } catch { /* try next */ }
  }
  return {};
}

/**
 * Generates and persists distractors for a single card.
 * Safe to call fire-and-forget.
 */
export async function generateAndSaveDistractors(
  cardId: string,
  front: string,
  back: string,
  deckTitle?: string | null,
): Promise<void> {
  const supabase = await createClient();
  const distractors = await callAISingle(front, back, deckTitle);
  if (distractors) {
    await supabase.from("cards").update({ mc_distractors: distractors, mc_status: "ready" }).eq("id", cardId);
  } else {
    await supabase.from("cards").update({ mc_status: "failed" }).eq("id", cardId);
  }
}

/**
 * Generates and persists distractors for all pending cards in a deck.
 * Call fire-and-forget after bulk card insertion.
 */
export async function generateAndSaveDistractorsForDeck(
  deckId: string,
  deckTitle?: string | null,
): Promise<void> {
  const supabase = await createClient();

  const { data: pending } = await supabase
    .from("cards")
    .select("id, front, back")
    .eq("deck_id", deckId)
    .eq("mc_status", "pending");

  if (!pending?.length) return;

  const CHUNK = 12;
  for (let i = 0; i < pending.length; i += CHUNK) {
    const chunk = pending.slice(i, i + CHUNK);
    const results = await callAIBatch(chunk.map(c => ({ cardId: c.id, front: c.front, back: c.back })), deckTitle);

    for (const card of chunk) {
      const distractors = results[card.id];
      if (distractors?.length) {
        await supabase.from("cards").update({ mc_distractors: distractors, mc_status: "ready" }).eq("id", card.id);
      } else {
        await supabase.from("cards").update({ mc_status: "failed" }).eq("id", card.id);
      }
    }
  }
}
