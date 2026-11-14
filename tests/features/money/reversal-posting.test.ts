import { describe, expect, it } from "vitest";
import {
  feeParts,
  postPaymentFee,
  postPaymentPaid,
  releases,
} from "../../../src/features/money/payment-posting.ts";
import { parsePeriod, type Period } from "../../../src/features/money/period.ts";
import type { PostingLine } from "../../../src/features/money/posting.ts";
import {
  cancelledMonths,
  postChargebackOpened,
  postChargebackWon,
  postRefund,
  reverseOpenedEntry,
  reversePaymentLines,
} from "../../../src/features/money/reversal-posting.ts";

// A refund or a chargeback undoes a payment. The months of a yearly fee not yet released are cancelled first, latest
// first, and the rest of the pool's share comes out of the pool month that is open now. What Stripe keeps (the fees,
// and the dispute fee, less any fee returned) is shared half and half: the makers' half, rounded up, out of the open
// pool month, and Ruken's half as a processor fee. A won dispute reverses all of it.

const NOVEMBER = parsePeriod("2026-11");
const DECEMBER = parsePeriod("2026-12");
const JANUARY = parsePeriod("2027-01");
const FEBRUARY = parsePeriod("2027-02");

function sum(lines: readonly PostingLine[]): bigint {
  return lines.reduce((total, line) => total + line.amount, 0n);
}

/** What one account comes to over several entries (debits positive). */
function net(account: string, ...entries: readonly (readonly PostingLine[])[]): bigint {
  return entries.flat().reduce((total, line) => (line.account === account ? total + line.amount : total), 0n);
}

// $7.99 with no tax and a 53-cent fee: 373 cents went into its month.
const monthly = { plan: "monthly", firstPeriod: NOVEMBER, gross: 799n, tax: 0n, fees: 53n } as const;
const monthlyLines = postPaymentPaid(monthly);

// $85.52 with $6.52 tax and a $2.67 fee: 3816 to makers, 318 into November and 318 a month after. December, January
// and February have been released (954), so 2544 still waits.
const annual = { plan: "annual", firstPeriod: NOVEMBER, gross: 8552n, tax: 652n, fees: 267n } as const;
const annualLines = postPaymentPaid(annual);

// The stand-in Stripe's payment: $9.99 with 82 cents tax and a 61-cent fee.
const paid = { plan: "monthly", firstPeriod: NOVEMBER, gross: 1081n, tax: 82n, fees: 61n } as const;
const paidLines = postPaymentPaid(paid);

