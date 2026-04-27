import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch all cards for the user's decks in one query
  const { data: cards, error: cardsError } = await supabase
    .from("cards")
    .select("deck_id, times_seen, times_correct, next_review_at")
    .in(
      "deck_id",
      (
        await supabase
          .from("decks")
          .select("id")
          .eq("user_id", user.id)
      ).data?.map((d) => d.id) ?? []
    );

  if (cardsError) {
    return Response.json({ error: cardsError.message }, { status: 500 });
  }

  const now = new Date().toISOString();
  const allCards = cards ?? [];

  // Global stats
  const totalCards = allCards.length;
  const totalSeen = allCards.reduce((s, c) => s + c.times_seen, 0);
  const totalCorrect = allCards.reduce((s, c) => s + c.times_correct, 0);

  // Due condition: times_seen > 0 AND next_review_at <= now
  const isDue = (c: { times_seen: number; next_review_at: string | null }) =>
    c.times_seen > 0 && c.next_review_at !== null && c.next_review_at <= now;

  const cardsDueToday = allCards.filter(isDue).length;

  // Per-deck due counts
  const dueCounts: Record<string, number> = {};
  for (const card of allCards) {
    if (isDue(card)) {
      dueCounts[card.deck_id] = (dueCounts[card.deck_id] ?? 0) + 1;
    }
  }

  // Recently studied: up to 5 distinct deck_ids ordered by most recent completed session
  const { data: sessions, error: sessionsError } = await supabase
    .from("sessions")
    .select("deck_id, completed_at")
    .eq("user_id", user.id)
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: false })
    .limit(20);

  if (sessionsError) {
    return Response.json({ error: sessionsError.message }, { status: 500 });
  }

  const seen = new Set<string>();
  const recentDeckIds: string[] = [];
  for (const s of sessions ?? []) {
    if (!seen.has(s.deck_id) && recentDeckIds.length < 5) {
      seen.add(s.deck_id);
      recentDeckIds.push(s.deck_id);
    }
  }

  return Response.json({
    totalCards,
    totalSeen,
    totalCorrect,
    cardsDueToday,
    recentDeckIds,
    dueCounts,
  });
}
