import { expect, test } from "@playwright/test";
import {
  continueToPayment,
  finishSignUpForm,
  freshNumber,
  pageHasSettled,
  payAsNewMember,
  signInAs,
  pressPay,
} from "./support/account.ts";
import { endMembershipOf, userIdOf } from "./support/database.ts";
import { addGame } from "./support/game.ts";
import { pipRed, showTheOwner } from "./support/look.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";
import { token } from "../support/look-tokens.ts";

// Playing (spec 4): a game in a frame on an address of its own, and Ruken's one small Menu tab over it.

let game: Awaited<ReturnType<typeof addGame>>;
let free: Awaited<ReturnType<typeof addGame>>;

test.beforeAll(async ({ browser, request }) => {
  test.setTimeout(120_000);
  game = await addGame(browser, request);
  free = await addGame(browser, request, { free: true });
});
test.beforeEach(forgetRateLimits);

const tabOf = (page: import("@playwright/test").Page) =>
  page.getByRole("group").getByLabel("Menu. Use the arrow keys to move it.");
// The game has loaded and the page's own script has come alive. The Menu tab's drag, keys and menu are script, so a
// press made before it has is not seen; the game loading says nothing about that (the cause of the drag journey's
// failures).
const loaded = async (page: import("@playwright/test").Page): Promise<void> => {
  await pageHasSettled(page);
  await expect(page.frameLocator("iframe.frame").locator("body")).toHaveAttribute("data-loaded", "yes");
};

test("a member presses Play and the game loads, in a frame on another address", async ({
  page,
}, testInfo) => {
  await payAsNewMember(page);
  await page.goto(`/g/${game.slug}`, { waitUntil: "domcontentloaded" });
  await page.getByRole("link", { name: "Play" }).click();
  const frame = page.locator("iframe.frame");
  await expect(frame).toHaveAttribute("sandbox", "allow-scripts allow-same-origin allow-pointer-lock");
  await expect(frame).toHaveAttribute("referrerpolicy", "no-referrer");
  await expect(frame).toHaveAttribute(
    "src",
    new RegExp(`^http://g-${game.publicId}\\.localhost:8788/v1\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+/$`),
  );
  await loaded(page);
  await showTheOwner(page, testInfo, "a game being played");
});

test("the game sees nothing about the player", async ({ page }) => {
  const member = await payAsNewMember(page);
  await page.goto(`/g/${game.slug}/play`, { waitUntil: "domcontentloaded" });
  await loaded(page);
  const seen = page.frameLocator("iframe.frame").locator("#seen");
  await expect(seen).not.toHaveText("");
  const text = (await seen.textContent()) ?? "";
  expect(text).not.toContain(member.number);
  expect(text).not.toContain(await userIdOf(member.number));
  expect(text).not.toContain(member.checkoutSessionId);
  await expect(page.locator("iframe.frame")).not.toHaveAttribute("name", /.+/);
});

