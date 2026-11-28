import { fail, redirect, type ActionFailure, type RequestEvent } from "@sveltejs/kit";
import type { Clock } from "../../lib/clock.ts";
import { safeNextPath } from "../../lib/safe-next.ts";
import { ageCheck, type BirthDate } from "./age.ts";
import { CLIENT_IP_HEADER } from "./auth.ts";
import { CODE_TOO_SOON, CODES_PAUSED } from "./auth-limits-plugin.ts";
import { copyAuthCookies, type CookiePolicy } from "./cookies.ts";
import type { AuthHandler } from "./forward.ts";
import { newBrowserValue, type PendingSignUp } from "./pending-sign-up.ts";
import { countryOf, toE164, typedNumber } from "./phone.ts";
import { SIGN_IN_PAUSED, SIGN_IN_PAUSED_MESSAGE } from "./sign-in-pause-plugin.ts";

// The sign-in, sign-up, forgot-password and sign-out pages post ordinary HTML forms to SvelteKit actions, which call
// these. Each one asks better-auth by building a request to its handler on the server:
// - the pages work without JavaScript;
// - SvelteKit has already checked that the form was posted from our own origin (CSRF);
// - better-auth's rate limits and hooks still run, which they would not if we called its `api`
//   functions directly.
// The Set-Cookie lines better-auth answers with are copied onto the page response.

export const FORM_MESSAGES = {
  wrongPassword: "That number and password don't match. Try again, or reset your password.",
  rateLimited: "Too many tries. Wait a few minutes, then try again.",
  // The words better-auth answers with while the pause lasts, so a person sees the same thing on the
  // form and anywhere else the answer is shown.
  signInPaused: SIGN_IN_PAUSED_MESSAGE,
  failed: "Something went wrong on our side. Try again in a moment.",
  phoneInvalid: "That doesn't look like a phone number. Check it and try again.",
  passwordLength: "Use a password of 10 to 128 characters.",
  birthDateInvalid: "Enter your date of birth as a month, day and year.",
  passwordsDiffer: "The two passwords don't match. Type the same one twice.",
  codeWrong: "That code isn't right. Check the text, or ask for a new one.",
  codeTooSoon: "Give it a few seconds, then try again.",
  codesPaused: "Too many wrong codes. Codes are paused for an hour for this number.",
  closedCountry: "Ruken isn't in your country yet.",
  signUpExpired: "That took too long. Start again with your number.",
  currentPasswordWrong: "That isn't your password. Try again.",
  tooManyWrong: "Too many wrong passwords. Wait an hour, then try again.",
} as const;

/**
 * The cookie that ties a sign-up to the browser that started it (pending-sign-up.ts). Not `__Host-`: that prefix needs
 * Path=/, and this one is only ever read by /sign-up, which is where its path keeps it.
 */
export const SIGN_UP_COOKIE = "ruken_sign_up";
const SIGN_UP_COOKIE_PATH = "/sign-up";
/** As long as the code lasts. */
const SIGN_UP_COOKIE_SECONDS = 600;

export interface FormDeps {
  handler: AuthHandler;
  /** BETTER_AUTH_URL, the site's own origin. */
  baseURL: string;
  cookies: CookiePolicy;
}

export type FormEvent = Pick<RequestEvent, "request" | "cookies" | "getClientAddress">;

/** What the two code screens need besides better-auth: telling Twilio a code was used. */
export interface ResetDeps extends FormDeps {
  /** Tells Verify the number's code was used. Runs after the answer and never throws. */
  codeUsed(number: string): void;
}

/**
 * Sign-up keeps a password and an age between its two screens, makes the account when the code is right, and checks a
 * code for a number that already has one without ever signing anyone in. Each of those is a small function handed in
 * from services.ts, so the order of the steps is tested here with no database.
 */
