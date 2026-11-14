import { describe, expect, it } from "vitest";
import { cropSquare, PHOTO_SIDE } from "../../../src/features/pages/photo-crop.ts";

describe("PHOTO_SIDE", () => {
  it("is 512 pixels", () => {
    expect(PHOTO_SIDE).toBe(512);
  });
});

describe("cropSquare", () => {
  it("keeps the middle of a wide picture", () => {
    expect(cropSquare(4000, 3000)).toEqual({ x: 500, y: 0, side: 3000 });
  });

  it("keeps the middle of a tall picture", () => {
    expect(cropSquare(300, 900)).toEqual({ x: 0, y: 300, side: 300 });
  });

  it("keeps a square picture whole", () => {
    expect(cropSquare(640, 640)).toEqual({ x: 0, y: 0, side: 640 });
  });

  // A whole pixel only: a canvas draws a fraction of a pixel as a blurred edge.
  it("starts on a whole pixel when the leftover is odd", () => {
    expect(cropSquare(11, 4)).toEqual({ x: 3, y: 0, side: 4 });
    expect(cropSquare(4, 11)).toEqual({ x: 0, y: 3, side: 4 });
  });
});
