import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";

async function getCardAndVerifyOwner(cardId: string, userId: string) {
  const supabase = await createClient();
  const { data: card, error } = await supabase
    .from("cards")
    .select("id, deck_id, back, decks!inner(user_id)")
    .eq("id", cardId)
    .single();

  if (error || !card) return { card: null, supabase };

  const deckUserId = (card.decks as unknown as { user_id: string | null }).user_id;
  if (deckUserId !== userId) return { card: null, supabase };

  return { card, supabase };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { card } = await getCardAndVerifyOwner(id, user.id);
  if (!card) return Response.json({ error: "Card not found" }, { status: 404 });

  const body = await req.json();
  const front = typeof body.front === "string" ? body.front.trim() : null;
  const back = typeof body.back === "string" ? body.back.trim() : null;

  if (!front || !back) {
    return Response.json({ error: "front and back are required" }, { status: 400 });
  }

  // If the answer text changed, any previously-generated MC data (distractors
  // sized/worded against the old answer) is stale — clear it and mark the
  // card pending so it regenerates against the new answer on next deck load.
  const backChanged = back !== card.back;

  const { error } = await supabase
    .from("cards")
    .update(
      backChanged
        ? { front, back, mc_status: "pending", mc_distractors: null, mc_condensed_answer: null }
        : { front, back }
    )
    .eq("id", id);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { card } = await getCardAndVerifyOwner(id, user.id);
  if (!card) return Response.json({ error: "Card not found" }, { status: 404 });

  const deckId = card.deck_id;

  const { error: deleteError } = await supabase.from("cards").delete().eq("id", id);
  if (deleteError) return Response.json({ error: deleteError.message }, { status: 500 });

  // Decrement denormalized card_count (floor at 0)
  const { data: deck } = await supabase
    .from("decks")
    .select("card_count")
    .eq("id", deckId)
    .single();

  if (deck) {
    await supabase
      .from("decks")
      .update({ card_count: Math.max(0, deck.card_count - 1) })
      .eq("id", deckId);
  }

  return Response.json({ ok: true });
}
