import { expect, test, type Page } from "@playwright/test";
import { rgb, token } from "../support/look-tokens.ts";
import { pageHasSettled, signUp } from "./support/account.ts";
import { fillAnswers, putGameWhereStaffLeaveIt } from "./support/database.ts";
import {
  BROKEN_GAME,
  connectGitHubFromFiles,
  freshName,
  nextButton,
  startAtCheck,
  startAtFiles,
  startAtVideo,
  startDraft,
} from "./support/game.ts";
import { boxOf, pipRed } from "./support/look.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

// How the maker's screens are laid out (spec 4, and the plan's table of sizes). A window is one of five layouts, and
// each is read from the window's own size, not the project's name: an iPad held upright and a Pixel 7 held upright are
// different layouts, a phone held sideways is the sideways tablet made smaller.

test.beforeEach(forgetRateLimits);

type Layout = "phone" | "phone-sideways" | "tablet" | "tablet-sideways" | "computer";

/** Which of the five layouts this window gets. The same order as the stylesheet's queries. */
function layoutOf(page: Page): Layout {
  const { width, height } = page.viewportSize() ?? { width: 0, height: 0 };
  if (width < 500) return "phone";
  if (height < 450) return "phone-sideways";
  if (height > width) return "tablet";
  if (width < 1200) return "tablet-sideways";
  return "computer";
}

/** What each layout draws a question with: the heading, the answer box and the buttons, in px. */
const SIZES: Record<Layout, { heading: number; box: number; button: number; inBar: boolean }> = {
  phone: { heading: 36, box: 64, button: 56, inBar: true },
  "phone-sideways": { heading: 32, box: 56, button: 52, inBar: true },
  tablet: { heading: 64, box: 72, button: 60, inBar: true },
  "tablet-sideways": { heading: 48, box: 72, button: 60, inBar: false },
  computer: { heading: 64, box: 72, button: 60, inBar: false },
};

/** A game whose first question not answered is the one asked, so a journey can open that question alone. */
async function gameAskingAbout(page: Page, question: "plays-on" | "age"): Promise<string> {
  const { slug } = await startDraft(page);
  await fillAnswers(
    slug,
    question === "plays-on" ? { playsOn: false, files: true } : { files: true, videos: true },
  );
  // The layout is what is measured, not the entrance, so the cards are measured at rest.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`/make/${slug}/${question}`);
  await pageHasSettled(page);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  return slug;
}

test("a question: the heading's size, the box and the buttons for this window", async ({ page }) => {
  await startDraft(page);
  const layout = layoutOf(page);
  const sizes = SIZES[layout];
  const box = page.getByRole("textbox");

  await expect(page.getByRole("heading", { level: 1 })).toHaveCSS("font-size", `${String(sizes.heading)}px`);
  await expect(box).toHaveCSS("height", `${String(sizes.box)}px`);
  await expect(box).toHaveCSS("font-size", "24px");
  await expect(box).toHaveCSS("border-top-left-radius", "12px");
  await expect(box).toHaveCSS("border-top-width", "0px");
  await expect(box).toHaveCSS("background-color", rgb(token("--paper")));

  const next = nextButton(page);
  await expect(next).toHaveCSS("height", `${String(sizes.button)}px`);
  await expect(next).toHaveCSS("background-color", rgb(token("--pay")));
  const viewport = page.viewportSize();
  const bar = await boxOf(page.locator(".acts"));
  if (sizes.inBar) {
    // The buttons sit in a bar whose bottom is the window's bottom, so a thumb finds them in the same place.
    expect(Math.abs(bar.y + bar.height - (viewport?.height ?? 0))).toBeLessThanOrEqual(1);
  } else {
    // Under the answer, the blue button at least 168 wide.
    expect((await boxOf(next)).width).toBeGreaterThanOrEqual(168);
    expect((await boxOf(next)).y).toBeGreaterThan((await boxOf(box)).y + (await boxOf(box)).height - 1);
  }
});

test("press Enter shows only where there is a mouse", async ({ page }, testInfo) => {
  await startDraft(page);

  const hint = page.getByText("press Enter");
  if (testInfo.project.name === "computer") await expect(hint).toBeVisible();
  else await expect(hint).toBeHidden();
});

