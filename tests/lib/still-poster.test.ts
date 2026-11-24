import { describe, expect, test } from "vitest";
import { posterAddress } from "../../src/lib/still-poster.ts";
import { isStillWidth, STILL_WIDTHS, stillWidthFor } from "../../src/lib/still-widths.ts";

describe("the width of a still a page asks for", () => {
  test("is the smallest made width that covers the video, and the widest for anything bigger", () => {
    expect(stillWidthFor(1)).toBe(240);
    expect(stillWidthFor(240)).toBe(240);
    expect(stillWidthFor(241)).toBe(360);
    expect(stillWidthFor(561)).toBe(720);
    expect(stillWidthFor(1170)).toBe(1080);
    for (let pixels = 1; pixels <= 3000; pixels += 7) {
      const width = stillWidthFor(pixels);
      expect(isStillWidth(width)).toBe(true);
      // Never smaller than the video unless nothing made is as big; never a size up when a smaller one covers it.
      if (pixels <= 1080) expect(width).toBeGreaterThanOrEqual(pixels);
      const smaller = STILL_WIDTHS.filter((one) => one < width);
      expect(smaller.every((one) => one < pixels)).toBe(true);
    }
  });
});

describe("a still's address", () => {
  test("names the second the video opens on and the width", () => {
    expect(posterAddress("/api/still/clips/abcdefghij/upright-0123456789abcdef.mp4", 6, 500)).toBe(
      "/api/still/clips/abcdefghij/upright-0123456789abcdef.mp4?at=6&width=540",
    );
  });
});
