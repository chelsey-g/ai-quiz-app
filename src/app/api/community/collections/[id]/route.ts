import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: collection, error: colErr } = await supabase
    .from("collections")
    .select("id, name, description, is_public, user_id, created_at")
    .eq("id", id)
    .eq("is_public", true)
    .single();

  if (colErr || !collection) {
    return Response.json({ error: "Collection not found" }, { status: 404 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, avatar_url, username")
    .eq("id", collection.user_id)
    .maybeSingle();

  const { data: collectionDecks } = await supabase
    .from("collection_decks")
    .select("deck_id")
    .eq("collection_id", id);

  const deckIds = (collectionDecks ?? []).map((r) => r.deck_id);

  let decks: { id: string; title: string; topic_tags: string[]; card_count: number; description: string | null; avgPct: number | null; learnerCount: number }[] = [];

  if (deckIds.length > 0) {
    const { data: rawDecks } = await supabase
      .from("decks")
      .select("id, title, topic_tags, card_count, description")
      .in("id", deckIds)
      .eq("is_public", true);

    if (rawDecks && rawDecks.length > 0) {
      const { data: sessions } = await supabase
        .from("sessions")
        .select("deck_id, score, total, user_id")
        .in("deck_id", rawDecks.map((d) => d.id))
        .not("completed_at", "is", null)
        .gt("total", 0);

      decks = rawDecks.map((deck) => {
        const deckSessions = (sessions ?? []).filter((s) => s.deck_id === deck.id);
        const uniqueUsers = new Set(deckSessions.map((s) => s.user_id)).size;
        const totalCorrect = deckSessions.reduce((sum, s) => sum + (s.score ?? 0), 0);
        const totalAnswers = deckSessions.reduce((sum, s) => sum + (s.total ?? 0), 0);
        return {
          ...deck,
          avgPct: totalAnswers > 0 ? Math.round((totalCorrect / totalAnswers) * 100) : null,
          learnerCount: uniqueUsers,
        };
      });
    }
  }

  return Response.json({ collection, profile, decks });
}
