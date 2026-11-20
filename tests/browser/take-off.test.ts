import { expect, test, type Page } from "@playwright/test";
import { pageHasSettled, signInAs, signUp } from "./support/account.ts";
import { putGameWhereStaffLeaveIt, stateOf } from "./support/database.ts";
import { addDraft, addGame, gameWhere, MAKER_ADDRESSES, startDraft } from "./support/game.ts";
import { boxOf, layoutHasSettled, pipRed, showTheOwner } from "./support/look.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

test.beforeEach(forgetRateLimits);

// A maker takes their own live game off Ruken, and puts it back (spec 13.1 M1 and M2). Only putting it back needs a game
// made through the real screens, because it copies from GitHub again and so needs a maker who connected it; the rest
// make their live game from rows.

/** A live game's maker takes it off on the real screens and lands on its page. */
async function takeOff(page: Page, slug: string): Promise<void> {
  await page.goto(`/make/${slug}/take-off`);
  await pageHasSettled(page);
  await page.getByRole("button", { name: "Take it off Ruken" }).click();
  await expect(page).toHaveURL(`/make/${slug}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Taken off Ruken");
}

test("a maker takes a live game off Ruken, and is told it can come back", async ({ page }, testInfo) => {
  const { slug, name } = await gameWhere(page, { state: "live" });
  await page.goto(`/make/${slug}/take-off`);
  await pageHasSettled(page);

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Take ${name} off Ruken?`);
  await expect(page.getByText("You can put it back later. We'll check it again first.")).toBeVisible();
  await expect(page.getByText("You can't undo this.")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Keep it on Ruken" })).toBeFocused();
  // The one thing that cannot be undone is the only red.
  expect(await pipRed(page)).toEqual(["Take it off Ruken"]);
  await showTheOwner(page, testInfo, "taking a game off Ruken");

  await page.getByRole("button", { name: "Take it off Ruken" }).click();

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Taken off Ruken");
  await expect(page.getByText("Players can't find it or play it. Nothing changed on GitHub.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Put it back on Ruken" })).toBeVisible();
  await expect(
    page.getByText("Copies the newest version of your game from GitHub and sends it for review."),
  ).toBeVisible();
  expect(await pipRed(page)).toEqual([]);
  await showTheOwner(page, testInfo, "a game taken off Ruken");
  expect(await stateOf(slug)).toBe("taken_off");
  // It is off: the question is not asked a second time.
  expect((await page.request.get(`/make/${slug}/take-off`)).status()).toBe(404);
});

