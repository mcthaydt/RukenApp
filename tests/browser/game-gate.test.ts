import { expect, test } from "@playwright/test";

// The game gate runs beside the app as its own Worker (cloudflare/games), on addresses of its own. `*.localhost`
// names reach 127.0.0.1 in the browser, so a game's name is the first part of the address, as on the real games
// domain.

test("the gate answers on its own address", async ({ page }) => {
  expect((await page.goto("http://media.localhost:8788/__ruken/health"))?.status()).toBe(200);
});

test("a game's address gives nothing without a pass", async ({ page }) => {
  const response = await page.goto("http://g-aaaaaaaaaa.localhost:8788/index.html");
  expect(response?.status()).toBe(403);
  await expect(page.getByText("This game's link has run out. Go back and press Play again.")).toBeVisible();
});
