import { describe, expect, it } from "vitest";
import {
  isPhotoContentType,
  isPhotoKey,
  looksLikePhoto,
  PHOTO_MAX_BYTES,
  photoKeyFor,
  photoProblem,
} from "../../../src/features/pages/photo.ts";

const HEX = "0123456789abcdef";

// The first bytes of each kind of picture a photo may be.
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
// "RIFF", four length bytes, then "WEBP".
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x10, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);

const FIRST_BYTES = [
  ["image/jpeg", JPEG],
  ["image/png", PNG],
  ["image/webp", WEBP],
] as const;

function text(content: string): Uint8Array {
  return new TextEncoder().encode(content);
}

describe("the photo limit", () => {
  it("is 5 MB", () => {
    expect(PHOTO_MAX_BYTES).toBe(5_000_000);
  });
});

describe("isPhotoContentType", () => {
  it.each(["image/jpeg", "image/png", "image/webp"])("accepts %s", (value) => {
    expect(isPhotoContentType(value)).toBe(true);
  });

  it.each(["image/gif", "image/svg+xml", "text/html", "", "constructor", "__proto__"])(
    "refuses %j",
    (value) => {
      expect(isPhotoContentType(value)).toBe(false);
    },
  );
});

describe("looksLikePhoto", () => {
  it.each(FIRST_BYTES)("knows %s by its own first bytes", (contentType, bytes) => {
    expect(looksLikePhoto(bytes, contentType)).toBe(true);
  });

  it.each(
    FIRST_BYTES.flatMap(([contentType]) =>
      FIRST_BYTES.filter(([other]) => other !== contentType).map(
        ([other, bytes]) => [contentType, other, bytes] as const,
      ),
    ),
  )("refuses a file sent as %s that starts like %s", (contentType, _other, bytes) => {
    expect(looksLikePhoto(bytes, contentType)).toBe(false);
  });

  it("refuses a file too short to tell", () => {
    expect(looksLikePhoto(new Uint8Array([0xff, 0xd8]), "image/jpeg")).toBe(false);
    expect(looksLikePhoto(new Uint8Array(), "image/png")).toBe(false);
    expect(looksLikePhoto(WEBP.slice(0, 11), "image/webp")).toBe(false);
  });

  it("refuses a RIFF file that is not a WebP", () => {
    const wave = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x10, 0, 0, 0, 0x57, 0x41, 0x56, 0x45]);
    expect(looksLikePhoto(wave, "image/webp")).toBe(false);
  });
});

describe("photoProblem", () => {
  it("lets each good photo through", () => {
    for (const [contentType, bytes] of FIRST_BYTES) {
      expect(photoProblem({ contentType, bytes })).toBeNull();
    }
  });

  it("lets a photo of exactly the limit through", () => {
    const bytes = new Uint8Array(PHOTO_MAX_BYTES);
    bytes.set(PNG);
    expect(photoProblem({ contentType: "image/png", bytes })).toBeNull();
  });

  it("says what a photo is when it is not one of the three types", () => {
    expect(photoProblem({ contentType: "image/gif", bytes: PNG })).toBe(
      "A photo is a JPEG, PNG or WebP picture.",
    );
    expect(photoProblem({ contentType: "video/mp4", bytes: PNG })).toBe(
      "A photo is a JPEG, PNG or WebP picture.",
    );
  });

  it("says how big the photo is, and how big one can be", () => {
    const bytes = new Uint8Array(PHOTO_MAX_BYTES + 1);
    bytes.set(PNG);
    expect(photoProblem({ contentType: "image/png", bytes })).toBe(
      "That photo is 6 MB. A photo can be up to 5 MB.",
    );
  });

  it("looks at the type before the size, and the size before the bytes", () => {
    const big = new Uint8Array(PHOTO_MAX_BYTES + 1);
    expect(photoProblem({ contentType: "image/gif", bytes: big })).toBe(
      "A photo is a JPEG, PNG or WebP picture.",
    );
    expect(photoProblem({ contentType: "image/png", bytes: big })).toBe(
      "That photo is 6 MB. A photo can be up to 5 MB.",
    );
  });

  // Review Focus 13: a page or a script stored under a picture's name would be served to the public.
  it.each([
    ["a web page", "<!doctype html><script>alert(1)</script>"],
    ["an SVG", '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'],
    ["nothing at all", ""],
  ])("refuses %s sent as a picture, by its first bytes", (_name, content) => {
    for (const contentType of ["image/png", "image/jpeg", "image/webp"]) {
      expect(photoProblem({ contentType, bytes: text(content) })).toBe(
        "That file doesn't look like a picture. Save it as a JPEG or PNG and try again.",
      );
    }
  });
});

describe("photoKeyFor", () => {
  it("binds the key to a random part and the file type", () => {
    expect(photoKeyFor(HEX, "image/jpeg")).toBe(`photos/${HEX}.jpg`);
    expect(photoKeyFor(HEX, "image/png")).toBe(`photos/${HEX}.png`);
    expect(photoKeyFor(HEX, "image/webp")).toBe(`photos/${HEX}.webp`);
  });
});

describe("isPhotoKey", () => {
  it.each(["image/jpeg", "image/png", "image/webp"] as const)(
    "accepts the key made for %s",
    (contentType) => {
      expect(isPhotoKey(photoKeyFor(HEX, contentType))).toBe(true);
    },
  );

  it.each([
    "",
    "photos/../x.png",
    `photos/${HEX}.svg`,
    `photos/${HEX}.html`,
    `photos/${HEX}.png.exe`,
    `photos/${HEX.slice(1)}.png`,
    `photos/${HEX.toUpperCase()}.png`,
    `photos/x/${HEX}.png`,
    `/photos/${HEX}.png`,
    `photos/${HEX}.png\n`,
    // A clip's key, and a game's own file.
    "clips/aaaaaaaaaa/upright-0123456789abcdef.mp4",
    `files/aaaaaaaaaa/p1/${HEX}.png`,
  ])("refuses %j", (key) => {
    expect(isPhotoKey(key)).toBe(false);
  });
});
