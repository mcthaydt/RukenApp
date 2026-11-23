import { describe, expect, it } from "vitest";
import { clipStep } from "../../src/lib/on-screen-video.ts";

// A clip on the landing page plays only while a person can see it, so a page of clips never plays or fetches the
// ones off screen; where nothing may move by itself, it stays still.

describe("clipStep", () => {
  it("plays a clip that comes on screen", () => {
    expect(clipStep(true, true)).toBe("play");
  });

  it("pauses a clip that goes off screen", () => {
    expect(clipStep(false, true)).toBe("pause");
  });

  it("keeps a clip still, on or off screen, where nothing may move by itself", () => {
    expect(clipStep(true, false)).toBe("still");
    expect(clipStep(false, false)).toBe("still");
  });
});
