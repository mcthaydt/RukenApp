import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  fillBirthDate,
  finishSignUpForm,
  freshNumber,
  JOURNEY_PASSWORD,
  nameFor,
  nationalOf,
  pageHasSettled,
  signInAs,
  signUp,
  yearsAgo,
} from "./support/account.ts";
import { consented } from "./support/consent.ts";
import { followsOf, makeFriends, pageOfNumber, removePage } from "./support/database.ts";
import { addGame } from "./support/game.ts";
import { asInstalled } from "./support/installed.ts";
import { PAD, padReachesEverything, plugInPad, pressPad } from "./support/pad.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";
import { codeTo } from "./support/texts.ts";

// The name friends see (name-and-friend-address-at-sign-up design): asked once, right after the code, it makes the
// account's page, unlisted, at an address made from the name. An account with no page meets the question before any
// screen where people meet it, and can always sign out or delete the account from it.

const SITE = "http://localhost:4173";

/** The address rules (src/features/pages/handle.ts): letter and digit runs joined by single hyphens, 3 to 30 long. */
const ADDRESS = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const question = (page: Page) => page.getByRole("heading", { name: "What should friends call you?" });
const nameField = (page: Page) => page.getByLabel("Your name");
const save = (page: Page) => page.getByRole("button", { name: "Save", exact: true });

let game: Awaited<ReturnType<typeof addGame>>;
let makerName: string;
let makerHandle: string;

test.beforeAll(async ({ browser, request }) => {
  test.setTimeout(240_000);
  await forgetRateLimits();
  // A live game whose maker only signed up: their page is the unlisted one the question made.
  game = await addGame(browser, request);
  makerName = nameFor(game.maker.number);
  const page = await pageOfNumber(game.maker.number);
  if (page === null) throw new Error("sign-up made no page");
  makerHandle = page.handle;
});
test.beforeEach(async ({ page }) => {
  await forgetRateLimits();
  await asInstalled(page);
});

/** Goes through sign-up by hand, born `years` ago, up to and including "Join Ruken". */
async function signUpBornYearsAgo(page: Page, years: number): Promise<string> {
  const number = freshNumber();
  await page.goto("/sign-up");
  await page.getByLabel("Phone number").fill(nationalOf(number));
  await page.getByLabel("Password").fill(JOURNEY_PASSWORD);
  await fillBirthDate(page, yearsAgo(years));
  await page.getByRole("button", { name: "Text me a code" }).click();
  await expect(page.getByRole("heading", { name: "We texted you a code" })).toBeVisible();
  await pageHasSettled(page);
  await page.getByLabel("The code we texted you").fill(await codeTo(number));
  await page.getByRole("button", { name: "Join Ruken" }).click();
  await expect(question(page)).toBeVisible();
  return number;
}

test("right after the code, the name makes one unlisted page at a good address, then the feed", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const number = await signUpBornYearsAgo(page, 30);
  // An adult is told what the name is for, and not asked for a nickname.
  await expect(page.getByText("Friends see this when you send them a game.")).toBeVisible();
  await expect(page.getByText("Use a nickname, not your full name.")).toHaveCount(0);
  expect(await pageOfNumber(number)).toBeNull();

  // An empty name and a long one are refused, in words, and nothing is made.
  await pageHasSettled(page);
  await nameField(page).fill("   ");
  await save(page).click();
  await expect(page.getByRole("alert")).toHaveText("Type a name.");
  await nameField(page).fill("x".repeat(41));
  await save(page).click();
  await expect(page.getByRole("alert")).toHaveText("A name can be up to 40 characters.");
  expect(await pageOfNumber(number)).toBeNull();

  await nameField(page).fill("Zoë Night-Owl!");
  await save(page).click();
  await expect(page).toHaveURL("/");
  const made = await pageOfNumber(number);
  expect(made).toMatchObject({ name: "Zoë Night-Owl!", listed: false });
  expect(made?.handle).toMatch(ADDRESS);
  expect(made?.handle.length).toBeGreaterThanOrEqual(3);
  expect(made?.handle.length).toBeLessThanOrEqual(30);
});

test("someone not known to be 18 or over is asked for a nickname", async ({ page }) => {
  test.setTimeout(90_000);
  const number = await signUpBornYearsAgo(page, 15);
  await expect(page.getByText("Use a nickname, not your full name. Friends see it.")).toBeVisible();
  await expect(page.getByText("Friends see this when you send them a game.")).toHaveCount(0);
  await pageHasSettled(page);
  await nameField(page).fill("Pip");
  await save(page).click();
  await expect(page).not.toHaveURL(/\/me\/name/);
  expect(await pageOfNumber(number)).toMatchObject({ name: "Pip", listed: false });
});

