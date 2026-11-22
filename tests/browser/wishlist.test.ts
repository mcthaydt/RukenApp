import { expect, test, type Locator, type Page } from "@playwright/test";
import { finishSignUpForm, freshNumber, pageHasSettled, signInAs } from "./support/account.ts";
import { givePage } from "./support/database.ts";
import { addGame } from "./support/game.ts";
import { atLaunch, beforeLaunch } from "./support/launch.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

// Before launch (the wishlist spec, as changed on 2026-11-22): where Play would be, a game shows the day it opens and a
// Wishlist button, in the feed, on its maker's page and on its own page. From launch it shows Play. The play address
// itself stays open before launch, on the owner's word, so testers can still play.

let game: Awaited<ReturnType<typeof addGame>>;
let free: Awaited<ReturnType<typeof addGame>>;
let handle: string;

test.beforeAll(async ({ browser, request }) => {
  test.setTimeout(180_000);
  game = await addGame(browser, request);
  free = await addGame(browser, request, { free: true });
  ({ handle } = await givePage(game.maker, { name: "Wish Maker", oneLine: "Games for later." }));
});
test.beforeEach(forgetRateLimits);

const OPENS = "Opens 30 November";
const clipOf = (page: Page, slug: string): Locator => page.locator(`section[data-slug="${slug}"]`);
const makerGameOf = (page: Page, name: string): Locator =>
  page.locator("article.game").filter({ has: page.getByRole("heading", { name }) });
const wishlist = (within: Page | Locator): Locator => within.getByRole("button", { name: "Wishlist", exact: true });
const onList = (within: Page | Locator): Locator =>
  within.getByRole("button", { name: "On your wishlist", exact: true });
const play = (within: Page | Locator): Locator => within.getByRole("link", { name: "Play", exact: true });

test("before launch a game shows Wishlist and the day it opens, not Play, on every screen; from launch, Play", async ({
  page,
}) => {
  await beforeLaunch(page.context());

  await page.goto(`/g/${game.slug}`);
  await pageHasSettled(page);
  await expect(wishlist(page)).toBeVisible();
  await expect(page.getByText(OPENS)).toBeVisible();
  await expect(play(page)).toHaveCount(0);

  await page.goto("/");
  await pageHasSettled(page);
  const clip = clipOf(page, game.slug);
  await clip.scrollIntoViewIfNeeded();
  await expect(wishlist(clip)).toBeVisible();
  await expect(clip.getByText(OPENS)).toBeVisible();
  await expect(play(clip)).toHaveCount(0);

  await page.goto(`/${handle}`);
  await pageHasSettled(page);
  const listed = makerGameOf(page, game.name);
  await expect(wishlist(listed)).toBeVisible();
  await expect(listed.getByText(OPENS)).toBeVisible();
  await expect(play(listed)).toHaveCount(0);

  await atLaunch(page.context());
  await page.goto(`/g/${game.slug}`);
  await pageHasSettled(page);
  await expect(play(page)).toHaveAttribute("href", `/g/${game.slug}/play`);
  await expect(wishlist(page)).toHaveCount(0);
  await expect(page.getByText(OPENS)).toHaveCount(0);

  await page.goto("/");
  await pageHasSettled(page);
  await expect(play(clipOf(page, game.slug))).toHaveAttribute("href", `/g/${game.slug}/play`);
  await expect(clipOf(page, game.slug).getByText(OPENS)).toHaveCount(0);

  await page.goto(`/${handle}`);
  await pageHasSettled(page);
  await expect(play(makerGameOf(page, game.name))).toBeVisible();
  await expect(wishlist(makerGameOf(page, game.name))).toHaveCount(0);
});

test("before launch the play address is not refused: a free game plays", async ({ page }) => {
  await beforeLaunch(page.context());
  await page.goto(`/g/${free.slug}/play`);
  await expect(page).toHaveURL(`/g/${free.slug}/play`);
  await expect(page.frameLocator("iframe.frame").locator("body")).toHaveAttribute("data-loaded", "yes");
});

