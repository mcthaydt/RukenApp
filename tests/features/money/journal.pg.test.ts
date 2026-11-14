import { randomUUID } from "node:crypto";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  accountBalance,
  accountBalances,
  IdempotencyConflict,
  lockLedger,
  postEntry,
  postingPeriod,
  postingPeriodForMonth,
  type EntryDraft,
} from "../../../src/features/money/journal.ts";
import { parsePeriod } from "../../../src/features/money/period.ts";
import type { PrismaClient } from "../../../src/lib/server/db.ts";
import { startTestDatabase, type TestDatabase } from "../../support/database.ts";
import { expectBooksBalanced } from "../../support/ledger.ts";

// The journal writes what the pure posting functions return, once. These tests use the real database, because the
// things that matter are the database's: the same key posts once, a closed month takes no late fact, and two runs of
// the daily job take turns.

let database: TestDatabase | undefined;

function db(): PrismaClient {
  if (database === undefined) throw new Error("the database did not start");
  return database.prisma;
}

beforeAll(async () => {
  database = await startTestDatabase();
});

afterAll(async () => {
  await database?.stop();
});

const LINES = [
  { account: "platform:cash", amount: 100n },
  { account: "platform:revenue:premium", amount: -100n },
];

/** A draft in a month that is open. Each test gets a key of its own, so tests do not see each other's entries. */
function draft(overrides: Partial<EntryDraft> = {}): EntryDraft {
  return {
    key: `test:${randomUUID()}`,
    period: parsePeriod("2027-05"),
    kind: "correction",
    lines: LINES,
    ...overrides,
  };
}

async function makeMonth(period: string, state: "open" | "closed" | "final"): Promise<void> {
  await db().$executeRaw`INSERT INTO "LedgerPeriod" ("period") VALUES (${period})`;
  if (state === "open") return;
  await db()
    .$executeRaw`UPDATE "LedgerPeriod" SET "state" = 'closed', "closedAt" = now() WHERE "period" = ${period}`;
  if (state === "closed") return;
  await db()
    .$executeRaw`UPDATE "LedgerPeriod" SET "state" = 'final', "finalAt" = now() WHERE "period" = ${period}`;
}

async function stateOf(period: string): Promise<string | undefined> {
  const row = await db().ledgerPeriod.findUnique({ where: { period } });
  return row?.state;
}

async function entry(key: string) {
  return db().journalEntry.findUniqueOrThrow({ where: { idempotencyKey: key }, include: { lines: true } });
}

describe("postEntry", () => {
  beforeAll(async () => {
    await makeMonth("2027-05", "open");
  });

  it("posts an entry once, and answers a repeat", async () => {
    const first = draft();
    expect(await postEntry(db(), first)).toBe("posted");
    expect(await postEntry(db(), first)).toBe("repeat");

    expect(await db().journalEntry.count({ where: { idempotencyKey: first.key } })).toBe(1);
    expect((await entry(first.key)).lines).toHaveLength(2);
  });

  it("refuses the same key with other lines", async () => {
    const first = draft();
    await postEntry(db(), first);
    const changed = { ...first, lines: LINES.map((line) => ({ ...line, amount: line.amount * 2n })) };

    await expect(postEntry(db(), changed)).rejects.toBeInstanceOf(IdempotencyConflict);
    expect((await entry(first.key)).lines.map((line) => line.amount).sort()).toEqual([-100n, 100n]);
  });

  it("takes the same lines in another order as the same entry", async () => {
    const first = draft();
    await postEntry(db(), first);
    expect(await postEntry(db(), { ...first, lines: [...LINES].reverse() })).toBe("repeat");
  });

  it("keeps the payment, the game and the maker a line names", async () => {
    const maker = await db().user.create({
      data: { name: "Maker", email: `maker-${randomUUID()}@example.test` },
    });
    const lines = [
      { account: "pool:premium:2027-05", amount: 40n },
      { account: `maker:${maker.id}:payable`, amount: -40n, makerUserId: maker.id },
    ];
    const posted = draft({ stripeInvoiceId: "in_fake_1", lines });
    await postEntry(db(), posted);

    const stored = await entry(posted.key);
    expect(stored.stripeInvoiceId).toBe("in_fake_1");
    expect(stored.lines.find((line) => line.makerUserId !== null)?.makerUserId).toBe(maker.id);
  });

  it("links a reversal to the entry it reverses", async () => {
    const original = draft();
    await postEntry(db(), original);
    const { id } = await entry(original.key);
    const reversal = draft({
      lines: LINES.map((line) => ({ ...line, amount: -line.amount })),
      reversesId: id,
    });
    await postEntry(db(), reversal);

    expect((await entry(reversal.key)).reversesId).toBe(id);
    expect((await entry(original.key)).reversesId).toBeNull();
  });

  it("refuses to reverse a reversal, or an entry that does not exist", async () => {
    const original = draft();
    await postEntry(db(), original);
    const reversal = draft({
      lines: LINES.map((line) => ({ ...line, amount: -line.amount })),
      reversesId: (await entry(original.key)).id,
    });
    await postEntry(db(), reversal);
    const reversalId = (await entry(reversal.key)).id;

    await expect(postEntry(db(), draft({ reversesId: reversalId }))).rejects.toThrow(/reversal/);
    await expect(postEntry(db(), draft({ reversesId: "no-such-entry" }))).rejects.toThrow(/no entry/i);
  });

  it("leaves the books balanced", async () => {
    await expectBooksBalanced(db());
  });
});