export interface SignUpDeps extends ResetDeps {
  clock: Clock;
  /** Hashes a password the way better-auth does, so a sign-in finds it. */
  hashPassword(password: string): Promise<string>;
  keepPending(input: { number: string; browser: string; passwordHash: string; adultOn: Date }): Promise<void>;
  takePending(input: { number: string; browser: string }): Promise<PendingSignUp | null>;
  accountExists(number: string): Promise<boolean>;
  /**
   * Counts one code typed from this client address and says whether it may go ahead (10 in 15 minutes). Every code
   * typed on the sign-up screen is counted here, so a number with an account and one without are refused at the same try.
   */
  countCodeTry(address: string): Promise<boolean>;
  /** Checks and uses up a code without making a user or a session (better-auth's server-only check). */
  consumeCode(number: string, code: string): Promise<"ok" | "wrong" | "other">;
  /** Counts a wrong code toward the pause, as better-auth's own routes do. */
  countWrongCode(number: string): Promise<void>;
  codesPaused(number: string): Promise<boolean>;
  /** The password, the age and the confirmation, in one transaction; and forgets what was kept for the number. */
  makeAccount(input: { userId: string; number: string; passwordHash: string; adultOn: Date }): Promise<void>;
  /** Takes back a user and session better-auth made when the rest of sign-up could not be finished. */
  removeHalfMadeAccount(userId: string): Promise<void>;
}

/** What a form gets back: the values to keep in the fields and one message. Never a password or a code. */
export interface AuthFormData {
  /** The country picked, as its two letters, and the number as typed. */
  country?: string;
  phone?: string;
  month?: string;
  day?: string;
  year?: string;
  /** Where to go once it is done, carried to the end. */
  next?: string;
  /** Sign-up refused for being under 13: the page shows the refusal instead of the form. */
  tooYoung?: boolean;
  /** The country is not open yet. */
  closedCountry?: boolean;
  error?: string;
  /** "code": the second screen, where the code is typed, for `number` (E.164, kept in a hidden field). */
  step?: "code";
  number?: string;
}

const PASSWORD_MIN_LENGTH = 10;
const PASSWORD_MAX_LENGTH = 128;

export async function signInWithPassword(
  event: FormEvent,
  deps: FormDeps,
): Promise<ActionFailure<AuthFormData>> {
  const form = await readForm(event);
  const kept = { country: form.country, phone: form.phone };
  // A number that cannot be read is answered as a wrong password: nothing here says which part was wrong.
  const number = numberOf(form);
  if (number === null) return fail(400, { ...kept, error: FORM_MESSAGES.wrongPassword });

  const response = await callAuth(event, deps, "/sign-in/phone-number", {
    phoneNumber: number,
    password: form.password,
  });
  if (response.ok) redirect(303, safeNextPath(form.next));
  if (response.status === 401) return fail(400, { ...kept, error: FORM_MESSAGES.wrongPassword });
  // Ten wrong passwords pause the number. The words are the same for every number, so they say
  // nothing about whether it has an account.
  if (response.status === 429 && (await errorCodeOf(response)) === SIGN_IN_PAUSED) {
    return fail(429, { ...kept, error: FORM_MESSAGES.signInPaused });
  }
  return otherFailure(response, kept);
}

/** The number a form's country and phone fields name, as E.164, or null (phone.ts's `typedNumber`). */
function numberOf(form: Pick<FormFields, "country" | "phone">): string | null {
  return typedNumber(form.country, form.phone);
}

/** A 429 from asking for a code, in words: too soon, paused, or just too many. */
async function codeLimitFailure(
  response: Response,
  kept: AuthFormData,
): Promise<ActionFailure<AuthFormData>> {
  const code = await errorCodeOf(response);
  if (code === CODE_TOO_SOON) return fail(429, { ...kept, error: FORM_MESSAGES.codeTooSoon });
  if (code === CODES_PAUSED) return fail(429, { ...kept, error: FORM_MESSAGES.codesPaused });
  return fail(429, { ...kept, error: FORM_MESSAGES.rateLimited });
}

