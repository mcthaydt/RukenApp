import type { MailMessage } from "../../lib/server/mail.ts";

// The words of the mails Ruken sends. Each says what it is, gives the one link, says how long
// it lasts, and says what to do if it was not expected. Each link sits on a line of its own so a
// mail program makes it clickable.

/** The email confirmation mail, sent at sign-up. */
export function verificationMessage(to: string, url: string): MailMessage {
  return {
    to,
    subject: "Confirm your email for Ruken",
    text: [
      "Confirm your email address for your Ruken account:",
      "",
      url,
      "",
      "The link expires in 24 hours.",
      "",
      "If you didn't make an account, you can ignore this email.",
    ].join("\n"),
  };
}

/** The password reset mail. */
export function passwordResetMessage(to: string, url: string): MailMessage {
  return {
    to,
    subject: "Reset your Ruken password",
    text: [
      "Here's your link to choose a new password for Ruken:",
      "",
      url,
      "",
      "It works once and expires in an hour.",
      "",
      "If you didn't ask for it, you can ignore this email. Your password stays as it is.",
    ].join("\n"),
  };
}

/** Sent after a reset, so a person whose account someone else reset hears about it. */
export function passwordChangedMessage(to: string): MailMessage {
  return {
    to,
    subject: "Your Ruken password was changed",
    text: [
      "The password for your Ruken account was just changed. We signed you out on every device.",
      "",
      "If that was you, there's nothing to do.",
      "",
      "If it wasn't, ask for a new password link on the sign-in page right away. Then check that no one else can get into your email.",
    ].join("\n"),
  };
}

/** Sent when ten wrong passwords pause password sign-in, so the owner of the account hears about it. */
export function signInPausedMessage(to: string): MailMessage {
  return {
    to,
    subject: "Password sign-in on your Ruken account is paused",
    text: [
      "Someone tried to sign in to your Ruken account with the wrong password ten times in an hour. So we paused password sign-in for an hour.",
      "",
      'You can still choose a new password with "Forgot your password?" on the sign-in page.',
      "",
      "If that was you, wait an hour and try again. If it wasn't, we suggest you choose a new password.",
    ].join("\n"),
  };
}

/** The mail to the NEW address when a signed-in person asks to change their email: its link finishes the change. */
export function emailChangeMessage(to: string, url: string): MailMessage {
  return {
    to,
    subject: "Confirm your new email for Ruken",
    text: [
      "Someone asked to use this email address for a Ruken account. To finish, open this link:",
      "",
      url,
      "",
      "The link expires in 24 hours.",
      "",
      "If that wasn't you, you can ignore this email. Nothing changes until the link is opened.",
    ].join("\n"),
  };
}

/** The notice to the OLD address, so a person whose account someone else is changing hears about it. */
export function emailChangeAskedMessage(to: string, newAddress: string): MailMessage {
  return {
    to,
    subject: "A new email was asked for on your Ruken account",
    text: [
      `Someone asked to change the email on your Ruken account to ${newAddress}.`,
      "",
      "Nothing has changed yet. It only changes when the link we sent to that new address is opened.",
      "",
      "If that was you, there's nothing to do. Until then, you sign in with this address.",
      "",
      "If it wasn't, change your password right away, then check that no one else can get into your email.",
    ].join("\n"),
  };
}
