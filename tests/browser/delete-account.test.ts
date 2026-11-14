import { expect, test, type Page } from "@playwright/test";
import { rgb, token } from "../support/look-tokens.ts";
import { signUp } from "./support/account.ts";
import { expectOneCard, showTheOwner } from "./support/look.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

test.beforeEach(forgetRateLimits);

const WELCOME_BACK = "Welcome back. Your account will not be deleted.";

/** Makes an account, asks to delete it from /me, and lands on /goodbye signed out. */
async function askToBeDeleted(page: Page): Promise<{ email: string; password: string }> {
  const account = await signUp(page);
  await page.goto("/me");
  await page.getByRole("link", { name: "Delete my account" }).click();
  await page.getByRole("button", { name: "Delete my account" }).click();
  await expect(page.getByRole("heading", { name: "Your account will be deleted." })).toBeVisible();
  return account;
}

test("a person asks to be deleted, is signed out, and is told the date", async ({ page }, testInfo) => {
  await signUp(page);
  await page.goto("/me");
  await page.getByRole("link", { name: "Delete my account" }).click();
  await expect(page.getByRole("heading", { name: "Delete your account?" })).toBeVisible();
  await expectOneCard(page);
  await showTheOwner(page, testInfo, "delete your account");
  await page.getByRole("button", { name: "Delete my account" }).click();
  await expect(page.getByRole("heading", { name: "Your account will be deleted." })).toBeVisible();
  await expect(page.getByText(/^We'll delete it on \w+, \w+ \d+\. You're signed out now\.$/)).toBeVisible();
  await expectOneCard(page);
  await showTheOwner(page, testInfo, "signed out, to be deleted");
  // Review Focus 7: the old session cookie of an account that is waiting to be deleted works no more.
  await page.goto("/me");
  await expect(page).toHaveURL(/\/sign-in/);
});

test("signing in again within the 14 days undoes it, and says so once", async ({ page }) => {
  const { email, password } = await askToBeDeleted(page);
  await page.goto("/sign-in?next=%2Fme");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/me");
  await expect(page.getByText(WELCOME_BACK)).toBeVisible();
  // The line sits on the darker felt, as a panel above the card (design 5.8).
  await expect(page.getByRole("status")).toHaveCSS("background-color", rgb(token("--felt-deep")));
  await page.reload();
  await expect(page.getByText(WELCOME_BACK)).toHaveCount(0);
  // The account is back, not only the line: the page is the person's own again.
  await expect(page.getByRole("heading", { name: "Your account" })).toBeVisible();
});

test("Keep my account goes back and deletes nothing", async ({ page }) => {
  await signUp(page);
  await page.goto("/me/delete");
  await page.getByRole("link", { name: "Keep my account" }).click();
  await expect(page).toHaveURL("/me");
  await expect(page.getByRole("heading", { name: "Your account" })).toBeVisible();
});

test("a signed-out person is sent to sign in first", async ({ page }) => {
  await page.goto("/me/delete");
  await expect(page).toHaveURL("/sign-in?next=%2Fme%2Fdelete");
});

// The Owner, 2026-11-14, "All six": "Sign in" in "Changed your mind? Sign in before then." is a link to sign in.
test("the goodbye screen's Sign in is a link, and it leads to sign in", async ({ page }) => {
  await askToBeDeleted(page);
  await expect(page.getByText("Changed your mind? Sign in before then.")).toBeVisible();
  const signIn = page.getByRole("link", { name: "Sign in", exact: true });
  // Back on /me, so the welcome-back line and the account are the first thing they see.
  await expect(signIn).toHaveAttribute("href", "/sign-in?next=%2Fme");
  await signIn.click();
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("/goodbye says nothing of a date it cannot read, and does not say an account will be deleted", async ({
  page,
}) => {
  await page.goto("/goodbye?on=soon");
  await expect(page.getByRole("heading", { name: "You're signed out." })).toBeVisible();
  await expect(page.getByText(/delete/i)).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Back to Ruken" })).toHaveAttribute("href", "/");
});
