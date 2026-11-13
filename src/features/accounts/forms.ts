import type { ActionFailure, RequestEvent } from "@sveltejs/kit";
import type { Clock } from "../../lib/clock.ts";
import type { BirthDate } from "./age.ts";
import type { CookiePolicy } from "./cookies.ts";
import type { AuthHandler } from "./forward.ts";

export const FORM_MESSAGES = {
  wrongPassword: "That email and password don't match. Try again, or reset your password.",
  rateLimited: "Too many tries. Wait a few minutes, then try again.",
  signInPaused:
    "Password sign-in is paused for that email after too many tries. Reset your password, or try again in an hour.",
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

export function readForm(event: FormEvent): Promise<FormFields> {
  throw new Error(`not built yet (${event.request.url})`);
}

export function callAuth(event: FormEvent, deps: FormDeps, path: string, body: unknown): Promise<Response> {
  throw new Error(`not built yet (${event.request.url} ${deps.baseURL} ${path} ${typeof body})`);
}

export function birthDateOf(form: { month: string; day: string; year: string }): BirthDate | null {
  throw new Error(`not built yet (${form.year})`);
}

export function signInWithPassword(event: FormEvent, deps: FormDeps): Promise<ActionFailure<AuthFormData>> {
  throw new Error(`not built yet (${event.request.url} ${deps.baseURL})`);
}

export function signUpWithPassword(event: FormEvent, deps: SignUpDeps): Promise<ActionFailure<AuthFormData>> {
  throw new Error(`not built yet (${event.request.url} ${deps.baseURL})`);
}

export function requestPasswordReset(
  event: FormEvent,
  deps: FormDeps,
): Promise<AuthFormData | ActionFailure<AuthFormData>> {
  throw new Error(`not built yet (${event.request.url} ${deps.baseURL})`);
}

export function resetPassword(event: FormEvent, deps: FormDeps): Promise<ActionFailure<AuthFormData>> {
  throw new Error(`not built yet (${event.request.url} ${deps.baseURL})`);
}

export function resendVerification(
  event: FormEvent,
  deps: FormDeps,
  email: string,
): Promise<{ resent: true } | ActionFailure<AuthFormData>> {
  throw new Error(`not built yet (${event.request.url} ${deps.baseURL} ${email})`);
}

export function signOut(event: FormEvent, deps: FormDeps): Promise<never> {
  throw new Error(`not built yet (${event.request.url} ${deps.baseURL})`);
}
