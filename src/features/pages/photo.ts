import { megabytes } from "../games/games.ts";

// A maker's photo: what a file must be to be kept, and where it is kept. Like a clip it is stored in the bucket under
// a key made here, and served to anyone from the media address.

/** 5 MB: more than a phone's photo is once the page has cut it down, and little enough to send on any line. */
export const PHOTO_MAX_BYTES = 5_000_000;

/** The picture types a photo may have, and the file extension each gets in its key. */
const EXTENSIONS = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as const;
export type PhotoContentType = keyof typeof EXTENSIONS;

export function isPhotoContentType(value: string): value is PhotoContentType {
  // `Object.hasOwn`, not `value in`: a plain object also "has" what every object inherits (`constructor`).
  return Object.hasOwn(EXTENSIONS, value);
}

/**
 * `photos/<16 hex>.<ext>`: nothing else is a valid key, so no `..` or extra folder can get in. The game gate keeps a
 * copy of this pattern (it imports no feature), and a test holds the two to the same answers.
 */
const PHOTO_KEY = /^photos\/[0-9a-f]{16}\.(?:jpg|png|webp)$/;

/**
 * Where a photo lives. The random part gives each photo an address of its own, so a browser that kept the old one
 * never shows it for the new one.
 */
export function photoKeyFor(random16Hex: string, contentType: PhotoContentType): string {
  return `photos/${random16Hex}.${EXTENSIONS[contentType]}`;
}

/** Whether a key is exactly the shape `photoKeyFor` makes. The gate serves a photo only for such a key. */
export function isPhotoKey(key: string): boolean {
  return PHOTO_KEY.test(key);
}

// What each picture type starts with: a JPEG's start-of-image marker, and a PNG's eight-byte signature.
const JPEG_START = [0xff, 0xd8, 0xff];
const PNG_START = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
// A WebP is a RIFF file (bytes 0 to 3, then a length) whose form is "WEBP" (bytes 8 to 11).
const RIFF = [0x52, 0x49, 0x46, 0x46];
const WEBP = [0x57, 0x45, 0x42, 0x50];

function startsWith(bytes: Uint8Array, expected: readonly number[], offset: number): boolean {
  return expected.every((byte, index) => bytes[offset + index] === byte);
}

/**
 * Whether the bytes start the way a picture of this type must. The upload's Content-Type is only what the uploader
 * said; this looks at the file itself, so a page or an SVG (which can run script) stored under a picture's key is
 * refused before anything is served to the public. It is a first-bytes check, not a full parse.
 */
export function looksLikePhoto(bytes: Uint8Array, contentType: PhotoContentType): boolean {
  if (contentType === "image/jpeg") return startsWith(bytes, JPEG_START, 0);
  if (contentType === "image/png") return startsWith(bytes, PNG_START, 0);
  return startsWith(bytes, RIFF, 0) && startsWith(bytes, WEBP, 8);
}

/**
 * The words for what is wrong with an upload, or null when it is fine. The first thing wrong wins: the type, then the
 * size, then the file's own first bytes.
 */
export function photoProblem(upload: { contentType: string; bytes: Uint8Array }): string | null {
  const { contentType, bytes } = upload;
  if (!isPhotoContentType(contentType)) return "A photo is a JPEG, PNG or WebP picture.";
  if (bytes.length > PHOTO_MAX_BYTES) {
    return `That photo is ${megabytes(bytes.length)}. A photo can be up to ${megabytes(PHOTO_MAX_BYTES)}.`;
  }
  if (!looksLikePhoto(bytes, contentType)) {
    return "That file doesn't look like a picture. Save it as a JPEG or PNG and try again.";
  }
  return null;
}
