import { expect, test, type BrowserContext, type Locator, type Page } from "@playwright/test";
import {
  JOURNEY_PASSWORD,
  nationalOf,
  pageHasSettled,
  SITE_ANSWER_TIMEOUT,
  signUp,
  signUpInItsOwnContext,
} from "./support/account.ts";
import { consented, NOT_CONSENTED } from "./support/consent.ts";
import { gameWhere } from "./support/game.ts";
import { showTheOwner } from "./support/look.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

// Like, Save and Repost on a clip, and Saved and Your reposts on You (learned-feed spec, unit G): a player makes each
// mark, sees it again after a reload and on its list, and takes it back from the feed and from the list. Signed out or
// without the cookie yes, the press waits for sign-in and "I agree" and is made on the way back; on their own game,
// nothing is kept.

const SITE = "http://localhost:4173";

let live: { slug: string; name: string };
/** The live game's maker, signed in, for the own-game journey. */
let makerContext: BrowserContext;

test.beforeAll(async ({ browser }) => {
  test.setTimeout(180_000);
  await forgetRateLimits();
  makerContext = await browser.newContext({ ...consented, baseURL: SITE });
  live = await gameWhere(await makerContext.newPage(), { state: "live" });
});
test.afterAll(async () => {
  await makerContext.close();
});
test.beforeEach(forgetRateLimits);

/** The game's clip on the feed, brought on screen, once the feed's script has started. */
async function clipOnFeed(page: Page, open = true): Promise<Locator> {
  if (open) await page.goto("/");
  await pageHasSettled(page);
  const clip = page.locator(`section[data-slug="${live.slug}"]`).first();
  await clip.scrollIntoViewIfNeeded();
  await expect(clip.getByRole("button", { name: "Share" })).toBeVisible();
  return clip;
}

const mark = (clip: Locator, name: "Like" | "Save" | "Repost") =>
  clip.getByRole("button", { name, exact: true });

/** Presses a mark and waits for the site to have kept it. */
async function press(clip: Locator, name: "Like" | "Save" | "Repost", page: Page): Promise<void> {
  const kept = page.waitForResponse((answer) => answer.url().endsWith("/api/feed/marks"));
  await mark(clip, name).click();
  expect((await kept).status()).toBe(200);
}

test("a player likes, saves and reposts a clip, sees each again, and takes each back from the feed and from You", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await signUp(page);

  // Create.
  let clip = await clipOnFeed(page);
  await expect(mark(clip, "Like")).toHaveAttribute("aria-pressed", "false");
  const likesBefore = Number((await mark(clip, "Like").locator(".word").textContent())?.replace("Like", "0"));
  await press(clip, "Like", page);
  await press(clip, "Save", page);
  await press(clip, "Repost", page);
  for (const name of ["Like", "Save", "Repost"] as const)
    await expect(mark(clip, name)).toHaveAttribute("aria-pressed", "true");
  await expect(mark(clip, "Like").locator(".word")).toHaveText(String(likesBefore + 1));
  await showTheOwner(page, testInfo, "a clip liked, saved and reposted");

  // Read: a fresh feed shows the same, and the lists on You hold the game.
  clip = await clipOnFeed(page);
  for (const name of ["Like", "Save", "Repost"] as const)
    await expect(mark(clip, name)).toHaveAttribute("aria-pressed", "true");
  await expect(mark(clip, "Like").locator(".word")).toHaveText(String(likesBefore + 1));

  await page.goto("/me");
  await page.getByRole("link", { name: "Saved" }).click();
  await expect(page).toHaveURL("/me/saved");
  await expect(page.getByRole("heading", { name: "Saved" })).toBeVisible();
  await expect(page.getByRole("link", { name: new RegExp(live.name) })).toBeVisible();
  await showTheOwner(page, testInfo, "Saved");
  await page.goto("/me");
  await page.getByRole("link", { name: "Your reposts" }).click();
  await expect(page.getByRole("heading", { name: "Your reposts" })).toBeVisible();
  await expect(page.getByRole("link", { name: new RegExp(live.name) })).toBeVisible();

  // Delete from the list: the repost goes, and the feed shows it gone.
  await page.getByRole("button", { name: `Remove ${live.name}` }).click();
  await expect(page.getByRole("status")).toHaveText("Removed.");
  await expect(page.getByRole("link", { name: new RegExp(live.name) })).toHaveCount(0);
  await expect(page.getByText("No reposts yet.", { exact: false })).toBeVisible();

  // Delete from the feed: the like and the save go back, and the count with them.
  clip = await clipOnFeed(page);
  await expect(mark(clip, "Repost")).toHaveAttribute("aria-pressed", "false");
  await press(clip, "Like", page);
  await press(clip, "Save", page);
  await expect(mark(clip, "Like")).toHaveAttribute("aria-pressed", "false");
  await expect(mark(clip, "Save")).toHaveAttribute("aria-pressed", "false");
  await expect(mark(clip, "Like").locator(".word")).toHaveText(
    likesBefore === 0 ? "Like" : String(likesBefore),
  );
  await page.goto("/me/saved");
  await expect(page.getByText("Nothing saved yet.", { exact: false })).toBeVisible();
});

