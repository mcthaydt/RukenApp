import { expect, test, type Browser, type Page } from "@playwright/test";
import { pageHasSettled, signInAs, signUp } from "./support/account.ts";
import { leaveNewCopyWaiting, pullsOf } from "./support/database.ts";
import { addGame, agreeToTheAgreement, answerEveryQuestion, submitGame } from "./support/game.ts";
import { showTheOwner } from "./support/look.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

// Test play: a maker plays their own game's files before staff say yes, from Your games, Check and send and Waiting.
// Nobody else can: anyone else gets the missing page, and nothing of it reaches players.

test.beforeEach(forgetRateLimits);
test.setTimeout(120_000);

const SITE = "http://localhost:4173";
// The strip across the top of a test play says it, and so does the menu.
const STRIP = "Test play. Only you can see this.";

/** The copy of the files a play frame loads: the pull named in its pass (`v1.<claims>.<mac>`, claims in base64url). */
async function pullInFrame(page: Page): Promise<string> {
  const src = (await page.locator("iframe.frame").getAttribute("src")) ?? "";
  const pass = new URL(src).pathname.split("/")[1] ?? "";
  const claims = JSON.parse(Buffer.from(pass.split(".")[1] ?? "", "base64url").toString()) as { p: string };
  return claims.p;
}

/** The game in the frame has loaded. */
async function gameLoaded(page: Page): Promise<void> {
  await pageHasSettled(page);
  await expect(page.frameLocator("iframe.frame").locator("body")).toHaveAttribute("data-loaded", "yes");
}

/** The status a page answers, asked in a window of its own; `number` signs that window in first. */
async function statusFor(browser: Browser, address: string, number?: string): Promise<number> {
  const context = await browser.newContext({ baseURL: SITE });
  try {
    const page = await context.newPage();
    if (number !== undefined) await signInAs(page, number);
    return (await page.goto(address))?.status() ?? 0;
  } finally {
    await context.close();
  }
}

/** Test play is an outline button: no fill at any size, even in the glass row pinned over a phone's screen, so the
 * screen's one blue button stays the only one (glass re-review of #370). */
async function testPlayIsNotASecondBlueButton(page: Page): Promise<void> {
  for (const testPlay of await page.getByRole("link", { name: "Test play", exact: true }).all())
    await expect(testPlay).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
}

test("a maker test-plays a draft from Check and send, and goes back to it", async ({ page }, testInfo) => {
  const { slug, name } = await answerEveryQuestion(page);
  await agreeToTheAgreement(page, slug);

  await testPlayIsNotASecondBlueButton(page);
  // Loading a test play hands out a play pass, so a hover never loads it ahead: only a press does.
  await expect(page.getByRole("link", { name: "Test play" }).first()).toHaveAttribute(
    "data-sveltekit-preload-data",
    "off",
  );
  await page.getByRole("link", { name: "Test play" }).first().click();
  await expect(page).toHaveURL(`/make/${slug}/play`);
  await expect(page.locator(".teststrip")).toHaveText(STRIP);
  await expect(page).toHaveTitle(`Ruken - ${name}`);
  await gameLoaded(page);
  expect(await pullInFrame(page)).not.toBe("");
  await showTheOwner(page, testInfo, "a maker's test play");

  await page.getByRole("group").getByLabel("Menu. Use the arrow keys to move it.").click();
  await expect(page.locator(".menupanel").getByText(STRIP)).toBeVisible();
  await page.getByRole("link", { name: /Leave game/ }).click();
  // The game's own address, which leads a draft on to Check and send.
  await expect(page).toHaveURL(`/make/${slug}/check`);
});

test("nobody but the maker can test-play a draft, and players never see it", async ({ page, browser }) => {
  const { slug } = await answerEveryQuestion(page);
  await page.goto(`/make/${slug}/play`);
  await expect(page.locator(".teststrip")).toHaveText(STRIP);

  const strangerContext = await browser.newContext({ baseURL: SITE });
  const stranger = await signUp(await strangerContext.newPage());
  await strangerContext.close();
  expect(await statusFor(browser, `/make/${slug}/play`, stranger.number)).toBe(404);
  expect(await statusFor(browser, `/g/${slug}/play`, stranger.number)).toBe(404);
  expect(await statusFor(browser, `/g/${slug}`, stranger.number)).toBe(404);
  expect(await statusFor(browser, `/g/${slug}/play`)).toBe(404);
  expect(await statusFor(browser, `/g/${slug}`)).toBe(404);

  // Signed out, the maker's area asks for a sign-in first, the same for every address, so it says nothing either.
  const context = await browser.newContext({ baseURL: SITE });
  try {
    const signedOut = await context.newPage();
    await signedOut.goto(`/make/${slug}/play`);
    await expect(signedOut).toHaveURL(/\/sign-in/);
  } finally {
    await context.close();
  }
});

