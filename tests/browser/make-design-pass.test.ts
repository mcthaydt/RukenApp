import { expect, test, type Page } from "@playwright/test";
import { rgb, token } from "../support/look-tokens.ts";
import { pageHasSettled } from "./support/account.ts";
import { fillAnswers, putGameWhereStaffLeaveIt, type SentBackPart } from "./support/database.ts";
import {
  agreeToTheAgreement,
  answerLine,
  connectGitHubFromFiles,
  freshName,
  giveRealClips,
  nextButton,
  startAtCheck,
  startAtFiles,
  startAtVideo,
  startDraft,
} from "./support/game.ts";
import { boxOf, brokenWords, layoutHasSettled, layoutOf, lineCount } from "./support/look.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

// What the design pass of the submission screens found (docs/superpowers/audits/2026-11-15-submission-screens-design-pass.md),
// one journey for each thing that was wrong. Each measures the page in the window it runs in, as the journeys of the screen
// review do. The few that need an iPhone SE's window (320 by 568, or 568 by 320 sideways), which no project has, give
// themselves that window and run in the one Chromium project of the same shape.

test.beforeEach(forgetRateLimits);

const IPHONE_SE = { width: 320, height: 568 };
const IPHONE_SE_SIDEWAYS = { width: 568, height: 320 };

/** A name and a line as long as the screens allow (60 and 100 letters), made of ordinary words a person would use. */
const LONG_NAME_STEM = "Wobblebottom Wonderful Harbour Glass Deep Field";
const LONG_LINE =
  "Tap the wobbly buttons before the tide comes in and the harbour lights go out, one by one, tonight.";

/** Runs a journey in one project only: the window it sets for itself is the same whichever project is asked. */
function onlyIn(project: "phone" | "phone-landscape"): void {
  test.skip(test.info().project.name !== project, `one Chromium project is enough for a window of its own`);
}

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

/** A new maker's game with the longest name and line, at Check and send. */
async function longGameAtCheck(page: Page): Promise<{ slug: string }> {
  const { slug } = await startDraft(page, freshName(LONG_NAME_STEM));
  await answerLine(page, LONG_LINE);
  await fillAnswers(slug, { line: false, files: true, videos: true, age: "age_12" });
  await giveRealClips(page, slug);
  await agreeToTheAgreement(page, slug);
  return { slug };
}

/** Where the bar of buttons starts, or the window's foot where the buttons are not in a bar. */
async function barTop(page: Page): Promise<number> {
  const inABar = ["phone", "phone-sideways", "tablet"].includes(layoutOf(page));
  return inABar ? (await boxOf(page.locator(".acts"))).y : (page.viewportSize()?.height ?? 0);
}

/** The right-most edge of anything inside `scope`, which must not pass the window. */
function rightmostEdge(page: Page, scope: string): Promise<number> {
  return page.evaluate(
    (selector) =>
      Math.max(
        ...[...document.querySelectorAll(`${selector} *`)].map((e) => e.getBoundingClientRect().right),
      ),
    scope,
  );
}

// ---- M1: Live's way home --------------------------------------------------------------------------------------------

test("on Live the Ruken wordmark is above the blurred video, so it can be seen and pressed", async ({
  page,
}) => {
  const { slug } = await gameWhere(page, { state: "live" });
  await page.goto(`/make/${slug}`);
  await layoutHasSettled(page);

  const wordmark = await boxOf(page.locator(".topbar .wordmark"));
  const top = await page.evaluate(
    ({ x, y }) => document.elementFromPoint(x, y)?.closest(".wordmark") !== null,
    { x: wordmark.x + wordmark.width / 2, y: wordmark.y + wordmark.height / 2 },
  );
  expect(top, "the thing on top at the wordmark is the wordmark").toBe(true);
});

// ---- M2: Check and send, with room for the words --------------------------------------------------------------------

test("on a phone Check and send has the name, the line and the facts across the whole width, under both videos", async ({
  page,
}) => {
  test.skip(layoutOf(page) !== "phone", "a phone held upright's own arrangement");
  await longGameAtCheck(page);
  await layoutHasSettled(page);

  const laid = await boxOf(page.locator(".laid"));
  const tiles = await boxOf(page.locator(".tiles"));
  const title = await boxOf(page.locator(".laid .title"));
  const tagline = await boxOf(page.locator(".laid .tagline"));
  // Both videos sit in one row, and the words start under them at the left edge, where the videos start.
  expect(title.y).toBeGreaterThanOrEqual(tiles.y + tiles.height);
  expect(title.x).toBeCloseTo(laid.x, 0);
  expect(tagline.x).toBeCloseTo(laid.x, 0);
  expect(await lineCount(page.locator(".laid .tagline"))).toBeLessThanOrEqual(5);
  // No word is cut across two lines: they move down whole.
  expect(await brokenWords(page.locator(".laid .title"))).toEqual([]);
  expect(await brokenWords(page.locator(".laid .tagline"))).toEqual([]);
});

