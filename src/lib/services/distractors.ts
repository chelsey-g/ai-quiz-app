import { generateObject } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const SINGLE_SYSTEM_PROMPT =
  "You generate multiple-choice distractors for a single flashcard.\n" +
  "Produce exactly 3 wrong answers following these rules:\n" +
  "(1) Each distractor must answer THE SAME QUESTION as the correct answer — just incorrectly. Never answer a different question or go on a tangent.\n" +
  "(2) Each distractor must be wrong for a DIFFERENT reason: aim for one common misconception, one related-but-incorrect fact, and one partial truth that misses the key point.\n" +
  "(3) A student who has fully mastered the material must immediately see all 3 as wrong. A student still learning should find them plausible.\n" +
  "(4) Match the format and approximate length of the correct answer.\n" +
  "(5) Never copy, rephrase, or echo the correct answer. Never produce a distractor that is also correct or could be argued as correct.";

const BATCH_SYSTEM_PROMPT =
  "You generate multiple-choice distractors for a batch of flashcards.\n" +
  "For EACH card independently, produce exactly 3 wrong answers following these rules:\n" +
  "(1) Each distractor must answer THAT CARD'S specific question — just incorrectly. Never answer a different question or go on a tangent.\n" +
  "(2) CRITICAL: Never use or paraphrase text from another card's correct answer in this batch as a distractor for a different card.\n" +
  "(3) Each distractor must be wrong for a DIFFERENT reason: aim for one common misconception, one related-but-incorrect fact, and one partial truth that misses the key point.\n" +
  "(4) A student who has fully mastered the material must immediately see all 3 as wrong. A student still learning should find them plausible.\n" +
  "(5) Match the format and approximate length of the correct answer.\n" +
  "(6) Never copy, rephrase, or echo the correct answer. Never produce a distractor that is also correct or could be argued as correct.\n" +
  "Return one entry per cardId, in any order.";

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

async function callAISingle(front: string, back: string, deckTitle?: string | null): Promise<string[] | null> {
  const prompt =
    (deckTitle?.trim() ? `Deck: ${deckTitle.trim()}\n\n` : "") +
    `Question: ${front}\nCorrect answer (do NOT repeat): ${back}`;
  try {
    const { object } = await generateObject({
      model: gateway("google/gemini-2.0-flash"),
      providerOptions: {
        gateway: { models: ["openai/gpt-4o-mini", "anthropic/claude-haiku-4.5"] },
      },
      schema: SingleSchema,
      system: SINGLE_SYSTEM_PROMPT,
      prompt,
    });
    const clean = cleanDistractors(back, object.distractors);
    if (clean.length >= 3) return clean;
  } catch { /* failed */ }
  return null;
}

async function callAIBatch(
  items: { cardId: string; front: string; back: string }[],
  deckTitle?: string | null,
): Promise<Record<string, string[]>> {
  if (items.length === 0) return {};
  const schema = buildBatchSchema(items.length);
  const lines = items
    .map((item, i) => `[${i + 1}] cardId="${item.cardId}"\nQuestion: ${item.front}\nCorrect answer (do NOT repeat): ${item.back}`)
    .join("\n\n---\n\n");
  const prompt = (deckTitle?.trim() ? `Deck: ${deckTitle.trim()}\n\n` : "") + lines;
  try {
    const { object } = await generateObject({
      model: gateway("google/gemini-2.0-flash"),
      providerOptions: {
        gateway: { models: ["openai/gpt-4o-mini", "anthropic/claude-haiku-4.5"] },
      },
      schema,
      system: BATCH_SYSTEM_PROMPT,
      prompt,
    });
    const out: Record<string, string[]> = {};
    const backById = new Map(items.map(i => [i.cardId, i.back]));
    for (const row of object.results) {
      const correct = backById.get(row.cardId);
      if (!correct) continue;
      const clean = cleanDistractors(correct, row.distractors);
      if (clean.length >= 3) out[row.cardId] = clean;
    }
    return out;
  } catch { /* failed */ }
  return {};
}

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

export async function generateAndSaveDistractorsForDeck(
  deckId: string,
  deckTitle?: string | null,
): Promise<void> {
  const supabase = await createClient();

  const { data: pending } = await supabase
    .from("cards")
    .select("id, front, back")
    .eq("deck_id", deckId)
    .in("mc_status", ["pending", "failed"]);

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
