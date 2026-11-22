import { expect, test, type Page } from "@playwright/test";
import { rgb, token } from "../support/look-tokens.ts";
import { payAsNewMember, signUp } from "./support/account.ts";
import { failTheirCard } from "./support/database.ts";
import { addGame } from "./support/game.ts";
import { boxOf, showTheOwner } from "./support/look.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

// The owner, 2026-11-22, on the paywall card and the help page: "boring", and "no text with underline links anywhere";
// then "if something can just be an icon and people will understand, we use just the icon". These journeys read the
// two bolder screens as a person meets them.
test.beforeEach(forgetRateLimits);

/** The words, links and buttons on the page that are drawn with a line under them. */
function underlined(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [
      ...document.querySelectorAll<HTMLElement>(
        "main a, main button, main label, main p, main li, main h1, main h2",
      ),
    ]
      .filter((node) => getComputedStyle(node).textDecorationLine.includes("underline"))
      .map((node) => node.innerText.trim() || node.getAttribute("aria-label") || node.tagName),
  );
}

async function nothingSideways(page: Page): Promise<void> {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
  ).toBe(true);
}

test.describe("the paywall card", () => {
  test("is bold: a big title on a Dusky Green band, and what a member gets", async ({ page }, testInfo) => {
    await page.goto("/join");
    const title = page.getByRole("heading", { level: 1, name: "Join Ruken to play" });
    await expect(title).toBeVisible();
    expect(
      await title.evaluate((node) => parseFloat(getComputedStyle(node).fontSize)),
    ).toBeGreaterThanOrEqual(44);
    await expect(page.locator(".cardtop")).toHaveCSS("background-color", rgb(token("--felt-raised")));
    await expect(page.locator(".cardtop")).toHaveCSS("color", rgb(token("--chalk")));
    await expect(page.locator(".gets li")).toHaveText([
      "Every game on Ruken",
      "No ads",
      "On your phone or computer",
    ]);
    await nothingSideways(page);
    await showTheOwner(page, testInfo, "the bold paywall card");
  });

  test("Not now is a close mark with no words to see, as big as a button, and it goes back", async ({
    page,
  }) => {
    await page.goto("/join?next=/g/some-game/play");
    const close = page.getByRole("link", { name: "Not now" });
    await expect(close).toHaveText("");
    const box = await boxOf(close);
    expect(box.width).toBeGreaterThanOrEqual(48);
    expect(box.height).toBeGreaterThanOrEqual(48);
    // In the band's top corner, to the right of the title.
    const title = await boxOf(page.getByRole("heading", { level: 1 }));
    expect(box.x).toBeGreaterThan(title.x);
    await close.click();
    await expect(page).toHaveURL(/\/g\/some-game$/);
  });

  test("nothing on it is underlined", async ({ page }) => {
    await page.goto("/join");
    expect(await underlined(page)).toEqual([]);
  });

  test("the chosen plan turns ink with chalk words, and the yearly plan says what it saves", async ({
    page,
  }) => {
    await page.goto("/join");
    const monthly = page.getByRole("radio", { name: "$9.99 a month", exact: true });
    const annual = page.getByRole("radio", { name: "$99 a year", exact: true });
    const monthlyRow = page.locator("label", { has: monthly });
    const annualRow = page.locator("label", { has: annual });
    await expect(monthlyRow).toHaveCSS("background-color", rgb(token("--ink")));
    await expect(monthlyRow).toHaveCSS("color", rgb(token("--chalk")));
    // The saving is twelve months at $9.99 less $99, read once as the yearly row's description.
    await expect(annual).toHaveAccessibleDescription("Save $20.88");
    await expect(annualRow.getByText("Save $20.88")).toBeVisible();

    await annualRow.click();
    await expect(annualRow).toHaveCSS("background-color", rgb(token("--ink")));
    await expect(monthlyRow).not.toHaveCSS("background-color", rgb(token("--ink")));
    // The mark is Ruken's own: the browser's radio button is there for the keyboard and a reader, but not drawn.
    await expect(annual).toHaveCSS("opacity", "0");
    await expect(annualRow.locator(".mark")).toHaveCSS("background-color", rgb(token("--sage")));
  });

  test("the plans can be chosen with the keyboard alone, and the row shows the focus", async ({ page }) => {
    await page.goto("/join");
    const monthly = page.getByRole("radio", { name: "$9.99 a month", exact: true });
    await monthly.focus();
    await page.keyboard.press("ArrowDown");
    const annual = page.getByRole("radio", { name: "$99 a year", exact: true });
    await expect(annual).toBeChecked();
    await expect(annual).toBeFocused();
    await expect(page.locator("label", { has: annual })).toHaveCSS("outline-style", "solid");
  });

  /** The card's one blue button is whole in the window, its words on one line. */
  async function buttonInView(page: Page, name: string): Promise<void> {
    const button = page.getByRole("button", { name, exact: true });
    await expect(button).toBeInViewport({ ratio: 1 });
    const lineHeight = await button.evaluate((node) => parseFloat(getComputedStyle(node).lineHeight));
    const words = await button.evaluate((node) => {
      const range = document.createRange();
      range.selectNodeContents(node);
      return range.getBoundingClientRect().height;
    });
    expect(words).toBeLessThan(lineHeight * 1.5);
  }

  // Design round 1 (R1): at 320 by 640 the button was cut off by the window's foot.
  for (const size of [
    { width: 320, height: 640 },
    { width: 1280, height: 720 },
  ]) {
    test(`the one blue button can be seen without scrolling at ${String(size.width)} by ${String(size.height)}, signed out and signed in`, async ({
      page,
    }) => {
      await page.setViewportSize(size);
      await page.goto("/join");
      await buttonInView(page, "Continue");
      await signUp(page);
      await page.goto("/join");
      await buttonInView(page, "Continue to payment");
    });
  }

  test("no word of a title is broken across two lines, on the smallest phones", async ({ page }) => {
    const { number } = await payAsNewMember(page);
    await failTheirCard(number, 8);
    for (const width of [320, 375]) {
      await page.setViewportSize({ width, height: 640 });
      await page.goto("/join?next=/me");
      const title = page.getByRole("heading", { level: 1, name: "Your membership is paused" });
      await expect(title).toBeVisible();
      // Each word, measured on its own, sits on one line.
      const broken = await title.evaluate((node) => {
        const text = node.firstChild;
        if (text === null) return ["no words"];
        const words: string[] = [];
        const range = document.createRange();
        let start = 0;
        for (const word of node.textContent.split(" ")) {
          range.setStart(text, start);
          range.setEnd(text, start + word.length);
          if (range.getClientRects().length > 1) words.push(word);
          start += word.length + 1;
        }
        return words;
      });
      expect(broken).toEqual([]);
    }
  });
});

