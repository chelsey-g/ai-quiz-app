import { describe, it, expect } from "vitest";
import { cleanDistractors } from "./distractors";

describe("cleanDistractors", () => {
  it("returns up to 3 valid distractors", () => {
    const result = cleanDistractors("Correct", ["A", "B", "C"]);
    expect(result).toHaveLength(3);
  });

  it("caps at 3 even when more are provided", () => {
    const result = cleanDistractors("Correct", ["A", "B", "C", "D", "E"]);
    expect(result).toHaveLength(3);
  });

  it("removes a distractor that matches the correct answer exactly", () => {
    const result = cleanDistractors("Correct", ["Correct", "A", "B"]);
    expect(result).not.toContain("Correct");
    expect(result).toHaveLength(2);
  });

  it("removes distractors matching the correct answer case-insensitively", () => {
    const result = cleanDistractors("React", ["react", "REACT", "Vue"]);
    expect(result).toEqual(["Vue"]);
  });

  it("deduplicates identical distractors", () => {
    const result = cleanDistractors("Correct", ["A", "A", "B"]);
    expect(result).toHaveLength(2);
    expect(result).toContain("A");
    expect(result).toContain("B");
  });

  it("deduplicates distractors that differ only in case and whitespace", () => {
    const result = cleanDistractors("Correct", ["hello world", "Hello World", "Vue"]);
    expect(result).toHaveLength(2);
  });

  it("skips empty and whitespace-only entries", () => {
    const result = cleanDistractors("Correct", ["", "  ", "A"]);
    expect(result).toEqual(["A"]);
  });

  it("trims whitespace from distractors before returning them", () => {
    const result = cleanDistractors("Correct", ["  A  "]);
    expect(result).toContain("A");
    expect(result).not.toContain("  A  ");
  });

  it("returns empty array when all distractors match correct answer", () => {
    const result = cleanDistractors("React", ["react", "REACT", "React"]);
    expect(result).toHaveLength(0);
  });

  it("returns empty array for empty input", () => {
    const result = cleanDistractors("Correct", []);
    expect(result).toHaveLength(0);
  });
});