describe("postChargebackOpened", () => {
  it("undoes a monthly payment from the open pool month and shares the $15.53 Stripe keeps half and half", () => {
    expect(
      postChargebackOpened({
        paymentLines: monthlyLines,
        paymentGross: 799n,
        amount: 799n,
        disputeFee: 1500n,
        feeReturned: 0n,
        deferredLeft: 0n,
        openPool: NOVEMBER,
      }),
    ).toEqual([
      { account: "platform:stripe_clearing", amount: -2299n },
      { account: "platform:processor_fees", amount: -53n },
      { account: "pool:premium:2026-11", amount: 373n },
      { account: "platform:revenue:premium", amount: 426n },
      // The makers' half of 1553, rounded up, and Ruken's half.
      { account: "pool:premium:2026-11", amount: 777n },
      { account: "platform:processor_fees", amount: 776n },
    ]);
  });

  it("cancels the months still deferred first and takes the rest out of the open pool month", () => {
    expect(
      postChargebackOpened({
        paymentLines: annualLines,
        paymentGross: 8552n,
        amount: 8552n,
        disputeFee: 1500n,
        feeReturned: 0n,
        deferredLeft: 2544n,
        openPool: FEBRUARY,
      }),
    ).toEqual([
      { account: "platform:stripe_clearing", amount: -10052n },
      { account: "platform:processor_fees", amount: -267n },
      { account: "platform:tax_payable", amount: 652n },
      { account: "premium:deferred", amount: 2544n },
      // 318 + 954 already reached pools; February's pool gives it back.
      { account: "pool:premium:2027-02", amount: 1272n },
      { account: "platform:revenue:premium", amount: 4084n },
      { account: "pool:premium:2027-02", amount: 884n },
      { account: "platform:processor_fees", amount: 883n },
    ]);
  });

  it("scales a partial dispute: half the payment, with nothing released yet", () => {
    expect(
      postChargebackOpened({
        paymentLines: annualLines,
        paymentGross: 8552n,
        amount: 4276n,
        disputeFee: 1500n,
        feeReturned: 0n,
        deferredLeft: 3498n,
        openPool: NOVEMBER,
      }),
    ).toEqual([
      { account: "platform:stripe_clearing", amount: -5776n },
      { account: "platform:processor_fees", amount: -134n }, // 133.5 rounded half up
      { account: "platform:tax_payable", amount: 326n },
      { account: "premium:deferred", amount: 1908n },
      { account: "platform:revenue:premium", amount: 2042n },
      { account: "pool:premium:2026-11", amount: 817n },
      { account: "platform:processor_fees", amount: 817n },
    ]);
  });

  it("shares only what Stripe kept when it returned the card fee", () => {
    const lines = postChargebackOpened({
      paymentLines: monthlyLines,
      paymentGross: 799n,
      amount: 799n,
      disputeFee: 1500n,
      feeReturned: 53n,
      deferredLeft: 0n,
      openPool: NOVEMBER,
    });
    // Stripe kept 1500: 750 each.
    expect(lines.at(-2)).toEqual({ account: "pool:premium:2026-11", amount: 750n });
    expect(lines.at(-1)).toEqual({ account: "platform:processor_fees", amount: 750n });
  });

  it("also undoes the later fees, in proportion", () => {
    // The payment, then a 12-cent fee that came late (6 off the pool, 6 off Ruken): 463 is left in the pool and 524
    // in Ruken's revenue. Refunded whole, Stripe keeps the 61 and the 12: 73, shared 37 and 36.
    const lateFee = postPaymentFee(feeParts(paid, 12n), (period) => `pool:premium:${period}`);
    expect(
      postChargebackOpened({
        paymentLines: [...paidLines, ...lateFee],
        paymentGross: 1081n,
        amount: 1081n,
        disputeFee: 0n,
        feeReturned: 0n,
        deferredLeft: 0n,
        openPool: DECEMBER,
      }),
    ).toEqual([
      { account: "platform:stripe_clearing", amount: -1081n },
      { account: "platform:processor_fees", amount: -61n },
      { account: "platform:tax_payable", amount: 82n },
      { account: "pool:premium:2026-12", amount: 463n },
      { account: "platform:revenue:premium", amount: 524n },
      { account: "pool:premium:2026-12", amount: 37n },
      { account: "platform:processor_fees", amount: 36n },
    ]);
  });

  it("refuses a dispute for more than the payment, or more deferred than the payment had", () => {
    const base = {
      paymentLines: annualLines,
      paymentGross: 8552n,
      amount: 8552n,
      disputeFee: 1500n,
      feeReturned: 0n,
      deferredLeft: 0n,
      openPool: NOVEMBER,
    };
    expect(() => postChargebackOpened({ ...base, amount: 8553n })).toThrow(RangeError);
    expect(() => postChargebackOpened({ ...base, deferredLeft: 3499n })).toThrow(RangeError);
  });

  it("refuses a payment that took no money, and Stripe returning more fees than it kept", () => {
    const base = {
      paymentLines: monthlyLines,
      paymentGross: 799n,
      amount: 799n,
      disputeFee: 0n,
      feeReturned: 0n,
      deferredLeft: 0n,
      openPool: NOVEMBER,
    };
    expect(() => postChargebackOpened({ ...base, paymentGross: 0n })).toThrow(RangeError);
    expect(() => postChargebackOpened({ ...base, feeReturned: 54n })).toThrow(RangeError);
  });

  it("balances, never gives back more of a pool than the payment put in, and shares Stripe's cut within a cent", () => {
    // A fixed sweep of payments and disputes, in place of random cases, so a failure replays exactly.
    for (const plan of ["monthly", "annual"] as const) {
      for (const gross of [100n, 799n, 1081n, 8552n, 55_555n]) {
        for (const tax of [0n, gross / 12n]) {
          for (const fees of [0n, 53n, 300n]) {
            const payment = { plan, firstPeriod: NOVEMBER, gross, tax, fees } as const;
            const paymentLines = postPaymentPaid(payment);
            const parts = releases(payment);
            for (const releasedMonths of [0, 3, 11]) {
              const deferredLeft = parts
                .slice(releasedMonths)
                .reduce((total, part) => total + part.amount, 0n);
              for (const amount of [gross, (gross + 1n) / 2n]) {
                for (const disputeFee of [0n, 1500n]) {
                  // Stripe never returns more of a fee than the part of the payment being undone carried.
                  for (const feeReturned of amount === gross ? [0n, fees] : [0n]) {
                    const opened = postChargebackOpened({
                      paymentLines,
                      paymentGross: gross,
                      amount,
                      disputeFee,
                      feeReturned,
                      deferredLeft,
                      openPool: FEBRUARY,
                    });
                    expect(sum(opened)).toBe(0n);
                    expect(net("premium:deferred", opened)).toBeLessThanOrEqual(deferredLeft);
                    if (amount !== gross) continue;
                    // A full dispute gives back the whole pool share (from deferred and the open month); the
                    // makers and Ruken each carry half of what Stripe kept, the makers' half rounded up.
                    const poolShare = -(
                      net("pool:premium:2026-11", paymentLines) + net("premium:deferred", paymentLines)
                    );
                    const makersPart =
                      net("premium:deferred", opened) + net("pool:premium:2027-02", opened) - poolShare;
                    const rukenPart = net("platform:processor_fees", opened) + fees;
                    expect(makersPart + rukenPart).toBe(fees + disputeFee - feeReturned);
                    expect(makersPart - rukenPart).toBeGreaterThanOrEqual(0n);
                    expect(makersPart - rukenPart).toBeLessThanOrEqual(1n);
                  }
                }
              }
            }
          }
        }
      }
    }
  });
});

