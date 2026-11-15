import type { ClipShape } from "../../lib/server/db.ts";
import { VIDEO_MAX_BYTES, wholeMegabytes } from "../../lib/video-choice.ts";

// The two clips every game has: one upright (for a phone held upright) and one wide, short videos that play without
// sound. They are stored in the bucket under a key made here, and served to anyone from the media address.

/** 30 MB: a short loop fits easily, and two of them are saved one request at a time. The browser checks the same. */
export const CLIP_MAX_BYTES = VIDEO_MAX_BYTES;

/** The video types a clip may have, and the file extension each gets in its key. */
// QuickTime is what a Mac saves when it records its screen (Owner, 2026-11-15: "Yes, take .mov").
const EXTENSIONS = { "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov" } as const;
export type ClipContentType = keyof typeof EXTENSIONS;

/** Every type a clip may have. The gate's test makes a key for each, so a type added here is held against the gate. */
export const CLIP_CONTENT_TYPES = Object.keys(EXTENSIONS) as readonly ClipContentType[];

/**
 * The most a clip's request may be before its body is read: a 30 MB clip and the form around it. One clip per request
 * keeps the Worker well under its 128 MB (two clips in one form would be held in memory with their copies).
 */
export const CLIP_REQUEST_MAX_BYTES = CLIP_MAX_BYTES + 1_000_000;

/** Not built yet. */
export function clipRequestTooBig(contentLength: string | null): boolean {
  throw new Error(`not built yet: ${String(contentLength)}`);
}

export function isClipContentType(value: string): value is ClipContentType {
  // `Object.hasOwn`, not `value in`: a plain object also "has" what every object inherits (`constructor`).
  return Object.hasOwn(EXTENSIONS, value);
}

/** `clips/<public id>/<shape>-<16 hex>.<ext>`: nothing else is a valid key, so no `..` or extra folder can get in. */
const CLIP_KEY = /^clips\/[a-z2-7]{10}\/(?:upright|wide)-[0-9a-f]{16}\.(?:mp4|webm|mov)$/;

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
/** "ftyp": an MP4 opens with a box of this type, and so does a QuickTime file a Mac saves. Bytes 0 to 3 are the box's length, which varies. */
const MP4_FTYP = [0x66, 0x74, 0x79, 0x70];

/**
 * Whether the bytes start the way a video of this type must. The upload's Content-Type is only what the uploader
 * said; this looks at the file itself, so a page or a script stored under a video key is refused before anything is
 * served to the public. It is a first-bytes check, not a full parse: a clip is only ever played, muted, in a <video>
 * element, which shows nothing for a file it cannot decode.
 */
export function looksLikeVideo(bytes: Uint8Array, contentType: ClipContentType): boolean {
  if (contentType === "video/webm") return startsWith(bytes, WEBM_MAGIC, 0);
  // MP4 and QuickTime share the box that opens the file; a QuickTime file that opens with another box is refused.
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
  if (!isClipContentType(contentType)) return "Ruken takes MP4, WebM or MOV videos.";
  if (bytes.length > CLIP_MAX_BYTES) {
    return `That video is ${wholeMegabytes(bytes.length)}. Videos can be up to ${wholeMegabytes(CLIP_MAX_BYTES)}. Make it shorter or smaller, then choose it again.`;
  }
  if (!looksLikeVideo(bytes, contentType)) {
    return "That file doesn't look like a video. Save it as MP4, WebM or MOV and try again.";
  }
  return null;
}