test("signed out, Wishlist signs you up and brings you back with the game on your list; pressing again takes it off", async ({
  page,
  browser,
}) => {
  test.setTimeout(90_000);
  await beforeLaunch(page.context());
  await page.goto(`/g/${game.slug}`);
  await pageHasSettled(page);
  await wishlist(page).click();

  await expect(page).toHaveURL(/\/sign-up\?next=/);
  await pageHasSettled(page);
  await finishSignUpForm(page, freshNumber());
  await expect(page).toHaveURL(`/g/${game.slug}`);
  await pageHasSettled(page);
  await expect(onList(page)).toBeVisible();

  // Read back: it is stored, not only drawn.
  await page.reload();
  await pageHasSettled(page);
  await expect(onList(page)).toBeVisible();

  // The maker sees the count, counted from the stored rows.
  const makerContext = await browser.newContext({ baseURL: "http://localhost:4173" });
  try {
    const maker = await makerContext.newPage();
    await beforeLaunch(makerContext);
    await signInAs(maker, game.maker.number, game.maker.password);
    // The first look at a newly accepted game is the Accepted screen, once; the live screen follows.
    await maker.goto(`/make/${game.slug}`);
    await pageHasSettled(maker);
    await maker.goto(`/make/${game.slug}`);
    await pageHasSettled(maker);
    await expect(maker.getByText("Wishlisted by 1 person")).toBeVisible();

    // Take it off: one more press.
    await onList(page).click();
    await expect(wishlist(page)).toBeVisible();
    await page.reload();
    await pageHasSettled(page);
    await expect(wishlist(page)).toBeVisible();

    await maker.reload();
    await pageHasSettled(maker);
    await expect(maker.getByText("No wishlists yet")).toBeVisible();
  } finally {
    await makerContext.close();
  }
});

test("signed in, Wishlist in the feed and on the maker's page changes in place, with no new page", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.goto("/sign-up");
  await finishSignUpForm(page, freshNumber());
  await expect(page).toHaveURL("/");
  await beforeLaunch(page.context());

  await page.goto("/");
  await pageHasSettled(page);
  const clip = clipOf(page, free.slug);
  await clip.scrollIntoViewIfNeeded();
  // Marked so a new page would lose it: the press must not load one.
  await page.evaluate(() => ((window as unknown as { stayed: boolean }).stayed = true));
  await wishlist(clip).click();
  await expect(onList(clip)).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { stayed?: boolean }).stayed)).toBe(true);
  await expect(page).toHaveURL("/");

  // The game's own page reads the same list.
  await page.goto(`/g/${free.slug}`);
  await pageHasSettled(page);
  await expect(onList(page)).toBeVisible();

  // With the keyboard alone: focus the button and press Enter.
  await onList(page).focus();
  await page.keyboard.press("Enter");
  await expect(wishlist(page)).toBeVisible();
  await expect(wishlist(page)).toBeFocused();

  await page.goto(`/${handle}`);
  await pageHasSettled(page);
  const listed = makerGameOf(page, game.name);
  await wishlist(listed).click();
  await expect(onList(listed)).toBeVisible();
  await page.reload();
  await pageHasSettled(page);
  await expect(onList(makerGameOf(page, game.name))).toBeVisible();
  await onList(makerGameOf(page, game.name)).click();
  await expect(wishlist(makerGameOf(page, game.name))).toBeVisible();
});

test("with no script, Wishlist is a plain form that comes back to the same game", async ({ page, browser }) => {
  test.setTimeout(90_000);
  await page.goto("/sign-up");
  await finishSignUpForm(page, freshNumber());
  await expect(page).toHaveURL("/");
  const context = await browser.newContext({
    baseURL: "http://localhost:4173",
    javaScriptEnabled: false,
    storageState: await page.context().storageState(),
  });
  try {
    await beforeLaunch(context);
    const plain = await context.newPage();
    await plain.goto(`/g/${free.slug}`);
    await wishlist(plain).click();
    await expect(plain).toHaveURL(`/g/${free.slug}`);
    await expect(onList(plain)).toBeVisible();
    await onList(plain).click();
    await expect(plain).toHaveURL(`/g/${free.slug}`);
    await expect(wishlist(plain)).toBeVisible();
  } finally {
    await context.close();
  }
});
