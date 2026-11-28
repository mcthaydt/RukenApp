import { expect, test, type Browser, type BrowserContext, type Locator, type Page } from "@playwright/test";
import {
  finishSignUpForm,
  freshNumber,
  JOURNEY_PASSWORD,
  nationalOf,
  pageHasSettled,
  signUp,
  signUpInItsOwnContext,
} from "./support/account.ts";
import { consented } from "./support/consent.ts";
import { givePage, makeFriends, makerNumberOf, playOf } from "./support/database.ts";
import { gameWhere } from "./support/game.ts";
import { asInstalled } from "./support/installed.ts";
import { atLaunch, beforeLaunch } from "./support/launch.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";
import { PLAYTEST_WORDS as W } from "../../src/features/playtest/words.ts";

// Playtesting (playtesting spec), before launch: a maker lets players ask, says yes or no, invites friends or shares a
// link, and takes people off; a playtester plays free with the Playtest tag, and Your turn says they were let in. From
// launch it all goes. The state table's J cells are walked here; the database test checks every cell.

const SITE = "http://localhost:4173";

test.beforeEach(forgetRateLimits);

interface Person {
  page: Page;
  context: BrowserContext;
  number: string;
  name: string;
}

/** A new browser of its own, the day before launch, as an installed app (so a sideways window still works). */
async function browserOf(browser: Browser): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({ ...consented, baseURL: SITE });
  await asInstalled(context);
  await beforeLaunch(context);
  return { context, page: await context.newPage() };
}

/** A maker, signed in, with a live game and a page under this name. */
async function makerWithGame(
  browser: Browser,
  name: string,
): Promise<Person & { slug: string; game: string }> {
  const { context, page } = await browserOf(browser);
  const { slug, name: game } = await gameWhere(page, { state: "live" });
  const number = await makerNumberOf(slug);
  await givePage({ number }, { name, oneLine: "I make games." });
  return { page, context, number, name, slug, game };
}

/** A player, signed in, with a page under this name (the maker sees their name). */
async function player(browser: Browser, name: string): Promise<Person> {
  const { context, page } = await browserOf(browser);
  const account = await signUp(page);
  await givePage(account, { name, oneLine: "I play games." });
  return { page, context, number: account.number, name };
}

async function open(page: Page, address: string): Promise<void> {
  await page.goto(address, { waitUntil: "domcontentloaded" });
  await pageHasSettled(page);
}

const badgeIn = (within: Page | Locator): Locator => within.locator(".playtestbadge");
const askIn = (within: Page | Locator): Locator => within.getByRole("button", { name: W.ask, exact: true });
const takeBackIn = (within: Page | Locator): Locator =>
  within.getByRole("button", { name: W.takeBack, exact: true });
const tagPlayIn = (within: Page | Locator): Locator =>
  within.getByRole("link", { name: `Play ${W.tag}`, exact: true });
const wishlistIn = (within: Page | Locator): Locator =>
  within.getByRole("button", { name: /^(Wishlist|On your wishlist)$/ });
const switchOf = (page: Page): Locator => page.getByRole("button", { name: new RegExp(`^${W.switch}`) });
const yourTurnTab = (page: Page): Locator =>
  page.getByRole("navigation", { name: "Feeds" }).getByRole("link", { name: /^Your turn/ });
const rowOf = (page: Page, game: string): Locator =>
  page.locator("main.yourturn li").filter({ hasText: game });
const askingOf = (page: Page): Locator => page.getByRole("region", { name: W.asking });
const playingOf = (page: Page): Locator => page.getByRole("region", { name: W.playing });

/** The game's first clip on the feed, scrolled to. */
async function clipOn(page: Page, address: string, slug: string): Promise<Locator> {
  await open(page, address);
  const clip = page.locator(`section[data-slug="${slug}"]`).first();
  await clip.scrollIntoViewIfNeeded();
  return clip;
}

/** The maker's Playtesters page, opened from Live as a maker would. */
async function playtestersFromLive(maker: { page: Page; slug: string }): Promise<void> {
  await open(maker.page, `/make/${maker.slug}`);
  await maker.page.getByRole("link", { name: W.link, exact: true }).click();
  await expect(maker.page).toHaveURL(`/make/${maker.slug}/playtesters`);
  await pageHasSettled(maker.page);
}

