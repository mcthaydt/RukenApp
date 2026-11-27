import { expect, test, type Browser, type Page } from "@playwright/test";
import { pageHasSettled, signUp } from "./support/account.ts";
import { consented, NOT_CONSENTED } from "./support/consent.ts";
import { askGoodPick, feedRowsOf, makeThemUnder18 } from "./support/database.ts";
import { gameWhere } from "./support/game.ts";
import { showTheOwner } from "./support/look.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

// Settings › Your feed and the ••• sheet (learned feed spec, unit D, D5): a person tells the feed what they want more
// and less of from a clip, sees it, adds and takes off chips, answers Good pick, turns Learn from what I do off and on
// and starts over. Nobody else reads or changes their chips; a browser with no cookie yes keeps nothing; a teen's feed
// does not learn.

const SITE = "http://localhost:4173";
/** A request from the site's own page carries its origin. */
const FROM_THE_SITE = { headers: { origin: SITE } };

let live: { slug: string; name: string };

/** A live game made by a new maker in a browser of its own, so the person in the journey is not its maker. */
async function liveGame(browser: Browser): Promise<{ slug: string; name: string }> {
  const context = await browser.newContext({ ...consented, baseURL: SITE });
  try {
    return await gameWhere(await context.newPage(), { state: "live" });
  } finally {
    await context.close();
  }
}

test.beforeAll(async ({ browser }) => {
  test.setTimeout(180_000);
  await forgetRateLimits();
  live = await liveGame(browser);
});
test.beforeEach(forgetRateLimits);

const more = (page: Page) => page.getByRole("region", { name: "What you want to see more of" });
const less = (page: Page) => page.getByRole("region", { name: "What you want to see less of" });
const learnSwitch = (page: Page) => page.getByRole("switch", { name: /Learn from what I do/ });

async function openYourFeed(page: Page): Promise<void> {
  await page.goto("/me");
  await page.getByRole("link", { name: "Your feed" }).click();
  await expect(page).toHaveURL("/settings/feed");
  await expect(page.getByRole("heading", { name: "Your feed", level: 1 })).toBeVisible();
  await pageHasSettled(page);
}

/**
 * Presses ••• on the journey's own game's clip in the feed and one of the sheet's two buttons; answers the game it was
 * for. Never the clip at the top: other journeys add games and take them off as this one runs, and a game taken off
 * between the feed loading and the press is answered "That game isn't on Ruken now." with the sheet left open.
 */
async function tellTheFeed(
  page: Page,
  choice: "More like this" | "Less like this",
  options: { shoot?: () => Promise<void> } = {},
): Promise<{ slug: string; name: string }> {
  await page.goto("/");
  const clip = page.locator(`section[data-slug="${live.slug}"]`).first();
  await expect(clip).toBeAttached();
  await clip.scrollIntoViewIfNeeded();
  const slug = (await clip.getAttribute("data-slug")) ?? "";
  await clip.getByRole("button", { name: "More or less like this" }).click();
  const sheet = page.locator("dialog.tastesheet");
  await expect(sheet).toBeVisible();
  const name = (await sheet.getByRole("heading").textContent()) ?? "";
  await options.shoot?.();
  await sheet.getByRole("button", { name: choice }).click();
  await expect(sheet).toBeHidden();
  await expect(page.getByRole("status").filter({ hasText: "Got it." })).toBeVisible();
  expect(slug).not.toBe("");
  return { slug, name: name.trim() };
}

