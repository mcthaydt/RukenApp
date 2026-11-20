import { expect, type Browser, type Locator, type Page } from "@playwright/test";
import { checkoutIdOfPaymentUrl, STAND_IN_URL } from "./stand-in-payment.ts";
import { codeTo } from "./texts.ts";

/** The password every journey's new account uses. */
export const JOURNEY_PASSWORD = "a long enough password";

/**
 * A number no other journey has used, so journeys can run side by side on one database: +1, a random area code, 555 and
 * four random digits outside 01·· (those are kept for fiction, and the site never texts them).
 */
export function freshNumber(): string {
  const area = 200 + Math.floor(Math.random() * 800);
  const last = 200 + Math.floor(Math.random() * 7800);
  return `+1${String(area)}555${String(last).padStart(4, "0")}`;
}

/** The number as a person types it into the box beside "United States (+1)": ten digits, no "+1". */
export function nationalOf(number: string): string {
  return number.replace(/^\+1/, "");
}

/** An email address no other journey has used (a member's legal address, and only one: nobody signs up with it). */
export function freshEmail(): string {
  return `journey+${crypto.randomUUID().slice(0, 12)}@ruken.test`;
}

/**
 * A birth date that makes a person exactly this many years old. The birthday was two days ago, so
 * the age is the same on the runner's clock and on the site's (Chicago), and nobody is a day short.
 */
export function yearsAgo(years: number): { month: string; day: string; year: string } {
  const date = new Date();
  date.setFullYear(date.getFullYear() - years);
  date.setDate(date.getDate() - 2);
  return {
    month: String(date.getMonth() + 1),
    day: String(date.getDate()),
    year: String(date.getFullYear()),
  };
}

/** Fills the three birth-date fields on the sign-up form. */
export async function fillBirthDate(
  page: Page,
  date: { month: string; day: string; year: string },
): Promise<void> {
  await page.getByLabel("Month").fill(date.month);
  await page.getByLabel("Day").fill(date.day);
  await page.getByLabel("Year").fill(date.year);
}

/**
 * Waits until the page the browser landed on has come alive. A URL reads as the new one as soon as a redirect commits,
 * before that page has finished loading, and a goto sent now can collide with the load still in flight (seen in
 * WebKit: run 43626711198 after sign-up, run 43629699636 after paying). SvelteKit adds its announcer only once the
 * page has come alive, so its arrival says the page has settled. No pause.
 */
export async function pageHasSettled(page: Page): Promise<void> {
  await expect(page.locator("#svelte-announcer")).toBeAttached();
}

/**
 * Fills the sign-up form that is on the page with this number and password and asks for the code, and waits for the
 * code screen. The country stays on its first choice, the United States.
 */
export async function startSignUpForm(
  page: Page,
  number: string,
  password: string = JOURNEY_PASSWORD,
): Promise<void> {
  await page.getByLabel("Phone number").fill(nationalOf(number));
  await page.getByLabel("Password").fill(password);
  await fillBirthDate(page, yearsAgo(30));
  await page.getByRole("button", { name: "Text me a code" }).click();
  await expect(page.getByRole("heading", { name: "We texted you a code" })).toBeVisible();
}

/**
 * Fills the sign-up form that is on the page, asks for the code, types the code the stand-in Twilio kept and presses
 * "Join Ruken". It leaves the browser wherever the site sends it next.
 */
export async function finishSignUpForm(
  page: Page,
  number: string,
  password: string = JOURNEY_PASSWORD,
): Promise<void> {
  await startSignUpForm(page, number, password);
  await page.getByLabel("The code we texted you").fill(await codeTo(number));
  await page.getByRole("button", { name: "Join Ruken" }).click();
}

/**
 * Makes a new account through the sign-up form, as a person would: the number, a password and a date of birth, then the
 * code the stand-in Twilio kept. It waits for the page it lands on; the person is signed in afterwards. The number is
 * new unless the journey gives one (a person coming back to a number they used before).
 */
export async function signUp(
  page: Page,
  number: string = freshNumber(),
): Promise<{ number: string; password: string }> {
  await page.goto("/sign-up");
  await finishSignUpForm(page, number);
  await expect(page).toHaveURL("/");
  await pageHasSettled(page);
  return { number, password: JOURNEY_PASSWORD };
}

