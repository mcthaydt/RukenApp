import { expect, test } from "@playwright/test";
import { pageHasSettled, signUp } from "./support/account.ts";
import { addPlays, showsPlayerCountOf } from "./support/database.ts";
import { gameWhere } from "./support/game.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";
import { consented } from "./support/consent.ts";

test.beforeEach(forgetRateLimits);

// The maker's switch for the player count (spec 5): off until the maker turns it on, and the page says nothing about
// it while it is off.

const PLAYED = /played it this week\./;
const switchButton = (page: import("@playwright/test").Page) =>
  page.getByRole("button", { name: /^Show how many people played it: (On|Off)$/ });

test("a new game shows no player line; once the maker turns it on, the page says how many played", async ({
  page,
}) => {
  const { slug } = await gameWhere(page, { state: "live" });
  await addPlays(slug, 1, 1);

  await page.goto(`/g/${slug}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByText(PLAYED)).toHaveCount(0);

  await page.goto(`/make/${slug}`);
  await pageHasSettled(page);
  await expect(switchButton(page)).toHaveAccessibleName("Show how many people played it: Off");
  await expect(page.getByText(/Players see it on .+'s page\./)).toBeVisible();
  await switchButton(page).click();
  await expect(switchButton(page)).toHaveAccessibleName("Show how many people played it: On");
  expect(await showsPlayerCountOf(slug)).toBe(true);

  await page.goto(`/g/${slug}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByText("1 person played it this week.")).toBeVisible();

  await page.goto(`/make/${slug}`);
  await switchButton(page).click();
  await expect(switchButton(page)).toHaveAccessibleName("Show how many people played it: Off");
  await page.goto(`/g/${slug}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByText(PLAYED)).toHaveCount(0);
});

test("the switch works by keyboard, shows its focus and is at least 44 by 44", async ({ page }) => {
  const { slug } = await gameWhere(page, { state: "live" });
  await page.goto(`/make/${slug}`);
  await pageHasSettled(page);

  let reached = false;
  for (let tabs = 0; tabs < 15 && !reached; tabs += 1) {
    await page.keyboard.press("Tab");
    reached = await switchButton(page).evaluate((button) => button === document.activeElement);
  }
  expect(reached, "Tab reaches the switch").toBe(true);
  expect(await switchButton(page).evaluate((button) => getComputedStyle(button).outlineStyle)).not.toBe(
    "none",
  );
  const box = await switchButton(page).boundingBox();
  expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);

  await page.keyboard.press("Enter");
  await expect(switchButton(page)).toHaveAccessibleName("Show how many people played it: On");
});

test("with no script the form still posts", async ({ page, browser, baseURL }) => {
  const { slug } = await gameWhere(page, { state: "live" });
  const quiet = await browser.newContext({
    ...consented,
    baseURL: baseURL ?? "http://localhost:4173",
    javaScriptEnabled: false,
    storageState: await page.context().storageState(),
  });
  try {
    const bare = await quiet.newPage();
    // Without script there is no "settled" to wait for, so the screen's entrance is skipped, as reduced motion does.
    await bare.emulateMedia({ reducedMotion: "reduce" });
    await bare.goto(`/make/${slug}`);
    // Pressed from the keyboard: on a phone the fixed bar of buttons can sit over a button a mouse press aims for.
    await switchButton(bare).focus();
    await bare.keyboard.press("Enter");
    await expect(switchButton(bare)).toHaveAccessibleName("Show how many people played it: On");
  } finally {
    await quiet.close();
  }
  expect(await showsPlayerCountOf(slug)).toBe(true);
});

test("another account's post is refused and changes nothing", async ({ page, browser, baseURL }) => {
  const { slug } = await gameWhere(page, { state: "live" });
  const site = baseURL ?? "http://localhost:4173";
  const stranger = await browser.newContext({ ...consented, baseURL: site });
  try {
    await signUp(await stranger.newPage());
    const posted = await stranger.request.post(`/make/${slug}?/playerCount`, {
      form: { show: "on" },
      headers: { origin: site },
    });
    expect(posted.status()).toBe(404);
  } finally {
    await stranger.close();
  }
  expect(await showsPlayerCountOf(slug)).toBe(false);
});
