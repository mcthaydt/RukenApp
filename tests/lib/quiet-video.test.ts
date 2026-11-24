import { describe, expect, it } from "vitest";
import { atEnd, loopByHand, mayAutoplay, restartAt, startOf } from "../../src/lib/quiet-video.ts";

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

/** A stand-in video: the events and the few fields the hand loop uses. */
function videoAt(address: string, currentTime: number, duration = 10) {
  const played: number[] = [];
  const video = Object.assign(new EventTarget(), {
    loop: true,
    ended: false,
    duration,
    currentTime,
    currentSrc: "",
    getAttribute: (name: string) => (name === "src" ? address : null),
    play: () => {
      played.push(video.currentTime);
      return Promise.resolve();
    },
  });
  return { video, played };
}

describe("loopByHand", () => {
  it("never asks the browser to loop", () => {
    const { video } = videoAt("/clip.mp4#t=0.001", 0);
    loopByHand(video as unknown as HTMLVideoElement);
    expect(video.loop).toBe(false);
  });

  it("goes back to the start the address names and plays again when the video ends", () => {
    const { video, played } = videoAt("/clip.mp4#t=2", 9.5);
    loopByHand(video as unknown as HTMLVideoElement);
    video.ended = true;
    video.dispatchEvent(new Event("ended"));
    expect(video.currentTime).toBe(2);
    expect(played).toEqual([2]);
  });

  it("plays again when it reaches its end without the browser saying it ended", () => {
    // Safari's engine on Linux sometimes stops at the last frame, still "playing", sends `stalled` and never `ended`.
    const { video, played } = videoAt("/clip.mp4#t=0.001", 1.999999999, 2);
    loopByHand(video as unknown as HTMLVideoElement);
    video.dispatchEvent(new Event("timeupdate"));
    expect(played).toEqual([0.001]);
    // The `ended` that may still follow does not send it back a second time.
    video.dispatchEvent(new Event("ended"));
    expect(played).toEqual([0.001]);
  });

  it("leaves a video alone while it plays on before its end", () => {
    const { video, played } = videoAt("/clip.mp4", 1.5, 2);
    loopByHand(video as unknown as HTMLVideoElement);
    video.dispatchEvent(new Event("timeupdate"));
    video.dispatchEvent(new Event("stalled"));
    expect(played).toEqual([]);
  });

  it("goes back to the beginning where the start the address names is past the end", () => {
    const { video, played } = videoAt("/clip.mp4#t=4", 2, 2);
    loopByHand(video as unknown as HTMLVideoElement);
    video.dispatchEvent(new Event("timeupdate"));
    expect(played).toEqual([0]);
  });

  it("goes back to 0 for an address with no start time", () => {
    const { video, played } = videoAt("/clip.mp4", 10);
    loopByHand(video as unknown as HTMLVideoElement);
    video.dispatchEvent(new Event("ended"));
    expect(played).toEqual([0]);
  });

  it("stops looping once the video is taken away", () => {
    const { video, played } = videoAt("/clip.mp4", 10);
    loopByHand(video as unknown as HTMLVideoElement).destroy();
    video.dispatchEvent(new Event("ended"));
    expect(played).toEqual([]);
  });
});

describe("atEnd", () => {
  it("is true at the end, and within a hundredth of a second of it", () => {
    expect(atEnd(2, 2)).toBe(true);
    expect(atEnd(1.999999999, 2)).toBe(true);
    expect(atEnd(1.995, 2)).toBe(true);
  });

  it("is false before the end, or where the length is not known yet", () => {
    expect(atEnd(1.9, 2)).toBe(false);
    expect(atEnd(0, Number.NaN)).toBe(false);
    expect(atEnd(5, Number.POSITIVE_INFINITY)).toBe(false);
    expect(atEnd(0, 0)).toBe(false);
  });
});

describe("restartAt", () => {
  it("starts again at the start the address names", () => {
    expect(restartAt(2, 10)).toBe(2);
    expect(restartAt(0.001, 2)).toBe(0.001);
  });

  it("starts again at the very beginning where that start is at or past the end", () => {
    // The landing wall gives each clip a later start (`#t=2`, `#t=4`); a two-second clip would end where it starts.
    expect(restartAt(2, 2)).toBe(0);
    expect(restartAt(4, 2)).toBe(0);
  });
});
