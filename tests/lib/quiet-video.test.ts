import { describe, expect, it } from "vitest";
import { mayAutoplay, mayLoop, startOf } from "../../src/lib/quiet-video.ts";

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

// A looping video whose address names a start time stalls in Safari's engine, so it loops only once past that start.

describe("startOf", () => {
  it("reads the start time an address names", () => {
    expect(startOf("https://ruken.dev/clips/upright-0123456789abcdef.mp4#t=0.001")).toBe(0.001);
    expect(startOf("/clips/upright.mp4#t=6")).toBe(6);
  });

  it("is 0 for an address with no start time, or one it cannot read", () => {
    expect(startOf("/clips/upright.mp4")).toBe(0);
    expect(startOf("")).toBe(0);
    expect(startOf("/clips/upright.mp4#t=.")).toBe(0);
  });
});

describe("mayLoop", () => {
  it("does not loop at the start, or at a start time the address names", () => {
    expect(mayLoop(0, 0.001)).toBe(false);
    expect(mayLoop(0.001, 0.001)).toBe(false);
    expect(mayLoop(2, 2)).toBe(false);
    // Rewound to 0 under a later start: still not past it.
    expect(mayLoop(0, 2)).toBe(false);
  });

  it("loops once the video has played on past its start", () => {
    expect(mayLoop(0.2, 0.001)).toBe(true);
    expect(mayLoop(1.9, 0.001)).toBe(true);
    expect(mayLoop(2.2, 2)).toBe(true);
  });
});
