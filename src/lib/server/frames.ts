// What makes a video's still (src/features/games/stills.ts): the host sets it once, in src/hooks.server.ts, as it sets
// the bucket. On Cloudflare it is the media tool; where there is none (dev, the journeys, a copy of the app) it is null
// and pages show their videos without stills.

/** Makes one frame of a video, `width` wide, as a JPEG. */
export type MakeFrame = (
  video: ReadableStream<Uint8Array>,
  at: { second: number; width: number },
) => Promise<Uint8Array<ArrayBuffer>>;

let current: () => MakeFrame | null = () => null;

export function setFrameMaker(open: () => MakeFrame | null): void {
  current = open;
}

export function frameMaker(): MakeFrame | null {
  return current();
}
