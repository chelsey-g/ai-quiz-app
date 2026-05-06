import { NextRequest, NextResponse } from "next/server";
import { generateObject } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const MODEL_PRIORITY = [
  { provider: "openai" as const, model: "gpt-4o-mini" },
  { provider: "anthropic" as const, model: "claude-haiku-4-5-20251001" },
  { provider: "anthropic" as const, model: "claude-sonnet-4-6" },
  { provider: "openai" as const, model: "gpt-4o" },
];

const AnswerSchema = z.object({ answer: z.string() });

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { question, deckTitle, tags } = await req.json();
  if (!question?.trim()) return NextResponse.json({ error: "question is required" }, { status: 400 });

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  const anthropic = anthropicKey ? createAnthropic({ apiKey: anthropicKey }) : null;
  const openai = openaiKey ? createOpenAI({ apiKey: openaiKey }) : null;

  const context = [
    deckTitle && `Deck: ${deckTitle}`,
    tags?.length && `Tags: ${tags.join(", ")}`,
  ].filter(Boolean).join("\n");

  const systemPrompt =
    "You are a flashcard answer generator. Given a flashcard question, write a clear, concise answer suitable for active recall study. " +
    "The answer should be complete enough to be useful but concise enough to fit on a flashcard. " +
    "Do not include the question in your answer. Return only the answer text.";

  const userPrompt = context
    ? `${context}\n\nQuestion: ${question.trim()}`
    : `Question: ${question.trim()}`;

  const errors: string[] = [];
  for (const { provider, model } of MODEL_PRIORITY) {
    const client = provider === "anthropic" ? anthropic : openai;
    if (!client) continue;
    try {
      const { object } = await generateObject({
        model: client(model),
        schema: AnswerSchema,
        system: systemPrompt,
        prompt: userPrompt,
      });
      return NextResponse.json({ answer: object.answer });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      errors.push(`${provider}/${model}: ${reason}`);
    }
  }

  return NextResponse.json({ error: "All models failed", details: errors }, { status: 502 });
}