test.describe("with cookies said yes to", () => {
  test.use(consented);

  test("More and Less like this from a clip show on Your feed, and chips are added and taken off", async ({
    page,
  }, testInfo) => {
    const person = await signUp(page);

    // Read: a new person's feed learns, and has nothing yet.
    await openYourFeed(page);
    await expect(learnSwitch(page)).toHaveAttribute("aria-checked", "true");
    await expect(page.getByText("Play a few games and we'll learn what you like.")).toBeVisible();
    await expect(less(page).getByRole("button", { name: /^Remove / })).toHaveCount(0);
    await showTheOwner(page, testInfo, "Your feed, new");

    // Create from a clip: More like this keeps the game on the more side.
    const { name: game } = await tellTheFeed(page, "More like this", {
      shoot: () => showTheOwner(page, testInfo, "the ••• sheet"),
    });
    await openYourFeed(page);
    await expect(more(page).getByText(game, { exact: true })).toBeVisible();

    // Update: Less like this on the same game moves it to the less side; it is never on both.
    await tellTheFeed(page, "Less like this");
    await openYourFeed(page);
    await expect(less(page).getByText(game, { exact: true })).toBeVisible();
    await expect(more(page).getByText(game, { exact: true })).toHaveCount(0);

    // Create from a suggestion and from Add.
    const suggestion = more(page).getByRole("button", { name: /^Add / }).first();
    const suggested = ((await suggestion.getAttribute("aria-label")) ?? "").replace(/^Add /, "");
    // A suggestion is a small outlined chip, one target tall, in ink on the paper card (white on white was unseen).
    const look = await suggestion.evaluate((button) => {
      const style = getComputedStyle(button);
      return {
        height: button.getBoundingClientRect().height,
        color: style.color,
        border: style.borderTopColor,
      };
    });
    expect(look.height).toBeLessThanOrEqual(56);
    expect(look.color).not.toBe("rgb(255, 255, 255)");
    expect(look.border).not.toBe("rgb(255, 255, 255)");
    await suggestion.click();
    await expect(more(page).getByRole("button", { name: `Remove ${suggested}` })).toBeVisible();
    await expect(
      page.getByText(new RegExp(`^Lately you've been into ${suggested.toLowerCase()}`)),
    ).toBeVisible();

    await less(page).getByRole("button", { name: "Add" }).click();
    const addSheet = page.getByRole("dialog", { name: "See less of" });
    await expect(addSheet).toBeVisible();
    await showTheOwner(page, testInfo, "Your feed, Add");
    await addSheet.getByRole("button", { name: "Racing and sports", exact: true }).click();
    await expect(addSheet).toBeHidden();
    await expect(less(page).getByRole("button", { name: "Remove Racing and sports" })).toBeVisible();
    // Every kept chip is one target tall, not stretched by the space a card's last button usually gets.
    for (const height of await page
      .locator("li.chip-on")
      .evaluateAll((chips) => chips.map((chip) => chip.getBoundingClientRect().height))) {
      expect(height).toBeLessThanOrEqual(56);
    }
    await showTheOwner(page, testInfo, "Your feed, with chips");
    expect((await feedRowsOf(person.number)).chips).toBe(3);

    // Delete: × takes a chip off, and it stays off after a reload.
    await less(page).getByRole("button", { name: "Remove Racing and sports" }).click();
    await expect(less(page).getByRole("button", { name: "Remove Racing and sports" })).toHaveCount(0);
    await page.reload();
    await expect(less(page).getByText("Racing and sports")).toHaveCount(0);
    await expect(less(page).getByText(game, { exact: true })).toBeVisible();
    expect((await feedRowsOf(person.number)).chips).toBe(2);
  });

  test("Good pick? Yes keeps the game, and is answered once", async ({ page }) => {
    const person = await signUp(page);
    await askGoodPick(person.number, live.slug);

    const yes = await page.request.post("/api/feed/good-pick", {
      ...FROM_THE_SITE,
      data: { game: live.slug, yes: true },
    });
    expect(yes.status()).toBe(200);
    // A second answer is refused: the card has gone.
    const again = await page.request.post("/api/feed/good-pick", {
      ...FROM_THE_SITE,
      data: { game: live.slug, yes: false },
    });
    expect(again.status()).toBe(409);
    expect((await feedRowsOf(person.number)).answers).toEqual(["yes"]);

    await openYourFeed(page);
    await expect(more(page).getByText(live.name, { exact: true })).toBeVisible();
  });

  test("Learn from what I do turns off and on, and Start over forgets everything", async ({
    page,
  }, testInfo) => {
    const person = await signUp(page);
    await openYourFeed(page);
    await more(page).getByRole("button", { name: /^Add / }).first().click();
    await expect(more(page).getByRole("button", { name: /^Remove / })).toHaveCount(1);

    // Off: the chips go out of sight, ••• leaves the feed, and nothing new is kept.
    await learnSwitch(page).click();
    await expect(learnSwitch(page)).toHaveAttribute("aria-checked", "false");
    await expect(page.getByText("Your feed isn't learning from what you do.")).toBeVisible();
    await expect(more(page)).toHaveCount(0);
    await showTheOwner(page, testInfo, "Your feed, off");
    await page.goto("/");
    await expect(page.locator("section[data-slug]").first()).toBeAttached();
    await expect(page.getByRole("button", { name: "More or less like this" })).toHaveCount(0);
    const refused = await page.request.post("/api/feed/taste", {
      ...FROM_THE_SITE,
      data: { game: live.slug, more: true },
    });
    expect(refused.status()).toBe(409);
    expect((await feedRowsOf(person.number)).chips).toBe(1);

    // On again starts fresh.
    await openYourFeed(page);
    await learnSwitch(page).click();
    await expect(learnSwitch(page)).toHaveAttribute("aria-checked", "true");
    await expect(more(page).getByRole("button", { name: /^Remove / })).toHaveCount(0);

    // Start over asks once, and Cancel keeps everything.
    await more(page).getByRole("button", { name: /^Add / }).first().click();
    await expect(more(page).getByRole("button", { name: /^Remove / })).toHaveCount(1);
    await page.getByRole("button", { name: "Start over" }).click();
    const confirm = page.getByRole("dialog", { name: "Start over?" });
    await expect(confirm).toBeVisible();
    await showTheOwner(page, testInfo, "Your feed, Start over?");
    await confirm.getByRole("button", { name: "Cancel" }).click();
    await expect(confirm).toBeHidden();
    await expect(more(page).getByRole("button", { name: /^Remove / })).toHaveCount(1);

    await page.getByRole("button", { name: "Start over" }).click();
    await confirm.getByRole("button", { name: "Start over" }).click();
    await expect(confirm).toBeHidden();
    await expect(more(page).getByRole("button", { name: /^Remove / })).toHaveCount(0);
    await expect(page.getByText("Play a few games and we'll learn what you like.")).toBeVisible();
    expect(await feedRowsOf(person.number)).toEqual({ chips: 0, answers: [] });
  });

  test("nobody else reads or takes off a person's chips", async ({ page, browser }) => {
    await signUp(page);
    await openYourFeed(page);
    const suggestion = more(page).getByRole("button", { name: /^Add / }).first();
    const word = ((await suggestion.getAttribute("aria-label")) ?? "").replace(/^Add /, "");
    await suggestion.click();
    await expect(more(page).getByRole("button", { name: `Remove ${word}` })).toBeVisible();
    const chipId = await more(page).locator('form[action="?/remove"] input[name="id"]').first().inputValue();

    const other = await browser.newContext({ ...consented, baseURL: SITE });
    try {
      const them = await other.newPage();
      await signUp(them);
      await openYourFeed(them);
      await expect(more(them).getByRole("button", { name: /^Remove / })).toHaveCount(0);
      // Posting the first person's chip from the second account takes nothing off.
      await them.request.post("/settings/feed?/remove", {
        ...FROM_THE_SITE,
        form: { id: chipId },
      });
    } finally {
      await other.close();
    }
    await page.reload();
    await expect(more(page).getByRole("button", { name: `Remove ${word}` })).toBeVisible();
  });

  test("a teen's feed doesn't learn until a parent says yes", async ({ page }, testInfo) => {
    const person = await signUp(page);
    await makeThemUnder18(person.number);
    await openYourFeed(page);
    await expect(
      page.getByText("Your feed doesn't learn from what you do until a parent says yes."),
    ).toBeVisible();
    await expect(learnSwitch(page)).toHaveCount(0);
    await showTheOwner(page, testInfo, "Your feed, teen");
    await page.goto("/");
    await expect(page.locator("section[data-slug]").first()).toBeAttached();
    await expect(page.getByRole("button", { name: "More or less like this" })).toHaveCount(0);
    const refused = await page.request.post("/api/feed/taste", {
      ...FROM_THE_SITE,
      data: { game: live.slug, more: true },
    });
    expect(refused.status()).toBe(409);
    expect((await feedRowsOf(person.number)).chips).toBe(0);
  });
});

test.describe("with no cookie yes", () => {
  test.use({ storageState: NOT_CONSENTED });

  test("the feed offers no ••• and keeps nothing", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("section[data-slug]").first()).toBeAttached();
    await expect(page.getByRole("button", { name: "More or less like this" })).toHaveCount(0);
    const refused = await page.request.post("/api/feed/taste", {
      ...FROM_THE_SITE,
      data: { game: live.slug, more: true },
    });
    expect(refused.status()).toBe(403);
    const goodPick = await page.request.post("/api/feed/good-pick", {
      ...FROM_THE_SITE,
      data: { game: live.slug, yes: true },
    });
    expect(goodPick.status()).toBe(403);
  });
});
