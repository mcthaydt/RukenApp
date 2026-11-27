import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { pageHasSettled, signUp } from "./support/account.ts";
import { consented, NOT_CONSENTED } from "./support/consent.ts";
import { changeGame } from "./support/database.ts";
import { gameWhere, reviewJob } from "./support/game.ts";
import { showTheOwner } from "./support/look.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

// Reporting a game (report-a-game spec): a player says what is wrong from the game's page, sees it again,
// changes it and takes it back; the owner reads reports through the review command, which names no reporter.

const SITE = "http://localhost:4173";
/** A request from the site's own page carries its origin; SvelteKit refuses a DELETE from anywhere else. */
const FROM_THE_SITE = { headers: { origin: SITE } };

let live: { slug: string; name: string };
let other: { slug: string; name: string };
/** The live game's maker, signed in, for the own-game journey. */
let makerContext: BrowserContext;

/** A live game made by a new maker in a context of its own, which stays open and signed in as that maker. */
async function liveGameWithMaker(
  browser: Browser,
): Promise<{ game: { slug: string; name: string }; context: BrowserContext }> {
  await forgetRateLimits();
  const context = await browser.newContext({ ...consented, baseURL: SITE });
  const game = await gameWhere(await context.newPage(), { state: "live" });
  return { game, context };
}

test.beforeAll(async ({ browser }) => {
  test.setTimeout(180_000);
  const first = await liveGameWithMaker(browser);
  live = first.game;
  makerContext = first.context;
  const second = await liveGameWithMaker(browser);
  other = second.game;
  await second.context.close();
});
test.afterAll(async () => {
  await makerContext.close();
});
test.beforeEach(forgetRateLimits);

const sheet = (page: Page) => page.locator("dialog.reportsheet");

interface Reported {
  game: string;
  count: number;
  reports: { reason: string; note: string | null }[];
}

/** What the review command lists for a game, or undefined when it is not listed. */
async function reportedOf(
  page: Page,
  browser: Browser,
  slug: string,
): Promise<{ entry: Reported | undefined; text: string }> {
  const answer = await reviewJob(page.request, { do: "reports" }, browser);
  expect(answer.status()).toBe(200);
  const text = await answer.text();
  const body = JSON.parse(text) as { reported: Reported[] };
  return { entry: body.reported.find((one) => one.game === slug), text };
}

/** Opens the game's page and presses its Report. */
async function reportFromGamePage(page: Page, slug: string): Promise<void> {
  await page.goto(`/g/${slug}`);
  await pageHasSettled(page);
  await page.getByRole("button", { name: "Report", exact: true }).click();
  await expect(sheet(page).getByRole("heading", { name: "Report this game" })).toBeVisible();
}

