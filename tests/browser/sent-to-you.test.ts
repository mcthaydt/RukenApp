import { expect, test, type Browser, type BrowserContext, type Locator, type Page } from "@playwright/test";
import { pageHasSettled, signUp } from "./support/account.ts";
import { clearCookiesKeepingConsent, consented } from "./support/consent.ts";
import { givePage, makeFriends, sentTo, stopsOf, unfollow } from "./support/database.ts";
import { gameWhere } from "./support/game.ts";
import { asInstalled } from "./support/installed.ts";
import { showTheOwner } from "./support/look.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

// Your turn (games-sent-to-you brief): friends, people who follow each other, send each other games from the share
// sheet; the games land on the feed's third tab, Your turn, with a dot until they are seen. The receiver removes a game,
// or stops a sender, who is never told, and lets them through again with Undo.

const SITE = "http://localhost:4173";
const FROM_THE_SITE = { headers: { origin: SITE } };

let games: { slug: string; name: string }[] = [];

test.beforeAll(async ({ browser }) => {
  test.setTimeout(240_000);
  await forgetRateLimits();
  const context = await browser.newContext({ ...consented, baseURL: SITE });
  try {
    const page = await context.newPage();
    games = [await gameWhere(page, { state: "live" }), await gameWhere(page, { state: "live" })];
  } finally {
    await context.close();
  }
});
test.beforeEach(async ({ page }) => {
  await forgetRateLimits();
  await asInstalled(page);
});

const tabs = (page: Page) => page.getByRole("navigation", { name: "Feeds" });
const yourTurnTab = (page: Page) => tabs(page).getByRole("link", { name: /^Your turn/ });

function twoGames(): [{ slug: string; name: string }, { slug: string; name: string }] {
  const [first, second] = games;
  if (first === undefined || second === undefined) throw new Error("no games made");
  return [first, second];
}

interface Person {
  page: Page;
  number: string;
  handle: string;
  name: string;
  context: BrowserContext;
}

/** A person signed up in a browser of their own, with a page of their own under the name given. */
async function person(browser: Browser, name: string, options: { photo?: boolean } = {}): Promise<Person> {
  const context = await browser.newContext({ ...consented, baseURL: SITE });
  const page = await context.newPage();
  await asInstalled(page);
  const account = await signUp(page);
  const { handle } = await givePage(account, {
    name,
    oneLine: "I play games.",
    ...(options.photo === true ? { photoKey: "photos/0123456789abcdef.webp" } : {}),
  });
  return { page, number: account.number, handle, name, context };
}

/** The signed-in person in the journey's own page, with a page of their own. */
async function me(page: Page, name: string): Promise<{ number: string; handle: string; name: string }> {
  const account = await signUp(page);
  const { handle } = await givePage(account, { name, oneLine: "I play games." });
  return { number: account.number, handle, name };
}

/** Opens the share sheet on this game's own page. */
async function shareSheetFor(page: Page, slug: string): Promise<Locator> {
  await page.goto(`/g/${slug}`, { waitUntil: "domcontentloaded" });
  await pageHasSettled(page);
  await page.getByRole("button", { name: "Share" }).click();
  const sheet = page.getByRole("dialog", { name: "Share" });
  await expect(sheet).toBeVisible();
  return sheet;
}

/** Sends this game to a friend from the share sheet, and waits for the face to say Sent. */
async function send(page: Page, slug: string, to: string): Promise<void> {
  const sheet = await shareSheetFor(page, slug);
  await expect(sheet.getByRole("heading", { name: "Send to a friend" })).toBeVisible();
  await sheet.getByRole("button", { name: `Send to ${to}` }).click();
  await expect(sheet.getByRole("button", { name: `Sent: ${to}` })).toBeVisible();
}

/** A row of the Your turn list, found by its game's name. */
const rowOf = (page: Page, game: string) => page.locator("main.yourturn li").filter({ hasText: game });

