import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { askingOf } from "../../../src/features/feed/feed-public.ts";
import {
  createParentAsks,
  nameOf,
  readParentAskLimits,
  STAND_IN_PARENT_ASK_LIMITS,
  type ParentAsks,
} from "../../../src/features/feed/parent-asks.ts";
import { createTaste, type Taste } from "../../../src/features/feed/taste.ts";
import type { PrismaClient } from "../../../src/lib/server/db.ts";
import type { TextMessage, Texter } from "../../../src/lib/server/text.ts";
import { createUser } from "../../support/create-user.ts";
import { startTestDatabase, type TestDatabase } from "../../support/database.ts";
import { TestClock } from "../../support/test-clock.ts";

// A parent's yes (learned feed spec, unit I), against Postgres: one open ask per teen, three texts a day, an ask ends
// after five days, the parent's Yes, No and Turn it off, and the feed following the yes only while teenPersonal is on.

let database: TestDatabase | undefined;
const clock = new TestClock("2026-11-28T12:00:00Z");
const texts: TextMessage[] = [];
let textsGo = true;
const texter: Texter = {
  send(message) {
    texts.push(message);
    return Promise.resolve(
      textsGo ? { sent: true, providerId: "SM-test" } : { sent: false, why: "allowlist" },
    );
  },
  sendCode: () => Promise.reject(new Error("not used")),
  codeUsed: () => Promise.resolve(),
  changedHands: () => Promise.resolve("cannot_say"),
};
let teenPersonal = true;
/** Most tests text the same number from many teens in one test day, so the per-number limit is high unless a test lowers it. */
let perNumberADay = 1000;
let parents: ParentAsks;
let taste: Taste;

function db(): PrismaClient {
  if (database === undefined) throw new Error("the database did not start");
  return database.prisma;
}

beforeAll(async () => {
  database = await startTestDatabase();
  parents = createParentAsks({
    db: db(),
    clock,
    texting: () => ({ texter, secret: "test-only-secret" }),
    teenPersonal: () => teenPersonal,
    limits: () => ({ perNumberADay }),
  });
  taste = createTaste({ db: db(), clock, teenPersonal: () => teenPersonal });
});

afterAll(async () => {
  await database?.stop();
});

beforeEach(() => {
  texts.length = 0;
  textsGo = true;
  teenPersonal = true;
  perNumberADay = 1000;
});

/** A person of 15. */
async function teen(): Promise<string> {
  const id = await createUser(db());
  await db().user.update({ where: { id }, data: { adultOn: new Date("2029-06-01T00:00:00Z") } });
  return id;
}

const PARENT = { name: "Sam", country: "US", phone: "312 555 0199" };
const ORIGIN = "https://ruken.test";

/** Asks, and answers the link's secret part from the text. */
async function askAndToken(teenId: string): Promise<string> {
  expect(await parents.ask(teenId, PARENT, ORIGIN)).toBe("texted");
  const body = texts.at(-1)?.body ?? "";
  const token = /\/parent\/(\S+)$/.exec(body)?.[1];
  if (token === undefined) throw new Error(`no link in "${body}"`);
  return token;
}

const asking = (userId: string) =>
  askingOf({ learned: true, teenPersonal, windowDays: 7 }, { userId, consented: true }, (id) =>
    taste.learnerOf(id),
  );

