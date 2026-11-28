import { expect, test, type Page } from "@playwright/test";
import { pageHasSettled, signUp } from "./support/account.ts";
import { consented } from "./support/consent.ts";
import { askedForParent, changeGame, givePage, makeFriends, makeThemUnder18 } from "./support/database.ts";
import { addGame, gameWhere, startAtCheck } from "./support/game.ts";
import { wordsHaveSettled } from "./support/look.ts";
import { PAD, padReachesEverything, plugInPad, pressPad } from "./support/pad.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

// Everything works with a gamepad (the owner, 2026-11-27: "everything should be fully navigable using a gamepad"; a
// console-like experience is a key feature). A stand-in pad (support/pad.ts) is plugged into every page: the D-pad
// moves the focus, A presses, B closes or goes back, the shoulder buttons change tabs, and Home opens Ruken's menu over
// a game. The feed keeps up and down for its clips.

const ours: { slug: string; name: string }[] = [];
const MAKER = `Pad Maker ${crypto.randomUUID().slice(0, 6)}`;
let free: Awaited<ReturnType<typeof addGame>>;

test.beforeAll(async ({ browser, request }) => {
  test.setTimeout(240_000);
  await forgetRateLimits();
  free = await addGame(browser, request, { free: true });
  // The free game's maker has a page, so its clip has the maker's name and the follow plus.
  await givePage(free.maker, { name: MAKER, oneLine: "I make small games." });
  for (let made = 0; made < 2; made += 1) {
    await forgetRateLimits();
    const context = await browser.newContext({ ...consented, baseURL: "http://localhost:4173" });
    try {
      ours.push(await gameWhere(await context.newPage(), { state: "live" }));
    } finally {
      await context.close();
    }
  }
});
test.beforeEach(async ({ page }) => {
  await forgetRateLimits();
  await plugInPad(page);
});

const current = (page: Page) => page.locator('section[data-current="true"]');

async function openFeed(page: Page): Promise<void> {
  await page.goto("/");
  await expect(page.locator("section[data-slug]").nth(1)).toBeAttached();
  await expect(page.locator("main.feed")).toHaveAttribute("data-ready", "true");
  await wordsHaveSettled(page);
}

test("on the feed, down and up change the clip and land on its main button; left and right reach the bar", async ({
  page,
}) => {
  await openFeed(page);
  const first = await current(page).getAttribute("data-slug");

  await pressPad(page, PAD.down);
  await expect(current(page)).not.toHaveAttribute("data-slug", first ?? "");
  // Once the slide has settled, the focus is on the new clip's main button (Play, or Wishlist before launch).
  await expect(current(page).locator(".band .button")).toBeFocused();

  await pressPad(page, PAD.up);
  await expect(current(page)).toHaveAttribute("data-slug", first ?? "");
  await expect(current(page).locator(".band .button")).toBeFocused();

  // Left from the main button is the game's name; right goes on through the clip's controls, then the bar.
  await pressPad(page, PAD.left);
  await expect(current(page).locator("a.gamelink")).toBeFocused();
  const bar = page.getByRole("navigation", { name: "Ruken" });
  for (let step = 0; step < 12; step += 1) {
    if (await bar.getByRole("link", { name: "You" }).evaluate((you) => you === document.activeElement)) break;
    await pressPad(page, PAD.right);
  }
  await expect(bar.getByRole("link", { name: "You" })).toBeFocused();
  // The ring shows where the pad is: on the bar, a shadow in the button's own shape (see the bar's journey below).
  const ring = await page.evaluate(() => getComputedStyle(document.activeElement as Element).boxShadow);
  expect(ring).toMatch(/0px 0px 0px 3px/);

  await pressPad(page, PAD.a);
  await expect(page).not.toHaveURL("/");
});

