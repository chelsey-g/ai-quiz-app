import { generateObject } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { DeckSchema, type GeneratedDeck } from "./schema";

const SYSTEM_PROMPT =
  "You are a study content generator. Given a Markdown note about software engineering, " +
  "extract key concepts and generate flashcards for active recall practice. " +
  "Generate 5–15 cards depending on content depth. If the note has no learnable concepts, return an empty cards array.";

// Ordered cheapest → most capable. Each entry skipped if its key isn't set.
const MODEL_PRIORITY = [
  { provider: "openai" as const, model: "gpt-4o-mini" },
  { provider: "anthropic" as const, model: "claude-haiku-4-5-20251001" },
  { provider: "anthropic" as const, model: "claude-sonnet-4-6" },
  { provider: "openai" as const, model: "gpt-4o" },
];

export async function generateCards(
  content: string,
  filePath: string
): Promise<{ deck: GeneratedDeck; provider: string; model: string }> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  const anthropic = anthropicKey ? createAnthropic({ apiKey: anthropicKey }) : null;
  const openai = openaiKey ? createOpenAI({ apiKey: openaiKey }) : null;

  const errors: string[] = [];

  for (const { provider, model } of MODEL_PRIORITY) {
    const client = provider === "anthropic" ? anthropic : openai;
    if (!client) continue;

    try {
      const { object } = await generateObject({
        model: client(model),
        schema: DeckSchema,
        system: SYSTEM_PROMPT,
        prompt: `File: ${filePath}\n\n${content}`,
      });
      return { deck: object, provider, model };
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      errors.push(`${provider}/${model}: ${reason}`);
      console.warn(`Model failed, trying next. ${provider}/${model}: ${reason}`);
    }
  }

  throw new Error(`All models failed:\n${errors.join("\n")}`);
}
