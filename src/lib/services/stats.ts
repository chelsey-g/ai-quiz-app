// src/lib/services/stats.ts
import { createClient } from "@/lib/supabase/server";
import { computeStreak } from "@/lib/streak";
import type { StreakStatus } from "@/lib/streak";

export type GlobalStats = {
  totals: {
    sessions: number;
    studyTimeMinutes: number;
    accuracy: number | null;
    cardsMastered: number;
    streakDays: number;
    streakStatus: StreakStatus;
  };
  activityByWeek: { week: string; count: number }[];
  accuracyByDay: { date: string; pct: number }[];
  deckStats: {
    deckId: string;
    title: string;
    sessions: number;
    accuracy: number | null;
    mastered: number;
    total: number;
    lastStudied: string | null;
  }[];
};

export type DeckStatsResult = {
  sessions: number;
  accuracy: number | null;
  mastered: number;
  lastStudied: string | null;
};

export async function getGlobalStats(userId: string): Promise<GlobalStats> {
  const supabase = await createClient();

  const { data: decks } = await supabase
    .from("decks")
    .select("id, title")
    .eq("user_id", userId);

  if (!decks || decks.length === 0) {
    return {
      totals: { sessions: 0, studyTimeMinutes: 0, accuracy: null, cardsMastered: 0, streakDays: 0, streakStatus: "none" },
      activityByWeek: buildActivityByWeek([]),
      accuracyByDay: [],
      deckStats: [],
    };
  }

  const deckIds = decks.map((d) => d.id);

  const [{ data: sessions }, { data: cards }] = await Promise.all([
    supabase
      .from("sessions")
      .select("id, deck_id, score, total, started_at, completed_at")
      .eq("user_id", userId)
      .not("completed_at", "is", null),
    supabase
      .from("cards")
      .select("deck_id, times_seen, times_correct")
      .in("deck_id", deckIds),
  ]);

  const completedSessions = (sessions ?? []) as {
    id: string;
    deck_id: string;
    score: number | null;
    total: number | null;
    started_at: string;
    completed_at: string;
  }[];
  const allCards = (cards ?? []) as {
    deck_id: string;
    times_seen: number;
    times_correct: number;
  }[];

  // Totals
  const totalSessions = completedSessions.length;

  // Deduplicate sessions that share the same started_at — multi-deck quick quiz
  // saves one record per deck with identical start times, which would inflate the total.
  const latestCompletedByStart = new Map<string, number>();
  for (const s of completedSessions) {
    const completedMs = new Date(s.completed_at).getTime();
    const prev = latestCompletedByStart.get(s.started_at) ?? 0;
    if (completedMs > prev) latestCompletedByStart.set(s.started_at, completedMs);
  }
  let studyTimeMs = 0;
  for (const [startedAt, completedMs] of latestCompletedByStart) {
    studyTimeMs += completedMs - new Date(startedAt).getTime();
  }
  const studyTimeMinutes = Math.round(studyTimeMs / 60000);

  const totalSeen = allCards.reduce((sum, c) => sum + c.times_seen, 0);
  const totalCorrect = allCards.reduce((sum, c) => sum + c.times_correct, 0);
  const accuracy = totalSeen > 0 ? Math.round((totalCorrect / totalSeen) * 100) : null;
  const cardsMastered = allCards.filter((c) => c.times_seen >= 3 && c.times_correct / c.times_seen >= 0.8).length;

  const { streakDays, streakStatus } = computeStreak(
    completedSessions.map((s) => s.completed_at)
  );

  // Per-deck stats
  const deckStats = decks.map((deck) => {
    const deckSessions = completedSessions.filter((s) => s.deck_id === deck.id);
    const deckCards = allCards.filter((c) => c.deck_id === deck.id);
    const deckSeen = deckCards.reduce((sum, c) => sum + c.times_seen, 0);
    const deckCorrect = deckCards.reduce((sum, c) => sum + c.times_correct, 0);
    const deckAccuracy = deckSeen > 0 ? Math.round((deckCorrect / deckSeen) * 100) : null;
    const mastered = deckCards.filter((c) => c.times_seen >= 3 && c.times_correct / c.times_seen >= 0.8).length;
    const sortedSessions = [...deckSessions].sort((a, b) =>
      b.completed_at.localeCompare(a.completed_at)
    );
    const lastStudied = sortedSessions[0]?.completed_at ?? null;

    return {
      deckId: deck.id,
      title: deck.title,
      sessions: deckSessions.length,
      accuracy: deckAccuracy,
      mastered,
      total: deckCards.length,
      lastStudied,
    };
  });

  deckStats.sort((a, b) => {
    if (!a.lastStudied && !b.lastStudied) return 0;
    if (!a.lastStudied) return 1;
    if (!b.lastStudied) return -1;
    return b.lastStudied.localeCompare(a.lastStudied);
  });

  return {
    totals: { sessions: totalSessions, studyTimeMinutes, accuracy, cardsMastered, streakDays, streakStatus },
    activityByWeek: buildActivityByWeek(completedSessions.map((s) => s.completed_at)),
    accuracyByDay: buildAccuracyByDay(completedSessions),
    deckStats,
  };
}

