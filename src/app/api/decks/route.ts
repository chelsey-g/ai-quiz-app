import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("decks")
    .select("*, cards(times_seen, times_correct)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const decksWithStats = (data ?? []).map((deck) => {
    const cards = deck.cards ?? [];
    const totalSeen = cards.reduce((s, c) => s + c.times_seen, 0);
    const totalCorrect = cards.reduce((s, c) => s + c.times_correct, 0);
    const unattemptedCount = cards.filter((c) => c.times_seen === 0).length;
    const { cards: _, ...deckBase } = deck;
    return {
      ...deckBase,
      total_seen: totalSeen,
      total_correct: totalCorrect,
      unattempted_count: unattemptedCount,
    };
  });

  return Response.json(decksWithStats);
}
