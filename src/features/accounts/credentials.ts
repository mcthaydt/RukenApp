import { fail, type ActionFailure } from "@sveltejs/kit";
import type { PrismaClient } from "../../lib/server/db.ts";
import type { RateLimiter } from "../../lib/server/rate-limit.ts";
import { hitPasswordChangeLimit } from "./auth-limits-plugin.ts";
import type { Auth } from "./auth.ts";
import { callAuth, FORM_MESSAGES, readForm, type FormDeps, type FormEvent } from "./forms.ts";
import {
  clearSignInFailures,
  recordWrongPassword,
  reserveSignInAttempt,
  type SignInGuards,
} from "./sign-in-guards.ts";

// "Change password" on the signed-in person's own page. It starts by checking the current password, so a borrowed
// phone or a stolen cookie is not enough. It uses better-auth's own change-password call (through callAuth, so its
// limits and hooks still run) and adds the check in front. There is no "change email": nobody signs in with an
// email any more (the owner's decision of 2026-11-21 on the card about #209).

export interface CredentialDeps {
  formDeps: FormDeps;
  prisma: PrismaClient;
  auth: Auth;
  /** BETTER_AUTH_SECRET, the key for the number hash in the limits. */
  secret: string;
  limiter: RateLimiter;
  guards: SignInGuards;
}

/** What the form hands back: the field the words belong beside, and the words. */
export interface ChangeFormData {
  /** Which field the problem is beside. `form` is the whole form. */
  field?: "password" | "newPassword" | "form";
  error?: string;
  /** The password is changed. */
  done?: true;
}

type PasswordCheck = "right" | "wrong" | "paused" | "limited";

const CREDENTIAL_PROVIDER = "credential";

/**
 * Whether this is the account's password. Counted like a password sign-in, so this screen is no way round the limits:
 * 5 a minute per client address and number, and ten wrong ones in an hour pause the number (the same pause as sign-in).
 */
async function checkCurrentPassword(
  deps: CredentialDeps,
  who: { userId: string; number: string; clientAddress: string },
  password: string,
): Promise<PasswordCheck> {
  const { limiter, guards, prisma } = deps;
  if (!(await hitPasswordChangeLimit({ limiter, secret: deps.secret }, who.number, who.clientAddress))) {
    return "limited";
  }
  if (!(await reserveSignInAttempt(guards, who.number)).allowed) return "paused";

  const account = await prisma.account.findFirst({
    where: { userId: who.userId, providerId: CREDENTIAL_PROVIDER },
    select: { password: true },
  });
  const context = await deps.auth.$context;
  const right =
    account?.password != null && (await context.password.verify({ hash: account.password, password }));
  if (right) {
    await clearSignInFailures(guards, who.number);
    return "right";
  }
  await recordWrongPassword(guards, who.number);
  return "wrong";
}

/** The words for a password check that did not pass, beside the current-password field. */
function refusedCheck(check: Exclude<PasswordCheck, "right">): ActionFailure<ChangeFormData> {
  if (check === "wrong") return fail(400, { field: "password", error: FORM_MESSAGES.currentPasswordWrong });
  if (check === "paused") return fail(429, { field: "password", error: FORM_MESSAGES.tooManyWrong });
  return fail(429, { field: "form", error: FORM_MESSAGES.rateLimited });
}

/**
 * Changes the password. Every other signed-in session of the account is signed out (the one used here stays), so
 * someone who had borrowed the account is out.
 */
export async function changePassword(
  event: FormEvent,
  deps: CredentialDeps,
  account: { userId: string; number: string },
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
