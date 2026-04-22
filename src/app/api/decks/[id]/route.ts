import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [{ data: deck, error: deckError }, { data: cards, error: cardsError }] =
    await Promise.all([
      supabase.from("decks").select("*").eq("id", id).eq("user_id", user.id).single(),
      supabase.from("cards").select("*").eq("deck_id", id).order("created_at"),
    ]);

  if (deckError) {
    const status = deckError.code === "PGRST116" ? 404 : 500;
    return Response.json({ error: deckError.message }, { status });
  }

  return Response.json({ deck, cards: cards ?? [] });
}
