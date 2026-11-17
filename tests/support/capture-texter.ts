import type { TextMessage, Texter } from "../../src/lib/server/text.ts";

type Hands = "yes" | "no" | "cannot_say";

/** A Texter that sends nothing and keeps what it was given, so a test can read the texts and the codes. */
export function createCaptureTexter(): Texter & {
  sent: TextMessage[];
  codes: { to: string; code: string }[];
  used: string[];
  hands: Map<string, Hands>;
} {
  const sent: TextMessage[] = [];
  const codes: { to: string; code: string }[] = [];
  const used: string[] = [];
  const hands = new Map<string, Hands>();
  return {
    sent,
    codes,
    used,
    hands,
    send(message) {
      sent.push(message);
      return Promise.resolve({ sent: true, providerId: `SM-test-${String(sent.length)}` });
    },
    sendCode(number, code) {
      codes.push({ to: number, code });
      return Promise.resolve({ sent: true, providerId: `VE-test-${String(codes.length)}` });
    },
    codeUsed(number) {
      used.push(number);
      return Promise.resolve();
    },
    changedHands(number) {
      return Promise.resolve(hands.get(number) ?? "cannot_say");
    },
  };
}
