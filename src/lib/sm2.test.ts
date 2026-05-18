import { describe, it, expect } from "vitest";
import { sm2, qualityFromCorrect } from "./sm2";

const base = { repetitions: 0, ease_factor: 2.5, interval_days: 0 };

describe("qualityFromCorrect", () => {
  it("returns 4 for correct", () => {
    expect(qualityFromCorrect(true)).toBe(4);
  });

  it("returns 1 for incorrect", () => {
    expect(qualityFromCorrect(false)).toBe(1);
  });
});

describe("sm2 — incorrect answer (quality < 3)", () => {
  it("resets repetitions to 0 and interval to 1 day", () => {
    const result = sm2({ repetitions: 3, ease_factor: 2.5, interval_days: 10 }, 1);
    expect(result.repetitions).toBe(0);
    expect(result.interval_days).toBe(1);
  });

  it("does not change ease_factor on failure", () => {
    const result = sm2({ repetitions: 2, ease_factor: 2.5, interval_days: 6 }, 2);
    expect(result.ease_factor).toBe(2.5);
  });

  it("resets even after a long streak", () => {
    const result = sm2({ repetitions: 10, ease_factor: 2.8, interval_days: 90 }, 0);
    expect(result.repetitions).toBe(0);
    expect(result.interval_days).toBe(1);
  });
});

describe("sm2 — correct answer (quality >= 3)", () => {
  it("first review sets interval to 1 day", () => {
    const result = sm2({ ...base, repetitions: 0 }, 4);
    expect(result.interval_days).toBe(1);
    expect(result.repetitions).toBe(1);
  });

  it("second review sets interval to 6 days", () => {
    const result = sm2({ ...base, repetitions: 1, interval_days: 1 }, 4);
    expect(result.interval_days).toBe(6);
    expect(result.repetitions).toBe(2);
  });

  it("third+ review scales interval by ease_factor", () => {
    const result = sm2({ repetitions: 2, ease_factor: 2.5, interval_days: 6 }, 4);
    expect(result.interval_days).toBe(15); // round(6 * 2.5)
    expect(result.repetitions).toBe(3);
  });

  it("quality 5 increases ease_factor", () => {
    const result = sm2({ ...base, repetitions: 0 }, 5);
    expect(result.ease_factor).toBeCloseTo(2.6);
  });

  it("quality 4 leaves ease_factor unchanged", () => {
    const result = sm2({ ...base, repetitions: 0 }, 4);
    expect(result.ease_factor).toBeCloseTo(2.5);
  });

  it("quality 3 decreases ease_factor", () => {
    const result = sm2({ ...base, repetitions: 0 }, 3);
    expect(result.ease_factor).toBeCloseTo(2.36);
  });

  it("ease_factor never drops below 1.3", () => {
    const result = sm2({ ...base, ease_factor: 1.3, repetitions: 0 }, 3);
    expect(result.ease_factor).toBeGreaterThanOrEqual(1.3);
  });

  it("ease_factor floor applies even after repeated poor-quality reviews", () => {
    let card = { ...base };
    for (let i = 0; i < 20; i++) {
      card = sm2(card, 3);
    }
    expect(card.ease_factor).toBeGreaterThanOrEqual(1.3);
  });
});

describe("sm2 — next_review_at", () => {
  it("returns a valid ISO date string", () => {
    const result = sm2(base, 4);
    expect(() => new Date(result.next_review_at)).not.toThrow();
    expect(new Date(result.next_review_at).getTime()).not.toBeNaN();
  });

  it("is set to midnight local time", () => {
    const result = sm2(base, 4);
    const d = new Date(result.next_review_at);
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
    expect(d.getSeconds()).toBe(0);
  });

  it("is in the future", () => {
    const result = sm2(base, 4);
    expect(new Date(result.next_review_at).getTime()).toBeGreaterThan(Date.now());
  });
});
