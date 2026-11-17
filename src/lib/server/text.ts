// Every text Ruken sends goes through the Texter, never straight to Twilio, so a test can capture the text
// and the text service can change without touching sign-in. It sits beside the Mailer (mail.ts).

export type TextLine = "account" | "news";

export interface TextMessage {
  to: string;
  line: TextLine;
  body: string;
}

export type TextResult = { sent: true; providerId: string } | { sent: false; why: "allowlist" | "made_up" };

export interface Texter {
  send(message: TextMessage): Promise<TextResult>;
  /** Texts a sign-in code through Twilio Verify. The code is ours: better-auth made it and will check it. */
  sendCode(number: string, code: string): Promise<TextResult>;
  /** Tells Verify the number's code was used. Never throws. */
  codeUsed(number: string): Promise<void>;
  /** Whether the number changed hands since that day, where Twilio can say. Never throws. */
  changedHands(number: string, since: Date): Promise<"yes" | "no" | "cannot_say">;
}

export interface TwilioTexterOptions {
  accountSid: string;
  /** An API key (SK…) and its secret, not the account's auth token. */
  apiKey: string;
  apiSecret: string;
  /** The two Messaging Services (MG…), one for each line. */
  services: Record<TextLine, string>;
  /** The Verify service (VA…) that carries sign-in codes. */
  verifyService: string;
  /** Where Twilio reports a text's delivery. Set from the branch that builds that address. */
  statusCallback?: string;
  /**
   * TEXT_ALLOWLIST: comma-separated numbers. When set, only these are texted, so a test environment with
   * real-looking accounts cannot text strangers. Unset or empty texts anyone.
   */
  allowlist: string | undefined;
  /** Where Twilio's APIs are. Left out, Twilio's own. The journeys point them at a stand-in on this machine. */
  apiBase?: string;
  lookupBase?: string;
  verifyBase?: string;
  /** Left out, the global `fetch`. A test passes its own, so nothing goes over the network. */
  fetch?: typeof fetch;
  /** Where `codeUsed`'s swallowed failures go, as `textFailureCode`. */
  log?: (line: string) => void;
}

/**
 * A failed send. `responseCode` is Twilio's HTTP status and `twilioCode` the `code` in its answer, which is all a
 * log needs: Twilio's own words can name the number.
 */
export class TextError extends Error {
  readonly code = "TWILIO";
  readonly responseCode: number;
  readonly twilioCode: number | null;

  constructor(responseCode: number, twilioCode: number | null) {
    super(`Twilio answered ${String(responseCode)}`);
    this.name = "TextError";
    this.responseCode = responseCode;
    this.twilioCode = twilioCode;
  }
}

/**
 * What a failed send is logged as, like "TWILIO 400 21610". Never an error's message: it can name the number
 * or hold the code. Logs carry no phone numbers and no codes.
 */
export function textFailureCode(error: unknown): string {
  if (!(error instanceof TextError)) return "unknown error";
  return [error.code, error.responseCode, error.twilioCode].filter((part) => part !== null).join(" ");
}

/**
 * North American numbers of the form +1 ··· 555 01·· are kept for fiction. Seeded accounts get them, and the
 * Texter never texts them. It lives here and not in a feature because `src/lib/` imports no feature.
 */
export function isMadeUpNumber(number: string): boolean {
  return /^\+1\d{3}55501\d\d$/.test(number);
}

function parseAllowlist(value: string | undefined): Set<string> | null {
  const numbers = (value ?? "")
    .split(",")
    .map((number) => number.trim())
    .filter((number) => number !== "");
  return numbers.length === 0 ? null : new Set(numbers);
}

async function twilioCodeOf(answer: Response): Promise<number | null> {
  try {
    const body: unknown = await answer.json();
    const code = (body as { code?: unknown } | null)?.code;
    return typeof code === "number" ? code : null;
  } catch {
    return null;
  }
}

async function failed(answer: Response): Promise<TextError> {
  return new TextError(answer.status, await twilioCodeOf(answer));
}

