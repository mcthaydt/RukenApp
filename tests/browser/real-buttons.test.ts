import { expect, test, type Page } from "@playwright/test";
import { pageHasSettled, signUp } from "./support/account.ts";
import { givePage, makerNumberOf } from "./support/database.ts";
import { connectGitHubFromFiles, gameWhere, startAtFiles } from "./support/game.ts";
import { rgb, token } from "../support/look-tokens.ts";
import { CARD_SCREENS, layoutHasSettled, wordsHaveSettled } from "./support/look.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";
import { NOT_CONSENTED } from "./support/consent.ts";

// The owner, 2026-11-22: "I'm also not a fan of how often we use the text with underline for buttons, I don't think
// professional apps use that very often, if ever." Something a person presses that stands on its own (its own line, a
// list of guides, the foot of a screen, a fold-out, a Change beside a part) is a real button: no underline, a painted
// shape and a thumb-sized target. 18:02 UTC: "no text with underline links anywhere": a link inside a sentence is not
// underlined either; it is told from its words by colour or weight. 2026-11-23: "Primary actions are buttons, but
// secondary actions are the -> buttons": a side link on its own line (What we keep, What is Ruken?) is its words with
// an arrow after them, never underlined, and still thumb-sized.
test.beforeEach(forgetRateLimits);

/** What an action on its own looks like, as the browser paints it. */
interface Action {
  words: string;
  underlined: boolean;
  painted: boolean;
  arrow: boolean;
  height: number;
}

/**
 * Every visible link, button and fold-out on the page that stands on its own: its line holds no other words. The
 * wordmark, a picture or video someone taps, and a whole card that opens something are left out: they are not words.
 * Nor is the bottom bar's row of tabs.
 */
