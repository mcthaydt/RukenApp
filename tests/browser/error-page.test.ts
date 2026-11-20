import { expect, test } from "@playwright/test";
import { addGame } from "./support/game.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

// The page every failure lands on says in one line what happened and gives one way back.
test("an address nobody serves says so and offers the way back", async ({ page }) => {
  await page.goto("/no-such-page");
  await expect(page.getByRole("heading", { name: "We can't find that page." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to Ruken" })).toHaveAttribute("href", "/");
});

test("opening a lot of games in a minute says so, and offers the way back", async ({
  page,
  browser,
  request,
}) => {
  test.setTimeout(120_000);
  const free = await addGame(browser, request, { free: true });
  await forgetRateLimits();
  for (let opened = 0; opened < 30; opened += 1) await request.get(`/g/${free.slug}/play`);
  const answer = await page.goto(`/g/${free.slug}/play`, { waitUntil: "domcontentloaded" });
  expect(answer?.status()).toBe(429);
  await expect(page.getByRole("heading", { name: "You've opened a lot of games just now." })).toBeVisible();
  await expect(page.getByText("Try again in a minute.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to Ruken" })).toBeVisible();
});