test("someone who has not paid gets the price card, and the files do not load", async ({ page }) => {
  await page.goto(`/g/${game.slug}/play`, { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(`/join?next=${encodeURIComponent(`/g/${game.slug}/play`)}`);
  await expect(page.getByRole("heading", { name: "Join Ruken to play" })).toBeVisible();
  expect((await page.goto(`http://g-${game.publicId}.localhost:8788/index.html`))?.status()).toBe(403);
});

test("a stranger signs up, pays, and is in the game they chose", async ({ page }) => {
  await page.goto(`/g/${game.slug}`, { waitUntil: "domcontentloaded" });
  await page.getByRole("link", { name: "Play" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await finishSignUpForm(page, freshNumber());
  await continueToPayment(page);
  await pressPay(page);
  await expect(page).toHaveURL(`/g/${game.slug}/play`);
  await loaded(page);
});

test("anyone can play a free game without an account", async ({ page }) => {
  await page.goto(`/g/${free.slug}`, { waitUntil: "domcontentloaded" });
  await page.getByRole("link", { name: "Play" }).click();
  await expect(page).toHaveURL(`/g/${free.slug}/play`);
  await loaded(page);
});

test("the game's own maker plays it without paying", async ({ page }) => {
  await signInAs(page, game.maker.number, game.maker.password);
  await page.goto(`/g/${game.slug}/play`, { waitUntil: "domcontentloaded" });
  await loaded(page);
});

test("a member whose membership has ended gets the price card on reload", async ({ page }) => {
  const member = await payAsNewMember(page);
  await page.goto(`/g/${game.slug}/play`, { waitUntil: "domcontentloaded" });
  await loaded(page);
  await endMembershipOf(member);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/join\?next=/);
});

test("the menu opens, keeps playing, starts again and leaves", async ({ page }, testInfo) => {
  await page.goto(`/g/${free.slug}/play`, { waitUntil: "domcontentloaded" });
  await loaded(page);
  const tab = tabOf(page);
  await tab.click();
  await expect(page.getByRole("heading", { name: free.name })).toBeVisible();
  for (const name of ["Keep playing", "Start again", "Leave game"])
    await expect(page.getByRole("button", { name }).or(page.getByRole("link", { name }))).toBeVisible();
  await expect(page.getByText("Use this if the game is stuck.")).toBeVisible();
  // This game's maker has no page, so the menu says where it is from instead of leaving the line out.
  await expect(page.getByText("Made on Ruken")).toBeVisible();
  await showTheOwner(page, testInfo, "the menu");

  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Keep playing" })).toBeHidden();
  await expect(tab).toBeFocused();

  await tab.click();
  await page.getByRole("button", { name: "Keep playing" }).click();
  await expect(page.getByRole("button", { name: "Keep playing" })).toBeHidden();
  expect(await page.evaluate(() => document.activeElement?.tagName)).toBe("IFRAME");

  await tab.click();
  await page.getByRole("button", { name: "Start again" }).click();
  await loaded(page);

  await tab.click();
  await page.getByRole("link", { name: "Leave game" }).click();
  await expect(page).toHaveURL(`/g/${free.slug}`);
  await expect(page.locator("iframe")).toHaveCount(0);
});

test("the Menu tab moves, and stays where it was left", async ({ page }) => {
  await page.goto(`/g/${free.slug}/play`, { waitUntil: "domcontentloaded" });
  await loaded(page);
  const tab = tabOf(page);
  const view = page.viewportSize() ?? { width: 0, height: 0 };
  const from = await tab.boundingBox();
  if (from === null) throw new Error("the tab has no box");
  await page.mouse.move(from.x + 20, from.y + 20);
  await page.mouse.down();
  await page.mouse.move(view.width * 0.8, view.height * 0.66, { steps: 8 });
  await page.mouse.up();
  await expect(page.locator("details.menu")).toHaveAttribute("data-side", "right");
  await expect(page.locator("details.menu")).not.toHaveAttribute("open", "");
  await expect.poll(async () => (await tab.boundingBox())?.x).toBeGreaterThan(view.width - 60);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("details.menu")).toHaveAttribute("data-side", "right");

  await tab.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator("details.menu")).toHaveAttribute("data-side", "left");
  await expect.poll(async () => (await tab.boundingBox())?.x).toBeLessThan(2);
  // The tab glides for 200ms; it has settled when two looks in a row see it in the same place.
  const settledAt = async (): Promise<number> => {
    let last = -1;
    await expect
      .poll(async () => {
        const now = (await tab.boundingBox())?.y ?? 0;
        const same = now === last;
        last = now;
        return same;
      })
      .toBe(true);
    return last;
  };
  const before = await settledAt();
  await page.keyboard.press("ArrowUp");
  await expect.poll(async () => (await tab.boundingBox())?.y ?? before).toBeLessThan(before);
});

test("the Menu tab turns to the side it will snap to while it is carried, and the menu opens on the side the tab rests on", async ({
  page,
}) => {
  await page.goto(`/g/${free.slug}/play`, { waitUntil: "domcontentloaded" });
  await loaded(page);
  const tab = tabOf(page);
  const view = page.viewportSize() ?? { width: 0, height: 0 };
  const menu = page.locator("details.menu");
  const rounded = () => tab.evaluate((el) => getComputedStyle(el).borderTopLeftRadius);
  const from = await tab.boundingBox();
  if (from === null) throw new Error("the tab has no box");
  // At rest on the left its square edge is on the left and its rounded edge faces the game.
  expect(await rounded()).toBe("0px");
  await page.mouse.move(from.x + 20, from.y + 20);
  await page.mouse.down();
  await page.mouse.move(view.width * 0.3, view.height * 0.5, { steps: 6 });
  await expect(menu).toHaveAttribute("data-lean", "left");
  // Past the middle, still carried, it already faces the other way.
  await page.mouse.move(view.width * 0.8, view.height * 0.5, { steps: 6 });
  await expect(menu).toHaveAttribute("data-dragging", "");
  await expect(menu).toHaveAttribute("data-lean", "right");
  expect(await rounded()).not.toBe("0px");
  await page.mouse.up();
  await expect(menu).toHaveAttribute("data-side", "right");
  await expect(menu).not.toHaveAttribute("data-lean", /.*/);
  // On a phone held upright the menu is a sheet from the bottom; everywhere else it comes in from the tab's side.
  const sheet = view.width < 768 && view.height > view.width;
  if (sheet) return;
  const panel = page.locator(".menupanel");
  await tab.click();
  await expect(panel).toBeVisible();
  await expect
    .poll(async () => Math.round((await panel.boundingBox())?.x ?? 0))
    .toBeGreaterThan(view.width / 2 - 1);
  await page.keyboard.press("Escape");
  await tab.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(menu).toHaveAttribute("data-side", "left");
  await tab.click();
  await expect(panel).toBeVisible();
  await expect.poll(async () => Math.round((await panel.boundingBox())?.x ?? 99)).toBeLessThan(2);
});

test("the Menu tab never leaves the screen: dragged past an edge, kept from a taller window, or turned sideways", async ({
  page,
}) => {
  const inside = async (): Promise<void> => {
    const view = page.viewportSize() ?? { width: 0, height: 0 };
    await expect
      .poll(async () => {
        const box = await tabOf(page).boundingBox();
        return (
          box !== null &&
          box.x >= 0 &&
          box.y >= 0 &&
          box.x + box.width <= view.width + 0.5 &&
          box.y + box.height <= view.height + 0.5
        );
      })
      .toBe(true);
  };
  await page.goto(`/g/${free.slug}/play`, { waitUntil: "domcontentloaded" });
  await loaded(page);
  const tab = tabOf(page);
  const view = page.viewportSize() ?? { width: 0, height: 0 };
  const from = await tab.boundingBox();
  if (from === null) throw new Error("the tab has no box");

  // Dragged far past the bottom right corner: held inside while dragging, and after it is let go.
  await page.mouse.move(from.x + 20, from.y + 20);
  await page.mouse.down();
  await page.mouse.move(view.width + 300, view.height + 300, { steps: 8 });
  await expect(page.locator("details.menu")).toHaveAttribute("data-dragging", "");
  await inside();
  await page.mouse.up();
  await inside();

  // Dragged far past the top left corner.
  const now = await tab.boundingBox();
  if (now === null) throw new Error("the tab has no box");
  await page.mouse.move(now.x + 20, now.y + 20);
  await page.mouse.down();
  await page.mouse.move(-300, -300, { steps: 8 });
  await inside();
  await page.mouse.up();
  await inside();

  // A place kept at the very bottom of a taller window, then the window turned sideways.
  await page.evaluate(() => {
    localStorage.setItem("rk_menu_tab", JSON.stringify({ side: "right", height: 1 }));
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await loaded(page);
  await inside();
  await page.setViewportSize({
    width: Math.max(view.width, view.height),
    height: Math.min(view.width, view.height),
  });
  await inside();
});

test("a press that moves under 8px opens the menu, and the tab is frosted glass at rest", async ({
  page,
}) => {
  await page.goto(`/g/${free.slug}/play`, { waitUntil: "domcontentloaded" });
  await loaded(page);
  const tab = tabOf(page);
  const rest = await tab.evaluate((element) => {
    const style = getComputedStyle(element);
    return `${style.backgroundColor}|${style.backdropFilter || style.getPropertyValue("-webkit-backdrop-filter")}`;
  });
  // The glass token as the browser writes it: rgb(17 19 20 / 0.12) reads back as rgba(17, 19, 20, 0.12).
  const [red, green, blue, alpha] = token("--glass-bg").match(/[\d.]+/g) ?? [];
  expect(rest).toBe(`rgba(${red}, ${green}, ${blue}, ${alpha})|${token("--glass-filter")}`);
  const box = await tab.boundingBox();
  if (box === null) throw new Error("the tab has no box");
  await page.mouse.move(box.x + 20, box.y + 20);
  await page.mouse.down();
  await page.mouse.move(box.x + 24, box.y + 22);
  await page.mouse.up();
  await expect(page.getByRole("button", { name: "Keep playing" })).toBeVisible();
});

test("Full screen is offered only where the page can go full screen", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(document, "fullscreenEnabled", { value: false, configurable: true });
  });
  await page.goto(`/g/${free.slug}/play`, { waitUntil: "domcontentloaded" });
  await tabOf(page).click();
  await expect(page.getByRole("button", { name: "Full screen" })).toHaveCount(0);
});

