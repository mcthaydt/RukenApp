import { expect, test, type Page } from "@playwright/test";
import { forgetRateLimits } from "./support/rate-limits.ts";

// Inside the app no scrollbar shows (the owner, 2026-11-23: "The scrollbar shouldn't show once you're in the app, like
// the feed, scrollbar is for landing page only"). The page still scrolls by touch, wheel and keys; only the bar is gone.
// The landing page (/about) keeps its own thin green one. Nothing here is made or saved, so there is no create, update
// or delete.

test.beforeEach(forgetRateLimits);

const LONG = "/help/how-the-feed-works";

/** The elements on the page whose scrollbar the browser would still draw. */
async function withABar(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [document.documentElement, ...document.querySelectorAll("body, body *")]
      .filter((el) => getComputedStyle(el).scrollbarWidth !== "none")
      .map((el) => `${el.tagName.toLowerCase()} ${el.getAttribute("class") ?? ""}`.trim()),
  );
}

test("no scrollbar shows inside the app, and the page still scrolls", async ({ page, isMobile }) => {
  for (const screen of ["/", "/help", LONG, "/sign-in"]) {
    await page.goto(screen);
    await page.locator("main").first().waitFor();
    expect(await withABar(page), screen).toEqual([]);
  }

  await page.goto(LONG);
  await expect(page.getByRole("heading", { level: 1, name: "How the feed works" })).toBeVisible();
  // The bar takes no room at the side either.
  expect(await page.evaluate(() => innerWidth - document.documentElement.clientWidth)).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollHeight > innerHeight)).toBe(true);

  await page.keyboard.press("End");
  // Safari's engine glides there, and a key pressed mid-glide is lost, so wait until the page has come to rest at the end.
  await expect
    .poll(() =>
      page.evaluate(() => Math.ceil(scrollY + innerHeight) >= document.documentElement.scrollHeight - 1),
    )
    .toBe(true);
  await page.keyboard.press("Home");
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
  if (!isMobile) {
    await page.mouse.move(200, 200);
    await page.mouse.wheel(0, 600);
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
  }
});

test("the landing page keeps its own thin scrollbar", async ({ page }) => {
  await page.goto("/about");
  await page.locator("main.about").waitFor();
  await expect(page.locator("html")).toHaveCSS("scrollbar-width", "thin");
});
