import { expect, test, type Page } from "@playwright/test";
import { pageHasSettled, signUp } from "./support/account.ts";
import { givePage } from "./support/database.ts";
import { gameWhere } from "./support/game.ts";
import { CARD_SCREENS, layoutHasSettled } from "./support/look.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

// The owner, 2026-11-22: "I'm also not a fan of how often we use the text with underline for buttons, I don't think
// professional apps use that very often, if ever." Something a person presses that stands on its own (its own line, a
// list of guides, the foot of a screen, a fold-out, a Change beside a part) is a real button: no underline, a painted
// shape and a thumb-sized target. A link inside a sentence of running words stays an underlined link.
test.beforeEach(forgetRateLimits);

/** What an action on its own looks like, as the browser paints it. */
interface Action {
  words: string;
  underlined: boolean;
  painted: boolean;
  height: number;
}

/**
 * Every visible link, button and fold-out on the page that stands on its own: its line holds no other words. The
 * wordmark, a picture or video someone taps, and a whole card that opens something are left out: they are not words.
 */
function standaloneActions(page: Page): Promise<Action[]> {
  return page.evaluate(() => {
    const actions: Action[] = [];
    for (const element of document.querySelectorAll<HTMLElement>("a, button, summary, .file > span")) {
      const box = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      if (box.width === 0 || box.height === 0 || style.visibility === "hidden") continue;
      if (element.closest(".wordmark, .sr-only")) continue;
      if (element.querySelector("img, video, canvas, .statement")) continue;
      const words = element.textContent.replace(/\s+/g, " ").trim();
      if (words === "") continue;
      // Running words: the action sits among words of its own line (a text beside it, or in an inline piece beside
      // it). A separator dot between actions is not words.
      const hasWords = (holder: Element | null) =>
        [...(holder?.childNodes ?? [])].some(
          (node) => node.nodeType === Node.TEXT_NODE && /[\p{L}\p{N}]/u.test(node.textContent ?? ""),
        );
      const parent = element.parentElement;
      const inline = parent !== null && getComputedStyle(parent).display === "inline";
      if (hasWords(parent) || (inline && hasWords(parent.parentElement))) continue;
      const fill = style.backgroundColor;
      const edge = Number.parseFloat(style.borderTopWidth) > 0 && style.borderTopStyle !== "none";
      actions.push({
        words,
        underlined: style.textDecorationLine.includes("underline"),
        painted: (fill !== "rgba(0, 0, 0, 0)" && fill !== "transparent") || edge,
        height: Math.round(box.height),
      });
    }
    return actions;
  });
}

/** Fails, naming each one, for every action on its own that is underlined words, unpainted, or too small to hit. */
async function expectRealButtons(page: Page): Promise<void> {
  await pageHasSettled(page);
  await layoutHasSettled(page);
  const actions = await standaloneActions(page);
  expect(actions.length, "the screen has something to press").toBeGreaterThan(0);
  expect(actions.filter((action) => action.underlined).map((action) => action.words)).toEqual([]);
  expect(actions.filter((action) => !action.painted).map((action) => action.words)).toEqual([]);
  expect(actions.filter((action) => action.height < 44).map((action) => action.words)).toEqual([]);
}

for (const screen of CARD_SCREENS) {
  test(`${screen.name}: every action on its own is a real button`, async ({ page }) => {
    await screen.open(page);
    await expectRealButtons(page);
  });
}

test("the help pages: the way back and the list of guides are real buttons", async ({ page }) => {
  await page.goto("/help");
  await expect(page.getByRole("heading", { name: "Help for makers" })).toBeVisible();
  await expectRealButtons(page);
  await page.goto("/help/get-your-game-on-ruken?from=%2Fhelp");
  await expect(page.getByRole("heading", { level: 1, name: "Get your game on Ruken" })).toBeVisible();
  await expectRealButtons(page);
  // A link in a sentence of the guide stays a link in words.
  const inWords = page.getByRole("link", { name: "Here's how to put it there" });
  await expect(inWords).toHaveCSS("text-decoration-line", "underline");
});

test("your account, its password and its delete screen: every action is a real button", async ({ page }) => {
  await signUp(page);
  await page.goto("/me");
  await expect(page.getByRole("heading", { name: "Your account" })).toBeVisible();
  await expectRealButtons(page);
  await page.goto("/me/password");
  await expectRealButtons(page);
  await page.goto("/me/delete");
  await expectRealButtons(page);
});

test("a maker's screens: Your games, Your page and its links are real buttons", async ({ page }) => {
  const account = await signUp(page);
  await page.goto("/make");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expectRealButtons(page);
  await givePage(account, {
    name: "Button Tester",
    oneLine: "Makes games.",
    links: [
      { title: "My site", url: "https://example.com/a" },
      { title: "My shop", url: "https://example.com/b", hidden: true },
    ],
  });
  await page.goto("/make/page");
  await expect(page.getByRole("heading", { name: "Your page" })).toBeVisible();
  await expectRealButtons(page);
  await page.goto("/make/page/links");
  await expect(page.getByRole("button", { name: "Show" })).toBeVisible();
  await expectRealButtons(page);
});

for (const state of ["waiting", "live"] as const) {
  test(`a ${state} game's screen: the way back and the foot are real buttons`, async ({ page }) => {
    const { slug } = await gameWhere(page, { state });
    await page.goto(`/make/${slug}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectRealButtons(page);
  });
}

test("a maker's question: the foot and the how-to are real buttons", async ({ page }) => {
  const { slug } = await gameWhere(page, { state: "live" });
  await page.goto(`/make/${slug}/upright`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expectRealButtons(page);
});