/** Signs a person in through the sign-in form, as a person would, and waits for `/me`'s sign-in to settle. */
export async function signInAs(page: Page, number: string, password: string = JOURNEY_PASSWORD): Promise<void> {
  await page.goto("/sign-in");
  await page.getByLabel("Phone number").fill(nationalOf(number));
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/");
  await pageHasSettled(page);
}

/** Where `wrangler dev` serves the site, for a browser context made by hand (such a context has no config of its own). */
const SITE_URL = "http://localhost:4173";

/**
 * Makes an account in a browser of its own and closes it, for a journey that needs a second person (a maker, standing
 * in until the maker's own pages exist). The first person's cookies are untouched.
 */
export async function signUpInItsOwnContext(browser: Browser): Promise<{ number: string; password: string }> {
  const context = await browser.newContext({ baseURL: SITE_URL });
  try {
    return await signUp(await context.newPage());
  } finally {
    await context.close();
  }
}

/**
 * The stand-in Stripe's one "Pay" button. A name alone matches as a part of the words, so "Pay" would also be the
 * card's own "Continue to payment"; the whole name is asked for, and only the stand-in's page has it.
 */
export function standInPayButton(page: Page): Locator {
  return page.getByRole("button", { name: "Pay", exact: true });
}

/**
 * Presses "Continue to payment" and waits until the browser is on the stand-in's payment page, then answers the
 * checkout's id from its address. The press can come back while the browser still shows the card (seen in WebKit:
 * runs 43657290538, 43658030234 and 43659012481), so the address is read only once it is the payment page's.
 */
export async function continueToPayment(page: Page): Promise<string> {
  await page.getByRole("button", { name: "Continue to payment" }).click();
  await page.waitForURL((url) => checkoutIdOfPaymentUrl(url.href) !== undefined, { waitUntil: "commit" });
  await expect(standInPayButton(page)).toBeVisible();
  const checkoutSessionId = checkoutIdOfPaymentUrl(page.url());
  if (checkoutSessionId === undefined) throw new Error(`not the stand-in's payment page: ${page.url()}`);
  return checkoutSessionId;
}

/**
 * Signs a new person up, opens the card, pays on the stand-in Stripe, and waits for `/me`, where the card sends
 * them. `checkoutSessionId` is the stand-in's name for what was paid, read from its page's address, so a journey
 * can ask the stand-in what it thinks later.
 */
export async function payAsNewMember(page: Page): Promise<{ number: string; checkoutSessionId: string }> {
  const { number } = await signUp(page);
  await page.goto("/join?next=/me");
  const checkoutSessionId = await continueToPayment(page);
  await standInPayButton(page).click();
  await expect(page).toHaveURL("/me");
  await pageHasSettled(page);
  return { number, checkoutSessionId };
}

/** What the stand-in Stripe says the status of a paid checkout's subscription is: "active", "canceled", or "none". */
export async function subscriptionStatusAtStandIn(member: { checkoutSessionId: string }): Promise<string> {
  const answer = await fetch(`${STAND_IN_URL}/state/${member.checkoutSessionId}`);
  return answer.text();
}

/**
 * The member's paid time runs out at the stand-in Stripe, which tells the site, as Stripe does at the end of a period
 * the member chose not to renew. After it, the member is not a member any more.
 */
export async function letMembershipRunOut(member: { checkoutSessionId: string }): Promise<void> {
  const answer = await fetch(`${STAND_IN_URL}/test/end/${member.checkoutSessionId}`, { method: "POST" });
  if (!answer.ok) throw new Error(`the stand-in would not end the membership: ${String(answer.status)}`);
}

/**
 * Stripe's late news goes out: a payment page opened with `?events=later` holds the site's three events back until
 * this is called, so a journey can look at the page that waits for them and then let them arrive, with no timer to race.
 */
export async function releaseLateNews(checkoutSessionId: string): Promise<void> {
  const answer = await fetch(`${STAND_IN_URL}/test/release/${checkoutSessionId}`, { method: "POST" });
  if (!answer.ok) throw new Error(`the stand-in would not release its news: ${String(answer.status)}`);
}
