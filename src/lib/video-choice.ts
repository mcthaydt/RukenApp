// What is wrong with a video a maker has just chosen, found in the browser before anything is sent, so a 30 MB trip
// that would be refused is never made. It lives here, not in the games feature, because a screen reaches a feature
// only through its entry, which holds server code a browser must not load. The server checks everything again
// (`clipProblem`, features/games/clips.ts): this only saves the trip.

/** The most a video may be: 30 MB. */
export const VIDEO_MAX_BYTES = 30_000_000;

/** What the browser tells us of a chosen file. */
export interface ChosenFile {
  name: string;
  type: string;
  size: number;
}

/** The video types a maker may add. */
export const VIDEO_TYPES: readonly string[] = ["video/mp4", "video/webm"];

/** Whole megabytes, rounded up, so a video that is over the limit never reads as exactly the limit: "31 MB". */
export function wholeMegabytes(bytes: number): string {
  return `${String(Math.ceil(bytes / 1_000_000))} MB`;
}

/** The ending of a file's name, lower case, with its dot (".mov"), or null when it has none. */
function endingOf(name: string): string | null {
  const match = /\.([A-Za-z0-9]{1,8})$/.exec(name);
  return match === null ? null : `.${(match[1] ?? "").toLowerCase()}`;
}

/** The words for what is wrong with the chosen file, or null when it is fine. The kind is told before the size. */
export function videoChoiceProblem(file: ChosenFile): string | null {
  if (!VIDEO_TYPES.includes(file.type)) {
    const ending = endingOf(file.name);
    return ending === null
      ? "That file isn't an MP4 or WebM video. Export it as MP4 and choose it again."
      : `That's a ${ending} file. Ruken takes MP4 or WebM videos. Export it as MP4 and choose it again.`;
  }
  if (file.size > VIDEO_MAX_BYTES) {
    return `That video is ${wholeMegabytes(file.size)}. Videos can be up to ${wholeMegabytes(VIDEO_MAX_BYTES)}. Make it shorter or smaller, then choose it again.`;
  }
  return null;
}