async function turnAsking(page: Page, on: boolean): Promise<void> {
  const button = switchOf(page);
  if ((await button.textContent())?.includes(on ? W.on : W.off) === true) return;
  await button.click();
  await expect(switchOf(page)).toContainText(on ? W.on : W.off);
}

test("a player asks, is let in, plays free as a playtester, hears so in Your turn, and is taken off", async ({
  browser,
}) => {
  test.setTimeout(240_000);
  const kai = await makerWithGame(browser, "Kai Maker");
  const sam = await player(browser, "Sam Player");
  try {
    // The empty page: the switch, Invite and the nothing-yet words.
    await playtestersFromLive(kai);
    await expect(kai.page.getByRole("heading", { name: W.title, level: 1 })).toBeVisible();
    await expect(kai.page.getByText(W.lede(kai.game))).toBeVisible();
    await expect(switchOf(kai.page)).toContainText(W.off);
    await expect(kai.page.getByText(W.offNote)).toBeVisible();
    await expect(kai.page.getByRole("link", { name: W.invite })).toBeVisible();
    await expect(kai.page.getByText(W.empty)).toBeVisible();

    // Asking on: the note says what players see. The maker sees no badge and no Ask on their own game.
    await turnAsking(kai.page, true);
    await expect(kai.page.getByText(W.onNote(kai.game))).toBeVisible();
    await open(kai.page, `/g/${kai.slug}`);
    await expect(badgeIn(kai.page)).toHaveCount(0);
    await expect(askIn(kai.page)).toHaveCount(0);
    await expect(badgeIn(await clipOn(kai.page, "/", kai.slug))).toHaveCount(0);

    // The player sees the badge on the clip, and no Ask there; on the game's page the badge and Ask.
    const clip = await clipOn(sam.page, "/", kai.slug);
    await expect(badgeIn(clip)).toBeVisible();
    await expect(askIn(clip)).toHaveCount(0);
    await open(sam.page, `/g/${kai.slug}`);
    await expect(badgeIn(sam.page)).toBeVisible();
    await askIn(sam.page).click();
    await expect(sam.page.getByText(W.asked)).toBeVisible();
    // Take back deletes the ask; asking again makes it again, and a reload reads it back.
    await takeBackIn(sam.page).click();
    await expect(askIn(sam.page)).toBeVisible();
    await askIn(sam.page).click();
    await expect(takeBackIn(sam.page)).toBeVisible();
    await open(sam.page, `/g/${kai.slug}`);
    await expect(sam.page.getByText(W.asked)).toBeVisible();
    await expect(badgeIn(sam.page)).toBeVisible();

    // The maker sees the ask and lets them play: they move to Playing, "Since" the day.
    await open(kai.page, `/make/${kai.slug}/playtesters`);
    await expect(askingOf(kai.page)).toContainText(W.wants(sam.name));
    await kai.page.getByRole("button", { name: W.letPlay(sam.name) }).click();
    await expect(playingOf(kai.page)).toContainText(sam.name);
    await expect(playingOf(kai.page)).toContainText(/Since [A-Z][a-z]{2} \d{1,2}/);
    await expect(askingOf(kai.page)).toHaveCount(0);

    // The player: the dot on Your turn, Play with the tag and no badge on the clip and on the page, the free line.
    const playClip = await clipOn(sam.page, "/", kai.slug);
    await expect(yourTurnTab(sam.page)).toHaveAccessibleName("Your turn, new games");
    await expect(badgeIn(playClip)).toHaveCount(0);
    await expect(tagPlayIn(playClip)).toHaveAttribute("href", `/g/${kai.slug}/play`);
    // Enter and the gamepad's A press the band's `.play` (Feed.svelte); the playtester's Play is that one.
    await expect(playClip.locator(".band .play").first()).toHaveAccessibleName(`Play ${W.tag}`);
    await open(sam.page, `/g/${kai.slug}`);
    await expect(badgeIn(sam.page)).toHaveCount(0);
    await expect(wishlistIn(sam.page)).toHaveCount(0);
    await expect(sam.page.getByText(W.freeUntil)).toBeVisible();

    // Your turn: the maker's words, no Stop; opening it clears the dot.
    await open(sam.page, "/your-turn");
    const row = rowOf(sam.page, kai.game);
    await expect(row).toContainText(W.letYou(kai.name));
    await expect(row.getByRole("button", { name: /^Stop/ })).toHaveCount(0);
    await expect
      .poll(async () => {
        await open(sam.page, "/");
        return yourTurnTab(sam.page).getAttribute("aria-label");
      })
      .toBeNull();

    // Play starts the game as a playtest play, with no price card.
    await open(sam.page, `/g/${kai.slug}`);
    await tagPlayIn(sam.page).click();
    await expect(sam.page).toHaveURL(`/g/${kai.slug}/play`);
    await expect(sam.page.getByRole("heading", { name: "Join Ruken to play" })).toHaveCount(0);
    await expect.poll(async () => (await playOf(kai.slug)).sessions.at(-1)?.basis).toBe("playtest");

    // Remove on the row takes it off the list, and it stays off after a reload; they still play.
    await open(sam.page, "/your-turn");
    await rowOf(sam.page, kai.game)
      .getByRole("button", { name: `Remove ${kai.game} from Your turn` })
      .click();
    await expect(rowOf(sam.page, kai.game)).toHaveCount(0);
    await open(sam.page, "/your-turn");
    await expect(rowOf(sam.page, kai.game)).toHaveCount(0);
    await open(sam.page, `/g/${kai.slug}`);
    await expect(tagPlayIn(sam.page)).toBeVisible();

    // The maker's ✕ asks first: Keep changes nothing, Stop takes them off.
    await open(kai.page, `/make/${kai.slug}/playtesters`);
    await kai.page.getByRole("button", { name: W.stop(sam.name) }).click();
    const card = kai.page.getByRole("dialog", { name: W.stopAsk(sam.name) });
    await expect(card).toBeVisible();
    await card.getByRole("button", { name: W.stopNo }).click();
    await expect(card).toBeHidden();
    await expect(playingOf(kai.page)).toContainText(sam.name);
    await kai.page.getByRole("button", { name: W.stop(sam.name) }).click();
    await card.getByRole("button", { name: W.stopYes }).click();
    await expect(playingOf(kai.page)).toHaveCount(0);
    await expect(kai.page.getByText(W.empty)).toBeVisible();

    // Taken off: plain Wishlist, no badge and no Ask, on the clip and the page; Play is the price card again.
    const offClip = await clipOn(sam.page, "/", kai.slug);
    await expect(badgeIn(offClip)).toHaveCount(0);
    await expect(wishlistIn(offClip)).toBeVisible();
    await open(sam.page, `/g/${kai.slug}`);
    await expect(badgeIn(sam.page)).toHaveCount(0);
    await expect(askIn(sam.page)).toHaveCount(0);
    await expect(tagPlayIn(sam.page)).toHaveCount(0);
    await expect(wishlistIn(sam.page)).toBeVisible();
    await open(sam.page, `/g/${kai.slug}/play`);
    await expect(sam.page.getByRole("heading", { name: "Join Ruken to play" })).toBeVisible();
  } finally {
    await kai.context.close();
    await sam.context.close();
  }
});

