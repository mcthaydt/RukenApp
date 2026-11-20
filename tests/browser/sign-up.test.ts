import { expect, test } from "@playwright/test";
import { shownAs } from "../../src/features/accounts/phone.ts";
import {
  finishSignUpForm,
  freshNumber,
  JOURNEY_PASSWORD,
  nationalOf,
  signInAs,
  signUp,
  startSignUpForm,
} from "./support/account.ts";
import { forgetCodeLimits, userIdOf } from "./support/database.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";
import { codesKept, codeTo, countCodesTo, failNextTextTo } from "./support/texts.ts";

test.beforeEach(forgetRateLimits);

// Each journey runs on a phone and on a computer, against one shared database, so every account uses a fresh
// number. The codes are the ones the stand-in Twilio kept.

test("a stranger makes an account with a texted code and lands signed in, and the code is reported used", async ({
  page,
}) => {
  const number = freshNumber();
  await page.goto("/sign-up?next=/me");
  await expect(page.getByRole("heading", { name: "Join Ruken", exact: true })).toBeVisible();
  await finishSignUpForm(page, number);
  await expect(page).toHaveURL("/me");
  await expect(page.getByText(shownAs(number)).first()).toBeVisible();
  // Twilio is told the code was used, so Verify does not leave a ten-minute code open (it happens after the answer).
  await expect.poll(async () => (await codesKept(number)).map((code) => code.status)).toEqual(["approved"]);
});

