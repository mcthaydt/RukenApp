import { expect, test, type Browser, type Locator, type Page } from "@playwright/test";
import { finishSignUpForm, freshNumber, pageHasSettled, signInAs, signUp } from "./support/account.ts";
import { consented } from "./support/consent.ts";
import { changeGame, followsOf, givePage } from "./support/database.ts";
import { addGame, gameWhere } from "./support/game.ts";
import { asInstalled } from "./support/installed.ts";
import { boxOf, showTheOwner } from "./support/look.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

// Follow a maker (maker-credit-and-follow spec): the maker's picture and name sit at the top of the right-hand column
// of every clip, with a plus over the picture. The plus follows them and turns into a check; the check unfollows.

const SITE = "http://localhost:4173";
/** A form posted from the site's own page carries its origin; SvelteKit refuses a form post from anywhere else. */
const FROM_THE_SITE = { headers: { origin: SITE } };

const MAKER = { name: "Wren Maker", oneLine: "Tiny puzzle games." };

let first: Awaited<ReturnType<typeof addGame>>;
let second: { slug: string };
let handle: string;

test.beforeAll(async ({ browser, request }) => {
  test.setTimeout(240_000);
  await forgetRateLimits();
  first = await addGame(browser, request);
  ({ handle } = await givePage(first.maker, MAKER));
  // A second live game by the same maker, so one press can be seen changing both clips.
  const context = await browser.newContext({ ...consented, baseURL: SITE });
  try {
    second = await gameWhere(await context.newPage(), { state: "live" });
  } finally {
    await context.close();
  }
  await changeGame(second.slug, { makerUserId: first.makerUserId });
});
test.beforeEach(async ({ page }) => {
  await forgetRateLimits();
  await asInstalled(page);
});

// The feed goes round, so a game can be on it more than once: the journeys look at its first clip.
const clipOf = (page: Page, slug: string) => page.locator(`section[data-slug="${slug}"]`).first();
const badgeOf = (clip: Locator) => clip.getByRole("button", { name: `Follow ${MAKER.name}` });

/** Opens the feed with its script running, and brings this game's clip to the screen. */
async function feedAt(page: Page, slug: string): Promise<Locator> {
  await page.goto("/");
  await expect(page.locator("main.feed")).toHaveAttribute("data-ready", "true");
  const clip = clipOf(page, slug);
  await clip.scrollIntoViewIfNeeded();
  return clip;
}

/** A second person, signed up in a context of their own, for as long as `use` runs. */
async function anotherPerson(browser: Browser, use: (page: Page) => Promise<void>): Promise<void> {
  const context = await browser.newContext({ ...consented, baseURL: SITE });
  try {
    const page = await context.newPage();
    await asInstalled(page);
    await signUp(page);
    await use(page);
  } finally {
    await context.close();
  }
}

test("a player follows a maker with the plus, sees it after a reload, and unfollows with the check", async ({
  page,
  browser,
}, testInfo) => {
  test.setTimeout(120_000);
  const player = await signUp(page);
  let clip = await feedAt(page, first.slug);

  // The credit: the picture and the name are one link to the maker's page, and the plus sits beside it, above Share.
  const credit = clip.locator(".credit");
  await expect(credit.getByRole("link", { name: MAKER.name })).toHaveAttribute("href", `/${handle}`);
  await expect(badgeOf(clip)).toHaveAttribute("aria-pressed", "false");
  const share = clip.getByRole("button", { name: "Share" });
  expect((await boxOf(credit)).y + (await boxOf(credit)).height).toBeLessThanOrEqual((await boxOf(share)).y);
  await showTheOwner(page, testInfo, "the maker credit and the plus");

  // Create.
  await badgeOf(clip).click();
  await expect(badgeOf(clip)).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => followsOf(player.number)).toEqual([handle]);
  // The maker's other clip changed with it.
  const otherClip = clipOf(page, second.slug);
  await expect(badgeOf(otherClip)).toHaveAttribute("aria-pressed", "true");
  await showTheOwner(page, testInfo, "the check, once followed");

  // Read: it is kept, not only drawn.
  clip = await feedAt(page, first.slug);
  await expect(badgeOf(clip)).toHaveAttribute("aria-pressed", "true");
  await expect(badgeOf(clipOf(page, second.slug))).toHaveAttribute("aria-pressed", "true");

  // Nobody else sees this person's follow.
  await anotherPerson(browser, async (theirs) => {
    const theirClip = await feedAt(theirs, first.slug);
    await expect(badgeOf(theirClip)).toHaveAttribute("aria-pressed", "false");
  });

  // Delete. A follow has nothing to change, so there is no update: following again makes a fresh row.
  await badgeOf(clip).click();
  await expect(badgeOf(clip)).toHaveAttribute("aria-pressed", "false");
  await expect.poll(() => followsOf(player.number)).toEqual([]);
  clip = await feedAt(page, first.slug);
  await expect(badgeOf(clip)).toHaveAttribute("aria-pressed", "false");
});