test("on a clip, left and right reach the maker, the follow plus, Like, Save, Repost and Share", async ({
  page,
}) => {
  test.setTimeout(120_000);
  // Signed in, so A on Like marks the game rather than asking the person to join.
  await signUp(page);
  await openFeed(page);
  const clip = page.locator(`section[data-slug="${free.slug}"]`).first();
  await clip.scrollIntoViewIfNeeded();
  await expect(clip).toHaveAttribute("data-current", "true");
  await wordsHaveSettled(page);
  // The first press lands on the clip's main button; right goes on through the clip's own controls to the bar.
  await pressPad(page, PAD.right);
  await expect(clip.locator(".band .button")).toBeFocused();
  const reached: string[] = [];
  for (let step = 0; step < 14; step += 1) {
    await pressPad(page, PAD.right);
    const name = await page.evaluate(() => {
      const focused = document.activeElement as HTMLElement | null;
      return (focused?.getAttribute("aria-label") ?? focused?.innerText ?? "").replace(/\s+/g, " ").trim();
    });
    reached.push(name);
    if (name === "You") break;
  }
  expect(reached).toEqual(
    expect.arrayContaining([`Follow ${MAKER}`, "Like", "Save", "Repost", "Share", "You"]),
  );
  expect(reached.some((name) => name.includes(MAKER) && !name.startsWith("Follow"))).toBe(true);
  // And each is pressed with A: Like, here, reached from the main button with the pad.
  const pressedNow = () =>
    page.evaluate(() => {
      const focused = document.activeElement;
      return focused?.getAttribute("aria-label") === "Like" ? focused.getAttribute("aria-pressed") : null;
    });
  await clip.locator(".band .button").focus();
  for (let step = 0; step < 10 && (await pressedNow()) === null; step += 1) await pressPad(page, PAD.right);
  expect(await pressedNow()).toBe("false");
  await pressPad(page, PAD.a);
  await expect.poll(pressedNow).toBe("true");
});

test("the shoulder buttons go from Fresh to Followed to Your turn and back", async ({ page }) => {
  await openFeed(page);
  const tabs = page.getByRole("navigation", { name: "Feeds" });
  await pressPad(page, PAD.lb);
  await expect(page).toHaveURL("/");
  await pressPad(page, PAD.rb);
  await expect(page).toHaveURL("/followed");
  await expect(tabs.getByRole("link", { name: "Followed" })).toHaveAttribute("aria-current", "page");
  await wordsHaveSettled(page);
  await pressPad(page, PAD.rb);
  await expect(page).toHaveURL("/your-turn");
  await expect(tabs.getByRole("link", { name: /^Your turn/ })).toHaveAttribute("aria-current", "page");
  await wordsHaveSettled(page);
  // Your turn is the last tab: RB stays.
  await pressPad(page, PAD.rb);
  await expect(page).toHaveURL("/your-turn");
  await pressPad(page, PAD.lb);
  await expect(page).toHaveURL("/followed");
  await wordsHaveSettled(page);
  await pressPad(page, PAD.lb);
  await expect(page).toHaveURL("/");
  await expect(tabs.getByRole("link", { name: "Fresh" })).toHaveAttribute("aria-current", "page");
});

test("A opens a game's page from the feed, and B comes back to the feed", async ({ page }) => {
  await openFeed(page);
  await pressPad(page, PAD.right);
  await expect(current(page).locator(".band .button")).toBeFocused();
  await pressPad(page, PAD.left);
  const slug = await current(page).getAttribute("data-slug");
  await pressPad(page, PAD.a);
  await expect(page).toHaveURL(`/g/${slug ?? ""}`);
  await pressPad(page, PAD.b);
  await expect(page).toHaveURL("/");
});

test("Share opens with A, its buttons are reached with the D-pad, and B closes it back onto Share", async ({
  page,
}) => {
  await openFeed(page);
  const share = current(page).getByRole("button", { name: "Share" });
  await pressPad(page, PAD.right);
  for (let step = 0; step < 8 && !(await share.evaluate((one) => one === document.activeElement)); step += 1)
    await pressPad(page, PAD.right);
  await expect(share).toBeFocused();
  await pressPad(page, PAD.a);
  const sheet = page.getByRole("dialog", { name: "Share" });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Copy link" })).toBeFocused();
  // The focus stays in the sheet, whichever way the pad goes.
  for (const way of [PAD.down, PAD.right, PAD.up, PAD.up, PAD.left]) {
    await pressPad(page, way);
    expect(await sheet.evaluate((one) => one.contains(document.activeElement))).toBe(true);
  }
  await pressPad(page, PAD.b);
  await expect(sheet).toBeHidden();
  await expect(share).toBeFocused();
});

/** Opens a free game (anyone may play one) and waits for it and the page's own script. */
async function openTheGame(page: Page): Promise<void> {
  await page.goto(`/g/${free.slug}/play`, { waitUntil: "domcontentloaded" });
  await pageHasSettled(page);
  await expect(page.frameLocator("iframe.frame").locator("body")).toHaveAttribute("data-loaded", "yes");
}