export async function getDeckStats(deckId: string, userId: string): Promise<DeckStatsResult> {
  const supabase = await createClient();

  const [{ data: sessions }, { data: cards }] = await Promise.all([
    supabase
      .from("sessions")
      .select("completed_at")
      .eq("deck_id", deckId)
      .eq("user_id", userId)
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false }),
    supabase
      .from("cards")
      .select("times_seen, times_correct")
      .eq("deck_id", deckId),
  ]);

  const completedSessions = (sessions ?? []) as { completed_at: string }[];
  const deckCards = (cards ?? []) as { times_seen: number; times_correct: number }[];

  const totalSeen = deckCards.reduce((sum, c) => sum + c.times_seen, 0);
  const totalCorrect = deckCards.reduce((sum, c) => sum + c.times_correct, 0);
  const accuracy = totalSeen > 0 ? Math.round((totalCorrect / totalSeen) * 100) : null;
  const mastered = deckCards.filter((c) => c.times_seen >= 3 && c.times_correct / c.times_seen >= 0.8).length;
  const lastStudied = completedSessions[0]?.completed_at ?? null;

  return { sessions: completedSessions.length, accuracy, mastered, lastStudied };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function buildActivityByWeek(completedAts: string[]): { week: string; count: number }[] {
  const now = new Date();
  const dayOfWeek = now.getUTCDay();
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const thisMonday = new Date(now);
  thisMonday.setUTCDate(now.getUTCDate() - daysToMonday);
  thisMonday.setUTCHours(0, 0, 0, 0);

  const weeks: { week: string; count: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const weekStart = new Date(thisMonday);
    weekStart.setUTCDate(thisMonday.getUTCDate() - i * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekStart.getUTCDate() + 7);

    const count = completedAts.filter((ts) => {
      const d = new Date(ts);
      return d >= weekStart && d < weekEnd;
    }).length;

    const label = weekStart.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
    weeks.push({ week: label, count });
  }
  return weeks;
}

export function buildAccuracyByDay(
  sessions: { completed_at: string; score: number | null; total: number | null }[]
): { date: string; pct: number }[] {
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setUTCDate(now.getUTCDate() - 30);

  const recent = sessions.filter(
    (s) => new Date(s.completed_at) >= thirtyDaysAgo && s.score !== null && s.total
  );

  const byDay = new Map<string, { correct: number; total: number }>();
  for (const s of recent) {
    const date = s.completed_at.slice(0, 10);
    const existing = byDay.get(date) ?? { correct: 0, total: 0 };
    byDay.set(date, {
      correct: existing.correct + (s.score ?? 0),
      total: existing.total + s.total!,
    });
  }

  return Array.from(byDay.entries())
    .map(([date, { correct, total }]) => ({
      date,
      pct: Math.round((correct / total) * 100),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