test("a maker sees no plus on their own clip, and the site refuses following their own page", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await signInAs(page, first.maker.number, first.maker.password);
  const clip = await feedAt(page, first.slug);
  await expect(clip.locator(".credit").getByRole("link", { name: MAKER.name })).toBeVisible();
  await expect(clip.locator(".credit button")).toHaveCount(0);

  const answer = await page.request.post(`/${handle}/follow`, {
    ...FROM_THE_SITE,
    form: { want: "on", back: "/" },
    maxRedirects: 0,
  });
  expect(answer.status()).toBe(400);

  // The way back from sign-up with the cookie naming their own page: a maker who pressed their own plus signed out,
  // then signed in. Nothing is followed.
  await page.context().addCookies([{ name: "rk_follow_pressed", value: handle, url: SITE }]);
  await page.goto(`/${handle}/follow?back=%2F`);
  await expect(page).toHaveURL("/");
  expect(await followsOf(first.maker.number)).toEqual([]);
});

test("signed out, the plus signs you up and brings you back following the maker", async ({ page }) => {
  test.setTimeout(90_000);
  let clip = await feedAt(page, first.slug);
  await badgeOf(clip).click();

  await expect(page).toHaveURL(/\/sign-up\?next=/);
  await pageHasSettled(page);
  const number = freshNumber();
  await finishSignUpForm(page, number);
  await expect(page).toHaveURL("/");
  await pageHasSettled(page);
  expect(await followsOf(number)).toEqual([handle]);
  clip = await feedAt(page, first.slug);
  await expect(badgeOf(clip)).toHaveAttribute("aria-pressed", "true");
});

test("going to the way back without pressing the plus follows nobody", async ({ page }) => {
  test.setTimeout(60_000);
  const player = await signUp(page);
  // A typed address, or a link someone put on a page: nobody pressed the plus.
  await page.goto(`/${handle}/follow?back=%2F`);
  await expect(page).toHaveURL("/");
  expect(await followsOf(player.number)).toEqual([]);
  // A handle with no page is a missing page.
  const missing = await page.request.post("/nobody-has-this-page/follow", {
    ...FROM_THE_SITE,
    form: { want: "on", back: "/" },
    maxRedirects: 0,
  });
  expect(missing.status()).toBe(404);
});