test.describe("on an iPhone SE held upright", () => {
  test.use({ viewport: IPHONE_SE });

  test("Check and send has no word cut in two, and nothing runs past the window", async ({ page }) => {
    onlyIn("phone");
    await longGameAtCheck(page);
    await layoutHasSettled(page);

    expect(await brokenWords(page.locator(".laid"))).toEqual([]);
    expect(await rightmostEdge(page, ".laid")).toBeLessThanOrEqual(IPHONE_SE.width);
    for (const change of await page.locator(".laid .change").all()) {
      expect(await lineCount(change)).toBe(1);
      const box = await boxOf(change);
      expect(box.x + box.width).toBeLessThanOrEqual(IPHONE_SE.width);
    }
  });

  test("Sent back with everything fixed keeps its Hide and its Change whole and inside the card", async ({
    page,
  }) => {
    onlyIn("phone");
    const part: SentBackPart = { part: "upright_video", reason: "sideways" };
    const { slug } = await gameWhere(page, { state: "sent_back", toFix: [], fixed: [part] });
    await page.goto(`/make/${slug}`);
    await layoutHasSettled(page);

    const card = await boxOf(page.locator("details.accepted"));
    expect(await brokenWords(page.locator("details.accepted"))).toEqual([]);
    expect(await rightmostEdge(page, "details.accepted")).toBeLessThanOrEqual(card.x + card.width);
    // "Hide" is drawn by the stylesheet, so it is measured as the page draws it: one line is about 20px tall.
    const hideHeight = await page
      .locator("details.accepted > summary")
      .evaluate((summary) => Number.parseFloat(getComputedStyle(summary, "::after").height));
    expect(hideHeight).toBeLessThan(30);
  });
});

// ---- M4: a refusal is read, not hidden under the bar ----------------------------------------------------------------

async function expectReasonAboveBar(page: Page): Promise<void> {
  const reason = page.getByRole("alert");
  await expect(reason).toBeVisible();
  await expect
    .poll(async () => {
      const box = await boxOf(reason);
      return box.y + box.height <= (await barTop(page));
    })
    .toBe(true);
}

test("a refused name is read above the bar", async ({ page }) => {
  const { slug } = await startDraft(page);
  await page.goto(`/make/${slug}/name`);
  await pageHasSettled(page);
  await page.getByLabel("What's your game called?").fill("");
  await nextButton(page).click();
  await expectReasonAboveBar(page);
});

test("a refusal of where the game plays is read above the bar", async ({ page }) => {
  const { slug } = await startDraft(page);
  await fillAnswers(slug, { files: true, playsOn: false });
  await page.goto(`/make/${slug}/plays-on`);
  await pageHasSettled(page);
  await nextButton(page).click();
  await expectReasonAboveBar(page);
});

test("a refusal of who the game is for is read above the bar", async ({ page }) => {
  const { slug } = await startDraft(page);
  await fillAnswers(slug, { files: true, videos: true });
  await page.goto(`/make/${slug}/age`);
  await pageHasSettled(page);
  await nextButton(page).click();
  await expectReasonAboveBar(page);
});

test("a refusal of the other websites is read above the bar", async ({ page }) => {
  const { slug } = await startDraft(page);
  await fillAnswers(slug, { files: true });
  await page.goto(`/make/${slug}/websites`);
  await pageHasSettled(page);
  await page.getByLabel(/use other websites\?$/).fill("not a website");
  await nextButton(page).click();
  await expectReasonAboveBar(page);
});

test.describe("on an iPhone SE", () => {
  test.use({ viewport: IPHONE_SE });

  test("held upright, a refusal of who the game is for is read above the bar", async ({ page }) => {
    onlyIn("phone");
    const { slug } = await startDraft(page);
    await fillAnswers(slug, { files: true, videos: true });
    await page.goto(`/make/${slug}/age`);
    await pageHasSettled(page);
    await nextButton(page).click();
    await expectReasonAboveBar(page);
  });
});

test.describe("on an iPhone SE held sideways", () => {
  test.use({ viewport: IPHONE_SE_SIDEWAYS });

  test("a refusal of the first answer is read above the bar", async ({ page }) => {
    onlyIn("phone-landscape");
    const { slug } = await startDraft(page);
    await page.goto(`/make/${slug}/name`);
    await pageHasSettled(page);
    await page.getByLabel("What's your game called?").fill("");
    await nextButton(page).click();
    await expectReasonAboveBar(page);
  });

  // ---- M5: the wide video's question has room for its words ---------------------------------------------------------

  test("the wide video question's heading is not crushed beside its frame", async ({ page }) => {
    onlyIn("phone-landscape");
    await startAtVideo(page, "wide");
    await layoutHasSettled(page);

    const heading = page.getByRole("heading", { level: 1 });
    expect(await lineCount(heading)).toBeLessThanOrEqual(2);
    expect((await boxOf(heading)).width).toBeGreaterThanOrEqual(240);
    expect(await brokenWords(heading)).toEqual([]);
  });
});

