import { expect, test, type Locator, type Page } from "@playwright/test";
import { pageHasSettled, signUp } from "./support/account.ts";
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
import {
  boxOf,
  brokenWords,
  layoutHasSettled,
  layoutOf,
  lineCount,
  wordsHaveSettled,
} from "./support/look.ts";
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
  // Words only: the upright video this game has is a stand-in that never loads.
  await wordsHaveSettled(page);
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
  // Words only: the game's videos here are stand-ins that never load, so a wait for them would never end.
  await wordsHaveSettled(page);
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

// ---- L12: on an iPhone SE the two can't-be-undone headings are no more than three lines -------------------------------------

test.describe("on an iPhone SE held upright", () => {
  test.use({ viewport: IPHONE_SE });

  for (const screen of ["take-off", "throw-away"] as const) {
    test(`the ${screen} heading is at most three lines, with its words whole`, async ({ page }) => {
      test.skip(
        test.info().project.name !== "phone",
        "one Chromium project is enough for a window of its own",
      );
      const slug = await aGameFor(page, screen);
      await page.goto(`/make/${slug}/${screen}`);
      await wordsHaveSettled(page);

      const heading = page.getByRole("heading", { level: 1 });
      expect(await lineCount(heading)).toBeLessThanOrEqual(3);
      expect(await brokenWords(heading)).toEqual([]);
    });
  }
});

// ---- L16: on Live, held sideways or on a computer, a card above the video is as wide as the video -----------------------------

test("on Live a card for a part sent back ends where the video under it ends, in a window held sideways", async ({
  page,
}) => {
  test.skip(
    !["computer", "tablet-sideways", "phone-sideways"].includes(layoutOf(page)),
    "only a window held sideways shows the wide video",
  );
  const { slug } = await gameWhere(page, {
    state: "live",
    toFix: [{ part: "one_line", reason: "not_this_game" }],
  });
  await page.goto(`/make/${slug}`);
  await wordsHaveSettled(page);

  const card = await boxOf(page.locator("a.sheet.fix"));
  const video = await boxOf(page.locator(".after .tiles figure > div"));
  expect(Math.abs(card.x + card.width - (video.x + video.width)), "right edges").toBeLessThanOrEqual(2);
  expect(Math.abs(card.x - video.x), "left edges").toBeLessThanOrEqual(1);
});

// ---- L24: Your games, empty ------------------------------------------------------------------------------------------------

test("on a tablet held sideways, as on a computer, 'Add a game' is on the heading's line", async ({
  page,
}) => {
  test.skip(layoutOf(page) !== "tablet-sideways", "the computer's journey is in make-screen-review");
  await signUp(page);
  await page.goto("/make");
  await pageHasSettled(page);

  const heading = await boxOf(page.getByRole("heading", { level: 1 }));
  const add = await boxOf(page.getByRole("link", { name: "Add a game" }));
  expect(add.y).toBeLessThan(heading.y + heading.height);
  expect(add.x).toBeGreaterThan(heading.x + heading.width);
});

test("the Maker agreement link has a line's room above it", async ({ page }) => {
  await signUp(page);
  await page.goto("/make");
  await pageHasSettled(page);

  const above = await page.locator("main.games").evaluate((main) => {
    const note = main.querySelector(":scope > .note");
    const sections = [...main.children].filter((child) => child !== note);
    return Math.max(...sections.map((child) => child.getBoundingClientRect().bottom));
  });
  const link = await boxOf(page.getByRole("link", { name: "Maker agreement" }));
  expect(link.y - above, "the link starts well under what is above it").toBeGreaterThanOrEqual(16);
});

// ---- L22: a refusal is read with the question it is about -----------------------------------------------------------------------

const IPHONE_SE_SIDEWAYS = { width: 568, height: 320 };

