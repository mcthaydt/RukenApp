import { describe, expect, it } from "vitest";
import { feedOrder, NEW_GAME_DAYS, type Orderable } from "../../../src/features/feed/order.ts";

const DAY = 86_400_000;
const NOW = Date.parse("2026-11-21T12:00:00Z");

/** A game that went live `daysAgo` days before now and has been played for `beats` beats. */
function game(id: string, daysAgo: number, beats = 0): Orderable {
  return { id, liveSince: new Date(NOW - daysAgo * DAY), beats };
}

const idsOf = (games: Orderable[]) => games.map((one) => one.id);

describe("feedOrder", () => {
  it("puts games under seven days old first, newest first, then the rest, most played first", () => {
    const ordered = feedOrder(
      [
        game("old-quiet", 30, 1),
        game("new-older", 5),
        game("old-busy", 20, 90),
        game("new-newest", 1),
        game("mid", 8, 40),
      ],
      NOW,
      "seed",
    );

    expect(idsOf(ordered)).toEqual(["new-newest", "new-older", "old-busy", "mid", "old-quiet"]);
  });

  it("stops calling a game new at exactly seven days", () => {
    expect(NEW_GAME_DAYS).toBe(7);
    const justUnder = { id: "under", liveSince: new Date(NOW - 7 * DAY + 1), beats: 0 };
    const exactly = { id: "exactly", liveSince: new Date(NOW - 7 * DAY), beats: 5 };

    expect(idsOf(feedOrder([exactly, justUnder], NOW, "seed"))).toEqual(["under", "exactly"]);
  });

  it("gives the same order whatever order the games came in", () => {
    const tied = ["a", "b", "c", "d", "e", "f"].map((id) => game(id, 20, 10));
    const reversed = [...tied].reverse();
    const shuffled = [3, 0, 5, 1, 4, 2].flatMap((place) => tied.slice(place, place + 1));
    const expected = idsOf(feedOrder(tied, NOW, "2026-11-21"));

    expect(idsOf(feedOrder(reversed, NOW, "2026-11-21"))).toEqual(expected);
    expect(idsOf(feedOrder(shuffled, NOW, "2026-11-21"))).toEqual(expected);
  });

  it("lets tied games change places from one day's seed to the next", () => {
    const tied = ["a", "b", "c", "d", "e", "f"].map((id) => game(id, 20, 10));
    const orders = new Set<string>();
    for (let day = 1; day <= 10; day += 1) {
      orders.add(idsOf(feedOrder(tied, NOW, `2026-11-${String(day).padStart(2, "0")}`)).join());
    }

    expect(orders.size).toBeGreaterThan(1);
  });

  it("breaks a tie the seed cannot by the id, and does not change what it was given", () => {
    const input = [game("b", 20, 10), game("a", 20, 10)];
    const copy = [...input];
    const ordered = feedOrder(input, NOW, "seed");

    expect(input).toEqual(copy);
    expect(ordered).toHaveLength(2);
    // The same two ids always come out in one order for one seed, even with equal hashes of nothing else to go on.
    expect(idsOf(feedOrder([...input].reverse(), NOW, "seed"))).toEqual(idsOf(ordered));
  });

  it("is an empty order for no games", () => {
    expect(feedOrder([], NOW, "seed")).toEqual([]);
  });
});
