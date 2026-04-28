import { createClient as createServiceClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { sm2, qualityFromCorrect } from "@/lib/sm2";

type DB = Database;

function serviceClient() {
  return createServiceClient<DB>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export type CardResult = { cardId: string; correct: boolean };

/**
 * Updates times_seen, times_correct, and SM-2 scheduling fields for each card.
 * Uses the service-role key to bypass RLS.
 * Called by both saveSession (deck quiz) and updateCardStats (quick quiz).
 */
export async function updateCardStats(results: CardResult[]): Promise<void> {
  if (results.length === 0) return;
  const db = serviceClient();
  const cardIds = results.map((r) => r.cardId);
  const now = new Date().toISOString();

  const { data: existingCards, error: fetchError } = await db
    .from("cards")
    .select("id, times_seen, times_correct, repetitions, ease_factor, interval_days")
    .in("id", cardIds);

  if (fetchError || !existingCards) return;

  const cardMap = new Map(existingCards.map((c) => [c.id, c]));
  await Promise.all(
    results.map(({ cardId, correct }) => {
      const card = cardMap.get(cardId);
      if (!card) return Promise.resolve();
      const scheduling = sm2(card, qualityFromCorrect(correct));
      return db
        .from("cards")
        .update({
          times_seen: card.times_seen + 1,
          times_correct: card.times_correct + (correct ? 1 : 0),
          last_seen_at: now,
          repetitions: scheduling.repetitions,
          ease_factor: scheduling.ease_factor,
          interval_days: scheduling.interval_days,
          next_review_at: scheduling.next_review_at,
        })
        .eq("id", cardId);
    })
  );
}
