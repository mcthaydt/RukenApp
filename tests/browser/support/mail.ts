import { expect } from "@playwright/test";

// Reads the mail the site sent, from the stand-in (tests/browser/support/fake-mail-server.ts). The site sends some mail
// after it has answered, so a journey waits until the mail is there: it asks again, and gives up with the mail missing
// named, never after a fixed pause.

/** The stand-in mail service. */
const MAIL_URL = "http://127.0.0.1:12113";

export interface Mail {
  to: string;
  subject: string;
  text: string;
}

async function mailKeptFor(email: string): Promise<Mail[]> {
  const answer = await fetch(`${MAIL_URL}/mail?to=${encodeURIComponent(email)}`);
  const kept: Mail[] = await answer.json();
  return kept;
}

/** The newest mail to this address with this subject. Waits for it to arrive; fails if it never does. */
export async function mailTo(email: string, subject: string): Promise<Mail> {
  let found: Mail | undefined;
  await expect
    .poll(
      async () => {
        found = (await mailKeptFor(email)).findLast((mail) => mail.subject === subject);
        return found !== undefined;
      },
      { message: `no mail to ${email} with the subject "${subject}"`, timeout: 15_000 },
    )
    .toBe(true);
  if (found === undefined) throw new Error("unreachable: the poll passed with no mail");
  return found;
}

/** How many mails to this address have this subject, now. For a journey that says no mail was sent. */
export async function countMailsTo(email: string, subject: string): Promise<number> {
  return (await mailKeptFor(email)).filter((mail) => mail.subject === subject).length;
}

/** The link in a mail: the one address on a line of its own (src/features/accounts/mails.ts). */
export function linkIn(mail: Mail): string {
  const link = mail.text.split("\n").find((line) => /^https?:\/\//.test(line));
  if (link === undefined) throw new Error(`the mail "${mail.subject}" holds no link`);
  return link;
}
