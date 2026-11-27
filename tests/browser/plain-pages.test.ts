import { expect, test, type Page } from "@playwright/test";
import { addGame } from "./support/game.ts";
import { givePage } from "./support/database.ts";
import { rgb, token } from "../support/look-tokens.ts";
import { showTheOwner } from "./support/look.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";
import { signInAs } from "./support/account.ts";

// Glass only where what is behind it moves (the owner, 2026-11-27: "The glass button effect should not be for pages
// with a static color background"). On a page of plain felt or a maker's own colour, the bar and every button are solid
// in the same colours, with no blur and no lens edge; over the feed's clips the glass stays.

let game: Awaited<ReturnType<typeof addGame>>;
let handle: string;

test.beforeAll(async ({ browser, request }) => {
  test.setTimeout(240_000);
  await forgetRateLimits();
  game = await addGame(browser, request);
  handle = (await givePage(game.maker, { name: "Night Owl", oneLine: "I make small, hard games." })).handle;
});
test.beforeEach(forgetRateLimits);

const bar = (page: Page) => page.getByRole("navigation", { name: "Ruken" });

/** Every element on the page that blurs what is behind it or carries the lens edge's warm fringe, named for a failure. */
async function glassOnThePage(page: Page): Promise<string[]> {
  // The lens edge's warm fringe, as the browser writes it in a computed box-shadow.
  const fringe = token("--glass-edge").match(/rgb\((\d+) (\d+) (\d+) \/ ([\d.]+)\)/g)?.[2] ?? "";
  const warm = `rgba(${(fringe.match(/\d+/g) ?? []).slice(0, 3).join(", ")}`;
  return page.evaluate((warmFringe) => {
    const found: string[] = [];
    for (const element of document.querySelectorAll("body *")) {
      for (const pseudo of [null, "::before", "::after"]) {
        const style = getComputedStyle(element, pseudo);
        const blur = style.backdropFilter || style.getPropertyValue("-webkit-backdrop-filter");
        const name = `${element.tagName.toLowerCase()}.${[...element.classList].join(".")}${pseudo ?? ""}`;
        if (blur !== "" && blur !== "none") found.push(`${name} blurs: ${blur}`);
        if (style.boxShadow.includes(warmFringe)) found.push(`${name} has the lens edge`);
      }
    }
    return found;
  }, warm);
}

for (const [screen, path, signedIn] of [
  ["Your games", "/make", true],
  ["Your account", "/me", true],
  ["Sign in", "/sign-in", false],
  ["Search", "/search", false],
  ["a maker's page", "maker", false],
] as const) {
  test(`${screen} is a plain page: its bar and buttons are solid, with no glass`, async ({
    page,
  }, testInfo) => {
    if (signedIn) await signInAs(page, game.maker.number, game.maker.password);
    await page.goto(path === "maker" ? `/${handle}` : path);
    await expect(bar(page)).toBeVisible();
    expect(await glassOnThePage(page)).toEqual([]);
    // Solid in the same colours: the bar is the darkest felt and its Add a game the main button's blue.
    await expect(bar(page)).toHaveCSS("background-color", rgb(token("--felt-deep")));
    await expect(bar(page).getByRole("link", { name: "Add a game", exact: true })).toHaveCSS(
      "background-color",
      rgb(token("--pay")),
    );
    if (path === "/make") {
      // The bar's mark for Your games is still drawn: a chalk ring inside its blue.
      await expect(bar(page).getByRole("link", { name: "Add a game", exact: true })).toHaveCSS(
        "box-shadow",
        /inset/,
      );
      const add = page.getByRole("main").getByRole("link", { name: "Add a game" });
      await expect(add).toHaveCSS("background-color", rgb(token("--pay")));
      await expect(add).toHaveCSS("text-shadow", "none");
    }
    await showTheOwner(page, testInfo, `${screen}, solid on a plain page`);
  });
}

test("the feed keeps its glass over the clips", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("section[data-slug]").first()).toBeVisible();
  const blur = await bar(page).evaluate(
    (element) =>
      getComputedStyle(element).backdropFilter ||
      getComputedStyle(element).getPropertyValue("-webkit-backdrop-filter"),
  );
  expect(blur).toMatch(/blur\(/);
});