test("Enter presses the blue button", async ({ page }) => {
  await signUp(page);
  await page.goto("/make/new");
  await pageHasSettled(page);

  await page.getByLabel("What's your game called?").fill(freshName());
  await page.getByLabel("What's your game called?").press("Enter");

  await expect(page).toHaveURL(/\/line$/);
});

test("a picked choice has a blue edge, and the others stay white", async ({ page }) => {
  await gameAskingAbout(page, "plays-on");
  const picked = page.locator(".pick", { hasText: "Computers only" });
  const other = page.locator(".pick", { hasText: "Phones and computers" });

  await expect(other).toHaveCSS("background-color", rgb(token("--paper")));
  await page.getByLabel("Computers only").check();

  await expect(picked).toHaveCSS("border-top-color", rgb(token("--pay")));
  await expect(picked).toHaveCSS("border-top-width", "4px");
  await expect(picked).toHaveCSS("background-color", rgb(token("--paper")));
  await expect(other).toHaveCSS("background-color", rgb(token("--paper")));
  await expect(other).toHaveCSS("border-top-color", rgb(token("--paper")));
});

test("the five ratings sit in one row from a tablet up, and stack on a phone", async ({ page }) => {
  await gameAskingAbout(page, "age");
  const tops = await Promise.all(
    (await page.locator(".pick").all()).map(async (one) => (await boxOf(one)).y),
  );

  const rows = new Set(tops.map((top) => Math.round(top)));
  if (layoutOf(page) === "phone" || layoutOf(page) === "phone-sideways") expect(rows.size).toBeGreaterThan(1);
  else expect(rows.size).toBe(1);
});

test("everything to press is at least 44 by 44", async ({ page }) => {
  const { slug } = await startDraft(page);
  await fillAnswers(slug, { files: true, videos: true });
  // An 18+ game, so the marks are asked too: every choice is a target.
  await fillAnswers(slug, { age: "age_18" });
  const screens = [
    `/make/${slug}/line`,
    `/make/${slug}/plays-on`,
    `/make/${slug}/age`,
    `/make/${slug}/marks`,
    "/make",
    "/make/new",
  ];

  for (const address of screens) {
    await page.goto(address);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    for (const target of await page.locator("a, button, input:not([type=hidden]), label").all()) {
      const box = await target.boundingBox();
      if (box === null) continue;
      const text = (await target.innerText()).trim();
      const words = text === "" ? ((await target.getAttribute("name")) ?? "a target") : text;
      expect(box.width, `${address}: ${words}, width`).toBeGreaterThanOrEqual(44);
      expect(box.height, `${address}: ${words}, height`).toBeGreaterThanOrEqual(44);
    }
  }
});

test("a 60-letter name with no space wraps, and nothing scrolls sideways", async ({ page }) => {
  await signUp(page);
  await page.goto("/make/new");
  await pageHasSettled(page);
  const name = `${"x".repeat(52)}${crypto.randomUUID().slice(0, 8)}`;
  await page.getByLabel("What's your game called?").fill(name);
  await nextButton(page).click();
  await expect(page).toHaveURL(/\/line$/);

  const inWindow = () =>
    page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
  expect(await inWindow()).toBe(true);
  const viewport = page.viewportSize() ?? { width: 0, height: 0 };
  const next = await boxOf(nextButton(page));
  expect(next.x + next.width).toBeLessThanOrEqual(viewport.width);
  expect(next.y + next.height).toBeLessThanOrEqual(viewport.height);

  await page.goto("/make");
  await expect(page.locator("a.game")).toContainText(name);
  expect(await inWindow()).toBe(true);
});

test("a step: the new question rises over 460ms on the house curve", async ({ page }) => {
  await signUp(page);
  await page.goto("/make/new");
  await pageHasSettled(page);
  await page.getByLabel("What's your game called?").fill(freshName());
  await nextButton(page).click();
  await expect(page).toHaveURL(/\/line$/);

  const heading = page.getByRole("heading", { level: 1 });
  await expect(heading).toHaveCSS("animation-duration", "0.46s");
  await expect(heading).toHaveCSS("animation-timing-function", "cubic-bezier(0.32, 0.72, 0, 1)");
});