/**
 * Forgot password, first screen: asks for a code for the number. The answer is the second screen whether or not the
 * number has an account, so the form cannot be used to find out who has one. Whether the code goes by text or to the
 * email a member pays with is decided after the answer (auth.ts); the screen says both can happen. Asking again from
 * the second screen comes here too, and stays on it.
 */
export async function requestReset(
  event: FormEvent,
  deps: FormDeps,
): Promise<AuthFormData | ActionFailure<AuthFormData>> {
  const form = await readForm(event);
  const kept: AuthFormData = { country: form.country, phone: form.phone };
  const again = form.step === "code" && isNumber(form.number);
  const number = again ? form.number : numberOf(form);
  if (number === null) return refusedNumber(form, kept);
  const onCodeScreen: AuthFormData = again ? { ...kept, step: "code", number } : kept;

  const response = await callAuth(event, deps, "/phone-number/request-password-reset", {
    phoneNumber: number,
  });
  if (response.ok) return { step: "code", number, ...kept };
  if (response.status === 429) return codeLimitFailure(response, onCodeScreen);
  return otherFailure(response, onCodeScreen);
}

/** The refusal for a number that cannot be used: a closed country, or something that is not a number. */
function refusedNumber(form: FormFields, kept: AuthFormData): ActionFailure<AuthFormData> {
  const country = countryOf(form.country);
  const typed = country === null ? null : toE164(country.dialing, form.phone);
  // Readable, but not under the picked country's dialing code: a number from somewhere that is not open yet.
  if (country === null || (typed !== null && !typed.startsWith(country.dialing))) {
    return fail(400, { ...kept, closedCountry: true, error: FORM_MESSAGES.closedCountry });
  }
  return fail(400, { ...kept, error: FORM_MESSAGES.phoneInvalid });
}

/**
 * Forgot password, second screen: the code, and the new password twice. The length and the retyped password are
 * checked first and a refused password keeps the number, because better-auth checks the code and saves the password
 * in one step and a code is used up the moment it is checked, so a typing mistake must not reach it. better-auth
 * signs every device out on success, so the person signs in again with the new password.
 */
export async function finishReset(event: FormEvent, deps: ResetDeps): Promise<ActionFailure<AuthFormData>> {
  const form = await readForm(event);
  if (!isNumber(form.number)) return fail(400, { error: FORM_MESSAGES.phoneInvalid });
  const kept: AuthFormData = { step: "code", number: form.number, country: form.country, phone: form.phone };
  if (form.password.length < PASSWORD_MIN_LENGTH || form.password.length > PASSWORD_MAX_LENGTH) {
    return fail(400, { ...kept, error: FORM_MESSAGES.passwordLength });
  }
  if (form.password !== form.confirm) return fail(400, { ...kept, error: FORM_MESSAGES.passwordsDiffer });

  const response = await callAuth(event, deps, "/phone-number/reset-password", {
    phoneNumber: form.number,
    otp: form.code,
    newPassword: form.password,
  });
  if (response.ok) {
    deps.codeUsed(form.number);
    redirect(303, "/sign-in?reset=1");
  }
  if (response.status === 400 || response.status === 403) {
    return fail(400, { ...kept, error: FORM_MESSAGES.codeWrong });
  }
  if (response.status === 429) return codeLimitFailure(response, kept);
  return otherFailure(response, kept);
}

/** Whether `value` is a number written the way the database keeps one (E.164). */
function isNumber(value: string): boolean {
  return /^\+[0-9]{8,15}$/.test(value);
}

/**
 * Sign-up, first screen. Everything that can be checked is checked before anything is kept or sent, so a refused form
 * leaves nothing behind: a closed country, a number that cannot be one, a short password, a date that is not a date,
 * and an under-13 date (which shows the refusal and keeps nothing). Then the hashed password and the 18th birthday are
 * kept for this browser (pending-sign-up.ts) and a code is asked for, for any number whether or not an account has it:
 * the plugin sends a notice instead of a code to a number that has one, so both take the same time and count against
 * the same limits. better-auth never sees the password or the date of birth here.
 */
