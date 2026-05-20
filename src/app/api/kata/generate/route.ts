// src/app/api/kata/generate/route.ts
import { NextRequest } from "next/server";
import { generateObject } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { createClient } from "@/lib/supabase/server";
import { KataSchema } from "@/lib/ai/schema";

const ALLOWED_TOPICS = [
  "JavaScript",
  "React",
  "TypeScript",
  "Node.js",
  "Data Structures",
  "Algorithms",
  "CSS / DOM",
];
const ALLOWED_DIFFICULTIES = ["easy", "medium", "hard"];

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

  const b = body as Record<string, unknown>;
  const topics = Array.isArray(b.topics)
    ? (b.topics as unknown[]).filter((t): t is string => typeof t === "string")
    : null;
  const difficulty = typeof b.difficulty === "string" ? b.difficulty : null;

  if (
    !topics ||
    topics.length === 0 ||
    !topics.every((t) => ALLOWED_TOPICS.includes(t))
  ) {
    return Response.json(
      { error: "topics must be a non-empty array of allowed values" },
      { status: 400 }
    );
  }
  if (!difficulty || !ALLOWED_DIFFICULTIES.includes(difficulty)) {
    return Response.json(
      { error: "difficulty must be easy, medium, or hard" },
      { status: 400 }
    );
  }

  const difficultyLabel =
    difficulty === "easy"
      ? "beginner"
      : difficulty === "medium"
      ? "intermediate"
      : "advanced";

  let object: Awaited<ReturnType<typeof generateObject<typeof KataSchema>>>["object"];
  try {
    ({ object } = await generateObject({
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
        "You are a coding challenge author. Create a single self-contained JavaScript coding kata. " +
        "The function stub must use a standard `function` declaration (not an arrow function) so it can be called by name. " +
        "Include a JSDoc comment above the function with @param and @returns types. " +
        "The body must be empty (just a comment `// your code here`). " +
        "Test cases must cover the happy path and at least one edge case (empty input, single element, zero, etc.).",
      prompt: `Generate a JavaScript coding kata at ${difficultyLabel} level covering these topics: ${topics.join(", ")}.`,
    }));
  } catch (err) {
    console.error("[kata/generate] AI generation failed:", err);
    return Response.json({ error: "Failed to generate kata" }, { status: 500 });
  }

  const { data: attempt, error } = await supabase
    .from("kata_attempts")
    .insert({
      deck_id: null,
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

  const { test_cases: _hidden, ...clientKata } = attempt;
  return Response.json(clientKata, { status: 201 });
}
