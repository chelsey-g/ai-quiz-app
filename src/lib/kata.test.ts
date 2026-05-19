import { describe, it, expect } from "vitest";

function parseFunctionName(stub: string): string | null {
  return stub.match(/function\s+(\w+)/)?.[1] ?? null;
}

describe("parseFunctionName", () => {
  it("parses a simple function declaration", () => {
    expect(parseFunctionName("function reverseStr(str) { }")).toBe("reverseStr");
  });

  it("parses a jsdoc-annotated stub", () => {
    const stub = `/**\n * @param {string} str\n */\nfunction reverseStr(str) {\n  // your code here\n}`;
    expect(parseFunctionName(stub)).toBe("reverseStr");
  });

  it("returns null when no function keyword", () => {
    expect(parseFunctionName("const x = (y) => y")).toBeNull();
  });

  it("handles camelCase and underscored names", () => {
    expect(parseFunctionName("function find_max(arr) {}")).toBe("find_max");
    expect(parseFunctionName("function twoSum(nums, target) {}")).toBe("twoSum");
  });
});
