import { createClient } from "@/lib/supabase/server";
import { generateObject } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { z } from "zod";
import { NextRequest } from "next/server";

const GradeSchema = z.object({
  correct: z.boolean(),
});

const GRADE_SYSTEM_PROMPT =
  "You grade typed quiz answers. Evaluate whether the student's answer demonstrates " +
  "understanding of the correct concept — not whether it matches the wording of the model answer. " +
  "Accept answers that express the same idea in different words. " +
  "Reject answers that are too vague to confirm understanding, off-topic, or contradict the correct answer.";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { question, userAnswer, correctAnswer } = body as {
    question?: string;
    userAnswer?: string;
    correctAnswer?: string;
  };

  if (!question || !userAnswer || !correctAnswer) {
    return Response.json({ error: "question, userAnswer, and correctAnswer are required" }, { status: 400 });
  }

  try {
    const { object } = await generateObject({
      model: gateway("google/gemini-2.0-flash"),
      providerOptions: {
        gateway: { models: ["openai/gpt-4o-mini", "anthropic/claude-haiku-4.5"] },
      },
      schema: GradeSchema,
      system: GRADE_SYSTEM_PROMPT,
      prompt:
        `Question: ${question}\n` +
        `Correct answer: ${correctAnswer}\n` +
        `Student answered: ${userAnswer}\n\n` +
        `Does the student demonstrate basic understanding and were the core concepts of the answer touched?`,
    });
    return Response.json({ correct: object.correct });
  } catch {
    // Fail safe: return false so the quiz continues without crashing
    return Response.json({ correct: false });
  }
}