/** The question's heading is in the window, and the reason is above the bar: the maker reads both. */
async function expectQuestionAndReason(page: Page): Promise<void> {
  const heading = page.getByRole("heading", { level: 1 });
  const reason = page.getByRole("alert");
  await expect(reason).toBeVisible();
  await expect
    .poll(async () => {
      const question = await boxOf(heading);
      const why = await boxOf(reason);
      return question.y >= 0 && why.y + why.height <= (await boxOf(page.locator(".acts"))).y;
    })
    .toBe(true);
}

test.describe("on an iPhone SE held upright, a refusal", () => {
  test.use({ viewport: IPHONE_SE });

  test("of where the game plays is read with its heading", async ({ page }) => {
    test.skip(test.info().project.name !== "phone", "one Chromium project is enough for a window of its own");
    const { slug } = await startDraft(page);
    await fillAnswers(slug, { files: true, playsOn: false });
    await page.goto(`/make/${slug}/plays-on`);
    await wordsHaveSettled(page);
    await nextButton(page).click();
    await expectQuestionAndReason(page);
  });
});

test.describe("on an iPhone SE held sideways, a refusal", () => {
  test.use({ viewport: IPHONE_SE_SIDEWAYS });

  test("of the first answer is read with its heading and its box", async ({ page }) => {
    test.skip(test.info().project.name !== "phone", "one Chromium project is enough for a window of its own");
    const { slug } = await startDraft(page);
    await page.goto(`/make/${slug}/name`);
    await wordsHaveSettled(page);
    await page.getByLabel("What's your game called?").fill("");
    await nextButton(page).click();
    await expectQuestionAndReason(page);
    expect((await boxOf(page.getByLabel("What's your game called?"))).y).toBeGreaterThanOrEqual(0);
  });
});

// ---- L23: on the agreement, "I agree" comes after the last point ---------------------------------------------------------------

test("on a wide window the agreement's buttons are after the last point, not beside the first", async ({
  page,
}) => {
  test.skip(
    !["computer", "tablet-sideways"].includes(layoutOf(page)),
    "a narrow window has the buttons in its bar, under the points",
  );
  const { slug } = await startDraft(page);
  await fillAnswers(slug, { files: true, videos: true, age: "age_12" });
  await page.goto(`/make/${slug}/agreement`);
  await wordsHaveSettled(page);

  const last = await boxOf(page.locator(".sheet li").last());
  const agree = await boxOf(page.getByRole("button", { name: "I agree" }));
  expect(agree.y, "I agree is under the last point").toBeGreaterThanOrEqual(last.y + last.height);
  // A way back that does not wait at the foot of seven points.
  const way = await boxOf(page.getByRole("link", { name: "Back to the last question" }));
  expect(way.y + way.height, "a way back on the first screen").toBeLessThanOrEqual(
    page.viewportSize()?.height ?? 0,
  );
});

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

