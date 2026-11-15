import { expect, test, type Page } from "@playwright/test";
import { rgb, token } from "../support/look-tokens.ts";
import { pageHasSettled, signUp } from "./support/account.ts";
import { fillAnswers } from "./support/database.ts";
import {
  BROKEN_GAME,
  connectGitHubFromFiles,
  freshName,
  nextButton,
  startAtFiles,
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
  const edge = await card.evaluate((element) => getComputedStyle(element).boxShadow);
  expect(edge).toContain(rgb(token("--pay")));
  expect(edge).toContain("inset");
  expect(edge).toContain("6px");
  const label = page.getByText("Needs fixing");
  await expect(label).toHaveCSS("color", rgb(token("--pay")));
  await expect(label).toHaveCSS("text-transform", "none");
  await expect(label).toHaveCSS("font-size", "14px");
  await expect(label).toHaveCSS("font-weight", "600");
  expect(await pipRed(page)).toEqual([]);
});
