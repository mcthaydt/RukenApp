import { expect, test, type Page } from "@playwright/test";
import { pageHasSettled, signUp } from "./support/account.ts";
import { givePage, makerNumberOf } from "./support/database.ts";
import { gameWhere } from "./support/game.ts";
import { rgb, token } from "../support/look-tokens.ts";
import { CARD_SCREENS, layoutHasSettled } from "./support/look.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

// The owner, 2026-11-22: "I'm also not a fan of how often we use the text with underline for buttons, I don't think
// professional apps use that very often, if ever." Something a person presses that stands on its own (its own line, a
// list of guides, the foot of a screen, a fold-out, a Change beside a part) is a real button: no underline, a painted
// shape and a thumb-sized target. 18:02 UTC: "no text with underline links anywhere": a link inside a sentence is not
// underlined either; it is told from its words by colour or weight.
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

/** The words of everything visible on the page that the browser draws with a line under it, and of any link in a line
 * of words that looks the same as those words (same colour, same weight), so nobody could tell it is a link. */
function underlinedOrHiddenLinks(page: Page): Promise<{ underlined: string[]; unseen: string[] }> {
  return page.evaluate(() => {
    const visible = (element: Element) => {
      const box = element.getBoundingClientRect();
      return box.width > 0 && box.height > 0 && getComputedStyle(element).visibility !== "hidden";
    };
    const underlined = [...document.querySelectorAll("body *")]
      .filter((element) => visible(element))
      .filter((element) =>
        [
          getComputedStyle(element),
          getComputedStyle(element, "::after"),
          getComputedStyle(element, "::before"),
        ].some((style) => style.textDecorationLine.includes("underline")),
      )
      .map((element) => element.textContent.replace(/\s+/g, " ").trim().slice(0, 60));
    const unseen = [...document.querySelectorAll("a")]
      .filter((link) => visible(link) && link.parentElement !== null)
      .filter((link) => {
        const own = getComputedStyle(link);
        const around = getComputedStyle(link.parentElement as Element);
        const hasWordsBeside = [...(link.parentElement?.childNodes ?? [])].some(
          (node) => node.nodeType === Node.TEXT_NODE && /[\p{L}\p{N}]/u.test(node.textContent ?? ""),
        );
        return hasWordsBeside && own.color === around.color && own.fontWeight === around.fontWeight;
      })
      .map((link) => link.textContent.replace(/\s+/g, " ").trim());
    return { underlined: [...new Set(underlined)], unseen };
  });
}

/**
 * Fails, naming each one, for every action on its own that is underlined words, unpainted, or too small to hit, for
 * anything at all drawn with a line under it, and for a link in words that cannot be told from them.
 */
async function expectRealButtons(page: Page): Promise<void> {
  await pageHasSettled(page);
  await layoutHasSettled(page);
  const { underlined, unseen } = await underlinedOrHiddenLinks(page);
  expect(underlined, "nothing on the screen is underlined").toEqual([]);
  expect(unseen, "a link in words stands out from them").toEqual([]);
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
  // A link in a sentence of the guide stays a link in words: blue and heavier, with no line under it.
  const inWords = page.getByRole("link", { name: "Here's how to put it there" });
  await expect(inWords).toHaveCSS("text-decoration-line", "none");
  await expect(inWords).toHaveCSS("color", rgb(token("--pay")));
  await expect(inWords).toHaveCSS("font-weight", "600");
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

test("the feed, a game's page and a maker's page: nothing is underlined", async ({ page }) => {
  const { slug } = await gameWhere(page, { state: "live" });
  const { handle } = await givePage(
    { number: await makerNumberOf(slug) },
    {
      name: "Underline Tester",
      oneLine: "Makes games.",
      links: [{ title: "My site", url: "https://example.com/a" }],
    },
  );
  for (const address of ["/", `/g/${slug}`, `/${handle}`]) {
    await page.goto(address);
    await pageHasSettled(page);
    await layoutHasSettled(page);
    const { underlined, unseen } = await underlinedOrHiddenLinks(page);
    expect(underlined, address).toEqual([]);
    expect(unseen, address).toEqual([]);
  }
});
