import { expect, test, type Locator, type Page } from "@playwright/test";
import { pageHasSettled, signUp } from "./support/account.ts";
import { changeGame, fillAnswers, putGameWhereStaffLeaveIt } from "./support/database.ts";
import {
  addDraft,
  addVideo,
  agreeToTheAgreement,
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
  clearOfTheButtons,
  layoutHasSettled,
  heldSideways,
  layoutOf,
  lineCount,
  wordsHaveSettled,
} from "./support/look.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";
import { rgb, token } from "../support/look-tokens.ts";
import { asInstalled } from "./support/installed.ts";

// What the second look at the submission screens found (docs/superpowers/audits/2026-11-15-submission-screens-second-look.md),
// one journey for each thing that was wrong and can be measured. Each measures the page in the window it runs in. The one
// that needs an iPhone SE's window held a set way gives itself that window and runs in the phone project only.

test.beforeEach(forgetRateLimits);

const IPHONE_SE = { width: 320, height: 568 };

/** A line as long as the screens allow (100 letters), made of ordinary words a person would use. */
const LONG_LINE =
  "Tap the wobbly buttons before the tide comes in and the harbour lights go out, one by one, tonight.";

/** The size, in pixels, and the opacity a link is drawn with. */
function drawnAs(link: ReturnType<Page["getByRole"]>): Promise<{ size: number; colour: string }> {
  return link.evaluate((element) => {
    const style = getComputedStyle(element);
    return { size: parseFloat(style.fontSize), colour: style.color };
  });
}

// ---- L1: Live's way off Ruken is quiet ---------------------------------------------------------------------------------

