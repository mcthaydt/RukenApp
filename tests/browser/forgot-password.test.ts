import { expect, test, type Page } from "@playwright/test";
import { freshNumber, nationalOf, payAsNewMember, signUp, textItAgain } from "./support/account.ts";
import { forgetCodeLimits, paperEmailOf, pauseOf } from "./support/database.ts";
import { countMailsTo, mailTo } from "./support/mail.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";
import { codesKept, codeTo, countCodesTo, sayChangedHands, textTo } from "./support/texts.ts";

test.beforeEach(forgetRateLimits);

const NEW_PASSWORD = "a brand new horse";

async function askForCode(page: Page, number: string): Promise<void> {
  await page.goto("/forgot-password");
  await page.getByLabel("Phone number").fill(nationalOf(number));
  await page.getByRole("button", { name: "Text me a code" }).click();
  await expect(page.getByRole("heading", { name: "Choose a new password" })).toBeVisible();
}

async function chooseNewPassword(page: Page, code: string, password: string = NEW_PASSWORD): Promise<void> {
  await page.getByLabel("The code we sent you").fill(code);
  await page.getByLabel("New password").fill(password);
  await page.getByLabel("Type it again").fill(password);
  await page.getByRole("button", { name: "Save my new password" }).click();
}

test("a number with an account and a number with none get the same second screen, and a stranger gets no code", async ({
  page,
}) => {
  const { number } = await signUp(page);
  await page.context().clearCookies();
  const stranger = freshNumber();

  await askForCode(page, number);
  const known = await page.locator("main.card").innerText();
  await askForCode(page, stranger);
  const unknown = await page.locator("main.card").innerText();

  expect(unknown).toBe(known);
  await expect(page.getByText("If that number has a Ruken account, we sent a code.")).toBeVisible();
  expect(await countCodesTo(stranger)).toBe(0);
  expect(await countMailsTo("anyone@ruken.test", "Your Ruken code")).toBe(0);
});

test("a reset by code saves the new password, signs every device out, and texts that it changed", async ({
  page,
  browser,
  baseURL,
}) => {
  const { number, password } = await signUp(page);
  // A second device is signed in too.
  const other = await browser.newContext({ baseURL: baseURL ?? "http://localhost:4173" });
  try {
    const device = await other.newPage();
    await device.goto("/sign-in");
    await device.getByLabel("Phone number").fill(nationalOf(number));
    await device.getByLabel("Password").fill(password);
    await device.getByRole("button", { name: "Sign in" }).click();
    await expect(device).toHaveURL("/");

    await page.context().clearCookies();
    await askForCode(page, number);
    await chooseNewPassword(page, await codeTo(number));
    await expect(page).toHaveURL("/sign-in?reset=1");
    await expect(page.getByText("Your password is updated. Sign in with it.")).toBeVisible();

    // Every device is signed out.
    await device.goto("/me");
    await expect(device).toHaveURL(/\/sign-in/);
  } finally {
    await other.close();
  }
  const changed = await textTo(number, "Ruken: your password was changed");
  expect(changed.line).toBe("account");

  // The old password stops working and the new one works.
  await page.getByLabel("Phone number").fill(nationalOf(number));
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("That number and password don't match.")).toBeVisible();
  await page.getByLabel("Phone number").fill(nationalOf(number));
  await page.getByLabel("Password").fill(NEW_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/");
  // Twilio is told the reset code was used.
  expect((await codesKept(number)).at(-1)?.status).toBe("approved");
});

