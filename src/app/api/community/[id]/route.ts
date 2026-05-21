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

  const { data: sessionStats } = await supabase
    .from("sessions")
    .select("score, total, user_id")
    .eq("deck_id", id)
    .not("completed_at", "is", null)
    .gt("total", 0);

  let avgPct: number | null = null;
  let learnerCount = 0;
  if (sessionStats && sessionStats.length > 0) {
    const uniqueUsers = new Set(sessionStats.map((s) => s.user_id)).size;
    const totalCorrect = sessionStats.reduce((sum, s) => sum + (s.score ?? 0), 0);
    const totalAnswers = sessionStats.reduce((sum, s) => sum + (s.total ?? 0), 0);
    avgPct = totalAnswers > 0 ? Math.round((totalCorrect / totalAnswers) * 100) : null;
    learnerCount = uniqueUsers;
  }

  return Response.json({ deck, cards: cards ?? [], avgPct, learnerCount });
}
