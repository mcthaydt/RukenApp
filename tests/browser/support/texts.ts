import { expect } from "@playwright/test";

// Reads the texts and codes the site sent, from the stand-in (tests/browser/support/fake-twilio-server.ts). The site
// sends some texts after it has answered, so a journey waits until the text is there: it asks again, and gives up with
// the text missing named, never after a fixed pause.

/** The stand-in Twilio. */
export const TWILIO_URL = "http://127.0.0.1:12114";

export interface Text {
  to: string;
  body: string;
  line: string;
}

export interface Code {
  to: string;
  code: string;
  status: string;
}

async function textsKeptFor(number: string): Promise<Text[]> {
  const answer = await fetch(`${TWILIO_URL}/texts?to=${encodeURIComponent(number)}`);
  const kept: Text[] = await answer.json();
  return kept;
}

async function codesKeptFor(number: string): Promise<Code[]> {
  const answer = await fetch(`${TWILIO_URL}/codes?to=${encodeURIComponent(number)}`);
  const kept: Code[] = await answer.json();
  return kept;
}

/** The newest text to this number that starts with these words. Waits for it; fails if it never arrives. */
export async function textTo(number: string, starts: string): Promise<Text> {
  let found: Text | undefined;
  await expect
    .poll(
      async () => {
        found = (await textsKeptFor(number)).findLast((text) => text.body.startsWith(starts));
        return found !== undefined;
      },
      { message: `no text to ${number} starting "${starts}"`, timeout: 15_000 },
    )
    .toBe(true);
  if (found === undefined) throw new Error("unreachable: the poll passed with no text");
  return found;
}

/** How many texts to this number start with these words, now. For a journey that says no text was sent. */
export async function countTextsTo(number: string, starts: string): Promise<number> {
  return (await textsKeptFor(number)).filter((text) => text.body.startsWith(starts)).length;
}

/** The newest code still waiting to be used, for this number. Waits for it; fails if it never arrives. */
export async function codeTo(number: string): Promise<string> {
  let found: Code | undefined;
  await expect
    .poll(
      async () => {
        found = (await codesKeptFor(number)).findLast((code) => code.status === "pending");
        return found !== undefined;
      },
      { message: `no code waiting for ${number}`, timeout: 15_000 },
    )
    .toBe(true);
  if (found === undefined) throw new Error("unreachable: the poll passed with no code");
  return found.code;
}

/** How many codes were sent to this number, now. For a journey that says no code was sent. */
export async function countCodesTo(number: string): Promise<number> {
  return (await codesKeptFor(number)).length;
}

/** Every code sent to this number so far, oldest first, with the status the stand-in holds for it. */
export function codesKept(number: string): Promise<Code[]> {
  return codesKeptFor(number);
}

/** Tells the stand-in to answer the next text or code started for this number with Twilio's 500, once. */
export async function failNextTextTo(number: string): Promise<void> {
  await fetch(`${TWILIO_URL}/test/fail`, { method: "POST", body: JSON.stringify({ to: number }) });
}

/** Tells the stand-in what Twilio's number check says about this number: it changed hands, or not, or cannot say. */
export async function sayChangedHands(number: string, answer: "yes" | "no" | "no_data_available"): Promise<void> {
  await fetch(`${TWILIO_URL}/test/hands`, { method: "POST", body: JSON.stringify({ number, answer }) });
}
