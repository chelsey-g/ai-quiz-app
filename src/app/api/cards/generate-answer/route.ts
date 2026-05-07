import { NextRequest, NextResponse } from "next/server";
import { streamText } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { createClient } from "@/lib/supabase/server";

const SYSTEM_PROMPT =
  "You are a flashcard answer generator. Given a flashcard question, write a clear, concise answer suitable for active recall study. " +
  "The answer should be complete enough to be useful but concise enough to fit on a flashcard. " +
  "Do not include the question in your answer. Return only the answer text.";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { question, deckTitle, tags } = await req.json();
  if (!question?.trim()) return NextResponse.json({ error: "question is required" }, { status: 400 });

  const context = [
    deckTitle && `Deck: ${deckTitle}`,
    tags?.length && `Tags: ${tags.join(", ")}`,
  ].filter(Boolean).join("\n");

  const prompt = context
    ? `${context}\n\nQuestion: ${question.trim()}`
    : `Question: ${question.trim()}`;

  const result = streamText({
    model: gateway("google/gemini-2.0-flash"),
    providerOptions: {
      gateway: { models: ["openai/gpt-4o-mini", "anthropic/claude-haiku-4.5"] },
    },
    system: SYSTEM_PROMPT,
    prompt,
  });

  return result.toTextStreamResponse();
}
