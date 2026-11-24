import { describe, expect, test } from "vitest";
import { posterAddress } from "../../src/lib/still-poster.ts";
import { isStillWidth, STILL_WIDTHS, stillOfClip, stillWidthFor } from "../../src/lib/stills.ts";

const KEY = "clips/abcdefghij/upright-0123456789abcdef.mp4";

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
      if (pixels <= 1080) expect(width).toBeGreaterThanOrEqual(pixels);
      const smaller = STILL_WIDTHS.filter((one) => one < width);
      expect(smaller.every((one) => one < pixels)).toBe(true);
    }
  });
});

describe("a clip's still, from the clip's address", () => {
  test("is the still address with the clip's key, at the second the clip opens on", () => {
    expect(stillOfClip(`https://media.ruken.dev/${KEY}`)).toEqual({
      address: `/api/still/${KEY}`,
      second: 0,
    });
    expect(stillOfClip(`http://localhost:8788/media/${KEY}#t=6`)).toEqual({
      address: `/api/still/${KEY}`,
      second: 6,
    });
    expect(stillOfClip(`https://media.ruken.dev/${KEY}#t=0.001`)).toEqual({
      address: `/api/still/${KEY}`,
      second: 0,
    });
    expect(stillOfClip(`https://media.ruken.dev/${KEY}#t=2.9,5`)).toEqual({
      address: `/api/still/${KEY}`,
      second: 2,
    });
  });

  test("is nothing for an address that is not a stored clip's", () => {
    for (const address of [
      "",
      "blob:http://localhost:4173/6a1f",
      "https://media.ruken.dev/files/abcdefghij/index.html",
      `https://media.ruken.dev/${KEY}.jpg`,
      "/about/play-glow.mp4",
    ]) {
      expect(stillOfClip(address), address).toBeNull();
    }
  });

  test("names the second and the width in the poster's address", () => {
    expect(posterAddress(`/api/still/${KEY}`, 6, 500)).toBe(`/api/still/${KEY}?at=6&width=540`);
  });
});
