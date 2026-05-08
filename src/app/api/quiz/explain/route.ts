import { streamText } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { NextRequest } from "next/server";

type WrongAnswer = {
  cardId: string;
  question: string;
  correctAnswer: string;
  userAnswer: string;
};

async function explainOneCard(
  wrong: WrongAnswer,
  controller: ReadableStreamDefaultController<Uint8Array>
): Promise<void> {
  const encoder = new TextEncoder();

  const prompt =
    `Question: ${wrong.question}\n` +
    `Correct answer: ${wrong.correctAnswer}\n` +
    `Student answered: ${wrong.userAnswer}\n\n` +
    `Explain in 1–2 sentences why the correct answer is right and where the student went wrong. Be concise and direct.`;

  try {
    const result = streamText({
      model: gateway("openai/gpt-4o-mini"),
      providerOptions: {
        gateway: { models: ["anthropic/claude-haiku-4.5"] },
      },
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
  } catch (err) {
    console.warn(`explain: all models failed for card ${wrong.cardId}:`, err);
    const errLine =
      JSON.stringify({ cardId: wrong.cardId, error: "Could not generate explanation." }) + "\n";
    controller.enqueue(encoder.encode(errLine));
  }
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
