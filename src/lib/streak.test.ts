import { describe, it, expect } from "vitest";
import { computeStreak } from "./streak";

// Helper: build a UTC ISO string for N days ago
function daysAgo(n: number): string {
  const d = new Date();
  d.setUTCHours(12, 0, 0, 0); // noon UTC — stable time within the day
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString();
}

describe("computeStreak", () => {
  it("returns none with 0 days when no sessions exist", () => {
    const result = computeStreak([]);
    expect(result).toEqual({ streakDays: 0, streakStatus: "none" });
  });

  it("returns active with 1 day when studied today", () => {
    const result = computeStreak([daysAgo(0)]);
    expect(result).toEqual({ streakDays: 1, streakStatus: "active" });
  });

  it("returns at_risk with 1 day when studied only yesterday", () => {
    const result = computeStreak([daysAgo(1)]);
    expect(result).toEqual({ streakDays: 1, streakStatus: "at_risk" });
  });

  it("returns none when most recent session was 2 days ago", () => {
    const result = computeStreak([daysAgo(2)]);
    expect(result).toEqual({ streakDays: 0, streakStatus: "none" });
  });

  it("counts a multi-day active streak when studied today and previous consecutive days", () => {
    const result = computeStreak([daysAgo(0), daysAgo(1), daysAgo(2), daysAgo(3)]);
    expect(result).toEqual({ streakDays: 4, streakStatus: "active" });
  });

  it("counts a multi-day at_risk streak starting from yesterday", () => {
    const result = computeStreak([daysAgo(1), daysAgo(2), daysAgo(3)]);
    expect(result).toEqual({ streakDays: 3, streakStatus: "at_risk" });
  });

  it("stops counting at a gap — gap 2 days ago", () => {
    // Studied today and yesterday, but not 2 days ago, and studied 3 days ago
    const result = computeStreak([daysAgo(0), daysAgo(1), daysAgo(3)]);
    expect(result).toEqual({ streakDays: 2, streakStatus: "active" });
  });

  it("deduplicates multiple sessions on the same day", () => {
    // Three sessions today — should still count as 1 day
    const result = computeStreak([daysAgo(0), daysAgo(0), daysAgo(0)]);
    expect(result).toEqual({ streakDays: 1, streakStatus: "active" });
  });

  it("handles sessions far in the past with no recent activity", () => {
    const result = computeStreak([daysAgo(30), daysAgo(31)]);
    expect(result).toEqual({ streakDays: 0, streakStatus: "none" });
  });

  it("counts a long streak correctly", () => {
    const sessions = Array.from({ length: 14 }, (_, i) => daysAgo(i));
    const result = computeStreak(sessions);
    expect(result).toEqual({ streakDays: 14, streakStatus: "active" });
  });
});
