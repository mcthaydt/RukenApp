import { describe, expect, it } from "vitest";
import type { PoolOutcome } from "../../../src/features/money/makers-pool.ts";
import { parsePeriod } from "../../../src/features/money/period.ts";
import { postPoolCarry, postPoolShares } from "../../../src/features/money/pool-posting.ts";

const NOVEMBER = parsePeriod("2026-11");

type Shared = Extract<PoolOutcome, { kind: "shared" }>;

/** 463 cents shared the way the first makers-pool case shares them: 232 to the bringer, 154 and 77 to two games. */
const shared: Shared = {
  kind: "shared",
  games: [
    { gameId: "g1", weight: 154_333_333_333n, amount: 154n },
    { gameId: "g2", weight: 77_166_666_666n, amount: 77n },
  ],
  bringers: [{ makerUserId: "maker-b", weight: 231_500_000_000n, members: 1, amount: 232n }],
  carry: 0n,
};
const makerOf = new Map([
  ["g1", "maker-x"],
  ["g2", "maker-y"],
]);

function sum(lines: readonly { amount: bigint }[]): bigint {
  return lines.reduce((total, line) => total + line.amount, 0n);
}

describe("postPoolShares", () => {
  it("credits a game's share to its maker and names the game", () => {
    const entries = postPoolShares(NOVEMBER, shared, makerOf);
    expect(entries[0]).toEqual({
      key: "pool:2026-11:game:g1",
      kind: "pool_share",
      gameId: "g1",
      lines: [
        { account: "pool:premium:2026-11", amount: 154n },
        { account: "maker:maker-x:payable", amount: -154n, makerUserId: "maker-x" },
      ],
    });
  });

  it("makes one entry for each game, even for two games of one maker", () => {
    const sameMaker = new Map([
      ["g1", "maker-x"],
      ["g2", "maker-x"],
    ]);
    const entries = postPoolShares(NOVEMBER, shared, sameMaker).filter((entry) => entry.gameId !== null);
    expect(entries.map((entry) => entry.key)).toEqual(["pool:2026-11:game:g1", "pool:2026-11:game:g2"]);
  });

  it("pays a bringer out of the pool, with no game", () => {
    const entries = postPoolShares(NOVEMBER, shared, makerOf);
    expect(entries[2]).toEqual({
      key: "pool:2026-11:bring:maker-b",
      kind: "pool_share",
      gameId: null,
      lines: [
        { account: "pool:premium:2026-11", amount: 232n },
        { account: "maker:maker-b:payable", amount: -232n, makerUserId: "maker-b" },
      ],
    });
  });

  it("makes no entry for a share of nothing", () => {
    const entries = postPoolShares(
      NOVEMBER,
      { ...shared, games: [{ gameId: "g1", weight: 1n, amount: 0n }], bringers: [] },
      makerOf,
    );
    expect(entries).toEqual([]);
  });

  it("moves what carries on into the next month's pool, in the same run", () => {
    const entries = postPoolShares(NOVEMBER, { ...shared, games: [], bringers: [], carry: 231n }, makerOf);
    expect(entries).toEqual([
      {
        key: "carry:2026-11",
        kind: "pool_carry",
        gameId: null,
        lines: [
          { account: "pool:premium:2026-11", amount: 231n },
          { account: "pool:premium:2026-12", amount: -231n },
        ],
      },
    ]);
  });

  it("refuses a game whose maker is not given", () => {
    expect(() => postPoolShares(NOVEMBER, shared, new Map([["g1", "maker-x"]]))).toThrow(RangeError);
  });

  it("adds up to zero in every entry, and takes exactly what the outcome hands out from the pool", () => {
    const entries = postPoolShares(NOVEMBER, { ...shared, carry: 5n }, makerOf);
    for (const entry of entries) expect(sum(entry.lines)).toBe(0n);
    const fromPool = entries
      .flatMap((entry) => entry.lines)
      .filter((line) => line.account === "pool:premium:2026-11")
      .reduce((total, line) => total + line.amount, 0n);
    expect(fromPool).toBe(154n + 77n + 232n + 5n);
  });
});

describe("postPoolCarry", () => {
  it("moves a month's money into the next month's pool, across a year end too", () => {
    expect(postPoolCarry(parsePeriod("2026-12"), 463n)).toEqual([
      {
        key: "carry:2026-12",
        kind: "pool_carry",
        gameId: null,
        lines: [
          { account: "pool:premium:2026-12", amount: 463n },
          { account: "pool:premium:2027-01", amount: -463n },
        ],
      },
    ]);
  });

  it("carries a negative pool the same way, with the signs turned round", () => {
    const [entry] = postPoolCarry(NOVEMBER, -50n);
    expect(entry?.lines).toEqual([
      { account: "pool:premium:2026-11", amount: -50n },
      { account: "pool:premium:2026-12", amount: 50n },
    ]);
  });

  it("makes nothing for nothing", () => {
    expect(postPoolCarry(NOVEMBER, 0n)).toEqual([]);
  });
});
