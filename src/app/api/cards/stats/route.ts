import { createClient } from "@/lib/supabase/server";
import { updateCardStats } from "@/lib/services/card-stats";
import { NextRequest } from "next/server";

/**
 * POST /api/cards/stats
 * Updates card stat fields (times_seen, times_correct, SM-2 scheduling)
 * without creating a session row. Used by Quick Quiz which spans multiple
 * decks and has no single deck_id to attach to a session.
 *
 * Body: { results: { cardId: string; correct: boolean }[] }
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as {
    results: { cardId: string; correct: boolean }[];
  };

  if (!body.results || !Array.isArray(body.results)) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const cardIds = body.results.map((r) => r.cardId).filter(Boolean);

  if (cardIds.length > 0) {
    const { data: ownedCards } = await supabase
      .from("cards")
      .select("id")
      .in("id", cardIds)
      .eq("decks.user_id", user.id)
      .select("id, decks!inner(user_id)");

    const ownedIds = new Set((ownedCards ?? []).map((c) => c.id));
    body.results = body.results.filter((r) => ownedIds.has(r.cardId));
  }

  try {
    await updateCardStats(body.results);
    return Response.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