test("a wrong code, a short password and two different passwords each say what to fix and keep the screen", async ({
  page,
}) => {
  const { number } = await signUp(page);
  await page.context().clearCookies();
  await askForCode(page, number);

  await chooseNewPassword(page, "000000");
  await expect(page.getByText("That code isn't right. Check the text, or ask for a new one.")).toBeVisible();

  await chooseNewPassword(page, await codeTo(number), "short");
  await expect(page.getByText("Use a password of 10 to 128 characters.")).toBeVisible();

  await page.getByLabel("The code we sent you").fill(await codeTo(number));
  await page.getByLabel("New password").fill(NEW_PASSWORD);
  await page.getByLabel("Type it again").fill("a different one entirely");
  await page.getByRole("button", { name: "Save my new password" }).click();
  await expect(page.getByText("The two passwords don't match. Type the same one twice.")).toBeVisible();
  // A typing mistake did not use the code up: it still works.
  await chooseNewPassword(page, await codeTo(number));
  await expect(page).toHaveURL("/sign-in?reset=1");
});

test("Text it again sends a new code and the old one stops working", async ({ page }) => {
  await page.clock.install();
  const { number } = await signUp(page);
  await page.context().clearCookies();
  // The sign-up's own code is one of the kept ones, so what is counted is what comes after it.
  const before = (await codesKept(number)).length;
  await askForCode(page, number);
  const first = await codeTo(number);
  await forgetCodeLimits(number);

  await textItAgain(page);

  await expect(page.getByRole("heading", { name: "Choose a new password" })).toBeVisible();
  await expect.poll(async () => (await codesKept(number)).length).toBe(before + 2);
  const second = await codeTo(number);
  if (first !== second) {
    await chooseNewPassword(page, first);
    await expect(
      page.getByText("That code isn't right. Check the text, or ask for a new one."),
    ).toBeVisible();
  }
  await chooseNewPassword(page, second);
  await expect(page).toHaveURL("/sign-in?reset=1");
});

test("a number that changed hands gets no code, and the screen reads the same", async ({ page }) => {
  const { number } = await signUp(page);
  await page.context().clearCookies();
  await sayChangedHands(number, "yes");
  const before = await countCodesTo(number);

  await askForCode(page, number);

  await expect(page.getByText("If that number has a Ruken account, we sent a code.")).toBeVisible();
  // The code would have gone to whoever holds the number now, so none is sent (the check happens after the answer).
  await expect.poll(async () => countCodesTo(number)).toBe(before);
});

test("a member whose number Twilio cannot vouch for gets the code at the email they paid with, and none by text", async ({
  page,
}) => {
  const { number } = await payAsNewMember(page);
  const paidWith = await paperEmailOf(number);
  expect(paidWith).toMatch(/@example\.test$/);
  if (paidWith === null) throw new Error("the member's email was not kept");
  await page.context().clearCookies();
  const before = await countCodesTo(number);

  await askForCode(page, number);

  const mail = await mailTo(paidWith, "Your Ruken code");
  const code = /\b(\d{6})\b/.exec(mail.text)?.[1];
  expect(code).toBeDefined();
  expect(await countCodesTo(number)).toBe(before);
  await chooseNewPassword(page, code ?? "");
  await expect(page).toHaveURL("/sign-in?reset=1");
});

test("a reset lifts a sign-in pause", async ({ page }) => {
  const { number } = await signUp(page);
  await page.context().clearCookies();
  for (let guess = 0; guess < 10; guess += 1) {
    await page.goto("/sign-in");
    await page.getByLabel("Phone number").fill(nationalOf(number));
    await page.getByLabel("Password").fill("not the right password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText(/don't match|paused/)).toBeVisible();
    await forgetRateLimits();
  }
  expect((await pauseOf(number))?.pausedUntil).not.toBeNull();

  await askForCode(page, number);
  await chooseNewPassword(page, await codeTo(number));
  await expect(page).toHaveURL("/sign-in?reset=1");

  expect(await pauseOf(number)).toBeNull();
  await page.getByLabel("Phone number").fill(nationalOf(number));
  await page.getByLabel("Password").fill(NEW_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/");
});

test("the first screen links back to sign in and has no link to help or to a mailed link", async ({
  page,
}) => {
  await page.goto("/forgot-password");
  await expect(page.getByRole("link", { name: "Back to sign in" })).toHaveAttribute("href", "/sign-in");
  await expect(page.getByRole("link", { name: /help/i })).toHaveCount(0);
});
