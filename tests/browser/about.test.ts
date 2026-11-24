import { fileURLToPath } from "node:url";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { pageHasSettled, signUp } from "./support/account.ts";
import { gameWhere } from "./support/game.ts";
import { showTheOwner } from "./support/look.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";
import { dollars, PREMIUM_PRICES_CENTS } from "../../src/features/membership/membership.ts";
import { BASE_TITLE } from "../../src/lib/titles.ts";

// The landing page (/about): a stranger who wants to know what Ruken is finds it from the price card, the sign-in screen,
// the You page and the help, reads it top to bottom, and goes on to the feed or to the help for makers. It makes nothing
// a person can save, so it has no create, update or delete of its own.

test.beforeEach(forgetRateLimits);

const STAND_IN_STILL = fileURLToPath(new URL("../fixtures/clips/stand-in-still.jpg", import.meta.url));

const SECTIONS = [
  "Made a game? Let people play it.",
  "Find your next game in a swipe.",
  "One price. Every game.",
  "How Ruken works",
  "Your clip got seen. Now send them here.",
  "Chosen by people. Safe to play.",
  "Makers' pay, in the open",
  "Want to play?",
  "Made a game?",
  "Built in the open.",
];

/** The page is there and says what Ruken is, with its one blue button first. */
async function expectTheLandingPage(page: Page): Promise<void> {
  await expect(page).toHaveURL("/about");
  // Every screen shows the base title in the browser tab (#320).
  await expect(page).toHaveTitle(BASE_TITLE);
  await expect(page.getByRole("heading", { level: 1, name: "Watch a game. Then play it." })).toBeVisible();
}

