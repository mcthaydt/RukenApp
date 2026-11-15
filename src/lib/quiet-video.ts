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

/** Whether a video may start by itself here: never with reduced motion or Save-Data, nor on a device that reports under 4 GB of memory. */
export function mayAutoplay(env: QuietEnvironment): boolean {
  return env.deviceMemory !== undefined;
}

/** A Svelte action: starts a muted, looping video only where mayAutoplay says so. Without script a video shows its first frame. */
export function quietVideo(node: HTMLVideoElement): void {
  node.muted = true;
}