test("a game takes the pad as it opens: its presses go to the game, not to Ruken's page", async ({
  page,
}) => {
  await openTheGame(page);
  const frame = page.locator("iframe.frame");
  // Nothing was focused by hand: the play screen gave the game the focus once it loaded.
  await expect(frame).toBeFocused();
  for (const button of [PAD.a, PAD.b, PAD.down, PAD.right, PAD.a]) await pressPad(page, button);
  await expect(page).toHaveURL(`/g/${free.slug}/play`);
  await expect(frame).toBeFocused();
  await expect(page.locator("details.menu")).not.toHaveAttribute("open", "");
});

test("with nothing focused over a game, a first press goes into the game, not to Ruken's tab", async ({
  page,
}) => {
  await openTheGame(page);
  const frame = page.locator("iframe.frame");
  await expect(frame).toBeFocused();
  // A pad picked up after the game loaded, or a press on the page around it, leaves nothing focused.
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
  });
  await pressPad(page, PAD.a);
  await expect(frame).toBeFocused();
  await expect(page.locator("details.menu")).not.toHaveAttribute("open", "");
});

test("over a game, Home opens Ruken's menu, B closes it back into the game, and A on Leave game leaves", async ({
  page,
}) => {
  await openTheGame(page);
  const frame = page.locator("iframe.frame");
  const menu = page.locator("details.menu");
  await expect(frame).toBeFocused();

  await pressPad(page, PAD.home);
  await expect(menu).toHaveAttribute("open", "");
  await expect(page.getByRole("button", { name: "Keep playing" })).toBeFocused();
  // Down goes through the menu and stays in it.
  for (let step = 0; step < 6; step += 1) {
    await pressPad(page, PAD.down);
    expect(await page.locator(".menupanel").evaluate((one) => one.contains(document.activeElement))).toBe(
      true,
    );
  }
  // B is Keep playing: the menu closes and the game has the pad again.
  await pressPad(page, PAD.b);
  await expect(menu).not.toHaveAttribute("open", "");
  await expect(frame).toBeFocused();
  await pressPad(page, PAD.a);
  await expect(menu).not.toHaveAttribute("open", "");

  // View held for a second opens it too, for a pad whose Home button the system keeps.
  await pressPad(page, PAD.view, 1100);
  await expect(menu).toHaveAttribute("open", "");
  const leave = page.getByRole("link", { name: /Leave game/ });
  for (let step = 0; step < 6 && !(await leave.evaluate((one) => one === document.activeElement)); step += 1)
    await pressPad(page, PAD.down);
  await expect(leave).toBeFocused();
  await pressPad(page, PAD.a);
  await expect(page).not.toHaveURL(/\/play$/);
});

test("on a scrolled list of search results, up and down go from result to result, not to the search box", async ({
  page,
}) => {
  test.setTimeout(120_000);
  // Three games only this run has, in a window short enough that their list scrolls. Upright: a phone or tablet held
  // sideways in a browser is asked to turn upright, and that covers the screen.
  const word = `zq${crypto.randomUUID().replaceAll("-", "").slice(0, 8)}`;
  for (const [index, slug] of [free.slug, ours[0]?.slug ?? "", ours[1]?.slug ?? ""].entries())
    await changeGame(slug, { name: `${word} Game ${String(index + 1)}` });
  await page.setViewportSize({ width: 320, height: 340 });
  await page.goto(`/search?q=${word}`);
  const rows = page.locator(".results a");
  await expect(rows).toHaveCount(3);
  await wordsHaveSettled(page);
  await pageHasSettled(page);
  expect(
    await page.locator(".results").evaluate((list) => list.scrollHeight > list.clientHeight),
    "the results scroll",
  ).toBe(true);
  const field = page.getByRole("searchbox", { name: "Search games and makers" });

  // Down from the box goes through every result, scrolling the list.
  await field.focus();
  for (let row = 0; row < 3; row += 1) {
    await pressPad(page, PAD.down);
    await expect(rows.nth(row)).toBeFocused();
  }
  // Up from the last, with the first scrolled out of sight, goes back one result at a time, and only then to the box.
  await page.locator(".results").evaluate((list) => {
    list.scrollTop = list.scrollHeight;
  });
  expect(await rows.nth(0).evaluate((one) => one.getBoundingClientRect().bottom)).toBeLessThan(
    await page.locator(".results").evaluate((list) => list.getBoundingClientRect().top + 1),
  );
  for (let row = 1; row >= 0; row -= 1) {
    await pressPad(page, PAD.up);
    await expect(rows.nth(row)).toBeFocused();
  }
  await pressPad(page, PAD.up);
  await expect(field).toBeFocused();

  // Up from Back, above the list, with the list scrolled down: nothing is above Back, so it stays, and never goes to a
  // result hidden above the list.
  await page.locator(".results").evaluate((list) => {
    list.scrollTop = list.scrollHeight;
  });
  const back = page.getByRole("link", { name: "Back" });
  await back.focus();
  await pressPad(page, PAD.up);
  await expect(back).toBeFocused();
});