function standaloneActions(page: Page): Promise<Action[]> {
  return page.evaluate(() => {
    const actions: Action[] = [];
    for (const element of document.querySelectorAll<HTMLElement>("a, button, summary, .file > span")) {
      const box = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      if (box.width === 0 || box.height === 0 || style.visibility === "hidden") continue;
      // The bottom bar is a row of tabs, not buttons: the bottom bar thread gives it its own look.
      if (element.closest(".wordmark, .sr-only, nav.bar")) continue;
      if (element.querySelector("img, video, canvas, .statement")) continue;
      // A help guide is a whole painted tile that opens it; the link is the tile's name, not a button of its own.
      if (element.closest(".helpdesk .guide")) continue;
      // The landing page's footer is columns of plain ways round the site, as on any site's foot: not underlined
      // (checked below with everything else), but not buttons.
      if (element.closest(".about .sitefoot")) continue;
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
        arrow: getComputedStyle(element, "::after").content.includes("→"),
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
 * Fails, naming each one, for every action on its own that is underlined words, neither a painted button nor an arrow
 * link, or too small to hit, for
 * anything at all drawn with a line under it, and for a link in words that cannot be told from them.
 */
async function expectRealButtons(page: Page, { videos = true }: { videos?: boolean } = {}): Promise<void> {
  await pageHasSettled(page);
  // The landing page holds its clips back until they are near (tablet), so there it waits for the words only.
  await (videos ? layoutHasSettled(page) : wordsHaveSettled(page));
  const { underlined, unseen } = await underlinedOrHiddenLinks(page);
  expect(underlined, "nothing on the screen is underlined").toEqual([]);
  expect(unseen, "a link in words stands out from them").toEqual([]);
  const actions = await standaloneActions(page);
  expect(actions.length, "the screen has something to press").toBeGreaterThan(0);
  expect(actions.filter((action) => action.underlined).map((action) => action.words)).toEqual([]);
  expect(actions.filter((action) => !action.painted && !action.arrow).map((action) => action.words)).toEqual(
    [],
  );
  expect(actions.filter((action) => action.height < 44).map((action) => action.words)).toEqual([]);
}

for (const screen of CARD_SCREENS) {
  test(`${screen.name}: every action on its own is a real button`, async ({ page }) => {
    await screen.open(page);
    await expectRealButtons(page);
  });
}

test("the help pages: the way back and the ways on are real buttons, and the guides are whole tiles", async ({
  page,
}) => {
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
  await page.goto("/me/computers");
  await expectRealButtons(page);
  // The cookies page, once a person has said yes to cookies (review round 4): What we keep is a blue → link there
  // too (the owner, 2026-11-23).
  await page.goto("/cookies");
  await expect(page.getByRole("link", { name: "What we keep" })).toBeVisible();
  await expectRealButtons(page);
});

test("a maker's screens: Your games, Your page and its links are real buttons", async ({ page }) => {
  const account = await signUp(page);
  await page.goto("/make");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expectRealButtons(page);
  // The owner, 2026-11-23, on a card: the top bar's one more link (Your account, Finish later) is a blue → link, not a
  // button: it goes to another page and does nothing there.
  const more = page.locator(".topbar a.go", { hasText: "Your account" });
  await expect(more).toHaveCSS("color", rgb(token("--pay-light")));
  expect(await more.evaluate((link) => getComputedStyle(link, "::after").content)).toContain("→");
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
  // Review 2026-11-22: an eye reads as the link's state, not as what pressing does, so Show and Hide say their word.
  for (const name of ["Show", "Hide"]) {
    const button = page.getByRole("button", { name, exact: true });
    await expect(button).toHaveText(name);
    await expect(button.locator("svg")).toHaveCount(0);
  }
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

test("the goodbye screen: Sign in in its sentence is a blue, heavier link with no line under it", async ({
  page,
}) => {
  await signUp(page);
  await page.goto("/me");
  await page.getByRole("link", { name: "Delete my account" }).click();
  await page.getByRole("button", { name: "Delete my account" }).click();
  await expect(page.getByRole("heading", { name: "Your account will be deleted." })).toBeVisible();
  await expectRealButtons(page);
  const signIn = page.getByRole("link", { name: "Sign in", exact: true });
  await expect(signIn).toHaveCSS("color", rgb(token("--pay")));
  await expect(signIn).toHaveCSS("text-decoration-line", "none");
});

test("Join on a game's page, for someone who is not a member, is a button on a row of its own", async ({
  page,
  browser,
}) => {
  const { slug } = await gameWhere(page, { state: "live" });
  const visitor = await browser.newContext({ baseURL: "http://localhost:4173" });
  try {
    const player = await visitor.newPage();
    await player.goto(`/g/${slug}`);
    await pageHasSettled(player);
    const join = player.getByRole("link", { name: "Join", exact: true });
    await expect(join).toBeVisible();
    await expect(join).toHaveCSS("text-decoration-line", "none");
    // A filled button on a row of its own, under the price, as wide as Play: never a small outline at the end of a line.
    await expect(join).not.toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    const joinBox = await join.boundingBox();
    const priceBox = await player.getByText(/^Members play every game\./).boundingBox();
    const playBox = await player.getByRole("link", { name: "Play", exact: true }).boundingBox();
    expect(joinBox?.height ?? 0).toBeGreaterThanOrEqual(48);
    expect(joinBox?.y ?? 0).toBeGreaterThanOrEqual((priceBox?.y ?? 0) + (priceBox?.height ?? 0));
    expect(Math.abs((joinBox?.width ?? 0) - (playBox?.width ?? 0))).toBeLessThanOrEqual(1);
    await expectRealButtons(player);
  } finally {
    await visitor.close();
  }
});

test("the files question: the fold-out and the GitHub links are real buttons", async ({ page }) => {
  const { slug } = await startAtFiles(page);
  await expectRealButtons(page);
  await connectGitHubFromFiles(page, slug);
  const fold = page.getByText("Change the branch or folder");
  await expect(fold).toHaveCSS("text-decoration-line", "none");
  await expect(fold).toHaveCSS("background-color", rgb(token("--felt-raised")));
  await expectRealButtons(page);
});

test("the landing page: every action on its own is a real button, and nothing is underlined", async ({
  page,
}) => {
  await page.goto("/about");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expectRealButtons(page, { videos: false });
  // The footer's columns are plain ways round the site, in the regular weight as on main (review round 9): the bold of
  // a link among words is not theirs.
  const foot = page.locator(".about .sitefoot a");
  expect(await foot.count()).toBeGreaterThan(0);
  expect(
    await foot.evaluateAll((links) => [...new Set(links.map((link) => getComputedStyle(link).fontWeight))]),
  ).toEqual(["400"]);
});

test("the cookie notice: What we keep is blue words with an arrow, and nothing is underlined", async ({
  browser,
}) => {
  const visitor = await browser.newContext({ storageState: NOT_CONSENTED, baseURL: "http://localhost:4173" });
  try {
    const page = await visitor.newPage();
    await page.goto("/privacy");
    const keep = page.locator(".consent").getByRole("link", { name: "What we keep" });
    await expect(keep).toBeVisible();
    await expect(keep).toHaveCSS("text-decoration-line", "none");
    // The owner, 2026-11-23: "What we keep in blue text with the ->". On glass it is the light blue, to be read.
    await expect(keep).toHaveCSS("color", rgb(token("--pay-light")));
    expect(await keep.evaluate((link) => getComputedStyle(link, "::after").content)).toContain("→");
    expect((await keep.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    // The owner, 2026-11-23: "the what we keep is too close to buttons". Its words sit a rem under the buttons, as the
    // words above sit a rem over them.
    const gaps = await page.locator(".consent").evaluate((card) => {
      const answers = card.querySelector(".consent-answers") as Element;
      const link = card.querySelector(".consent-answers + p a") as Element;
      const above = answers.previousElementSibling as Element;
      const words = (element: Element) => {
        const range = document.createRange();
        range.selectNodeContents(element);
        return range.getBoundingClientRect();
      };
      const box = answers.getBoundingClientRect();
      return { over: box.top - words(above).bottom, under: words(link).top - box.bottom };
    });
    expect(Math.abs(gaps.under - gaps.over), JSON.stringify(gaps)).toBeLessThanOrEqual(4);
    await expectRealButtons(page);
  } finally {
    await visitor.close();
  }
});
