import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: deckId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  if (!Array.isArray(body.cardIds) || body.cardIds.some((x: unknown) => typeof x !== "string")) {
    return Response.json({ error: "cardIds must be an array of strings" }, { status: 400 });
  }
  const cardIds: string[] = body.cardIds;

  // Verify deck ownership
  const { data: deck } = await supabase
    .from("decks")
    .select("id")
    .eq("id", deckId)
    .eq("user_id", user.id)
    .single();

  if (!deck) return Response.json({ error: "Deck not found" }, { status: 404 });

  // Update sort_order for each card, scoped to this deck for safety
  const results = await Promise.all(
    cardIds.map((cardId, idx) =>
      supabase
        .from("cards")
        .update({ sort_order: idx })
        .eq("id", cardId)
        .eq("deck_id", deckId)
    )
  );

  const firstErr = results.find((r) => r.error);
  if (firstErr?.error) return Response.json({ error: firstErr.error.message }, { status: 500 });

  return Response.json({ ok: true });
}
