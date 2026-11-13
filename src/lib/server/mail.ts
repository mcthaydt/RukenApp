import type { Transporter } from "nodemailer";

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
  /** MAIL_ALLOWLIST: comma-separated addresses. When set, only these get mail. */
  allowlist: string | undefined;
  /** A nodemailer transport, made from SMTP_URL with `smtpTransport`. */
  transport: Transporter;
}

export function createSmtpMailer(options: SmtpMailerOptions): Mailer {
  throw new Error(`not built yet (${typeof options})`);
}

/** A transport for SMTP_URL. */
export function smtpTransport(smtpUrl: string): Transporter {
  throw new Error(`not built yet (${smtpUrl})`);
}

/** What a failed send is logged as: nodemailer's error code and the server's reply code. Never the message. */
export function mailFailureCode(error: unknown): string {
  throw new Error(`not built yet (${typeof error})`);
}
