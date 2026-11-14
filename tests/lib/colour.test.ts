import { describe, expect, it } from "vitest";
import { contrast } from "../../src/lib/colour.ts";

// WCAG's contrast ratio. The two figures from design 5.8's table are the ones the look's tokens were chosen by.

describe("contrast", () => {
  it("is 21 for black on white", () => {
    expect(contrast("#000000", "#ffffff")).toBe(21);
  });

  it("is 1 for a colour on itself", () => {
    expect(contrast("#cb2f43", "#cb2f43")).toBe(1);
  });

  it("is the same whichever colour is the text", () => {
    expect(contrast("#006eb8", "#ffffff")).toBe(contrast("#ffffff", "#006eb8"));
  });

  it("matches design 5.8's table: chalk on felt and chalk on pay Blue", () => {
    expect(contrast("#ffffff", "#112f2c")).toBeCloseTo(14.3, 1);
    expect(contrast("#ffffff", "#006eb8")).toBeCloseTo(5.4, 1);
  });
});
