// A press that needs the cookie yes, asked for in place (learned-feed spec, G5): the screen's own cookie card opens,
// says what the yes is for, and on "I agree" the same script makes the press. Nothing goes through an address, so no
// link from anywhere can make a press the person did not make. Browser-only state; it is gone on a reload.

export type AskReason = "like" | "save" | "repost";

interface Ask {
  reason: AskReason | null;
  then: (() => void) | null;
}

export const consentAsk: Ask = $state({ reason: null, then: null });

/** Opens the cookie card for this reason; `then` runs once the person says yes. */
export function askForYes(reason: AskReason, then: () => void): void {
  consentAsk.reason = reason;
  consentAsk.then = then;
}

/** The answer: "I agree" runs the waiting press, "Not now" drops it. */
export function answerAsk(agreed: boolean): void {
  const then = consentAsk.then;
  consentAsk.reason = null;
  consentAsk.then = null;
  if (agreed) then?.();
}
