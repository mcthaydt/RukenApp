import { expect, test, type Page } from "@playwright/test";
import { pageHasSettled } from "./support/account.ts";
import { fillAnswers } from "./support/database.ts";
import {
  freshName,
  gameWhere,
  giveRealClips,
  nextButton,
  startAtCheck,
  startAtVideo,
  startDraft,
} from "./support/game.ts";
import { boxOf, brokenWords, layoutHasSettled, layoutOf } from "./support/look.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

// What the second look at the submission screens found (docs/superpowers/audits/2026-11-15-submission-screens-second-look.md),
// one journey for each thing that was wrong and can be measured. Each measures the page in the window it runs in. The one
// that needs an iPhone SE's window (320 wide), which no project has, gives itself that window and runs in one project.

test.beforeEach(forgetRateLimits);

const IPHONE_SE = { width: 320, height: 568 };

/** A line as long as the screens allow (100 letters), made of ordinary words a person would use. */
const LONG_LINE =
  "Tap the wobbly buttons before the tide comes in and the harbour lights go out, one by one, tonight.";

/** The size, in pixels, and the opacity a link is drawn with. */
function drawnAs(link: ReturnType<Page["getByRole"]>): Promise<{ size: number; opacity: number }> {
  return link.evaluate((element) => {
    const style = getComputedStyle(element);
    return { size: parseFloat(style.fontSize), opacity: Number(style.opacity) };
  });
}

// ---- L1: Live's way off Ruken is quiet ---------------------------------------------------------------------------------

test("on Live, taking the game off Ruken is the quietest link: last, smaller and dimmer than Back", async ({
  page,
}) => {
  const { slug } = await gameWhere(page, { state: "live" });
  await page.goto(`/make/${slug}`);
  await layoutHasSettled(page);

  const back = page.getByRole("link", { name: "Back to your games" });
  const off = page.getByRole("link", { name: "Take it off Ruken" });
  const backDrawn = await drawnAs(back);
  const offDrawn = await drawnAs(off);
  expect(offDrawn.size, "smaller than Back").toBeLessThan(backDrawn.size);
  expect(offDrawn.opacity, "dimmer than Back").toBeLessThan(backDrawn.opacity);
  // Last: under Back, at the foot of the left half, so it is never read as the blue button's note.
  const backBox = await boxOf(back);
  const offBox = await boxOf(off);
  expect(offBox.y).toBeGreaterThanOrEqual(backBox.y + backBox.height);
  // Still a target a thumb can hit.
  expect(offBox.height).toBeGreaterThanOrEqual(44);
});

// ---- L2: the wide video's buttons are on the first screen of a short computer window ------------------------------------

test("on a 1280 by 720 computer the wide video question's blue button is on the first screen, empty and with a video", async ({
  page,
}) => {
  test.skip(layoutOf(page) !== "computer", "the short computer window's own arrangement");
  const window = page.viewportSize()?.height ?? 0;

  await startAtVideo(page, "wide");
  await layoutHasSettled(page);
  const picker = await boxOf(page.locator(".acts .file > span"));
  expect(picker.y + picker.height, "Choose video ends inside the window").toBeLessThanOrEqual(window);

  // A game with its wide video already in: the same question shows the video, with two more lines of links.
  const { slug } = await startDraft(page);
  await fillAnswers(slug, { files: true, videos: true, age: "age_12" });
  await giveRealClips(page, slug);
  await page.goto(`/make/${slug}/wide`);
  await layoutHasSettled(page);
  const next = await boxOf(nextButton(page));
  expect(next.y + next.height, "Next ends inside the window").toBeLessThanOrEqual(window);
});

// ---- L3: the one-line box shows the whole line ---------------------------------------------------------------------------

test("the one-line box grows to show every letter of a long line, and Enter still sends it on", async ({
  page,
}) => {
  await startDraft(page);
  const box = page.getByRole("textbox");
  await box.fill(LONG_LINE);
  await layoutHasSettled(page);

  const clipped = await box.evaluate(
    (element) =>
      element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1,
  );
  expect(clipped, "some of what was typed is out of sight").toBe(false);

  // Enter is Next, as in a one-line box, and what is kept is one line.
  await box.press("Enter");
  await expect(page).toHaveURL(/\/files$/);
});

// ---- L6: every device link on the record-your-screen page is a target ---------------------------------------------------

test("every device link on the record-your-screen page is at least 44 by 44", async ({ page }) => {
  await page.goto("/help/record-screen");
  await pageHasSettled(page);
  const links = page.locator("nav a");
  expect(await links.count()).toBeGreaterThanOrEqual(4);
  for (const link of await links.all()) {
    const box = await boxOf(link);
    const words = (await link.textContent()) ?? "";
    expect(box.width, `${words} is wide enough`).toBeGreaterThanOrEqual(44);
    expect(box.height, `${words} is tall enough`).toBeGreaterThanOrEqual(44);
  }
});

// ---- L7: Your games on a narrow phone ---------------------------------------------------------------------------------

test("on an iPhone SE a game's name in Your games breaks only between words, beside a small picture", async ({
  page,
}) => {
  test.skip(test.info().project.name !== "phone", "one Chromium project is enough for a window of its own");
  await page.setViewportSize(IPHONE_SE);
  await startDraft(page);
  await page.goto("/make");
  await layoutHasSettled(page);

  expect(await brokenWords(page.locator("a.game .statement"))).toEqual([]);
  const picture = await boxOf(page.locator("a.game > .tile"));
  expect(picture.width, "the picture leaves the name its room").toBeLessThanOrEqual(72);
});

