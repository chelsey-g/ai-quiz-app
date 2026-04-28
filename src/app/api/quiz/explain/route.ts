import { streamText } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { NextRequest } from "next/server";

type WrongAnswer = {
  cardId: string;
  question: string;
  correctAnswer: string;
  userAnswer: string;
};

const MODEL_PRIORITY = [
  { provider: "openai" as const, model: "gpt-4o-mini" },
  { provider: "anthropic" as const, model: "claude-haiku-4-5-20251001" },
];

async function explainOneCard(
  wrong: WrongAnswer,
  controller: ReadableStreamDefaultController<Uint8Array>
): Promise<void> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  const anthropic = anthropicKey ? createAnthropic({ apiKey: anthropicKey }) : null;
  const openai = openaiKey ? createOpenAI({ apiKey: openaiKey }) : null;

  const encoder = new TextEncoder();

  const prompt =
    `Question: ${wrong.question}\n` +
    `Correct answer: ${wrong.correctAnswer}\n` +
    `Student answered: ${wrong.userAnswer}\n\n` +
    `Explain in 1–2 sentences why the correct answer is right and where the student went wrong. Be concise and direct.`;

  const errors: string[] = [];

  for (const { provider, model } of MODEL_PRIORITY) {
    const client = provider === "anthropic" ? anthropic : openai;
    if (!client) continue;

    try {
      const result = streamText({
        model: client(model),
        system:
          "You are a concise tutor. Given a quiz question, the correct answer, and what a student answered, " +
          "explain in 1–2 plain sentences why the correct answer is right and where the student's reasoning " +
          "went wrong. Do not repeat the question or answers back verbatim. No markdown.",
        prompt,
      });

      for await (const chunk of result.textStream) {
        const line = JSON.stringify({ cardId: wrong.cardId, chunk }) + "\n";
        controller.enqueue(encoder.encode(line));
      }

      const doneLine = JSON.stringify({ cardId: wrong.cardId, done: true }) + "\n";
      controller.enqueue(encoder.encode(doneLine));
      return;
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      errors.push(`${provider}/${model}: ${reason}`);
      console.warn(`explain: model failed, trying next. ${provider}/${model}: ${reason}`);
    }
  }

  // All models failed — emit an error sentinel so the client can show a fallback
  const errLine =
    JSON.stringify({ cardId: wrong.cardId, error: "Could not generate explanation." }) + "\n";
  controller.enqueue(encoder.encode(errLine));
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { wrongAnswers: WrongAnswer[] };

  if (!body.wrongAnswers || !Array.isArray(body.wrongAnswers) || body.wrongAnswers.length === 0) {
    return Response.json({ error: "No wrong answers provided" }, { status: 400 });
  }

  // Cap at 10 explanations to limit cost
  const wrongAnswers = body.wrongAnswers.slice(0, 10);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // Explain cards sequentially to avoid hammering the API
      for (const wrong of wrongAnswers) {
        await explainOneCard(wrong, controller);
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Transfer-Encoding": "chunked",
      "Cache-Control": "no-store",
    },
  });
}
