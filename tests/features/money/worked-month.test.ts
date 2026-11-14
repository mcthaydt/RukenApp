// One whole month, worked out by hand, to prove the rules fit together. Every expected number below was worked out
// with a pencil, never by the code under test. Redo them in the order the test posts them.
//
// THE MEMBERS (November 2026; every amount in cents)
//
//   A, monthly: paid 1081 (the stand-in Stripe's $9.99 plus 82 of tax), Stripe's card fee 61, later fees 12.
//       Left after tax and the card fee 1081 - 82 - 61 = 938, makers' half 469. The later 12 leaves 926, makers' half
//       463, so the later fee takes 6 from makers and 6 from Ruken. Brought by maker X. Played game 1 (X's) for 2
//       hours (7200 s) and game 2 (Y's) for 1 hour (3600 s).
//   B, yearly: paid 10717 (tax 817), card fee 341, later fees 46. First of its twelve months. Left 10717 - 817 - 341 =
//       9559, makers' half 4779 (9559 / 2, rounded down), 399 for each of the first three months and 398 for the
//       other nine. The later 46 leaves 9513, makers' half 4756, 397 for the first four months and 396 for the other
//       eight, so the later fee takes 23 from makers (2 from each of the first three months and from March to
//       October, 1 from February) and 23 from Ruken. In November B's part is 397; the other eleven wait in
//       premium:deferred, 4756 - 397 = 4359. Nobody brought B. Played game 2 for 30 minutes (1800 s).
//   C, monthly: the same amounts as A, so a part of 463. Brought themselves, so no bonus. Played nothing.
//
// NOVEMBER'S POOL: 463 + 397 + 463 = 1323.
//
// SHARING IT (weights in billionths of a cent, scale 1,000,000,000)
//
//   A: whole 463e9; bonus to X half of it, 231.5e9; play part 231.5e9, two thirds to game 1 (154,333,333,333) and a
//      third to game 2 (77,166,666,666).
//   B: whole 397e9, all to game 2.
//   C: whole 463e9, nobody brought them, nothing played: it follows everyone else's play. All players' seconds: game 1
//      7200, game 2 3600 + 1800 = 5400, 12600 in all. Game 1 gets 463e9 x 7200 / 12600 = 264,571,428,571 and game 2
//      463e9 x 5400 / 12600 = 198,428,571,428.
//   Weights: game 1 418,904,761,904; game 2 77,166,666,666 + 397e9 + 198,428,571,428 = 672,595,238,094; X's bonus
//   231,500,000,000. In cents of 1323: 418.9 / 672.6 / 231.5, so 418 + 672 + 231 = 1321 and two cents are left; the two
//   largest remainders (.90 and .60) take them: game 1 419, game 2 673, X's bonus 231.
//   X is owed 231 + 419 = 650 (the bonus and game 1); Y is owed 673 (game 2).
//
// THE JOURNAL, BEFORE SHARING
//
//   clearing  1081 - 61 - 12 = 1008 (A), 10717 - 341 - 46 = 10330 (B), 1008 (C)                          12346
//   fees      the card fees: 61 + 341 + 61                                                                  463
//   tax       82 + 817 + 82                                                                                -981
//   pool      463 + 397 + 463                                                                             -1323
//   deferred  4359 (B's other eleven months)                                                              -4359
//   revenue   worked out below                                                                    -6146
//
//   Revenue is gross - tax - makers' half, less what later fees took from Ruken's half: A 1081 - 82 - 469 = 530, less
//   6 = 524; C the same, 524; B 10717 - 817 - 4779 = 5121, less 23 = 5098. In all 524 + 5098 + 524 = 6146.
//
// RUKEN'S HALF is paid - tax - every fee - the makers' half, which in the journal is revenue less fees:
//   6146 - 463 = 5683. THE MAKERS' HALF is 1323 + 4359 = 5682. Ruken's half is the larger by the odd cent of B's
//   9513 (4756 to makers, 4757 to Ruken).
//
// THEN A IS REFUNDED, in full, before the pool is shared. A's lines: card fee 61, tax -82, pool -463, revenue -524.
//   Every side gives back what it got: fees -61, tax +82, pool +463, revenue +524; Stripe's cash goes out 1081. What
//   Stripe keeps is the card fee and the later fee, 73, shared 37 to makers (36.5 rounded up) and 36 to Ruken.
//   Pool 1323 - 463 - 37 = 823. Fees 463 - 61 + 36 = 438. Tax -981 + 82 = -899. Revenue -6146 + 524 = -5622. Clearing
//   12346 - 1081 = 11265.
//   The pool is shared again from 823, with the same weights. Exact shares: game 1 260.59, game 2 418.40, X's bonus
//   144.01. The floors 260 + 418 + 144 = 822 leave one cent, and the largest remainder (.59, game 1) takes it: game 1
//   261, game 2 418, X's bonus 144. X is owed 144 + 261 = 405; Y 418.
//   Ruken's half 5622 - 438 = 5184; the makers' half 823 + 4359 = 5182.

