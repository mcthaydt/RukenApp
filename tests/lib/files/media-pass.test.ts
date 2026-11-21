import { describe, expect, it } from "vitest";
import { makePass } from "../../../src/features/play/pass.ts";
import {
  MEDIA_PASS_WINDOW_MS,
  checkMediaPass,
  makeMediaPass,
  mediaPassExpiry,
} from "../../../src/lib/files/media-pass.ts";

const SECRET = "test-play-pass-secret";
const KEY = "clips/aaaaaaaaaa/upright-0123456789abcdef.mp4";
const NOW = Date.UTC(2026, 10, 21, 15, 30);
const EXPIRY = mediaPassExpiry(NOW);
const PASS = makeMediaPass(KEY, EXPIRY, SECRET);

describe("a media pass", () => {
  it("is good for its video before it runs out, and gives the expiry back", () => {
    expect(checkMediaPass(PASS, KEY, SECRET, NOW)).toBe(EXPIRY);
    expect(checkMediaPass(PASS, KEY, SECRET, EXPIRY - 1)).toBe(EXPIRY);
  });

  it("is refused at and after its expiry", () => {
    expect(checkMediaPass(PASS, KEY, SECRET, EXPIRY)).toBeNull();
    expect(checkMediaPass(PASS, KEY, SECRET, EXPIRY + 1)).toBeNull();
  });

  it("is refused for another video, with another secret, or when empty", () => {
    expect(checkMediaPass(PASS, KEY.replace("upright", "wide"), SECRET, NOW)).toBeNull();
    expect(checkMediaPass(PASS, KEY, "another-secret", NOW)).toBeNull();
    expect(checkMediaPass("", KEY, SECRET, NOW)).toBeNull();
    expect(checkMediaPass(null, KEY, SECRET, NOW)).toBeNull();
  });

  it("is refused when any one character of the expiry or the mac is changed", () => {
    for (let i = 0; i < PASS.length; i += 1) {
      const was = PASS[i] ?? "";
      const now = was === "a" ? "b" : "a";
      const changed = `${PASS.slice(0, i)}${now}${PASS.slice(i + 1)}`;
      expect(checkMediaPass(changed, KEY, SECRET, NOW), `character ${String(i)}`).toBeNull();
    }
  });

  it("is not a play pass, and a play pass is not it", () => {
    const play = makePass(
      { id: "AAAAAAAAAAAAAAAAAAAAAA", game: "aaaaaaaaaa", pull: "p1", connect: [], expiresAtMs: EXPIRY },
      SECRET,
    );
    expect(checkMediaPass(play, KEY, SECRET, NOW)).toBeNull();
  });

  it("never throws on what anyone types (1,000 strings from a fixed seed)", () => {
    let seed = 12345;
    const next = () => {
      seed = (seed * 1103515245 + 12345) % 2 ** 31;
      return seed;
    };
    const alphabet = "v1.abcXYZ_-0123456789=/ \u0000é";
    for (let n = 0; n < 1000; n += 1) {
      let text = n % 2 === 0 ? "v1." : "";
      const length = next() % 80;
      for (let i = 0; i < length; i += 1) text += alphabet[next() % alphabet.length] ?? "";
      expect(checkMediaPass(text, KEY, SECRET, NOW)).toBeNull();
    }
  });

  it("is the same for two times in one window and different in two windows", () => {
    const windowStart = Math.floor(NOW / MEDIA_PASS_WINDOW_MS) * MEDIA_PASS_WINDOW_MS;
    const a = makeMediaPass(KEY, mediaPassExpiry(windowStart), SECRET);
    const b = makeMediaPass(KEY, mediaPassExpiry(windowStart + MEDIA_PASS_WINDOW_MS - 1), SECRET);
    const c = makeMediaPass(KEY, mediaPassExpiry(windowStart + MEDIA_PASS_WINDOW_MS), SECRET);
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it("lasts at least 12 hours and at most 24, whenever it is signed", () => {
    for (let offset = 0; offset < 3 * MEDIA_PASS_WINDOW_MS; offset += 7 * 60 * 1000) {
      const signedAt = NOW + offset;
      const left = mediaPassExpiry(signedAt) - signedAt;
      expect(left).toBeGreaterThanOrEqual(MEDIA_PASS_WINDOW_MS);
      expect(left).toBeLessThanOrEqual(2 * MEDIA_PASS_WINDOW_MS);
    }
  });

  it("will not be made with an empty secret", () => {
    expect(() => makeMediaPass(KEY, EXPIRY, "")).toThrow();
  });
});