test("with asking off nobody new can ask, but waiting asks stay; a no is never shown to the player", async ({
  browser,
}) => {
  test.setTimeout(240_000);
  const kai = await makerWithGame(browser, "Kai Switch");
  const ann = await player(browser, "Ann Asker");
  const cy = await player(browser, "Cy Looker");
  try {
    await open(kai.page, `/make/${kai.slug}/playtesters`);
    await turnAsking(kai.page, true);
    await open(ann.page, `/g/${kai.slug}`);
    await askIn(ann.page).click();
    await expect(ann.page.getByText(W.asked)).toBeVisible();

    // Off: no badge and no Ask for anyone else; the asker still sees their ask, and the maker still sees it.
    await open(kai.page, `/make/${kai.slug}/playtesters`);
    await turnAsking(kai.page, false);
    await open(cy.page, `/g/${kai.slug}`);
    await expect(badgeIn(cy.page)).toHaveCount(0);
    await expect(askIn(cy.page)).toHaveCount(0);
    await expect(wishlistIn(cy.page)).toBeVisible();
    await expect(badgeIn(await clipOn(cy.page, "/", kai.slug))).toHaveCount(0);
    await open(ann.page, `/g/${kai.slug}`);
    await expect(ann.page.getByText(W.asked)).toBeVisible();
    await expect(badgeIn(ann.page)).toHaveCount(0);
    await open(kai.page, `/make/${kai.slug}/playtesters`);
    await expect(askingOf(kai.page)).toContainText(W.wants(ann.name));

    // A no: the ask leaves Asking, and the player still sees "You asked…".
    await kai.page.getByRole("button", { name: W.sayNo(ann.name) }).click();
    await expect(askingOf(kai.page)).toHaveCount(0);
    await open(ann.page, `/g/${kai.slug}`);
    await expect(ann.page.getByText(W.asked)).toBeVisible();

    // On again: the badge and Ask come back.
    await open(kai.page, `/make/${kai.slug}/playtesters`);
    await turnAsking(kai.page, true);
    await open(cy.page, `/g/${kai.slug}`);
    await expect(badgeIn(cy.page)).toBeVisible();
    await expect(askIn(cy.page)).toBeVisible();
  } finally {
    await Promise.all([kai.context.close(), ann.context.close(), cy.context.close()]);
  }
});

