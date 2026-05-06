import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";
import { generateDistractors } from "@/lib/ai/generate-distractors";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: deckId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  // Verify deck ownership
  const { data: deck, error: deckError } = await supabase
    .from("decks")
    .select("id, card_count, title, topic_tags")
    .eq("id", deckId)
    .eq("user_id", user.id)
    .single();

  if (deckError || !deck) {
    return Response.json({ error: "Deck not found" }, { status: 404 });
  }

  const body = await req.json();
  const front = typeof body.front === "string" ? body.front.trim() : null;
  const back = typeof body.back === "string" ? body.back.trim() : null;
  const tags = Array.isArray(body.tags) ? (body.tags as unknown[]).filter((t): t is string => typeof t === "string") : [];

  if (!front || !back) {
    return Response.json({ error: "front and back are required" }, { status: 400 });
  }

  const { data: card, error: insertError } = await supabase
    .from("cards")
    .insert({ deck_id: deckId, front, back, card_type: "basic", tags })
    .select()
    .single();

  if (insertError || !card) {
    return Response.json({ error: insertError?.message ?? "Insert failed" }, { status: 500 });
  }

  await supabase
    .from("decks")
    .update({ card_count: deck.card_count + 1 })
    .eq("id", deckId);

  // Generate and persist distractors in the background — card is returned immediately.
  generateDistractors(
    [{ cardId: card.id, front: card.front, back: card.back }],
    deck.title,
  ).then((result) => {
    const distractors = result[card.id];
    if (distractors?.length) {
      createClient().then((sb) =>
        sb.from("cards").update({ mc_distractors: distractors }).eq("id", card.id)
      );
    }
  }).catch(() => {});

  return Response.json(card, { status: 201 });
}
