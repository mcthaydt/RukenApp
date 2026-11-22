import { expect, test, type Page } from "@playwright/test";
import { pageHasSettled, signInAs, signUpInItsOwnContext } from "./support/account.ts";
import { changeGame, givePage, pageCounts } from "./support/database.ts";
import { addGame, gameWhere } from "./support/game.ts";
import { expectFrame, showTheOwner } from "./support/look.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";
import { rgb } from "../support/look-tokens.ts";
import { THEMES } from "../../src/features/pages/themes.ts";

// A maker's page at /<handle> (spec 5.4): who they are, their games, their links, in their colours.

const theme = THEMES[0];
if (theme === undefined) throw new Error("the book gives no readable combination");
const OTHER_GAME = {
  title: "My other game",
  url: "https://store.example.com/other",
  kind: "game_elsewhere",
} as const;
const DISCORD = { title: "My Discord", url: "https://discord.example.com/invite/abc", kind: "link" } as const;

let maker: Awaited<ReturnType<typeof addGame>>;
let second: { slug: string; name: string };
let eighteen: { slug: string; name: string };
// The page of the maker who has the games: the journeys that need a game on the page share it.
let shown: { handle: string; linkIds: string[] };

test.beforeAll(async ({ browser, request }) => {
  test.setTimeout(240_000);
  await forgetRateLimits();
  maker = await addGame(browser, request);
  // Two more live games of the same maker, from rows; the second is 18+ and must stay off the page.
  // Each game is made by its own new account, in a browser context of its own (a signed-in context cannot sign up again).
  const liveGame = async (): Promise<{ slug: string; name: string }> => {
    // The sign-ups share one client address's limit, so each starts with it forgotten.
    await forgetRateLimits();
    const context = await browser.newContext({ baseURL: "http://localhost:4173" });
    try {
      return await gameWhere(await context.newPage(), { state: "live" });
    } finally {
      await context.close();
    }
  };
  second = await liveGame();
  eighteen = await liveGame();
  await changeGame(second.slug, { makerUserId: maker.makerUserId });
  await changeGame(eighteen.slug, {
    makerUserId: maker.makerUserId,
    ageRating: "age_18",
    contentMarks: ["gore"],
  });
  shown = await givePage(maker.maker, {
    name: "Night Owl",
    oneLine: "I make small, hard games.",
    themeId: theme.id,
    links: [DISCORD, OTHER_GAME, { title: "Hidden one", url: "https://hidden.example.com/x", hidden: true }],
  });
});
test.beforeEach(forgetRateLimits);

const noSideways = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

test("a maker's page shows who they are, their games and their links, in their colours", async ({
  page,
}, testInfo) => {
  const { handle, linkIds } = shown;
  const [firstLink = ""] = linkIds;
  await page.goto(`/${handle}`, { waitUntil: "domcontentloaded" });
  await pageHasSettled(page);

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Night Owl");
  await expect(page.getByText(`@${handle}`)).toBeVisible();
  await expect(page.getByText("I make small, hard games.")).toBeVisible();
  await expect(page).toHaveTitle("Ruken - The Everyday Console");
  // No photo: the name's first letter in a circle.
  await expect(page.locator(".initial")).toHaveText("N");
  await expect(page.locator(".dot")).toHaveCount(theme.colours.length);
  // No wordmark header: the page is the maker's own screen.
  await expect(page.getByRole("link", { name: "Ruken", exact: true })).toHaveCount(0);

  // The live games that are not 18+, newest first (the one that went live last first), each with its name and Play.
  const games = page.getByRole("region", { name: "Games" }).locator("article");
  await expect(games).toHaveCount(2);
  await expect(page.getByRole("link", { name: eighteen.name })).toHaveCount(0);
  for (const slug of [maker.slug, second.slug]) {
    const one = games.filter({ has: page.locator(`a[href="/g/${slug}"]`) });
    await expect(one.getByRole("heading", { level: 2 })).toBeVisible();
    await expect(one.getByRole("link", { name: "Play" })).toHaveAttribute("href", `/g/${slug}/play`);
  }
  // The game that went live last comes first.
  await expect(games.first().locator(`a[href="/g/${second.slug}"]`).first()).toBeVisible();
  await expectFrame(games.first().locator("video"));

  // Their links, in their order; a hidden one is not there; a game somewhere else says where.
  const links = page.getByRole("navigation", { name: "Links" }).getByRole("link");
  await expect(links).toHaveCount(2);
  await expect(links.nth(0)).toHaveAttribute("href", `/${handle}/out/${firstLink}`);
  await expect(links.nth(0)).toHaveAttribute("rel", "nofollow ugc noopener");
  await expect(links.nth(0)).toContainText("My Discord");
  await expect(links.nth(1)).toContainText("My other game");
  await expect(links.nth(1)).toContainText("A game on store.example.com");

  // It wears its colours: the ground and the text for the page, the button's pair for a link.
  const main = page.locator("main");
  await expect(main).toHaveCSS("background-color", rgb(theme.ground));
  await expect(main).toHaveCSS("color", rgb(theme.text));
  await expect(links.nth(0)).toHaveCSS("background-color", rgb(theme.button));
  await expect(links.nth(0)).toHaveCSS("color", rgb(theme.buttonText));
  for (const target of await page.getByRole("link").all()) {
    const box = await target.boundingBox();
    expect(box?.height ?? 0, await target.innerText()).toBeGreaterThanOrEqual(48);
  }
  expect(await noSideways(page)).toBe(true);
  await showTheOwner(page, testInfo, "a maker's page");
});