// ---- M6: two cards that need fixing are two cards -------------------------------------------------------------------

test("two things sent back are two cards, with space between them", async ({ page }) => {
  const { slug } = await gameWhere(page, {
    state: "sent_back",
    toFix: [
      { part: "upright_video", reason: "sideways" },
      { part: "one_line", reason: "not_this_game" },
    ],
  });
  await page.goto(`/make/${slug}`);
  await layoutHasSettled(page);

  await expect(page.locator("a.sheet.fix")).toHaveCount(2);
  const first = await boxOf(page.locator("a.sheet.fix").nth(0));
  const second = await boxOf(page.locator("a.sheet.fix").nth(1));
  expect(second.y - (first.y + first.height)).toBeGreaterThanOrEqual(12);
});

// ---- M7: a long name in a question's heading ------------------------------------------------------------------------

async function draftWithLongName(page: Page): Promise<{ slug: string }> {
  return startDraft(page, freshName(LONG_NAME_STEM));
}

test.describe("a 56-letter name in a question's heading", () => {
  test.describe("on an iPhone SE held upright", () => {
    test.use({ viewport: IPHONE_SE });

    test("the heading keeps its words whole in a few lines, and the box is above the bar", async ({
      page,
    }) => {
      onlyIn("phone");
      await draftWithLongName(page);
      await pageHasSettled(page);

      const heading = page.getByRole("heading", { level: 1 });
      expect(await lineCount(heading)).toBeLessThanOrEqual(5);
      expect(await brokenWords(heading)).toEqual([]);
      const box = await boxOf(page.locator("input.answer"));
      expect(box.y + box.height).toBeLessThanOrEqual(await barTop(page));
    });
  });

  test.describe("on an iPhone SE held sideways", () => {
    test.use({ viewport: IPHONE_SE_SIDEWAYS });

    test("the box is above the bar", async ({ page }) => {
      onlyIn("phone-landscape");
      await draftWithLongName(page);
      await pageHasSettled(page);

      const box = await boxOf(page.locator("input.answer"));
      expect(box.y + box.height).toBeLessThanOrEqual(await barTop(page));
    });
  });

  test("the heading's words are whole on whatever window this is", async ({ page }) => {
    await draftWithLongName(page);
    await pageHasSettled(page);

    expect(await brokenWords(page.getByRole("heading", { level: 1 }))).toEqual([]);
  });
});

// ---- P11: sending a new version while one waits (the Owner: "Keep it, replace the waiting one") ---------------------

test("while an update waits, Send a new version is still there and says it takes the waiting one's place", async ({
  page,
}) => {
  const { slug } = await gameWhere(page, { state: "live", updateWaiting: true });
  await page.goto(`/make/${slug}`);
  await pageHasSettled(page);

  await expect(page.getByText("Your update is waiting for review.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Send a new version" })).toBeVisible();
  await expect(page.getByText(/It takes the place of the one that is waiting\./)).toBeVisible();
});

// ---- S2 and S10: a refused box ------------------------------------------------------------------------------------

test("the hint under a refused box starts clear of the box's ring", async ({ page }) => {
  const { slug } = await startDraft(page);
  await page.goto(`/make/${slug}/name`);
  await pageHasSettled(page);
  await page.getByLabel("What's your game called?").fill("");
  await nextButton(page).click();
  await expect(page.getByRole("alert")).toBeVisible();

  const box = await boxOf(page.locator("input.answer"));
  const hint = await boxOf(page.locator("#hint"));
  // The ring is 4px thick and stands 3px out from the box: 12px of air beyond it.
  expect(hint.y - (box.y + box.height)).toBeGreaterThanOrEqual(19);
});

test("the other websites box is the same height refused as before, with room above its words", async ({
  page,
}) => {
  const { slug } = await startDraft(page);
  await fillAnswers(slug, { files: true });
  await page.goto(`/make/${slug}/websites`);
  await pageHasSettled(page);
  const box = page.locator("textarea.answer");
  const before = await boxOf(box);
  await expect(box).toHaveCSS("padding-top", "16px");

  await page.getByLabel(/use other websites\?$/).fill("not a website");
  await nextButton(page).click();
  await expect(page.getByRole("alert")).toBeVisible();

  await expect(box).toHaveCSS("padding-top", "16px");
  expect((await boxOf(box)).height).toBeCloseTo(before.height, 0);
});