export async function startSignUp(
  event: FormEvent,
  deps: SignUpDeps,
): Promise<AuthFormData | ActionFailure<AuthFormData>> {
  const form = await readForm(event);
  const kept: AuthFormData = {
    country: form.country,
    phone: form.phone,
    month: form.month,
    day: form.day,
    year: form.year,
  };
  const number = numberOf(form);
  if (number === null) return refusedNumber(form, kept);
  if (form.password.length < PASSWORD_MIN_LENGTH || form.password.length > PASSWORD_MAX_LENGTH) {
    return fail(400, { ...kept, error: FORM_MESSAGES.passwordLength });
  }
  const date = birthDateOf(form);
  const age = date === null ? { kind: "invalid" as const } : ageCheck(date, deps.clock);
  if (date === null || age.kind === "invalid")
    return fail(400, { ...kept, error: FORM_MESSAGES.birthDateInvalid });
  if (age.kind === "under13") return fail(400, { tooYoung: true });

  const browser = browserOf(event, deps);
  await deps.keepPending({
    number,
    browser,
    passwordHash: await deps.hashPassword(form.password),
    adultOn: new Date(`${age.adultOn}T00:00:00Z`),
  });

  const response = await callAuth(event, deps, "/phone-number/send-otp", { phoneNumber: number });
  const onCodeScreen: AuthFormData = { ...kept, next: form.next };
  if (response.ok) return { step: "code", number, ...onCodeScreen };
  if (response.status === 429) return codeLimitFailure(response, kept);
  return otherFailure(response, kept);
}

/** This browser's own sign-up value from its cookie, or a new one, set now. */
function browserOf(event: FormEvent, deps: FormDeps): string {
  const browser = event.cookies.get(SIGN_UP_COOKIE) ?? newBrowserValue();
  event.cookies.set(SIGN_UP_COOKIE, browser, {
    path: SIGN_UP_COOKIE_PATH,
    httpOnly: true,
    sameSite: "lax",
    secure: deps.cookies.secure,
    maxAge: SIGN_UP_COOKIE_SECONDS,
  });
  return browser;
}

/**
 * "Text it again": a new code for the number, and another ten minutes for what this browser kept. A browser that kept
 * nothing (it ran out, or this is another browser) is sent back to the first screen to start again, because a code
 * for a sign-up nothing is waiting on could never finish one.
 */
export async function resendCode(
  event: FormEvent,
  deps: SignUpDeps,
): Promise<AuthFormData | ActionFailure<AuthFormData>> {
  const form = await readForm(event);
  const first: AuthFormData = {
    country: form.country,
    phone: form.phone,
    month: form.month,
    day: form.day,
    year: form.year,
  };
  if (!isNumber(form.number)) return fail(400, { ...first, error: FORM_MESSAGES.phoneInvalid });
  const browser = event.cookies.get(SIGN_UP_COOKIE) ?? "";
  const kept = await deps.takePending({ number: form.number, browser });
  if (kept === null) return fail(400, { ...first, error: FORM_MESSAGES.signUpExpired });
  await deps.keepPending({ number: form.number, browser, ...kept });
  browserOf(event, deps);

  const onCodeScreen: AuthFormData = { ...first, next: form.next, step: "code", number: form.number };
  const response = await callAuth(event, deps, "/phone-number/send-otp", { phoneNumber: form.number });
  if (response.ok) return onCodeScreen;
  if (response.status === 429) return codeLimitFailure(response, onCodeScreen);
  return otherFailure(response, onCodeScreen);
}

/**
 * Sign-up, second screen: the code. A sign-up that finishes is the one this browser started, for a number nobody has.
 * For any other case (an account already has the number, or this browser kept nothing for it) `verify` is never
 * called, because it signs in whoever holds a code: the code is still checked and used up, and counted when wrong,
 * exactly as `verify` would, and the screen reads the same whatever it answers, so a number with an account and one
 * without read the same at every try, do the same work and pause at the same count.
 */
