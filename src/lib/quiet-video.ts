// A video that plays by itself only where a person would not mind (spec 5a note 7 and 5b): never for a person who
// asked for less motion or is saving data, and never on a small device. Everywhere else a video shows its first
// frame and waits to be chosen.

/** What this device and this person's settings say about carrying a video that moves. */
export interface QuietEnvironment {
  reducedMotion: boolean;
  saveData: boolean;
  /** Gigabytes of memory the browser reports, or undefined where it does not say (Safari, Firefox). */
  deviceMemory: number | undefined;
}

/** The least memory a device reports and still starts a video by itself. */
const LEAST_MEMORY_GB = 4;

/** Whether a video may start by itself here: never with reduced motion or Save-Data, nor on a device that reports under 4 GB of memory. */
export function mayAutoplay(env: QuietEnvironment): boolean {
  if (env.reducedMotion || env.saveData) return false;
  // A browser that does not say how much memory it has is not assumed to be small.
  return env.deviceMemory === undefined || env.deviceMemory >= LEAST_MEMORY_GB;
}

/** The two things a browser reports that TypeScript's own types leave out. */
interface ReportingNavigator {
  deviceMemory?: number;
  connection?: { saveData?: boolean };
}

/** Whether anything that only decorates may move on this device: the same answer a video is given. */
export function mayMove(): boolean {
  const reported = navigator as Navigator & ReportingNavigator;
  return mayAutoplay({
    reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
    saveData: reported.connection?.saveData === true,
    deviceMemory: reported.deviceMemory,
  });
}

/** The start time, in seconds, that a video's address names (`#t=2`, `#t=0.001`), or 0 where it names none. */
export function startOf(address: string): number {
  const named = /#t=([0-9.]+)/.exec(address)?.[1];
  const seconds = named === undefined ? Number.NaN : Number(named);
  return Number.isFinite(seconds) ? seconds : 0;
}

/** How close to its end, in seconds, a video counts as having reached it. */
const END_WITHIN_SECONDS = 0.01;

/** Whether a video at this time has reached the end of its length, where its length is known. */
export function atEnd(currentTime: number, duration: number): boolean {
  return Number.isFinite(duration) && duration > 0 && currentTime >= duration - END_WITHIN_SECONDS;
}

/**
 * Where a video that reached its end starts again: the start its address names, or the very beginning where that start
 * is at or past the end (a short clip given a later start), which would otherwise send it back to its end over and over.
 */
export function restartAt(start: number, duration: number): number {
  return atEnd(start, duration) || start > duration ? 0 : start;
}

/**
 * A Svelte action: when the video reaches its end, it goes back to the start its address names and plays again. It
 * never sets `loop`, because Safari's engine on Linux (GStreamer) mishandles the browser's own loop in two ways. A
 * looping video whose address names a start time (`#t=0.001`, which makes a still video draw its first frame, or the
 * landing page's `#t=2`), or one rewound while looping (the feed rewinds the clip a person left), jumps back to its
 * start about a hundred times a second and never plays. And a video whose `loop` is switched on while it plays
 * sometimes stops the whole page at its end, for good (about 1 to 4 views in 100). The same engine sometimes also stops
 * a video at its last frame without saying it ended (it still reads as playing and sends only `stalled`), so the last
 * `timeupdate` at the end counts as the end too (progress.md, Flaky tests).
 */
export function loopByHand(node: HTMLVideoElement): { destroy(): void } {
  node.loop = false;
  const playAgainAtEnd = (): void => {
    // Once sent back, the video is no longer at its end, so an `ended` that follows the last `timeupdate` does nothing.
    if (!node.ended && !atEnd(node.currentTime, node.duration)) return;
    node.currentTime = restartAt(startOf(node.getAttribute("src") ?? node.currentSrc), node.duration);
    // A refused play leaves the clip still at its start, which is the quiet answer.
    node.play().catch(() => undefined);
  };
  const events = ["ended", "timeupdate"] as const;
  for (const name of events) node.addEventListener(name, playAgainAtEnd);
  return {
    destroy() {
      for (const name of events) node.removeEventListener(name, playAgainAtEnd);
    },
  };
}

/** A Svelte action: starts a muted, looping video only where mayAutoplay says so. Without script a video shows its first frame. */
export function quietVideo(node: HTMLVideoElement): { destroy(): void } {
  node.muted = true;
  node.playsInline = true;
  const looping = loopByHand(node);
  // A refused play (the browser's own autoplay rules) leaves the first frame showing, which is the quiet answer.
  if (mayMove()) node.play().catch(() => undefined);
  return looping;
}