test("a friend sends a game; it lands on Your turn with a dot, is seen, opened, removed; the sender stopped and let back", async ({
  page,
  browser,
}, testInfo) => {
  test.setTimeout(240_000);
  const [first, second] = twoGames();
  const receiver = await me(page, "Robin Reed");
  const sender = await person(browser, "Sam Sender");
  try {
    await makeFriends(receiver, sender);

    // Create: the sender's sheet has the receiver's face (no photo, so the first letter), and pressing it sends.
    const sheet = await shareSheetFor(sender.page, first.slug);
    const face = sheet.getByRole("button", { name: "Send to Robin Reed" });
    await expect(face).toContainText("R");
    await showTheOwner(sender.page, testInfo, "send-to-a-friend");
    await face.click();
    await expect(sheet.getByRole("button", { name: "Sent: Robin Reed" })).toBeVisible();
    expect(await sentTo(receiver.number)).toEqual([{ game: first.slug, seen: false }]);

    // Read: the receiver's third tab carries the dot, and the list shows the game, who sent it and when.
    await page.goto("/followed");
    await pageHasSettled(page);
    await expect(yourTurnTab(page)).toHaveAccessibleName("Your turn, new games");
    await yourTurnTab(page).click();
    await expect(page).toHaveURL("/your-turn");
    await expect(yourTurnTab(page)).toHaveAttribute("aria-current", "page");
    const row = rowOf(page, first.name);
    await expect(row).toContainText("From Sam Sender");
    await expect(row).toContainText("Today");
    await showTheOwner(page, testInfo, "your-turn-list");
    // Seen: the dot goes, and stays gone after a reload.
    await expect(yourTurnTab(page)).toHaveAccessibleName("Your turn");
    await expect.poll(() => sentTo(receiver.number)).toEqual([{ game: first.slug, seen: true }]);
    await page.reload();
    await pageHasSettled(page);
    await expect(yourTurnTab(page)).toHaveAccessibleName("Your turn");

    // The row opens the game's page; Back comes to the list.
    await row.getByRole("link").click();
    await expect(page).toHaveURL(`/g/${first.slug}`);
    await page.goBack();
    await expect(page).toHaveURL("/your-turn");

    // Delete: Remove takes it off at once, and it is gone after a reload too.
    await rowOf(page, first.name)
      .getByRole("button", { name: `Remove ${first.name} from Your turn` })
      .click();
    await expect(rowOf(page, first.name)).toHaveCount(0);
    await expect(
      page.getByText("Nothing yet. When a friend sends you a game, it shows up here."),
    ).toBeVisible();
    await expect.poll(() => sentTo(receiver.number)).toEqual([]);
    await page.reload();
    await expect(
      page.getByText("Nothing yet. When a friend sends you a game, it shows up here."),
    ).toBeVisible();

    // Stop: the sender sends another; the receiver asks to stop them, the card asks once, and Stop clears their games.
    await send(sender.page, second.slug, "Robin Reed");
    await page.reload();
    await pageHasSettled(page);
    const stop = rowOf(page, second.name).getByRole("button", { name: "Stop games from Sam Sender" });
    await stop.click();
    const card = page.getByRole("dialog", { name: "Stop games from Sam Sender? They won't be told." });
    await expect(card).toBeVisible();
    await showTheOwner(page, testInfo, "stop-card");
    // Keep changes nothing.
    await card.getByRole("button", { name: "Keep" }).click();
    await expect(card).toBeHidden();
    await expect(stop).toBeFocused();
    expect(await stopsOf(receiver.number)).toBe(0);
    await stop.click();
    await card.getByRole("button", { name: "Stop" }).click();
    await expect(page).toHaveURL("/your-turn");
    await expect(
      page.getByText("Nothing yet. When a friend sends you a game, it shows up here."),
    ).toBeVisible();
    expect(await stopsOf(receiver.number)).toBe(1);
    expect(await sentTo(receiver.number)).toEqual([]);

    // The sender is never told: their face still says Sent, and nothing is kept.
    await send(sender.page, first.slug, "Robin Reed");
    expect(await sentTo(receiver.number)).toEqual([]);

    // Update: People you stopped lists them, and Undo lets them through again.
    await page.getByRole("link", { name: "People you stopped" }).click();
    await expect(page).toHaveURL("/your-turn/stopped");
    await expect(page.getByText("Sam Sender")).toBeVisible();
    await showTheOwner(page, testInfo, "people-you-stopped");
    await page.getByRole("button", { name: "Let games from Sam Sender through again" }).click();
    await expect(page.getByText("You haven't stopped anyone.")).toBeVisible();
    expect(await stopsOf(receiver.number)).toBe(0);

    await send(sender.page, first.slug, "Robin Reed");
    expect(await sentTo(receiver.number)).toEqual([{ game: first.slug, seen: false }]);
  } finally {
    await sender.context.close();
  }
});

