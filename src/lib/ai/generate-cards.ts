import { generateObject } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { DeckSchema, type GeneratedDeck } from "./schema";

const FILE_SYSTEM_PROMPT =
  "You are a study content generator. Given a Markdown note about software engineering, " +
  "extract key concepts and generate flashcards for active recall practice. " +
  "Generate 5–15 cards depending on content depth. If the note has no learnable concepts, return an empty cards array.";

const TOPIC_SYSTEM_PROMPT =
  "You are a study content generator. Given a topic name, generate comprehensive flashcards " +
  "for active recall practice covering the most important concepts, APIs, patterns, and gotchas. " +
  "Generate 10–15 cards. Every card must be self-contained — do not reference other cards.";

const NOTES_SYSTEM_PROMPT =
  "You are a study content generator. Given notes on any subject, extract the key concepts, " +
  "facts, and ideas and generate flashcards for active recall practice. Generate 8–15 cards " +
  "depending on content depth. If an optional title is provided, use it as the deck title; " +
  "otherwise, infer a clear, specific title from the content. Every card must be self-contained.";

export async function generateCards(
  content: string,
  filePath: string,
  mode: "file" | "topic" | "notes" = "file"
): Promise<{ deck: GeneratedDeck; provider: string; model: string }> {
  const systemPrompt =
    mode === "topic"
      ? TOPIC_SYSTEM_PROMPT
      : mode === "notes"
        ? NOTES_SYSTEM_PROMPT
        : FILE_SYSTEM_PROMPT;

  const userPrompt =
    mode === "topic"
      ? `Topic: ${content}`
      : mode === "notes"
        ? (filePath ? `Title: ${filePath}\n\n` : "") + `Notes:\n${content}`
        : `File: ${filePath}\n\n${content}`;

  const { object } = await generateObject({
    model: gateway("openai/gpt-4o-mini"),
    providerOptions: {
      gateway: { models: ["anthropic/claude-haiku-4.5", "anthropic/claude-sonnet-4-6", "openai/gpt-4o"] },
    },
    schema: DeckSchema,
    system: systemPrompt,
    prompt: userPrompt,
  });

  return { deck: object, provider: "gateway", model: "openai/gpt-4o-mini" };
}
