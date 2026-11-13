import { expect, type Page } from "@playwright/test";

/** The password every journey's new account uses. */
export const JOURNEY_PASSWORD = "a long enough password";

/** An address no other journey has used, so journeys can run side by side on one database. */
export function freshEmail(): string {
  return `journey+${crypto.randomUUID().slice(0, 12)}@ruken.test`;
}

/** A birth date this many whole years before today, safely past the birthday so the age is exact. */
export function yearsAgo(years: number): { month: string; day: string; year: string } {
  const now = new Date();
  return { month: "1", day: "1", year: String(now.getFullYear() - years - 1) };
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