test("with no script, the plus is a plain form that comes back to the feed", async ({ page, browser }) => {
  test.setTimeout(90_000);
  const player = await signUp(page);
  const context = await browser.newContext({
    baseURL: SITE,
    javaScriptEnabled: false,
    storageState: await page.context().storageState(),
  });
  try {
    const plain = await context.newPage();
    await asInstalled(plain);
    // Without script there is no "settled" to wait for, so the screen's entrance is skipped, as reduced motion does.
    await plain.emulateMedia({ reducedMotion: "reduce" });
    await plain.goto("/");
    // Pressed from the keyboard: on a phone the fixed bar can sit over a button a mouse press scrolls to.
    await badgeOf(clipOf(plain, first.slug)).focus();
    await plain.keyboard.press("Enter");
    await expect(plain).toHaveURL("/");
    await expect(badgeOf(clipOf(plain, first.slug))).toHaveAttribute("aria-pressed", "true");
    expect(await followsOf(player.number)).toEqual([handle]);
    await badgeOf(clipOf(plain, first.slug)).focus();
    await plain.keyboard.press("Enter");
    await expect(badgeOf(clipOf(plain, first.slug))).toHaveAttribute("aria-pressed", "false");
    expect(await followsOf(player.number)).toEqual([]);
  } finally {
    await context.close();
  }
});

test("the plus works from the keyboard alone, with a ring you can see", async ({ page }) => {
  test.setTimeout(60_000);
  const player = await signUp(page);
  const clip = await feedAt(page, first.slug);
  const link = clip.locator(".credit").getByRole("link", { name: MAKER.name });
  await link.focus();
  await page.keyboard.press("Tab");
  await expect(badgeOf(clip)).toBeFocused();
  await expect(badgeOf(clip)).not.toHaveCSS("outline-style", "none");
  await page.keyboard.press("Enter");
  await expect(badgeOf(clip)).toHaveAttribute("aria-pressed", "true");
  await expect(badgeOf(clip)).toBeFocused();
  await page.keyboard.press("Space");
  await expect(badgeOf(clip)).toHaveAttribute("aria-pressed", "false");
  await expect.poll(() => followsOf(player.number)).toEqual([]);
  await page.keyboard.press("Tab");
  await expect(clip.getByRole("button", { name: "Share" })).toBeFocused();
});

test("when a follow fails, the plus stays as it was and says so", async ({ page }) => {
  test.setTimeout(60_000);
  const player = await signUp(page);
  const clip = await feedAt(page, first.slug);
  await page.route(`**/${handle}/follow`, (route) => route.fulfill({ status: 500, body: "no" }));
  await badgeOf(clip).click();
  await expect(clip.getByRole("alert")).toHaveText("That didn't work. Try again.");
  await expect(badgeOf(clip)).toHaveAttribute("aria-pressed", "false");
  expect(await followsOf(player.number)).toEqual([]);
});

test("the credit fits the column on every screen, held either way", async ({ page }) => {
  test.setTimeout(60_000);
  const sizes = [page.viewportSize(), { width: 667, height: 375 }];
  for (const size of sizes) {
    if (size === null) continue;
    await page.setViewportSize(size);
    const clip = await feedAt(page, first.slug);
    const badge = await boxOf(badgeOf(clip));
    expect(badge.width).toBeGreaterThanOrEqual(44);
    expect(badge.height).toBeGreaterThanOrEqual(44);
    const credit = await boxOf(clip.locator(".credit"));
    const share = await boxOf(clip.getByRole("button", { name: "Share" }));
    const where = `${String(size.width)}x${String(size.height)}`;
    // Above Share; on a phone held sideways, where the window is short, just left of it. Inside the window, at the right.
    if (size.height < 450 && size.width > size.height)
      expect(credit.x + credit.width, where).toBeLessThanOrEqual(share.x);
    else expect(credit.y + credit.height, where).toBeLessThanOrEqual(share.y);
    expect(credit.y + credit.height).toBeLessThanOrEqual(size.height);
    expect(credit.y).toBeGreaterThanOrEqual(0);
    expect(credit.x + credit.width).toBeLessThanOrEqual(size.width);
    expect(credit.x).toBeGreaterThan(size.width / 2);
    // Nothing in the column sits under the bar.
    const bar = page.locator("nav.bar").first();
    if ((await bar.count()) > 0) {
      const under = await boxOf(bar);
      const overlaps = (a: typeof credit, b: typeof credit) =>
        a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
      expect(overlaps(credit, under), where).toBe(false);
      expect(overlaps(share, under), where).toBe(false);
    }
  }
});
