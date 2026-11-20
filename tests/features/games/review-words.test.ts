import { describe, expect, it } from "vitest";
import {
  acceptSays,
  failureStatus,
  listSays,
  sendBackSays,
} from "../../../src/features/games/review-words.ts";
import { dayWords } from "../../../src/features/games/seats.ts";

describe("what the review command says", () => {
  const week = { words: "Friday 27 November", seats: 10, taken: 7 };

  it("opens the list with what waits and, while decision day is on, the week's seats", () => {
    expect(listSays(3, week)).toBe("3 games are waiting. 7 of 10 seats are taken for Friday 27 November.");
    expect(listSays(1, week)).toBe("1 game is waiting. 7 of 10 seats are taken for Friday 27 November.");
    expect(listSays(0, null)).toBe("Nothing is waiting.");
    expect(listSays(2, null)).toBe("2 games are waiting.");
  });

  it("says a held yes with its day and seats, and a yes at once as it always did", () => {
    const held = { held: true, day: "2026-11-27", seats: 10, taken: 8 } as const;
    expect(acceptSays("Floor Fifty", "game", held, dayWords)).toBe(
      "Floor Fifty gets in on Friday 27 November. 8 of 10 seats are taken.",
    );
    expect(acceptSays("Floor Fifty", "game", { held: false }, dayWords)).toBe("Floor Fifty is live.");
    expect(acceptSays("Floor Fifty", "back", { held: false }, dayWords)).toBe("Floor Fifty is live.");
    expect(acceptSays("Floor Fifty", "update", { held: false }, dayWords)).toBe(
      "Floor Fifty's new version is live.",
    );
  });

  it("says a held send back with its day, and one at once as it always did", () => {
    const held = { held: true, day: "2026-11-27", seats: 10, taken: 7 } as const;
    expect(sendBackSays("Floor Fifty", held, dayWords)).toBe(
      "Floor Fifty goes back to its maker on Friday 27 November.",
    );
    expect(sendBackSays("Floor Fifty", { held: false }, dayWords)).toBe(
      "Floor Fifty went back to its maker.",
    );
  });

  it("answers a clash 409 and any other refusal 400", () => {
    expect(failureStatus("CONFLICT")).toBe(409);
    expect(failureStatus("INVALID")).toBe(400);
    expect(failureStatus("NOT_READY")).toBe(400);
  });
});
