import { createClient as createServiceClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { updateCardStats } from "@/lib/services/card-stats";

// Service-role client — bypasses RLS for session inserts. Never expose to the client.
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
    total: results.length,
    started_at: startedAt,
    completed_at: now,
  });

  if (sessionError) {
    throw new Error(sessionError.message);
  }

  if (results.length > 0) {
    await updateCardStats(results);
  }
}
