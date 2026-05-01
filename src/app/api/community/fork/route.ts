import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const deckId = typeof body.deckId === "string" ? body.deckId : null;
  if (!deckId) return Response.json({ error: "deckId is required" }, { status: 400 });

  // Verify source deck is public
  const { data: source, error: srcErr } = await supabase
    .from("decks")
    .select("id, title, topic_tags, card_count")
    .eq("id", deckId)
    .eq("is_public", true)
    .single();

  if (srcErr || !source) return Response.json({ error: "Deck not found" }, { status: 404 });

  // Copy deck
  const { data: newDeck, error: deckErr } = await supabase
    .from("decks")
    .insert({
      title: source.title,
      topic_tags: source.topic_tags,
      card_count: source.card_count,
      user_id: user.id,
      is_public: false,
    })
    .select("id")
    .single();

  if (deckErr || !newDeck) return Response.json({ error: deckErr?.message ?? "Insert failed" }, { status: 500 });

  // Copy cards
  const { data: sourceCards, error: cardsErr } = await supabase
    .from("cards")
    .select("front, back, card_type, tags")
    .eq("deck_id", deckId);

  if (cardsErr) return Response.json({ error: cardsErr.message }, { status: 500 });

  if (sourceCards && sourceCards.length > 0) {
    const { error: insertErr } = await supabase.from("cards").insert(
      sourceCards.map((c) => ({
        deck_id: newDeck.id,
        front: c.front,
        back: c.back,
        card_type: c.card_type,
        tags: c.tags ?? [],
        times_seen: 0,
        times_correct: 0,
      }))
    );
    if (insertErr) return Response.json({ error: insertErr.message }, { status: 500 });
  }

  return Response.json({ deckId: newDeck.id }, { status: 201 });
}