test("on your page's rooms the pad reaches every control, and right from Back is Save", async ({ page }) => {
  test.setTimeout(240_000);
  const account = await signUp(page);
  // A page of their own, so each room shows what it edits (every colour on Your colours).
  await givePage(account, { name: "Pad Rooms", oneLine: "Rooms with a pad." });
  for (const path of [
    "/make/page",
    "/make/page/address",
    "/make/page/name",
    "/make/page/line",
    "/make/page/photo",
    "/make/page/colours",
    "/make/page/links",
  ]) {
    await page.goto(path);
    await wordsHaveSettled(page);
    await padReachesEverything(page);
  }
  // Your colours, at rest (not scrolled to its end): the tiles above the pinned Back and Save are not beside them.
  await page.goto("/make/page/colours");
  await wordsHaveSettled(page);
  await pageHasSettled(page);
  expect(await page.locator("input[type=radio]").count(), "every colour is shown").toBeGreaterThan(20);
  const back = page.getByRole("link", { name: "Back" });
  for (const where of ["top", "middle"] as const) {
    await page.evaluate((where) => {
      const scroller = document.scrollingElement ?? document.documentElement;
      scroller.scrollTop = where === "top" ? 0 : (scroller.scrollHeight - scroller.clientHeight) / 2;
    }, where);
    // Where Back is pinned (phone, tablet) this leaves the page where it is; a computer's Back scrolls into view.
    await back.focus();
    await pressPad(page, PAD.right);
    await expect(
      page.getByRole("button", { name: "Save" }),
      `right from Back, scrolled to the ${where}`,
    ).toBeFocused();
  }
});

// Every screen a signed-out person can open: the pad reaches every control the Tab key does.
for (const path of [
  "/followed",
  "/your-turn",
  "/search",
  "/sign-in",
  "/sign-up",
  "/forgot-password",
  "/about",
  "/help",
  "/cookies",
  "/privacy",
]) {
  test(`the pad reaches everything on ${path}`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(path);
    await wordsHaveSettled(page);
    await padReachesEverything(page);
  });
}

test("the pad reaches everything on the price card", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(`/g/${ours[0]?.slug ?? ""}/play`);
  await expect(page.getByRole("heading", { name: "Join Ruken to play" })).toBeVisible();
  await wordsHaveSettled(page);
  await padReachesEverything(page);
});

test("the pad reaches everything on a game's page", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(`/g/${ours[0]?.slug ?? ""}`);
  // The page's script has started: until then the clip is the browser's own player, a stop of its own.
  await expect(page.getByRole("button", { name: "Watch the video full size" })).toBeVisible();
  await wordsHaveSettled(page);
  await padReachesEverything(page);
});

test("the pad reaches everything on a teen's Your feed and Ask a parent, and on a parent's page", async ({
  page,
}) => {
  const teen = await signUp(page);
  await makeThemUnder18(teen.number);
  for (const path of [
    "/settings/feed",
    "/settings/feed/parent",
    await askedForParent(teen.number),
    "/settings/feed",
  ]) {
    await page.goto(path);
    await wordsHaveSettled(page);
    await padReachesEverything(page);
  }
});

test("signed in, the pad reaches everything on You, Your name, Saved, Reposts, Your feed, Your games and a new game's first question, and B goes back", async ({
  page,
}) => {
  test.setTimeout(240_000);
  await signUp(page);
  for (const path of [
    "/me",
    "/me/name",
    "/me/saved",
    "/me/reposts",
    "/settings/feed",
    "/make",
    "/make/new",
  ]) {
    await page.goto(path);
    await wordsHaveSettled(page);
    await padReachesEverything(page);
  }
  // B on a screen that has its own Back follows it; elsewhere it goes back through the pages Ruken opened.
  await page.goto("/me");
  await wordsHaveSettled(page);
  await page.getByRole("link", { name: "Change password" }).click();
  await expect(page).toHaveURL("/me/password");
  await wordsHaveSettled(page);
  await pressPad(page, PAD.b);
  await expect(page).toHaveURL("/me");
});

