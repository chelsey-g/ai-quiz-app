import { z } from "zod";

export const DeckSchema = z.object({
  title: z.string().describe("Short descriptive title for this note"),
  topic_tags: z.array(z.string()).describe("Main technologies or concepts covered"),
  cards: z
    .array(
      z.object({
        front: z.string().describe("Question or term — one sentence max"),
        back: z.string().describe("Concise but complete answer or definition"),
        card_type: z.enum(["flashcard", "mcq", "free_text"]).default("flashcard"),
      })
    )
    .describe("5–15 flashcards depending on content depth"),
});

export type GeneratedDeck = z.infer<typeof DeckSchema>;
