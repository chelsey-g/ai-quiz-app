import { generateObject } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { SummarizedCardSchema } from "@/lib/ai/schema";

const SYSTEM_PROMPT =
  "You are condensing a chat exchange into a single flashcard. Given a user's question and " +
  "the assistant's answer, produce a short, self-contained study question (front) and a concise, " +
  "complete answer (back). Do not just copy the original text verbatim — tighten it into something " +
  "quick to review.";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as { question?: string; answer?: string };
  const question = typeof body.question === "string" ? body.question.trim() : "";
  const answer = typeof body.answer === "string" ? body.answer.trim() : "";

  if (!question || !answer) {
    return Response.json({ error: "question and answer are required" }, { status: 400 });
  }

  try {
    const { object } = await generateObject({
      model: gateway("openai/gpt-4o-mini"),
      providerOptions: {
        gateway: { models: ["anthropic/claude-haiku-4.5", "anthropic/claude-sonnet-4-6", "openai/gpt-4o"] },
      },
      schema: SummarizedCardSchema,
      system: SYSTEM_PROMPT,
      prompt: `Question: ${question}\n\nAnswer: ${answer}`,
    });

    return Response.json(object);
  } catch {
    return Response.json({ error: "Could not summarize" }, { status: 500 });
  }
}
