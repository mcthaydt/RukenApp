import { expect, test } from "@playwright/test";

// The smallest journey: the site opens. Slice 3 replaces it with "the site opens straight into the feed".
test("the home page opens", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Ruken" })).toBeVisible();
});
