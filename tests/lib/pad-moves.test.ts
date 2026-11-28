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

  it("goes down a column of buttons, not to a tall video beside it whose middle is lower", () => {
    // A game's page: the video fills the left column; Play sits at the top of the right one, Share well below it.
    const video = box(0, 0, 350, 680);
    const play = box(360, 30, 320, 45);
    const share = box(360, 140, 95, 45);
    expect(nextBox(play, [video, share], "down")).toBe(1);
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

  // Check and send as measured in the browser (#409, review 1, R1): the Change buttons sit in rows a few pixels apart and
  // a few pixels off each other's column, and the name's button moves with the length of the game's name. As the
  // journey does, the walk starts where a first press lands (Send for review) and goes on only from what it reached.
  const b = (left: number, top: number, right: number, bottom: number): Box => ({ left, top, right, bottom });
  const computer = (shift: number): Record<string, Box> => ({
    ruken: b(40, 24, 116.3, 72),
    later: b(1119.9, 24, 1240, 72),
    send: b(40, 336.6, 223.5, 396.6),
    test: b(235.5, 336.6, 403.5, 396.6),
    upright: b(568, 98, 716.5, 362),
    changeUpright: b(646.5, 380, 694.5, 424),
    wide: b(732.5, 98, 1201.8, 362),
    changeWide: b(832.7, 380, 880.7, 424),
    name: b(900.8 + shift, 444, 948.8 + shift, 488),
    line: b(903, 508, 951, 552),
    files: b(733.1, 572, 781.1, 616),
    who: b(846.2, 572, 894.2, 616),
    other: b(1089.8, 572, 1137.8, 616),
    away: b(40, 660, 243.5, 704),
  });
  const tablet = (shift: number): Record<string, Box> => ({
    ruken: b(20, 20, 96.3, 68),
    later: b(669.9, 20, 790, 68),
    send: b(20, 1000, 399, 1060),
    test: b(407, 1000, 790, 1060),
    upright: b(20, 243.3, 188.8, 543.3),
    changeUpright: b(98.5, 561.4, 146.5, 605.4),
    wide: b(204.8, 243.3, 738.1, 543.3),
    changeWide: b(305, 561.4, 353, 605.4),
    name: b(357 + shift, 625.4, 405 + shift, 669.4),
    line: b(355, 689.4, 403, 733.4),
    files: b(185.1, 753.4, 233.1, 797.4),
    who: b(298.2, 753.4, 346.2, 797.4),
    other: b(541.8, 753.4, 589.8, 797.4),
    away: b(20, 924, 223.5, 968),
  });
  const go = (boxes: Record<string, Box>, from: string, way: Way): string | undefined => {
    const others = Object.keys(boxes).filter((name) => name !== from);
    return others[
      nextBox(
        boxes[from] ?? middle,
        others.map((name) => boxes[name] ?? middle),
        way,
      )
    ];
  };

  it.each([
    ["a computer", computer],
    ["a tablet", tablet],
  ] as const)(
    "reaches every Change button on Check and send on %s, whatever the name's length",
    (_, layout) => {
      for (const shift of [-30, -6, 0, 6, 30]) {
        const boxes = layout(shift);
        const reached = new Set(["send"]);
        const waiting = ["send"];
        while (waiting.length > 0) {
          const from = waiting.shift() ?? "";
          for (const way of ["up", "down", "left", "right"] as const) {
            const found = go(boxes, from, way);
            if (found !== undefined && !reached.has(found)) {
              reached.add(found);
              waiting.push(found);
            }
          }
        }
        expect(
          Object.keys(boxes).filter((name) => !reached.has(name)),
          `name's button moved ${String(shift)}px`,
        ).toEqual([]);
        // Right along the row of three goes to the next one in that row, not up to the name.
        expect(go(boxes, "who", "right")).toBe("other");
        // Down from the wide video's Change is the name's, just below, not who it's for further down the column.
        expect(go(boxes, "changeWide", "down")).toBe("name");
      }
    },
  );

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