test("small icons sit after the links, one round link for each site, and are not among the links", async ({
  page,
  request,
  browser,
}, testInfo) => {
  const { handle, linkIds } = await givePage(await signUpInItsOwnContext(browser), {
    name: "Icon Maker",
    oneLine: "Find me elsewhere.",
    themeId: theme.id,
    links: [
      DISCORD,
      { title: "My videos", url: "https://www.youtube.com/@iconmaker", kind: "social" },
      { title: "Chat", url: "https://discord.gg/abc123", kind: "social" },
      { title: "Hidden icon", url: "https://github.com/iconmaker", kind: "social", hidden: true },
    ],
  });
  await page.goto(`/${handle}`, { waitUntil: "domcontentloaded" });
  await pageHasSettled(page);

  // The icons are not among "Links": only the plain link is there.
  await expect(page.getByRole("navigation", { name: "Links" }).getByRole("link")).toHaveCount(1);
  // They sit after it, in their order, each named for its site; a hidden one is not there.
  const elsewhere = page.getByRole("navigation", { name: "Elsewhere" });
  const icons = elsewhere.getByRole("link");
  await expect(icons).toHaveCount(2);
  await expect(icons.nth(0)).toHaveAccessibleName("YouTube");
  await expect(icons.nth(1)).toHaveAccessibleName("Discord");
  await expect(elsewhere.getByRole("link", { name: "GitHub" })).toHaveCount(0);
  const [, youtubeLink = ""] = linkIds;
  await expect(icons.nth(0)).toHaveAttribute("href", `/${handle}/out/${youtubeLink}`);
  await expect(icons.nth(0)).toHaveAttribute("rel", "nofollow ugc noopener");
  const links = await page.getByRole("navigation", { name: "Links" }).boundingBox();
  const row = await elsewhere.boundingBox();
  expect(row?.y ?? 0).toBeGreaterThan((links?.y ?? 0) + (links?.height ?? 0) - 1);

  // Each is a 48px round link wearing the page's button colours, with its mark drawn inside.
  for (const icon of await icons.all()) {
    const box = await icon.boundingBox();
    expect(box?.width).toBe(48);
    expect(box?.height).toBe(48);
    await expect(icon).toHaveCSS("border-radius", "50%");
    await expect(icon).toHaveCSS("background-color", rgb(theme.button));
    await expect(icon.locator("svg path")).toHaveCount(1);
    await expect(icon.locator("svg")).toHaveCSS("fill", rgb(theme.buttonText));
  }
  expect(await noSideways(page)).toBe(true);

  // A tap goes through ours, which counts it and sends the visitor on.
  const sent = await request.get(`/${handle}/out/${youtubeLink}`, { maxRedirects: 0 });
  expect(sent.status()).toBe(303);
  expect(sent.headers()["location"]).toBe("https://www.youtube.com/@iconmaker");
  await showTheOwner(page, testInfo, "a maker's page with social icons");
});