// Review Focus 3: a fact that arrives after its month closed is posted into the month that is open.
describe("postingPeriod", () => {
  const NOVEMBER_FACT = Date.parse("2026-11-15T18:00:00Z");
  const DECEMBER_9TH = Date.parse("2026-12-09T09:17:00Z");

  it("posts a fact into its own month while that month is open", async () => {
    expect(await postingPeriod(db(), NOVEMBER_FACT, NOVEMBER_FACT + 60_000)).toBe("2026-11");
    expect(await stateOf("2026-11")).toBe("open");
  });

  it("posts a late fact into the open month, never the closed one", async () => {
    await db()
      .$executeRaw`UPDATE "LedgerPeriod" SET "state" = 'closed', "closedAt" = now() WHERE "period" = '2026-11'`;

    expect(await postingPeriod(db(), NOVEMBER_FACT, DECEMBER_9TH)).toBe("2026-12");
    expect(await stateOf("2026-12")).toBe("open");
    expect(await stateOf("2026-11")).toBe("closed");
  });

  it("reads the month a Chicago evening belongs to, not the UTC one", async () => {
    // 23:30 on 30 September in Chicago is already 1 October in UTC.
    const lateEvening = Date.parse("2026-10-01T04:30:00Z");
    expect(await postingPeriod(db(), lateEvening, lateEvening)).toBe("2026-09");
  });

  it("takes a month, and not an instant, for something that belongs to a month (a release)", async () => {
    expect(
      await postingPeriodForMonth(db(), parsePeriod("2027-02"), Date.parse("2027-02-03T12:00:00Z")),
    ).toBe("2027-02");
    await makeMonth("2027-03", "closed");
    expect(
      await postingPeriodForMonth(db(), parsePeriod("2027-03"), Date.parse("2027-04-09T12:00:00Z")),
    ).toBe("2027-04");
  });

  it("makes a month that is not there yet, open", async () => {
    expect(await stateOf("2030-01")).toBeUndefined();
    await postingPeriod(db(), Date.parse("2030-01-10T12:00:00Z"), Date.parse("2030-01-10T12:00:00Z"));
    expect(await stateOf("2030-01")).toBe("open");
  });

  it("throws when the month it would fall back to is not open either", async () => {
    await makeMonth("2031-01", "closed");
    const inJanuary = Date.parse("2031-01-20T12:00:00Z");
    await expect(postingPeriod(db(), inJanuary, inJanuary)).rejects.toThrow(/2031-01/);
  });
});

/** Waits until `ready` answers true, asking again until it does or the time is up. A wait on a state, not a sleep. */
async function until(ready: () => Promise<boolean>, what: string): Promise<void> {
  const deadline = Date.now() + 10_000;
  while (!(await ready())) {
    if (Date.now() > deadline) throw new Error(`gave up waiting until ${what}`);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

// Review Focus 9: the daily job run twice at once. The second run waits for the first, then sees what it posted.
describe("lockLedger", () => {
  it("makes two posters take turns", async () => {
    const watcher = new pg.Client({ connectionString: database?.url ?? "" });
    await watcher.connect();
    try {
      const first = draft();
      const events: string[] = [];
      let letFirstGo: () => void = () => undefined;
      const firstMayGo = new Promise<void>((resolve) => {
        letFirstGo = resolve;
      });
      let firstHoldsLock: () => void = () => undefined;
      const firstIsHolding = new Promise<void>((resolve) => {
        firstHoldsLock = resolve;
      });

      const firstRun = db().$transaction(async (tx) => {
        await lockLedger(tx);
        events.push("first has the lock");
        firstHoldsLock();
        await firstMayGo;
        await postEntry(tx, first);
        events.push("first posts");
      });
      await firstIsHolding;

      const secondRun = db().$transaction(async (tx) => {
        await lockLedger(tx);
        events.push("second has the lock");
        return (await tx.journalEntry.findUnique({ where: { idempotencyKey: first.key } })) !== null;
      });

      // The second asks for the lock, is not given it, and waits: Postgres shows an advisory lock not granted.
      await until(async () => {
        const waiting = await watcher.query(
          "SELECT 1 FROM pg_locks WHERE locktype = 'advisory' AND NOT granted",
        );
        return waiting.rowCount === 1;
      }, "the second run is waiting for the lock");
      expect(events).toEqual(["first has the lock"]);

      letFirstGo();
      await firstRun;
      expect(await secondRun).toBe(true);
      expect(events).toEqual(["first has the lock", "first posts", "second has the lock"]);
    } finally {
      await watcher.end();
    }
  });
});

describe("account balances", () => {
  it("adds up one account, and every account under a prefix", async () => {
    const tag = randomUUID().slice(0, 8);
    await makeMonth("2028-01", "open");
    const period = parsePeriod("2028-01");
    await postEntry(
      db(),
      draft({
        period,
        lines: [
          { account: `bal-${tag}:cash`, amount: 300n },
          { account: `bal-${tag}:revenue`, amount: -300n },
        ],
      }),
    );
    await postEntry(
      db(),
      draft({
        period,
        lines: [
          { account: `bal-${tag}:cash`, amount: 50n },
          { account: `bal-${tag}:fees`, amount: -50n },
        ],
      }),
    );

    expect(await accountBalance(db(), `bal-${tag}:cash`)).toBe(350n);
    expect(await accountBalance(db(), `bal-${tag}:nothing`)).toBe(0n);
    expect(await accountBalances(db(), `bal-${tag}:`)).toEqual(
      new Map([
        [`bal-${tag}:cash`, 350n],
        [`bal-${tag}:revenue`, -300n],
        [`bal-${tag}:fees`, -50n],
      ]),
    );
    expect(await accountBalances(db(), `bal-${tag}:c`)).toEqual(new Map([[`bal-${tag}:cash`, 350n]]));
  });
});
