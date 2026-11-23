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

/** How far a video has played, in seconds, before it is told to loop: past the start time its address may name. */
const LOOP_AFTER_SECONDS = 0.1;

/** A Svelte action: starts a muted, looping video only where mayAutoplay says so. Without script a video shows its first frame. */
export function quietVideo(node: HTMLVideoElement): void {
  node.muted = true;
  node.playsInline = true;
  // Looping is turned on only once the video has played on from its start. Safari's engine on Linux (GStreamer), given
  // a looping video whose address names a start time (`#t=0.001`, which makes a still video draw its first frame),
  // jumps back to the start about a hundred times a second and never plays, and keeps the page too busy to answer.
  node.loop = false;
  const loopOncePlaying = (): void => {
    if (node.currentTime < LOOP_AFTER_SECONDS) return;
    node.loop = true;
    node.removeEventListener("timeupdate", loopOncePlaying);
  };
  node.addEventListener("timeupdate", loopOncePlaying);
  // A refused play (the browser's own autoplay rules) leaves the first frame showing, which is the quiet answer.
  if (mayMove()) node.play().catch(() => undefined);
}
