import { describe, expect, it } from "vitest";
import { VIDEO_MAX_BYTES, videoChoiceProblem } from "../../src/lib/video-choice.ts";

// What a maker is told the moment a video is chosen, before anything is sent. The server checks everything again.

const mp4 = { name: "my-game-upright.mp4", type: "video/mp4", size: 4_200_000 };

describe("videoChoiceProblem", () => {
  it("has nothing to say about an MP4 or a WebM that is small enough", () => {
    expect(videoChoiceProblem(mp4)).toBeNull();
    expect(videoChoiceProblem({ name: "a.webm", type: "video/webm", size: 1000 })).toBeNull();
    expect(videoChoiceProblem({ ...mp4, size: VIDEO_MAX_BYTES })).toBeNull();
  });

  it("is 30 MB", () => {
    expect(VIDEO_MAX_BYTES).toBe(30_000_000);
  });

  it("names the kind of file that was chosen when it is not an MP4 or a WebM", () => {
    expect(videoChoiceProblem({ name: "holiday.MOV", type: "video/quicktime", size: 1000 })).toBe(
      "That's a .mov file. Ruken takes MP4 or WebM videos. Export it as MP4 and choose it again.",
    );
  });

  it("does not name a kind when the file has none", () => {
    expect(videoChoiceProblem({ name: "holiday", type: "", size: 1000 })).toBe(
      "That file isn't an MP4 or WebM video. Export it as MP4 and choose it again.",
    );
  });

  it("says how big a video that is too big is, and what to do", () => {
    expect(videoChoiceProblem({ ...mp4, size: 42_000_000 })).toBe(
      "That video is 42 MB. Videos can be up to 30 MB. Make it shorter or smaller, then choose it again.",
    );
  });

  it("tells the kind first when a file is both the wrong kind and too big", () => {
    expect(videoChoiceProblem({ name: "big.mov", type: "video/quicktime", size: 42_000_000 })).toMatch(
      /^That's a \.mov file\./,
    );
  });
});
