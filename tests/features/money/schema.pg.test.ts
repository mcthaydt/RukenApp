import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { newPublicId } from "../../../src/features/games/ids.ts";
import type { PrismaClient } from "../../../src/lib/server/db.ts";
import { startTestDatabase, type TestDatabase } from "../../support/database.ts";

// Plain SQL on purpose, as for the play tables: these check what the database itself refuses (the CHECK rules, the
// add-only triggers, "every entry adds up to zero", "no entry into a final month" and "a month only moves forward"),
// whatever the application code does. The ledger is the one place where a wrong row must be impossible, not unlikely.

let database: TestDatabase | undefined;

function db(): PrismaClient {
  if (database === undefined) throw new Error("the database did not start");
  return database.prisma;
}

beforeAll(async () => {
  database = await startTestDatabase();
  await db().$executeRaw`INSERT INTO "LedgerPeriod" ("period") VALUES ('2026-11')`;
});

afterAll(async () => {
  await database?.stop();
});

let counter = 0;

/** A new person, for a line that names a maker. */
async function newMaker(): Promise<string> {
  counter += 1;
  const user = await db().user.create({
    data: { name: "Maker", email: `maker-${String(counter)}@example.test` },
  });
  return user.id;
}

interface LineValues {
  account: string;
  amount: bigint;
  makerUserId?: string | null;
}

/**
 * One entry and its lines, in one transaction, by plain SQL. The database checks that the lines add up when the
 * transaction commits, so a wrong entry is refused at the commit and nothing of it stays.
 */
async function postRaw(lines: readonly LineValues[], values: { period?: string } = {}): Promise<string> {
  const entryId = randomUUID();
  const period = values.period ?? "2026-11";
  await db().$transaction(async (tx) => {
    await tx.$executeRaw`
      INSERT INTO "JournalEntry" ("id", "idempotencyKey", "period", "kind", "linesHash")
      VALUES (${entryId}, ${entryId}, ${period}, 'payment'::"JournalEntryKind", 'not-checked-here')`;
    for (const line of lines) {
      await tx.$executeRaw`
        INSERT INTO "JournalLine" ("id", "entryId", "account", "makerUserId", "amount")
        VALUES (${randomUUID()}, ${entryId}, ${line.account}, ${line.makerUserId ?? null}, ${line.amount})`;
    }
  });
  return entryId;
}

const BALANCED: readonly LineValues[] = [
  { account: "platform:cash", amount: 100n },
  { account: "platform:revenue:premium", amount: -100n },
];

