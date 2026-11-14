import { describe, expect, it } from "vitest";
import {
  CLIP_MAX_BYTES,
  clipKeyFor,
  clipProblem,
  isClipContentType,
  isClipKey,
  looksLikeVideo,
} from "../../../src/features/games/clips.ts";

const PUBLIC_ID = "abcdefgh23";
const HEX = "0123456789abcdef";

// The first bytes of a real MP4 (a 24-byte `ftyp` box) and a real WebM (the EBML header).
const MP4 = new Uint8Array([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]);
const WEBM = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81]);

describe("the clip limit", () => {
  it("is 30 MB", () => {
    expect(CLIP_MAX_BYTES).toBe(30_000_000);
  });
});

describe("isClipContentType", () => {
  it.each(["video/mp4", "video/webm"])("accepts %s", (value) => {
    expect(isClipContentType(value)).toBe(true);
  });

  // The table is a plain object: a name every object inherits must not be taken for a type.
  it.each(["video/quicktime", "text/html", "", "constructor", "__proto__"])("refuses %j", (value) => {
    expect(isClipContentType(value)).toBe(false);
  });
});

describe("clipKeyFor", () => {
  it("binds the key to the game, the shape, a random part and the file type", () => {
    expect(clipKeyFor(PUBLIC_ID, "upright", HEX, "video/mp4")).toBe(`clips/${PUBLIC_ID}/upright-${HEX}.mp4`);
    expect(clipKeyFor(PUBLIC_ID, "wide", HEX, "video/webm")).toBe(`clips/${PUBLIC_ID}/wide-${HEX}.webm`);
  });
});

describe("isClipKey", () => {
  it.each([
    clipKeyFor(PUBLIC_ID, "upright", HEX, "video/mp4"),
    clipKeyFor(PUBLIC_ID, "wide", HEX, "video/webm"),
  ])("accepts %s", (key) => {
    expect(isClipKey(key)).toBe(true);
  });

  it.each([
    "",
    `clips/${PUBLIC_ID}/../x.mp4`,
    `clips/aaaaaaaaaa/../x.mp4`,
    `files/${PUBLIC_ID}/upright-${HEX}.mp4`,
    `clips/${PUBLIC_ID}/square-${HEX}.mp4`,
    `clips/${PUBLIC_ID}/upright-${HEX}.html`,
    `clips/${PUBLIC_ID}/upright-${HEX}.mp4.exe`,
    `clips/${PUBLIC_ID}/upright-${HEX.slice(1)}.mp4`,
    `clips/${PUBLIC_ID}/upright-${HEX.toUpperCase()}.mp4`,
    `clips/ABCDEFGH23/upright-${HEX}.mp4`,
    `/clips/${PUBLIC_ID}/upright-${HEX}.mp4`,
    `clips/${PUBLIC_ID}/upright-${HEX}.mp4\n`,
  ])("refuses %j", (key) => {
    expect(isClipKey(key)).toBe(false);
  });
});

describe("looksLikeVideo", () => {
  it("knows an MP4 by the ftyp box at byte 4 and a WebM by its EBML magic number", () => {
    expect(looksLikeVideo(MP4, "video/mp4")).toBe(true);
    expect(looksLikeVideo(WEBM, "video/webm")).toBe(true);
  });

  // Review Focus 13: a page named as a video is refused by its first bytes.
  it("refuses bytes of the other format, of something else, or too short to tell", () => {
    const page = new TextEncoder().encode("<script>alert(1)</script>");
    expect(looksLikeVideo(WEBM, "video/mp4")).toBe(false);
    expect(looksLikeVideo(MP4, "video/webm")).toBe(false);
    expect(looksLikeVideo(page, "video/mp4")).toBe(false);
    expect(looksLikeVideo(page, "video/webm")).toBe(false);
    expect(looksLikeVideo(MP4.slice(0, 7), "video/mp4")).toBe(false);
    expect(looksLikeVideo(WEBM.slice(0, 3), "video/webm")).toBe(false);
  });
});

describe("clipProblem", () => {
  it("has nothing to say about a clip that is fine", () => {
    expect(clipProblem({ contentType: "video/mp4", bytes: MP4 })).toBeNull();
    expect(clipProblem({ contentType: "video/webm", bytes: WEBM })).toBeNull();
  });

  it("refuses a file that is not a clip type", () => {
    expect(clipProblem({ contentType: "image/gif", bytes: MP4 })).toBe("Clips are MP4 or WebM video.");
  });

  it("refuses a clip over the limit, in whole megabytes rounded up", () => {
    const big = new Uint8Array(CLIP_MAX_BYTES + 1);
    big.set(MP4);
    expect(clipProblem({ contentType: "video/mp4", bytes: big })).toBe(
      "That clip is 31 MB. A clip can be up to 30 MB.",
    );
  });

  it("accepts a clip of exactly the limit", () => {
    const exact = new Uint8Array(CLIP_MAX_BYTES);
    exact.set(MP4);
    expect(clipProblem({ contentType: "video/mp4", bytes: exact })).toBeNull();
  });

  it("refuses bytes that do not start like a video", () => {
    expect(clipProblem({ contentType: "video/mp4", bytes: new TextEncoder().encode("<html>") })).toBe(
      "That file doesn't look like a video. Export it as MP4 or WebM and try again.",
    );
  });
});
