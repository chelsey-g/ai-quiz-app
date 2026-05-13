import { createClient } from "@/lib/supabase/server";
import { generateAndSaveDistractorsForDeck } from "@/lib/services/distractors";
import { NextRequest } from "next/server";

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

  const { data: deck, error: deckError } = await supabase
    .from("decks")
    .select("id, card_count, title")
    .eq("id", deckId)
    .eq("user_id", user.id)
    .single();

  if (deckError || !deck) return Response.json({ error: "Deck not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const rawCards = body.cards;

  if (!Array.isArray(rawCards) || rawCards.length === 0) {
    return Response.json({ error: "cards array is required" }, { status: 400 });
  }
  if (rawCards.length > 500) {
    return Response.json({ error: "too many cards (max 500)" }, { status: 400 });
  }

  const inserts = rawCards
    .filter((c) => typeof c.front === "string" && typeof c.back === "string")
    .map((c) => ({
      deck_id: deckId,
      front: c.front.trim(),
      back: c.back.trim(),
      card_type: "flashcard",
    }))
    .filter((c) => c.front && c.back);

  if (inserts.length === 0) {
    return Response.json({ error: "no valid cards to insert" }, { status: 400 });
  }

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
    .eq("id", deckId);

  generateAndSaveDistractorsForDeck(deckId, deck.title).catch(() => {});

  return Response.json({ cards: newCards, addedCount: newCards.length }, { status: 201 });
}
