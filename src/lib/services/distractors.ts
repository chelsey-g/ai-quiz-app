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

const SYSTEM_PROMPT =
  "You generate high-quality multiple-choice distractors for a single flashcard. " +
  "Produce exactly 3 wrong answers that: " +
  "(1) are the same TYPE and FORMAT as the correct answer — if it's a year, give years; a name, give plausible names; a technical term, give a related term from the same domain; " +
  "(2) represent common misconceptions or near-misses a learner might hold; " +
  "(3) are similar in length and tone to the correct answer; " +
  "(4) would genuinely fool someone who half-knows the material. " +
  "Never copy, rephrase, or echo the correct answer.";

const Schema = z.object({
  distractors: z.array(z.string()).length(3),
});

function norm(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

async function callAI(front: string, back: string, deckTitle?: string | null): Promise<string[] | null> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  const anthropic = anthropicKey ? createAnthropic({ apiKey: anthropicKey }) : null;
  const openai = openaiKey ? createOpenAI({ apiKey: openaiKey }) : null;

  const prompt =
    (deckTitle?.trim() ? `Deck: ${deckTitle.trim()}\n\n` : "") +
    `Question: ${front}\nCorrect answer (do NOT repeat): ${back}`;

  for (const { provider, model } of MODEL_PRIORITY) {
    const client = provider === "anthropic" ? anthropic : openai;
    if (!client) continue;
    try {
      const { object } = await generateObject({ model: client(model), schema: Schema, system: SYSTEM_PROMPT, prompt });
      const ck = norm(back);
      const seen = new Set([ck]);
      const clean: string[] = [];
      for (const d of object.distractors) {
        const t = d.trim();
        if (!t) continue;
        const k = norm(t);
        if (seen.has(k)) continue;
        seen.add(k);
        clean.push(t);
      }
      if (clean.length >= 3) return clean.slice(0, 3);
    } catch {
      // try next model
    }
  }
  return null;
}

/**
 * Generates distractors for a card via AI and persists them to Supabase.
 * Sets mc_status to 'ready' on success, 'failed' on error.
 * Safe to call fire-and-forget.
 */
export async function generateAndSaveDistractors(
  cardId: string,
  front: string,
  back: string,
  deckTitle?: string | null,
): Promise<void> {
  const supabase = await createClient();

  const distractors = await callAI(front, back, deckTitle);

  if (distractors) {
    await supabase
      .from("cards")
      .update({ mc_distractors: distractors, mc_status: "ready" })
      .eq("id", cardId);
  } else {
    await supabase
      .from("cards")
      .update({ mc_status: "failed" })
      .eq("id", cardId);
  }
}
