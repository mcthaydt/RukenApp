import nodemailer, { type Transporter } from "nodemailer";

// Every mail Ruken sends goes through the Mailer, never straight to an SMTP library, so a test can
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

export interface SmtpMailerOptions {
  from: string;
  /**
   * MAIL_ALLOWLIST: comma-separated addresses. When set, only these get mail, so a test environment
   * with real-looking accounts cannot email strangers. Unset or empty sends to anyone.
   */
  allowlist: string | undefined;
  /** A nodemailer transport, made from SMTP_URL with `smtpTransport`. */
  transport: Transporter;
}

export interface ResendMailerOptions {
  apiKey: string;
  from: string;
  allowlist: string | undefined;
  /** Left out, the global `fetch`. */
  fetch?: typeof fetch;
}

/** A failed send: the service's name as the code and its HTTP status as the response code. */
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

export function createResendMailer(options: ResendMailerOptions): Mailer {
  throw new Error(`not built yet: ${options.from}`);
}

export function createSmtpMailer(options: SmtpMailerOptions): Mailer {
  const allowed = parseAllowlist(options.allowlist);
  return {
    async send(message) {
      if (allowed !== null && !allowed.has(message.to.trim().toLowerCase())) return false;
      await options.transport.sendMail({
        from: options.from,
        to: message.to,
        subject: message.subject,
        text: message.text,
      });
      return true;
    },
  };
}

/**
 * A transport for SMTP_URL (`smtps://user:password@host:465` when deployed). The address `test:`
 * gives nodemailer's JSON transport, which builds the message and sends nothing: CI's browser
 * journeys use it, because they have no mail server.
 */
export function smtpTransport(smtpUrl: string): Transporter {
  if (smtpUrl === "test:") return nodemailer.createTransport({ jsonTransport: true });
  return nodemailer.createTransport(smtpUrl);
}

/**
 * What a failed send is logged as: nodemailer's error code and the mail server's reply code, like
 * "EENVELOPE 550". Never the error's message: nodemailer adds the server's reply to it, and a refused
 * recipient's reply names the address. Logs carry no email addresses.
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