test("the way out and every row are in sight with the menu open, in any window", async ({ page }) => {
  await page.goto(`/g/${free.slug}/play`, { waitUntil: "domcontentloaded" });
  await loaded(page);
  await tabOf(page).click();
  await expect(page.getByRole("link", { name: "Leave game" })).toBeInViewport({ ratio: 1 });
  await expect(page.getByText("Use this if the game is stuck.")).toBeInViewport({ ratio: 1 });
});

test("the menu is reached by the keyboard, with focus showing", async ({ page }) => {
  await page.goto(`/g/${free.slug}/play`, { waitUntil: "domcontentloaded" });
  await loaded(page);
  await tabOf(page).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Keep playing" })).toBeFocused();
  for (let step = 0; step < 6; step += 1) {
    await page.keyboard.press("Tab");
    const inside = await page.evaluate(() => document.activeElement?.closest(".menupanel") !== null);
    expect(inside).toBe(true);
    expect(
      await page.evaluate(() => getComputedStyle(document.activeElement as Element).outlineStyle),
    ).not.toBe("none");
  }
});

test("with no script, Menu then Leave game still leaves", async ({ browser }) => {
  const context = await browser.newContext({ baseURL: "http://localhost:4173", javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(`/g/${free.slug}/play`, { waitUntil: "domcontentloaded" });
  await page.locator("details.menu > summary").click();
  // By keyboard: with script off this page does not give Playwright's pointer click its "has stopped moving" check.
  await page.getByRole("link", { name: "Leave game" }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(`/g/${free.slug}`);
  await context.close();
});

test("starting says the game's name, and says so when it is slow", async ({ page }) => {
  await page.route(/g-[^/]*\.localhost:8788/, () => new Promise(() => undefined));
  await page.clock.install();
  await page.goto(`/g/${free.slug}/play`, { waitUntil: "commit" });
  await expect(page.getByText(`Starting ${free.name}…`)).toBeVisible();
  await pageHasSettled(page);
  await page.clock.runFor(20_000);
  await expect(page.getByText(`${free.name} is taking a while.`)).toBeVisible();
  await expect(page.getByRole("button", { name: "Start again" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Leave game" })).toBeVisible();
});

test("a game taken off Ruken is gone on the next load", async ({ page, browser, request }) => {
  test.setTimeout(120_000);
  const own = await addGame(browser, request, { free: true });
  await page.goto(`/g/${own.slug}/play`, { waitUntil: "domcontentloaded" });
  await loaded(page);
  const frameAddress = (await page.locator("iframe.frame").getAttribute("src")) ?? "";

  const context = await browser.newContext({ baseURL: "http://localhost:4173" });
  const maker = await context.newPage();
  await signInAs(maker, own.maker.number, own.maker.password);
  await maker.goto(`/make/${own.slug}/take-off`);
  await maker.getByRole("button", { name: /^Take it off/ }).click();
  await expect(maker.getByRole("heading", { level: 1 })).toHaveText("Taken off Ruken");
  await context.close();

  expect((await page.goto(`/g/${own.slug}`, { waitUntil: "domcontentloaded" }))?.status()).toBe(404);
  expect((await page.goto(`/g/${own.slug}/play`, { waitUntil: "domcontentloaded" }))?.status()).toBe(404);
  // Asked by a browser that has not seen it before: the player's own browser may still hold the file for the pass's life.
  const fresh = await browser.newContext();
  expect((await (await fresh.newPage()).goto(`${frameAddress}main.js`))?.status()).toBe(404);
  await fresh.close();
});

test("nothing on the play screen is red, and nothing scrolls sideways", async ({ page }) => {
  await page.goto(`/g/${free.slug}/play`, { waitUntil: "domcontentloaded" });
  await loaded(page);
  const sideways = () =>
    page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
  expect(await pipRed(page)).toEqual([]);
  expect(await sideways()).toBe(true);
  await tabOf(page).click();
  expect(await pipRed(page)).toEqual([]);
  expect(await sideways()).toBe(true);
});
