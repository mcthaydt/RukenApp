// A video's still (src/features/games/stills.ts makes it): what the server that makes it and the page that asks for it
// share. Every clip a page shows has an address that ends in its key in the bucket, so a page finds a clip's still
// from the clip's own address, and any video anywhere gets one with nothing new from its server.

/** The widths a still is made at: a phone, a tablet and a computer each fetch one about as big as the video. */
export const STILL_WIDTHS = [240, 360, 540, 720, 1080] as const;
export type StillWidth = (typeof STILL_WIDTHS)[number];

/** The site's address a still is asked for at: this, then the clip's key, `?at=<second>&width=<width>`. */
export const STILL_PATH = "/api/still/";

/** A clip's key at the end of its address (the media address, a slash, the key), as `clips.ts` makes it. */
const CLIP_AT_END = /(clips\/[a-z2-7]{10}\/(?:upright|wide)-[0-9a-f]{16}\.(?:mp4|webm|mov))$/;

export function isStillWidth(value: number): value is StillWidth {
  return (STILL_WIDTHS as readonly number[]).includes(value);
}

/** The smallest width that covers `pixels` (the video's width on the screen, in the screen's own pixels). */
export function stillWidthFor(pixels: number): StillWidth {
  return STILL_WIDTHS.find((width) => width >= pixels) ?? 1080;
}

/**
 * Where a clip's still is, from the clip's address, and the second it opens on (the address's `#t=`, to the whole
 * second below, so the still is the frame the video starts on). Null for an address that is not a stored clip's (a
 * file a maker has chosen but not sent, say).
 */
export function stillOfClip(clip: string): { address: string; second: number } | null {
  const hash = clip.indexOf("#");
  const path = hash === -1 ? clip : clip.slice(0, hash);
  const key = CLIP_AT_END.exec(path)?.[1];
  if (key === undefined) return null;
  const start = hash === -1 ? null : /(?:^|&)t=([\d.]+)/.exec(clip.slice(hash + 1))?.[1];
  const second = start == null ? 0 : Math.floor(Number(start));
  return { address: `${STILL_PATH}${key}`, second: Number.isFinite(second) ? second : 0 };
}