import { describe, expect, it } from "vitest";
import { bringerOf, type Join } from "../../../src/features/money/bringing.ts";
import { allocateMakersPool, type MemberMonth } from "../../../src/features/money/makers-pool.ts";
import { feeParts, postPaymentFee, postPaymentPaid } from "../../../src/features/money/payment-posting.ts";
import { parsePeriod } from "../../../src/features/money/period.ts";
import { postPoolShares } from "../../../src/features/money/pool-posting.ts";
import type { Payment } from "../../../src/features/money/pool-share.ts";
import type { PostingLine } from "../../../src/features/money/posting.ts";
import { postRefund } from "../../../src/features/money/reversal-posting.ts";

const NOVEMBER = parsePeriod("2026-11");
const POOL = "pool:premium:2026-11";
const DEFERRED = "premium:deferred";

const paymentA: Payment = { plan: "monthly", firstPeriod: NOVEMBER, gross: 1081n, tax: 82n, fees: 61n };
const paymentB: Payment = { plan: "annual", firstPeriod: NOVEMBER, gross: 10717n, tax: 817n, fees: 341n };
const paymentC: Payment = { ...paymentA };

/** Account balances, kept as the journal would: every entry must add up to zero before it is taken. */
function newBooks() {
  const balances = new Map<string, bigint>();
  const entries: PostingLine[][] = [];
  return {
    entries,
    post(lines: readonly PostingLine[]) {
      expect(lines.reduce((sum, line) => sum + line.amount, 0n)).toBe(0n);
      entries.push([...lines]);
      for (const line of lines) balances.set(line.account, (balances.get(line.account) ?? 0n) + line.amount);
    },
    of(account: string): bigint {
      return balances.get(account) ?? 0n;
    },
    total(): bigint {
      return [...balances.values()].reduce((sum, amount) => sum + amount, 0n);
    },
    payables(): bigint {
      return [...balances]
        .filter(([account]) => account.endsWith(":payable"))
        .reduce((sum, [, amount]) => sum + amount, 0n);
    },
  };
}
type Books = ReturnType<typeof newBooks>;

/** Posts the three payments and each one's later fee into the books. Returns A's lines, for the refund. */
function postPaymentsAndLaterFees(books: Books): PostingLine[] {
  const aLines = postPaymentPaid(paymentA);
  books.post(aLines);
  const aFee = postPaymentFee(feeParts(paymentA, 12n), (period) => `pool:premium:${period}`);
  books.post(aFee);

  books.post(postPaymentPaid(paymentB));
  // B's later fee takes from the months it belongs to: November's pool now, the other eleven from what is deferred.
  books.post(postPaymentFee(feeParts(paymentB, 46n), (period) => (period === NOVEMBER ? POOL : DEFERRED)));

  books.post(postPaymentPaid(paymentC));
  books.post(postPaymentFee(feeParts(paymentC, 12n), (period) => `pool:premium:${period}`));
  return [...aLines, ...aFee];
}

/** The three members as the pool reads them, with who brought each worked out by the bringing rule. */
function membersOfNovember(): MemberMonth[] {
  const joinedOn = Date.parse("2026-11-10T18:00:00Z");
  const joins = (userId: string, broughtByUserId: string | null): Join[] => [
    { userId, startedAtMs: joinedOn, broughtByUserId },
  ];
  return [
    {
      userId: "member-a",
      contribution: 463n,
      broughtBy: bringerOf(joins("member-a", "maker-x"), NOVEMBER),
      plays: [
        { gameId: "game-1", seconds: 7200 },
        { gameId: "game-2", seconds: 3600 },
      ],
    },
    {
      userId: "member-b",
      contribution: 397n,
      broughtBy: bringerOf(joins("member-b", null), NOVEMBER),
      plays: [{ gameId: "game-2", seconds: 1800 }],
    },
    {
      userId: "member-c",
      contribution: 463n,
      broughtBy: bringerOf(joins("member-c", "member-c"), NOVEMBER), // brought themselves: no bonus
      plays: [],
    },
  ];
}

/** Shares what the pool holds, as the month's close does, and posts the entries. */
function shareThePool(books: Books) {
  const pool = -books.of(POOL);
  const outcome = allocateMakersPool(pool, membersOfNovember());
  if (outcome.kind !== "shared") throw new Error("this month's pool is always shared");
  const makerOf = new Map([
    ["game-1", "maker-x"],
    ["game-2", "maker-y"],
  ]);
  for (const entry of postPoolShares(NOVEMBER, outcome, makerOf)) books.post(entry.lines);
  return { pool, outcome };
}

