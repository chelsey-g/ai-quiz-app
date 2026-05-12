import { createClient } from "@/lib/supabase/server";
import { generateObject } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { z } from "zod";
import { NextRequest } from "next/server";
import { generateAndSaveDistractorsForDeck } from "@/lib/services/distractors";

const ExpandSchema = z.object({
  cards: z
    .array(
      z.object({
        front: z.string().describe("Question or term — one sentence max"),
        back: z.string().describe("Concise but complete answer or definition"),
      })
    )
    .min(5)
    .max(8),
});

const EXPAND_SYSTEM_PROMPT =
  "You are a study content generator. Given a deck title, its topic tags, and a list of questions it already covers, " +
  "generate additional flashcards that fill gaps — covering related concepts, common gotchas, edge cases, and deeper details not already addressed. " +
  "Every card must be self-contained.";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { data: deck, error: deckError } = await supabase
    .from("decks")
    .select("id, title, topic_tags, user_id, card_count")
    .eq("id", id)
    .single();

  if (deckError || !deck) return Response.json({ error: "Deck not found" }, { status: 404 });
  if (deck.user_id !== user.id) return Response.json({ error: "Forbidden" }, { status: 403 });

  const { data: existingCards } = await supabase
    .from("cards")
    .select("front")
    .eq("deck_id", id);

  const existingFronts = (existingCards ?? []).map((c) => c.front);
  const tags = (deck.topic_tags as string[] | null) ?? [];

  const userPrompt =
    `Deck: ${deck.title}\n` +
    `Topics: ${tags.join(", ")}\n\n` +
    `Already covered (do not duplicate):\n` +
    existingFronts.map((f) => `- ${f}`).join("\n") +
    `\n\nGenerate 5–8 new cards.`;

  let generated: z.infer<typeof ExpandSchema>;
  try {
    const { object } = await generateObject({
      model: gateway("openai/gpt-4o-mini"),
      providerOptions: {
        gateway: { models: ["anthropic/claude-haiku-4.5", "anthropic/claude-sonnet-4-6"] },
      },
      schema: ExpandSchema,
      system: EXPAND_SYSTEM_PROMPT,
      prompt: userPrompt,
    });
    generated = object;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "AI generation failed";
    return Response.json({ error: msg }, { status: 500 });
  }

  const inserts = generated.cards.map((c) => ({
    deck_id: id,
    front: c.front,
    back: c.back,
    card_type: "flashcard",
  }));

  const { data: newCards, error: insertError } = await supabase
    .from("cards")
    .insert(inserts)
    .select();

  if (insertError || !newCards) {
    return Response.json({ error: insertError?.message ?? "Insert failed" }, { status: 500 });
  }

  await supabase
    .from("decks")
    .update({ card_count: deck.card_count + newCards.length })
    .eq("id", id);

  generateAndSaveDistractorsForDeck(id, deck.title).catch(() => {});

  return Response.json({ cards: newCards, addedCount: newCards.length });
}
