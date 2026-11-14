import { describe, expect, it } from "vitest";
import { parsePeriod } from "../../../src/features/money/period.ts";
import {
  buildStatement,
  type StatementGame,
  type StatementInput,
} from "../../../src/features/money/statement.ts";

// A maker's statement for a month, worked out from what the month's pool paid them and what was taken off since. It reads
// as a sum: what stood before, plus what they earned, less what was sent, is what they are owed.

const NOVEMBER = parsePeriod("2026-11");
const ZEBRA: StatementGame = { slug: "zebra-run", name: "Zebra Run" };
const APPLE: StatementGame = { slug: "apple-pie", name: "Apple Pie" };

function input(changes: Partial<StatementInput> = {}): StatementInput {
  return {
    makerUserId: "maker-x",
    period: NOVEMBER,
    finalAt: "2026-12-10T06:00:00.000Z",
    shares: [],
    others: [],
    owed: 0n,
    ...changes,
  };
}

const play = (game: StatementGame, amount: bigint, seconds: number) =>
  ({ kind: "play", game, amount, seconds, members: null }) as const;

describe("buildStatement", () => {
  it("puts one line on a game, in the game's name, with its minutes rounded down", () => {
    const { document } = buildStatement(input({ shares: [play(APPLE, 419n, 119)], owed: 419n }));
    expect(document.lines).toEqual([
      { ref: "play:apple-pie", source: "play", amount: 419n, game: APPLE, minutes: 1 }, // 119 seconds read as 1 minute
    ]);
  });

  it("sorts two games by name", () => {
    const { document } = buildStatement(
      input({ shares: [play(ZEBRA, 100n, 600), play(APPLE, 200n, 600)], owed: 300n }),
    );
    expect(document.lines.map((line) => line.ref)).toEqual(["play:apple-pie", "play:zebra-run"]);
  });

  it("gives a maker with only a bonus one line", () => {
    const { document } = buildStatement(
      input({
        shares: [{ kind: "bringing", game: null, amount: 231n, seconds: null, members: 2 }],
        owed: 231n,
      }),
    );
    expect(document.lines).toEqual([{ ref: "bringing", source: "bringing", amount: 231n, members: 2 }]);
  });

  it("reads as a sum: from before, plus earned, less sent, is owed", () => {
    // Last month ended owing 4,000. This month: 1,000 earned and a 250-cent correction taking money off, nothing sent.
    const { document } = buildStatement(
      input({
        shares: [play(APPLE, 1000n, 600)],
        others: [{ kind: "correction", key: "fix:1", amount: -250n, note: "Corrected" }],
        owed: 4750n,
      }),
    );
    expect(document.totals).toEqual({ earned: 750n, sent: 0n, broughtForward: 4000n, owed: 4750n });
    const { earned, sent, broughtForward, owed } = document.totals;
    expect(broughtForward + earned + sent).toBe(owed);
  });

  it("the month after a payout: from before is last month's owed, the two payout lines take off what was owed, and the sum holds", () => {
    // Owed 4,120 at the end of October. On 15 November $41.20 was owed: 3,885 reached the bank and 235 was held back for
    // Stripe's charge. November earned 900 more, so the maker is owed 900.
    const { document } = buildStatement(
      input({
        shares: [play(APPLE, 900n, 1200)],
        others: [
          {
            kind: "transfer",
            key: "po-2611-0001",
            amount: -3885n,
            payoutId: "PO-2611-0001",
            sentOn: "2026-11-15",
          },
          { kind: "payout_cost", key: "po-2611-0001", amount: -235n, payoutId: "PO-2611-0001" },
        ],
        owed: 900n,
      }),
    );
    expect(document.lines.map((line) => [line.source, line.amount])).toEqual([
      ["play", 900n],
      ["transfer", -3885n],
      ["payout_cost", -235n],
    ]);
    expect(document.totals).toEqual({ earned: 900n, sent: -4120n, broughtForward: 4120n, owed: 900n });
  });

  it("puts corrections before payouts, and each payout's transfer before its cost, each by key", () => {
    const { document } = buildStatement(
      input({
        others: [
          { kind: "payout_cost", key: "b", amount: -1n, payoutId: "PO-B" },
          { kind: "transfer", key: "b", amount: -9n, payoutId: "PO-B", sentOn: "2026-11-16" },
          { kind: "transfer", key: "a", amount: -9n, payoutId: "PO-A", sentOn: "2026-11-15" },
          { kind: "correction", key: "z", amount: 5n, note: "Later" },
          { kind: "correction", key: "c", amount: 5n, note: "Earlier" },
        ],
        owed: 0n,
      }),
    );
    expect(document.lines.map((line) => line.ref)).toEqual([
      "correction:c",
      "correction:z",
      "transfer:a",
      "transfer:b",
      "payout_cost:b",
    ]);
  });

  it("gives the same bytes for the same input in another order", () => {
    const one = buildStatement(
      input({
        shares: [play(APPLE, 5n, 60), play(ZEBRA, 7n, 60)],
        others: [{ kind: "correction", key: "a", amount: 1n, note: "n" }],
        owed: 13n,
      }),
    );
    const other = buildStatement(
      input({
        shares: [play(ZEBRA, 7n, 60), play(APPLE, 5n, 60)],
        others: [{ kind: "correction", key: "a", amount: 1n, note: "n" }],
        owed: 13n,
      }),
    );
    expect(other.canonical).toBe(one.canonical);
    expect(other.hash).toBe(one.hash);
    expect(one.hash).toMatch(/^[0-9a-f]{64}$/);
    // Cents are written as text, never as a number.
    expect(one.canonical).toContain('"owed":"13"');
  });

  it("changes its hash when any cent changes", () => {
    const base = buildStatement(input({ shares: [play(APPLE, 5n, 60)], owed: 5n }));
    const changed = buildStatement(input({ shares: [play(APPLE, 6n, 60)], owed: 6n }));
    expect(changed.hash).not.toBe(base.hash);
  });

  it("refuses a play share with no game, a bringing share with members missing, and a payout line with no id", () => {
    expect(() =>
      buildStatement(
        input({ shares: [{ kind: "play", game: null, amount: 1n, seconds: 60, members: null }] }),
      ),
    ).toThrow(RangeError);
    expect(() =>
      buildStatement(
        input({ shares: [{ kind: "bringing", game: null, amount: 1n, seconds: null, members: null }] }),
      ),
    ).toThrow(RangeError);
    expect(() => buildStatement(input({ others: [{ kind: "transfer", key: "k", amount: -1n }] }))).toThrow(
      RangeError,
    );
  });
});