test("a friend with a photo shows it; nobody else sees the row, and a game stays when a friend stops following", async ({
  page,
  browser,
}) => {
  test.setTimeout(180_000);
  const [first] = twoGames();
  const receiver = await me(page, "Pat Photo");
  const sender = await person(browser, "Lee Lonely", { photo: true });
  try {
    // No friends yet: the sheet is as it always was.
    let sheet = await shareSheetFor(sender.page, first.slug);
    await expect(sheet.getByRole("heading", { name: "Send to a friend" })).toHaveCount(0);
    await expect(sheet.getByRole("button", { name: "Copy link" })).toBeVisible();

    // Following one way is not a friend.
    await makeFriends(receiver, sender);
    await unfollow(receiver, sender);
    sheet = await shareSheetFor(sender.page, first.slug);
    await expect(sheet.getByRole("heading", { name: "Send to a friend" })).toHaveCount(0);
    expect(
      (
        await sender.page.request.post("/your-turn/send", {
          ...FROM_THE_SITE,
          form: { game: first.slug, to: "nobody" },
        })
      ).status(),
    ).toBe(404);

    // Friends: a friend with a photo shows it on the sheet (the receiver's sheet, where the sender is the friend).
    await makeFriends(receiver, sender);
    sheet = await shareSheetFor(page, first.slug);
    await expect(sheet.getByRole("button", { name: "Send to Lee Lonely" }).locator("img")).toHaveAttribute(
      "src",
      /0123456789abcdef\.webp/,
    );
    await send(sender.page, first.slug, "Pat Photo");

    // The sender stops following: the game they sent stays.
    await unfollow(sender, receiver);
    await page.goto("/your-turn");
    await expect(rowOf(page, first.name)).toContainText("From Lee Lonely");
  } finally {
    await sender.context.close();
  }

  // Signed out, there is no row: the share sheet is the plain one.
  await clearCookiesKeepingConsent(page.context());
  const sheet = await shareSheetFor(page, first.slug);
  await expect(sheet.getByRole("heading", { name: "Send to a friend" })).toHaveCount(0);
});

test("signed out, Your turn keeps the top bar and says to sign in, which comes back to it", async ({
  page,
}, testInfo) => {
  await page.goto("/your-turn");
  await pageHasSettled(page);
  await expect(yourTurnTab(page)).toHaveAttribute("aria-current", "page");
  await expect(page.getByText("Sign in to see games friends send you.")).toBeVisible();
  await showTheOwner(page, testInfo, "your-turn-signed-out");
  await page.getByRole("link", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fyour-turn$/);
  await page.goto("/your-turn/stopped");
  await expect(page).toHaveURL(/\/sign-in/);

  // Every route that keeps something turns a signed-out person away.
  for (const route of ["/your-turn/send", "/your-turn/seen", "/your-turn/remove", "/your-turn/stop"]) {
    const answer = await page.request.post(route, {
      ...FROM_THE_SITE,
      form: { id: "x", game: "x", to: "x" },
      maxRedirects: 0,
    });
    expect(answer.status(), route).toBeGreaterThanOrEqual(300);
    expect(answer.status(), route).not.toBe(200);
  }
});

