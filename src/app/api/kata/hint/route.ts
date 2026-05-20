// src/app/api/kata/hint/route.ts
import { NextRequest } from "next/server";
import { generateText } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { createClient } from "@/lib/supabase/server";

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

  const attempt_id =
    typeof (body as Record<string, unknown>).attempt_id === "string"
      ? (body as Record<string, unknown>).attempt_id as string
      : null;

  if (!attempt_id) {
    return Response.json({ error: "attempt_id is required" }, { status: 400 });
  }

  const { data: attempt } = await supabase
    .from("kata_attempts")
    .select("problem_title, problem_description, function_stub")
    .eq("id", attempt_id)
    .eq("user_id", user.id)
    .single();

  if (!attempt) {
    return Response.json({ error: "Attempt not found" }, { status: 404 });
  }

  let hint: string;
  try {
    const { text } = await generateText({
      model: gateway("openai/gpt-4o-mini"),
      providerOptions: {
        gateway: {
          models: ["anthropic/claude-haiku-4.5", "openai/gpt-4o"],
        },
      },
      system:
        "You are a coding mentor giving a single short hint to a student stuck on a JavaScript kata. " +
        "Give one concise tip (1–2 sentences max) that nudges them toward the right approach. " +
        "Do NOT give away the solution or write any code. Focus on which built-in method or algorithm pattern to think about.",
      prompt: `Problem: ${attempt.problem_title}\n\n${attempt.problem_description}\n\nFunction stub:\n${attempt.function_stub}`,
    });
    hint = text.trim();
  } catch (err) {
    console.error("[kata/hint] AI hint failed:", err);
    return Response.json({ error: "Failed to generate hint" }, { status: 500 });
  }

  return Response.json({ hint });
}
