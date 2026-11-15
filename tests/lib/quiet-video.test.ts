import { describe, expect, it } from "vitest";
import { mayAutoplay } from "../../src/lib/quiet-video.ts";

// Whether a video may start by itself. A person who asked for less motion, a person saving data, and a small device
// are never made to carry a video they did not choose to play.

const easy = { reducedMotion: false, saveData: false, deviceMemory: 8 };

describe("mayAutoplay", () => {
  it("is false for a person who asked for reduced motion", () => {
    expect(mayAutoplay({ ...easy, reducedMotion: true })).toBe(false);
  });

  it("is false for a person who is saving data", () => {
    expect(mayAutoplay({ ...easy, saveData: true })).toBe(false);
  });

  it("is false for a device that reports 2 GB of memory", () => {
    expect(mayAutoplay({ ...easy, deviceMemory: 2 })).toBe(false);
  });

  it("is true with 4 GB or more", () => {
    expect(mayAutoplay({ ...easy, deviceMemory: 4 })).toBe(true);
    expect(mayAutoplay(easy)).toBe(true);
  });

  it("is true where the browser does not say how much memory there is", () => {
    expect(mayAutoplay({ ...easy, deviceMemory: undefined })).toBe(true);
  });
});
