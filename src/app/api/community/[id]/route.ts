import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: deck, error: deckErr } = await supabase
    .from("decks")
    .select("id, title, topic_tags, card_count, user_id")
    .eq("id", id)
    .eq("is_public", true)
    .single();

  if (deckErr || !deck) return Response.json({ error: "Deck not found" }, { status: 404 });

  const { data: cards, error: cardsErr } = await supabase
    .from("cards")
    .select("id, front, back")
    .eq("deck_id", id)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (cardsErr) return Response.json({ error: cardsErr.message }, { status: 500 });

  return Response.json({ deck, cards: cards ?? [] });
}