// ---- L8: a refused ring has air under it ---------------------------------------------------------------------------------

/** The gap between the heavier edge round a refused set of choices and the line under it, in pixels. */
async function airUnderTheRing(page: Page): Promise<number> {
  await layoutHasSettled(page);
  const picks = await boxOf(page.locator(".picks"));
  const line = await boxOf(page.locator(".picks + .note"));
  // The ring is 4px wide and stands 6px out from the set.
  return line.y - (picks.y + picks.height + 10);
}

test("when who it is for is refused, its ring is 12px clear of the line under it", async ({ page }) => {
  const { slug } = await startDraft(page);
  await fillAnswers(slug, { files: true, videos: true });
  await page.goto(`/make/${slug}/age`);
  await pageHasSettled(page);
  await nextButton(page).click();
  await expect(page.locator('input[aria-invalid="true"]').first()).toBeAttached();
  expect(await airUnderTheRing(page)).toBeGreaterThanOrEqual(12);
});

test("when the 18+ question is refused, its ring is 12px clear of the line under it", async ({ page }) => {
  const { slug } = await startDraft(page);
  await fillAnswers(slug, { files: true, videos: true, age: "age_18" });
  await page.goto(`/make/${slug}/marks`);
  await pageHasSettled(page);
  await nextButton(page).click();
  await expect(page.locator('input[aria-invalid="true"]').first()).toBeAttached();
  expect(await airUnderTheRing(page)).toBeGreaterThanOrEqual(12);
});

// ---- L12 and L18: the two screens that can't be undone match ----------------------------------------------------------------

/** The two buttons of a screen that can't be undone: the green way back, then the red one. */
async function theTwoButtons(page: Page) {
  await layoutHasSettled(page);
  const keep = await boxOf(page.locator("main a.button.safe"));
  const red = await boxOf(page.locator("main button.danger"));
  return { keep, red };
}

/** A game each screen is open for: a live game can be taken off, and a draft can be thrown away. */
async function aGameFor(page: Page, screen: "take-off" | "throw-away"): Promise<string> {
  if (screen === "take-off") return (await gameWhere(page, { state: "live" })).slug;
  return (await startDraft(page)).slug;
}

for (const screen of ["take-off", "throw-away"] as const) {
  test(`on ${screen}, the two buttons are 40px apart`, async ({ page }) => {
    const slug = await aGameFor(page, screen);
    await page.goto(`/make/${slug}/${screen}`);
    const { keep, red } = await theTwoButtons(page);
    expect(red.y - (keep.y + keep.height)).toBeGreaterThanOrEqual(40);
  });

  test(`on ${screen}, the two buttons are the same width on a tablet or a computer`, async ({ page }) => {
    test.skip(
      !["tablet", "tablet-sideways", "computer"].includes(layoutOf(page)),
      "a phone's buttons span the card",
    );
    const slug = await aGameFor(page, screen);
    await page.goto(`/make/${slug}/${screen}`);
    const { keep, red } = await theTwoButtons(page);
    expect(Math.abs(keep.width - red.width)).toBeLessThanOrEqual(1);
  });
}

// ---- L17: Check and send's two captions sit at one height --------------------------------------------------------------------

test("on a phone Check and send's two video captions are the same height", async ({ page }) => {
  test.skip(layoutOf(page) !== "phone", "a phone held upright's own arrangement");
  await startAtCheck(page);
  await layoutHasSettled(page);
  const captions = await page.locator(".tiles figcaption").all();
  expect(captions).toHaveLength(2);
  const heights = await Promise.all(captions.map(async (caption) => (await boxOf(caption)).height));
  expect(Math.abs((heights[0] ?? 0) - (heights[1] ?? 0))).toBeLessThanOrEqual(1);
});

// ---- L19: after taking a game off, the screen says what changed ----------------------------------------------------------------

test("after a game is taken off Ruken, the screen says players can't find it and how to put it back", async ({
  page,
}) => {
  const { slug } = await gameWhere(page, { state: "live" });
  await page.goto(`/make/${slug}/take-off`);
  await page.getByRole("button", { name: "Take it off Ruken" }).click();
  await expect(page).toHaveURL(`/make/${slug}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Off Ruken. You took it off.");
  await expect(page.getByText("Players can't find it or play it any more.")).toBeVisible();
  await expect(page.getByText("Nothing changed on GitHub.")).toBeVisible();
  await expect(page.getByText("To put it back, add it again as a new game.")).toBeVisible();
});

// ---- L20: changing a live game's name has nothing to finish ------------------------------------------------------------------------

test("changing a live game's name does not offer Finish later", async ({ page }) => {
  const { slug } = await gameWhere(page, { state: "live" });
  await page.goto(`/make/${slug}/name`);
  await pageHasSettled(page);
  await expect(page.getByRole("link", { name: "Finish later" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Back" })).toBeVisible();
});

test("a new game's first answer can still be left for later", async ({ page }) => {
  await startDraft(page, freshName());
  await expect(page.getByRole("link", { name: "Finish later" })).toBeVisible();
});

// ---- L21: staff's own line is as readable as the reason above it ------------------------------------------------------------------

test("staff's own line on a Sent back card is at least 18px", async ({ page }) => {
  const { slug } = await gameWhere(page, {
    state: "sent_back",
    toFix: [
      { part: "one_line", reason: "not_this_game", note: "Please say what the game is, not how it feels." },
    ],
  });
  await page.goto(`/make/${slug}`);
  await layoutHasSettled(page);
  const size = await page
    .getByText("Please say what the game is, not how it feels.")
    .evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
  expect(size).toBeGreaterThanOrEqual(18);
});
