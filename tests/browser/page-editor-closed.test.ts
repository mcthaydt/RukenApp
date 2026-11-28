import { expect, test, type Page } from "@playwright/test";
import { pageHasSettled, signUp } from "./support/account.ts";
import { givePage, hasPage } from "./support/database.ts";
import { asInstalled } from "./support/installed.ts";
import { showTheOwner } from "./support/look.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";
import { TEST_PAGES_COOKIE } from "../../src/features/pages/editor-switch.ts";

// Making your own page waits for the Pages slice (the owner, 2026-11-28: "Remove all maker pages things until we reach
// the slice", "the create a page that all users have"). The real site has the editor closed; the journeys' site keeps
// it open for the editor's own journeys, and this cookie shows one browser the real site's closed editor. Here nothing
// leads to it, its screens are the missing page, a form sent to it makes nothing, and a page that already exists
// stays up.

const SITE = "http://localhost:4173";

test.beforeEach(async ({ page, context }) => {
  await forgetRateLimits();
  await asInstalled(page);
  await context.addCookies([{ name: TEST_PAGES_COOKIE, value: "closed", url: SITE }]);
});

/** Every link on the screen that goes to the editor. */
function editorLinks(page: Page) {
  return page.locator('a[href^="/make/page"]');
}

test("nothing leads to making a page, and its screens are the missing page", async ({ page }, testInfo) => {
  const person = await signUp(page);

  await page.goto("/make");
  await expect(page.getByRole("heading", { name: "Your games" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Maker agreement" })).toBeVisible();
  await expect(editorLinks(page)).toHaveCount(0);
  await showTheOwner(page, testInfo, "Your games with no Your page link");

  await page.goto("/help/get-your-game-on-ruken");
  await expect(page.getByRole("heading", { name: "Get your game on Ruken" })).toBeVisible();
  await expect(editorLinks(page)).toHaveCount(0);

  await page.goto("/about");
  await expect(page.getByRole("heading", { name: "Made a game? Let people play it." })).toBeVisible();
  await expect(page.locator("#fans")).toHaveCount(0);
  await expect(editorLinks(page)).toHaveCount(0);
  await expect(page.getByText("A good-looking page for each game, made in minutes.")).toBeVisible();

  for (const path of ["/make/page", "/make/page/name", "/make/page/links", "/make/page/take-down"]) {
    const answer = await page.goto(path);
    expect(answer?.status(), path).toBe(404);
  }

  // A form sent straight to the editor is refused before it can make a page.
  const sent = await page.request.post("/make/page?/make", {
    form: { handle: "nopage" },
    headers: { origin: SITE },
    maxRedirects: 0,
  });
  expect(sent.status()).toBe(404);
  expect(await hasPage(person)).toBe(false);
});

test("a page that already exists stays up for everyone", async ({ page }) => {
  const maker = await signUp(page);
  const { handle } = await givePage(maker, { name: "Night Owl Games", oneLine: "I make small, hard games." });
  await page.goto(`/${handle}`);
  await pageHasSettled(page);
  await expect(page.getByRole("heading", { name: "Night Owl Games" })).toBeVisible();
});
