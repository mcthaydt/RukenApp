import { expect, test } from "@playwright/test";

// The page every failure lands on says in one line what happened and gives one way back.
test("an address nobody serves says so and offers the way back", async ({ page }) => {
  await page.goto("/no-such-page");
  await expect(page.getByRole("heading", { name: "We can't find that page." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to Ruken" })).toHaveAttribute("href", "/");
});