test("the maker invites a friend from the sheet and shares the link; a new link ends the old one", async ({
  browser,
}) => {
  test.setTimeout(240_000);
  const kai = await makerWithGame(browser, "Kai Inviter");
  const mia = await player(browser, "Mia Friend");
  const third = await signUpInItsOwnContext(browser);
  const fourth = await signUpInItsOwnContext(browser);
  const late = await browserOf(browser);
  const stranger = await browserOf(browser);
  try {
    await makeFriends({ number: kai.number }, mia);

    // The sheet shows the same link each time it opens (asking stays off: invites work anyway).
    await open(kai.page, `/make/${kai.slug}/playtesters`);
    const sheet = kai.page.getByRole("dialog", { name: W.sheetTitle });
    const openSheet = async (): Promise<string> => {
      await kai.page.getByRole("link", { name: W.invite }).click();
      await expect(sheet).toBeVisible();
      await expect(sheet.getByRole("button", { name: W.copy })).toBeFocused();
      return (await sheet.locator(".link").textContent()) ?? "";
    };
    const first = await openSheet();
    expect(first).toMatch(/\/p\/[A-Za-z0-9_-]{22}$/);
    await sheet.getByRole("link", { name: "Close" }).click();
    await expect(sheet).toBeHidden();
    expect(await openSheet()).toBe(first);

    // A friend's face invites them at once and ticks.
    const face = sheet.getByRole("button", { name: W.inviteLabel(mia.name) });
    await expect(face).toHaveAttribute("aria-pressed", "false");
    await face.click();
    await expect(sheet.getByRole("status")).toHaveText(W.invited(mia.name));
    await expect(face).toHaveAttribute("aria-pressed", "true");
    await open(mia.page, "/your-turn");
    await expect(rowOf(mia.page, kai.game)).toContainText(W.invitedYou(kai.name));
    await open(mia.page, `/g/${kai.slug}`);
    await expect(tagPlayIn(mia.page)).toBeVisible();

    // A third person, signed out, opens the link, signs in, and lands on the game as a playtester.
    const path = new URL(first).pathname;
    await late.page.goto(path);
    await expect(late.page).toHaveURL(/\/sign-in\?next=/);
    await late.page.getByLabel("Phone number").fill(nationalOf(third.number));
    await late.page.getByLabel("Password").fill(JOURNEY_PASSWORD);
    await late.page.getByRole("button", { name: "Sign in" }).click();
    await expect(late.page).toHaveURL(`/g/${kai.slug}`);
    await pageHasSettled(late.page);
    await expect(tagPlayIn(late.page)).toBeVisible();

    // A new link: the old one now leads nowhere and makes nobody a playtester.
    await kai.page.getByRole("button", { name: W.newLink }).click();
    await expect(sheet.locator(".link")).not.toHaveText(first);
    await open(stranger.page, "/sign-in");
    await stranger.page.getByLabel("Phone number").fill(nationalOf(fourth.number));
    await stranger.page.getByLabel("Password").fill(JOURNEY_PASSWORD);
    await stranger.page.getByRole("button", { name: "Sign in" }).click();
    await expect(stranger.page).toHaveURL("/");
    await stranger.page.goto(path);
    await expect(stranger.page).toHaveURL("/");
    await open(stranger.page, `/g/${kai.slug}`);
    await expect(tagPlayIn(stranger.page)).toHaveCount(0);

    // Both are under Playing, "Invited" the day.
    await open(kai.page, `/make/${kai.slug}/playtesters`);
    await expect(playingOf(kai.page)).toContainText(mia.name);
    await expect(playingOf(kai.page).getByText(/^Invited [A-Z][a-z]{2} \d{1,2}$/)).toHaveCount(2);

    // With no script, the sheet is drawn open in the page, with its link.
    const plain = await browser.newContext({
      baseURL: SITE,
      javaScriptEnabled: false,
      storageState: await kai.context.storageState(),
    });
    try {
      const page = await plain.newPage();
      await page.goto(`/make/${kai.slug}/playtesters?invite`);
      const drawn = page.getByRole("dialog", { name: W.sheetTitle });
      await expect(drawn).toBeVisible();
      await expect(drawn.locator(".link")).toHaveText(/\/p\/[A-Za-z0-9_-]{22}$/);
    } finally {
      await plain.close();
    }
  } finally {
    await Promise.all([
      kai.context.close(),
      mia.context.close(),
      late.context.close(),
      stranger.context.close(),
    ]);
  }
});