test("on Live, taking the game off Ruken is the quietest button: last, smaller and dimmer than Back", async ({
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
  // Dimmer: both are real buttons now (the owner, 2026-11-22: no underlined words as buttons), and the way off has the
  // softer Glaucous Green words where Back has chalk. Never see-through, which would only be glass.
  expect(backDrawn.colour, "Back's words are chalk").toBe(rgb(token("--chalk")));
  expect(offDrawn.colour, "dimmer than Back").toBe(rgb(token("--sage")));
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

  // A game with its wide video already in: the same question shows the video, with two more lines of links. The same maker's
  // second game: signing up again while signed in would find no sign-up form.
  const { slug } = await addDraft(page);
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
  // Found by its question, as `answerLine` does: the address reads /line a moment before the screen does, and a box found
  // by its kind alone can be the name's box still there, so the line is typed into it and is gone when the question comes
  // (run 43767161072: Enter sent an empty line, and the page stayed on it).
  const box = page.getByLabel(/about, in one line\?$/);
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
  test.skip(test.info().project.name !== "phone", "one project is enough for a window of its own");
  await page.setViewportSize(IPHONE_SE);
  await startDraft(page);
  await page.goto("/make");
  await layoutHasSettled(page);

  expect(await brokenWords(page.locator("a.game .statement"))).toEqual([]);
  const picture = await boxOf(page.locator("a.game > .tile"));
  expect(picture.width, "the picture leaves the name its room").toBeLessThanOrEqual(72);
});

test("on a 412-wide phone a long word in a game's name stays whole in Your games", async ({ page }) => {
  test.skip(test.info().project.name !== "phone", "one Chromium project is enough for a window of its own");
  await page.setViewportSize({ width: 412, height: 839 });
  await startDraft(page, "The Extraordinary Long Adventures of Bartholomew");
  await page.goto("/make");
  await layoutHasSettled(page);

  expect(await brokenWords(page.locator("a.game .statement"))).toEqual([]);
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
}

function buttonsSameWidth(): void {
  for (const screen of ["take-off", "throw-away"] as const) {
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
}

buttonsSameWidth();
heldSideways("tablet", buttonsSameWidth);

// ---- L12: on an iPhone SE the two can't-be-undone headings are no more than three lines -------------------------------------

test.describe("on an iPhone SE held upright", () => {
  test.use({ viewport: IPHONE_SE });

  for (const screen of ["take-off", "throw-away"] as const) {
    test(`the ${screen} heading is at most three lines, with its words whole`, async ({ page }) => {
      test.skip(test.info().project.name !== "phone", "one project is enough for a window of its own");
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

function cardEndsWhereTheVideoEnds(): void {
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
}

cardEndsWhereTheVideoEnds();
heldSideways("tablet", cardEndsWhereTheVideoEnds);
heldSideways("phone", cardEndsWhereTheVideoEnds);

// ---- L24: Your games, empty ------------------------------------------------------------------------------------------------

function addAGameOnTheHeadingsLine(): void {
  test("on a tablet held sideways, as on a computer, 'Add a game' is on the heading's line", async ({
    page,
  }) => {
    test.skip(layoutOf(page) !== "tablet-sideways", "the computer's journey is in make-screen-review");
    await signUp(page);
    await page.goto("/make");
    await pageHasSettled(page);

    const heading = await boxOf(page.getByRole("heading", { level: 1 }));
    const add = await boxOf(page.getByRole("main").getByRole("link", { name: "Add a game" }));
    expect(add.y).toBeLessThan(heading.y + heading.height);
    expect(add.x).toBeGreaterThan(heading.x + heading.width);
  });
}

heldSideways("tablet", addAGameOnTheHeadingsLine);

test("the Maker agreement link has a line's room above it", async ({ page }) => {
  await signUp(page);
  await page.goto("/make");
  await pageHasSettled(page);
  // Each line of the screen rises 28px into place, a little after the one before. Measured while they rose, the link
  // and what is above it were caught at different points of their rise, and on phone the room read 12.6 to 15.8
  // (progress.md, Flaky tests). So the screen is measured at rest, and in one look.
  await wordsHaveSettled(page);

  const { above, wordsTop, layout } = await page.locator("main.games").evaluate((main) => {
    const note = main.querySelector(":scope > .ways");
    // The bar of buttons is fixed to the window's bottom on a phone, so it is not something the link sits under.
    const sections = [...main.children].filter(
      (child) => child !== note && getComputedStyle(child).position !== "fixed",
    );
    // What each part measured, for the failure message: this fails now and then on phone (progress.md, Flaky tests).
    const layout = [...main.children]
      .map((child) => {
        const box = child.getBoundingClientRect();
        return `${child.tagName.toLowerCase()}.${child.className} ${getComputedStyle(child).position} top ${String(box.top)} bottom ${String(box.bottom)}`;
      })
      .concat(`fonts ${document.fonts.status}`);
    // Its words, not its box: the line of quiet buttons, measured from where their words start.
    const link = [...(note?.querySelectorAll("a") ?? [])].find(
      (a) => a.textContent.trim() === "Maker agreement",
    );
    if (link === undefined) throw new Error("there is no Maker agreement button in the line of ways");
    const range = document.createRange();
    range.selectNodeContents(link);
    return {
      above: Math.max(...sections.map((child) => child.getBoundingClientRect().bottom)),
      wordsTop: range.getBoundingClientRect().y,
      layout,
    };
  });
  expect(
    wordsTop - above,
    `the link's words start well under what is above them (words at ${String(wordsTop)}; ${layout.join("; ")})`,
  ).toBeGreaterThanOrEqual(16);
});

// ---- L22: a refusal is read with the question it is about -----------------------------------------------------------------------
// Changed on purpose in the sideways steps follow-up (slice 2 design round 3, note 3): on a phone held sideways Back and
// Save stand in a column at the right edge, not in a row across the foot, so the sideways journeys in this file ask
// whether a thing is clear of the buttons and in the window (clearOfTheButtons in support/look.ts), not above a row.

const IPHONE_SE_SIDEWAYS = { width: 568, height: 320 };

/** The question's heading is in the window, and the reason is clear of Back and Save: the maker reads both. */
async function expectQuestionAndReason(page: Page): Promise<void> {
  const heading = page.getByRole("heading", { level: 1 });
  const reason = page.getByRole("alert");
  await expect(reason).toBeVisible();
  await expect
    .poll(async () => {
      const question = await boxOf(heading);
      return question.y >= 0 && (await clearOfTheButtons(page, await boxOf(reason)));
    })
    .toBe(true);
}

test.describe("on an iPhone SE held sideways, a refusal", () => {
  test.use({ viewport: IPHONE_SE_SIDEWAYS });
  // Opened from the Home Screen: in a browser tab a phone held sideways is asked to turn upright.
  test.beforeEach(({ page }) => asInstalled(page));

  test("of the first answer is read with its heading and its box", async ({ page }) => {
    test.skip(test.info().project.name !== "phone", "one project is enough for a window of its own");
    const { slug } = await startDraft(page);
    await page.goto(`/make/${slug}/name`);
    await wordsHaveSettled(page);
    await page.getByLabel("What's your game called?").fill("");
    await nextButton(page).click();
    await expectQuestionAndReason(page);
    expect((await boxOf(page.getByLabel("What's your game called?"))).y).toBeGreaterThanOrEqual(0);
  });
});

// ---- L23: on the agreement, "I agree" is in view, under a sheet that scrolls inside itself ---------------------------------
// Changed on purpose in the slice 2 design round 2 fix: this used to assert that the buttons were below the last point,
// which on a 1280 by 720 window put "I agree" below the fold. The spec (4.2, 5a note 2) says the button is always in view and the
// sheet scrolls inside itself, so the check now says that, and that every point can still be read.

function agreeInViewUnderTheSheet(): void {
  test("on a wide window I agree and Back are in view, under a sheet that scrolls inside itself", async ({
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

    const height = page.viewportSize()?.height ?? 0;
    const agree = await boxOf(page.getByRole("button", { name: "I agree" }));
    const back = await boxOf(page.getByRole("link", { name: "Back", exact: true }));
    expect(agree.y + agree.height, "I agree is in the first view").toBeLessThanOrEqual(height);
    expect(back.y + back.height, "Back is in the first view").toBeLessThanOrEqual(height);
    // The buttons are still after the reading: under the sheet, not beside point 1.
    const sheet = await boxOf(page.locator(".sheet"));
    expect(agree.y, "I agree is under the sheet").toBeGreaterThanOrEqual(sheet.y + sheet.height);
    // All seven points can be read: scrolling the sheet brings the last one into view.
    await page.locator(".sheet").evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    const last = await boxOf(page.locator(".sheet li").last());
    expect(last.y + last.height, "the last point can be scrolled into view").toBeLessThanOrEqual(
      sheet.y + sheet.height + 1,
    );
    // A way back that does not wait at the foot of seven points.
    const way = await boxOf(page.getByRole("link", { name: "Back to the last question" }));
    expect(way.y + way.height, "a way back on the first screen").toBeLessThanOrEqual(height);
  });
}

agreeInViewUnderTheSheet();
heldSideways("tablet", agreeInViewUnderTheSheet);

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

test("after a game is taken off Ruken, the screen says players can't find it and has the button to put it back", async ({
  page,
}) => {
  const { slug } = await gameWhere(page, { state: "live" });
  await page.goto(`/make/${slug}/take-off`);
  await page.getByRole("button", { name: "Take it off Ruken" }).click();
  await expect(page).toHaveURL(`/make/${slug}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Taken off Ruken");
  await expect(page.getByText("Players can't find it or play it.")).toBeVisible();
  await expect(page.getByText("Nothing changed on GitHub.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Put it back on Ruken" })).toBeVisible();
});

function takenOffStartsTopLeft(): void {
  test("on a wide window the screen after taking a game off starts at the top left, where Waiting starts, not in the middle", async ({
    page,
  }) => {
    test.skip(!["computer", "tablet-sideways"].includes(layoutOf(page)), "a window held sideways, with room");
    const waiting = await gameWhere(page, { state: "waiting" });
    await page.goto(`/make/${waiting.slug}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Waiting for review");
    await wordsHaveSettled(page);
    const whereWaitingStarts = await boxOf(page.locator("main :is(.count, h1)").first());

    // The same maker's second game: signing up again while signed in would find no sign-up form.
    const live = await addDraft(page);
    await fillAnswers(live.slug, { files: true, videos: true, age: "age_12" });
    await giveRealClips(page, live.slug);
    await putGameWhereStaffLeaveIt(live.slug, { state: "live" });
    await page.goto(`/make/${live.slug}/take-off`);
    await page.getByRole("button", { name: "Take it off Ruken" }).click();
    await expect(page).toHaveURL(`/make/${live.slug}`);
    // The address changes a moment before the new screen replaces the question's card, so the screen itself is waited for:
    // measured at once, the first match can be the card as it leaves, with no box (the flake on main, run 44024056397).
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Taken off Ruken");
    await wordsHaveSettled(page);
    const whereThisStarts = await boxOf(page.locator("main :is(.count, h1)").first());

    expect(Math.abs(whereThisStarts.x - whereWaitingStarts.x), "left").toBeLessThanOrEqual(1);
    // Under the bar, at the top: the screen's own padding is 32px under the bar (about 70px tall), nowhere near the middle.
    expect(whereThisStarts.y, "top").toBeLessThan(150);
  });
}

takenOffStartsTopLeft();
heldSideways("tablet", takenOffStartsTopLeft);

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
  test.skip(test.info().project.name !== "phone", "one project is enough for a window of its own");
}

test("on a phone Check and send shows the name, the line and every fact above the bar, and the videos after them", async ({
  page,
}) => {
  test.skip(layoutOf(page) !== "phone", "a phone held upright's own arrangement");
  const { slug } = await startAtCheck(page);
  // A name that takes two lines on this phone. Each journey's game had a name of its own, and only some of them wrap, so
  // this journey failed only now and then: the last fact's Change was 6px under the bar (progress.md, Flaky tests).
  await changeGame(slug, { name: "Tiny game b0680d94" });
  await page.goto(`/make/${slug}/check`);
  await pageHasSettled(page);
  await layoutHasSettled(page);
  const title = page.locator(".laid .title");
  expect(await lineCount(title), "the name takes two lines").toBe(2);

  const bar = await boxOf(page.locator(".acts"));
  const tiles = await boxOf(page.locator(".tiles"));
  // Each row, with its Change: the name, the line and every fact.
  const rows = page.locator(".laid > div:not(.tiles), .laid li");
  expect(await rows.count()).toBeGreaterThanOrEqual(5);
  for (const row of await rows.all()) {
    const box = await boxOf(row);
    expect(box.y + box.height, `${await row.innerText()} ends above the bar`).toBeLessThanOrEqual(bar.y);
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

  test("the choices of who the game is for are both above the bar", async ({ page }) => {
    onlyInPhone();
    await expectChoicesAboveTheBar(page, 2);
  });
});

/**
 * The name the question of who the game is for is measured with. A fresh name's random letters differ in width, and
 * about one in eight put the SE's heading on a fourth line, which moved the choices 38px down and failed the journey by
 * chance. The address stays fresh; only the name shown is fixed.
 */
const CHOICES_NAME = "Tiny game 1899072e";

/** Goes to the question of who the game is for and checks that the first `count` choices are clear of Back and Save, their words with them. */
async function expectChoicesAboveTheBar(page: Page, count: number): Promise<void> {
  const { slug } = await startDraft(page);
  await fillAnswers(slug, { files: true, videos: true });
  await changeGame(slug, { name: CHOICES_NAME });
  await page.goto(`/make/${slug}/age`);
  await wordsHaveSettled(page);
  expect(
    await lineCount(page.getByRole("heading", { level: 1 })),
    "the heading takes at most three lines",
  ).toBeLessThanOrEqual(3);

  const picks = page.locator(".pick");
  for (let which = 0; which < count; which += 1) {
    const box = await boxOf(picks.nth(which));
    expect(await clearOfTheButtons(page, box), `choice ${String(which + 1)} is clear of the buttons`).toBe(
      true,
    );
  }
}

/** Goes to Check and send and checks that the name and the line are clear of Back and Save, and that the videos come after them. */
async function expectFactsBeforeTheVideos(page: Page, facts: Locator[]): Promise<void> {
  await startAtCheck(page);
  await layoutHasSettled(page);

  const tiles = await boxOf(page.locator(".tiles"));
  for (const fact of facts) {
    const box = await boxOf(fact);
    expect(await clearOfTheButtons(page, box), "is clear of the buttons").toBe(true);
    expect(tiles.y, "the videos come after it").toBeGreaterThan(box.y);
  }
}

test.describe("on a phone held sideways", () => {
  test.use({ viewport: { width: 915, height: 412 } });
  // Opened from the Home Screen: in a browser tab a phone held sideways is asked to turn upright.
  test.beforeEach(({ page }) => asInstalled(page));

  test("the choices of who the game is for are both clear of Back and Save", async ({ page }) => {
    onlyInPhone();
    await expectChoicesAboveTheBar(page, 2);
  });

  test("Check and send shows the name, the line and every fact clear of Back and Save, and the videos after them", async ({
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
  // Opened from the Home Screen: in a browser tab a phone held sideways is asked to turn upright.
  test.beforeEach(({ page }) => asInstalled(page));

  test("the first choice of who the game is for is clear of Back and Save, whole", async ({ page }) => {
    onlyInPhone();
    await expectChoicesAboveTheBar(page, 1);
  });

  test("Check and send shows the name and the line clear of Back and Save, and the videos after them", async ({
    page,
  }) => {
    onlyInPhone();
    await expectFactsBeforeTheVideos(page, [page.locator(".laid .title"), page.locator(".laid .tagline")]);
  });
});

// ---- L4, the rest: a short phone's video frame leaves the notes and links above the bar -------------------------------------------

const LARGE_IPHONE = { width: 430, height: 739 };

/**
 * Opens a video question (with its video in, when `added`) and checks what it tells the maker ends above the bar: the formats,
 * how to record and, once a video is in, the link to choose a different one. A frame as tall as the window pushes them under it.
 */
async function expectVideoQuestionAboveTheBar(
  page: Page,
  shape: "upright" | "wide",
  added: boolean,
): Promise<void> {
  await startAtVideo(page, shape);
  if (added) await addVideo(page, shape);
  await wordsHaveSettled(page);

  const bar = await boxOf(page.locator(".acts"));
  const things: [string, Locator][] = [
    ["the formats", page.locator("#note")],
    ["how to record", page.getByRole("link", { name: "How do I record my screen?" })],
  ];
  if (added)
    things.push(["choose a different video", page.getByRole("link", { name: "Choose a different video" })]);
  for (const [words, thing] of things) {
    const box = await boxOf(thing);
    expect(box.y + box.height, `${words} ends above the bar`).toBeLessThanOrEqual(bar.y);
  }
}

for (const [name, viewport] of [
  ["an iPhone SE held upright", IPHONE_SE],
  ["a large iPhone held upright", LARGE_IPHONE],
] as const) {
  test.describe(`on ${name}, a video question`, () => {
    test.use({ viewport });

    test("with no video yet has its notes and links above the bar (upright)", async ({ page }) => {
      onlyInPhone();
      await expectVideoQuestionAboveTheBar(page, "upright", false);
    });

    test("with its video in has its notes and links above the bar (upright)", async ({ page }) => {
      onlyInPhone();
      await expectVideoQuestionAboveTheBar(page, "upright", true);
    });

    test("with no video yet has its notes and links above the bar (wide)", async ({ page }) => {
      onlyInPhone();
      await expectVideoQuestionAboveTheBar(page, "wide", false);
    });
  });
}

// "Shorter video frames on small phones, so more fits on the screen" (the Owner, 2026-11-15, "5.a"). A short phone held upright
// has its frame no taller than half the window; held sideways the frame is beside the question and is whole above the bar.
test.describe("on an iPhone SE held upright", () => {
  test.use({ viewport: IPHONE_SE });

  test("the upright video's frame is no taller than half the window", async ({ page }) => {
    onlyInPhone();
    await startAtVideo(page, "upright");
    await wordsHaveSettled(page);
    const frame = await boxOf(page.locator('[data-frame="upright"]'));
    expect(frame.height).toBeLessThanOrEqual(IPHONE_SE.height / 2);
  });
});

/** The upright video question of a phone held sideways: its frame is whole and clear of Back and Save, beside the question. */
async function expectFrameWholeAboveTheBar(page: Page): Promise<void> {
  await startAtVideo(page, "upright");
  await wordsHaveSettled(page);
  const frame = await boxOf(page.locator('[data-frame="upright"]'));
  expect(await clearOfTheButtons(page, frame), "the frame is whole and clear of the buttons").toBe(true);
}

test.describe("on an iPhone SE held sideways", () => {
  test.use({ viewport: IPHONE_SE_SIDEWAYS });
  // Opened from the Home Screen: in a browser tab a phone held sideways is asked to turn upright.
  test.beforeEach(({ page }) => asInstalled(page));

  test("the upright video's frame is whole and clear of Back and Save", async ({ page }) => {
    onlyInPhone();
    await expectFrameWholeAboveTheBar(page);
  });
});

function uprightFrameWhole(): void {
  test("on a phone held sideways the upright video's frame is whole and clear of Back and Save", async ({
    page,
  }) => {
    test.skip(layoutOf(page) !== "phone-sideways", "a phone held sideways, in the projects that have one");
    await expectFrameWholeAboveTheBar(page);
  });
}

heldSideways("phone", uprightFrameWhole);

// ---- L13: Waiting and Live show the game's name once -------------------------------------------------------------------------------

test("Waiting and Live show the game's name once, as the title of the game laid out", async ({ page }) => {
  const waiting = await gameWhere(page, { state: "waiting" });
  await page.goto(`/make/${waiting.slug}`);
  await pageHasSettled(page);
  await expect(page.getByText(waiting.name, { exact: true }), "on Waiting").toHaveCount(1);
  await expect(
    page.getByRole("heading", { level: 2, name: waiting.name }),
    "as the card's title",
  ).toHaveCount(1);

  // The same maker's second game: signing up again while signed in would find no sign-up form.
  const live = await addDraft(page);
  await fillAnswers(live.slug, { files: true, videos: true, age: "age_12" });
  await giveRealClips(page, live.slug);
  await putGameWhereStaffLeaveIt(live.slug, { state: "live" });
  await page.goto(`/make/${live.slug}`);
  await pageHasSettled(page);
  await expect(page.getByText(live.name, { exact: true }), "on Live").toHaveCount(1);
  await expect(page.getByRole("heading", { level: 2, name: live.name }), "as the card's title").toHaveCount(
    1,
  );
});

// ---- L15: on an upright iPad every screen has one column --------------------------------------------------------------------

test("on an upright tablet a question, Check and send, Waiting and Live all start at one left edge and are as wide", async ({
  page,
}) => {
  test.skip(layoutOf(page) !== "tablet", "only an upright tablet has a column narrower than the window");
  const first = await startDraft(page);
  await page.goto(`/make/${first.slug}/line`);
  await pageHasSettled(page);
  const question = await boxOf(page.locator("main"));

  await fillAnswers(first.slug, { files: true, videos: true, age: "age_12" });
  await giveRealClips(page, first.slug);
  await agreeToTheAgreement(page, first.slug);
  await layoutHasSettled(page);
  const check = await boxOf(page.locator("main"));

  await putGameWhereStaffLeaveIt(first.slug, { state: "waiting" });
  await page.goto(`/make/${first.slug}`);
  await layoutHasSettled(page);
  const waiting = await boxOf(page.locator("main"));

  const live = await addDraft(page);
  await fillAnswers(live.slug, { files: true, videos: true, age: "age_12" });
  await giveRealClips(page, live.slug);
  await putGameWhereStaffLeaveIt(live.slug, { state: "live" });
  await page.goto(`/make/${live.slug}`);
  await layoutHasSettled(page);
  const liveBox = await boxOf(page.locator("main"));

  for (const [words, box] of [
    ["Check and send", check],
    ["Waiting", waiting],
    ["Live", liveBox],
  ] as const) {
    expect(Math.abs(box.x - question.x), `${words} starts where a question starts`).toBeLessThanOrEqual(1);
    expect(Math.abs(box.width - question.width), `${words} is as wide as a question`).toBeLessThanOrEqual(1);
  }
});

// ---- L25: the age question says the count it will have -------------------------------------------------------------------------

test("picking 18+ on the age question says Question 6 of 7 at once, and picking 12+ says 6 of 6 again", async ({
  page,
}) => {
  const { slug } = await startDraft(page);
  await fillAnswers(slug, { files: true, videos: true });
  await page.goto(`/make/${slug}/age`);
  await pageHasSettled(page);
  await expect(page.getByText("Question 6 of 6")).toBeVisible();
  await expect(page.locator(".track i")).toHaveCount(6);

  await page.getByRole("radio", { name: /^18\+/ }).check();
  await expect(page.getByText("Question 6 of 7")).toBeVisible();
  await expect(page.locator(".track i")).toHaveCount(7);

  await page.getByRole("radio", { name: /^12\+/ }).check();
  await expect(page.getByText("Question 6 of 6")).toBeVisible();
  await expect(page.locator(".track i")).toHaveCount(6);
});

// ---- L9: the card of what players will see shows both videos, across its whole width -----------------------------------

function previewShowsBothVideos(): void {
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
}

previewShowsBothVideos();
heldSideways("tablet", previewShowsBothVideos);

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
  if ((page.viewportSize()?.width ?? 0) < 500) {
    // A phone's card is about 280 wide, so beside the words left them a strip two words wide: the video goes under them, small (80 wide).
    expect(video.y, "under the words on a phone").toBeGreaterThanOrEqual(title.y + title.height - 1);
    expect(video.width, "small, 80 wide at most").toBeLessThanOrEqual(80.5);
    return;
  }
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