describe("postChargebackWon", () => {
  const monthlyOpened = postChargebackOpened({
    paymentLines: monthlyLines,
    paymentGross: 799n,
    amount: 799n,
    disputeFee: 1500n,
    feeReturned: 0n,
    deferredLeft: 0n,
    openPool: NOVEMBER,
  });

  it("reverses the opened entry, giving the pool money back to the pool month open now", () => {
    const won = postChargebackWon(monthlyOpened, JANUARY, 2299n);
    expect(won).toEqual([
      { account: "platform:stripe_clearing", amount: 2299n },
      { account: "platform:processor_fees", amount: 53n },
      { account: "pool:premium:2027-01", amount: -373n },
      { account: "platform:revenue:premium", amount: -426n },
      { account: "pool:premium:2027-01", amount: -777n },
      { account: "platform:processor_fees", amount: -776n },
    ]);
    expect(sum(won)).toBe(0n);
  });

  it("puts the cancelled months back in premium:deferred, so their releases can go on", () => {
    const opened = postChargebackOpened({
      paymentLines: annualLines,
      paymentGross: 8552n,
      amount: 8552n,
      disputeFee: 1500n,
      feeReturned: 0n,
      deferredLeft: 2544n,
      openPool: FEBRUARY,
    });
    expect(net("premium:deferred", opened, postChargebackWon(opened, FEBRUARY, 10052n))).toBe(0n);
  });

  it("shares a dispute fee Stripe kept half and half, the makers' half from the open pool month", () => {
    // Stripe gave the disputed 799 back but kept its 1500 dispute fee.
    const won = postChargebackWon(monthlyOpened, JANUARY, 799n);
    expect(sum(won)).toBe(0n);
    expect(won).toContainEqual({ account: "platform:stripe_clearing", amount: 799n });
    expect(won.slice(-2)).toEqual([
      { account: "pool:premium:2027-01", amount: 750n },
      { account: "platform:processor_fees", amount: 750n },
    ]);
  });
});