test("an account with no page meets the question before a people screen, by address or by a tap, then goes on", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const player = await signUp(page);
  await removePage(player);

  // By address: the question carries where they were going, and Save lands there.
  await page.goto("/your-turn");
  await expect(page).toHaveURL("/me/name?next=%2Fyour-turn");
  await expect(question(page)).toBeVisible();

  // The open screens stay open, the question itself included.
  for (const open of ["/help", "/privacy", "/me/delete", "/me/password", "/me/name"]) {
    await page.goto(open);
    await expect(page, open).toHaveURL(open);
  }

  // By a tap from an open screen: Home on the bar lands on the question too.
  await page.goto("/help");
  await pageHasSettled(page);
  await page
    .getByRole("navigation", { name: "Ruken" })
    .getByRole("link", { name: "Home", exact: true })
    .click();
  await expect(question(page)).toBeVisible();
  await expect(page).toHaveURL(/\/me\/name\?next=%2F$/);

  await page.goto("/your-turn");
  await pageHasSettled(page);
  await nameField(page).fill("Came Back");
  await save(page).click();
  await expect(page).toHaveURL("/your-turn");
  expect(await pageOfNumber(player.number)).toMatchObject({ name: "Came Back", listed: false });
  // Asked once: with a page, the feed opens as it is.
  await page.goto("/");
  await expect(page).toHaveURL("/");
});

/** Signs a person up, takes their page away, and opens the question with its two ways out. */
async function atTheQuestionWithNoPage(page: Page): Promise<{ number: string }> {
  const player = await signUp(page);
  await removePage(player);
  await page.goto("/me/name");
  await pageHasSettled(page);
  return player;
}

async function isSignedOut(page: Page): Promise<void> {
  await page.goto("/me");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fme$/);
}

test("from the question, Sign out works with the keyboard", async ({ page }) => {
  test.setTimeout(90_000);
  await atTheQuestionWithNoPage(page);
  const signOut = page.getByRole("button", { name: "Sign out" });
  await signOut.focus();
  await page.keyboard.press("Enter");
  await expect(page).not.toHaveURL(/\/me\/name$/);
  await isSignedOut(page);
});

test("from the question, Sign out works with a gamepad, and the pad reaches every control", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await plugInPad(page);
  await atTheQuestionWithNoPage(page);
  await padReachesEverything(page);
  await page.getByRole("button", { name: "Sign out" }).focus();
  await pressPad(page, PAD.a);
  await expect(page).not.toHaveURL(/\/me\/name$/);
  await isSignedOut(page);
});

test("from the question, Delete my account opens the delete screen", async ({ page }) => {
  test.setTimeout(90_000);
  await atTheQuestionWithNoPage(page);
  await page.getByRole("link", { name: "Delete my account" }).click();
  await expect(page).toHaveURL("/me/delete");
  await expect(page.getByRole("button", { name: "Delete my account" })).toBeVisible();
});

test("the keyboard reaches the field and Save, with focus always showing", async ({ page }) => {
  test.setTimeout(90_000);
  await signUp(page);
  await page.goto("/me/name");
  await pageHasSettled(page);
  const seen: string[] = [];
  for (let press = 0; press < 12 && seen.length < 2; press += 1) {
    await page.keyboard.press("Tab");
    const focused = page.locator(":focus");
    const name = await focused.evaluate((one) =>
      one instanceof HTMLInputElement ? "field" : one.textContent.trim() === "Save" ? "save" : "",
    );
    if (name === "" || seen.includes(name)) continue;
    seen.push(name);
    const ring = await focused.evaluate((one) => {
      const style = getComputedStyle(one);
      return style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0;
    });
    expect(ring, `${name} shows its focus`).toBe(true);
  }
  expect(seen).toEqual(["field", "save"]);
  // Typing and Enter saves.
  await nameField(page).fill("Typed Name");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status")).toHaveText("Saved.");
});

