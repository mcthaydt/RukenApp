import { describe, expect, test } from "vitest";
import {
  deleteClipFile,
  STILL_LAST_SECOND,
  stillFolderOf,
  stillKeyFor,
  stillOf,
  type FrameMaker,
} from "../../../src/features/games/stills.ts";
import { isClipKey } from "../../../src/features/games/clips.ts";
import { MemoryFileStore } from "../../support/memory-file-store.ts";

const CLIP = "clips/abcdefghij/upright-0123456789abcdef.mp4";
const VIDEO = new Uint8Array([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 1, 2, 3]);
const PICTURE = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 9, 9]);

/** A frame maker that answers PICTURE and counts its calls, and what it was asked for. */
function countingMaker(): { frame: FrameMaker; calls: { second: number; width: number; bytes: number }[] } {
  const calls: { second: number; width: number; bytes: number }[] = [];
  const frame: FrameMaker = async (video, at) => {
    const bytes = new Uint8Array(await new Response(video).arrayBuffer());
    calls.push({ second: at.second, width: at.width, bytes: bytes.length });
    return new Uint8Array(PICTURE);
  };
  return { frame, calls };
}

async function storeWithClip(): Promise<MemoryFileStore> {
  const files = new MemoryFileStore();
  await files.put(CLIP, VIDEO);
  return files;
}

describe("where a still is kept", () => {
  test("in a folder of its own clip, inside the game's clips folder, and never in the shape of a clip key", () => {
    expect(stillFolderOf(CLIP)).toBe("clips/abcdefghij/stills/upright-0123456789abcdef/");
    const key = stillKeyFor(CLIP, 2, 540);
    expect(key).toBe("clips/abcdefghij/stills/upright-0123456789abcdef/2s-540.jpg");
    expect(key.startsWith("clips/abcdefghij/")).toBe(true);
    // The media address serves only clip keys, so a still is only ever served by the still address.
    expect(isClipKey(key)).toBe(false);
  });
});

