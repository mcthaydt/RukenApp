import { expect, test, type Browser, type Page } from "@playwright/test";
import {
  fillBirthDate,
  freshNumber,
  JOURNEY_PASSWORD,
  nationalOf,
  pageHasSettled,
  signInAs,
  SITE_ANSWER_TIMEOUT,
  yearsAgo,
} from "./support/account.ts";
import { changeGame, forgetAgeOf, givePage, playOf, stateOf } from "./support/database.ts";
import { addGame } from "./support/game.ts";
import { showTheOwner } from "./support/look.ts";
import { codeTo } from "./support/texts.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";
import { clearCookiesKeepingConsent, consented } from "./support/consent.ts";

// An 18+ game is only for people Ruken knows are 18 or over. Everyone else (signed out, under 18, or with no age on
// their account) meets the same refusal on every address that shows or plays it: its page, its play screen, the price
// card that plays its video behind it, and the other games listed on its maker's games. Nothing on the refusal names
// the game or shows its video.

const SIGN_IN_TO_PLAY = "Sign in to play it.";
const TOO_YOUNG = "You need to be 18 or older to play it.";

let adultsGame: Awaited<ReturnType<typeof addGame>>;
let everyonesGame: Awaited<ReturnType<typeof addGame>>;
let handle: string;

test.beforeAll(async ({ browser, request }) => {
  test.setTimeout(180_000);
  // Two makers sign up here, before any beforeEach has cleared this worker's sign-up count.
  await forgetRateLimits();
  adultsGame = await addGame(browser, request, { free: true });
  await changeGame(adultsGame.slug, { ageRating: "age_18", contentMarks: ["gore"] });
  // A 12+ game by the same maker, whose page lists the maker's other games.
  everyonesGame = await addGame(browser, request, { free: true });
  await changeGame(everyonesGame.slug, { makerUserId: adultsGame.makerUserId });
  ({ handle } = await givePage(adultsGame.maker, { name: "Grown-up maker", oneLine: "I make games." }));
});
test.beforeEach(forgetRateLimits);

/** Makes an account of this age through the sign-up form, signed in afterwards. */
async function signUpAged(page: Page, years: number): Promise<{ number: string; password: string }> {
  const number = freshNumber();
  await page.goto("/sign-up");
  await page.getByLabel("Phone number").fill(nationalOf(number));
  await page.getByLabel("Password").fill(JOURNEY_PASSWORD);
  await fillBirthDate(page, yearsAgo(years));
  await page.getByRole("button", { name: "Text me a code" }).click({ timeout: SITE_ANSWER_TIMEOUT });
  await expect(page.getByRole("heading", { name: "We texted you a code" })).toBeVisible();
  await pageHasSettled(page);
  await page.getByLabel("The code we texted you").fill(await codeTo(number));
  await page.getByRole("button", { name: "Join Ruken" }).click();
  await expect(page).toHaveURL("/");
  await pageHasSettled(page);
  return { number, password: JOURNEY_PASSWORD };
}

/** Makes an account of this age in a browser of its own and closes it, so the journey's own browser stays signed out. */
async function signUpAgedElsewhere(
  browser: Browser,
  years: number,
): Promise<{ number: string; password: string }> {
  const context = await browser.newContext({ ...consented, baseURL: "http://localhost:4173" });
  try {
    return await signUpAged(await context.newPage(), years);
  } finally {
    await context.close();
  }
}