/** Texts through Twilio's HTTP API with one `fetch` each: a Worker needs no library for that. */
export function createTwilioTexter(options: TwilioTexterOptions): Texter {
  const allowed = parseAllowlist(options.allowlist);
  // Kept in a constant and called as a plain function: Workers refuse a `fetch` called as a method of
  // another object ("Illegal invocation").
  const call = options.fetch ?? fetch;
  const apiBase = options.apiBase ?? "https://api.twilio.com";
  const lookupBase = options.lookupBase ?? "https://lookups.twilio.com";
  const verifyBase = options.verifyBase ?? "https://verify.twilio.com";
  const log = options.log ?? (() => undefined);
  const authorization = `Basic ${btoa(`${options.apiKey}:${options.apiSecret}`)}`;
  const verifications = `${verifyBase}/v2/Services/${options.verifyService}/Verifications`;

  function refusal(number: string): { sent: false; why: "allowlist" | "made_up" } | null {
    if (isMadeUpNumber(number)) return { sent: false, why: "made_up" };
    if (allowed !== null && !allowed.has(number)) return { sent: false, why: "allowlist" };
    return null;
  }

  function post(url: string, fields: Record<string, string>): Promise<Response> {
    return call(url, {
      method: "POST",
      headers: { Authorization: authorization, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(fields).toString(),
    });
  }

  /** Verify takes the number where a verification's id goes. */
  const verificationOf = (number: string): string => `${verifications}/${encodeURIComponent(number)}`;

  return {
    async send(message) {
      const refused = refusal(message.to);
      if (refused !== null) return refused;
      const fields: Record<string, string> = {
        To: message.to,
        Body: message.body,
        MessagingServiceSid: options.services[message.line],
      };
      if (options.statusCallback !== undefined) fields.StatusCallback = options.statusCallback;
      const answer = await post(`${apiBase}/2010-04-01/Accounts/${options.accountSid}/Messages.json`, fields);
      if (!answer.ok) throw await failed(answer);
      const { sid }: { sid: string } = await answer.json();
      return { sent: true, providerId: sid };
    },

    async sendCode(number, code) {
      const refused = refusal(number);
      if (refused !== null) return refused;
      // A second code for the same number must replace the first, and Verify keeps the open one until it is
      // closed. A 404 only means none was open.
      const cancel = await post(verificationOf(number), { Status: "canceled" });
      if (!cancel.ok && cancel.status !== 404) throw await failed(cancel);
      const answer = await post(verifications, { To: number, Channel: "sms", CustomCode: code });
      if (!answer.ok) throw await failed(answer);
      const { sid }: { sid: string } = await answer.json();
      return { sent: true, providerId: sid };
    },

    async codeUsed(number) {
      if (refusal(number) !== null) return;
      try {
        const answer = await post(verificationOf(number), { Status: "approved" });
        // 404: no verification is open (the code went by email, or it had run out). Nothing to close.
        if (!answer.ok && answer.status !== 404) log(textFailureCode(await failed(answer)));
      } catch (error) {
        log(textFailureCode(error));
      }
    },

    async changedHands(number, since) {
      // Twilio can say only for United States numbers.
      if (!number.startsWith("+1")) return "cannot_say";
      const day = since.toISOString().slice(0, 10).replaceAll("-", "");
      const url =
        `${lookupBase}/v2/PhoneNumbers/${encodeURIComponent(number)}` +
        `?Fields=reassigned_number&LastVerifiedDate=${day}`;
      try {
        const answer = await call(url, { method: "GET", headers: { Authorization: authorization } });
        if (!answer.ok) return "cannot_say";
        const body: { reassigned_number?: { is_number_reassigned?: unknown } } = await answer.json();
        const said = body.reassigned_number?.is_number_reassigned;
        return said === "yes" || said === "no" ? said : "cannot_say";
      } catch {
        return "cannot_say";
      }
    },
  };
}
