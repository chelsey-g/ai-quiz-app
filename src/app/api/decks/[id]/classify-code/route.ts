// src/app/api/decks/[id]/classify-code/route.ts
import { NextRequest } from "next/server";
import { generateObject } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { createClient } from "@/lib/supabase/server";
import { CodeClassificationSchema } from "@/lib/ai/schema";

export async function classifyCodeDeck(deckId: string): Promise<void> {
  const supabase = await createClient();

  const { data: deck } = await supabase
    .from("decks")
    .select("title, topic_tags")
    .eq("id", deckId)
    .single();

  if (!deck) return;

  const { data: cards } = await supabase
    .from("cards")
    .select("front")
    .eq("deck_id", deckId)
    .limit(10);

  const cardSamples = (cards ?? []).map((c) => c.front).join("\n- ");

  const { object } = await generateObject({
    model: gateway("openai/gpt-4o-mini"),
    providerOptions: {
      gateway: { models: ["anthropic/claude-haiku-4.5"] },
    },
    schema: CodeClassificationSchema,
    system:
      "You classify study decks. Respond true only if the deck is primarily about programming or software development topics (JavaScript, TypeScript, algorithms, data structures, browser APIs, Node.js, etc.). Respond false for math, history, science, language learning, and all other topics.",
    prompt: `Deck title: ${deck.title}\nTags: ${(deck.topic_tags ?? []).join(", ")}\nSample card fronts:\n- ${cardSamples}`,
  });

  await supabase
    .from("decks")
    .update({ is_code_deck: object.is_code_deck })
    .eq("id", deckId);
}

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

  try {
    await classifyCodeDeck(id);
    return Response.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Classification failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
