import { generateObject } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const SINGLE_SYSTEM_PROMPT =
  "You generate multiple-choice options for a single flashcard.\n" +
  "Return a condensed version of the correct answer plus exactly 3 wrong answers, following these rules:\n" +
  "(1) CONDENSE THE CORRECT ANSWER FIRST: rewrite the correct answer in its shortest faithful form — same meaning, same grammatical category (noun phrase / number / sentence), no invented content, and still unambiguously correct on its own when read in isolation.\n" +
  "(2) Each distractor must answer THE SAME QUESTION as the correct answer — just incorrectly. Never answer a different question or go on a tangent.\n" +
  "(3) Each distractor must be wrong for a DIFFERENT reason: aim for one common misconception, one related-but-incorrect fact, and one partial truth that misses the key point.\n" +
  "(4) A student who has fully mastered the material must immediately see all 3 as wrong. A student still learning should find them plausible.\n" +
  "(5) LENGTH AND FORM — CRITICAL: Count the CHARACTERS (not words) in the CONDENSED correct answer from step (1), not the original. Every distractor must be within ±4 characters of that exact character count — this is stricter than matching word count, since two phrases with the same word count can still differ wildly in character length (e.g. \"cat\" vs \"elephant\" are both one word). Mirror the condensed answer's grammatical form exactly: if it's a noun phrase, each distractor is a noun phrase; if it's a number, each distractor is a number; if it's a full sentence, each distractor is a full sentence; if it uses technical terminology, each distractor uses equally specific technical terminology. A distractor that is noticeably shorter, longer, vaguer, or less specific than the condensed answer is a failure.\n" +
  "(6) Never copy, rephrase, or echo the correct answer (original or condensed). Never produce a distractor that is also correct or could be argued as correct.";

const BATCH_SYSTEM_PROMPT =
  "You generate multiple-choice options for a batch of flashcards.\n" +
  "For EACH card independently, return a condensed version of its correct answer plus exactly 3 wrong answers, following these rules:\n" +
  "(1) CONDENSE THE CORRECT ANSWER FIRST: rewrite the correct answer in its shortest faithful form — same meaning, same grammatical category (noun phrase / number / sentence), no invented content, and still unambiguously correct on its own when read in isolation.\n" +
  "(2) Each distractor must answer THAT CARD'S specific question — just incorrectly. Never answer a different question or go on a tangent.\n" +
  "(3) CRITICAL: Never use or paraphrase text from another card's correct answer in this batch as a distractor for a different card.\n" +
  "(4) Each distractor must be wrong for a DIFFERENT reason: aim for one common misconception, one related-but-incorrect fact, and one partial truth that misses the key point.\n" +
  "(5) A student who has fully mastered the material must immediately see all 3 as wrong. A student still learning should find them plausible.\n" +
  "(6) LENGTH AND FORM — CRITICAL: Count the CHARACTERS (not words) in the CONDENSED correct answer from step (1), not the original. Every distractor must be within ±4 characters of that exact character count — this is stricter than matching word count, since two phrases with the same word count can still differ wildly in character length (e.g. \"cat\" vs \"elephant\" are both one word). Mirror the condensed answer's grammatical form exactly: if it's a noun phrase, each distractor is a noun phrase; if it's a number, each distractor is a number; if it's a full sentence, each distractor is a full sentence; if it uses technical terminology, each distractor uses equally specific technical terminology. A distractor that is noticeably shorter, longer, vaguer, or less specific than the condensed answer is a failure.\n" +
  "(7) Never copy, rephrase, or echo the correct answer (original or condensed). Never produce a distractor that is also correct or could be argued as correct.\n" +
  "Return one entry per cardId, in any order.";

const SingleSchema = z.object({
  condensedAnswer: z.string(),
  distractors: z.array(z.string()).length(3),
});

function buildBatchSchema(n: number) {
  return z.object({
    results: z.array(z.object({
      cardId: z.string(),
      condensedAnswer: z.string(),
      distractors: z.array(z.string()).length(3),
    })).length(n),
  });
}

function norm(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

export function cleanDistractors(back: string, condensedAnswer: string, raw: string[]): string[] {
  const seen = new Set([norm(back), norm(condensedAnswer)]);
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

type DistractorResult = { condensedAnswer: string; distractors: string[] };

async function callAISingle(front: string, back: string, deckTitle?: string | null): Promise<DistractorResult | null> {
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
    const condensedAnswer = object.condensedAnswer.trim();
    if (!condensedAnswer) return null;
    const clean = cleanDistractors(back, condensedAnswer, object.distractors);
    if (clean.length >= 3) return { condensedAnswer, distractors: clean };
  } catch { /* failed */ }
  return null;
}

async function callAIBatch(
  items: { cardId: string; front: string; back: string }[],
  deckTitle?: string | null,
): Promise<Record<string, DistractorResult>> {
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
    const out: Record<string, DistractorResult> = {};
    const backById = new Map(items.map(i => [i.cardId, i.back]));
    for (const row of object.results) {
      const correct = backById.get(row.cardId);
      if (!correct) continue;
      const condensedAnswer = row.condensedAnswer.trim();
      if (!condensedAnswer) continue;
      const clean = cleanDistractors(correct, condensedAnswer, row.distractors);
      if (clean.length >= 3) out[row.cardId] = { condensedAnswer, distractors: clean };
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
  const result = await callAISingle(front, back, deckTitle);
  if (result) {
    await supabase.from("cards").update({
      mc_condensed_answer: result.condensedAnswer,
      mc_distractors: result.distractors,
      mc_status: "ready",
    }).eq("id", cardId);
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
      const result = results[card.id];
      if (result?.distractors.length) {
        await supabase.from("cards").update({
          mc_condensed_answer: result.condensedAnswer,
          mc_distractors: result.distractors,
          mc_status: "ready",
        }).eq("id", card.id);
      } else {
        await supabase.from("cards").update({ mc_status: "failed" }).eq("id", card.id);
      }
    }
  }
}
