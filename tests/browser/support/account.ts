import { expect, type Browser, type Page } from "@playwright/test";

/** The password every journey's new account uses. */
export const JOURNEY_PASSWORD = "a long enough password";

/** An address no other journey has used, so journeys can run side by side on one database. */
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
 * Makes a new account through the sign-up form, as a person would, and waits for the page it lands
 * on. The person is signed in afterwards.
 */
export async function signUp(page: Page): Promise<{ email: string; password: string }> {
  const email = freshEmail();
  await page.goto("/sign-up");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(JOURNEY_PASSWORD);
  await fillBirthDate(page, yearsAgo(30));
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL("/");
  return { email, password: JOURNEY_PASSWORD };
}

/** Where `wrangler dev` serves the site, for a browser context made by hand (such a context has no config of its own). */
const SITE_URL = "http://localhost:4173";
/** The stand-in Stripe (tests/browser/support/fake-stripe-server.ts). */
const STAND_IN_URL = "http://127.0.0.1:12111";

/**
 * Makes an account in a browser of its own and closes it, for a journey that needs a second person (a maker, standing
 * in until the maker's own pages exist). The first person's cookies are untouched.
 */
export async function signUpInItsOwnContext(browser: Browser): Promise<{ email: string; password: string }> {
  const context = await browser.newContext({ baseURL: SITE_URL });
  try {
    return await signUp(await context.newPage());
  } finally {
    await context.close();
  }
}

/**
 * Signs a new person up, opens the card, pays on the stand-in Stripe, and waits for `/me`, where the card sends
 * them. `checkoutSessionId` is the stand-in's name for what was paid, read from its page's address, so a journey
 * can ask the stand-in what it thinks later.
 */
export async function payAsNewMember(page: Page): Promise<{ email: string; checkoutSessionId: string }> {
  const { email } = await signUp(page);
  await page.goto("/join?next=/me");
  await page.getByRole("button", { name: "Continue to payment" }).click();
  await expect(page.getByRole("button", { name: "Pay" })).toBeVisible();
  const checkoutSessionId = new URL(page.url()).pathname.split("/").pop() ?? "";
  await page.getByRole("button", { name: "Pay" }).click();
  await expect(page).toHaveURL("/me");
  return { email, checkoutSessionId };
}

/** What the stand-in Stripe says the status of a paid checkout's subscription is: "active", "canceled", or "none". */
export async function subscriptionStatusAtStandIn(member: { checkoutSessionId: string }): Promise<string> {
  const answer = await fetch(`${STAND_IN_URL}/state/${member.checkoutSessionId}`);
  return answer.text();
}
