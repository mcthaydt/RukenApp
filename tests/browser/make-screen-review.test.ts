import { expect, test, type Page } from "@playwright/test";
import { rgb, token } from "../support/look-tokens.ts";
import { pageHasSettled, signUp } from "./support/account.ts";
import { fillAnswers, putGameWhereStaffLeaveIt, type SentBackPart } from "./support/database.ts";
import {
  addVideo,
  chooseVideo,
  connectGitHubFromFiles,
  giveRealClips,
  nextButton,
  pageNamedAsVideo,
  startAtCheck,
  startAtFiles,
  startAtVideo,
  startDraft,
  TINY_GAME,
} from "./support/game.ts";
import { boxOf, expectFrame, layoutOf, lineStarts } from "./support/look.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

// What the screen review of the rebuilt maker screens found (docs/superpowers/audits/2026-11-15-maker-screens-rebuild-
// screen-review.md), one journey for each thing that was wrong. Each measures the page in the window it runs in, so the
// same journey holds on a phone, a tablet and a computer, upright and sideways.

test.beforeEach(forgetRateLimits);

const SIDEWAYS: SentBackPart = { part: "upright_video", reason: "sideways" };

/** A new maker whose finished game staff have left as `decision` says. */
async function gameWhere(
  page: Page,
  decision: Parameters<typeof putGameWhereStaffLeaveIt>[1],
): Promise<{ slug: string }> {
  const { slug } = await startDraft(page);
  await fillAnswers(slug, { files: true, videos: true, age: "age_12" });
  await giveRealClips(page, slug);
  await putGameWhereStaffLeaveIt(slug, decision);
  return { slug };
}

// ---- The videos are real ------------------------------------------------------------------------------------------

test("a video a maker adds draws a frame, upright and then wide", async ({ page }) => {
  await startAtVideo(page, "upright");
  await addVideo(page, "upright");
  await expectFrame(page.locator('[data-frame="upright"] video'));
  await nextButton(page).click();
  await addVideo(page, "wide");
  await expectFrame(page.locator('[data-frame="wide"] video'));
});

test("Check and send draws both videos", async ({ page }) => {
  await startAtCheck(page);
  await expect(page.locator(".laid video")).toHaveCount(2);
  for (const video of await page.locator(".laid video").all()) await expectFrame(video);
});

test("Sent back draws the video in its card, and the card holds it on a sage tile until it has a picture", async ({
  page,
}) => {
  const { slug } = await gameWhere(page, { state: "sent_back", toFix: [SIDEWAYS] });
  await page.goto(`/make/${slug}`);

  const video = page.locator(".sheet.fix video");
  await expect(video).toHaveCSS("background-color", rgb(token("--sage")));
  await expectFrame(video);
});

test("Live draws the video behind it and the one laid out", async ({ page }) => {
  const { slug } = await gameWhere(page, { state: "live" });
  await page.goto(`/make/${slug}`);

  await expectFrame(page.locator(".backdrop video"));
  await expectFrame(page.locator(".laid video"));
});

test("Your games draws the picture of each game", async ({ page }) => {
  const { slug } = await startDraft(page);
  await fillAnswers(slug, { files: true, videos: true, age: "age_12" });
  await giveRealClips(page, slug);
  await page.goto("/make");

  await expectFrame(page.locator("a.game video"));
});

// ---- The other websites question ----------------------------------------------------------------------------------

test("the other websites question has a paper box, a gap under the heading and no Enter hint", async ({
  page,
}) => {
  const { slug } = await startDraft(page);
  await fillAnswers(slug, { files: true });
  await page.goto(`/make/${slug}/websites`);
  await pageHasSettled(page);

  const box = page.locator("textarea.answer");
  await expect(box).toHaveCSS("background-color", rgb(token("--paper")));
  const heading = await boxOf(page.getByRole("heading", { level: 1 }));
  expect((await boxOf(box)).y - (heading.y + heading.height)).toBeGreaterThanOrEqual(16);
  // Enter makes a new line in this box, so a hint that it presses the button would be wrong.
  await expect(page.getByText("press Enter")).toHaveCount(0);
});

// ---- Sent back ----------------------------------------------------------------------------------------------------

test("the folded 'accepted' card has small corners, is not underlined, and keeps its distance", async ({
  page,
}) => {
  const { slug } = await gameWhere(page, { state: "sent_back", toFix: [SIDEWAYS] });
  await page.goto(`/make/${slug}`);

  const accepted = page.locator("details.accepted");
  await expect(accepted).toHaveCSS("border-top-left-radius", "12px");
  await expect(accepted.locator("summary")).toHaveCSS("text-decoration-line", "none");
  const card = await boxOf(page.locator("a.sheet.fix"));
  expect((await boxOf(accepted)).y - (card.y + card.height)).toBeGreaterThanOrEqual(16);
});

