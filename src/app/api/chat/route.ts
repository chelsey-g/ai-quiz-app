import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDeckById } from "@/lib/services/decks";

const BASE_SYSTEM_PROMPT =
  "You are Quizly's study assistant. Help the user study, understand concepts, " +
  "and use the app. Be concise and direct. No markdown tables.";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as {
    messages: UIMessage[];
    deckId?: string;
    mentionedCardIds?: string[];
  };

  let systemPrompt = BASE_SYSTEM_PROMPT;

  if (body.deckId) {
    try {
      const { deck, cards } = await getDeckById(body.deckId, user.id);
      systemPrompt += `\n\nThe user is currently viewing the deck "${deck.title}".`;

      if (body.mentionedCardIds && body.mentionedCardIds.length > 0) {
        const mentioned = cards.filter((c) => body.mentionedCardIds!.includes(c.id));
        if (mentioned.length > 0) {
          const cardBlocks = mentioned
            .map((c) => `- Front: ${c.front}\n  Back: ${c.back}`)
            .join("\n");
          systemPrompt += `\n\nThe user is asking specifically about these flashcards:\n${cardBlocks}`;
        }
      }
    } catch {
      // Deck not found, or not owned by this user — fall back to general context.
    }
  }

  const result = streamText({
    model: gateway("openai/gpt-4o-mini"),
    providerOptions: {
      gateway: { models: ["anthropic/claude-haiku-4.5", "anthropic/claude-sonnet-4-6", "openai/gpt-4o"] },
    },
    system: systemPrompt,
    messages: await convertToModelMessages(body.messages),
  });

  return result.toUIMessageStreamResponse({
    onError: () => "Sorry, I couldn't process that — try again.",
  });
}
