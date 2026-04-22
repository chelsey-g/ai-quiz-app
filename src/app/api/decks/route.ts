import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export async function GET() {
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from("decks")
    .select("*, cards(times_seen, times_correct)")
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