// ---- S5: the links under a video -----------------------------------------------------------------------------------

test("the two links under a chosen video are one look, a line each, with the action first", async ({
  page,
}) => {
  const { slug } = await startDraft(page);
  await fillAnswers(slug, { files: true, videos: true });
  await giveRealClips(page, slug);
  await page.goto(`/make/${slug}/upright`);
  await pageHasSettled(page);

  const change = page.getByRole("link", { name: "Choose a different video" });
  const howTo = page.getByRole("link", { name: "How do I record my screen?" });
  for (const link of [change, howTo]) {
    await expect(link).toHaveCSS("font-size", "14px");
    await expect(link).toHaveCSS("color", rgb(token("--sage")));
  }
  const first = await boxOf(change);
  const second = await boxOf(howTo);
  expect(first.y).toBeLessThan(second.y);
  expect(second.y).toBeGreaterThanOrEqual(first.y + first.height);
});

// ---- S6: Throw this game away starts where the words start -----------------------------------------------------------

test("Throw this game away starts at the left edge of the question's words", async ({ page }) => {
  await startDraft(page);
  await layoutHasSettled(page);

  const heading = await boxOf(page.getByRole("heading", { level: 1 }));
  const foot = await boxOf(page.getByRole("link", { name: "Throw this game away" }));
  expect(foot.x).toBeCloseTo(heading.x, 0);
});

test("Throw this game away starts at the left edge of Check and send's words", async ({ page }) => {
  await startAtCheck(page);
  await layoutHasSettled(page);

  const heading = await boxOf(page.getByRole("heading", { level: 1 }));
  const foot = await boxOf(page.getByRole("link", { name: "Throw this game away" }));
  expect(foot.x).toBeCloseTo(heading.x, 0);
});

// ---- S9: the full-size video --------------------------------------------------------------------------------------

test("while a video is open full size the page behind it does not scroll", async ({ page }) => {
  await startAtCheck(page);
  await page.getByRole("link", { name: "Watch the upright video full size" }).click();

  await expect(page.locator("dialog.viewer[open]")).toBeVisible();
  await expect(page.locator("html")).toHaveCSS("overflow", "hidden");
});

// ---- S11: the agreement is a press, not a key ------------------------------------------------------------------------

test("the agreement does not hint that Enter agrees", async ({ page }) => {
  const { slug } = await startDraft(page);
  await fillAnswers(slug, { files: true, videos: true, age: "age_12" });
  await page.goto(`/make/${slug}/agreement`);
  await pageHasSettled(page);

  await expect(page.getByRole("button", { name: "I agree" })).toBeVisible();
  await expect(page.getByText("press Enter")).toHaveCount(0);
});

test.describe("on an iPhone SE held upright, more", () => {
  test.use({ viewport: IPHONE_SE });

  // ---- S12: the agreement's numbers -------------------------------------------------------------------------------

  test("the agreement's clause numbers hang in a narrow gutter", async ({ page }) => {
    onlyIn("phone");
    const { slug } = await startDraft(page);
    await fillAnswers(slug, { files: true, videos: true, age: "age_12" });
    await page.goto(`/make/${slug}/agreement`);
    await pageHasSettled(page);

    await expect(page.locator(".sheet ol")).toHaveCSS("padding-left", "28px");
  });

  // ---- S13: a repository's name is not cut at a hyphen --------------------------------------------------------------

  test("a repository's name goes to a second line only after its slash", async ({ page }) => {
    onlyIn("phone");
    const { slug } = await startAtFiles(page);
    await connectGitHubFromFiles(page, slug);

    for (const name of await page.locator(".pick > b").all()) {
      expect(await brokenWords(name, "\\s/")).toEqual([]);
    }
  });
});

// ---- S14: the record-your-screen page opens with a way to each device ----------------------------------------------------

test("the record-your-screen page opens with a link to each device's steps", async ({ page }) => {
  await page.goto("/help/record-screen");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  for (const device of ["iPhone or iPad", "Android phone", "Windows computer", "Mac"]) {
    const jump = page.getByRole("link", { name: device, exact: true });
    await expect(jump).toHaveCount(1);
    const target = await jump.getAttribute("href");
    expect(target).toMatch(/^#[a-z-]+$/);
    await expect(page.locator(target ?? "#none")).toHaveText(device);
  }
});

// ---- P1: both ways a game plays are explained -----------------------------------------------------------------------

test("both choices of where the game plays have a line under them", async ({ page }) => {
  const { slug } = await startDraft(page);
  await fillAnswers(slug, { files: true, playsOn: false });
  await page.goto(`/make/${slug}/plays-on`);
  await pageHasSettled(page);

  await expect(page.locator(".pick > span")).toHaveCount(2);
});