test.describe("the paywall card over the game's clip", () => {
  let slug: string;
  test.beforeAll(async ({ browser, request }) => {
    test.setTimeout(120_000);
    slug = (await addGame(browser, request)).slug;
  });

  test("its top is frosted glass, so the game shows through behind the title", async ({ page }, testInfo) => {
    await page.goto(`/join?next=${encodeURIComponent(`/g/${slug}/play`)}`);
    await expect(page.locator(".behindcard video")).toHaveCount(1);
    const top = page.locator(".cardtop");
    const glass = await top.evaluate((node) => {
      const style = getComputedStyle(node);
      return {
        background: style.backgroundColor,
        filter: style.backdropFilter || style.getPropertyValue("-webkit-backdrop-filter"),
      };
    });
    expect(glass.background).toBe("rgba(17, 19, 20, 0.12)");
    expect(glass.filter).toContain("blur(24px)");
    await showTheOwner(page, testInfo, "the bold paywall card over a clip");
  });

  for (const size of [
    { width: 320, height: 640 },
    { width: 1280, height: 720 },
  ]) {
    test(`the one blue button can be seen without scrolling at ${String(size.width)} by ${String(size.height)}`, async ({
      page,
    }) => {
      await page.setViewportSize(size);
      await page.goto(`/join?next=${encodeURIComponent(`/g/${slug}/play`)}`);
      await expect(page.locator(".behindcard video")).toHaveCount(1);
      await buttonInViewOver(page);
    });
  }
});

async function buttonInViewOver(page: Page): Promise<void> {
  await expect(page.getByRole("button", { name: "Continue", exact: true })).toBeInViewport({ ratio: 1 });
}

test.describe("help for makers", () => {
  test("is bold: a huge title on the felt and three numbered tiles", async ({ page }, testInfo) => {
    await page.goto("/help");
    const title = page.getByRole("heading", { level: 1, name: "Help for makers" });
    await expect(title).toBeVisible();
    expect(
      await title.evaluate((node) => parseFloat(getComputedStyle(node).fontSize)),
    ).toBeGreaterThanOrEqual(48);
    const tiles = page.locator(".guide");
    await expect(tiles).toHaveCount(3);
    await expect(tiles.locator(".number")).toHaveText(["1", "2", "3"]);
    await nothingSideways(page);
    await showTheOwner(page, testInfo, "help for makers");
  });

  test("the way back is an arrow with no words to see, as big as a button", async ({ page }) => {
    await page.goto("/help");
    const back = page.getByRole("link", { name: "Back to Ruken" });
    await expect(back).toHaveText("");
    await expect(back).toHaveAttribute("href", "/");
    const box = await boxOf(back);
    expect(box.width).toBeGreaterThanOrEqual(48);
    expect(box.height).toBeGreaterThanOrEqual(48);
  });

  test("nothing on it is underlined", async ({ page }) => {
    await page.goto("/help");
    expect(await underlined(page)).toEqual([]);
  });

  test("pressing anywhere on a tile opens its guide", async ({ page }) => {
    for (const [index, heading] of [
      "Get your game on Ruken",
      "Put your game on GitHub",
      "Record your screen",
    ].entries()) {
      await page.goto("/help");
      const tile = page.locator(".guide").nth(index);
      const box = await boxOf(tile);
      // The bottom-right corner, away from the guide's name.
      await tile.click({ position: { x: box.width - 12, y: box.height - 12 } });
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    }
  });

  test("a guide reached with the keyboard rings its whole tile", async ({ page }) => {
    await page.goto("/help");
    const first = page.getByRole("link", { name: "Get your game on Ruken" });
    await first.focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await expect(first).toBeFocused();
    await expect(page.locator(".guide").first()).toHaveCSS("outline-style", "solid");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { level: 1, name: "Get your game on Ruken" })).toBeVisible();
  });
});