test("on a wide window the screen after taking a game off starts at the top left, where Waiting starts, not in the middle", async ({
  page,
}) => {
  test.skip(!["computer", "tablet-sideways"].includes(layoutOf(page)), "a window held sideways, with room");
  const waiting = await gameWhere(page, { state: "waiting" });
  await page.goto(`/make/${waiting.slug}`);
  await wordsHaveSettled(page);
  const whereWaitingStarts = await boxOf(page.locator("main .count").first());

  const live = await gameWhere(page, { state: "live" });
  await page.goto(`/make/${live.slug}/take-off`);
  await page.getByRole("button", { name: "Take it off Ruken" }).click();
  await expect(page).toHaveURL(`/make/${live.slug}`);
  await wordsHaveSettled(page);
  const whereThisStarts = await boxOf(page.locator("main .count").first());

  expect(Math.abs(whereThisStarts.x - whereWaitingStarts.x), "left").toBeLessThanOrEqual(1);
  // Under the bar, at the top: the screen's own padding is 32px under the bar (about 70px tall), nowhere near the middle.
  expect(whereThisStarts.y, "top").toBeLessThan(150);
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

// ---- L4 and L5: on a short phone the words come first and the videos after ------------------------------------------------------

/** Runs a journey in one project only: the window it sets for itself is the same whichever project is asked. */
function onlyInPhone(): void {
  test.skip(test.info().project.name !== "phone", "one Chromium project is enough for a window of its own");
}

test("on a phone Check and send shows the name, the line and every fact above the bar, and the videos after them", async ({
  page,
}) => {
  test.skip(layoutOf(page) !== "phone", "a phone held upright's own arrangement");
  await startAtCheck(page);
  await layoutHasSettled(page);

  const bar = await boxOf(page.locator(".acts"));
  const tiles = await boxOf(page.locator(".tiles"));
  for (const part of [
    page.locator(".laid .title"),
    page.locator(".laid .tagline"),
    page.locator(".laid .chip").last(),
  ]) {
    const box = await boxOf(part);
    expect(box.y + box.height, "ends above the bar").toBeLessThanOrEqual(bar.y);
    expect(tiles.y, "the videos come after it").toBeGreaterThan(box.y);
  }
});

test.describe("on an iPhone SE held upright", () => {
  test.use({ viewport: IPHONE_SE });

  for (const shape of ["upright", "wide"] as const) {
    test(`the ${shape} video question shows how to record above the bar, and above its frame`, async ({
      page,
    }) => {
      onlyInPhone();
      await startAtVideo(page, shape);
      // Words only: the wide question's game has an upright video that is a stand-in and never loads.
      await wordsHaveSettled(page);

      const bar = await boxOf(page.locator(".acts"));
      const frame = await boxOf(page.locator(".vframe"));
      const howTo = await boxOf(page.getByRole("link", { name: "How do I record my screen?" }));
      expect(howTo.y + howTo.height, "the how-to link ends above the bar").toBeLessThanOrEqual(bar.y);
      expect(howTo.y, "the link is above the frame").toBeLessThan(frame.y);
    });
  }

  test("the choices of where the game plays are both above the bar", async ({ page }) => {
    onlyInPhone();
    await expectChoicesAboveTheBar(page, 2);
  });
});

/** Goes to the question of where the game plays and checks that the first `count` choices end above the bar, their words with them. */
async function expectChoicesAboveTheBar(page: Page, count: number): Promise<void> {
  const { slug } = await startDraft(page);
  await fillAnswers(slug, { files: true, playsOn: false });
  await page.goto(`/make/${slug}/plays-on`);
  await wordsHaveSettled(page);

  const bar = await boxOf(page.locator(".acts"));
  const picks = page.locator(".pick");
  for (let which = 0; which < count; which += 1) {
    const box = await boxOf(picks.nth(which));
    expect(box.y + box.height, `choice ${String(which + 1)} ends above the bar`).toBeLessThanOrEqual(bar.y);
  }
}

/** Goes to Check and send and checks that the name and the line end above the bar, and that the videos come after them. */
async function expectFactsBeforeTheVideos(page: Page, facts: Locator[]): Promise<void> {
  await startAtCheck(page);
  await layoutHasSettled(page);

  const bar = await boxOf(page.locator(".acts"));
  const tiles = await boxOf(page.locator(".tiles"));
  for (const fact of facts) {
    const box = await boxOf(fact);
    expect(box.y + box.height, "ends above the bar").toBeLessThanOrEqual(bar.y);
    expect(tiles.y, "the videos come after it").toBeGreaterThan(box.y);
  }
}

test.describe("on a phone held sideways", () => {
  test.use({ viewport: { width: 915, height: 412 } });

  test("the choices of where the game plays are both above the bar", async ({ page }) => {
    onlyInPhone();
    await expectChoicesAboveTheBar(page, 2);
  });

  test("Check and send shows the name, the line and every fact above the bar, and the videos after them", async ({
    page,
  }) => {
    onlyInPhone();
    await expectFactsBeforeTheVideos(page, [
      page.locator(".laid .title"),
      page.locator(".laid .tagline"),
      page.locator(".laid .chip").last(),
    ]);
  });
});

test.describe("on an iPhone SE held sideways", () => {
  test.use({ viewport: IPHONE_SE_SIDEWAYS });

  test("the first choice of where the game plays is above the bar, whole", async ({ page }) => {
    onlyInPhone();
    await expectChoicesAboveTheBar(page, 1);
  });

  test("Check and send shows the name and the line above the bar, and the videos after them", async ({ page }) => {
    onlyInPhone();
    await expectFactsBeforeTheVideos(page, [page.locator(".laid .title"), page.locator(".laid .tagline")]);
  });
});

// ---- L9: the card of what players will see shows both videos, across its whole width -----------------------------------

test("beside a question the card of what players will see shows the upright and the wide video, filling its width", async ({
  page,
}) => {
  const layout = layoutOf(page);
  test.skip(layout !== "computer" && layout !== "tablet-sideways", "only a wide window has the card");
  const { slug } = await startDraft(page);
  await fillAnswers(slug, { files: true, videos: true });
  await page.goto(`/make/${slug}/age`);
  await wordsHaveSettled(page);

  const row = await page.locator(".preview .card").evaluate((card) => {
    const style = getComputedStyle(card);
    const box = card.getBoundingClientRect();
    const inner = box.width - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const tiles = [...card.querySelectorAll("[data-shape]")].map((tile) => ({
      shape: tile.getAttribute("data-shape"),
      box: tile.getBoundingClientRect(),
    }));
    const used =
      Math.max(...tiles.map((tile) => tile.box.right)) - Math.min(...tiles.map((tile) => tile.box.left));
    return { inner, used, shapes: tiles.map((tile) => tile.shape) };
  });
  expect(row.shapes).toEqual(["upright", "wide"]);
  expect(row.used, "the two videos use the card's whole width").toBeGreaterThanOrEqual(row.inner - 2);
});

// ---- L10: a Needs fixing card's upright video is beside its words --------------------------------------------------------

test("a Needs fixing card with an upright video has the video beside its words, at the card's right edge", async ({
  page,
}) => {
  const { slug } = await gameWhere(page, {
    state: "sent_back",
    toFix: [{ part: "upright_video", reason: "sideways" }],
  });
  await page.goto(`/make/${slug}`);
  await wordsHaveSettled(page);

  const card = page.locator("a.sheet.fix");
  const video = await boxOf(card.locator("video"));
  const title = await boxOf(card.locator(".statement"));
  const sheet = await card.evaluate((element) => {
    const style = getComputedStyle(element);
    const box = element.getBoundingClientRect();
    return { right: box.right - parseFloat(style.paddingRight) };
  });
  expect(video.x, "beside the words, not over them").toBeGreaterThanOrEqual(title.x + title.width - 1);
  expect(video.y, "level with the top of the words, not below them").toBeLessThan(title.y + title.height);
  expect(video.x + video.width, "at the card's right edge").toBeGreaterThanOrEqual(sheet.right - 2);
});

// ---- L11: the upright frame is in the middle of its row, and its words keep off its edges --------------------------------

test("under the question the empty upright frame is in the middle of its row", async ({ page }) => {
  const layout = layoutOf(page);
  test.skip(
    layout !== "phone" && layout !== "tablet",
    "only a window that puts the frame under the question",
  );
  await startAtVideo(page, "upright");
  await wordsHaveSettled(page);

  const frame = await boxOf(page.locator(".vframe"));
  const row = await boxOf(page.locator("form:has(> .vframe)"));
  const away = frame.x + frame.width / 2 - (row.x + row.width / 2);
  expect(Math.abs(away), "the frame's middle is the row's middle").toBeLessThanOrEqual(2);
});

test("the words in an empty video frame keep at least 8px off its edges", async ({ page }) => {
  await startAtVideo(page, "upright");
  await wordsHaveSettled(page);

  const frame = await boxOf(page.locator("label.vframe"));
  const words = await boxOf(page.locator("label.vframe > span"));
  expect(words.x - frame.x, "left").toBeGreaterThanOrEqual(8);
  expect(frame.x + frame.width - (words.x + words.width), "right").toBeGreaterThanOrEqual(8);
});
