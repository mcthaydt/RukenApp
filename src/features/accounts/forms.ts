import { fail, redirect, type ActionFailure, type RequestEvent } from "@sveltejs/kit";
import type { Clock } from "../../lib/clock.ts";
import { safeNextPath } from "../../lib/safe-next.ts";
import { ageCheck, type BirthDate } from "./age.ts";
import { CLIENT_IP_HEADER } from "./auth.ts";
import { copyAuthCookies, type CookiePolicy } from "./cookies.ts";
import type { AuthHandler } from "./forward.ts";
import { SIGN_IN_PAUSED, SIGN_IN_PAUSED_MESSAGE } from "./sign-in-pause-plugin.ts";

// The sign-in, sign-up and sign-out pages post ordinary HTML forms to SvelteKit actions, which call
// these. Each one asks better-auth by building a request to its handler on the server:
// - the pages work without JavaScript;
// - SvelteKit has already checked that the form was posted from our own origin (CSRF);
// - better-auth's rate limits and hooks still run, which they would not if we called its `api`
//   functions directly.
// The Set-Cookie lines better-auth answers with are copied onto the page response.

export const FORM_MESSAGES = {
  wrongPassword: "That email and password don't match. Try again, or reset your password.",
  rateLimited: "Too many tries. Wait a few minutes, then try again.",
  // The words better-auth answers with while the pause lasts, so a person sees the same thing on the
  // form and anywhere else the answer is shown.
  signInPaused: SIGN_IN_PAUSED_MESSAGE,
  failed: "Something went wrong on our side. Try again in a moment.",
  emailMissing: "Enter your email address.",
  passwordLength: "Use a password of 10 to 128 characters.",
  accountExists: "There's already an account with that email. Sign in instead.",
  birthDateInvalid: "Enter your date of birth as a month, day and year.",
  passwordsDiffer: "The two passwords don't match. Type the same one twice.",
} as const;

export interface FormDeps {
  handler: AuthHandler;
  /** BETTER_AUTH_URL, the site's own origin. */
  baseURL: string;
  cookies: CookiePolicy;
}

export type FormEvent = Pick<RequestEvent, "request" | "cookies" | "getClientAddress">;

/** Sign-up also stores the age, after better-auth has created the user. */
export interface SignUpDeps extends FormDeps {
  clock: Clock;
  /** Stores the 18th birthday. The birth date itself is never stored. */
  setBirthDate(userId: string, date: BirthDate): Promise<unknown>;
}

/** What a form gets back: the values to keep in the fields and one message. */
export interface AuthFormData {
  email?: string;
  month?: string;
  day?: string;
  year?: string;
  /** Sign-up refused for being under 13: the page shows the refusal instead of the form. */
  tooYoung?: boolean;
  error?: string;
  sent?: boolean;
  /** Reset only: the link's token, kept so a mistake in the new password does not use up the link. */
  token?: string;
  /** Reset only: the link has expired, was already used, or never was one. The page offers a new link. */
  linkInvalid?: boolean;
}

const PASSWORD_MIN_LENGTH = 10;
const PASSWORD_MAX_LENGTH = 128;
/** Sign-up asks for no name; better-auth requires one, so every account starts with this. */
const DEFAULT_NAME = "Player";

export async function signInWithPassword(
  event: FormEvent,
  deps: FormDeps,
): Promise<ActionFailure<AuthFormData>> {
  const form = await readForm(event);
  if (form.email === "") return fail(400, { email: form.email, error: FORM_MESSAGES.emailMissing });

  const response = await callAuth(event, deps, "/sign-in/email", {
    email: form.email,
    password: form.password,
  });
  if (response.ok) redirect(303, safeNextPath(form.next));
  if (response.status === 401) return fail(400, { email: form.email, error: FORM_MESSAGES.wrongPassword });
  // Ten wrong passwords pause the address. The words are the same for every address, so they say
  // nothing about whether it has an account.
  if (response.status === 429 && (await errorCodeOf(response)) === SIGN_IN_PAUSED) {
    return fail(429, { email: form.email, error: FORM_MESSAGES.signInPaused });
  }
  return otherFailure(response, { email: form.email });
}

/**
 * Forgot password: emails a link to choose a new password. The answer is "sent" whether or not the
 * address has an account, so the form cannot be used to find out who has one. The link opens
 * /reset-password with a token.
 */
export async function requestPasswordReset(
  event: FormEvent,
  deps: FormDeps,
): Promise<AuthFormData | ActionFailure<AuthFormData>> {
  const form = await readForm(event);
  if (form.email === "") return fail(400, { email: form.email, error: FORM_MESSAGES.emailMissing });

  const response = await callAuth(event, deps, "/request-password-reset", {
    email: form.email,
    redirectTo: "/reset-password",
  });
  if (response.ok) return { sent: true, email: form.email };
  return otherFailure(response, { email: form.email });
}

/**
 * The new-password page. The length and the retyped password are checked first, and a refused
 * password keeps the token in the form, so one typing mistake does not use up the link. better-auth
 * revokes every session on success, so the person signs in again with the new password.
 */
export async function resetPassword(event: FormEvent, deps: FormDeps): Promise<ActionFailure<AuthFormData>> {
  const form = await readForm(event);
  if (form.token === "") return fail(400, { linkInvalid: true });
  const kept = { token: form.token };
  if (form.password.length < PASSWORD_MIN_LENGTH || form.password.length > PASSWORD_MAX_LENGTH) {
    return fail(400, { ...kept, error: FORM_MESSAGES.passwordLength });
  }
  if (form.password !== form.confirm) return fail(400, { ...kept, error: FORM_MESSAGES.passwordsDiffer });

  const response = await callAuth(event, deps, "/reset-password", {
    token: form.token,
    newPassword: form.password,
  });
  if (response.ok) redirect(303, "/sign-in?reset=1");
  if (response.status === 400 && (await errorCodeOf(response)) === "INVALID_TOKEN") {
    return fail(400, { linkInvalid: true });
  }
  return otherFailure(response, kept);
}