test("a stranger reads what Ruken is, in order, and goes to the feed", async ({
  browser,
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  // A live game, so the feed has a clip for the top of the page.
  const context = await browser.newContext({ baseURL: "http://localhost:4173" });
  try {
    await gameWhere(await context.newPage(), { state: "live" });
  } finally {
    await context.close();
  }

  await page.goto("/about");
  await expectTheLandingPage(page);
  await pageHasSettled(page);

  // The headings come in the page's order.
  const headings = await page.getByRole("heading", { level: 2 }).allInnerTexts();
  const order = SECTIONS.map((name) => headings.indexOf(name));
  expect(order.every((at) => at >= 0)).toBe(true);
  expect(order).toEqual([...order].sort((a, b) => a - b));

  // The live games' clips are the first screen, as a wall of the feed's own clips.
  await expect(page.locator(".hero .wall video")).toHaveCount(6);
  // The price is the paywall card's, from the rules.
  const monthly = dollars(PREMIUM_PRICES_CENTS.monthly);
  const annual = dollars(PREMIUM_PRICES_CENTS.annual);
  await expect(page.getByText(`${monthly} a month, or ${annual} a year`)).toBeVisible();
  // Signed out, the way to sign in is at the top.
  await expect(
    page.getByRole("navigation", { name: "On this page" }).getByRole("link", { name: "Sign in" }),
  ).toBeVisible();

  // Nothing pushes the page sideways.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);

  // Every link and button is big enough for a thumb.
  const small = await page.locator("main.about a").evaluateAll((links) =>
    links
      .map((link) => ({ words: link.textContent.trim(), box: link.getBoundingClientRect() }))
      .filter(({ box }) => box.width < 44 || box.height < 44)
      .map(({ words }) => words),
  );
  expect(small).toEqual([]);
  await showTheOwner(page, testInfo, "the landing page");

  // "For makers" jumps to the makers' block.
  await page
    .getByRole("navigation", { name: "On this page" })
    .getByRole("link", { name: "For makers" })
    .click();
  await expect(page).toHaveURL("/about#makers");

  // The keyboard alone reaches the one blue button and presses it.
  const watch = page.getByRole("link", { name: "Watch the feed" }).first();
  await watch.focus();
  await expect(watch).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL("/");
});

test("the wall's clips play without jumping back to their start over and over", async ({ browser, page }) => {
  test.setTimeout(120_000);
  // A live game with clips this browser plays, so the wall has something to play.
  const context = await browser.newContext({ baseURL: "http://localhost:4173" });
  try {
    await gameWhere(await context.newPage(), { state: "live" });
  } finally {
    await context.close();
  }
  await page.goto("/about");
  await expectTheLandingPage(page);
  await pageHasSettled(page);
  const wall = page.locator(".hero .wall video");
  await expect(wall).toHaveCount(6);

  // Safari's engine on Linux, given a looping video whose address names a start time (every wall clip's `#t=`), jumped
  // back to the start about a hundred times a second and never played (progress.md, Flaky tests). A clip that plays,
  // loops or is paused jumps a few times at most: the test clip is two seconds long, so in four seconds a clip that
  // loops goes back to its start two or three times. Each clip is counted on its own, so six clips looping as they
  // should never add up to look like one that jumps over and over.
  const jumps = await page.evaluate(
    () =>
      new Promise<number[]>((resolve) => {
        const videos = [...document.querySelectorAll(".hero .wall video")];
        const counts = videos.map(() => 0);
        videos.forEach((video, index) => {
          video.addEventListener("seeking", () => (counts[index] = (counts[index] ?? 0) + 1));
        });
        setTimeout(() => {
          resolve(counts);
        }, 4_000);
      }),
  );
  expect(
    Math.max(...jumps),
    `jumps of each wall clip in four seconds: ${jumps.join(", ")}`,
  ).toBeLessThanOrEqual(5);
});

test("until a wall clip plays, its still shows in the clip's own place", async ({ browser, page }) => {
  test.setTimeout(120_000);
  const context = await browser.newContext({ baseURL: "http://localhost:4173" });
  try {
    await gameWhere(await context.newPage(), { state: "live" });
  } finally {
    await context.close();
  }
  // The journeys' site has no media tool, so it makes no stills (the still address answers 404 there; the unit tests
  // make them with a stand-in). Here the browser is handed a magenta stand-in for every still, and the clips never
  // arrive, so what shows in each clip's place can only be its still.
  const stills: string[] = [];
  await page.route(
    (url) => url.pathname.startsWith("/api/still/"),
    async (route) => {
      stills.push(route.request().url());
      await route.fulfill({ path: STAND_IN_STILL, contentType: "image/jpeg" });
    },
  );
  await page.route(
    (url) =>
      !url.pathname.startsWith("/api/still/") &&
      /\/clips\/[^/]+\/upright-[0-9a-f]{16}\.(mp4|webm|mov)$/.test(url.pathname),
    // Held, never answered: the clip is still on its way, which is the wait the still covers.
    () => new Promise<void>(() => undefined),
  );
  await page.goto("/about");
  await expectTheLandingPage(page);
  await pageHasSettled(page);

  const wall = page.locator(".hero .wall video");
  await expect(wall).toHaveCount(6);
  for (const video of await wall.all()) {
    if (!(await video.isVisible())) continue;
    // The still is the clip's own background, cut and placed as its frames are, so it cannot sit anywhere else. It is
    // of the second the clip opens on (its address's `#t=`), at a width made for the screen.
    const { still, src, fit } = await video.evaluate((node: HTMLVideoElement) => ({
      still: node.style.getPropertyValue("--still"),
      src: node.getAttribute("src") ?? "",
      fit: [
        getComputedStyle(node).backgroundSize,
        getComputedStyle(node).backgroundPosition,
        getComputedStyle(node).objectPosition,
      ],
    }));
    const opensAt = /#t=(\d+)$/.exec(src)?.[1];
    expect(still).toMatch(
      /^url\("http:\/\/localhost:4173\/api\/still\/clips\/[a-z2-7]{10}\/upright-[0-9a-f]{16}\.(mp4|webm|mov)\?at=\d+&width=\d+"\)$/,
    );
    expect(still).toContain(`?at=${opensAt ?? "none"}&`);
    // Cut as the clip's frames are (object-fit: cover) and placed where they are (object-position).
    expect(fit[0]).toBe("cover");
    expect(fit[1]).toBe(fit[2]);
    // Part of a clip may sit under the headline's boxes or off the screen, so the share of its box that shows the still is
    // counted: without a still, none of it is magenta.
    await expect.poll(() => magentaShare(video)).toBeGreaterThan(0.1);
  }
  expect(stills.length).toBeGreaterThan(0);
});

/** The share of a thing's pixels, as the screen shows it, that are the magenta stand-in still. */
async function magentaShare(thing: Locator): Promise<number> {
  const png = await thing.screenshot({ animations: "disabled" });
  return thing.page().evaluate(async (data) => {
    const image = new Image();
    image.src = `data:image/png;base64,${data}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext("2d");
    if (context === null) return 0;
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, image.width, image.height).data;
    let magenta = 0;
    for (let at = 0; at + 3 < pixels.length; at += 4) {
      if ((pixels[at] ?? 0) > 200 && (pixels[at + 1] ?? 255) < 60 && (pixels[at + 2] ?? 0) > 200)
        magenta += 1;
    }
    return magenta / (pixels.length / 4);
  }, png.toString("base64"));
}

test("the still address answers nothing for what is not a stored clip, or where there is no media tool", async ({
  request,
}) => {
  for (const address of [
    "/api/still/files/abcdefghij/index.html?at=0&width=540",
    "/api/still/clips/abcdefghij/upright-0123456789abcdef.mp4?at=0&width=540",
    "/api/still/clips/abcdefghij/upright-0123456789abcdef.mp4?at=0&width=7",
  ]) {
    const answer = await request.get(address);
    expect(answer.status(), address).toBe(404);
    expect(answer.headers()["cache-control"]).toBe("no-store");
  }
});

test("a maker goes from the landing page to the help for makers", async ({ page }) => {
  await page.goto("/about");
  await expectTheLandingPage(page);
  await page.locator("#makers").getByRole("link", { name: "Help for makers" }).click();
  await expect(page).toHaveURL("/help");
  await expect(page.getByRole("heading", { level: 1, name: "Help for makers" })).toBeVisible();

  // And back: the help links to the landing page too.
  await page.getByRole("link", { name: "What is Ruken?" }).click();
  await expectTheLandingPage(page);
});

test("the landing page's foot leads to the terms and the privacy pages, with no underline", async ({
  page,
}) => {
  for (const name of ["Terms", "Privacy"]) {
    await page.goto("/about");
    await expectTheLandingPage(page);
    const link = page
      .getByRole("navigation", { name: "The small print" })
      .getByRole("link", { name, exact: true });
    // No underlined words act as links on Ruken (the owner's rule, 2026-11-22).
    expect(await link.evaluate((node) => getComputedStyle(node).textDecorationLine)).toBe("none");
    await link.click();
    await expect(page).toHaveURL(`/${name.toLowerCase()}`);
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  }
});

test("the landing page links to Ruken's code on GitHub", async ({ page }) => {
  await page.goto("/about");
  await expectTheLandingPage(page);
  await expect(page.getByRole("link", { name: "See the code on GitHub" })).toHaveAttribute(
    "href",
    "https://github.com/mcthaydt/RukenApp",
  );
});

test("the corner button goes back to the feed from anywhere on the landing page", async ({ page }) => {
  await page.goto("/about");
  await expectTheLandingPage(page);
  await page.locator(".sitefoot").scrollIntoViewIfNeeded();
  const back = page.getByRole("link", { name: "Back to the feed" });
  await expect(back).toBeInViewport();
  await back.click();
  await expect(page).toHaveURL("/");
});

test("the price card and the sign-in screen lead to the landing page", async ({ page }) => {
  await page.goto("/join");
  await page.getByRole("link", { name: "What is Ruken?" }).click();
  await expectTheLandingPage(page);

  await page.goto("/sign-in");
  await page.getByRole("link", { name: "What is Ruken?" }).click();
  await expectTheLandingPage(page);
});

test("the You page leads to the landing page, which has no Sign in for someone signed in", async ({
  page,
}) => {
  await signUp(page);
  await page.goto("/me");
  await page.getByRole("link", { name: "What is Ruken?" }).click();
  await expectTheLandingPage(page);
  await expect(
    page.getByRole("navigation", { name: "On this page" }).getByRole("link", { name: "Sign in" }),
  ).toHaveCount(0);
});

test("a jump to For players lands on its top, and the card stays there as it shows", async ({ page }) => {
  await page.goto("/about");
  await expectTheLandingPage(page);
  await pageHasSettled(page);
  await page
    .getByRole("navigation", { name: "On this page" })
    .getByRole("link", { name: "For players" })
    .click();
  await expect(page).toHaveURL("/about#players");
  const players = page.locator("#players");
  await expect(players).toHaveCSS("opacity", "1");
  // Its top is at the window's top once the scroll and the card's fade have both ended: not 24 px above it. Within a
  // pixel, since a browser may land a fraction off (WebKit gives a tiny negative).
  const top = (): Promise<number> => players.evaluate((card) => card.getBoundingClientRect().top);
  await expect.poll(async () => Math.abs(await top()), { timeout: 5_000 }).toBeLessThan(1);
  await page.waitForTimeout(1_000);
  expect(Math.abs(await top())).toBeLessThan(1);
});

test("the corner button computes no underline, so no words in it could ever be underlined", async ({
  page,
}) => {
  await page.goto("/about");
  await expectTheLandingPage(page);
  const back = page.getByRole("link", { name: "Back to the feed" });
  expect(await back.evaluate((link) => getComputedStyle(link).textDecorationLine)).toBe("none");
});

test.describe("on a phone held sideways", () => {
  for (const viewport of [
    { width: 667, height: 375 },
    { width: 844, height: 390 },
  ]) {
    test(`the blue button is on the first screen at ${String(viewport.width)} by ${String(viewport.height)}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto("/about");
      await expectTheLandingPage(page);
      await expect(page.getByRole("link", { name: "Watch the feed" }).first()).toBeInViewport({ ratio: 1 });
    });
  }
});

test("only the cards the top links jump to give up their rise; the bands further down still rise in", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/about");
  await expectTheLandingPage(page);
  await pageHasSettled(page);
  /** How far below its place a block waits before it shows, in pixels. */
  const waitsBelow = (selector: string): Promise<number> =>
    page.locator(selector).evaluate((block) => new DOMMatrix(getComputedStyle(block).transform).m42);
  expect(await waitsBelow("#makers")).toBe(0);
  expect(await waitsBelow("#players")).toBe(0);
  for (const band of ["#fans", "#safe", "#pay"]) expect(await waitsBelow(band), band).toBeGreaterThan(0);
});
