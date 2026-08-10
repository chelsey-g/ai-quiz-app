import { createClient as createServiceClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

type DB = Database;

function serviceClient() {
  return createServiceClient<DB>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export type CardResult = { cardId: string; correct: boolean };

export async function updateCardStats(userId: string, results: CardResult[]): Promise<void> {
  if (results.length === 0) return;
  const db = serviceClient();
  const cardIds = results.map((r) => r.cardId);
  const now = new Date().toISOString();

  const { data: existingCards, error: fetchError } = await db
    .from("cards")
    .select("id, times_seen, times_correct, decks!inner(user_id)")
    .in("id", cardIds)
    .eq("decks.user_id", userId);

  if (fetchError || !existingCards) return;

  const cardMap = new Map(existingCards.map((c) => [c.id, c]));
  await Promise.all(
    results.map(({ cardId, correct }) => {
      const card = cardMap.get(cardId);
      if (!card) return Promise.resolve();
      return db
        .from("cards")
        .update({
          times_seen: card.times_seen + 1,
          times_correct: card.times_correct + (correct ? 1 : 0),
          last_seen_at: now,
        })
        .eq("id", cardId);
    })
  );
}