describe("postRefund", () => {
  it("gives a whole payment back: every side gives back what it got, and Stripe keeps its fee", () => {
    // The refund goes back out of Stripe; the 61 it keeps is shared 31 to makers (30.5 rounded up) and 30 to Ruken.
    expect(
      postRefund({
        paymentLines: paidLines,
        paymentGross: 1081n,
        amount: 1081n,
        feeReturned: 0n,
        deferredLeft: 0n,
        openPool: DECEMBER,
      }),
    ).toEqual([
      { account: "platform:stripe_clearing", amount: -1081n },
      { account: "platform:processor_fees", amount: -61n },
      { account: "platform:tax_payable", amount: 82n },
      { account: "pool:premium:2026-12", amount: 469n },
      { account: "platform:revenue:premium", amount: 530n },
      { account: "pool:premium:2026-12", amount: 31n },
      { account: "platform:processor_fees", amount: 30n },
    ]);
  });

  it("is the payment's lines reversed, cash less any fee returned, when Stripe returns the fee too", () => {
    expect(
      postRefund({
        paymentLines: paidLines,
        paymentGross: 1081n,
        amount: 1081n,
        feeReturned: 61n,
        deferredLeft: 0n,
        openPool: DECEMBER,
      }),
    ).toEqual([
      { account: "platform:stripe_clearing", amount: -1020n },
      { account: "platform:processor_fees", amount: -61n },
      { account: "platform:tax_payable", amount: 82n },
      { account: "pool:premium:2026-12", amount: 469n },
      { account: "platform:revenue:premium", amount: 530n },
    ]);
  });

  it("refunds a yearly payment in its fourth month: the unreleased months first", () => {
    // Review Focus 5. Eight months are not yet released (2544). The pool's part of the refund comes from
    // premium:deferred up to that, and the rest (1272) from the pool month that is open.
    expect(
      postRefund({
        paymentLines: annualLines,
        paymentGross: 8552n,
        amount: 8552n,
        feeReturned: 267n,
        deferredLeft: 2544n,
        openPool: FEBRUARY,
      }),
    ).toEqual([
      { account: "platform:stripe_clearing", amount: -8285n },
      { account: "platform:processor_fees", amount: -267n },
      { account: "platform:tax_payable", amount: 652n },
      { account: "premium:deferred", amount: 2544n },
      { account: "pool:premium:2027-02", amount: 1272n },
      { account: "platform:revenue:premium", amount: 4084n },
    ]);
  });

  it("adds up to zero", () => {
    for (const feeReturned of [0n, 15n, 30n]) {
      expect(
        sum(
          postRefund({
            paymentLines: paidLines,
            paymentGross: 1081n,
            amount: 540n,
            feeReturned,
            deferredLeft: 0n,
            openPool: DECEMBER,
          }),
        ),
      ).toBe(0n);
    }
  });
});

describe("cancelledMonths", () => {
  const parts = releases(annual);

  it("cancels the latest months first, the last one in part", () => {
    expect(cancelledMonths(parts, 700n)).toEqual(
      new Map<Period, bigint>([
        [parsePeriod("2027-10"), 318n],
        [parsePeriod("2027-09"), 318n],
        [parsePeriod("2027-08"), 64n],
      ]),
    );
  });

  it("cancels every month for all of what was deferred, and nothing for nothing", () => {
    const all = cancelledMonths(parts, 3498n);
    expect([...all.values()].reduce((total, part) => total + part, 0n)).toBe(3498n);
    expect(all.size).toBe(11);
    expect(cancelledMonths(parts, 0n).size).toBe(0);
  });

  it("refuses to cancel more than was deferred, or a negative amount", () => {
    expect(() => cancelledMonths(parts, 3499n)).toThrow(RangeError);
    expect(() => cancelledMonths(parts, -1n)).toThrow(RangeError);
  });
});

describe("reversePaymentLines", () => {
  it("turns every non-cash line of a whole payment, keeping its order", () => {
    expect(reversePaymentLines(paidLines, 1081n, 1081n)).toEqual([
      { account: "platform:processor_fees", amount: -61n },
      { account: "platform:tax_payable", amount: 82n },
      { account: "pool:premium:2026-11", amount: 469n },
      { account: "platform:revenue:premium", amount: 530n },
    ]);
  });

  it("scales each side for half a payment, and the lines still add up to the half", () => {
    expect(reversePaymentLines(annualLines, 4276n, 8552n)).toEqual([
      { account: "platform:processor_fees", amount: -134n },
      { account: "platform:tax_payable", amount: 326n },
      { account: "pool:premium:2026-11", amount: 159n },
      { account: "premium:deferred", amount: 1749n },
      { account: "platform:revenue:premium", amount: 2042n },
    ]);
  });
});

describe("reverseOpenedEntry", () => {
  const opened = [
    { account: "platform:stripe_clearing", amount: -1000n },
    { account: "platform:revenue:premium", amount: 1000n },
  ];

  it("turns every sign and swaps the cash for what Stripe gave back, saying how much it kept", () => {
    expect(reverseOpenedEntry(opened, 400n)).toEqual({
      reversal: [
        { account: "platform:stripe_clearing", amount: 400n },
        { account: "platform:revenue:premium", amount: -1000n },
      ],
      notReturned: 600n,
    });
  });

  it("refuses more than the dispute took, a negative amount, and an entry with no cash line", () => {
    expect(() => reverseOpenedEntry(opened, 1001n)).toThrow(RangeError);
    expect(() => reverseOpenedEntry(opened, -1n)).toThrow(RangeError);
    expect(() => reverseOpenedEntry([{ account: "platform:revenue:premium", amount: 0n }], 0n)).toThrow(
      RangeError,
    );
  });
});
