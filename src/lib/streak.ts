export type StreakStatus = "active" | "at_risk" | "none";

export type StreakResult = {
  streakDays: number;
  streakStatus: StreakStatus;
};

/**
 * Computes the user's study streak from an array of UTC ISO timestamp strings.
 *
 * Rules:
 * - One or more sessions on the same UTC calendar day = 1 studied day.
 * - "active"   — studied today; streak count starts from today.
 * - "at_risk"  — studied yesterday but not today; streak count starts from yesterday.
 * - "none"     — no session today or yesterday; streak is 0.
 *
 * Dates are compared in UTC. No timezone conversion is applied.
 */
export function computeStreak(completedAts: string[]): StreakResult {
  if (completedAts.length === 0) {
    return { streakDays: 0, streakStatus: "none" };
  }

  // Deduplicate into UTC date strings (YYYY-MM-DD)
  const studiedDays = new Set(
    completedAts.map((ts) => ts.slice(0, 10)) // "2026-04-28T..." → "2026-04-28"
  );

  const todayStr = utcDateString(new Date());
  const yesterdayStr = utcDateString(offsetDays(new Date(), -1));

  let streakStatus: StreakStatus;
  let startDateStr: string;

  if (studiedDays.has(todayStr)) {
    streakStatus = "active";
    startDateStr = todayStr;
  } else if (studiedDays.has(yesterdayStr)) {
    streakStatus = "at_risk";
    startDateStr = yesterdayStr;
  } else {
    return { streakDays: 0, streakStatus: "none" };
  }

  // Walk backwards from startDate counting consecutive days
  let count = 0;
  let cursor = new Date(startDateStr + "T00:00:00Z");

  while (studiedDays.has(utcDateString(cursor))) {
    count++;
    cursor = offsetDays(cursor, -1);
  }

  return { streakDays: count, streakStatus };
}

/** Returns "YYYY-MM-DD" in UTC for the given Date */
function utcDateString(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Returns a new Date offset by `days` days (positive = future, negative = past) */
function offsetDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}
