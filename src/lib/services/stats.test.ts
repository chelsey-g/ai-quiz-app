import { describe, it, expect } from "vitest";
import { buildActivityByWeek, buildAccuracyByDay } from "./stats";

function daysAgo(n: number): string {
  const d = new Date();
  d.setUTCHours(12, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString();
}

describe("buildActivityByWeek", () => {
  it("always returns exactly 12 weeks", () => {
    expect(buildActivityByWeek([])).toHaveLength(12);
    expect(buildActivityByWeek([daysAgo(0), daysAgo(3)])).toHaveLength(12);
  });

  it("returns all zeros for empty input", () => {
    const result = buildActivityByWeek([]);
    expect(result.every((w) => w.count === 0)).toBe(true);
  });

  it("counts a session this week in the last entry", () => {
    const result = buildActivityByWeek([daysAgo(0)]);
    const lastWeek = result[result.length - 1];
    expect(lastWeek.count).toBe(1);
  });

  it("counts multiple sessions this week", () => {
    const result = buildActivityByWeek([daysAgo(0), daysAgo(1), daysAgo(2)]);
    const total = result.reduce((sum, w) => sum + w.count, 0);
    expect(total).toBeGreaterThanOrEqual(1);
  });

  it("each week entry has a non-empty label string", () => {
    const result = buildActivityByWeek([]);
    for (const w of result) {
      expect(typeof w.week).toBe("string");
      expect(w.week.length).toBeGreaterThan(0);
    }
  });

  it("ignores sessions older than 12 weeks", () => {
    const old = daysAgo(90);
    const result = buildActivityByWeek([old]);
    expect(result.every((w) => w.count === 0)).toBe(true);
  });

  it("counts each session independently (no dedup)", () => {
    const ts = daysAgo(0);
    const result = buildActivityByWeek([ts, ts, ts]);
    const lastWeek = result[result.length - 1];
    expect(lastWeek.count).toBe(3);
  });
});

describe("buildAccuracyByDay", () => {
  it("returns empty array for no sessions", () => {
    expect(buildAccuracyByDay([])).toEqual([]);
  });

  it("excludes sessions with null score", () => {
    const result = buildAccuracyByDay([
      { completed_at: daysAgo(0), score: null, total: 10 },
    ]);
    expect(result).toHaveLength(0);
  });

  it("excludes sessions with null or zero total", () => {
    const result = buildAccuracyByDay([
      { completed_at: daysAgo(0), score: 8, total: null },
      { completed_at: daysAgo(0), score: 8, total: 0 },
    ]);
    expect(result).toHaveLength(0);
  });

  it("computes correct percentage for a single session", () => {
    const result = buildAccuracyByDay([
      { completed_at: daysAgo(0), score: 8, total: 10 },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].pct).toBe(80);
  });

  it("averages multiple sessions on the same day", () => {
    const ts = daysAgo(0);
    const result = buildAccuracyByDay([
      { completed_at: ts, score: 10, total: 10 },
      { completed_at: ts, score: 5, total: 10 },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].pct).toBe(75);
  });

  it("weights sessions by card count, not session count", () => {
    const ts = daysAgo(0);
    const result = buildAccuracyByDay([
      { completed_at: ts, score: 9, total: 10 }, // 90%
      { completed_at: ts, score: 1, total: 1 },  // 100%
    ]);
    // Correct: 10/11 = 91%; naive average of percentages: (90+100)/2 = 95%
    expect(result[0].pct).toBe(91);
  });

  it("returns one entry per distinct day", () => {
    const result = buildAccuracyByDay([
      { completed_at: daysAgo(0), score: 10, total: 10 },
      { completed_at: daysAgo(2), score: 5, total: 10 },
    ]);
    expect(result).toHaveLength(2);
  });

  it("returns results sorted ascending by date", () => {
    const result = buildAccuracyByDay([
      { completed_at: daysAgo(5), score: 6, total: 10 },
      { completed_at: daysAgo(0), score: 9, total: 10 },
      { completed_at: daysAgo(2), score: 7, total: 10 },
    ]);
    for (let i = 1; i < result.length; i++) {
      expect(result[i].date >= result[i - 1].date).toBe(true);
    }
  });

  it("excludes sessions older than 30 days", () => {
    const result = buildAccuracyByDay([
      { completed_at: daysAgo(31), score: 10, total: 10 },
    ]);
    expect(result).toHaveLength(0);
  });

  it("rounds percentage to nearest integer", () => {
    const result = buildAccuracyByDay([
      { completed_at: daysAgo(0), score: 1, total: 3 },
    ]);
    expect(Number.isInteger(result[0].pct)).toBe(true);
  });
});