test("on Your turn the pad reaches every row's controls, opens the stop card and B closes it; the share sheet's friends too", async ({
  page,
  browser,
}) => {
  test.setTimeout(240_000);
  const [game] = ours;
  if (game === undefined) throw new Error("no game made");
  const receiver = await signUp(page);
  const { handle: receiverHandle } = await givePage(receiver, {
    name: "Pad Robin",
    oneLine: "I play games.",
  });
  const context = await browser.newContext({ ...consented, baseURL: "http://localhost:4173" });
  try {
    const sender = await context.newPage();
    const account = await signUp(sender);
    await givePage(account, { name: "Pad Sam", oneLine: "I play games." });
    await makeFriends(receiver, account);
    const sent = await sender.request.post("/your-turn/send", {
      headers: { origin: "http://localhost:4173" },
      form: { game: game.slug, to: receiverHandle },
    });
    expect(sent.status()).toBe(200);
  } finally {
    await context.close();
  }

  await page.goto("/your-turn");
  await wordsHaveSettled(page);
  await padReachesEverything(page);

  // The share sheet's faces are reached like its other buttons.
  await page.goto(`/g/${game.slug}`);
  await expect(page.getByRole("button", { name: "Watch the video full size" })).toBeVisible();
  await page.getByRole("button", { name: "Share" }).click();
  const sheet = page.getByRole("dialog", { name: /^(Share|Send to friends)$/ });
  await padReachesEverything(page);
  // Its Your turn, by the pad alone: A on Your turn shows the friends, A picks, and the pad reaches Send and Back.
  await sheet.getByRole("button", { name: "Your turn", exact: true }).focus();
  await pressPad(page, PAD.a);
  await expect(sheet.getByRole("button", { name: "Pad Sam", exact: true })).toBeFocused();
  await pressPad(page, PAD.a);
  await expect(sheet.getByRole("button", { name: "Pad Sam", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await padReachesEverything(page);
});

test("a maker's questions and Check and send: the pad reaches every control", async ({ page }) => {
  test.setTimeout(400_000);
  const { slug } = await startAtCheck(page);
  for (const step of ["line", "files", "upright", "wide", "age", "check", ""]) {
    await page.goto(`/make/${slug}${step === "" ? "" : `/${step}`}`);
    await wordsHaveSettled(page);
    await padReachesEverything(page);
  }
});

// The owner, 2026-11-27: a full rectangle showed round a bottom bar button on a tap. A tap or click draws no ring at all;
// the keyboard's and the pad's ring is a shadow, which takes the button's own superellipse, never a square outline.
test("the bar shows no ring on a tap or click, and a ring of the button's own shape for the keyboard and pad", async ({
  page,
  browserName,
}) => {
  test.setTimeout(120_000);
  await signUp(page);
  await page.goto("/make");
  await wordsHaveSettled(page);
  const bar = page.getByRole("navigation", { name: "Ruken" });
  const you = bar.getByRole("link", { name: "You" });
  const ring = () =>
    you.evaluate((one) => {
      const look = getComputedStyle(one);
      return { outline: look.outlineStyle, shadow: look.boxShadow, radius: look.borderRadius };
    });
  const plain = await ring();

  // Pressed with a finger or a mouse, but kept from going anywhere, so the button keeps the focus the press gave it.
  await you.evaluate((one) => {
    one.addEventListener("click", (event) => {
      event.preventDefault();
    });
  });
  if (test.info().project.use.hasTouch === true) await you.tap();
  else await you.click();
  expect(await ring()).toEqual(plain);

  // The pad's ring: the shadow, on the same rounded button, and no outline.
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
  });
  await bar.getByRole("link", { name: "Home" }).evaluate((home) => {
    home.focus();
  });
  await pressPad(page, PAD.right);
  await pressPad(page, PAD.right);
  await expect(you).toBeFocused();
  const pad = await ring();
  expect(pad.outline).toBe("none");
  expect(pad.radius).toBe(plain.radius);
  expect(pad.radius).not.toBe("0px");
  expect(pad.shadow).not.toBe(plain.shadow);
  expect(pad.shadow).toMatch(/0px 0px 0px 3px/);

  // The keyboard's ring is the same one. (Safari's Tab passes over links unless a setting is on, so not there.)
  if (browserName === "webkit") return;
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect(you).toBeFocused();
  expect(await ring()).toEqual(pad);
});
