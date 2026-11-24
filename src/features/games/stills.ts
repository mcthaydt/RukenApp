import type { FileStore } from "../../lib/files/store.ts";
import type { MakeFrame } from "../../lib/server/frames.ts";
import { isStillWidth, type StillWidth } from "../../lib/stills.ts";
import { isClipKey } from "./clips.ts";

// A clip's still: one frame of the clip as a small picture, shown in the video's own place until the video plays, so a
// person sees the game at once instead of an empty panel (the owner, 2026-11-24: "use pictures of the first frame of
// the video until the video loads").
//
// The still is made from the stored clip itself, never sent in by a maker, so it can only ever show what the video
// shows. It is made the first time anyone asks for it and kept beside the clip, so each one is made once. A clip that is
// gone (replaced, sent back, taken off) has no still, whatever is left in the bucket.

/** A still is of a whole second of the clip, from its start up to this. The landing page starts its clips a few in. */
export const STILL_LAST_SECOND = 60;

/** Makes one frame of a video as a JPEG. A site with nothing to make it with (dev, a copy of the app) has none. */
export type FrameMaker = MakeFrame;

export function isStillSecond(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= STILL_LAST_SECOND;
}

/**
 * The folder a clip's stills are kept in: `clips/<public id>/stills/<shape>-<16 hex>/`. Inside the game's own clips
 * folder, so taking a game off (which empties that folder) takes its stills too; a folder per clip, so the clip's own
 * removal can empty it. Not the shape of a clip key, so the media address never serves a still.
 */
export function stillFolderOf(clipKey: string): string {
  const slash = clipKey.lastIndexOf("/");
  const name = clipKey.slice(slash + 1);
  const dot = name.lastIndexOf(".");
  return `${clipKey.slice(0, slash)}/stills/${name.slice(0, dot)}/`;
}

/** Where a still is kept: `<folder>/<second>s-<width>.jpg`. */
export function stillKeyFor(clipKey: string, second: number, width: StillWidth): string {
  return `${stillFolderOf(clipKey)}${String(second)}s-${String(width)}.jpg`;
}

/**
 * The mark left where a still could not be made: `<folder>/<second>s-<width>.none`. The media tool may bill each call,
 * and the still address keeps no answer of "nothing" in anyone's browser, so without it every view of the clip would
 * ask the tool again. Kept in the clip's still folder, so the clip's removal (or a new clip) clears it.
 */
export function failedMarkFor(clipKey: string, second: number, width: StillWidth): string {
  return `${stillFolderOf(clipKey)}${String(second)}s-${String(width)}.none`;
}

/** Removes a clip's file and every still made from it. */
export async function deleteClipFile(files: FileStore, clipKey: string): Promise<void> {
  await files.delete(clipKey);
  await files.deleteAll(stillFolderOf(clipKey));
}

/** What the still address answers: the picture's bytes, or nothing (the video then shows as it did before stills). */
export type StillAnswer = { kind: "still"; bytes: Uint8Array<ArrayBuffer> } | { kind: "none" };

/**
 * The still of `clipKey` at `second`, `width` wide: the kept one, or a new one made from the clip and kept. Nothing
 * for a key that is not a clip's, a clip that is not stored, or a site with no frame maker; and nothing when making it
 * fails, so a still can never stop a page. A failure is marked and never tried again for that clip.
 */
export async function stillOf(
  deps: { files: FileStore; frame: FrameMaker | null; log?: (line: string) => void },
  clipKey: string,
  second: number,
  width: number,
): Promise<StillAnswer> {
  if (!isClipKey(clipKey) || !isStillSecond(second) || !isStillWidth(width)) return { kind: "none" };
  // The clip is looked for first, every time: a clip that was replaced or sent back leaves no still anyone can see.
  if ((await deps.files.head(clipKey)) === null) return { kind: "none" };
  const key = stillKeyFor(clipKey, second, width);
  const kept = await deps.files.get(key);
  if (kept !== null)
    return { kind: "still", bytes: new Uint8Array(await new Response(kept.body).arrayBuffer()) };
  // With no frame maker nothing is asked and nothing is marked, so the media tool can still make it later.
  if (deps.frame === null) return { kind: "none" };
  const failed = failedMarkFor(clipKey, second, width);
  if ((await deps.files.head(failed)) !== null) return { kind: "none" };
  const clip = await deps.files.get(clipKey);
  if (clip === null) return { kind: "none" };
  try {
    const bytes = await deps.frame(clip.body, { second, width });
    await deps.files.put(key, bytes);
    return { kind: "still", bytes };
  } catch (error) {
    (deps.log ?? console.error)(
      `A still could not be made: ${error instanceof Error ? error.message : String(error)}`,
    );
    await deps.files.put(failed, new Uint8Array());
    return { kind: "none" };
  }
}