describe("the ledger tables", () => {
  it("makes the ledger tables", async () => {
    const rows = await db().$queryRaw<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`;
    expect(rows.map((row) => row.table_name)).toEqual(
      expect.arrayContaining(["LedgerPeriod", "JournalEntry", "JournalLine"]),
    );
  });

  it("takes an entry whose lines add up to zero", async () => {
    const entryId = await postRaw(BALANCED);
    const lines = await db().$queryRaw<{ amount: bigint }[]>`
      SELECT "amount" FROM "JournalLine" WHERE "entryId" = ${entryId} ORDER BY "amount"`;
    expect(lines.map((line) => line.amount)).toEqual([-100n, 100n]);
  });

  it("refuses an entry whose lines do not add up to zero", async () => {
    await expect(
      postRaw([
        { account: "platform:cash", amount: 100n },
        { account: "platform:revenue:premium", amount: -99n },
      ]),
    ).rejects.toThrow(/does not balance/);
  });

  it("refuses an entry with one line", async () => {
    await expect(postRaw([{ account: "platform:cash", amount: 0n }])).rejects.toThrow(/does not balance/);
  });

  it("refuses to change or delete an entry or a line", async () => {
    const entryId = await postRaw(BALANCED);
    await expect(
      db()
        .$executeRaw`UPDATE "JournalEntry" SET "kind" = 'refund'::"JournalEntryKind" WHERE "id" = ${entryId}`,
    ).rejects.toThrow(/JournalEntry is append-only/);
    await expect(db().$executeRaw`DELETE FROM "JournalEntry" WHERE "id" = ${entryId}`).rejects.toThrow(
      /JournalEntry is append-only/,
    );
    await expect(
      db().$executeRaw`UPDATE "JournalLine" SET "amount" = 7 WHERE "entryId" = ${entryId}`,
    ).rejects.toThrow(/JournalLine is append-only/);
    await expect(db().$executeRaw`DELETE FROM "JournalLine" WHERE "entryId" = ${entryId}`).rejects.toThrow(
      /JournalLine is append-only/,
    );
  });

  it("refuses an entry into a month that is final", async () => {
    await db().$executeRaw`INSERT INTO "LedgerPeriod" ("period") VALUES ('2026-08')`;
    // A closed month still takes entries: its pool is shared after it closes and before it is final.
    await db()
      .$executeRaw`UPDATE "LedgerPeriod" SET "state" = 'closed', "closedAt" = now() WHERE "period" = '2026-08'`;
    await expect(postRaw(BALANCED, { period: "2026-08" })).resolves.toBeDefined();

    await db()
      .$executeRaw`UPDATE "LedgerPeriod" SET "state" = 'final', "finalAt" = now() WHERE "period" = '2026-08'`;
    await expect(postRaw(BALANCED, { period: "2026-08" })).rejects.toThrow(
      /2026-08 is final and takes no new entries/,
    );
  });

  describe("a month", () => {
    it("moves only forward: open, closed, final", async () => {
      await db().$executeRaw`INSERT INTO "LedgerPeriod" ("period") VALUES ('2026-07')`;
      await db()
        .$executeRaw`UPDATE "LedgerPeriod" SET "state" = 'closed', "closedAt" = now() WHERE "period" = '2026-07'`;
      await db()
        .$executeRaw`UPDATE "LedgerPeriod" SET "state" = 'final', "finalAt" = now() WHERE "period" = '2026-07'`;

      await expect(
        db().$executeRaw`UPDATE "LedgerPeriod" SET "state" = 'closed' WHERE "period" = '2026-07'`,
      ).rejects.toThrow(/moving final → closed is not allowed/);
      await expect(
        db().$executeRaw`UPDATE "LedgerPeriod" SET "state" = 'open' WHERE "period" = '2026-07'`,
      ).rejects.toThrow(/moving final → open is not allowed/);
    });

    it("cannot go from closed back to open, or from open straight to final", async () => {
      await db().$executeRaw`INSERT INTO "LedgerPeriod" ("period") VALUES ('2026-06')`;
      await expect(
        db().$executeRaw`UPDATE "LedgerPeriod" SET "state" = 'final' WHERE "period" = '2026-06'`,
      ).rejects.toThrow(/moving open → final is not allowed/);
      await db()
        .$executeRaw`UPDATE "LedgerPeriod" SET "state" = 'closed', "closedAt" = now() WHERE "period" = '2026-06'`;
      await expect(
        db().$executeRaw`UPDATE "LedgerPeriod" SET "state" = 'open' WHERE "period" = '2026-06'`,
      ).rejects.toThrow(/moving closed → open is not allowed/);
    });

    it("is never deleted, and changes only when its state moves", async () => {
      await expect(db().$executeRaw`DELETE FROM "LedgerPeriod" WHERE "period" = '2026-11'`).rejects.toThrow(
        /LedgerPeriod rows are never deleted/,
      );
      await expect(
        db().$executeRaw`UPDATE "LedgerPeriod" SET "createdAt" = now() WHERE "period" = '2026-11'`,
      ).rejects.toThrow(/a row changes only when its state moves/);
    });

    it("is refused a name that is not YYYY-MM", async () => {
      for (const period of ["2026-13", "2026-00", "26-11", "2026-1", "2026-11-01", "November"]) {
        await expect(
          db().$executeRaw`INSERT INTO "LedgerPeriod" ("period") VALUES (${period})`,
        ).rejects.toThrow(/LedgerPeriod_period_check/);
      }
    });
  });

  describe("a line", () => {
    it("ties a maker's account to that maker", async () => {
      const maker = await newMaker();
      const other = await newMaker();
      const pool: LineValues = { account: "pool:premium:2026-11", amount: -50n };

      // A maker's own account, naming that maker.
      await expect(
        postRaw([{ account: `maker:${maker}:payable`, amount: 50n, makerUserId: maker }, pool]),
      ).resolves.toBeDefined();

      // Another maker's id on it, or none at all.
      for (const makerUserId of [other, null]) {
        await expect(
          postRaw([{ account: `maker:${maker}:payable`, amount: 50n, makerUserId }, pool]),
        ).rejects.toThrow(/JournalLine_maker_check/);
      }
      // A maker's account that is not the payable one.
      await expect(
        postRaw([{ account: `maker:${maker}:pending`, amount: 50n, makerUserId: maker }, pool]),
      ).rejects.toThrow(/JournalLine_maker_check/);
    });

    it("names no maker on an account that is not a maker's", async () => {
      const maker = await newMaker();
      await expect(
        postRaw([
          { account: "pool:premium:2026-11", amount: 50n, makerUserId: maker },
          { account: "platform:cash", amount: -50n },
        ]),
      ).rejects.toThrow(/JournalLine_maker_check/);
    });
  });
});

// The fact tables: what the daily job read from Stripe and from play, kept exactly as read. A fact is added and never
// changed, so what a statement was worked out from can always be shown again.
describe("the fact tables", () => {
  const FACT_TABLES = [
    "PaymentPosting",
    "StripeFeeRun",
    "StripeFeeRow",
    "FeePosting",
    "StripeReversal",
    "PlayDayRun",
    "PlayDay",
  ];

  /** A game, which a day's play points at. */
  async function newGame(makerUserId: string): Promise<string> {
    counter += 1;
    const id = randomUUID();
    await db().$executeRaw`
      INSERT INTO "Game"
        ("id", "publicId", "slug", "makerUserId", "name", "oneLine", "playsOn", "repoFullName", "updatedAt")
      VALUES
        (${id}, ${newPublicId()}, ${`game-${String(counter)}`}, ${makerUserId}, 'A game', 'A game about a thing.',
         'phone_and_computer'::"GamePlaysOn", 'acme/game', now())`;
    return id;
  }

  /** A payment, which a posting points at, by plain SQL. */
  async function newPayment(userId: string): Promise<string> {
    const invoice = `in_${randomUUID()}`;
    await db().$executeRaw`
      INSERT INTO "MembershipPayment"
        ("id", "stripeInvoiceId", "userId", "stripeSubscriptionId", "plan", "periodStart", "paidAt",
         "grossCents", "taxCents", "cardFeeCents")
      VALUES
        (${randomUUID()}, ${invoice}, ${userId}, 'sub_1', 'monthly'::"PremiumPlan", now(), now(), 1081, 82, 61)`;
    return invoice;
  }

  async function insertPaymentPosting(invoice: string): Promise<void> {
    const id = randomUUID();
    await db().$executeRaw`
      INSERT INTO "PaymentPosting"
        ("stripeInvoiceId", "firstPeriod", "stripeChargeId", "stripePaymentIntentId", "balanceTransactionId", "postedAt")
      VALUES (${invoice}, '2026-11', ${`ch_${id}`}, ${`pi_${id}`}, ${`txn_${id}`}, now())`;
  }

  /** A fee run asked of Stripe for the stretch starting `startSec` seconds after the epoch. */
  async function insertFeeRun(startSec = 1_000): Promise<string> {
    const id = randomUUID();
    await db().$executeRaw`
      INSERT INTO "StripeFeeRun" ("id", "intervalStart", "intervalEnd", "stripeReportRunId", "requestedAt")
      VALUES (${id}, to_timestamp(${startSec}), to_timestamp(${startSec + 5_000}), ${`frr_${id}`}, now())`;
    return id;
  }

  async function insertFeeRow(runId: string, rowNumber = 1): Promise<string> {
    const id = randomUUID();
    await db().$executeRaw`
      INSERT INTO "StripeFeeRow"
        ("id", "runId", "rowNumber", "balanceTransactionId", "balanceTransactionAt", "feeTransactionId", "incurredBy",
         "incurredByType", "incurredAt", "product", "featureName", "description", "amountText", "taxText", "currency",
         "settledVia")
      VALUES
        (${id}, ${runId}, ${rowNumber}, 'txn_1', '2026-11-03 10:00:00', 'ftxn_1', 'in_1', 'invoice',
         '2026-11-03 10:00:00', 'billing', 'invoicing', 'A fee', '0.06993', '0', 'usd', 'balance')`;
    return id;
  }

  async function insertFeePosting(
    feeRowId: string,
    values: { kind?: string; invoice?: string | null; makerUserId?: string | null } = {},
  ): Promise<void> {
    const kind = values.kind ?? "counted";
    const invoice = values.invoice ?? null;
    const makerUserId = values.makerUserId ?? null;
    await db().$executeRaw`
      INSERT INTO "FeePosting" ("feeRowId", "kind", "stripeInvoiceId", "makerUserId", "microCents", "postedAt")
      VALUES (${feeRowId}, ${kind}::"FeeKind", ${invoice}, ${makerUserId}, 69930, now())`;
  }

  async function insertPlayDay(userId: string, gameId: string, day: string, seconds: number): Promise<void> {
    await db().$executeRaw`
      INSERT INTO "PlayDay" ("id", "day", "userId", "gameId", "seconds")
      VALUES (${randomUUID()}, ${day}::date, ${userId}, ${gameId}, ${seconds})`;
  }

  it("are made by the migrations", async () => {
    const rows = await db().$queryRaw<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`;
    expect(rows.map((row) => row.table_name)).toEqual(expect.arrayContaining(FACT_TABLES));
  });

  describe("every fact is only ever added", () => {
    it.each(["PaymentPosting", "StripeFeeRow", "FeePosting", "StripeReversal", "PlayDayRun", "PlayDay"])(
      "%s refuses an update and a delete",
      async (table) => {
        const maker = await newMaker();
        const invoice = await newPayment(maker);
        await insertPaymentPosting(invoice);
        const feeRow = await insertFeeRow(await insertFeeRun(10_000_000 + counter * 10_000));
        await insertFeePosting(feeRow);
        await db().$executeRaw`
          INSERT INTO "StripeReversal"
            ("id", "kind", "stripeInvoiceId", "amountCents", "feeCents", "returnedCents", "balanceTransactionIds", "at")
          VALUES (${`refund:${randomUUID()}`}, 'refund'::"ReversalKind", ${invoice}, 100, 0, 61, ARRAY['txn_r'], now())`;
        const day = `2026-10-${String((counter % 27) + 1).padStart(2, "0")}`;
        await db().$executeRawUnsafe(`INSERT INTO "PlayDayRun" ("day", "rolledAt") VALUES ('${day}', now())`);
        await insertPlayDay(maker, await newGame(maker), day, 60);

        const change = {
          PaymentPosting: `UPDATE "PaymentPosting" SET "firstPeriod" = '2026-12'`,
          StripeFeeRow: `UPDATE "StripeFeeRow" SET "product" = 'other'`,
          FeePosting: `UPDATE "FeePosting" SET "microCents" = 1`,
          StripeReversal: `UPDATE "StripeReversal" SET "amountCents" = 1`,
          PlayDayRun: `UPDATE "PlayDayRun" SET "rolledAt" = now()`,
          PlayDay: `UPDATE "PlayDay" SET "seconds" = 1`,
        }[table];
        await expect(db().$executeRawUnsafe(change ?? "")).rejects.toThrow(
          new RegExp(`${table} is append-only`),
        );
        await expect(db().$executeRawUnsafe(`DELETE FROM "${table}"`)).rejects.toThrow(
          new RegExp(`${table} is append-only`),
        );
      },
    );
  });

  describe("a day's play", () => {
    it("is at least a second and at most three hours (10,800 seconds)", async () => {
      const maker = await newMaker();
      const game = await newGame(maker);
      await expect(insertPlayDay(maker, game, "2026-09-01", 10_801)).rejects.toThrow(/PlayDay_seconds_check/);
      await expect(insertPlayDay(maker, game, "2026-09-01", 0)).rejects.toThrow(/PlayDay_seconds_check/);
      await insertPlayDay(maker, game, "2026-09-01", 10_800);
      await insertPlayDay(maker, game, "2026-09-02", 1);
    });

    it("is one row for a day, a person and a game", async () => {
      const maker = await newMaker();
      const game = await newGame(maker);
      await insertPlayDay(maker, game, "2026-09-05", 600);
      await expect(insertPlayDay(maker, game, "2026-09-05", 700)).rejects.toThrow(
        /PlayDay_day_userId_gameId_key/,
      );
      await insertPlayDay(maker, game, "2026-09-06", 700);
    });
  });

  describe("a fee run", () => {
    it("moves to stored once, with its count, and then refuses a change", async () => {
      const run = await insertFeeRun(300_000);
      await db().$executeRaw`
        UPDATE "StripeFeeRun" SET "state" = 'stored'::"FeeRunState", "rowCount" = 3, "storedAt" = now() WHERE "id" = ${run}`;
      await expect(
        db().$executeRaw`UPDATE "StripeFeeRun" SET "state" = 'failed'::"FeeRunState" WHERE "id" = ${run}`,
      ).rejects.toThrow(/moving stored → failed is not allowed/);
      await expect(
        db().$executeRaw`UPDATE "StripeFeeRun" SET "rowCount" = 4 WHERE "id" = ${run}`,
      ).rejects.toThrow(/a row changes only when its state moves/);
      await expect(db().$executeRaw`DELETE FROM "StripeFeeRun" WHERE "id" = ${run}`).rejects.toThrow(
        /StripeFeeRun rows are never deleted/,
      );
    });

    it("can fail instead, with Stripe's words", async () => {
      const run = await insertFeeRun(400_000);
      await db().$executeRaw`
        UPDATE "StripeFeeRun" SET "state" = 'failed'::"FeeRunState", "problem" = 'no data' WHERE "id" = ${run}`;
    });

    it("is refused a second live run for any of the same time, and an end that is not after the start", async () => {
      await insertFeeRun(500_000); // 500,000 to 505,000
      await expect(insertFeeRun(500_000)).rejects.toThrow(/already asked for part of this stretch/);
      await expect(insertFeeRun(502_000)).rejects.toThrow(/already asked for part of this stretch/);
      await insertFeeRun(505_000); // the next stretch starts exactly where this one ended
      const id = randomUUID();
      await expect(
        db().$executeRaw`
          INSERT INTO "StripeFeeRun" ("id", "intervalStart", "intervalEnd", "stripeReportRunId", "requestedAt")
          VALUES (${id}, to_timestamp(900000), to_timestamp(900000), ${`frr_${id}`}, now())`,
      ).rejects.toThrow(/StripeFeeRun_interval_check/);
    });

    it("is asked for the same stretch again once its run failed", async () => {
      const failed = await insertFeeRun(800_000);
      await db().$executeRaw`
        UPDATE "StripeFeeRun" SET "state" = 'failed'::"FeeRunState", "problem" = 'no data' WHERE "id" = ${failed}`;
      const again = await insertFeeRun(800_000);
      expect(again).not.toBe(failed);
      await expect(insertFeeRun(800_000)).rejects.toThrow(/already asked for part of this stretch/);
    });

    it("numbers its rows once each", async () => {
      const run = await insertFeeRun(600_000);
      await insertFeeRow(run, 1);
      await expect(insertFeeRow(run, 1)).rejects.toThrow(/StripeFeeRow_runId_rowNumber_key/);
      await insertFeeRow(run, 2);
    });
  });

  describe("a fee posting", () => {
    it("says what kind of fee it is: a payment's names its invoice, a payout's its maker, the others neither", async () => {
      const maker = await newMaker();
      const invoice = await newPayment(maker);
      const run = await insertFeeRun(700_000);
      let rowNumber = 0;
      const row = async () => insertFeeRow(run, ++rowNumber);

      // A payment posting with no invoice, or with a maker.
      await expect(insertFeePosting(await row(), { kind: "payment" })).rejects.toThrow(
        /FeePosting_kind_check/,
      );
      await expect(
        insertFeePosting(await row(), { kind: "payment", invoice, makerUserId: maker }),
      ).rejects.toThrow(/FeePosting_kind_check/);
      await insertFeePosting(await row(), { kind: "payment", invoice });

      // A payout posting with no maker, or with an invoice.
      await expect(insertFeePosting(await row(), { kind: "payout" })).rejects.toThrow(
        /FeePosting_kind_check/,
      );
      await expect(
        insertFeePosting(await row(), { kind: "payout", invoice, makerUserId: maker }),
      ).rejects.toThrow(/FeePosting_kind_check/);
      await insertFeePosting(await row(), { kind: "payout", makerUserId: maker });

      // A counted, credit or returned posting names neither.
      for (const kind of ["counted", "credit", "returned"]) {
        await expect(insertFeePosting(await row(), { kind, invoice })).rejects.toThrow(
          /FeePosting_kind_check/,
        );
        await expect(insertFeePosting(await row(), { kind, makerUserId: maker })).rejects.toThrow(
          /FeePosting_kind_check/,
        );
        await insertFeePosting(await row(), { kind });
      }
    });
  });

  describe("a reversal", () => {
    it("holds no amount below zero", async () => {
      const maker = await newMaker();
      const invoice = await newPayment(maker);
      for (const [amount, fee, returned] of [
        [-1, 0, 0],
        [100, -1, 0],
        [100, 0, -1],
      ] as const) {
        await expect(
          db().$executeRaw`
            INSERT INTO "StripeReversal"
              ("id", "kind", "stripeInvoiceId", "amountCents", "feeCents", "returnedCents", "balanceTransactionIds", "at")
            VALUES (${`refund:${randomUUID()}`}, 'refund'::"ReversalKind", ${invoice}, ${amount}, ${fee}, ${returned},
                    ARRAY[]::TEXT[], now())`,
        ).rejects.toThrow(/StripeReversal_amounts_check/);
      }
    });
  });
});
