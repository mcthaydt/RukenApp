import type { MailMessage, Mailer } from "../../src/lib/server/mail.ts";

/** A Mailer that sends nothing and keeps what it was given, so a test can read the mail. */
export function createCaptureMailer(): Mailer & { sent: MailMessage[] } {
  const sent: MailMessage[] = [];
  return {
    sent,
    send(message) {
      sent.push(message);
      return Promise.resolve(true);
    },
  };
}
