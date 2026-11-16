import { expect } from "@playwright/test";

// Reads the texts the site sent, and sends it texts, through the stand-in (tests/browser/support/fake-twilio-server.ts).
// The site texts after it has answered, so a journey waits until the text is there: it asks again, and gives up with
// the text missing named, never after a fixed pause.

/** The stand-in texting service. */
const TEXT_URL = "http://127.0.0.1:12114";

export interface Text {
  to: string;
  body: string;
  service: string;
}

async function textsKeptFor(number: string): Promise<Text[]> {
  const answer = await fetch(`${TEXT_URL}/texts?to=${encodeURIComponent(number)}`);
  const kept: Text[] = await answer.json();
  return kept;
}

/** The newest text to this number that starts with these words. Waits for it to arrive; fails if it never does. */
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
export async function countTextsTo(number: string, starts = ""): Promise<number> {
  return (await textsKeptFor(number)).filter((text) => text.body.startsWith(starts)).length;
}

/** The six-digit code in a text. */
export function codeIn(text: Text): string {
  const code = /\b(\d{6})\b/.exec(text.body)?.[1];
  if (code === undefined) throw new Error(`the text "${text.body}" holds no code`);
  return code;
}

/** A text from a person to Ruken, or `extra` fields of a delivery report, posted to the site's webhook as Twilio does. */
export async function textIn(
  from: string,
  body: string,
  extra: Record<string, string> = {},
): Promise<number> {
  const fields = { MessageSid: `SM-in-${String(Date.now())}`, From: from, Body: body, ...extra };
  const answer = await fetch(`${TEXT_URL}/test/inbound`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ fields }),
  });
  const result: { status: number } = await answer.json();
  return result.status;
}

/** Tells the stand-in what the changed-hands check says for a number. */
export async function setChangedHands(
  number: string,
  answer: "yes" | "no" | "no_data_available",
): Promise<void> {
  await fetch(`${TEXT_URL}/test/hands`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ number, answer }),
  });
}
