import { fail, type ActionFailure } from "@sveltejs/kit";
import type { PrismaClient } from "../../lib/server/db.ts";
import { runAfterAnswer, type RunInBackground } from "../../lib/server/background.ts";
import { mailFailureCode, type Mailer } from "../../lib/server/mail.ts";
import type { RateLimiter } from "../../lib/server/rate-limit.ts";
import { ACCOUNT_CHANGE_LIMITS, ACCOUNT_CHANGE_PATH, hitAddressLimits } from "./auth-limits-plugin.ts";
import type { Auth } from "./auth.ts";
import { callAuth, FORM_MESSAGES, readForm, type FormDeps, type FormEvent } from "./forms.ts";
import { emailChangeAskedMessage } from "./mails.ts";
import {
  clearSignInFailures,
  recordWrongPassword,
  reserveSignInAttempt,
  type SignInGuards,
} from "./sign-in-guards.ts";

// "Change email" and "Change password" on the signed-in person's own page. Both start by checking the current
// password, so a borrowed phone or a stolen cookie is not enough. They use better-auth's own change-email and
// change-password calls (through callAuth, so its limits and hooks still run) and add the check in front.

export interface CredentialDeps {
  formDeps: FormDeps;
  prisma: PrismaClient;
  mailer: Mailer;
  auth: Auth;
  limiter: RateLimiter;
  guards: SignInGuards;
  /** Where the notice mail runs after the answer. Defaults to the host's `waitUntil`. */
  runInBackground?: RunInBackground;
  log?: (message: string) => void;
}

/** What a change form hands back: the field the words belong beside, and the words. */
export interface ChangeFormData {
  /** Which field the problem is beside. `form` is the whole form. */
  field?: "email" | "password" | "newPassword" | "form";
  error?: string;
  /** Email: what was typed in "New email", kept when the form is refused. */
  email?: string;
  /** Email: the link was sent to this address. */
  sentTo?: string;
  /** Password: it is changed. */
  done?: true;
}

type PasswordCheck = "right" | "wrong" | "paused" | "limited";

const CREDENTIAL_PROVIDER = "credential";
const EMAIL_SHAPE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Whether this is the account's password. Counted like a password sign-in, so these screens are no way round the limits:
 * 5 a minute per client address and email, and ten wrong ones in an hour pause the address (the same pause as sign-in).
 */
async function checkCurrentPassword(
  deps: CredentialDeps,
  who: { userId: string; email: string; clientAddress: string },
  password: string,
): Promise<PasswordCheck> {
  const { limiter, guards, prisma } = deps;
  if (
    !(await hitAddressLimits(
      limiter,
      guards.secret,
      ACCOUNT_CHANGE_PATH,
      ACCOUNT_CHANGE_LIMITS,
      who.email,
      who.clientAddress,
    ))
  ) {
    return "limited";
  }
  if (!(await reserveSignInAttempt(guards, who.email)).allowed) return "paused";

  const account = await prisma.account.findFirst({
    where: { userId: who.userId, providerId: CREDENTIAL_PROVIDER },
    select: { password: true },
  });
  const context = await deps.auth.$context;
  const right =
    account?.password != null && (await context.password.verify({ hash: account.password, password }));
  if (right) {
    await clearSignInFailures(guards, who.email);
    return "right";
  }
  await recordWrongPassword(guards, who.email);
  return "wrong";
}

/** The words for a password check that did not pass, beside the current-password field. */
function refusedCheck(
  check: Exclude<PasswordCheck, "right">,
  kept: ChangeFormData = {},
): ActionFailure<ChangeFormData> {
  if (check === "wrong") {
    return fail(400, { ...kept, field: "password", error: FORM_MESSAGES.currentPasswordWrong });
  }
  if (check === "paused") return fail(429, { ...kept, field: "password", error: FORM_MESSAGES.tooManyWrong });
  return fail(429, { ...kept, field: "form", error: FORM_MESSAGES.rateLimited });
}

/**
 * Asks for the email to change. Nothing changes yet: better-auth mails a link to the new address, and the account's
 * address changes when that is opened. The old address is told, whether or not the new one is taken, and the answer is
 * the same either way, so the form cannot be used to find out who has an account.
 */
export async function changeEmail(
  event: FormEvent,
  deps: CredentialDeps,
  account: { userId: string; email: string },
): Promise<ChangeFormData | ActionFailure<ChangeFormData>> {
  const form = await readForm(event);
  const newEmail = form.email.toLowerCase();
  if (newEmail === "")
    return fail(400, { email: form.email, field: "email", error: FORM_MESSAGES.emailMissing });
  if (!EMAIL_SHAPE.test(newEmail))
    return fail(400, { email: form.email, field: "email", error: FORM_MESSAGES.emailInvalid });
  if (newEmail === account.email.toLowerCase()) {
    return fail(400, { email: form.email, field: "email", error: FORM_MESSAGES.sameEmail });
  }

  const check = await checkCurrentPassword(
    deps,
    { ...account, clientAddress: event.getClientAddress() },
    form.password,
  );
  if (check !== "right") return refusedCheck(check, { email: form.email });

  const response = await callAuth(event, deps.formDeps, "/change-email", { newEmail, callbackURL: "/me" });
  if (response.status === 429)
    return fail(429, { email: form.email, field: "form", error: FORM_MESSAGES.rateLimited });
  if (response.status === 400)
    return fail(400, { email: form.email, field: "email", error: FORM_MESSAGES.emailInvalid });
  if (!response.ok) return fail(500, { email: form.email, field: "form", error: FORM_MESSAGES.failed });

  const log =
    deps.log ??
    ((message: string): void => {
      console.warn(message);
    });
  (deps.runInBackground ?? runAfterAnswer)(async () => {
    try {
      await deps.mailer.send(emailChangeAskedMessage(account.email, newEmail));
    } catch (error) {
      log(`email change notice not sent: ${mailFailureCode(error)}`);
    }
  });
  return { sentTo: newEmail };
}

/**
 * Changes the password. Every other signed-in session of the account is signed out (the one used here stays), so
 * someone who had borrowed the account is out.
 */
export async function changePassword(
  event: FormEvent,
  deps: CredentialDeps,
  account: { userId: string; email: string },
): Promise<ChangeFormData | ActionFailure<ChangeFormData>> {
  const form = await readForm(event);
  if (form.newPassword.length < 10 || form.newPassword.length > 128) {
    return fail(400, { field: "newPassword", error: FORM_MESSAGES.passwordLength });
  }

  const check = await checkCurrentPassword(
    deps,
    { ...account, clientAddress: event.getClientAddress() },
    form.password,
  );
  if (check !== "right") return refusedCheck(check);

  const response = await callAuth(event, deps.formDeps, "/change-password", {
    currentPassword: form.password,
    newPassword: form.newPassword,
    revokeOtherSessions: true,
  });
  if (response.status === 429) return fail(429, { field: "form", error: FORM_MESSAGES.rateLimited });
  if (!response.ok) return fail(500, { field: "form", error: FORM_MESSAGES.failed });
  return { done: true };
}
