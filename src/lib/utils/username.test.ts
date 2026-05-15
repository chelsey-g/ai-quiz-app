import { describe, it, expect } from "vitest";
import { isValidUsername, USERNAME_ERROR } from "./username";

describe("isValidUsername", () => {
  it("accepts 3-char lowercase alphanumeric", () => {
    expect(isValidUsername("abc")).toBe(true);
  });
  it("accepts 20-char username", () => {
    expect(isValidUsername("a".repeat(20))).toBe(true);
  });
  it("accepts underscores", () => {
    expect(isValidUsername("my_name")).toBe(true);
  });
  it("accepts numbers", () => {
    expect(isValidUsername("user123")).toBe(true);
  });
  it("rejects 2-char username", () => {
    expect(isValidUsername("ab")).toBe(false);
  });
  it("rejects 21-char username", () => {
    expect(isValidUsername("a".repeat(21))).toBe(false);
  });
  it("rejects uppercase", () => {
    expect(isValidUsername("UserName")).toBe(false);
  });
  it("rejects hyphens", () => {
    expect(isValidUsername("user-name")).toBe(false);
  });
  it("rejects spaces", () => {
    expect(isValidUsername("user name")).toBe(false);
  });
  it("rejects empty string", () => {
    expect(isValidUsername("")).toBe(false);
  });
  it("exports a non-empty USERNAME_ERROR string", () => {
    expect(typeof USERNAME_ERROR).toBe("string");
    expect(USERNAME_ERROR.length).toBeGreaterThan(0);
  });
});
