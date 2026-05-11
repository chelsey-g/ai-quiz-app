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
  cardsStudiedToday: number;
  dailyGoal: number | null;
};

export async function getDashboardStats(userId: string): Promise<DashboardStats> {
  const supabase = await createClient();

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [decksResult, profileResult, todaySessionsResult] = await Promise.all([
    supabase.from("decks").select("id").eq("user_id", userId),
    supabase.from("profiles").select("daily_goal").eq("id", userId).single(),
    supabase
      .from("sessions")
      .select("total")
      .eq("user_id", userId)
      .gte("completed_at", todayStart.toISOString())
      .not("completed_at", "is", null),
  ]);

  if (decksResult.error) throw new Error(decksResult.error.message);

  const dailyGoal = profileResult.data?.daily_goal ?? null;
  const cardsStudiedToday = (todaySessionsResult.data ?? []).reduce(
    (sum, s) => sum + (s.total ?? 0),
    0
  );
  const deckIds = (decksResult.data ?? []).map((d) => d.id);

  if (deckIds.length === 0) {
    return {
      totalCards: 0,
      totalSeen: 0,
      totalCorrect: 0,
      freshCards: 0,
      recentDeckIds: [],
      streakDays: 0,
      streakStatus: "none",
      cardsStudiedToday,
      dailyGoal,
    };
  }

  const [cardsResult, recentSessionsResult, allSessionDatesResult] = await Promise.all([
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

  if (cardsResult.error) throw new Error(cardsResult.error.message);
  if (recentSessionsResult.error) throw new Error(recentSessionsResult.error.message);
  if (allSessionDatesResult.error) throw new Error(allSessionDatesResult.error.message);

  const allCards = cardsResult.data ?? [];
  const totalCards = allCards.length;
  const totalSeen = allCards.reduce((s, c) => s + c.times_seen, 0);
  const totalCorrect = allCards.reduce((s, c) => s + c.times_correct, 0);
  const freshCards = allCards.filter((c) => c.times_seen === 0).length;

  const seen = new Set<string>();
  const recentDeckIds: string[] = [];
  for (const s of recentSessionsResult.data ?? []) {
    if (!seen.has(s.deck_id) && recentDeckIds.length < 5) {
      seen.add(s.deck_id);
      recentDeckIds.push(s.deck_id);
    }
  }

  const completedAts = (allSessionDatesResult.data ?? [])
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
    cardsStudiedToday,
    dailyGoal,
  };
}