test("a number typed with brackets and dashes is the same account as +1 and spaces", async ({ page }) => {
  const number = freshNumber();
  await page.goto("/sign-up");
  await page.getByLabel("Phone number").fill(`(${nationalOf(number).slice(0, 3)}) ${nationalOf(number).slice(3, 6)}-${nationalOf(number).slice(6)}`);
  await page.getByLabel("Password").fill(JOURNEY_PASSWORD);
  await page.getByLabel("Month").fill("1");
  await page.getByLabel("Day").fill("1");
  await page.getByLabel("Year").fill("1990");
  await page.getByRole("button", { name: "Text me a code" }).click();
  await page.getByLabel("The code we texted you").fill(await codeTo(number));
  await page.getByRole("button", { name: "Join Ruken" }).click();
  await expect(page).toHaveURL("/");
  // Found again at sign-in whichever way it is typed.
  await page.context().clearCookies();
  await page.goto("/sign-in");
  await page.getByLabel("Phone number").fill(`1 ${nationalOf(number).slice(0, 3)} ${nationalOf(number).slice(3)}`);
  await page.getByLabel("Password").fill(JOURNEY_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/");
  expect(await userIdOf(number)).toMatch(/\S/);
});

test("a short password says what to fix, keeps the number, and sends no text", async ({ page }) => {
  const number = freshNumber();
  await page.goto("/sign-up");
  await page.getByLabel("Phone number").fill(nationalOf(number));
  await page.getByLabel("Password").fill("too short");
  await page.getByLabel("Month").fill("1");
  await page.getByLabel("Day").fill("1");
  await page.getByLabel("Year").fill("1990");
  await page.getByRole("button", { name: "Text me a code" }).click();
  await expect(page.getByText("Use a password of 10 to 128 characters.")).toBeVisible();
  await expect(page.getByLabel("Phone number")).toHaveValue(nationalOf(number));
  await expect(page.getByLabel("Password")).toHaveValue("");
  expect(await countCodesTo(number)).toBe(0);
});

test("something that is not a number says so", async ({ page }) => {
  await page.goto("/sign-up");
  await page.getByLabel("Phone number").fill("not a number");
  await page.getByLabel("Password").fill(JOURNEY_PASSWORD);
  await page.getByLabel("Month").fill("1");
  await page.getByLabel("Day").fill("1");
  await page.getByLabel("Year").fill("1990");
  await page.getByRole("button", { name: "Text me a code" }).click();
  await expect(page.getByText("That doesn't look like a phone number. Check it and try again.")).toBeVisible();
});

// The stranger sees the same screens as anyone, and the code never signs them in to someone else's account.
test("a number that already has an account gets the same code screen, no code, and no way in", async ({
  page,
  browser,
}) => {
  const { number } = await signUpInTheirOwnContext(browser);
  const before = await countCodesTo(number);

  await page.goto("/sign-up");
  await startSignUpForm(page, number, "another long password");
  await expect(page.getByText("No text? Check the number, or")).toBeVisible();
  // Nothing was texted as a code: a code that could never work would be worse than none.
  expect(await countCodesTo(number)).toBe(before);
  await page.getByLabel("The code we texted you").fill("123456");
  await page.getByRole("button", { name: "Join Ruken" }).click();
  await expect(page.getByText("That code isn't right. Check the text, or ask for a new one.")).toBeVisible();
  await page.goto("/me");
  await expect(page).toHaveURL(/\/sign-in/);
});

test("a wrong code says so and keeps the code screen", async ({ page }) => {
  const number = freshNumber();
  await page.goto("/sign-up");
  await startSignUpForm(page, number);
  await page.getByLabel("The code we texted you").fill("000000");
  await page.getByRole("button", { name: "Join Ruken" }).click();
  await expect(page.getByText("That code isn't right. Check the text, or ask for a new one.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "We texted you a code" })).toBeVisible();
  // The right one still works, since a wrong guess does not use the code up.
  await page.getByLabel("The code we texted you").fill(await codeTo(number));
  await page.getByRole("button", { name: "Join Ruken" }).click();
  await expect(page).toHaveURL("/");
});

test("ten wrong codes pause codes for the number, in the same words as for a number with no account", async ({
  page,
}) => {
  const number = freshNumber();
  await page.goto("/sign-up");
  await startSignUpForm(page, number);
  for (let guess = 0; guess < 10; guess += 1) {
    await page.getByLabel("The code we texted you").fill("000000");
    await page.getByRole("button", { name: "Join Ruken" }).click();
    await expect(page.getByText(/That code isn't right|Too many wrong codes/)).toBeVisible();
  }
  await page.getByLabel("The code we texted you").fill(await codeTo(number));
  await page.getByRole("button", { name: "Join Ruken" }).click();
  await expect(page.getByText("Too many wrong codes. Codes are paused for an hour for this number.")).toBeVisible();
});

test("Text it again sends a new code and the old one stops working", async ({ page }) => {
  const number = freshNumber();
  await page.goto("/sign-up");
  await startSignUpForm(page, number);
  const first = await codeTo(number);
  await forgetCodeLimits(number);

  await page.getByRole("button", { name: "Text it again" }).click();

  await expect(page.getByRole("heading", { name: "We texted you a code" })).toBeVisible();
  await expect.poll(async () => (await codesKept(number)).length).toBe(2);
  const second = await codeTo(number);
  expect((await codesKept(number)).map((code) => code.status)).toEqual(["canceled", "pending"]);
  await page.getByLabel("The code we texted you").fill(first === second ? "000000" : first);
  await page.getByRole("button", { name: "Join Ruken" }).click();
  await expect(page.getByText("That code isn't right. Check the text, or ask for a new one.")).toBeVisible();
  await page.getByLabel("The code we texted you").fill(second);
  await page.getByRole("button", { name: "Join Ruken" }).click();
  await expect(page).toHaveURL("/");
});

test("when Twilio fails, the code screen still shows and Text it again works", async ({ page }) => {
  const number = freshNumber();
  await failNextTextTo(number);
  await page.goto("/sign-up");
  await startSignUpForm(page, number);
  expect(await countCodesTo(number)).toBe(0);
  await forgetCodeLimits(number);

  await page.getByRole("button", { name: "Text it again" }).click();

  await page.getByLabel("The code we texted you").fill(await codeTo(number));
  await page.getByRole("button", { name: "Join Ruken" }).click();
  await expect(page).toHaveURL("/");
});

// The password and the birthday are kept for the browser that started the sign-up, and for no other.
test("a second browser cannot choose the password, even when it has the code", async ({ page, browser, baseURL }) => {
  const number = freshNumber();
  await page.goto("/sign-up");
  await startSignUpForm(page, number, "the first long password");

  const other = await browser.newContext({ baseURL: baseURL ?? "http://localhost:4173" });
  try {
    const stranger = await other.newPage();
    await stranger.goto("/sign-up");
    await startSignUpForm(stranger, number, "a stranger's long password");
    await stranger.getByLabel("The code we texted you").fill("000000");
    await stranger.getByRole("button", { name: "Join Ruken" }).click();
    await expect(stranger.getByText("That code isn't right. Check the text, or ask for a new one.")).toBeVisible();
  } finally {
    await other.close();
  }

  // The person who owns the phone types the code they got, and the password they chose is the one that works.
  await forgetCodeLimits(number);
  await page.getByLabel("The code we texted you").fill(await codeTo(number));
  await page.getByRole("button", { name: "Join Ruken" }).click();
  await expect(page).toHaveURL("/");
  await page.context().clearCookies();
  await page.goto("/sign-in");
  await page.getByLabel("Phone number").fill(nationalOf(number));
  await page.getByLabel("Password").fill("a stranger's long password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("That number and password don't match. Try again, or reset your password.")).toBeVisible();
  await signInAs(page, number, "the first long password");
});

test("someone under 13 is told to come back, and no text is sent", async ({ page }) => {
  const number = freshNumber();
  await page.goto("/sign-up");
  await page.getByLabel("Phone number").fill(nationalOf(number));
  await page.getByLabel("Password").fill(JOURNEY_PASSWORD);
  const young = new Date();
  young.setFullYear(young.getFullYear() - 12);
  young.setDate(young.getDate() - 2);
  await page.getByLabel("Month").fill(String(young.getMonth() + 1));
  await page.getByLabel("Day").fill(String(young.getDate()));
  await page.getByLabel("Year").fill(String(young.getFullYear()));
  await page.getByRole("button", { name: "Text me a code" }).click();
  await expect(page.getByRole("heading", { name: "Ruken isn't for you yet." })).toBeVisible();
  await expect(page.getByText("Come back when you're 13.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to Ruken" })).toHaveAttribute("href", "/");
  expect(await countCodesTo(number)).toBe(0);
});

test("next pointing off the site lands on the home page", async ({ page }) => {
  await page.goto("/sign-up?next=https://evil.example");
  await finishSignUpForm(page, freshNumber());
  await expect(page).toHaveURL("/");
});

// The site's cookies stay on its own name. On the shared test address a cookie with a `Domain` would reach the games
// that live beside the site, so none may carry one. The sign-up's own cookie is not `__Host-`, because its path is
// /sign-up.
test("no cookie the site sets is shared with other names", async ({ page }) => {
  await signUp(page);
  const cookies = await page.context().cookies();
  expect(cookies.length).toBeGreaterThan(0);
  for (const cookie of cookies) expect(cookie.domain.startsWith(".")).toBe(false);
});

test("the sign-up's own cookie is only for the sign-up, and is gone once it is done", async ({ page }) => {
  const number = freshNumber();
  await page.goto("/sign-up");
  await startSignUpForm(page, number);
  const during = (await page.context().cookies()).find((cookie) => cookie.name === "ruken_sign_up");
  expect(during).toMatchObject({ path: "/sign-up", httpOnly: true, sameSite: "Lax" });
  await page.getByLabel("The code we texted you").fill(await codeTo(number));
  await page.getByRole("button", { name: "Join Ruken" }).click();
  await expect(page).toHaveURL("/");
  expect((await page.context().cookies()).find((cookie) => cookie.name === "ruken_sign_up")).toBeUndefined();
});

test("it works with no script at all", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL: baseURL ?? "http://localhost:4173", javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    const number = freshNumber();
    await page.goto("/sign-up");
    await startSignUpForm(page, number);
    await page.getByLabel("The code we texted you").fill(await codeTo(number));
    await page.getByRole("button", { name: "Join Ruken" }).click();
    await expect(page).toHaveURL("/");
  } finally {
    await context.close();
  }
});

/** Makes an account in a browser of its own, the way `signUpInItsOwnContext` does, and answers its number. */
async function signUpInTheirOwnContext(browser: import("@playwright/test").Browser): Promise<{ number: string }> {
  const context = await browser.newContext({ baseURL: "http://localhost:4173" });
  try {
    const page = await context.newPage();
    return await signUp(page);
  } finally {
    await context.close();
  }
}
