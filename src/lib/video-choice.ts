// What is wrong with a video a maker chose, before anything is sent. Not built yet.

/** The most a video may be: 30 MB. */
export const VIDEO_MAX_BYTES = 30_000_000;

/** What the browser tells us of a chosen file. */
export interface ChosenFile {
  name: string;
  type: string;
  size: number;
}

/** The words for what is wrong with the chosen file, or null when it is fine. */
export function videoChoiceProblem(file: ChosenFile): string | null {
  throw new Error(`videoChoiceProblem is not built yet (${file.name})`);
}