test("Keep it on Ruken changes nothing", async ({ page }) => {
  const { slug } = await gameWhere(page, { state: "live" });
  await page.goto(`/make/${slug}/take-off`);
  await pageHasSettled(page);

  await page.getByRole("link", { name: "Keep it on Ruken" }).click();

  await expect(page).toHaveURL(`/make/${slug}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Live");
  expect(await stateOf(slug)).toBe("live");
});

test("putting it back copies the newest version and sends it for review", async ({
  page,
  browser,
  request,
}) => {
  test.setTimeout(90_000);
  const game = await addGame(browser, request);
  await signInAs(page, game.maker.number, game.maker.password);
  await takeOff(page, game.slug);

  await page.getByRole("button", { name: "Put it back on Ruken" }).click();

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Waiting for review");
  expect(await stateOf(game.slug)).toBe("waiting");
});

test("a copy GitHub refuses leaves it off, and says why", async ({ page }) => {
  // A game made from rows has a maker who never connected GitHub, so the copy is refused.
  const { slug } = await gameWhere(page, { state: "live" });
  await takeOff(page, slug);

  await page.getByRole("button", { name: "Put it back on Ruken" }).click();

  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Taken off Ruken");
  await expect(page.getByRole("button", { name: "Put it back on Ruken" })).toBeVisible();
  expect(await stateOf(slug)).toBe("taken_off");
});

test("the screen works by keyboard alone, with focus showing", async ({ page }) => {
  const { slug } = await gameWhere(page, { state: "live" });
  await takeOff(page, slug);
  await pageHasSettled(page);

  const reached = new Map<string, string>();
  for (let tabs = 0; tabs < 12; tabs += 1) {
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => {
      const there = document.activeElement;
      return there === null
        ? null
        : { name: there.textContent.trim(), outline: getComputedStyle(there).outlineStyle };
    });
    if (focused !== null) reached.set(focused.name, focused.outline);
  }

  for (const name of ["Put it back on Ruken", "Back to your games"]) {
    expect(reached.has(name), `Tab reaches ${name}`).toBe(true);
    expect(reached.get(name), `${name} shows its focus`).not.toBe("none");
  }
});

test("Back to your games starts at the same left edge as the words above it", async ({ page }) => {
  const { slug } = await gameWhere(page, { state: "live" });
  await takeOff(page, slug);
  await layoutHasSettled(page);

  const heading = await boxOf(page.getByRole("heading", { level: 1 }));
  const back = await boxOf(page.getByRole("link", { name: "Back to your games" }));
  expect(Math.abs(back.x - heading.x)).toBeLessThanOrEqual(1);
});

test("the question works by keyboard alone: Enter keeps the game, Tab reaches the red button with focus showing", async ({
  page,
}) => {
  const { slug } = await gameWhere(page, { state: "live" });
  await page.goto(`/make/${slug}/take-off`);
  await pageHasSettled(page);
  await expect(page.getByRole("link", { name: "Keep it on Ruken" })).toBeFocused();

  await page.keyboard.press("Tab");
  const red = page.getByRole("button", { name: "Take it off Ruken" });
  await expect(red).toBeFocused();
  expect(await red.evaluate((button) => getComputedStyle(button).outlineStyle)).not.toBe("none");

  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(`/make/${slug}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Live");
  expect(await stateOf(slug)).toBe("live");
});

test("nothing scrolls sideways, and the blue button is in view", async ({ page }) => {
  const { slug } = await gameWhere(page, { state: "live" });
  await takeOff(page, slug);
  await layoutHasSettled(page);

  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
  ).toBe(true);
  const button = await boxOf(page.getByRole("button", { name: "Put it back on Ruken" }));
  const window = page.viewportSize();
  expect(button.y).toBeGreaterThanOrEqual(0);
  expect(button.y + button.height).toBeLessThanOrEqual(window?.height ?? 0);
});

test("only a live game has the question", async ({ page }) => {
  const draft = await startDraft(page);
  // The same maker's second game: signing up again while signed in would find no sign-up form.
  const waiting = await addDraft(page);
  await putGameWhereStaffLeaveIt(waiting.slug, { state: "waiting" });

  expect((await page.request.get(`/make/${draft.slug}/take-off`)).status()).toBe(404);
  expect((await page.request.get(`/make/${waiting.slug}/take-off`)).status()).toBe(404);
});

test("another maker's game is a missing page, at the two new actions too", async ({
  page,
  browser,
  baseURL,
}) => {
  const { slug } = await gameWhere(page, { state: "live" });
  const site = baseURL ?? "http://localhost:4173";
  const stranger = await browser.newContext({ baseURL: site });
  try {
    const other = await stranger.newPage();
    await signUp(other);
    for (const { path, form } of MAKER_ADDRESSES(slug).filter(({ path }) =>
      /take-off|putBack|deleteLeft/.test(path),
    )) {
      expect((await other.goto(path))?.status(), `GET ${path}`).toBe(404);
      if (form !== undefined) {
        const posted = await stranger.request.post(path, { form, headers: { origin: site } });
        expect(posted.status(), `POST ${path}`).toBe(404);
      }
    }
  } finally {
    await stranger.close();
  }
  expect(await stateOf(slug)).toBe("live");
});