describe("a clip's still", () => {
  test("is made from the stored clip, at the second and width asked for, once, and kept", async () => {
    const files = await storeWithClip();
    const { frame, calls } = countingMaker();
    const first = await stillOf({ files, frame }, CLIP, 2, 540);
    const second = await stillOf({ files, frame }, CLIP, 2, 540);
    expect(first).toEqual({ kind: "still", bytes: PICTURE });
    expect(second).toEqual({ kind: "still", bytes: PICTURE });
    expect(calls).toEqual([{ second: 2, width: 540, bytes: VIDEO.length }]);
    expect((await files.head(stillKeyFor(CLIP, 2, 540)))?.size).toBe(PICTURE.length);
  });

  test("is nothing for a key that is not a clip's, a second or width out of range, or a clip not stored", async () => {
    const files = await storeWithClip();
    const { frame, calls } = countingMaker();
    const asks: [string, number, number][] = [
      ["files/abcdefghij/index.html", 0, 540],
      ["clips/abcdefghij/../secret.mp4", 0, 540],
      [stillKeyFor(CLIP, 0, 540), 0, 540],
      [CLIP, -1, 540],
      [CLIP, 1.5, 540],
      [CLIP, STILL_LAST_SECOND + 1, 540],
      [CLIP, Number.NaN, 540],
      [CLIP, 0, 500],
      [CLIP, 0, 4000],
      ["clips/abcdefghij/upright-ffffffffffffffff.mp4", 0, 540],
    ];
    for (const [key, at, width] of asks) {
      expect(
        await stillOf({ files, frame }, key, at, width),
        `${key} ${String(at)} ${String(width)}`,
      ).toEqual({
        kind: "none",
      });
    }
    expect(calls).toEqual([]);
  });

  test("of a clip that is gone is nothing, even when its still is still in the bucket", async () => {
    const files = await storeWithClip();
    const { frame } = countingMaker();
    await stillOf({ files, frame }, CLIP, 0, 360);
    await files.delete(CLIP);
    expect(await stillOf({ files, frame }, CLIP, 0, 360)).toEqual({ kind: "none" });
  });

  test("is nothing on a site with no frame maker, and nothing (with a line in the log) when making it fails", async () => {
    const files = await storeWithClip();
    expect(await stillOf({ files, frame: null }, CLIP, 0, 360)).toEqual({ kind: "none" });
    const lines: string[] = [];
    const broken: FrameMaker = () => Promise.reject(new Error("no such tool"));
    const answer = await stillOf({ files, frame: broken, log: (line) => lines.push(line) }, CLIP, 0, 360);
    expect(answer).toEqual({ kind: "none" });
    expect(lines).toEqual(["A still could not be made: no such tool"]);
  });

  test("that failed is never asked of the media tool again, since each call may be billed", async () => {
    const files = await storeWithClip();
    let calls = 0;
    const broken: FrameMaker = () => {
      calls += 1;
      return Promise.reject(new Error("bad video"));
    };
    const deps = { files, frame: broken, log: () => undefined };
    expect(await stillOf(deps, CLIP, 2, 360)).toEqual({ kind: "none" });
    expect(await stillOf(deps, CLIP, 2, 360)).toEqual({ kind: "none" });
    expect(calls).toBe(1);
    // The mark is kept with the clip's stills, so the clip's removal takes it too.
    expect(await files.hasAny(stillFolderOf(CLIP))).toBe(true);
    await deleteClipFile(files, CLIP);
    expect(await files.hasAny(stillFolderOf(CLIP))).toBe(false);
  });

  test("that failed is tried again a day later, so one bad day of the media tool never leaves a clip without one", async () => {
    const files = await storeWithClip();
    let now = Date.UTC(2026, 10, 24, 3, 0);
    let fails = true;
    let calls = 0;
    const frame: FrameMaker = () => {
      calls += 1;
      return fails ? Promise.reject(new Error("no permission")) : Promise.resolve(new Uint8Array(PICTURE));
    };
    const deps = { files, frame, log: () => undefined, now: () => now };
    expect(await stillOf(deps, CLIP, 2, 360)).toEqual({ kind: "none" });
    now += 24 * 60 * 60 * 1000 - 1;
    expect(await stillOf(deps, CLIP, 2, 360)).toEqual({ kind: "none" });
    expect(calls).toBe(1);
    now += 1;
    expect(await stillOf(deps, CLIP, 2, 360)).toEqual({ kind: "none" });
    expect(calls).toBe(2);
    // Failed again, so it waits another full day from this try.
    now += 24 * 60 * 60 * 1000 - 1;
    fails = false;
    expect(await stillOf(deps, CLIP, 2, 360)).toEqual({ kind: "none" });
    expect(calls).toBe(2);
    now += 1;
    expect(await stillOf(deps, CLIP, 2, 360)).toEqual({ kind: "still", bytes: PICTURE });
    expect(calls).toBe(3);
  });

  test("is not marked as failed on a site with no frame maker, so the media tool can make it later", async () => {
    const files = await storeWithClip();
    expect(await stillOf({ files, frame: null }, CLIP, 2, 360)).toEqual({ kind: "none" });
    expect(await files.hasAny(stillFolderOf(CLIP))).toBe(false);
    const { frame, calls } = countingMaker();
    expect((await stillOf({ files, frame }, CLIP, 2, 360)).kind).toBe("still");
    expect(calls).toHaveLength(1);
  });
});

describe("removing a clip's file", () => {
  test("takes every still made from it, and leaves the game's other clip and its stills", async () => {
    const files = await storeWithClip();
    const other = "clips/abcdefghij/wide-fedcba9876543210.mp4";
    await files.put(other, VIDEO);
    const { frame } = countingMaker();
    await stillOf({ files, frame }, CLIP, 0, 360);
    await stillOf({ files, frame }, CLIP, 2, 1080);
    await stillOf({ files, frame }, other, 0, 360);
    await deleteClipFile(files, CLIP);
    expect(await files.head(CLIP)).toBeNull();
    expect(await files.hasAny(stillFolderOf(CLIP))).toBe(false);
    expect(await files.head(other)).not.toBeNull();
    expect(await files.head(stillKeyFor(other, 0, 360))).not.toBeNull();
  });
});