/** On the refusal, presses "Sign in" and signs in there with this account. */
async function signInFromTheRefusal(
  page: Page,
  account: { number: string; password: string },
): Promise<void> {
  await page.getByRole("link", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sign in");
  await page.getByLabel("Phone number").fill(nationalOf(account.number));
  await page.getByLabel("Password").fill(account.password);
  await page.getByRole("button", { name: "Sign in" }).click({ timeout: SITE_ANSWER_TIMEOUT });
}

/**
 * Opens an address and waits until that page has settled before answering its status. Opening the next address while
 * this one still loads can interrupt it in WebKit ("Frame load interrupted": run 44952978631, `pageHasSettled`).
 */
async function statusOf(page: Page, path: string): Promise<number | undefined> {
  const response = await page.goto(path, { waitUntil: "domcontentloaded" });
  await pageHasSettled(page);
  return response?.status();
}

/** The maker, signed in in a browser of its own, takes the game off Ruken with the real button. */
async function takeOffAsMaker(
  browser: Browser,
  maker: { number: string; password: string },
  slug: string,
): Promise<void> {
  const context = await browser.newContext({ ...consented, baseURL: "http://localhost:4173" });
  try {
    const page = await context.newPage();
    await signInAs(page, maker.number, maker.password);
    await page.goto(`/make/${slug}/take-off`);
    await pageHasSettled(page);
    await page.getByRole("button", { name: "Take it off Ruken" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Taken off Ruken");
  } finally {
    await context.close();
  }
}

/** Every address that shows or plays the 18+ game refuses this person, and none shows its name or its video. */
async function expectRefusedEverywhere(page: Page, words: string): Promise<void> {
  const shown = await page.goto(`/g/${adultsGame.slug}`, { waitUntil: "domcontentloaded" });
  expect(shown?.status()).toBe(403);
  await pageHasSettled(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("This game is only for adults.");
  await expect(page.getByText(words)).toBeVisible();
  await expect(page.getByText(adultsGame.name)).toHaveCount(0);
  await expect(page.locator("video")).toHaveCount(0);

  // Play is refused before a play is started, so no pass to the game's files is ever made.
  const played = await page.goto(`/g/${adultsGame.slug}/play`, { waitUntil: "domcontentloaded" });
  expect(played?.status()).toBe(403);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("This game is only for adults.");
  await expect(page.locator("iframe")).toHaveCount(0);

  // The price card plays the game it came from behind it: not this one.
  await page.goto(`/join?next=${encodeURIComponent(`/g/${adultsGame.slug}/play`)}`, {
    waitUntil: "domcontentloaded",
  });
  await pageHasSettled(page);
  await expect(page.locator("video")).toHaveCount(0);

  // The maker's other game lists its other games, but not this one.
  await page.goto(`/g/${everyonesGame.slug}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(everyonesGame.name);
  await expect(page.locator(`a[href="/g/${adultsGame.slug}"]`)).toHaveCount(0);

  // The maker's page and the feed leave it out too.
  await page.goto(`/${handle}`, { waitUntil: "domcontentloaded" });
  await expect(page.locator(`a[href="/g/${everyonesGame.slug}"]`).first()).toBeVisible();
  await expect(page.locator(`a[href="/g/${adultsGame.slug}"]`)).toHaveCount(0);
}

test("a visitor who is not signed in cannot see or play an 18+ game, and is asked to sign in", async ({
  page,
}, testInfo) => {
  const before = (await playOf(adultsGame.slug)).sessions.length;
  await expectRefusedEverywhere(page, SIGN_IN_TO_PLAY);
  expect((await playOf(adultsGame.slug)).sessions.length).toBe(before);

  await page.goto(`/g/${adultsGame.slug}`, { waitUntil: "domcontentloaded" });
  await pageHasSettled(page);
  await showTheOwner(page, testInfo, "an 18+ game, to someone not signed in");
  // One button, reached by keyboard straight after the bar's three places, with focus showing.
  const signIn = page.getByRole("link", { name: "Sign in" });
  await expect(signIn).toHaveCount(1);
  for (let presses = 0; presses < 4; presses += 1) await page.keyboard.press("Tab");
  await expect(signIn).toBeFocused();
  expect(await signIn.evaluate((link) => getComputedStyle(link).outlineStyle)).not.toBe("none");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(`/sign-in?next=${encodeURIComponent(`/g/${adultsGame.slug}`)}`);
});

test("an adult who signs in from the refusal lands back on the 18+ game, on its page or its play screen", async ({
  page,
  browser,
}) => {
  const adult = await signUpAgedElsewhere(browser, 30);

  await page.goto(`/g/${adultsGame.slug}`, { waitUntil: "domcontentloaded" });
  await pageHasSettled(page);
  await signInFromTheRefusal(page, adult);
  await expect(page).toHaveURL(`/g/${adultsGame.slug}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(adultsGame.name);

  // Signed out again, the play screen's refusal sends them back to the play screen, and the game starts.
  await clearCookiesKeepingConsent(page.context());
  await page.goto(`/g/${adultsGame.slug}/play`, { waitUntil: "domcontentloaded" });
  await pageHasSettled(page);
  await signInFromTheRefusal(page, adult);
  await expect(page).toHaveURL(`/g/${adultsGame.slug}/play`);
  await expect(page.frameLocator("iframe.frame").locator("body")).toHaveAttribute("data-loaded", "yes");

  // An address on another site is never followed: signing in from it lands on Ruken's front page.
  await clearCookiesKeepingConsent(page.context());
  await page.goto(`/sign-in?next=${encodeURIComponent("https://evil.example/")}`, {
    waitUntil: "domcontentloaded",
  });
  await pageHasSettled(page);
  await page.getByLabel("Phone number").fill(nationalOf(adult.number));
  await page.getByLabel("Password").fill(adult.password);
  await page.getByRole("button", { name: "Sign in" }).click({ timeout: SITE_ANSWER_TIMEOUT });
  await expect(page).toHaveURL("/");
});

test("a person under 18 who signs in from the refusal lands on the same refusal, with one way out", async ({
  page,
  browser,
}) => {
  const young = await signUpAgedElsewhere(browser, 15);

  await page.goto(`/g/${adultsGame.slug}`, { waitUntil: "domcontentloaded" });
  await pageHasSettled(page);
  await signInFromTheRefusal(page, young);
  await expect(page).toHaveURL(`/g/${adultsGame.slug}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("This game is only for adults.");
  await expect(page.getByText(TOO_YOUNG)).toBeVisible();
  // No "Sign in" to go round again: the one way out is back to Ruken.
  await expect(page.getByRole("link", { name: "Sign in" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Back to Ruken" })).toHaveAttribute("href", "/");
});

/** The feed has loaded (a clip, or its empty words) and the 18+ game is not among its clips, by name or by address. */
async function expectNotInTheFeed(page: Page): Promise<void> {
  await page.goto("/");
  await expect(
    page.locator("section[data-slug]").first().or(page.getByText("No games here yet.")),
  ).toBeAttached();
  await pageHasSettled(page);
  await expect(page.locator(`section[data-slug="${adultsGame.slug}"]`)).toHaveCount(0);
  await expect(page.getByText(adultsGame.name)).toHaveCount(0);
}

test("an 18+ game is not in the feed for a visitor, a person under 18, a person of unknown age, or an adult", async ({
  page,
  browser,
}) => {
  await expectNotInTheFeed(page);

  // Each person has a browser of their own, so one's sign-in never carries to the next.
  for (const years of [15, 30, 18]) {
    const context = await browser.newContext({ ...consented, baseURL: "http://localhost:4173" });
    try {
      const person = await context.newPage();
      const account = await signUpAged(person, years);
      if (years === 30) await forgetAgeOf(account.number);
      await expectNotInTheFeed(person);
    } finally {
      await context.close();
    }
  }
});

test("a person under 18 cannot see or play an 18+ game", async ({ page }, testInfo) => {
  await signUpAged(page, 15);
  const before = (await playOf(adultsGame.slug)).sessions.length;
  await expectRefusedEverywhere(page, TOO_YOUNG);
  expect((await playOf(adultsGame.slug)).sessions.length).toBe(before);

  await page.goto(`/g/${adultsGame.slug}`, { waitUntil: "domcontentloaded" });
  await pageHasSettled(page);
  await showTheOwner(page, testInfo, "an 18+ game, to someone under 18");
  await expect(page.getByRole("link", { name: "Back to Ruken" })).toHaveAttribute("href", "/");
});

test("a person whose age Ruken does not know cannot see or play an 18+ game", async ({ page }) => {
  const account = await signUpAged(page, 30);
  await forgetAgeOf(account.number);
  await expectRefusedEverywhere(page, TOO_YOUNG);
});

test("a person of 18 sees and plays an 18+ game, and finds it among its maker's games", async ({ page }) => {
  await signUpAged(page, 18);
  await page.goto(`/g/${adultsGame.slug}`, { waitUntil: "domcontentloaded" });
  await pageHasSettled(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(adultsGame.name);
  await expect(page.locator(".chip")).toHaveText("18+ · Gore");

  await page.goto(`/g/${everyonesGame.slug}`, { waitUntil: "domcontentloaded" });
  await expect(page.locator(`.more a[href="/g/${adultsGame.slug}"]`)).toHaveCount(1);

  const played = await page.goto(`/g/${adultsGame.slug}/play`, { waitUntil: "domcontentloaded" });
  expect(played?.status()).toBe(200);
  await expect(page.frameLocator("iframe.frame").locator("body")).toHaveAttribute("data-loaded", "yes");
  const sessions = (await playOf(adultsGame.slug)).sessions;
  expect(sessions.at(-1)?.userId).not.toBeNull();
});

test("changing a game's rating opens it to under-18s and closes it again, and taking it off closes it to everyone", async ({
  page,
  browser,
  request,
}) => {
  const game = await addGame(browser, request, { free: true });
  await signUpAged(page, 15);

  // Made: a 12+ game is open to a person under 18.
  expect(await statusOf(page, `/g/${game.slug}`)).toBe(200);
  // Changed to 18+: closed to them, at once.
  await changeGame(game.slug, { ageRating: "age_18", contentMarks: ["none"] });
  expect(await statusOf(page, `/g/${game.slug}`)).toBe(403);
  expect(await statusOf(page, `/g/${game.slug}/play`)).toBe(403);
  // Changed back to 12+: open again.
  await changeGame(game.slug, { ageRating: "age_12", contentMarks: [] });
  expect(await statusOf(page, `/g/${game.slug}`)).toBe(200);
  expect(await statusOf(page, `/g/${game.slug}/play`)).toBe(200);

  // Taken off: missing for everyone, whatever their age.
  await changeGame(game.slug, { ageRating: "age_18", contentMarks: ["none"] });
  await takeOffAsMaker(browser, game.maker, game.slug);
  expect(await stateOf(game.slug)).toBe("taken_off");
  expect(await statusOf(page, `/g/${game.slug}`)).toBe(404);
  const adult = await browser.newContext({ ...consented, baseURL: "http://localhost:4173" });
  try {
    const adultPage = await adult.newPage();
    await signUpAged(adultPage, 30);
    expect(await statusOf(adultPage, `/g/${game.slug}`)).toBe(404);
  } finally {
    await adult.close();
  }
});
