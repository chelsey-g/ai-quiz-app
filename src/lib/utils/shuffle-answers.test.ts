import { describe, it, expect } from "vitest";
import { shuffleAnswers } from "./shuffle-answers";

describe("shuffleAnswers", () => {
  it("always includes the correct answer", () => {
    const result = shuffleAnswers("Correct", ["A", "B", "C"]);
    expect(result).toContain("Correct");
  });

  it("returns 4 options with 3 valid distractors", () => {
    const result = shuffleAnswers("Correct", ["A", "B", "C"]);
    expect(result).toHaveLength(4);
  });

  it("caps at 3 distractors even when more are provided", () => {
    const result = shuffleAnswers("Correct", ["A", "B", "C", "D", "E"]);
    expect(result).toHaveLength(4);
  });

  it("omits distractors that match the correct answer (case-insensitive)", () => {
    const result = shuffleAnswers("React", ["react", "Vue", "Angular"]);
    expect(result).not.toContain("react");
    expect(result).toHaveLength(3); // only 2 valid distractors + correct
  });

  it("deduplicates identical distractors", () => {
    const result = shuffleAnswers("Correct", ["A", "A", "B"]);
    const unique = new Set(result);
    expect(unique.size).toBe(result.length);
  });

  it("trims whitespace from distractors", () => {
    const result = shuffleAnswers("Correct", ["  A  ", " B ", "C"]);
    expect(result).toContain("A");
    expect(result).toContain("B");
    expect(result).not.toContain("  A  ");
  });

  it("skips empty distractors", () => {
    const result = shuffleAnswers("Correct", ["", "  ", "A"]);
    expect(result).toHaveLength(2); // only 1 valid distractor + correct
  });

  it("returns just the correct answer when no distractors provided", () => {
    const result = shuffleAnswers("Correct", []);
    expect(result).toEqual(["Correct"]);
  });

  it("deduplicates distractors that differ only by whitespace", () => {
    const result = shuffleAnswers("Correct", ["Hello World", "hello world", "B"]);
    const withoutCorrect = result.filter((r) => r !== "Correct");
    expect(withoutCorrect).toHaveLength(2);
  });
});