/**
 * /me → "Confirm your email": mails a fresh confirmation link to the signed-in account's own
 * address, which the route reads from the session, never from the form. The link returns to /me.
 */
export async function resendVerification(
  event: FormEvent,
  deps: FormDeps,
  email: string,
): Promise<{ resent: true } | ActionFailure<AuthFormData>> {
  const response = await callAuth(event, deps, "/send-verification-email", { email, callbackURL: "/me" });
  if (response.ok) return { resent: true };
  return otherFailure(response, {});
}

/**
 * Creates an account. Everything that can be checked is checked before better-auth is called, so a
 * refused form leaves no user behind:
 * - an under-13 date shows the refusal, and nothing about the visitor is kept or logged;
 * - better-auth only ever sees the name, email and password. The date of birth is turned into the
 *   18th birthday by `setBirthDate` and is not stored anywhere.
 */
export async function signUpWithPassword(
  event: FormEvent,
  deps: SignUpDeps,
): Promise<ActionFailure<AuthFormData>> {
  const form = await readForm(event);
  const kept = { email: form.email, month: form.month, day: form.day, year: form.year };
  if (form.email === "") return fail(400, { ...kept, error: FORM_MESSAGES.emailMissing });
  if (form.password.length < PASSWORD_MIN_LENGTH || form.password.length > PASSWORD_MAX_LENGTH) {
    return fail(400, { ...kept, error: FORM_MESSAGES.passwordLength });
  }
  const date = birthDateOf(form);
  const age = date === null ? { kind: "invalid" as const } : ageCheck(date, deps.clock);
  if (date === null || age.kind === "invalid")
    return fail(400, { ...kept, error: FORM_MESSAGES.birthDateInvalid });
  if (age.kind === "under13") return fail(400, { tooYoung: true });

  const response = await callAuth(event, deps, "/sign-up/email", {
    name: DEFAULT_NAME,
    email: form.email,
    password: form.password,
  });
  if (response.status === 422) return fail(400, { ...kept, error: FORM_MESSAGES.accountExists });
  if (!response.ok) return otherFailure(response, kept);

  // `json<T>()` is how the Workers types let a body be read as a known shape.
  const { user } = await response.json<{ user: { id: string } }>();
  await deps.setBirthDate(user.id, date);
  redirect(303, safeNextPath(form.next));
}

/** The three date fields as numbers, or null when one is missing or not a whole number. `ageCheck` does the calendar. */
export function birthDateOf(form: { month: string; day: string; year: string }): BirthDate | null {
  const parts = [form.year, form.month, form.day].map((text) =>
    /^\d{1,4}$/.test(text.trim()) ? Number(text.trim()) : null,
  );
  const [year, month, day] = parts;
  if (year == null || month == null || day == null) return null;
  return { year, month, day };
}

/**
 * Ends the session. The page posts its own path as `next`, so the person lands back where they
 * were, signed out. `next` is checked like the sign-in one: only a path on this site.
 */
export async function signOut(event: FormEvent, deps: FormDeps): Promise<never> {
  const form = await readForm(event);
  await callAuth(event, deps, "/sign-out", {});
  redirect(303, safeNextPath(form.next));
}

export interface FormFields {
  email: string;
  password: string;
  next: string;
  token: string;
  confirm: string;
  month: string;
  day: string;
  year: string;
}

export async function readForm(event: FormEvent): Promise<FormFields> {
  const data = await event.request.formData();
  const text = (key: string): string => {
    const value = data.get(key);
    return typeof value === "string" ? value : "";
  };
  return {
    email: text("email").trim(),
    password: text("password"),
    next: text("next"),
    token: text("token").trim(),
    confirm: text("confirm"),
    month: text("month"),
    day: text("day"),
    year: text("year"),
  };
}

/**
 * POSTs JSON to better-auth's handler as if the browser had, then copies its cookies back.
 * `origin` is our own origin: SvelteKit has already rejected a form posted from anywhere else.
 */
export async function callAuth(
  event: FormEvent,
  deps: FormDeps,
  path: string,
  body: unknown,
): Promise<Response> {
  const headers = new Headers({
    "content-type": "application/json",
    origin: new URL(deps.baseURL).origin,
    [CLIENT_IP_HEADER]: event.getClientAddress(),
  });
  const cookie = event.request.headers.get("cookie");
  if (cookie !== null) headers.set("cookie", cookie);
  const userAgent = event.request.headers.get("user-agent");
  if (userAgent !== null) headers.set("user-agent", userAgent);

  const response = await deps.handler(
    new Request(`${deps.baseURL}/api/auth${path}`, { method: "POST", headers, body: JSON.stringify(body) }),
  );
  copyAuthCookies(event.cookies, response.headers.getSetCookie());
  return response;
}

/** The `code` better-auth puts in an error body (like INVALID_TOKEN), or undefined when there is none. */
async function errorCodeOf(response: Response): Promise<string | undefined> {
  try {
    const body = await response.clone().json<{ code?: unknown }>();
    return typeof body.code === "string" ? body.code : undefined;
  } catch {
    return undefined;
  }
}

function otherFailure(response: Response, kept: AuthFormData): ActionFailure<AuthFormData> {
  if (response.status === 429) return fail(429, { ...kept, error: FORM_MESSAGES.rateLimited });
  return fail(500, { ...kept, error: FORM_MESSAGES.failed });
}