test("with reduced motion nothing moves", async ({ page }) => {
  await signUp(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/make/new");
  await pageHasSettled(page);
  await page.getByLabel("What's your game called?").fill(freshName());
  await nextButton(page).click();
  await expect(page).toHaveURL(/\/line$/);

  await expect(page.getByRole("heading", { level: 1 })).toHaveCSS("animation-name", "none");
  await expect(page.getByRole("textbox")).toHaveCSS("animation-name", "none");
});

test("the track has one piece per question, and the answered ones are chalk", async ({ page }) => {
  await startDraft(page);

  const pieces = page.locator(".track > *");
  await expect(pieces).toHaveCount(7);
  await expect(pieces.nth(0)).toHaveCSS("background-color", rgb(token("--chalk")));
  await expect(pieces.nth(1)).toHaveCSS("background-color", rgb(token("--felt-raised")));
  await expect(pieces.nth(0)).toHaveCSS("height", "6px");
});

// Red is only for what can't be undone (Owner, 2026-11-15): a message that something needs fixing is a white card with
// a blue edge and a label, never red.
test("the Needs fixing card is paper with a blue left edge, a plain label, and no red", async ({ page }) => {
  const { slug } = await startAtFiles(page);
  await connectGitHubFromFiles(page, slug);
  await page.getByLabel(BROKEN_GAME).check();
  await nextButton(page).click();
  const card = page.locator(".fix");
  await expect(card).toBeVisible();

  await expect(card).toHaveCSS("background-color", rgb(token("--paper")));
  // The edge is the sheet's own left border: the look has no shadows.
  await expect(card).toHaveCSS("border-left-color", rgb(token("--pay")));
  await expect(card).toHaveCSS("border-left-width", "6px");
  const label = page.getByText("Needs fixing");
  await expect(label).toHaveCSS("color", rgb(token("--pay")));
  await expect(label).toHaveCSS("text-transform", "none");
  await expect(label).toHaveCSS("font-size", "14px");
  await expect(label).toHaveCSS("font-weight", "600");
  expect(await pipRed(page)).toEqual([]);
});

// The frame a video question draws is the biggest thing on the screen, in its real shape. Its size is read per layout
// from the plan: an upright frame is a height, a wide frame a width.
const UPRIGHT_HEIGHT: Record<Layout, number> = {
  computer: 540,
  "tablet-sideways": 540,
  tablet: 500,
  phone: 340,
  "phone-sideways": 250,
};

test("the upright frame is this tall for this window, and nothing scrolls sideways", async ({ page }) => {
  await startAtVideo(page, "upright");
  await page.emulateMedia({ reducedMotion: "reduce" });
  const frame = page.locator('[data-frame="upright"]');

  expect((await boxOf(frame)).height).toBe(UPRIGHT_HEIGHT[layoutOf(page)]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("the wide frame is this wide for this window, and wider than tall", async ({ page }) => {
  await startAtVideo(page, "wide");
  await page.emulateMedia({ reducedMotion: "reduce" });
  const layout = layoutOf(page);
  const frame = await boxOf(page.locator('[data-frame="wide"]'));
  const window = page.viewportSize()?.width ?? 0;

  if (layout === "phone") {
    // The full width of the column: the window less a gutter on each side.
    expect(frame.width).toBeGreaterThanOrEqual(window - 40);
    expect(frame.width).toBeLessThanOrEqual(window);
  } else if (layout === "phone-sideways") {
    expect(frame.width).toBe(380);
  } else {
    expect(frame.width).toBe(640);
  }
  expect(frame.width).toBeGreaterThan(frame.height);
});

// ---- Check and send ----------------------------------------------------------------------------------------------

/** How tall the two videos are laid out on Check and send, for each window (spec 5b). A phone sets its own sizes. */
const TILE_HEIGHT: Record<Exclude<Layout, "phone">, number> = {
  computer: 264,
  "tablet-sideways": 264,
  tablet: 300,
  "phone-sideways": 180,
};

test("on Check and send the blue button is in the window without scrolling, and nothing scrolls sideways", async ({
  page,
}) => {
  await startAtCheck(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const send = page.getByRole("button", { name: "Send for review" });
  await expect(send).toBeVisible();

  const viewport = page.viewportSize() ?? { width: 0, height: 0 };
  const box = await boxOf(send);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("the two videos are the same height, this tall for this window", async ({ page }) => {
  await startAtCheck(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const upright = await boxOf(page.locator('.tiles [data-shape="upright"]').first());
  const wide = await boxOf(page.locator('.tiles [data-shape="wide"]').first());
  const layout = layoutOf(page);

  if (layout === "phone") {
    // The upright one is 150 by 267 with the wide one beside it, at its own shape.
    expect(upright.width).toBe(150);
    expect(upright.height).toBe(267);
    expect(wide.y).toBeLessThan(upright.y + upright.height);
    expect(wide.x).toBeGreaterThan(upright.x + upright.width - 1);
    expect(wide.width).toBeGreaterThan(wide.height);
    return;
  }
  expect(Math.abs(upright.height - wide.height)).toBeLessThanOrEqual(1);
  expect(upright.height).toBeLessThanOrEqual(TILE_HEIGHT[layout]);
  // Where the window has room for both videos at the planned height, that is the height; a narrower one shrinks them
  // together, never to less than three quarters of it.
  expect(upright.height).toBeGreaterThanOrEqual(TILE_HEIGHT[layout] * 0.75);
  if (layout !== "tablet-sideways") expect(Math.round(upright.height)).toBe(TILE_HEIGHT[layout]);
  expect(upright.width).toBeLessThan(upright.height);
  expect(wide.width).toBeGreaterThan(wide.height);
});

test("the facts are quiet chips: Dusky Green, white words, 8px corners", async ({ page }) => {
  await startAtCheck(page);
  const chip = page.locator(".chip").first();

  await expect(chip).toHaveCSS("background-color", rgb(token("--felt-raised")));
  await expect(chip).toHaveCSS("color", rgb(token("--chalk")));
  await expect(chip).toHaveCSS("border-top-left-radius", "8px");
});

test("the name is a title in the display face, and the line a tagline in sage", async ({ page }) => {
  const { name } = await startAtCheck(page);

  const title = page.getByRole("heading", { level: 2, name });
  await expect(title).toHaveCSS("font-size", "32px");
  await expect(page.locator(".tagline")).toHaveCSS("font-size", "24px");
  await expect(page.locator(".tagline")).toHaveCSS("color", rgb(token("--sage")));
});

test("everything to press on Check and send is at least 44 by 44, and nothing is red", async ({ page }) => {
  await startAtCheck(page);
  await page.emulateMedia({ reducedMotion: "reduce" });

  for (const target of await page.locator("a, button").all()) {
    const box = await target.boundingBox();
    if (box === null) continue;
    const words =
      (await target.innerText()).trim() || ((await target.getAttribute("aria-label")) ?? "a target");
    expect(box.width, `${words}, width`).toBeGreaterThanOrEqual(44);
    expect(box.height, `${words}, height`).toBeGreaterThanOrEqual(44);
  }
  expect(await pipRed(page)).toEqual([]);
});

// ---- Sent back and Live -------------------------------------------------------------------------------------------

/** A new maker's finished game, left where staff's decision puts it, the browser on its page. */
async function openGameWhere(
  page: Page,
  decision: Parameters<typeof putGameWhereStaffLeaveIt>[1],
): Promise<void> {
  const { slug } = await startDraft(page);
  await fillAnswers(slug, { files: true, videos: true, age: "age_12" });
  await putGameWhereStaffLeaveIt(slug, decision);
  await page.goto(`/make/${slug}`);
  await pageHasSettled(page);
}

test("on Sent back the blue button is in the window without scrolling, and nothing is red", async ({
  page,
}) => {
  await openGameWhere(page, {
    state: "sent_back",
    toFix: [{ part: "upright_video", reason: "sideways" }],
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const fix = page.getByRole("link", { name: "Fix the upright video" });
  await expect(fix).toBeVisible();

  const viewport = page.viewportSize() ?? { width: 0, height: 0 };
  const box = await boxOf(fix);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await pipRed(page)).toEqual([]);
});

test("on Live the game's own video fills the screen behind everything, blurred, and stays still when asked", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openGameWhere(page, { state: "live" });

  const backdrop = page.locator(".backdrop video");
  await expect(backdrop).toHaveCount(1);
  // The piece is behind `main`, not beside it: the page itself is not the plain felt.
  await expect(page.locator(".backdrop")).toHaveCSS("position", "fixed");
  await expect(page.locator(".backdrop")).toHaveCSS("filter", /blur\(18px\)/);
  await expect(backdrop).toHaveJSProperty("muted", true);
  // Asked for stillness, the video stays on its first frame.
  await expect(backdrop).toHaveJSProperty("paused", true);
  await expect(page.getByRole("heading", { level: 1 })).toHaveCSS("color", rgb(token("--chalk")));
});
