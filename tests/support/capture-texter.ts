import type { TextMessage, Texter } from "../../src/lib/server/text.ts";

type Hands = "yes" | "no" | "cannot_say";

/**
 * A Texter that sends nothing and keeps what it was given, so a test can read the texts. `hands` is what
 * `changedHands` answers for a number; a number not in it is "cannot_say", as Twilio is outside the US.
 */
export function createCaptureTexter(): Texter & { sent: TextMessage[]; hands: Map<string, Hands> } {
  const sent: TextMessage[] = [];
  const hands = new Map<string, Hands>();
  return {
    sent,
    hands,
    send(message) {
      sent.push(message);
      return Promise.resolve({ sent: true, providerId: `SM-test-${String(sent.length)}` });
    },
    changedHands(number) {
      return Promise.resolve(hands.get(number) ?? "cannot_say");
    },
  };
}
