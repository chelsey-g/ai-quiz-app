import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDeckById, getDecksByCollection } from "@/lib/services/decks";

const BASE_SYSTEM_PROMPT =
  "You are Quizly's study assistant. Help the user study, understand concepts, " +
  "and use the app. Be concise and direct. No markdown tables.";

const MAX_CARDS_PER_MENTIONED_DECK = 40;

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
    mentionedDeckIds?: string[];
    mentionedCollectionIds?: string[];
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

  // Mentioned decks are re-fetched (never trusting client-supplied card text),
  // scoped to this user via the same RLS-backed lookup as the current-deck case.
  if (body.mentionedDeckIds && body.mentionedDeckIds.length > 0) {
    for (const mentionedDeckId of body.mentionedDeckIds) {
      try {
        const { deck, cards } = await getDeckById(mentionedDeckId, user.id);
        const shown = cards.slice(0, MAX_CARDS_PER_MENTIONED_DECK);
        const cardBlocks = shown.map((c) => `- Front: ${c.front}\n  Back: ${c.back}`).join("\n");
        const truncatedNote =
          cards.length > shown.length ? `, showing first ${shown.length}` : "";
        systemPrompt += `\n\nThe user referenced the deck "${deck.title}" (${cards.length} cards${truncatedNote}):\n${cardBlocks}`;
      } catch {
        // Deck not found, or not owned by this user — skip it.
      }
    }
  }

  // Mentioned collections get an overview (deck titles only, not full card
  // content) — enough to answer "what's in this collection" without the
  // token cost of dumping every card in every deck it contains.
  if (body.mentionedCollectionIds && body.mentionedCollectionIds.length > 0) {
    for (const collectionId of body.mentionedCollectionIds) {
      const { data: collection } = await supabase
        .from("collections")
        .select("id, name")
        .eq("id", collectionId)
        .eq("user_id", user.id)
        .single();

      if (!collection) continue;

      const decksInCollection = await getDecksByCollection(collectionId, user.id);
      if (decksInCollection.length === 0) {
        systemPrompt += `\n\nThe user referenced the collection "${collection.name}", which has no decks.`;
        continue;
      }

      const deckList = decksInCollection.map((d) => `- ${d.title}`).join("\n");
      systemPrompt += `\n\nThe user referenced the collection "${collection.name}", which contains these decks:\n${deckList}`;
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
