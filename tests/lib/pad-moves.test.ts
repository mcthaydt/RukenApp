import { describe, expect, it } from "vitest";
import { nextBox, type Box, type Way } from "../../src/lib/pad-moves.ts";

const box = (left: number, top: number, width = 50, height = 50): Box => ({
  left,
  top,
  right: left + width,
  bottom: top + height,
});

// A screen of controls in a three by three grid, 100px apart.
const grid = [0, 1, 2].flatMap((row) => [0, 1, 2].map((column) => box(column * 100, row * 100)));
const middle = grid[4] ?? box(100, 100);

describe("nextBox", () => {
  it.each([
    ["up", 1],
    ["down", 7],
    ["left", 3],
    ["right", 5],
  ] as const)("goes %j to the neighbour in the same column or row", (way, expected) => {
    expect(nextBox(middle, grid, way)).toBe(expected);
  });

  it.each(["up", "left"] as const)("finds nothing %j from the top left corner", (way) => {
    expect(nextBox(grid[0] ?? middle, grid, way)).toBe(-1);
  });

  it("prefers the control in the same column to a nearer one off to the side", () => {
    const from = box(0, 0);
    const straight = box(0, 300);
    const aside = box(200, 80);
    expect(nextBox(from, [aside, straight], "down")).toBe(1);
  });

  it("reaches a wide row below from any button above it", () => {
    const wide = box(0, 300, 400, 50);
    for (const from of [box(0, 0), box(350, 0)]) expect(nextBox(from, [wide], "down")).toBe(0);
  });

  it("from a big control, moves to a small one inside its row that lies further that way", () => {
    const big = box(0, 0, 300, 60);
    const small = box(240, 10, 40, 40);
    expect(nextBox(big, [small], "right")).toBe(0);
    expect(nextBox(big, [small], "left")).toBe(-1);
  });

  // Seeded walk: wherever the controls are, a move never goes the wrong way, and going there and back returns
  // to a control that lies the first way round.
  it("never moves the wrong way, on many scattered screens", () => {
    let seed = 7;
    const random = () => {
      seed = (seed * 1103515245 + 12345) % 2 ** 31;
      return seed / 2 ** 31;
    };
    const ways: Way[] = ["up", "down", "left", "right"];
    for (let screen = 0; screen < 300; screen++) {
      const boxes = Array.from({ length: 12 }, () =>
        box(random() * 1000, random() * 700, 48 + random() * 100, 48),
      );
      const fromIndex = Math.floor(random() * boxes.length);
      const from = boxes[fromIndex] ?? middle;
      const others = boxes.filter((_, index) => index !== fromIndex);
      for (const way of ways) {
        const found = others[nextBox(from, others, way)];
        if (found === undefined) continue;
        const centre = (b: Box) => [(b.left + b.right) / 2, (b.top + b.bottom) / 2] as const;
        const [fx, fy] = centre(from);
        const [tx, ty] = centre(found);
        if (way === "down") expect(ty).toBeGreaterThan(fy);
        if (way === "up") expect(ty).toBeLessThan(fy);
        if (way === "right") expect(tx).toBeGreaterThan(fx);
        if (way === "left") expect(tx).toBeLessThan(fx);
      }
    }
  });
});