test("throwing a game away is at the foot of Sent back, not beside the way out", async ({ page }) => {
  const { slug } = await gameWhere(page, { state: "sent_back", toFix: [SIDEWAYS] });
  await page.goto(`/make/${slug}`);

  const screen = await boxOf(page.locator("main"));
  const throwAway = await boxOf(page.getByRole("link", { name: "Throw this game away" }));
  expect(throwAway.y).toBeGreaterThanOrEqual(screen.y + screen.height - 1);
});

test("throwing a game away is at the foot of Check and send, not under the heading", async ({ page }) => {
  await startAtCheck(page);

  const screen = await boxOf(page.locator("main"));
  const throwAway = await boxOf(page.getByRole("link", { name: "Throw this game away" }));
  expect(throwAway.y).toBeGreaterThanOrEqual(screen.y + screen.height - 1);
});

// ---- The game laid out --------------------------------------------------------------------------------------------

test("the game laid out keeps its parts apart: the line from the chips, and a Change from its name", async ({
  page,
}) => {
  await startAtCheck(page);

  const tagline = await boxOf(page.locator(".laid .tagline"));
  const chips = await boxOf(page.locator(".laid ul"));
  expect(chips.y - (tagline.y + tagline.height)).toBeGreaterThanOrEqual(12);
  // Where a Change wraps under the words it belongs to, a little space separates them.
  for (const row of await page.locator(".laid > div:not(.tiles)").all()) {
    const rowGap = await row.evaluate((element) => Number.parseFloat(getComputedStyle(element).rowGap));
    expect(rowGap).toBeGreaterThanOrEqual(4);
  }
});

test("on Live an update that was sent back has room above the game", async ({ page }) => {
  const { slug } = await gameWhere(page, {
    state: "live",
    toFix: [{ part: "one_line", reason: "not_this_game" }],
  });
  await page.goto(`/make/${slug}`);

  const card = await boxOf(page.locator("a.sheet.fix"));
  expect((await boxOf(page.locator(".laid"))).y - (card.y + card.height)).toBeGreaterThanOrEqual(16);
});

test("on a phone the wide video has the name and the line under it, beside the upright one", async ({
  page,
}) => {
  test.skip(layoutOf(page) !== "phone", "the phone's own arrangement");
  await startAtCheck(page);

  const upright = await boxOf(page.locator('.laid [data-shape="upright"]').first());
  // The wide video's figure, with its caption: the name starts right under it.
  const wide = await boxOf(page.locator(".laid figure").last());
  const title = await boxOf(page.locator(".laid .title"));
  const tagline = await boxOf(page.locator(".laid .tagline"));
  expect(title.x).toBeGreaterThanOrEqual(upright.x + upright.width);
  expect(tagline.x).toBeGreaterThanOrEqual(upright.x + upright.width);
  expect(title.y).toBeGreaterThanOrEqual(wide.y + wide.height);
  // Right under the wide video, not under whatever is tallest.
  expect(title.y - (wide.y + wide.height)).toBeLessThanOrEqual(40);
});

test("a video's caption is one line: 'On phones' and its Change stay together", async ({ page }) => {
  test.skip(layoutOf(page) === "phone", "a phone's captions are drawn by the phone's own arrangement");
  await startAtCheck(page);

  for (const caption of await page.locator(".laid figcaption").all()) {
    expect((await boxOf(caption)).height).toBeLessThan(60);
  }
});

// ---- Where things start and what fills the bar --------------------------------------------------------------------

test("on an upright tablet the question and the room screens start at the same left edge", async ({
  page,
}) => {
  test.skip(layoutOf(page) !== "tablet", "only an upright tablet has a column narrower than the window");
  const { slug } = await startDraft(page);
  await page.goto(`/make/${slug}/line`);
  await pageHasSettled(page);
  const question = await boxOf(page.getByRole("heading", { level: 1 }));

  await fillAnswers(slug, { files: true, videos: true, age: "age_12" });
  await page.goto(`/make/${slug}/agreement`);
  await pageHasSettled(page);
  const agreement = await boxOf(page.getByRole("heading", { level: 1 }));
  await page.getByRole("button", { name: "I agree" }).click();
  await expect(page).toHaveURL(`/make/${slug}/check`);
  const check = await boxOf(page.getByRole("heading", { level: 1 }));

  expect(agreement.x).toBeCloseTo(question.x, 0);
  expect(check.x).toBeCloseTo(question.x, 0);
});

test("the Choose video button fills the bar wherever the buttons are in a bar", async ({ page }) => {
  test.skip(
    !["phone", "phone-sideways", "tablet"].includes(layoutOf(page)),
    "the buttons are not in a bar here",
  );
  await startAtVideo(page, "upright");

  const choose = await boxOf(page.locator(".file > span"));
  const width = page.viewportSize()?.width ?? 0;
  // The bar ends where the window does, less its padding of at most 24px.
  expect(choose.x + choose.width).toBeGreaterThanOrEqual(width - 24);
});

