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

export const CodeClassificationSchema = z.object({
  is_code_deck: z
    .boolean()
    .describe(
      "true only if this deck is primarily about programming or software development (JavaScript, TypeScript, algorithms, data structures, web APIs, etc.)"
    ),
});

export type CodeClassification = z.infer<typeof CodeClassificationSchema>;

export const KataSchema = z.object({
  problem_title: z.string().describe("Short name for the challenge, e.g. 'Reverse a String'"),
  problem_description: z
    .string()
    .describe("2–4 sentence explanation of the task with one input/output example inline"),
  function_stub: z
    .string()
    .describe(
      "Complete JSDoc-annotated JavaScript function signature with empty body — no implementation. Must start with a JSDoc comment and a `function` declaration."
    ),
  test_cases: z
    .array(
      z.object({
        input: z.unknown().describe("Single argument to pass to the function"),
        expected: z.unknown().describe("Expected return value"),
      })
    )
    .min(3)
    .max(5)
    .describe("3–5 test cases; first 1–2 should be simple, last 1–2 should be edge cases"),
  difficulty: z.enum(["easy", "medium", "hard"]),
});

export type GeneratedKata = z.infer<typeof KataSchema>;
