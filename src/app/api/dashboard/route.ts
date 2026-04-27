import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 1. Get all deck IDs for this user
  const { data: decks, error: decksError } = await supabase
    .from("decks")
    .select("id")
    .eq("user_id", user.id);

  if (decksError) {
    return Response.json({ error: decksError.message }, { status: 500 });
  }

  const deckIds = (decks ?? []).map((d) => d.id);

  if (deckIds.length === 0) {
    return Response.json({
      totalCards: 0,
      totalSeen: 0,
      totalCorrect: 0,
      cardsDueToday: 0,
      recentDeckIds: [],
      dueCounts: {},
    });
  }

  // 2. Fetch cards + recent sessions in parallel
  const [{ data: cards, error: cardsError }, { data: sessions, error: sessionsError }] =
    await Promise.all([
      supabase
        .from("cards")
        .select("deck_id, times_seen, times_correct, next_review_at")
        .in("deck_id", deckIds),
      supabase
        .from("sessions")
        .select("deck_id, completed_at")
        .eq("user_id", user.id)
        .not("completed_at", "is", null)
        .order("completed_at", { ascending: false })
        .limit(20),
    ]);

  if (cardsError) {
    return Response.json({ error: cardsError.message }, { status: 500 });
  }
  if (sessionsError) {
    return Response.json({ error: sessionsError.message }, { status: 500 });
  }

  const now = new Date().toISOString();
  const allCards = cards ?? [];

  const totalCards = allCards.length;
  const totalSeen = allCards.reduce((s, c) => s + c.times_seen, 0);
  const totalCorrect = allCards.reduce((s, c) => s + c.times_correct, 0);

  const isDue = (c: { times_seen: number; next_review_at: string | null }) =>
    c.times_seen > 0 && c.next_review_at !== null && c.next_review_at <= now;

  const cardsDueToday = allCards.filter(isDue).length;

  const dueCounts: Record<string, number> = {};
  for (const card of allCards) {
    if (isDue(card)) {
      dueCounts[card.deck_id] = (dueCounts[card.deck_id] ?? 0) + 1;
    }
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
