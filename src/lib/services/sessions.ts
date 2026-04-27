import { createClient as createServiceClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { sm2, qualityFromCorrect } from "@/lib/sm2";

// Service-role client — bypasses RLS for card updates. Never expose to the client.
function serviceClient() {
  return createServiceClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export type SaveSessionData = {
  userId: string;
  deckId: string;
  score: number;
  startedAt: string;
  results: { cardId: string; correct: boolean }[];
};

/**
 * Persists a completed study session and updates per-card SM-2 scheduling.
 * Uses the service-role key so that card updates bypass RLS.
 * Mirrors the logic in POST /api/sessions.
 */
export async function saveSession(data: SaveSessionData): Promise<void> {
  const { userId, deckId, score, startedAt, results } = data;
  const db = serviceClient();
  const now = new Date().toISOString();

  const { error: sessionError } = await db.from("sessions").insert({
    user_id: userId,
    deck_id: deckId,
    score,
    started_at: startedAt,
    completed_at: now,
  });

  if (sessionError) {
    throw new Error(sessionError.message);
  }

  if (results.length > 0) {
    const cardIds = results.map((r) => r.cardId);
    const { data: existingCards, error: fetchError } = await db
      .from("cards")
      .select("id, times_seen, times_correct, repetitions, ease_factor, interval_days")
      .in("id", cardIds);

    if (!fetchError && existingCards) {
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
  }
}
