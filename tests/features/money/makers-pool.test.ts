import { describe, expect, it } from "vitest";
import { allocateMakersPool, type MemberMonth } from "../../../src/features/money/makers-pool.ts";

// Every expected number below is worked out by hand. The pool is shared in billionths of a cent, then rounded once to
// whole cents by largest remainder, so the shares always add up to the pool.

const member: MemberMonth = {
  userId: "m",
  contribution: 463n,
  broughtBy: "b",
  plays: [
    { gameId: "g1", seconds: 3600 },
    { gameId: "g2", seconds: 1800 },
  ],
};

/** What a shared outcome hands out, in cents: games, bringers and what carries on. */
function handedOut(outcome: ReturnType<typeof allocateMakersPool>): bigint {
  if (outcome.kind === "carry") return outcome.amount;
  return (
    outcome.games.reduce((sum, game) => sum + game.amount, 0n) +
    outcome.bringers.reduce((sum, bringer) => sum + bringer.amount, 0n) +
    outcome.carry
  );
}

describe("allocateMakersPool", () => {
  it("gives the bringer half of the member's part, and play the rest", () => {
    // 463 cents: 231.5 to the bringer, 231.5 by play, two thirds to g1 and a third to g2.
    const outcome = allocateMakersPool(463n, [member]);
    expect(outcome).toMatchObject({
      kind: "shared",
      carry: 0n,
      bringers: [{ makerUserId: "b", members: 1, amount: 232n }],
      games: [
        { gameId: "g1", amount: 154n },
        { gameId: "g2", amount: 77n },
      ],
    }); // the odd cent goes to the largest remainder
    expect(handedOut(outcome)).toBe(463n);
  });

  it("shares the whole part by play when nobody brought the member", () => {
    const outcome = allocateMakersPool(463n, [{ ...member, broughtBy: null }]);
    expect(outcome).toMatchObject({
      bringers: [],
      games: [
        { gameId: "g1", amount: 309n },
        { gameId: "g2", amount: 154n },
      ],
    });
    expect(handedOut(outcome)).toBe(463n);
  });

  it("lets a member who played nothing follow everyone else's play, after their bonus", () => {
    const idle = { userId: "idle", contribution: 400n, broughtBy: "b", plays: [] };
    const played = {
      userId: "p",
      contribution: 400n,
      broughtBy: null,
      plays: [{ gameId: "g1", seconds: 60 }],
    };
    const outcome = allocateMakersPool(800n, [idle, played]);
    expect(outcome).toMatchObject({
      bringers: [{ makerUserId: "b", amount: 200n }],
      games: [{ gameId: "g1", amount: 600n }],
      carry: 0n,
    });
    expect(handedOut(outcome)).toBe(800n);
  });

  it("pays the bonus and carries the rest when nobody played", () => {
    // Review Focus 8
    const outcome = allocateMakersPool(463n, [{ ...member, plays: [] }]);
    expect(outcome).toMatchObject({
      kind: "shared",
      games: [],
      bringers: [{ makerUserId: "b", amount: 232n }],
      carry: 231n,
    });
    expect(handedOut(outcome)).toBe(463n);
    expect(allocateMakersPool(463n, [{ ...member, broughtBy: null, plays: [] }])).toEqual({
      kind: "carry",
      amount: 463n,
    });
  });

  it("shares carried money by play only, never as a bonus", () => {
    // Owner: "Only by play". The member's 463 gives 231.5 to the bringer and 231.5 to play; the 231 carried in all
    // goes to play: 462.5 to g1. Without the 231 carried in, the shares would be 232 and 231.
    const one = { ...member, plays: [{ gameId: "g1", seconds: 60 }] };
    const outcome = allocateMakersPool(694n, [one], 231n);
    expect(outcome).toMatchObject({
      bringers: [{ makerUserId: "b", amount: 232n }],
      games: [{ gameId: "g1", amount: 462n }],
      carry: 0n,
    });
    expect(handedOut(outcome)).toBe(694n);
    expect(allocateMakersPool(463n, [one])).toMatchObject({
      bringers: [{ amount: 232n }],
      games: [{ gameId: "g1", amount: 231n }],
    });
  });

  it("carries carried money on again when nobody played, with no bonus made of it", () => {
    expect(allocateMakersPool(231n, [], 231n)).toEqual({ kind: "carry", amount: 231n });
    const idle = { userId: "idle", contribution: 0n, broughtBy: "b", plays: [] };
    expect(allocateMakersPool(231n, [idle], 231n)).toEqual({ kind: "carry", amount: 231n });
  });

  it("shares the pool as it stands, so a refund lowers every share in proportion", () => {
    const outcome = allocateMakersPool(232n, [member]);
    expect(outcome).toMatchObject({
      bringers: [{ makerUserId: "b", amount: 116n }],
      games: [
        { gameId: "g1", amount: 77n },
        { gameId: "g2", amount: 39n },
      ],
    });
    expect(handedOut(outcome)).toBe(232n);
  });

  it("carries a pool of nothing or less, whole", () => {
    expect(allocateMakersPool(-50n, [member])).toEqual({ kind: "carry", amount: -50n });
    expect(allocateMakersPool(0n, [member])).toEqual({ kind: "carry", amount: 0n });
  });

  it("leaves out a member who put nothing into the month", () => {
    const unpaid = {
      userId: "free",
      contribution: 0n,
      broughtBy: "other",
      plays: [{ gameId: "g9", seconds: 9999 }],
    };
    expect(allocateMakersPool(463n, [member, unpaid])).toEqual(allocateMakersPool(463n, [member]));
  });

  it("counts every member a bringer brought", () => {
    const second = { ...member, userId: "n", plays: [{ gameId: "g1", seconds: 60 }] };
    expect(allocateMakersPool(926n, [member, second])).toMatchObject({
      bringers: [{ makerUserId: "b", members: 2, amount: 463n }],
    });
  });

  it("always shares out exactly the pool", () => {
    // A fixed sweep of pools and members, in place of random cases, so a failure replays exactly.
    const crowd: MemberMonth[] = [
      member,
      { userId: "n", contribution: 397n, broughtBy: "c", plays: [{ gameId: "g2", seconds: 100 }] },
      { userId: "o", contribution: 199n, broughtBy: null, plays: [{ gameId: "g3", seconds: 7 }] },
      { userId: "p", contribution: 463n, broughtBy: "b", plays: [] },
    ];
    for (const pool of [1n, 2n, 3n, 99n, 463n, 1000n, 1519n, 100_003n]) {
      for (const carriedIn of [0n, 1n, 77n]) {
        expect(handedOut(allocateMakersPool(pool, crowd, carriedIn))).toBe(pool);
        expect(handedOut(allocateMakersPool(pool, crowd.slice(1), carriedIn))).toBe(pool);
      }
    }
  });

  it("does not depend on the order members or plays arrive in", () => {
    const crowd: MemberMonth[] = [
      member,
      {
        userId: "n",
        contribution: 397n,
        broughtBy: "c",
        plays: [
          { gameId: "g2", seconds: 100 },
          { gameId: "g1", seconds: 5 },
        ],
      },
      { userId: "o", contribution: 199n, broughtBy: null, plays: [{ gameId: "g3", seconds: 7 }] },
    ];
    const shuffled = [...crowd].reverse().map((entry) => ({ ...entry, plays: [...entry.plays].reverse() }));
    expect(allocateMakersPool(1000n, shuffled)).toEqual(allocateMakersPool(1000n, crowd));
  });

  it("adds up a game listed twice", () => {
    const split = {
      ...member,
      plays: [
        { gameId: "g1", seconds: 30 },
        { gameId: "g1", seconds: 30 },
      ],
    };
    const whole = { ...member, plays: [{ gameId: "g1", seconds: 60 }] };
    expect(allocateMakersPool(463n, [split])).toEqual(allocateMakersPool(463n, [whole]));
  });

  it("lists games and bringers in id order, and keeps a share that rounds to nothing", () => {
    const outcome = allocateMakersPool(2n, [
      {
        userId: "x",
        contribution: 1000n,
        broughtBy: "z",
        plays: [
          { gameId: "g2", seconds: 1 },
          { gameId: "g1", seconds: 1_000_000 },
        ],
      },
    ]);
    expect(outcome.kind).toBe("shared");
    if (outcome.kind !== "shared") return;
    expect(outcome.games.map((game) => game.gameId)).toEqual(["g1", "g2"]);
    expect(outcome.games.map((game) => game.amount)).toEqual([1n, 0n]);
  });

  it("refuses a member twice, a negative contribution, and seconds that are not a whole number of zero or more", () => {
    expect(() => allocateMakersPool(463n, [member, member])).toThrow(RangeError);
    expect(() => allocateMakersPool(463n, [{ ...member, contribution: -1n }])).toThrow(RangeError);
    expect(() => allocateMakersPool(463n, [{ ...member, plays: [{ gameId: "g1", seconds: 1.5 }] }])).toThrow(
      RangeError,
    );
    expect(() => allocateMakersPool(463n, [{ ...member, plays: [{ gameId: "g1", seconds: -1 }] }])).toThrow(
      RangeError,
    );
    expect(() => allocateMakersPool(463n, [member], -1n)).toThrow(RangeError);
  });
});
