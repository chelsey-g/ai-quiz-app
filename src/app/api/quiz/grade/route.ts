import { createClient } from "@/lib/supabase/server";
import { generateObject } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { z } from "zod";
import { NextRequest } from "next/server";

const GradeSchema = z.object({
  correct: z.boolean(),
});

const GRADE_SYSTEM_PROMPT =
  "You grade typed quiz answers. Be lenient: accept answers that express the same concept " +
  "in different words, tolerate minor spelling errors, and accept partial answers that capture " +
  "the key idea. Only mark wrong if the answer reflects a genuine misunderstanding, is " +
  "completely off-topic, or is clearly insufficient.";

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
        `Is the student's answer correct?`,
    });
    return Response.json({ correct: object.correct });
  } catch {
    // Fail safe: return false so the quiz continues without crashing
    return Response.json({ correct: false });
  }
}
