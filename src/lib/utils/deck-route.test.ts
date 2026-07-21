import { describe, it, expect } from "vitest";
import { matchDeckRoute } from "./deck-route";

describe("matchDeckRoute", () => {
  it("matches /decks/[id]", () => {
    expect(matchDeckRoute("/decks/abc-123")).toBe("abc-123");
  });

  it("matches nested deck routes like /decks/[id]/edit", () => {
    expect(matchDeckRoute("/decks/abc-123/edit")).toBe("abc-123");
  });

  it("matches /quiz/[deckId]", () => {
    expect(matchDeckRoute("/quiz/abc-123")).toBe("abc-123");
  });

  it("does not treat /quiz/quick as a deck id", () => {
    expect(matchDeckRoute("/quiz/quick")).toBeNull();
  });

  it("returns null for unrelated routes", () => {
    expect(matchDeckRoute("/dashboard")).toBeNull();
    expect(matchDeckRoute("/settings")).toBeNull();
    expect(matchDeckRoute("/kata")).toBeNull();
    expect(matchDeckRoute("/")).toBeNull();
  });
});