test("the marks work with the keyboard alone, with a visible focus ring", async ({ page }) => {
  await signUp(page);
  const clip = await clipOnFeed(page);
  await mark(clip, "Save").focus();
  await expect(mark(clip, "Save")).toBeFocused();
  const ring = await mark(clip, "Save").evaluate((button) => getComputedStyle(button).outlineStyle);
  expect(ring).not.toBe("none");
  const kept = page.waitForResponse((answer) => answer.url().endsWith("/api/feed/marks"));
  await page.keyboard.press("Enter");
  expect((await kept).status()).toBe(200);
  await expect(mark(clip, "Save")).toHaveAttribute("aria-pressed", "true");
  // A second press waits for the first to come back (the button says so while it is sent).
  await expect(mark(clip, "Save")).not.toHaveAttribute("aria-disabled", "true");
  await page.keyboard.press("Enter");
  await expect(mark(clip, "Save")).toHaveAttribute("aria-pressed", "false");
});

/** Signs in on the sign-in screen the press was sent to, as a person would. */
async function signInHere(page: Page, number: string): Promise<void> {
  await page.getByLabel("Phone number").fill(nationalOf(number));
  await page.getByLabel("Password").fill(JOURNEY_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click({ timeout: SITE_ANSWER_TIMEOUT });
}

test("signed out, a press goes to sign in, and once signed in the press is made on that game", async ({
  page,
  browser,
}) => {
  test.setTimeout(90_000);
  const { number } = await signUpInItsOwnContext(browser);
  let clip = await clipOnFeed(page);
  await mark(clip, "Like").click();
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fme%2Fpress%3F/);
  // Signed out, the site itself keeps nothing for a press: it only says where to sign in.
  const answer = await page.request.post("/api/feed/marks", {
    data: { game: live.slug, kind: "like", on: true },
  });
  expect(answer.status()).toBe(401);
  await signInHere(page, number);
  await expect(page).toHaveURL(`/?at=${live.slug}`);
  clip = await clipOnFeed(page, false);
  await expect(mark(clip, "Like")).toHaveAttribute("aria-pressed", "true");
  await expect(mark(clip, "Save")).toHaveAttribute("aria-pressed", "false");
});

test("a link to the way back presses nothing that the person did not press", async ({ page }) => {
  await signUp(page);
  await page.goto(`/me/press?game=${live.slug}&kind=like`);
  await expect(page).toHaveURL(`/?at=${live.slug}`);
  const clip = await clipOnFeed(page, false);
  await expect(mark(clip, "Like")).toHaveAttribute("aria-pressed", "false");
});

test("a maker's own clip has no Like, Save or Repost, and the site refuses one", async () => {
  const page = await makerContext.newPage();
  try {
    const clip = await clipOnFeed(page);
    for (const name of ["Like", "Save", "Repost"] as const) await expect(mark(clip, name)).toHaveCount(0);
    const answer = await page.request.post("/api/feed/marks", {
      data: { game: live.slug, kind: "save", on: true },
    });
    expect(answer.status()).toBe(403);
  } finally {
    await page.close();
  }
});

test("the site believes nothing a press sends that is not a press", async ({ page }) => {
  await signUp(page);
  for (const data of [{ game: live.slug, kind: "follow", on: true }, { game: live.slug, kind: "like" }, {}]) {
    expect((await page.request.post("/api/feed/marks", { data })).status()).toBe(400);
  }
  // A form from another site is refused by SvelteKit before this route; one from Ruken's own page is still not JSON.
  const fromElsewhere = await page.request.post("/api/feed/marks", {
    form: { game: live.slug, kind: "like", on: "true" },
  });
  expect(fromElsewhere.status()).toBe(403);
  const notJson = await page.request.post("/api/feed/marks", {
    form: { game: live.slug, kind: "like", on: "true" },
    headers: { origin: SITE },
  });
  expect(notJson.status()).toBe(415);
  const missing = await page.request.post("/api/feed/marks", {
    data: { game: "no-such-game-here", kind: "like", on: true },
  });
  expect(missing.status()).toBe(404);
});

test.describe("without the cookie yes", () => {
  test.use({ storageState: NOT_CONSENTED });

  /** The feed with the cookie card put away, as a person on a small phone does to reach the buttons under it. */
  async function feedWithoutCard(page: Page): Promise<Locator> {
    const clip = await clipOnFeed(page);
    await page.getByRole("button", { name: "Not now" }).click();
    return clip;
  }

  for (const [name, words] of [
    ["Like", "To like this game"],
    ["Save", "To save this game"],
    ["Repost", "To repost this game"],
  ] as const) {
    test(`${name} opens the cookie notice, which says what it is for, and keeps nothing`, async ({
      page,
    }) => {
      const clip = await feedWithoutCard(page);
      await mark(clip, name).click();
      await expect(page).toHaveURL(/\/cookies\?for=/);
      await expect(page.getByText(words, { exact: false })).toBeVisible();
      const answer = await page.request.post("/api/feed/marks", {
        data: { game: live.slug, kind: name.toLowerCase(), on: true },
      });
      expect(answer.status()).toBe(403);
    });
  }

  test('"I agree" carries on to sign in and to the press, which shows on the feed and on Saved', async ({
    page,
    browser,
  }) => {
    test.setTimeout(90_000);
    const { number } = await signUpInItsOwnContext(browser);
    let clip = await feedWithoutCard(page);
    await mark(clip, "Save").click();
    await expect(page.getByText("To save this game", { exact: false })).toBeVisible();
    await page.getByRole("button", { name: "I agree" }).click();
    await expect(page).toHaveURL(/\/sign-in\?next=%2Fme%2Fpress%3F/);
    await signInHere(page, number);
    await expect(page).toHaveURL(`/?at=${live.slug}`);
    clip = await clipOnFeed(page, false);
    await expect(mark(clip, "Save")).toHaveAttribute("aria-pressed", "true");
    await page.goto("/me/saved");
    await expect(page.getByRole("link", { name: new RegExp(live.name) })).toBeVisible();
  });
});
