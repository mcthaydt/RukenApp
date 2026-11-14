// Which part of a picture a photo keeps. Pure, so a page can use it in the browser and a test can use it anywhere.

/** The side, in pixels, of the square a photo is cut to before it is sent. */
export const PHOTO_SIDE = 512;

/**
 * The largest square in the middle of a picture of this size. It starts on a whole pixel, as a canvas draws a part of
 * a pixel as a blurred edge.
 */
export function cropSquare(width: number, height: number): { x: number; y: number; side: number } {
  const side = Math.min(width, height);
  return { x: Math.floor((width - side) / 2), y: Math.floor((height - side) / 2), side };
}
