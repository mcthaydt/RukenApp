import { expect, test } from "@playwright/test";
import { pageHasSettled, signInAs, signUpInItsOwnContext } from "./support/account.ts";
import { adultOnOf, changeGame, forgetAgeOf, makeItAnOldAccount } from "./support/database.ts";
import { addGame } from "./support/game.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

test.beforeEach(forgetRateLimits);

// The command that gives an account made by email (before sign-in moved to phone numbers) its phone number. Like the
// first-owner command, its address is public, so it answers 404 to anyone without the secret.
const SECRET = "test-only-jobs-secret";
const JSON_BODY = { "content-type": "application/json" };
const WITH_SECRET = { ...JSON_BODY, authorization: `Bearer ${SECRET}` };

test("answers 404 to anyone without the secret, and gives nobody a number", async ({ request, browser }) => {
  const { number } = await signUpInItsOwnContext(browser);
  const email = await makeItAnOldAccount(number);
  const data = JSON.stringify({ email, phone: number });

  expect((await request.post("/jobs/attach-phone", { headers: JSON_BODY, data })).status()).toBe(404);
  const wrong = await request.post("/jobs/attach-phone", {
    headers: { ...JSON_BODY, authorization: "Bearer wrong" },
    data,
  });
  expect(wrong.status()).toBe(404);
  expect((await request.get("/jobs/attach-phone")).status()).not.toBe(200);
});

test("asks for an email and a number when they did not come", async ({ request }) => {
  const answer = await request.post("/jobs/attach-phone", { headers: WITH_SECRET, data: JSON.stringify({}) });

  expect(answer.status()).toBe(400);
  expect(await answer.json()).toEqual({ problem: "Send the email of the account and the phone number." });
});

test("an account made by email gets a number and signs in by phone with its old password", async ({
  request,
  browser,
  page,
}) => {
  const { number, password } = await signUpInItsOwnContext(browser);
  const email = await makeItAnOldAccount(number);

  const answer = await request.post("/jobs/attach-phone", {
    headers: WITH_SECRET,
    data: JSON.stringify({ email, phone: number }),
  });
  expect(await answer.json()).toEqual({ attached: true });
  expect(answer.status()).toBe(200);

  await signInAs(page, number, password);
  await page.goto("/me");
  await expect(page.getByText(number.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, "+1 $1 $2 $3"))).toBeVisible();

  const again = await request.post("/jobs/attach-phone", {
    headers: WITH_SECRET,
    data: JSON.stringify({ email, phone: number }),
  });
  expect(again.status()).toBe(409);
  expect(await again.json()).toEqual({ problem: "That account already has a phone number." });
});

test("gives the account its age when a birth date comes, so an 18+ game opens for it", async ({
  request,
  browser,
  page,
}) => {
  test.setTimeout(120_000);
  const game = await addGame(browser, request, { free: true });
  await changeGame(game.slug, { ageRating: "age_18", contentMarks: ["gore"] });
  const { number, password } = await signUpInItsOwnContext(browser);
  // Made before the age question was asked: no age on file. (The age goes first: the lookup is by number.)
  await forgetAgeOf(number);
  const email = await makeItAnOldAccount(number);

  const bad = await request.post("/jobs/attach-phone", {
    headers: WITH_SECRET,
    data: JSON.stringify({ email, phone: number, birthDate: { year: 2000, month: 2, day: 31 } }),
  });
  expect(bad.status()).toBe(400);
  expect(await bad.json()).toEqual({ problem: "That is not a birth date we can use." });

  const answer = await request.post("/jobs/attach-phone", {
    headers: WITH_SECRET,
    data: JSON.stringify({ email, phone: number, birthDate: { year: 1990, month: 6, day: 15 } }),
  });
  expect(await answer.json()).toEqual({ attached: true });
  expect(await adultOnOf(number)).toBe("2008-06-15");

  await signInAs(page, number, password);
  await page.goto(`/g/${game.slug}`, { waitUntil: "domcontentloaded" });
  await pageHasSettled(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(game.name);
  await expect(page.locator(".chip")).toHaveText("18+ · Gore");
});
