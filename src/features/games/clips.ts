import type { ClipShape } from "../../lib/server/db.ts";

export const CLIP_MAX_BYTES = 30_000_000;

export type ClipContentType = "video/mp4" | "video/webm";

export function isClipContentType(value: string): value is ClipContentType {
  throw new Error(`not built yet: ${value}`);
}

export function looksLikeVideo(bytes: Uint8Array, contentType: ClipContentType): boolean {
  throw new Error(`not built yet: ${String(bytes.length)} ${contentType}`);
}

export function clipKeyFor(
  publicId: string,
  shape: ClipShape,
  random16Hex: string,
  contentType: ClipContentType,
): string {
  throw new Error(`not built yet: ${publicId} ${shape} ${random16Hex} ${contentType}`);
}

export function isClipKey(key: string): boolean {
  throw new Error(`not built yet: ${key}`);
}

export function clipProblem(upload: { contentType: string; bytes: Uint8Array }): string | null {
  throw new Error(`not built yet: ${upload.contentType} ${String(upload.bytes.length)}`);
}