/** Ruken's half as the admin screen defines it: revenue less the fees Ruken carries alone. */
function rukensHalf(books: Books): bigint {
  return -books.of("platform:revenue:premium") - books.of("platform:processor_fees");
}

/** The makers' half: what is in the month's pool, what waits in deferred, and what makers are already owed. */
function makersHalf(books: Books): bigint {
  return -books.of(POOL) - books.of(DEFERRED) - books.payables();
}

describe("one whole month, worked through", () => {
  it("shares November's pool to the cent and keeps Ruken's half whole", () => {
    const books = newBooks();
    postPaymentsAndLaterFees(books);

    // What the payments left in each account before the pool is shared.
    expect(books.of("platform:stripe_clearing")).toBe(12_346n);
    expect(books.of("platform:processor_fees")).toBe(463n);
    expect(books.of("platform:tax_payable")).toBe(-981n);
    expect(books.of(POOL)).toBe(-1_323n);
    expect(books.of(DEFERRED)).toBe(-4_359n); // B's other eleven months
    expect(books.of("platform:revenue:premium")).toBe(-6_146n);
    expect(books.total()).toBe(0n);
    expect(rukensHalf(books)).toBe(5_683n);
    expect(makersHalf(books)).toBe(5_682n);

    const { pool, outcome } = shareThePool(books);
    expect(pool).toBe(1_323n);
    expect(outcome.bringers).toMatchObject([{ makerUserId: "maker-x", members: 1, amount: 231n }]); // X's bonus
    expect(outcome.games).toMatchObject([
      { gameId: "game-1", amount: 419n },
      { gameId: "game-2", amount: 673n },
    ]);
    expect(outcome.carry).toBe(0n);

    // What X and Y are owed, and the pool is empty: the makers' accounts hold exactly what left it.
    expect(books.of("maker:maker-x:payable")).toBe(-650n); // 231 + 419
    expect(books.of("maker:maker-y:payable")).toBe(-673n);
    expect(books.of(POOL)).toBe(0n);
    expect(-books.of("maker:maker-x:payable") - books.of("maker:maker-y:payable")).toBe(pool);

    // Nothing moved from Ruken's revenue to a maker, and Ruken's half is not the smaller one.
    expect(books.of("platform:revenue:premium")).toBe(-6_146n);
    expect(rukensHalf(books)).toBe(5_683n);
    expect(makersHalf(books)).toBe(5_682n);
    expect(rukensHalf(books) >= makersHalf(books)).toBe(true);
    expect(books.of("platform:tax_payable")).toBe(-981n);
    expect(books.of(DEFERRED)).toBe(-4_359n);
    expect(books.total()).toBe(0n);
  });

  it("shares the same month again from the lower pool when A's payment is refunded first", () => {
    const books = newBooks();
    const aLines = postPaymentsAndLaterFees(books);

    // A is refunded in full before the pool is shared.
    books.post(
      postRefund({
        paymentLines: aLines,
        paymentGross: 1_081n,
        amount: 1_081n,
        feeReturned: 0n,
        deferredLeft: 0n,
        openPool: NOVEMBER,
      }),
    );
    expect(books.of("platform:stripe_clearing")).toBe(11_265n);
    expect(books.of("platform:processor_fees")).toBe(438n);
    expect(books.of("platform:tax_payable")).toBe(-899n);
    expect(books.of(POOL)).toBe(-823n); // 1323 - 463 - 37
    expect(books.of("platform:revenue:premium")).toBe(-5_622n);
    expect(books.total()).toBe(0n);

    const { pool, outcome } = shareThePool(books);
    expect(pool).toBe(823n);
    expect(outcome.bringers).toMatchObject([{ makerUserId: "maker-x", amount: 144n }]);
    expect(outcome.games).toMatchObject([
      { gameId: "game-1", amount: 261n },
      { gameId: "game-2", amount: 418n },
    ]);
    expect(books.of("maker:maker-x:payable")).toBe(-405n); // 144 + 261
    expect(books.of("maker:maker-y:payable")).toBe(-418n);
    expect(books.of(POOL)).toBe(0n);

    // The same checks hold: no side gave more than it had, and Ruken's half is not the smaller one.
    expect(rukensHalf(books)).toBe(5_184n);
    expect(makersHalf(books)).toBe(5_182n);
    expect(rukensHalf(books) >= makersHalf(books)).toBe(true);
    expect(-books.of("maker:maker-x:payable") - books.of("maker:maker-y:payable")).toBe(pool);
    expect(books.of(DEFERRED)).toBe(-4_359n);
    expect(books.total()).toBe(0n);
  });
});
