import type { ClipShape } from "../../lib/server/db.ts";
import { megabytes } from "./files-check.ts";

// The two clips every game has: one upright (for a phone held upright) and one wide, short videos that play without
// sound. They are stored in the bucket under a key made here, and served to anyone from the media address.

/** 30 MB: a short loop fits easily, and two of them are saved one request at a time. */
export const CLIP_MAX_BYTES = 30_000_000;

/** The video types a clip may have, and the file extension each gets in its key. */
const EXTENSIONS = { "video/mp4": "mp4", "video/webm": "webm" } as const;
export type ClipContentType = keyof typeof EXTENSIONS;

export function isClipContentType(value: string): value is ClipContentType {
  // `Object.hasOwn`, not `value in`: a plain object also "has" what every object inherits (`constructor`).
  return Object.hasOwn(EXTENSIONS, value);
}

/** `clips/<public id>/<shape>-<16 hex>.<ext>`: nothing else is a valid key, so no `..` or extra folder can get in. */
const CLIP_KEY = /^clips\/[a-z2-7]{10}\/(?:upright|wide)-[0-9a-f]{16}\.(?:mp4|webm)$/;

/**
 * Where a clip lives. The random part gives every upload its own address, so a browser that kept the old clip never
 * shows it for the new one, and a Worker does not have to hash 30 MB to name it.
 */
export function clipKeyFor(
  publicId: string,
  shape: ClipShape,
  random16Hex: string,
  contentType: ClipContentType,
): string {
  return `clips/${publicId}/${shape}-${random16Hex}.${EXTENSIONS[contentType]}`;
}

/** Whether a key is exactly the shape `clipKeyFor` makes. The gate serves a clip only for such a key. */
export function isClipKey(key: string): boolean {
  return CLIP_KEY.test(key);
}

/** EBML's magic number, the first four bytes of every WebM (and Matroska) file. */
const WEBM_MAGIC = [0x1a, 0x45, 0xdf, 0xa3];
/** "ftyp": an MP4 opens with a box of this type. Bytes 0 to 3 are the box's length, which varies. */
const MP4_FTYP = [0x66, 0x74, 0x79, 0x70];

/**
 * Whether the bytes start the way a video of this type must. The upload's Content-Type is only what the uploader
 * said; this looks at the file itself, so a page or a script stored under a video key is refused before anything is
 * served to the public. It is a first-bytes check, not a full parse: a clip is only ever played, muted, in a <video>
 * element, which shows nothing for a file it cannot decode.
 */
export function looksLikeVideo(bytes: Uint8Array, contentType: ClipContentType): boolean {
  if (contentType === "video/webm") return startsWith(bytes, WEBM_MAGIC, 0);
  return startsWith(bytes, MP4_FTYP, 4);
}

function startsWith(bytes: Uint8Array, expected: readonly number[], offset: number): boolean {
  return expected.every((byte, index) => bytes[offset + index] === byte);
}

/**
 * The words for what is wrong with an upload, or null when it is fine. The first thing wrong wins: the type, then the
 * size, then the file's own first bytes.
 */
export function clipProblem(upload: { contentType: string; bytes: Uint8Array }): string | null {
  const { contentType, bytes } = upload;
  if (!isClipContentType(contentType)) return "Clips are MP4 or WebM video.";
  if (bytes.length > CLIP_MAX_BYTES) {
    return `That clip is ${megabytes(bytes.length)}. A clip can be up to ${megabytes(CLIP_MAX_BYTES)}.`;
  }
  if (!looksLikeVideo(bytes, contentType)) {
    return "That file doesn't look like a video. Export it as MP4 or WebM and try again.";
  }
  return null;
}
