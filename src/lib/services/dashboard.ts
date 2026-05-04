import { createClient } from "@/lib/supabase/server";
import { computeStreak } from "@/lib/streak";
import type { StreakStatus } from "@/lib/streak";

export type DashboardStats = {
  totalCards: number;
  totalSeen: number;
  totalCorrect: number;
  freshCards: number;
  recentDeckIds: string[];
  streakDays: number;
  streakStatus: StreakStatus;
};

/**
 * Returns global study stats for the given user. Mirrors the logic in
 * GET /api/dashboard — deck IDs, card aggregates, due counts, recent sessions,
 * and current study streak.
 */
export async function getDashboardStats(userId: string): Promise<DashboardStats> {
  const supabase = await createClient();

  const { data: decks, error: decksError } = await supabase
    .from("decks")
    .select("id")
    .eq("user_id", userId);

  if (decksError) {
    throw new Error(decksError.message);
  }

  const deckIds = (decks ?? []).map((d) => d.id);

  if (deckIds.length === 0) {
    return {
      totalCards: 0,
      totalSeen: 0,
      totalCorrect: 0,
      freshCards: 0,
      recentDeckIds: [],
      streakDays: 0,
      streakStatus: "none",
    };
  }

  const [
    { data: cards, error: cardsError },
    { data: recentSessions, error: recentSessionsError },
    { data: allSessionDates, error: allSessionDatesError },
  ] = await Promise.all([
    supabase
      .from("cards")
      .select("deck_id, times_seen, times_correct")
      .in("deck_id", deckIds),
    supabase
      .from("sessions")
      .select("deck_id, completed_at")
      .eq("user_id", userId)
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false })
      .limit(20),
    supabase
      .from("sessions")
      .select("completed_at")
      .eq("user_id", userId)
      .not("completed_at", "is", null),
  ]);

  if (cardsError) {
    throw new Error(cardsError.message);
  }
  if (recentSessionsError) {
    throw new Error(recentSessionsError.message);
  }
  if (allSessionDatesError) {
    throw new Error(allSessionDatesError.message);
  }

  const allCards = cards ?? [];

  const totalCards = allCards.length;
  const totalSeen = allCards.reduce((s, c) => s + c.times_seen, 0);
  const totalCorrect = allCards.reduce((s, c) => s + c.times_correct, 0);
  const freshCards = allCards.filter((c) => c.times_seen === 0).length;

  const seen = new Set<string>();
  const recentDeckIds: string[] = [];
  for (const s of recentSessions ?? []) {
    if (!seen.has(s.deck_id) && recentDeckIds.length < 5) {
      seen.add(s.deck_id);
      recentDeckIds.push(s.deck_id);
    }
  }

  const completedAts = (allSessionDates ?? [])
    .map((s) => s.completed_at)
    .filter((ts): ts is string => ts !== null);

  const { streakDays, streakStatus } = computeStreak(completedAts);

  return {
    totalCards,
    totalSeen,
    totalCorrect,
    freshCards,
    recentDeckIds,
    streakDays,
    streakStatus,
  };
}
