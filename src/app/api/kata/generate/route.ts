// src/app/api/kata/generate/route.ts
import { NextRequest } from "next/server";
import { generateObject } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { createClient } from "@/lib/supabase/server";
import { KataSchema } from "@/lib/ai/schema";

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const deckId = typeof (body as Record<string, unknown>).deckId === "string"
    ? (body as Record<string, unknown>).deckId as string
    : null;
  if (!deckId) return Response.json({ error: "deckId is required" }, { status: 400 });

  const { data: deck } = await supabase
    .from("decks")
    .select("title, topic_tags")
    .eq("id", deckId)
    .single();

  if (!deck) return Response.json({ error: "Deck not found" }, { status: 404 });

  const { data: cards } = await supabase
    .from("cards")
    .select("front, back")
    .eq("deck_id", deckId)
    .limit(8);

  const cardSamples = (cards ?? [])
    .map((c) => `Q: ${c.front}\nA: ${c.back}`)
    .join("\n\n");

  const { object } = await generateObject({
    model: gateway("openai/gpt-4o-mini"),
    providerOptions: {
      gateway: {
        models: [
          "anthropic/claude-haiku-4.5",
          "anthropic/claude-sonnet-4-6",
          "openai/gpt-4o",
        ],
      },
    },
    schema: KataSchema,
    system:
      "You are a coding challenge author. Given a JavaScript study deck, create a single self-contained coding kata. " +
      "The function stub must use a standard `function` declaration (not an arrow function) so it can be called by name. " +
      "Include a JSDoc comment above the function with @param and @returns types. " +
      "The body must be empty (just a comment `// your code here`). " +
      "Test cases must cover happy path and at least one edge case (empty input, single element, zero, etc.).",
    prompt: `Deck title: ${deck.title}\nTags: ${(deck.topic_tags ?? []).join(", ")}\n\nSample cards:\n${cardSamples}`,
  });

  const { data: attempt, error } = await supabase
    .from("kata_attempts")
    .insert({
      deck_id: deckId,
      user_id: user.id,
      problem_title: object.problem_title,
      problem_description: object.problem_description,
      function_stub: object.function_stub,
      difficulty: object.difficulty,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      test_cases: object.test_cases as any,
      total_count: object.test_cases.length,
    })
    .select()
    .single();

  if (error || !attempt) {
    return Response.json({ error: "Failed to save kata" }, { status: 500 });
  }

  // Never send test_cases to the client
  const { test_cases: _hidden, ...clientKata } = attempt;
  return Response.json(clientKata, { status: 201 });
}
