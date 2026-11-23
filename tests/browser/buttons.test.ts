import { expect, test } from "@playwright/test";
import { rgb, token } from "../support/look-tokens.ts";
import { signUp } from "./support/account.ts";
import { buttonColour, CARD_SCREENS, filledButtons, pipRed } from "./support/look.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

// Spec 1 and 15.1: "safe is green, not safe is red, rest is blue". These journeys read the colours the browser
// really paints, on every screen Ruken had before the maker's screens.
test.beforeEach(forgetRateLimits);

for (const screen of CARD_SCREENS) {
  test(`${screen.name}: its one main button is blue with white words`, async ({ page }) => {
    await screen.open(page);
    const main = filledButtons(page);
    expect(await main.count()).toBeLessThanOrEqual(1);
    if ((await main.count()) === 1) {
      await expect(main).toHaveCSS("background-color", await buttonColour(main, "--pay"));
      await expect(main).toHaveCSS("color", rgb(token("--chalk")));
    }
  });
}

test("deleting an account: green keeps, red deletes, and nothing is blue", async ({ page }) => {
  await signUp(page);
  await page.goto("/me/delete");
  const keep = page.getByRole("link", { name: "Keep my account" });
  await expect(keep).toHaveCSS("background-color", await buttonColour(keep, "--felt-raised"));
  await expect(page.getByRole("button", { name: "Delete my account" })).toHaveCSS(
    "background-color",
    rgb(token("--pip")),
  );
  await expect(filledButtons(page)).toHaveCount(0);
  // Red is only for what can't be undone, so this one button is the only red thing on the screen.
  expect(await pipRed(page)).toEqual(["Delete my account"]);
  // Enter on this screen must not delete anything, so the first thing in reach is the safe button.
  await expect(keep).toBeFocused();
});

test("Your account has a door to the maker's area", async ({ page }) => {
  await signUp(page);
  await page.goto("/me");
  await page.getByRole("link", { name: "Add your games to Ruken" }).click();
  await expect(page).toHaveURL(/\/make$/);
});