test("an unlisted page's address is the missing page, for a visitor and its maker; search shows no maker row", async ({
  page,
  browser,
}) => {
  test.setTimeout(90_000);
  expect((await page.request.get(`/${makerHandle}`)).status()).toBe(404);
  const maker = await browser.newContext({ ...consented, baseURL: SITE });
  try {
    const makerPage = await maker.newPage();
    await asInstalled(makerPage);
    await signInAs(makerPage, game.maker.number, game.maker.password);
    expect((await makerPage.request.get(`/${makerHandle}`)).status()).toBe(404);
  } finally {
    await maker.close();
  }

  for (const words of [makerName, makerHandle, `@${makerHandle}`]) {
    await page.goto(`/search?q=${encodeURIComponent(words)}`);
    await expect(page.getByRole("heading", { name: "Makers" }), words).toHaveCount(0);
    await expect(page.locator(`a[href="/${makerHandle}"]`), words).toHaveCount(0);
  }
  // The game itself still shows, with the maker's name as words.
  await page.goto(`/search?q=${encodeURIComponent(makerName)}`);
  const row = page.locator("a.row.game", { hasText: game.name });
  await expect(row).toBeVisible();
  await expect(row).toContainText(`by ${makerName}`);
});

test("Your name on Your account changes the name friends see, and keeps the address", async ({
  page,
  browser,
}) => {
  test.setTimeout(120_000);
  const player = await signUp(page);
  const before = await pageOfNumber(player.number);
  await makeFriends(player, game.maker);

  await page.goto("/me");
  await page.getByRole("link", { name: "Your name" }).click();
  await expect(page).toHaveURL("/me/name");
  await expect(nameField(page)).toHaveValue(nameFor(player.number));
  await pageHasSettled(page);
  await nameField(page).fill("New Name Here");
  await save(page).click();
  await expect(page.getByRole("status")).toHaveText("Saved.");
  const after = await pageOfNumber(player.number);
  expect(after).toEqual({ handle: before?.handle, name: "New Name Here", listed: false });

  // The friend sees the new name on the share sheet's face and on what is sent to them.
  const friend = await browser.newContext({ ...consented, baseURL: SITE });
  try {
    const friendPage = await friend.newPage();
    await asInstalled(friendPage);
    await signInAs(friendPage, game.maker.number, game.maker.password);
    await page.goto(`/g/${game.slug}`, { waitUntil: "domcontentloaded" });
    await pageHasSettled(page);
    await page.getByRole("button", { name: "Share" }).click();
    const sheet = page.getByRole("dialog", { name: /^(Share|Send to friends)$/ });
    await sheet.getByRole("button", { name: "Your turn", exact: true }).click();
    await sheet.getByRole("button", { name: makerName, exact: true }).click();
    await sheet.getByRole("button", { name: "Send", exact: true }).click();
    await expect(sheet.getByRole("status")).toHaveText(`Sent to ${makerName}.`);

    await friendPage.goto("/your-turn");
    await pageHasSettled(friendPage);
    await expect(friendPage.locator("main.yourturn li").filter({ hasText: game.name })).toContainText(
      "From New Name Here",
    );
    // And the friend's own share sheet shows the new name on the face.
    await friendPage.goto(`/g/${game.slug}`, { waitUntil: "domcontentloaded" });
    await pageHasSettled(friendPage);
    await friendPage.getByRole("button", { name: "Share" }).click();
    const theirs = friendPage.getByRole("dialog", { name: /^(Share|Send to friends)$/ });
    await theirs.getByRole("button", { name: "Your turn", exact: true }).click();
    await expect(theirs.getByRole("button", { name: "New Name Here", exact: true })).toBeVisible();
  } finally {
    await friend.close();
  }
});

/** The follow plus on the clip of the game whose maker only signed up. */
async function plusOn(page: Page): Promise<Locator> {
  await page.goto("/");
  await expect(page.locator("main.feed")).toHaveAttribute("data-ready", "true");
  const clip = page.locator(`section[data-slug="${game.slug}"]`).first();
  await clip.scrollIntoViewIfNeeded();
  return clip.getByRole("button", { name: `Follow ${makerName}` });
}

test("signed out, the plus on an unlisted maker's clip signs you up, asks the name, and comes back following", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await (await plusOn(page)).click();
  await expect(page).toHaveURL(/\/sign-up\?next=/);
  await pageHasSettled(page);
  const number = freshNumber();
  await finishSignUpForm(page, number);
  await expect(page).toHaveURL("/");
  await pageHasSettled(page);
  expect(await followsOf(number)).toEqual([makerHandle]);
  await expect(await plusOn(page)).toHaveAttribute("aria-pressed", "true");
  expect((await page.request.get(`/${makerHandle}`)).status()).toBe(404);
});
