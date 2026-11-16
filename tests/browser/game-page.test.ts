import { expect, test, type Page } from "@playwright/test";
import { changeGame, putGameWhereStaffLeaveIt } from "./support/database.ts";
import { gameWhere } from "./support/game.ts";
import { expectOneCard, showTheOwner } from "./support/look.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

// A game's page, `/g/<game>` (design 5.2, 5.4): its clip, name, one line and rating, then Play. It is a stand-in until
// the feed (slice 3) opens at the game's clip. Every game here is written into the database with real clips in the
// bucket: no journey here looks inside the game's frame, so none needs the maker's whole walk.

test.beforeEach(forgetRateLimits);

/** True when the browser itself says it is a phone, as the site reads it. Playwright's iPads say so too. */
async function browserSaysPhone(page: Page): Promise<boolean> {
  return /Mobi|Android/.test(await page.evaluate(() => navigator.userAgent));
}

test("a game's page shows its clip, its name, its line, who it is for and Play", async ({
  page,
}, testInfo) => {
  const game = await gameWhere(page, { state: "live" });
  await page.goto(`/g/${game.slug}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(game.name);
  await expect(page.getByText("A tiny game about tapping.")).toBeVisible();
  await expect(page.locator("main .chip")).toHaveText("12+");
  await expect(page.getByRole("link", { name: "Play" })).toHaveAttribute("href", `/g/${game.slug}/play`);
  await expect(page.getByRole("button")).toHaveCount(0);
  await expect(page).toHaveTitle(`${game.name} · Ruken`);
  const video = page.locator("video.clip");
  for (const flag of ["muted", "loop", "autoplay", "playsinline"]) await expect(video).toHaveAttribute(flag);
  const sources = video.locator("source");
  await expect(sources.nth(0)).toHaveAttribute("media", "(orientation: portrait)");
  await expect(sources.nth(0)).toHaveAttribute(
    "src",
    /^http:\/\/media\.localhost:8788\/clips\/[^/]+\/upright-[0-9a-f]{16}\.\w+$/,
  );
  await expect(sources.nth(1)).toHaveAttribute("src", /\/wide-[0-9a-f]{16}\.\w+$/);
  // The order "What players will see" shows the maker: the clip, the name, the line, the rating, then Play.
  const order = await page
    .locator("main > *")
    .evaluateAll((parts) => parts.map((part) => part.tagName.toLowerCase() + part.textContent.trim()));
  expect(order[0]).toBe("video");
  expect(order.slice(1)).toEqual([`h1${game.name}`, "pA tiny game about tapping.", "p12+", "pPlay"]);
  await expectOneCard(page);
  await showTheOwner(page, testInfo, "a game's page");
});

test("the clip's address answers anyone, as video", async ({ page, browser }) => {
  const game = await gameWhere(page, { state: "live" });
  await page.goto(`/g/${game.slug}`);
  const sources = await page
    .locator("video.clip source")
    .evaluateAll((all) => all.map((one) => one.getAttribute("src")));
  expect(sources).toHaveLength(2);
  // A browser of its own, with no cookies: the clip is for anyone, signed in or not. A browser, not a bare request,
  // because only a browser finds the media address's `.localhost` name.
  const stranger = await browser.newContext();
  try {
    const strangerPage = await stranger.newPage();
    for (const src of sources) {
      const answer = await strangerPage.goto(src ?? "");
      expect(answer?.status()).toBe(200);
      expect(answer?.headers()["content-type"]).toMatch(/^video\//);
    }
  } finally {
    await stranger.close();
  }
});

test("landing on a game's page remembers its maker's link", async ({ page, browser }) => {
  const game = await gameWhere(page, { state: "live" });
  // A visitor in a browser of their own, who has never been to Ruken.
  const visitor = await browser.newContext({ baseURL: new URL(page.url()).origin });
  try {
    const visitorPage = await visitor.newPage();
    await visitorPage.goto(`/g/${game.slug}`);
    const arrival = (await visitor.cookies()).find((cookie) => cookie.name === "rk_arrival");
    expect(arrival).toMatchObject({ httpOnly: true, sameSite: "Lax" });
  } finally {
    await visitor.close();
  }
});

test("a game that is not there is a missing page with a way back", async ({ page }) => {
  const answer = await page.goto("/g/no-such-game");
  expect(answer?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "We can't find that page." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to Ruken" })).toHaveAttribute("href", "/");
});

test("a game is not at its address until staff accept it", async ({ page }) => {
  const game = await gameWhere(page, { state: "waiting" }, { agreed: true });
  expect((await page.goto(`/g/${game.slug}`))?.status()).toBe(404);
  await putGameWhereStaffLeaveIt(game.slug, { state: "live" });
  expect((await page.goto(`/g/${game.slug}`))?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(game.name);
});

test("a computer-only game says so on a phone, and offers its link", async ({ page }, testInfo) => {
  const game = await gameWhere(page, { state: "live" });
  await changeGame(game.slug, { playsOn: "computer_only" });
  await page.goto(`/g/${game.slug}`);
  if (await browserSaysPhone(page)) {
    await expect(page.getByText("This one needs a computer.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Play" })).toHaveCount(0);
    await expectOneCard(page);
    // The test browser has no share sheet, so the address is copied, or the line says where it is.
    await page.getByRole("button", { name: "Share the link" }).click();
    await expect(
      page.getByText(/^(Link copied\.|Copy the address from the bar at the top\.)$/),
    ).toBeVisible();
    await showTheOwner(page, testInfo, "a computer-only game on a phone");
  } else {
    await expect(page.getByText("This one needs a computer.")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Play" })).toBeVisible();
  }
});
