import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  resetChannel,
  resetCodeMessage,
  setMoneyCheck,
  userHasMoney,
  type ResetChannelDeps,
} from "../../../src/features/accounts/changed-hands.ts";
import type { PrismaClient } from "../../../src/lib/server/db.ts";
import { createCaptureTexter } from "../../support/capture-texter.ts";
import { startTestDatabase, type TestDatabase } from "../../support/database.ts";

// Where a forgot-password code goes: by text, to the email a member pays with, or nowhere (held for help). The
// rule is the plan's: a number Twilio says changed hands, or one it cannot speak for where money is involved, never
// gets a code that could take over someone else's paid account.

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

let made = 0;

async function makeUser(options: { paperEmail?: string; confirmedAt?: Date } = {}) {
  made += 1;
  const phoneNumber = `+1312555${String(1000 + made)}`;
  const user = await db().user.create({
    data: {
      name: "Player",
      email: `u${String(made)}@phone.ruken.invalid`,
      phoneNumber,
      paperEmail: options.paperEmail ?? null,
      phoneConfirmedAt: options.confirmedAt ?? null,
    },
  });
  return { id: user.id, phoneNumber, paperEmail: user.paperEmail };
}

function depsWith(hands: "yes" | "no" | "cannot_say", money: boolean) {
  const texter = createCaptureTexter();
  const asked: { number: string; since: Date }[] = [];
  const deps: ResetChannelDeps = {
    db: db(),
    texter: {
      ...texter,
      changedHands: (number, since) => {
        asked.push({ number, since });
        return Promise.resolve(hands);
      },
    },
    hasMoney: () => Promise.resolve(money),
  };
  return { deps, asked };
}

describe("resetChannel", () => {
  it("is text when Twilio says the number did not change hands", async () => {
    const user = await makeUser({ paperEmail: "pay@example.test" });
    expect(await resetChannel(depsWith("no", true).deps, user)).toBe("text");
  });

  it("is text when Twilio cannot say and the account never paid and was never paid", async () => {
    const user = await makeUser();
    expect(await resetChannel(depsWith("cannot_say", false).deps, user)).toBe("text");
  });

  it("is email when Twilio cannot say and money is involved, if an email is kept", async () => {
    const user = await makeUser({ paperEmail: "pay@example.test" });
    expect(await resetChannel(depsWith("cannot_say", true).deps, user)).toBe("email");
  });

  it("is help when Twilio cannot say, money is involved and there is no email to send to", async () => {
    const user = await makeUser();
    expect(await resetChannel(depsWith("cannot_say", true).deps, user)).toBe("help");
  });

  it("is email when the number changed hands, if an email is kept, and help if not, with or without money", async () => {
    const withEmail = await makeUser({ paperEmail: "pay@example.test" });
    const without = await makeUser();
    expect(await resetChannel(depsWith("yes", false).deps, withEmail)).toBe("email");
    expect(await resetChannel(depsWith("yes", false).deps, without)).toBe("help");
    expect(await resetChannel(depsWith("yes", true).deps, without)).toBe("help");
  });

  it("asks Twilio about the number since the newer of the newest session and the number's last confirmation", async () => {
    const user = await makeUser({ confirmedAt: new Date("2026-03-01T00:00:00Z") });
    await db().session.create({
      data: { token: `t-${user.id}-1`, userId: user.id, expiresAt: new Date("2030-01-01"), createdAt: new Date("2026-02-01T00:00:00Z") },
    });
    const first = depsWith("no", false);
    await resetChannel(first.deps, user);
    expect(first.asked).toEqual([{ number: user.phoneNumber, since: new Date("2026-03-01T00:00:00Z") }]);

    await db().session.create({
      data: { token: `t-${user.id}-2`, userId: user.id, expiresAt: new Date("2030-01-01"), createdAt: new Date("2026-04-01T00:00:00Z") },
    });
    const second = depsWith("no", false);
    await resetChannel(second.deps, user);
    expect(second.asked[0]?.since).toEqual(new Date("2026-04-01T00:00:00Z"));
  });

  it("falls back to when the account was made, for an account with neither", async () => {
    const user = await makeUser();
    const row = await db().user.findUniqueOrThrow({ where: { id: user.id } });
    const { deps, asked } = depsWith("no", false);
    await resetChannel(deps, user);
    expect(asked[0]?.since).toEqual(row.createdAt);
  });
});

describe("the money check", () => {
  it("answers true until the site sets it, so a reset never goes by text on a guess", async () => {
    expect(await userHasMoney("someone")).toBe(true);
    setMoneyCheck((id) => Promise.resolve(id === "paid"));
    expect(await userHasMoney("paid")).toBe(true);
    expect(await userHasMoney("never")).toBe(false);
    setMoneyCheck(() => Promise.resolve(true));
  });
});

describe("the reset code's email", () => {
  it("carries the code and how long it lasts, and nothing else of the account", () => {
    expect(resetCodeMessage("pay@example.test", "482913")).toEqual({
      to: "pay@example.test",
      subject: "Your Ruken code",
      text: "Your code to choose a new password is 482913. It works for 10 minutes.",
    });
  });
});