test("a game waiting for review is test-played from Your games and from Waiting", async ({
  page,
  browser,
}) => {
  const { slug, name, maker } = await submitGame(browser);
  await signInAs(page, maker.number, maker.password);

  await page.goto("/make");
  await pageHasSettled(page);
  const fromList = page.getByRole("link", { name: `Test play ${name}` });
  await expect(fromList).toHaveAttribute("data-sveltekit-preload-data", "off");
  await fromList.click();
  await expect(page).toHaveURL(`/make/${slug}/play`);
  await expect(page.locator(".teststrip")).toHaveText(STRIP);
  await gameLoaded(page);
  expect(await pullInFrame(page)).toBe((await pullsOf(slug)).pending);

  await page.goto(`/make/${slug}`);
  await pageHasSettled(page);
  await expect(page.getByRole("heading", { name: "Waiting for review" })).toBeVisible();
  await testPlayIsNotASecondBlueButton(page);
  await expect(page.getByRole("link", { name: "Test play" })).toHaveAttribute(
    "data-sveltekit-preload-data",
    "off",
  );
  await page.getByRole("link", { name: "Test play" }).click();
  await expect(page).toHaveURL(`/make/${slug}/play`);
  await gameLoaded(page);
});

test("a live game's maker test-plays it from Your games and Live: the live copy, then the new copy that waits", async ({
  page,
  browser,
  request,
}, testInfo) => {
  const game = await addGame(browser, request);
  await signInAs(page, game.maker.number, game.maker.password);
  const live = (await pullsOf(game.slug)).live;

  // Nothing new waits: the maker plays the live copy. Before launch the game's own page shows Wishlist where Play goes,
  // for its maker too, so this is their way in (the owner, 2026-11-28: "what happened to us being able to test the game").
  await page.goto("/make");
  await pageHasSettled(page);
  const fromList = page.getByRole("link", { name: `Test play ${game.name}` });
  await expect(fromList).toHaveAttribute("data-sveltekit-preload-data", "off");
  await fromList.click();
  await expect(page).toHaveURL(`/make/${game.slug}/play`);
  await expect(page.locator(".teststrip")).toHaveText(STRIP);
  await gameLoaded(page);
  expect(await pullInFrame(page)).toBe(live);

  await page.goto(`/make/${game.slug}`);
  await pageHasSettled(page);
  await expect(page.getByRole("heading", { name: "Live" })).toBeVisible();
  await testPlayIsNotASecondBlueButton(page);
  const fromLive = page.getByRole("link", { name: "Test play", exact: true });
  await expect(fromLive).toBeVisible();
  await expect(fromLive).toHaveAttribute("data-sveltekit-preload-data", "off");
  await showTheOwner(page, testInfo, "a live game's Test play");
  await fromLive.click();
  await expect(page).toHaveURL(`/make/${game.slug}/play`);
  await gameLoaded(page);
  expect(await pullInFrame(page)).toBe(live);
  await page.getByRole("group").getByLabel("Menu. Use the arrow keys to move it.").click();
  await page.getByRole("link", { name: /Leave game/ }).click();
  await expect(page).toHaveURL(`/make/${game.slug}`);

  // A new copy waits: the maker tries it, from the list and from Live, while players keep the live one.
  await leaveNewCopyWaiting(game.slug);
  const pulls = await pullsOf(game.slug);
  expect(pulls.pending).not.toBe(pulls.live);
  await page.goto("/make");
  await pageHasSettled(page);
  // The waiting copy is a row with no files of its own, so only the copy the frame asks for is checked.
  await page.getByRole("link", { name: `Test play ${game.name}` }).click();
  await expect(page.locator(".teststrip")).toHaveText(STRIP);
  await expect.poll(() => pullInFrame(page)).toBe(pulls.pending);

  await page.goto(`/make/${game.slug}`);
  await pageHasSettled(page);
  await page.getByRole("link", { name: "Test play", exact: true }).click();
  await expect(page).toHaveURL(`/make/${game.slug}/play`);
  await expect.poll(() => pullInFrame(page)).toBe(pulls.pending);
});