test("signed in with no friends, Your turn says nothing has come yet and points at every game", async ({
  page,
}) => {
  await me(page, "Nina New");
  await page.goto("/your-turn");
  await pageHasSettled(page);
  await expect(
    page.getByText("Nothing yet. When a friend sends you a game, it shows up here."),
  ).toBeVisible();
  await page.getByRole("link", { name: "See every game" }).click();
  await expect(page).toHaveURL("/");
  // Removing or stopping a game that is not yours is refused.
  for (const route of ["/your-turn/remove", "/your-turn/stop"]) {
    const answer = await page.request.post(route, {
      ...FROM_THE_SITE,
      form: { id: "not-yours" },
      headers: { ...FROM_THE_SITE.headers, accept: "application/json" },
    });
    expect(answer.status(), route).toBe(404);
  }
});

/** A quick one-finger swipe, as feed-top.test.ts makes one. */
async function swipe(page: Page, from: [number, number], to: [number, number]): Promise<void> {
  await page.evaluate(
    ([x0, y0, x1, y1]) => {
      const target = document.elementFromPoint(x0, y0) ?? document.body;
      const touch = (type: string, touches: object[], changed: object) => {
        const event = new Event(type, { bubbles: true });
        Object.defineProperty(event, "touches", { value: touches });
        Object.defineProperty(event, "changedTouches", { value: [changed] });
        target.dispatchEvent(event);
      };
      const begun = { identifier: 1, clientX: x0, clientY: y0 };
      touch("touchstart", [begun], begun);
      touch("touchend", [], { identifier: 1, clientX: x1, clientY: y1 });
    },
    [...from, ...to] as [number, number, number, number],
  );
}

test("with no yes to cookies yet, a swipe from Followed still lands on Your turn with its top bar", async ({
  browser,
}) => {
  const context = await browser.newContext({ baseURL: SITE });
  try {
    const page = await context.newPage();
    await asInstalled(page);
    const answer = await page.goto("/your-turn");
    expect(answer?.status()).toBe(200);
    await page.goto("/followed");
    await pageHasSettled(page);
    const { width, height } = page.viewportSize() ?? { width: 0, height: 0 };
    await swipe(page, [width * 0.8, height / 2], [width * 0.2, height / 2]);
    await expect(page).toHaveURL("/your-turn");
    await expect(yourTurnTab(page)).toHaveAttribute("aria-current", "page");
    await expect(page.getByText("Sign in to see games friends send you.")).toBeVisible();
  } finally {
    await context.close();
  }
});

test("Your turn works from the keyboard alone: Remove, and the stop card with Escape", async ({
  page,
  browser,
}) => {
  test.setTimeout(180_000);
  const [first, second] = twoGames();
  const receiver = await me(page, "Kay Keys");
  const sender = await person(browser, "Max Mouse");
  try {
    await makeFriends(receiver, sender);
    await send(sender.page, first.slug, "Kay Keys");
    await send(sender.page, second.slug, "Kay Keys");
  } finally {
    await sender.context.close();
  }
  await page.goto("/your-turn");
  await pageHasSettled(page);
  const stop = rowOf(page, first.name).getByRole("button", { name: "Stop games from Max Mouse" });
  await stop.focus();
  await page.keyboard.press("Enter");
  const card = page.getByRole("dialog", { name: "Stop games from Max Mouse? They won't be told." });
  await expect(card).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(card).toBeHidden();
  await expect(stop).toBeFocused();

  const remove = rowOf(page, second.name).getByRole("button", {
    name: `Remove ${second.name} from Your turn`,
  });
  await remove.focus();
  await page.keyboard.press("Enter");
  await expect(rowOf(page, second.name)).toHaveCount(0);
  await expect.poll(async () => (await sentTo(receiver.number)).map((one) => one.game)).toEqual([first.slug]);
});