test("a page with no games and no links has neither section", async ({ page, browser }, testInfo) => {
  const { handle } = await givePage(await signUpInItsOwnContext(browser), {
    name: "Quiet Maker",
    oneLine: "",
  });
  await page.goto(`/${handle}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Quiet Maker");
  await expect(page.locator("main")).toHaveCSS("background-color", "rgb(17, 47, 44)");
  await expect(page.locator("main")).toHaveCSS("color", "rgb(255, 255, 255)");
  await expect(page.getByRole("region", { name: "Games" })).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Links" })).toHaveCount(0);
  await showTheOwner(page, testInfo, "a maker's page with no games");
});

test("a page with Ruken's colours is felt and chalk with paper buttons", async ({
  page,
  browser,
}, testInfo) => {
  const { handle } = await givePage(await signUpInItsOwnContext(browser), {
    name: "Felt Maker",
    oneLine: "Plain.",
    links: [DISCORD],
  });
  await page.goto(`/${handle}`, { waitUntil: "domcontentloaded" });
  const link = page.getByRole("navigation", { name: "Links" }).getByRole("link");
  await expect(page.locator("main")).toHaveCSS("background-color", "rgb(17, 47, 44)");
  await expect(link).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(link).toHaveCSS("color", "rgb(17, 19, 20)");
  await showTheOwner(page, testInfo, "a maker's page, Ruken's colours");
});

test("an address nobody has is the missing page, with its way back", async ({ page }) => {
  const answer = await page.goto("/nobody-has-this-address", { waitUntil: "domcontentloaded" });
  expect(answer?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "We can't find that page." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to Ruken" })).toHaveAttribute("href", "/");
  // A word with a capital or a dot is not an address at all.
  expect((await page.goto("/Night-Owl"))?.status()).toBe(404);
});

test("a tap on a link is counted and sent on; a hidden, foreign or made-up link is not", async ({
  request,
  browser,
}) => {
  const mine = await givePage(await signUpInItsOwnContext(browser), {
    name: "Counting",
    oneLine: "",
    links: [DISCORD, { title: "Hidden", url: "https://hidden.example.com/x", hidden: true }],
  });
  const other = await givePage(await signUpInItsOwnContext(browser), {
    name: "Someone else",
    oneLine: "",
    links: [DISCORD],
  });

  const [mineLink = "", hiddenLink = ""] = mine.linkIds;
  const [otherLink = ""] = other.linkIds;
  const sent = await request.get(`/${mine.handle}/out/${mineLink}`, { maxRedirects: 0 });
  expect(sent.status()).toBe(303);
  expect(sent.headers()["location"]).toBe(DISCORD.url);
  for (const path of [
    `/${mine.handle}/out/${hiddenLink}`, // hidden
    `/${mine.handle}/out/${otherLink}`, // another page's link
    `/${mine.handle}/out/not-a-link`, // made up
  ]) {
    expect((await request.get(path, { maxRedirects: 0 })).status(), path).toBe(404);
  }
  expect(await pageCounts(mine.handle)).toEqual({ views: 0, taps: [1, 0] });
});

test("a visitor's open and tap are counted, the maker's own are not", async ({ page, browser }) => {
  test.slow();
  const owner = await signUpInItsOwnContext(browser);
  const { handle, linkIds } = await givePage(owner, { name: "Counting Two", oneLine: "", links: [DISCORD] });
  await page.goto(`/${handle}`, { waitUntil: "domcontentloaded" });
  expect(await pageCounts(handle)).toEqual({ views: 1, taps: [0] });

  // The maker, signed in, opens the page and taps the link.
  const context = await browser.newContext({ baseURL: "http://localhost:4173" });
  try {
    const own = await context.newPage();
    await signInAs(own, owner.number, owner.password);
    await own.goto(`/${handle}`, { waitUntil: "domcontentloaded" });
    const [ownLink = ""] = linkIds;
    const tap = await context.request.get(`/${handle}/out/${ownLink}`, { maxRedirects: 0 });
    expect(tap.status()).toBe(303);
  } finally {
    await context.close();
  }
  expect(await pageCounts(handle)).toEqual({ views: 1, taps: [0] });
});

test("landing on a page remembers its maker's link", async ({ page, browser }) => {
  const { handle } = await givePage(await signUpInItsOwnContext(browser), {
    name: "Remembered",
    oneLine: "",
  });
  await page.goto(`/${handle}`, { waitUntil: "domcontentloaded" });
  const cookie = (await page.context().cookies()).find((one) => one.name === "rk_arrival");
  expect(cookie).toMatchObject({ httpOnly: true, sameSite: "Lax" });
});

test("a long name, link title and line push nothing sideways on the smallest phone, and everything is easy to press", async ({
  page,
  browser,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  const { handle } = await givePage(await signUpInItsOwnContext(browser), {
    name: "N".repeat(40),
    oneLine: "L".repeat(100),
    links: [{ title: "T".repeat(60), url: "https://long.example.com/x" }, DISCORD],
  });
  await page.goto(`/${handle}`, { waitUntil: "domcontentloaded" });
  await pageHasSettled(page);
  expect(await noSideways(page)).toBe(true);
  for (const target of await page.getByRole("link").all()) {
    const box = await target.boundingBox();
    expect(box?.height ?? 0, await target.innerText()).toBeGreaterThanOrEqual(48);
  }
});

test("the keyboard reaches Play and a link, and shows where it is", async ({ page }) => {
  const { handle } = shown;
  await page.goto(`/${handle}`, { waitUntil: "domcontentloaded" });
  await pageHasSettled(page);
  // Tab walks the games first (a name, then its Play) and then the links; every stop shows where it is.
  const stops: string[] = [];
  for (let press = 0; press < 10; press += 1) {
    await page.keyboard.press("Tab");
    const now = page.locator(":focus");
    stops.push((await now.innerText()).trim());
    expect(await now.evaluate((el) => getComputedStyle(el).outlineStyle), stops.at(-1)).not.toBe("none");
    if (stops.at(-1) === "My Discord") break;
  }
  expect(stops).toContain("Play");
  expect(stops.at(-1)).toBe("My Discord");
});
