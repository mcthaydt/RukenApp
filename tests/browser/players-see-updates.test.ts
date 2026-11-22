import { expect, test, type Browser, type Page } from "@playwright/test";
import { pageHasSettled, signInAs } from "./support/account.ts";
import { addGame, freshName, reviewJob } from "./support/game.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

// When a maker changes a live game, the players see it: a new name on the game's page and in Play, and, once staff
// accept a new version, Play opens the new files. The maker's own screens are checked in make-after.test.ts; these
// journeys follow the change through to a stranger with no account (the games are free, so anyone may play).

test.beforeEach(forgetRateLimits);

/** The pull whose files Play opened: the pass in the frame's address names it (`v1.<payload>.<mac>`, payload `p`). */
async function pullPlayOpens(page: Page, slug: string): Promise<string> {
  await page.goto(`/g/${slug}/play`, { waitUntil: "domcontentloaded" });
  await pageHasSettled(page);
  const frame = page.locator("iframe.frame");
  await expect(page.frameLocator("iframe.frame").locator("body")).toHaveAttribute("data-loaded", "yes");
  const address = await frame.getAttribute("src");
  const pass = /\/(v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)\/$/.exec(address ?? "")?.[1];
  if (pass === undefined) throw new Error(`no pass in the frame's address: ${String(address)}`);
  const claims = JSON.parse(Buffer.from(pass.split(".")[1] ?? "", "base64url").toString("utf8")) as {
    p: string;
  };
  return claims.p;
}

/** A stranger in a window of their own, with no account. */
async function asStranger<T>(browser: Browser, look: (page: Page) => Promise<T>): Promise<T> {
  const context = await browser.newContext({ baseURL: "http://localhost:4173" });
  try {
    return await look(await context.newPage());
  } finally {
    await context.close();
  }
}

test("a live game's new name is what players see on its page and in Play", async ({
  page,
  browser,
  request,
}) => {
  test.setTimeout(120_000);
  const game = await addGame(browser, request, { free: true });

  await signInAs(page, game.maker.number, game.maker.password);
  await page.goto(`/make/${game.slug}/name`);
  await pageHasSettled(page);
  const renamed = freshName("Floor Fifty");
  await page.getByLabel("What's your game called?").fill(renamed);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).toHaveURL(`/make/${game.slug}`);

  await asStranger(browser, async (stranger) => {
    await stranger.goto(`/g/${game.slug}`, { waitUntil: "domcontentloaded" });
    await pageHasSettled(stranger);
    await expect(stranger.getByRole("heading", { level: 1 })).toHaveText(renamed);
    await expect(stranger).toHaveTitle(`${renamed} · Ruken`);
    await expect(stranger.getByText(game.name)).toHaveCount(0);

    // Play's menu names the game too.
    await pullPlayOpens(stranger, game.slug);
    await stranger.getByRole("group").getByLabel("Menu. Use the arrow keys to move it.").click();
    await expect(stranger.getByRole("heading", { name: renamed })).toBeVisible();
  });
});

test("a new version reaches players only once it is accepted, and then Play opens its files", async ({
  page,
  browser,
  request,
}) => {
  test.setTimeout(150_000);
  const game = await addGame(browser, request, { free: true });
  const first = await asStranger(browser, (stranger) => pullPlayOpens(stranger, game.slug));

  await signInAs(page, game.maker.number, game.maker.password);
  await page.goto(`/make/${game.slug}`);
  await pageHasSettled(page);
  await page.getByRole("button", { name: "Send a new version" }).click();
  await expect(page.getByText("Your update is waiting for review.")).toBeVisible({ timeout: 20_000 });

  // While it waits, players keep the version staff said yes to.
  expect(await asStranger(browser, (stranger) => pullPlayOpens(stranger, game.slug))).toBe(first);

  const yes = await reviewJob(request, { do: "accept", game: game.slug }, browser);
  expect(yes.status()).toBe(200);

  const second = await asStranger(browser, async (stranger) => {
    await stranger.goto(`/g/${game.slug}`, { waitUntil: "domcontentloaded" });
    await expect(stranger.getByRole("heading", { level: 1 })).toHaveText(game.name);
    return pullPlayOpens(stranger, game.slug);
  });
  expect(second).not.toBe(first);
});
