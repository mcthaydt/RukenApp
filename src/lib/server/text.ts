// Every text Ruken sends goes through the Texter, never straight to Twilio, so a test can capture the text and the
// texting company can change in this file alone. It sits beside the Mailer (mail.ts).

/** Which of the two numbers a text comes from: sign-in codes, account notices and help, or everything else. */
export type TextLine = "account" | "news";

export interface TextMessage {
  to: string;
  line: TextLine;
  body: string;
}

export type TextResult = { sent: true; providerId: string } | { sent: false; why: "allowlist" | "made_up" };

export interface Texter {
  send(message: TextMessage): Promise<TextResult>;
  /** Whether the number changed hands since that day, where Twilio can say. Never throws. */
  changedHands(number: string, since: Date): Promise<"yes" | "no" | "cannot_say">;
}

export interface TwilioTexterOptions {
  accountSid: string;
  /** An API key and its secret, not the account's auth token. */
  apiKey: string;
  apiSecret: string;
  /** The two Messaging Services, by their MG… ids. */
  services: Record<TextLine, string>;
  /** Where Twilio posts a text's delivery report: <site>/webhooks/twilio. */
  statusCallback: string;
  /**
   * TEXT_ALLOWLIST: comma-separated numbers. When set, only these get texts, so a test environment with
   * real-looking accounts cannot text strangers. Unset or empty sends to anyone.
   */
  allowlist: string | undefined;
  /** Where Twilio's API and lookup are. Left out, Twilio's own. The journeys point both at a stand-in on this machine. */
  apiBase?: string;
  lookupBase?: string;
  /** Left out, the global `fetch`. A test passes its own, so nothing goes over the network. */
  fetch?: typeof fetch;
}

/**
 * A failed send. `code` names the service, `responseCode` is its HTTP status and `twilioCode` its own error code:
 * all a log needs. The answer's text can name the number, so it is never kept.
 */
export class TextError extends Error {
  readonly code = "TWILIO";
  readonly responseCode: number;
  readonly twilioCode: number | null;

  constructor(message: string, responseCode: number, twilioCode: number | null) {
    super(message);
    this.name = "TextError";
    this.responseCode = responseCode;
    this.twilioCode = twilioCode;
  }
}

/** North American numbers `+1 ··· 555 01··` are kept for fiction: the made-up accounts get them and nothing texts them. */
export function isMadeUpNumber(number: string): boolean {
  return /^\+1\d{3}55501\d\d$/.test(number);
}

/**
 * Sends texts through Twilio's HTTP API (twilio.com/docs/messaging/api/message-resource). A Worker has no Twilio
 * library to lean on, and one `fetch` needs none.
 */
export function createTwilioTexter(options: TwilioTexterOptions): Texter {
  const allowed = parseAllowlist(options.allowlist);
  // Kept in a constant and called as a plain function: Workers refuse a `fetch` called as a method of
  // another object ("Illegal invocation").
  const request = options.fetch ?? fetch;
  const authorization = `Basic ${btoa(`${options.apiKey}:${options.apiSecret}`)}`;
  const messagesUrl = `${options.apiBase ?? "https://api.twilio.com"}/2010-04-01/Accounts/${encodeURIComponent(options.accountSid)}/Messages.json`;
  const lookupBase = options.lookupBase ?? "https://lookups.twilio.com";

  return {
    async send(message) {
      if (isMadeUpNumber(message.to)) return { sent: false, why: "made_up" };
      if (allowed !== null && !allowed.has(message.to.trim())) return { sent: false, why: "allowlist" };
      const answer = await request(messagesUrl, {
        method: "POST",
        headers: { Authorization: authorization, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          To: message.to,
          Body: message.body,
          MessagingServiceSid: options.services[message.line],
          StatusCallback: options.statusCallback,
        }).toString(),
      });
      const body = await answer.json().catch(() => null);
      if (!answer.ok) {
        throw new TextError(`Twilio answered ${String(answer.status)}`, answer.status, twilioCodeOf(body));
      }
      const sid = typeof body === "object" && body !== null ? (body as { sid?: unknown }).sid : undefined;
      if (typeof sid !== "string")
        throw new TextError("Twilio's answer held no message id", answer.status, null);
      return { sent: true, providerId: sid };
    },

    async changedHands(number, since) {
      // The check covers US numbers only.
      if (!number.startsWith("+1")) return "cannot_say";
      const day = since.toISOString().slice(0, 10).replaceAll("-", "");
      const url = `${lookupBase}/v2/PhoneNumbers/${encodeURIComponent(number)}?Fields=reassigned_number&LastVerifiedDate=${day}`;
      try {
        const answer = await request(url, { method: "GET", headers: { Authorization: authorization } });
        if (!answer.ok) return "cannot_say";
        const body: unknown = await answer.json();
        const verdict = (body as { reassigned_number?: { is_number_reassigned?: unknown } } | null)
          ?.reassigned_number?.is_number_reassigned;
        return verdict === "yes" || verdict === "no" ? verdict : "cannot_say";
      } catch {
        return "cannot_say";
      }
    },
  };
}

/**
 * What a failed send is logged as: the service, its HTTP status and its error code, like "TWILIO 400 21610".
 * Never the error's message: a refused number's reply names the number. Logs carry no phone numbers and no codes.
 */
export function textFailureCode(error: unknown): string {
  if (typeof error !== "object" || error === null) return "unknown error";
  const { code, responseCode, twilioCode } = error as {
    code?: unknown;
    responseCode?: unknown;
    twilioCode?: unknown;
  };
  const parts = [code, responseCode, twilioCode]
    .filter((part) => typeof part === "string" || typeof part === "number")
    .map(String);
  return parts.length === 0 ? "unknown error" : parts.join(" ");
}

function twilioCodeOf(body: unknown): number | null {
  const code = typeof body === "object" && body !== null ? (body as { code?: unknown }).code : undefined;
  return typeof code === "number" ? code : null;
}

function parseAllowlist(value: string | undefined): Set<string> | null {
  const numbers = (value ?? "")
    .split(",")
    .map((number) => number.trim())
    .filter((number) => number !== "");
  return numbers.length === 0 ? null : new Set(numbers);
}
