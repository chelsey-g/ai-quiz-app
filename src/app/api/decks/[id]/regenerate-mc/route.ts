import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";

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

  // Verify ownership before mutating any cards.
  const { data: deck, error: deckError } = await supabase
    .from("decks")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (deckError || !deck) return Response.json({ error: "Deck not found" }, { status: 404 });

  const { error } = await supabase
    .from("cards")
    .update({ mc_status: "pending" })
    .eq("deck_id", id);

  if (error) return Response.json({ error: error.message }, { status: 500 });

  // Don't kick off generation directly — the existing GET /api/decks/[id]
  // handler already fires generateAndSaveDistractorsForDeck whenever it sees
  // pending/failed cards, and the deck detail page already polls until no
  // card is pending. Reuse that path instead of building a second one.
  return Response.json({ ok: true });
}
