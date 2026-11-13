import type { MailMessage } from "../../lib/server/mail.ts";

export function verificationMessage(to: string, url: string): MailMessage {
  throw new Error(`not built yet (${to} ${url})`);
}

export function passwordResetMessage(to: string, url: string): MailMessage {
  throw new Error(`not built yet (${to} ${url})`);
}

export function passwordChangedMessage(to: string): MailMessage {
  throw new Error(`not built yet (${to})`);
}

export function signInPausedMessage(to: string): MailMessage {
  throw new Error(`not built yet (${to})`);
}
