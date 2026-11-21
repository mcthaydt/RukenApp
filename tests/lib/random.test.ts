import { describe, expect, it } from "vitest";
import { seededNumber } from "../../src/lib/random.ts";

describe("seededNumber", () => {
  it("is the 32-bit FNV-1a hash of the seed, a newline and the key", () => {
    // Worked out with an independent FNV-1a over the UTF-8 bytes of `seed + "\n" + key`.
    expect(seededNumber("", "")).toBe(252_472_541);
    expect(seededNumber("2026-11-21", "game-1")).toBe(2_457_353_284);
    expect(seededNumber("2026-11-22", "game-1")).toBe(2_382_928_867);
    expect(seededNumber("é", "日本")).toBe(2_462_842_365);
  });

  it("gives the same whole number for the same two words, within 0 to 4,294,967,295", () => {
    for (const key of ["a", "b", "game-17", "x".repeat(500)]) {
      const number = seededNumber("seed", key);
      expect(seededNumber("seed", key)).toBe(number);
      expect(Number.isInteger(number)).toBe(true);
      expect(number).toBeGreaterThanOrEqual(0);
      expect(number).toBeLessThanOrEqual(4_294_967_295);
    }
  });

  it("does not run the seed and the key together", () => {
    expect(seededNumber("ab", "c")).not.toBe(seededNumber("a", "bc"));
  });
});
