import { describe, expect, it } from "vitest";
import { sizeWords } from "../../src/lib/size-words.ts";

// A size a maker reads at a glance: the same words on the game's page, in the picker and in a refusal.

describe("sizeWords", () => {
  it("says anything under a megabyte in kilobytes, rounded up, and never 0 KB", () => {
    expect(sizeWords(1)).toBe("1 KB");
    expect(sizeWords(64)).toBe("1 KB");
    expect(sizeWords(1_000)).toBe("1 KB");
    expect(sizeWords(1_001)).toBe("2 KB");
    expect(sizeWords(999_000)).toBe("999 KB");
  });

  it("says a megabyte and more with one decimal, and drops a zero decimal", () => {
    expect(sizeWords(1_000_000)).toBe("1 MB");
    expect(sizeWords(4_200_000)).toBe("4.2 MB");
    expect(sizeWords(30_000_000)).toBe("30 MB");
    expect(sizeWords(31_000_000)).toBe("31 MB");
  });
});