test("signed out, Ask goes by sign-up and comes back asked; a bare way back asks nothing; from launch nothing is playtest", async ({
  browser,
}) => {
  test.setTimeout(240_000);
  const kai = await makerWithGame(browser, "Kai Launch");
  const nobody = await browserOf(browser);
  const looker = await player(browser, "Lee Looker");
  try {
    await open(kai.page, `/make/${kai.slug}/playtesters`);
    await turnAsking(kai.page, true);

    // Signed out: Ask sends to sign up, and back on the game's page the ask is sent.
    await open(nobody.page, `/g/${kai.slug}`);
    await askIn(nobody.page).click();
    await expect(nobody.page).toHaveURL(/\/sign-up\?next=/);
    await finishSignUpForm(nobody.page, freshNumber());
    await expect(nobody.page).toHaveURL(`/g/${kai.slug}`);
    await pageHasSettled(nobody.page);
    await expect(nobody.page.getByText(W.asked)).toBeVisible();

    // The way back with no press behind it sends nothing.
    await looker.page.goto(`/g/${kai.slug}/playtest?back=${encodeURIComponent(`/g/${kai.slug}`)}`);
    await expect(looker.page).toHaveURL(`/g/${kai.slug}`);
    await pageHasSettled(looker.page);
    await expect(askIn(looker.page)).toBeVisible();

    // Let the asker in, and take the link, then open the site as it is from launch.
    await open(kai.page, `/make/${kai.slug}/playtesters`);
    await kai.page.getByRole("button", { name: /^Let .+ play$/ }).click();
    await expect(playingOf(kai.page)).toBeVisible();
    await kai.page.getByRole("link", { name: W.invite }).click();
    const link = new URL((await kai.page.locator(".invitesheet .link").textContent()) ?? "").pathname;
    for (const context of [kai.context, nobody.context, looker.context]) await atLaunch(context);

    // No Playtesters link on Live, and its page sends to Live.
    await open(kai.page, `/make/${kai.slug}`);
    await expect(kai.page.getByRole("link", { name: W.link, exact: true })).toHaveCount(0);
    await kai.page.goto(`/make/${kai.slug}/playtesters`);
    await expect(kai.page).toHaveURL(`/make/${kai.slug}`);

    // No badge, no Ask, no tag; the playtester, not a member, meets the price card; no Your turn row.
    await open(looker.page, `/g/${kai.slug}`);
    await expect(badgeIn(looker.page)).toHaveCount(0);
    await expect(askIn(looker.page)).toHaveCount(0);
    await expect(badgeIn(await clipOn(looker.page, "/", kai.slug))).toHaveCount(0);
    await open(nobody.page, `/g/${kai.slug}`);
    await expect(tagPlayIn(nobody.page)).toHaveCount(0);
    await open(nobody.page, "/your-turn");
    await expect(rowOf(nobody.page, kai.game)).toHaveCount(0);
    await open(nobody.page, `/g/${kai.slug}/play`);
    await expect(nobody.page.getByRole("heading", { name: "Join Ruken to play" })).toBeVisible();

    // The link lands on the game's page and makes nobody a playtester.
    await looker.page.goto(link);
    await expect(looker.page).toHaveURL(`/g/${kai.slug}`);
    await beforeLaunch(looker.context);
    await open(looker.page, `/g/${kai.slug}`);
    await expect(tagPlayIn(looker.page)).toHaveCount(0);
  } finally {
    await Promise.all([kai.context.close(), nobody.context.close(), looker.context.close()]);
  }
});