describe("a teen's ask", () => {
  it("texts the parent the spec's words and a link, and keeps neither the number nor the link", async () => {
    const id = await teen();
    const token = await askAndToken(id);
    expect(texts).toEqual([
      {
        to: "+13125550199",
        line: "account",
        body: `Your teen Sam asked for a Ruken feed that learns what they like. Say yes or no: ${ORIGIN}/parent/${token}`,
      },
    ]);
    const [row] = await db().parentAsk.findMany({ where: { teenUserId: id } });
    expect(row?.phoneHash).not.toContain("5550199");
    expect(row?.tokenHash).not.toBe(token);
    expect(await parents.stateOf(id)).toBe("waiting");
  });

  it("keeps one ask open at a time", async () => {
    const id = await teen();
    await askAndToken(id);
    expect(await parents.ask(id, PARENT, ORIGIN)).toBe("waiting");
    expect(texts).toHaveLength(1);
  });

  it("sends at most three texts a day, and more the next day", async () => {
    const id = await teen();
    for (let sent = 0; sent < 3; sent++) {
      await askAndToken(id);
      await parents.cancel(id);
    }
    expect(await parents.ask(id, PARENT, ORIGIN)).toBe("too-many");
    expect(texts).toHaveLength(3);
    clock.advance(24 * 60 * 60 * 1000 + 1);
    expect(await parents.ask(id, PARENT, ORIGIN)).toBe("texted");
  });

  it("two asks at once text once", async () => {
    const id = await teen();
    const both = await Promise.all([parents.ask(id, PARENT, ORIGIN), parents.ask(id, PARENT, ORIGIN)]);
    expect(both.sort()).toEqual(["texted", "waiting"]);
    expect(texts).toHaveLength(1);
  });

  it("refuses a name that is not a name, and a number that is not a number, before anything is kept", async () => {
    const id = await teen();
    expect(await parents.ask(id, { ...PARENT, name: "see https://x.test" }, ORIGIN)).toBe("bad-name");
    expect(await parents.ask(id, { ...PARENT, phone: "12" }, ORIGIN)).toBe("bad-number");
    expect(await parents.ask(id, { ...PARENT, country: "GB" }, ORIGIN)).toBe("bad-number");
    expect(await db().parentAsk.count({ where: { teenUserId: id } })).toBe(0);
    expect(nameOf("  Mary   Jo ")).toBe("Mary Jo");
    expect(nameOf("Zoë-Ann O'Neil")).toBe("Zoë-Ann O'Neil");
    expect(nameOf("Sam 2")).toBeNull();
    expect(nameOf("")).toBeNull();
  });

  it("ends an ask whose text could not go", async () => {
    const id = await teen();
    textsGo = false;
    expect(await parents.ask(id, PARENT, ORIGIN)).toBe("not-sent");
    expect(await parents.stateOf(id)).toBe("none");
  });

  it("refuses the teen's own number, and any number on an account that is not a known adult's, texting nothing", async () => {
    const id = await teen();
    await db().user.update({ where: { id }, data: { phoneNumber: "+13125550101" } });
    expect(await parents.ask(id, { ...PARENT, phone: "312 555 0101" }, ORIGIN)).toBe("own-number");
    const other = await teen();
    await db().user.update({ where: { id: other }, data: { phoneNumber: "+13125550102" } });
    expect(await parents.ask(id, { ...PARENT, phone: "312 555 0102" }, ORIGIN)).toBe("teen-number");
    const unknownAge = await createUser(db());
    await db().user.update({ where: { id: unknownAge }, data: { phoneNumber: "+13125550103" } });
    expect(await parents.ask(id, { ...PARENT, phone: "312 555 0103" }, ORIGIN)).toBe("teen-number");
    expect(await db().parentAsk.count({ where: { teenUserId: id } })).toBe(0);
    expect(texts).toHaveLength(0);
    // A parent with their own adult account is a parent.
    const adult = await createUser(db());
    await db().user.update({
      where: { id: adult },
      data: { phoneNumber: "+13125550104", adultOn: new Date("2000-01-01T00:00:00Z") },
    });
    expect(await parents.ask(id, { ...PARENT, phone: "312 555 0104" }, ORIGIN)).toBe("texted");
  });

  it("texts one number only so often a day, from every teen together", async () => {
    perNumberADay = 2;
    const busy = { ...PARENT, phone: "312 555 0177" };
    for (let sent = 0; sent < 2; sent++) expect(await parents.ask(await teen(), busy, ORIGIN)).toBe("texted");
    const third = await teen();
    expect(await parents.ask(third, busy, ORIGIN)).toBe("number-busy");
    expect(await db().parentAsk.count({ where: { teenUserId: third } })).toBe(0);
    expect(texts).toHaveLength(2);
    clock.advance(24 * 60 * 60 * 1000 + 1);
    expect(await parents.ask(third, busy, ORIGIN)).toBe("texted");
  });

  it("reads the per-number limit from its secret, and anything out of shape is the stand-in", () => {
    const lines: string[] = [];
    const log = (line: string) => lines.push(line);
    expect(readParentAskLimits('{"perNumberADay":4}', log)).toEqual({ perNumberADay: 4 });
    expect(readParentAskLimits(undefined, log)).toEqual(STAND_IN_PARENT_ASK_LIMITS);
    expect(readParentAskLimits("not json", log)).toEqual(STAND_IN_PARENT_ASK_LIMITS);
    expect(readParentAskLimits('{"perNumberADay":0}', log)).toEqual(STAND_IN_PARENT_ASK_LIMITS);
    expect(lines).toHaveLength(2);
    expect(lines.join(" ")).not.toMatch(/\d/);
  });

  it("is not for an adult", async () => {
    const id = await createUser(db());
    await db().user.update({ where: { id }, data: { adultOn: new Date("2010-01-01T00:00:00Z") } });
    expect(await parents.ask(id, PARENT, ORIGIN)).toBe("adult");
    expect(texts).toHaveLength(0);
  });

  it("ends after five days unanswered, and its link says so", async () => {
    const id = await teen();
    const token = await askAndToken(id);
    clock.advance(5 * 24 * 60 * 60 * 1000);
    expect(await parents.stateOf(id)).toBe("none");
    expect(await parents.pageOf(token)).toEqual({ kind: "ended" });
    expect(await parents.answer(token, "yes")).toEqual({ kind: "ended" });
    expect(await asking(id)).toEqual({ kind: "crowd" });
  });

  it("cancelled, its link says it has ended and Yes changes nothing", async () => {
    const id = await teen();
    const token = await askAndToken(id);
    await parents.cancel(id);
    expect(await parents.answer(token, "yes")).toEqual({ kind: "ended" });
    expect(await taste.learningOf(id)).toBe("locked");
  });

  it("a link Ruken never made shows an ended ask", async () => {
    expect(await parents.pageOf("made-up")).toEqual({ kind: "ended" });
    expect(await parents.answer("made-up", "yes")).toEqual({ kind: "ended" });
  });
});