test("on a sideways phone the answer box is in view above the bar, under a two-line heading", async ({
  page,
}) => {
  test.skip(layoutOf(page) !== "phone-sideways", "only a sideways phone is this short");
  const { slug } = await startDraft(page);
  await page.goto(`/make/${slug}/line`);
  await pageHasSettled(page);

  const box = await boxOf(page.locator("input.answer"));
  const bar = await boxOf(page.locator(".acts"));
  expect(box.y + box.height).toBeLessThanOrEqual(bar.y);
});

// ---- The files question -------------------------------------------------------------------------------------------

test("a repository's name is set in the text face and stays on one line", async ({ page }) => {
  const { slug } = await startAtFiles(page);
  await connectGitHubFromFiles(page, slug);

  for (const name of await page.locator(".pick > b").all()) {
    expect(await lineStarts(name)).toHaveLength(1);
    await expect(name).not.toHaveCSS("font-family", /Young Serif/);
  }
  await expect(page.getByLabel(TINY_GAME)).toBeAttached();
});

test("'GitHub didn't connect' sits under the answer, as every other refusal does", async ({ page }) => {
  const { slug } = await startAtFiles(page);
  await connectGitHubFromFiles(page, slug);
  await page.goto(`/make/${slug}/files?github=failed`);
  await pageHasSettled(page);

  const problem = await boxOf(page.getByText(/^GitHub didn't connect\./));
  const hint = await boxOf(page.getByText("Pick the one that is your game."));
  expect(problem.y).toBeGreaterThanOrEqual(hint.y + hint.height);
});

// ---- Your games ---------------------------------------------------------------------------------------------------

test("on a computer 'Add a game' is on the heading's line", async ({ page }) => {
  test.skip(layoutOf(page) !== "computer", "only the computer has room for one line");
  await signUp(page);
  await page.goto("/make");
  await pageHasSettled(page);

  const heading = await boxOf(page.getByRole("heading", { level: 1 }));
  const add = await boxOf(page.getByRole("link", { name: "Add a game" }));
  expect(add.y).toBeLessThan(heading.y + heading.height);
  expect(add.x).toBeGreaterThan(heading.x + heading.width);
});

// ---- What the walk through the tasks found -------------------------------------------------------------------------

test("a video that is refused shows its words above the bar, where they can be read", async ({ page }) => {
  await startAtVideo(page, "upright");
  await chooseVideo(page, pageNamedAsVideo());

  const problem = page.getByRole("alert").filter({ hasText: "doesn't look like a video" });
  await expect(problem).toBeVisible();
  const words = await boxOf(problem);
  const viewport = page.viewportSize()?.height ?? 0;
  const barTop = ["phone", "phone-sideways", "tablet"].includes(layoutOf(page))
    ? (await boxOf(page.locator(".acts"))).y
    : viewport;
  await expect.poll(async () => (await boxOf(problem)).y + words.height).toBeLessThanOrEqual(barTop);
});

test("a refusal of the websites goes away once the box is changed", async ({ page }) => {
  const { slug } = await startDraft(page);
  await fillAnswers(slug, { files: true });
  await page.goto(`/make/${slug}/websites`);
  await pageHasSettled(page);

  await page.getByLabel(/use other websites\?$/).fill("not a website");
  await nextButton(page).click();
  const refusal = page.locator("#problem");
  await expect(refusal).toBeVisible();

  await page.getByLabel(/use other websites\?$/).fill("api.example.com");
  await expect(refusal).toHaveCount(0);
});

test("on the throw-away screen the green Keep it comes before the red Throw it away", async ({ page }) => {
  const { slug } = await startDraft(page);
  await page.goto(`/make/${slug}/throw-away`);

  const keep = await boxOf(page.getByRole("link", { name: "Keep it" }));
  const throwAway = await boxOf(page.getByRole("button", { name: "Throw it away" }));
  expect(keep.y).toBeLessThan(throwAway.y);
});

test("on Live an update that was sent back has the fix as its blue button", async ({ page }) => {
  const { slug } = await gameWhere(page, {
    state: "live",
    toFix: [{ part: "one_line", reason: "not_this_game" }],
  });
  await page.goto(`/make/${slug}`);

  const fix = page.getByRole("link", { name: /^Fix / });
  await expect(fix).toHaveAttribute("href", /\/line/);
  await expect(fix).toHaveCSS("background-color", rgb(token("--pay")));
  await expect(page.getByRole("link", { name: "See it on Ruken" })).not.toHaveCSS(
    "background-color",
    rgb(token("--pay")),
  );
});

test("the GitHub how-to has the way back at its foot as well as at its top", async ({ page }) => {
  await page.goto("/help/github?from=%2Fmake");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  const links = page.locator("main a");
  await expect(links.first()).toHaveAttribute("href", "/make");
  await expect(links.last()).toHaveAttribute("href", "/make");
  await expect(links).toHaveCount(2);
});