export async function finishSignUp(event: FormEvent, deps: SignUpDeps): Promise<ActionFailure<AuthFormData>> {
  const form = await readForm(event);
  if (!isNumber(form.number)) return fail(400, { error: FORM_MESSAGES.phoneInvalid });
  const number = form.number;
  const kept: AuthFormData = {
    step: "code",
    number,
    country: form.country,
    phone: form.phone,
    month: form.month,
    day: form.day,
    year: form.year,
    next: form.next,
  };
  if (!(await deps.countCodeTry(event.getClientAddress()))) {
    return fail(429, { ...kept, error: FORM_MESSAGES.rateLimited });
  }
  const pending = await deps.takePending({ number, browser: event.cookies.get(SIGN_UP_COOKIE) ?? "" });

  if (pending === null || (await deps.accountExists(number))) {
    if (await deps.codesPaused(number)) return fail(429, { ...kept, error: FORM_MESSAGES.codesPaused });
    const checked = await deps.consumeCode(number, form.code);
    if (checked === "wrong") await deps.countWrongCode(number);
    if (checked === "ok") deps.codeUsed(number);
    return fail(400, { ...kept, error: FORM_MESSAGES.codeWrong });
  }

  const response = await callAuth(event, deps, "/phone-number/verify", {
    phoneNumber: number,
    code: form.code,
  });
  if (response.status === 400 || response.status === 403) {
    return fail(400, { ...kept, error: FORM_MESSAGES.codeWrong });
  }
  if (response.status === 429) return codeLimitFailure(response, kept);
  if (!response.ok) return otherFailure(response, kept);

  // `json<T>()` is how the Workers types let a body be read as a known shape.
  const { user } = await response.json<{ user: { id: string } }>();
  try {
    await deps.makeAccount({
      userId: user.id,
      number,
      passwordHash: pending.passwordHash,
      adultOn: pending.adultOn,
    });
  } catch (cause) {
    // Left as it was, the account would have no password and no age, so an adult would get every under-18 default,
    // and a second try would meet "an account has this number". So it is taken back, the session better-auth just
    // made is forgotten, and what this browser kept stays for the next try.
    await deps.removeHalfMadeAccount(user.id);
    event.cookies.set(deps.cookies.sessionCookieName, "", {
      path: "/",
      maxAge: 0,
      httpOnly: true,
      sameSite: "lax",
      secure: deps.cookies.secure,
    });
    console.error(`sign-up not finished: ${cause instanceof Error ? cause.name : "unknown error"}`);
    return fail(500, { ...kept, error: FORM_MESSAGES.failed });
  }
  deps.codeUsed(number);
  event.cookies.delete(SIGN_UP_COOKIE, { path: SIGN_UP_COOKIE_PATH });
  redirect(303, safeNextPath(form.next));
}

/**
 * Sign-up, code screen, "Change the number": the first screen again, with the country, number and date of birth that
 * were typed in its fields. Nothing is kept or sent, and the password is not carried back.
 */
export async function changeNumber(event: FormEvent): Promise<AuthFormData> {
  const form = await readForm(event);
  return {
    country: form.country,
    phone: form.phone,
    month: form.month,
    day: form.day,
    year: form.year,
    next: form.next,
  };
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
  country: string;
  phone: string;
  number: string;
  code: string;
  password: string;
  next: string;
  confirm: string;
  newPassword: string;
  month: string;
  day: string;
  year: string;
  /** "code" when the form was posted from a code screen. */
  step: string;
}

export async function readForm(event: FormEvent): Promise<FormFields> {
  const data = await event.request.formData();
  const text = (key: string): string => {
    const value = data.get(key);
    return typeof value === "string" ? value : "";
  };
  return {
    country: text("country").trim(),
    phone: text("phone").trim(),
    number: text("number").trim(),
    code: text("code").replaceAll(/\s/g, ""),
    password: text("password"),
    next: text("next"),
    confirm: text("confirm"),
    newPassword: text("newPassword"),
    month: text("month"),
    day: text("day"),
    year: text("year"),
    step: text("step"),
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