describe("the parent's answer", () => {
  it("Yes turns on the full feed at once, and Turn it off returns the calm feed and forgets what it learned", async () => {
    const id = await teen();
    const token = await askAndToken(id);
    expect(await asking(id)).toEqual({ kind: "crowd" });
    expect(await parents.answer(token, "yes")).toEqual({ kind: "yes", held: true });
    expect(await taste.learningOf(id)).toBe("on");
    expect(await asking(id)).toEqual({ kind: "full", id });
    // A second press of Yes changes nothing.
    expect(await parents.answer(token, "yes")).toEqual({ kind: "yes", held: true });
    expect(await parents.ask(id, PARENT, ORIGIN)).toBe("has-yes");

    expect(await taste.add(id, "more", "genre", "puzzle")).toBe("added");
    expect(await parents.answer(token, "off")).toEqual({ kind: "off" });
    expect(await taste.learningOf(id)).toBe("locked");
    expect(await asking(id)).toEqual({ kind: "crowd" });
    expect(await db().feedTaste.count({ where: { userId: id } })).toBe(0);
    expect(await parents.pageOf(token)).toEqual({ kind: "off" });
    // The teen may ask again.
    expect(await parents.ask(id, PARENT, ORIGIN)).toBe("texted");
  });

  it("No keeps the calm feed; the teen may ask another parent, never the same one again", async () => {
    const id = await teen();
    const token = await askAndToken(id);
    expect(await parents.answer(token, "no")).toEqual({ kind: "no" });
    expect(await parents.answer(token, "yes")).toEqual({ kind: "no" });
    expect(await taste.learningOf(id)).toBe("locked");
    expect(await parents.ask(id, PARENT, ORIGIN)).toBe("said-no");
    expect(await parents.ask(id, { ...PARENT, phone: "312 555 0198" }, ORIGIN)).toBe("texted");
    expect(texts).toHaveLength(2);
  });

  it("with teenPersonal off, a yes is kept and the page thanks the parent, but the teen stays the crowd", async () => {
    teenPersonal = false;
    const id = await teen();
    const token = await askAndToken(id);
    expect(await parents.answer(token, "yes")).toEqual({ kind: "yes", held: false });
    expect(await db().parentAsk.count({ where: { teenUserId: id, answer: "yes" } })).toBe(1);
    expect(await asking(id)).toEqual({ kind: "crowd" });
    // Nothing is kept about them either: Your feed stays locked, so no chip can be added.
    expect(await taste.learningOf(id)).toBe("locked");
    expect(await taste.add(id, "more", "genre", "puzzle")).toBe("not-learning");
    expect(await parents.stateOf(id)).toBe("yes");
    teenPersonal = true;
    expect(await taste.learningOf(id)).toBe("on");
  });

  it("Learn from what I do off is the crowd for a teen with a yes", async () => {
    const id = await teen();
    await parents.answer(await askAndToken(id), "yes");
    expect(await taste.setLearning(id, false)).toBe("done");
    expect(await asking(id)).toEqual({ kind: "crowd" });
  });
});
