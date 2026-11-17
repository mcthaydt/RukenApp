import { expect, test } from "@playwright/test";
import { createTwilioTexter } from "../../src/lib/server/text.ts";
import { codeTo, countCodesTo, textTo, TWILIO_URL } from "./support/texts.ts";

// The stand-in Twilio answers a send as Twilio does, and the Texter talks to it through the same code the real site
// uses. No page is opened: this proves the stand-in and the helpers that the sign-in journeys will rest on.

function texter() {
  return createTwilioTexter({
    accountSid: "AC1",
    apiKey: "SK1",
    apiSecret: "secret",
    services: { account: "MG-account", news: "MG-news" },
    verifyService: "VA1",
    allowlist: undefined,
    apiBase: TWILIO_URL,
    verifyBase: TWILIO_URL,
    lookupBase: TWILIO_URL,
  });
}

/** A number no other test uses, so the stand-in's memory never mixes two tests up. */
function newNumber(): string {
  return `+1415${String(Math.floor(1_000_000 + Math.random() * 8_999_999))}`;
}

test("a text the Texter sends is read back with its words", async () => {
  const number = newNumber();
  const result = await texter().send({ to: number, line: "account", body: "Ruken: hello there" });

  expect(result.sent).toBe(true);
  const text = await textTo(number, "Ruken: hello");
  expect(text).toMatchObject({ to: number, body: "Ruken: hello there", line: "account" });
});

test("a code handed to sendCode is read back, and a second one replaces the first", async () => {
  const number = newNumber();
  const twilio = texter();

  await twilio.sendCode(number, "111111");
  expect(await codeTo(number)).toBe("111111");

  await twilio.sendCode(number, "222222");
  expect(await codeTo(number)).toBe("222222");
  expect(await countCodesTo(number)).toBe(2);

  const kept: { code: string; status: string }[] = await (
    await fetch(`${TWILIO_URL}/codes?to=${encodeURIComponent(number)}`)
  ).json();
  expect(kept.map((code) => [code.code, code.status])).toEqual([
    ["111111", "canceled"],
    ["222222", "pending"],
  ]);

  await twilio.codeUsed(number);
  const after: { status: string }[] = await (
    await fetch(`${TWILIO_URL}/codes?to=${encodeURIComponent(number)}`)
  ).json();
  expect(after.map((code) => code.status)).toEqual(["canceled", "approved"]);
});

test("the next send fails with 500 when the stand-in is told to, then works again", async () => {
  const number = newNumber();
  await fetch(`${TWILIO_URL}/test/fail`, { method: "POST" });

  await expect(texter().sendCode(number, "333333")).rejects.toMatchObject({ responseCode: 500 });
  expect((await texter().sendCode(number, "333333")).sent).toBe(true);
});

test("the stand-in says whether a number changed hands, from what it was told", async () => {
  const number = newNumber();
  expect(await texter().changedHands(number, new Date("2026-11-01T00:00:00Z"))).toBe("cannot_say");

  await fetch(`${TWILIO_URL}/test/hands`, {
    method: "POST",
    body: JSON.stringify({ number, answer: "yes" }),
  });
  expect(await texter().changedHands(number, new Date("2026-11-01T00:00:00Z"))).toBe("yes");
});

test("a code without a CustomCode is refused, so a Texter that forgot the code fails loudly", async () => {
  const answer = await fetch(`${TWILIO_URL}/v2/Services/VA1/Verifications`, {
    method: "POST",
    body: new URLSearchParams({ To: newNumber(), Channel: "sms" }),
  });
  expect(answer.status).toBe(400);
  const refused: { code: number } = await answer.json();
  expect(refused.code).toBe(60200);
});
