// Every mail Ruken sends goes through the Mailer, never straight to a mail service, so a test can
// capture the mail and the mail service can change without touching sign-in.

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface Mailer {
  /** Sends the message. False when MAIL_ALLOWLIST kept it from being sent. */
  send(message: MailMessage): Promise<boolean>;
}

export interface ResendMailerOptions {
  /** RESEND_API_KEY. */
  apiKey: string;
  from: string;
  /**
   * MAIL_ALLOWLIST: comma-separated addresses. When set, only these get mail, so a test environment
   * with real-looking accounts cannot email strangers. Unset or empty sends to anyone.
   */
  allowlist: string | undefined;
  /** Left out, the global `fetch`. A test passes its own, so nothing goes over the network. */
  fetch?: typeof fetch;
}

/**
 * A failed send. `code` names the service and `responseCode` is its HTTP status, which is all a log
 * needs: the service's own answer can name the address, so it is never kept.
 */
export class MailError extends Error {
  readonly code: string;
  readonly responseCode: number;

  constructor(message: string, code: string, responseCode: number) {
    super(message);
    this.name = "MailError";
    this.code = code;
    this.responseCode = responseCode;
  }
}

/**
 * Sends mail through Resend's HTTP API (https://resend.com/docs/api-reference/emails/send-email). A
 * Worker cannot open an SMTP connection, and one `fetch` needs no library.
 */
export function createResendMailer(options: ResendMailerOptions): Mailer {
  const allowed = parseAllowlist(options.allowlist);
  // Kept in a constant and called as a plain function: Workers refuse a `fetch` called as a method of
  // another object ("Illegal invocation").
  const send = options.fetch ?? fetch;
  return {
    async send(message) {
      if (allowed !== null && !allowed.has(message.to.trim().toLowerCase())) return false;
      const answer = await send("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${options.apiKey}`,
          "Content-Type": "application/json",
          // Resend answers 403 ("error 1010") to a request with no User-Agent.
          "User-Agent": "ruken",
        },
        body: JSON.stringify({
          from: options.from,
          to: [message.to],
          subject: message.subject,
          text: message.text,
        }),
      });
      if (!answer.ok)
        throw new MailError(`Resend answered ${String(answer.status)}`, "RESEND", answer.status);
      return true;
    },
  };
}

/**
 * What a failed send is logged as: the error's code and the service's reply status, like "RESEND 422".
 * Never the error's message from a library: it can carry the service's reply, and a refused recipient's
 * reply names the address. Logs carry no email addresses.
 */
export function mailFailureCode(error: unknown): string {
  if (typeof error !== "object" || error === null) return "unknown error";
  const { code, responseCode } = error as { code?: unknown; responseCode?: unknown };
  const parts = [code, responseCode]
    .filter((part) => typeof part === "string" || typeof part === "number")
    .map(String);
  return parts.length === 0 ? "unknown error" : parts.join(" ");
}

function parseAllowlist(value: string | undefined): Set<string> | null {
  const addresses = (value ?? "")
    .split(",")
    .map((address) => address.trim().toLowerCase())
    .filter((address) => address !== "");
  return addresses.length === 0 ? null : new Set(addresses);
}