test("a player goes from the feed to a game's page, reports it, sees it again, changes it and takes it back", async ({
  page,
  browser,
}, testInfo) => {
  test.setTimeout(120_000);
  const player = await signUp(page);

  // The feed has no Report (owner, 2026-11-24): a press on the game's name opens its page, where Report is.
  await page.goto("/");
  const clip = page.locator(`section[data-slug="${live.slug}"]`).first();
  await clip.scrollIntoViewIfNeeded();
  await expect(clip.getByRole("button", { name: "Share" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Report" })).toHaveCount(0);
  await clip.locator("a.gamelink").click();
  await expect(page).toHaveURL(`/g/${live.slug}`);
  await pageHasSettled(page);

  // Create.
  await page.getByRole("button", { name: "Report", exact: true }).click();
  await expect(sheet(page).getByRole("heading", { name: "Report this game" })).toBeVisible();
  await expect(sheet(page).getByText(live.name)).toBeVisible();
  await showTheOwner(page, testInfo, "the Report sheet");
  await sheet(page).getByLabel("Gambling").check();
  await sheet(page).getByLabel("Tell us more (you don't have to)").fill("Slot machines on level 2.");
  await sheet(page).getByRole("button", { name: "Send report" }).click();
  await expect(sheet(page).getByText("Thanks. We'll take a look.")).toBeVisible();
  await sheet(page).getByRole("button", { name: "Done" }).click();
  await expect(sheet(page)).not.toBeVisible();

  let read = await reportedOf(page, browser, live.slug);
  expect(read.entry).toMatchObject({
    count: 1,
    reports: [{ reason: "Gambling", note: "Slot machines on level 2." }],
  });
  // Read as one piece of text: no reporter in it.
  expect(read.text).not.toContain(player.number);
  expect(read.text).not.toContain(player.number.slice(2));

  // Read: opening it again shows what was sent.
  await reportFromGamePage(page, live.slug);
  await expect(sheet(page).getByText("You reported this game.")).toBeVisible();
  await expect(sheet(page).getByLabel("Gambling")).toBeChecked();
  await expect(sheet(page).getByLabel("Tell us more (you don't have to)")).toHaveValue(
    "Slot machines on level 2.",
  );

  // Update.
  await sheet(page).getByLabel("Ads").check();
  await sheet(page).getByRole("button", { name: "Save changes" }).click();
  await expect(sheet(page).getByText("Thanks. We'll take a look.")).toBeVisible();
  read = await reportedOf(page, browser, live.slug);
  expect(read.entry).toMatchObject({ count: 1, reports: [{ reason: "Ads" }] });

  // Another person sees no report of theirs on the same game.
  const someoneElse = await browser.newContext({ ...consented, baseURL: SITE });
  try {
    const second = await someoneElse.newPage();
    await signUp(second);
    const theirs = await second.request.get(`/g/${live.slug}/report`);
    expect(await theirs.json()).toEqual({ state: "none" });
  } finally {
    await someoneElse.close();
  }

  // Delete.
  await sheet(page).getByRole("button", { name: "Done" }).click();
  await reportFromGamePage(page, live.slug);
  await sheet(page).getByRole("button", { name: "Take back my report" }).click();
  await expect(sheet(page).getByText("Your report is gone.")).toBeVisible();
  read = await reportedOf(page, browser, live.slug);
  expect(read.entry).toBeUndefined();
});

test("the sheet lists nine reasons, and the two later ones are sent and read in words", async ({
  page,
  browser,
}) => {
  test.setTimeout(120_000);
  await signUp(page);
  await reportFromGamePage(page, other.slug);
  await expect(sheet(page).getByRole("radio")).toHaveCount(9);
  await sheet(page).getByLabel("Graphic violence").check();
  await sheet(page).getByRole("button", { name: "Send report" }).click();
  await expect(sheet(page).getByText("Thanks. We'll take a look.")).toBeVisible();
  let read = await reportedOf(page, browser, other.slug);
  expect(read.entry).toMatchObject({ count: 1, reports: [{ reason: "Graphic violence" }] });

  await sheet(page).getByRole("button", { name: "Done" }).click();
  await reportFromGamePage(page, other.slug);
  await expect(sheet(page).getByLabel("Graphic violence")).toBeChecked();
  await sheet(page).getByLabel("A scam or steals your info").check();
  await sheet(page).getByRole("button", { name: "Save changes" }).click();
  await expect(sheet(page).getByText("Thanks. We'll take a look.")).toBeVisible();
  read = await reportedOf(page, browser, other.slug);
  expect(read.entry).toMatchObject({ count: 1, reports: [{ reason: "A scam or steals your info" }] });

  // Taken back again, so the review list stays as other journeys expect it.
  const gone = await page.request.delete(`/g/${other.slug}/report`, FROM_THE_SITE);
  expect(gone.status()).toBe(200);
});

test("the same sheet works from the game's page, with the keyboard alone", async ({ page }) => {
  await signUp(page);
  await page.goto(`/g/${other.slug}`);
  await pageHasSettled(page);
  const report = page.getByRole("button", { name: "Report", exact: true });
  await report.focus();
  await page.keyboard.press("Enter");
  await expect(sheet(page).getByRole("heading", { name: "Report this game" })).toBeVisible();
  await expect(sheet(page).getByRole("radio").first()).toBeVisible();

  // Tab reaches the choices (arrows move between them), the box and the button, each with a visible ring.
  const focusedRing = () =>
    page.evaluate(() => {
      const element = document.activeElement;
      return element === null ? "none" : getComputedStyle(element).outlineStyle;
    });
  let reachedChoice = false;
  for (let presses = 0; presses < 6 && !reachedChoice; presses += 1) {
    await page.keyboard.press("Tab");
    reachedChoice = await page.evaluate(
      () => (document.activeElement as HTMLInputElement | null)?.type === "radio",
    );
  }
  expect(reachedChoice).toBe(true);
  await page.keyboard.press("Space");
  await page.keyboard.press("ArrowDown");
  await expect(sheet(page).getByLabel("Gambling")).toBeChecked();
  await page.keyboard.press("Tab");
  await expect(sheet(page).getByLabel("Tell us more (you don't have to)")).toBeFocused();
  expect(await focusedRing()).not.toBe("none");
  await page.keyboard.type("Spins for coins.");
  await page.keyboard.press("Tab");
  await expect(sheet(page).getByRole("button", { name: "Send report" })).toBeFocused();
  expect(await focusedRing()).not.toBe("none");
  await page.keyboard.press("Enter");
  await expect(sheet(page).getByText("Thanks. We'll take a look.")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(sheet(page)).not.toBeVisible();
  await expect(report).toBeFocused();

  // Taken back again, so the review list stays as other journeys expect it.
  const gone = await page.request.delete(`/g/${other.slug}/report`, FROM_THE_SITE);
  expect(gone.status()).toBe(200);
});

test("signed out, the sheet asks the person to sign in and brings them back", async ({ page }) => {
  await page.goto(`/g/${live.slug}`);
  await pageHasSettled(page);
  await page.getByRole("button", { name: "Report", exact: true }).click();
  await expect(sheet(page).getByText("Sign in to report a game.")).toBeVisible();
  await sheet(page).getByRole("link", { name: "Sign in" }).click();
  await expect(page).toHaveURL(`/sign-in?next=${encodeURIComponent(`/g/${live.slug}`)}`);
});

test("a visitor who has not said yes to cookies is asked to sign in too", async ({ browser }) => {
  const context = await browser.newContext({ storageState: NOT_CONSENTED, baseURL: SITE });
  try {
    const page = await context.newPage();
    await page.goto(`/g/${live.slug}`);
    await pageHasSettled(page);
    await page.getByRole("button", { name: "Report", exact: true }).click();
    await expect(sheet(page).getByText("Sign in to report a game.")).toBeVisible();
  } finally {
    await context.close();
  }
});

test("a maker is told they can't report their own game, and the site refuses it", async () => {
  const page = await makerContext.newPage();
  await page.goto(`/g/${live.slug}`);
  await pageHasSettled(page);
  await page.getByRole("button", { name: "Report", exact: true }).click();
  await expect(sheet(page).getByText("This is your game, so you can't report it.")).toBeVisible();
  const refused = await page.request.put(`/g/${live.slug}/report`, { data: { reason: "ads" } });
  expect(refused.status()).toBe(403);
  await page.close();
});

test("nothing picked says so; a failed or refused send keeps what was picked", async ({ page }) => {
  await signUp(page);
  await page.goto(`/g/${live.slug}`);
  await pageHasSettled(page);
  await page.getByRole("button", { name: "Report", exact: true }).click();
  const send = sheet(page).getByRole("button", { name: "Send report" });
  await send.click();
  await expect(sheet(page).getByText("Pick what's wrong.")).toBeVisible();

  await sheet(page).getByLabel("It doesn't work").check();
  await sheet(page).getByLabel("Tell us more (you don't have to)").fill("Black screen.");
  await page.route(`**/g/${live.slug}/report`, (route) =>
    route.request().method() === "PUT" ? route.fulfill({ status: 500, body: "" }) : route.fallback(),
  );
  await send.click();
  await expect(sheet(page).getByText("That didn't work. Try again.")).toBeVisible();
  await expect(sheet(page).getByLabel("It doesn't work")).toBeChecked();
  await expect(sheet(page).getByLabel("Tell us more (you don't have to)")).toHaveValue("Black screen.");

  await page.unroute(`**/g/${live.slug}/report`);
  await page.route(`**/g/${live.slug}/report`, (route) =>
    route.request().method() === "PUT"
      ? route.fulfill({
          status: 429,
          contentType: "application/json",
          body: JSON.stringify({ problem: "You've sent a lot of reports. Try again later." }),
        })
      : route.fallback(),
  );
  await send.click();
  await expect(sheet(page).getByText("You've sent a lot of reports. Try again later.")).toBeVisible();
  await expect(sheet(page).getByLabel("It doesn't work")).toBeChecked();
});

test("the site believes nothing the sheet sends", async ({ page }) => {
  // Signed out: nothing can be sent or taken back.
  expect((await page.request.put(`/g/${live.slug}/report`, { data: { reason: "ads" } })).status()).toBe(401);
  expect((await page.request.delete(`/g/${live.slug}/report`, FROM_THE_SITE)).status()).toBe(401);
  // From another site, a take-back is refused before it reaches the report.
  expect((await page.request.delete(`/g/${live.slug}/report`)).status()).toBe(403);
  // A game that is not live is a missing page.
  expect((await page.request.get("/g/no-such-game-here/report")).status()).toBe(404);

  await signUp(page);
  for (const data of [{ reason: "boring" }, { reason: "ads", note: "x".repeat(501) }, {}])
    expect((await page.request.put(`/g/${live.slug}/report`, { data })).status()).toBe(400);
  expect(await (await page.request.get(`/g/${live.slug}/report`)).json()).toEqual({ state: "none" });
});

test("the sheet fits the window, and the page behind it never scrolls", async ({ page }, testInfo) => {
  await signUp(page);
  await page.goto(`/g/${live.slug}`);
  await pageHasSettled(page);
  await page.getByRole("button", { name: "Report", exact: true }).click();
  await expect(sheet(page).getByRole("radio").first()).toBeVisible();
  // Measured where it comes to rest, once it has slid in.
  await sheet(page).evaluate(async (dialog) => {
    await Promise.all(dialog.getAnimations({ subtree: true }).map((one) => one.finished));
  });
  // Read once the sheet is open: pressing Report may have brought the button into view.
  const before = await page.evaluate(() => window.scrollY);
  const box = await sheet(page).boundingBox();
  const view = page.viewportSize();
  if (box === null || view === null) throw new Error("no sheet or window size");
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(view.height + 1);
  expect(box.x + box.width).toBeLessThanOrEqual(view.width + 1);

  // What does not fit scrolls inside the sheet, which keeps the scroll to itself.
  const inside = sheet(page).locator(".inside");
  await expect(inside).toHaveCSS("overscroll-behavior-y", "contain");
  if (testInfo.project.use.isMobile === true) {
    // Mobile Safari has no wheel: scroll the sheet's own content as a finger would move it.
    await inside.evaluate((element) => {
      element.scrollBy(0, 2000);
    });
  } else {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, 2000);
  }
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(before);
  // The button at the end is reachable inside the sheet.
  await sheet(page).getByRole("button", { name: "Send report" }).scrollIntoViewIfNeeded();
  await expect(sheet(page).getByRole("button", { name: "Send report" })).toBeInViewport();
  expect(await page.evaluate(() => window.scrollY)).toBe(before);
});

test("a game that is not live is missing, and an 18+ game refuses anyone not known to be 18", async ({
  page,
  browser,
}) => {
  test.setTimeout(180_000);
  // Each game has a maker of its own, in a browser of its own.
  const made: { slug: string }[] = [];
  for (const state of ["waiting", "live"] as const) {
    await forgetRateLimits();
    const maker = await browser.newContext({ ...consented, baseURL: SITE });
    try {
      made.push(await gameWhere(await maker.newPage(), { state }));
    } finally {
      await maker.close();
    }
  }
  const [waiting, grownUp] = made as [{ slug: string }, { slug: string }];
  await changeGame(grownUp.slug, { ageRating: "age_18", contentMarks: ["gore"] });

  // Signed out: the 18+ game refuses before anything else; the waiting game is a missing page.
  expect((await page.request.get(`/g/${grownUp.slug}/report`)).status()).toBe(403);
  expect((await page.request.get(`/g/${waiting.slug}/report`)).status()).toBe(404);

  // A signed-in adult (30) may report the 18+ game; the waiting game stays missing, and nothing is saved for it.
  await signUp(page);
  expect((await page.request.get(`/g/${waiting.slug}/report`)).status()).toBe(404);
  expect((await page.request.put(`/g/${waiting.slug}/report`, { data: { reason: "ads" } })).status()).toBe(
    404,
  );
  expect(await (await page.request.get(`/g/${grownUp.slug}/report`)).json()).toEqual({ state: "none" });
});
