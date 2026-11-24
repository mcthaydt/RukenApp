// The widths a video's still (src/features/games/stills.ts) is made at, shared by the server that makes it and the page
// that asks for it. Five sizes, so a phone, a tablet and a computer each fetch a picture about as big as the video it
// stands in for, and each still is made at most five times.

export const STILL_WIDTHS = [240, 360, 540, 720, 1080] as const;
export type StillWidth = (typeof STILL_WIDTHS)[number];

export function isStillWidth(value: number): value is StillWidth {
  return (STILL_WIDTHS as readonly number[]).includes(value);
}

/** The smallest width that covers `pixels` (the video's width on the screen, in the screen's own pixels). */
export function stillWidthFor(pixels: number): StillWidth {
  return STILL_WIDTHS.find((width) => width >= pixels) ?? 1080;
}
