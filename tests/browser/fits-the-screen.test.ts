import { expect, test, type Page } from "@playwright/test";
import { pageHasSettled, payAsNewMember, signUp } from "./support/account.ts";
import { CONSENTED_STATE } from "./support/consent.ts";
import { asInstalled } from "./support/installed.ts";
import { boxOf, showTheOwner, wordsHaveSettled } from "./support/look.ts";
import { addGame } from "./support/game.ts";
import { atLaunch, beforeLaunch } from "./support/launch.ts";
import { playtestScene } from "./support/playtest.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

// Inside the app the page never scrolls; it works like an app's one window (the owner, 2026-11-24: "within the app ... it
// functions like a single page app and we shouldn't ever need to scroll, and if we do, it should still be single page
// but it scrolls within the view, but even then that should be rare"). A screen's view ends above the bar, so the bar
// never covers a button (the owner's picture: on Your account the bar covered Delete my account). A phone held sideways
// in a browser tab is asked to turn upright and add Ruken to the Home Screen ("we block horizontal and tell them to save
// it to homepage"); opened from there it works sideways. Nothing here is made or saved, so there is no create, update or
// delete: the journeys that make an account and delete it are me.test.ts and delete-account.test.ts.

test.beforeEach(forgetRateLimits);

const bar = (page: Page) => page.getByRole("navigation", { name: "Ruken" });

/** How far the page itself and the screen's view run past the window: both 0 when the screen fits. */
async function overflow(page: Page): Promise<{ page: number; view: number }> {
  return page.evaluate(() => ({
    page: document.documentElement.scrollHeight - innerHeight,
    view: document.body.scrollHeight - document.body.clientHeight,
  }));
}

/**
 * Every button, link and field the bar covers. The view (the body) is cut off above the bar, so a line runs under it
 * only if the view itself reaches the bar: what is drawn of each line is the part inside the view.
 */
async function underTheBar(page: Page): Promise<string[]> {
  const top = (await boxOf(bar(page))).y;
  return page.evaluate(
    (barTop) =>
      [...document.querySelectorAll("main :is(a, button, input, select, textarea, summary)")]
        .filter((thing) => {
          const box = thing.getBoundingClientRect();
          const view = document.body.getBoundingClientRect();
          const drawnTop = Math.max(box.top, view.top);
          const drawnBottom = Math.min(box.bottom, view.bottom);
          return box.width > 0 && drawnBottom > drawnTop && drawnBottom > barTop;
        })
        .map((thing) => thing.textContent.trim() || (thing.getAttribute("aria-label") ?? "")),
    top,
  );
}

/** The view ends above the bar, so the bar has nothing of the screen under it. */
async function expectViewAboveTheBar(page: Page, path: string): Promise<void> {
  const viewBottom = await page.evaluate(() => document.body.getBoundingClientRect().bottom);
  expect(viewBottom, path).toBeLessThanOrEqual((await boxOf(bar(page))).y);
  expect(await underTheBar(page), path).toEqual([]);
}

async function opened(page: Page, path: string): Promise<void> {
  await page.goto(path);
  // Started, so a press is the app's own move and not a whole new page load.
  await pageHasSettled(page);
  await expect(bar(page)).toBeVisible();
  // Each line rises into place as a screen opens; measured mid-rise, a line still below its place counts as overflow.
  await wordsHaveSettled(page);
}

test.describe("signed out", () => {
  test.use({ storageState: CONSENTED_STATE });

  test("no screen scrolls the page, the bar covers nothing, and Cookies fits", async ({ page }) => {
    // Sign in, Join and Forgot password are forms taller than a small phone: they scroll inside their view.
    for (const path of ["/sign-in", "/sign-up", "/forgot-password", "/cookies", "/your-turn"]) {
      await opened(page, path);
      expect((await overflow(page)).page, path).toBe(0);
      await expectViewAboveTheBar(page, path);
    }
    expect((await overflow(page)).view).toBe(0);
  });
});

test("Your account and Your games fit the window, and the bar covers nothing", async ({
  page,
  isMobile,
}, testInfo) => {
  await signUp(page);
  for (const path of [
    "/me",
    "/make",
    "/me/password",
    "/me/computers",
    "/me/delete",
    "/me/saved",
    "/me/reposts",
    "/settings/feed",
    "/your-turn",
    "/your-turn/stopped",
  ]) {
    await opened(page, path);
    expect(await overflow(page), path).toEqual({ page: 0, view: 0 });
    await expectViewAboveTheBar(page, path);
  }
  await opened(page, "/me");
  await expect(page.getByRole("link", { name: "Delete my account" })).toBeInViewport();
  await showTheOwner(page, testInfo, "Your account fits the window");

  // The smallest phone still in use (320 by 568): Your account fits with nothing to scroll.
  await page.setViewportSize({ width: 320, height: 568 });
  await expect.poll(async () => (await overflow(page)).view).toBe(0);
  expect((await overflow(page)).page).toBe(0);
  await expectViewAboveTheBar(page, "/me at 320 by 568");
  await expect(page.getByRole("link", { name: "Delete my account" })).toBeInViewport();

  // Your feed fits an iPhone SE too, with Start over above the bar.
  await page.setViewportSize({ width: 375, height: 667 });
  await opened(page, "/settings/feed");
  expect(await overflow(page), "/settings/feed at 375 by 667").toEqual({ page: 0, view: 0 });
  await expectViewAboveTheBar(page, "/settings/feed at 375 by 667");
  await expect(page.getByRole("button", { name: "Start over" })).toBeInViewport();

  // And with more chips than the screen holds on both sides, the longest words first (audits 3 and 4): the chips' box
  // scrolls inside itself, so the page still fits and Back and Start over stay above the bar. Each chip added shows
  // where it landed, fully in the box and clear of its fade.
  // The button named, or the one with the focus.
  const inTheBox = (name: string, focused = false) =>
    page.evaluate(
      ([label, onlyFocused]) => {
        const thing = onlyFocused
          ? (document.activeElement ?? undefined)
          : [...document.querySelectorAll("main button, main a")].find(
              (one) => (one.getAttribute("aria-label") ?? one.textContent.trim()) === label,
            );
        const box = document.querySelector("main .tastes")?.getBoundingClientRect();
        if (thing === undefined) return `${label}: not found`;
        const at = thing.getBoundingClientRect();
        if (box === undefined) return "in";
        // The fade is the last 0.75rem of the box, and a side's name stays over the top of its chips.
        const name = thing.closest("section")?.querySelector("h2")?.getBoundingClientRect();
        const top = Math.max(box.top, name?.bottom ?? box.top);
        return at.top >= top - 1 && at.bottom <= box.bottom - 12 + 1
          ? "in"
          : `${label}: ${String(at.top)}-${String(at.bottom)}`;
      },
      [name, focused] as const,
    );
  const more = ["Racing and sports", "Building and life", "Puzzle", "Spooky", "Adventurous", "Heartfelt"];
  const less = ["Party and board", "Role-playing", "Cosy", "Bold", "Strategy", "Weird", "Story"];
  for (const [side, words] of [
    ...more.map((words) => ["See more of", words] as const),
    ...less.map((words) => ["See less of", words] as const),
  ]) {
    const region = side === "See more of" ? "What you want to see more of" : "What you want to see less of";
    await page
      .getByRole("region", { name: region })
      .getByRole("button", { name: "Add", exact: true })
      .click();
    const sheet = page.getByRole("dialog", { name: side });
    await sheet.getByRole("button", { name: words, exact: true }).click();
    await expect(sheet).toBeHidden();
    await expect.poll(() => inTheBox(`Remove ${words}`), `${words} shows where it landed`).toBe("in");
  }
  const scrolled = () => page.evaluate(() => document.querySelector("main .tastes")?.scrollTop ?? 0);
  const roomy = await page.evaluate(() => {
    const box = document.querySelector("main .tastes");
    return box !== null && box.scrollHeight > box.clientHeight;
  });
  expect(roomy, "the chips are more than the box shows, so it scrolls inside itself").toBe(true);
  // A mouse's wheel scrolls the box (not on a phone, which has no wheel).
  await page.evaluate(() => document.querySelector("main .tastes")?.scrollTo({ top: 0 }));
  if (!isMobile) {
    await page.getByRole("heading", { name: "What you want to see more of" }).hover();
    await page.mouse.wheel(0, 300);
    await expect.poll(scrolled, "the wheel over the more side scrolls the chips").toBeGreaterThan(0);
    // And over the less side, from the bottom back up.
    await page.evaluate(() => document.querySelector("main .tastes")?.scrollTo({ top: 100_000 }));
    const bottom = await scrolled();
    await page.getByRole("heading", { name: "What you want to see less of" }).hover();
    await page.mouse.wheel(0, -300);
    await expect.poll(scrolled, "the wheel over the less side scrolls the chips").toBeLessThan(bottom);
    await page.evaluate(() => document.querySelector("main .tastes")?.scrollTo({ top: 0 }));
  }
  // Moving focus, as a keyboard or a gamepad's pad does, reaches every button in turn, each fully in view.
  await page.getByRole("switch", { name: "Learn from what I do" }).focus();
  const reached: string[] = [];
  for (let press = 0; press < 60; press++) {
    await page.keyboard.press("Tab");
    const name = await page.evaluate(() => {
      const thing = document.activeElement;
      return thing instanceof HTMLElement
        ? (thing.getAttribute("aria-label") ?? thing.textContent.trim())
        : null;
    });
    if (name === null || name === "Start over") break;
    if (name === "Back to your account") continue;
    await expect.poll(() => inTheBox(name, true), `${name} is in view when focused`).toBe("in");
    reached.push(name);
  }
  for (const words of [...more, ...less]) expect(reached).toContain(`Remove ${words}`);
  // Taking a chip off from the keys leaves the focus on the chip that took its place, not back at the top.
  await page.getByRole("button", { name: "Remove Cosy" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Remove Cosy" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Remove Bold" })).toBeFocused();
  await expect.poll(() => inTheBox("Remove Bold", true), "the chip with the focus is in view").toBe("in");
  await wordsHaveSettled(page);
  expect(await overflow(page), "/settings/feed with chips at 375 by 667").toEqual({ page: 0, view: 0 });
  await expectViewAboveTheBar(page, "/settings/feed with chips at 375 by 667");
  await expect(page.getByRole("button", { name: "Start over" })).toBeInViewport();
  await expect(page.getByRole("link", { name: "Back to your account" })).toBeInViewport();
  // On a computer's window too, with the same chips.
  if (!isMobile) {
    await page.setViewportSize({ width: 1280, height: 720 });
    await wordsHaveSettled(page);
    expect(await overflow(page), "/settings/feed with chips at 1280 by 720").toEqual({ page: 0, view: 0 });
    await expect(page.getByRole("button", { name: "Start over" })).toBeInViewport();
  }
});

test("a member's Your account fits too, down to an iPhone SE", async ({ page }) => {
  // A member's account has more on it than a newcomer's: the line that says when it renews, the button that manages
  // the membership and the note under it, in place of Join Ruken.
  test.setTimeout(90_000);
  await payAsNewMember(page);
  await expect(page.getByText("Member", { exact: true })).toBeVisible();
  for (const size of [page.viewportSize(), { width: 375, height: 667 }]) {
    if (size === null) continue;
    await page.setViewportSize(size);
    const where = `a member's /me at ${String(size.width)} by ${String(size.height)}`;
    await expect.poll(async () => (await overflow(page)).view, where).toBe(0);
    expect((await overflow(page)).page, where).toBe(0);
    await expectViewAboveTheBar(page, where);
    await expect(page.getByRole("link", { name: "Delete my account" })).toBeInViewport();
  }

  // On the smallest phone (320 by 568) a member's account is a little taller than the window: it scrolls inside its
  // view (the owner, 2026-11-24: "rare scroll is fine"), the page never does, and its end clears the bar.
  await page.setViewportSize({ width: 320, height: 568 });
  await expect.poll(async () => (await overflow(page)).page).toBe(0);
  await page.evaluate(() => {
    document.body.scrollTo(0, document.body.scrollHeight);
  });
  await expectViewAboveTheBar(page, "a member's /me at 320 by 568");
  await expect(page.getByRole("link", { name: "Delete my account" })).toBeInViewport();
});

test.describe("a long screen", () => {
  test.use({ storageState: CONSENTED_STATE });

  test("scrolls inside its view, never the page, and its end clears the bar", async ({ page, isMobile }) => {
    await opened(page, "/privacy");
    expect((await overflow(page)).page).toBe(0);
    expect((await overflow(page)).view).toBeGreaterThan(0);

    // The keys move the view straight away, with nothing pressed first: the view holds the focus. Safari glides there,
    // and a key pressed mid-glide is lost, so wait until it rests.
    const top = () => page.evaluate(() => document.body.scrollTop);
    for (const key of ["ArrowDown", "PageDown", "Space"]) {
      const before = await top();
      await page.keyboard.press(key);
      await expect.poll(top, key).toBeGreaterThan(before);
    }
    await page.keyboard.press("End");
    await expect
      .poll(() => page.evaluate(() => Math.ceil(document.body.scrollTop + document.body.clientHeight)))
      .toBeGreaterThanOrEqual(await page.evaluate(() => document.body.scrollHeight - 1));
    expect(await page.evaluate(() => scrollY)).toBe(0);
    expect(await underTheBar(page)).toEqual([]);
    await page.keyboard.press("Home");
    await expect.poll(top).toBe(0);

    // After a move inside the app, the next long screen takes the keys too.
    await page.getByRole("link", { name: "Read the terms" }).click();
    await expect(page).toHaveURL("/terms");
    await expect.poll(top).toBe(0);
    await page.keyboard.press("PageDown");
    await expect.poll(top).toBeGreaterThan(0);

    if (!isMobile) {
      await page.keyboard.press("Home");
      await expect.poll(top).toBe(0);
      await page.mouse.move(200, 200);
      await page.mouse.wheel(0, 600);
      await expect.poll(() => page.evaluate(() => document.body.scrollTop)).toBeGreaterThan(0);
      expect(await page.evaluate(() => scrollY)).toBe(0);
    }
  });

  test("the next screen opens at its top, and Back finds the last one where it was left", async ({
    page,
  }) => {
    await opened(page, "/privacy");
    await page.evaluate(() => {
      document.body.scrollTo(0, 400);
    });
    await expect.poll(() => page.evaluate(() => document.body.scrollTop)).toBe(400);
    await page.getByRole("link", { name: "You" }).click();
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.body.scrollTop)).toBe(0);
    await page.goBack();
    await expect(page).toHaveURL("/privacy");
    await expect.poll(() => page.evaluate(() => document.body.scrollTop)).toBe(400);
  });
});

test.describe("a game's page", () => {
  test.use({ storageState: CONSENTED_STATE });

  test("ends its view above the bar, so the bar covers none of it, before launch and after", async ({
    page,
    context,
    browser,
    request,
  }) => {
    test.setTimeout(180_000);
    // The review of #435 found the bar on its Join and its Wishlist on a small phone's first screen.
    const game = await addGame(browser, request);
    for (const when of ["after launch", "before launch"] as const) {
      if (when === "before launch") await beforeLaunch(context);
      await opened(page, `/g/${game.slug}`);
      expect((await overflow(page)).page, when).toBe(0);
      await expectViewAboveTheBar(page, `/g/${game.slug}, ${when}`);
    }
    await atLaunch(context);
  });
});

// Playtesting, before launch, at its fullest: the maker's page with someone asking and someone playing, its invite
// sheet, and a playtester's and an asker's game page. Upright the view ends above the bar; sideways (the bar on the
// right) the page still never scrolls, and the sheet is wholly in the window at every size.
test("playtesting's screens fit the window at every phone size, and the bar covers nothing", async ({
  browser,
}) => {
  test.setTimeout(240_000);
  const scene = await playtestScene(browser);
  const sizes = [
    { width: 320, height: 568, upright: true },
    { width: 375, height: 667, upright: true },
    { width: 667, height: 375, upright: false },
  ];
  try {
    for (const size of sizes) {
      const at = `at ${String(size.width)} by ${String(size.height)}`;
      for (const [page, path] of [
        [scene.maker.page, scene.playtesters],
        [scene.tester.page, `/g/${scene.slug}`],
        [scene.asker.page, `/g/${scene.slug}`],
      ] as const) {
        await page.setViewportSize(size);
        await opened(page, path);
        expect((await overflow(page)).page, `${path} ${at}`).toBe(0);
        if (size.upright) await expectViewAboveTheBar(page, `${path} ${at}`);
      }
      const maker = scene.maker.page;
      await opened(maker, `${scene.playtesters}?invite`);
      const sheet = maker.getByRole("dialog", { name: "Invite playtesters" });
      await expect(sheet).toBeVisible();
      await expect(sheet).toBeInViewport({ ratio: 1 });
      expect((await overflow(maker)).page, `the invite sheet ${at}`).toBe(0);
    }
  } finally {
    await scene.close();
  }
});

test.describe("a phone held sideways", () => {
  test.use({ storageState: CONSENTED_STATE, viewport: { width: 667, height: 375 } });
  test.beforeEach(() => {
    test.skip(
      test.info().project.name !== "phone",
      "the window is set here, so the phone's engine is enough",
    );
  });

  const turnUpright = (page: Page) => page.getByRole("dialog", { name: "Turn your phone upright" });

  test("in a browser tab, it asks for the phone upright and how to use Ruken sideways", async ({
    page,
  }, testInfo) => {
    await page.goto("/sign-in");
    await expect(turnUpright(page)).toBeVisible();
    await expect(turnUpright(page)).toContainText("add it to your Home Screen");
    await showTheOwner(page, testInfo, "sideways in a browser tab");

    // Turned upright, the screen is there as it was.
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(turnUpright(page)).toBeHidden();
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();

    // The landing page is a web page, and reads sideways.
    await page.setViewportSize({ width: 667, height: 375 });
    await page.goto("/about");
    await page.locator("main.about").waitFor();
    await expect(turnUpright(page)).toHaveCount(0);
  });

  test("opened from the Home Screen, it works sideways with the bar on the right", async ({ page }) => {
    await asInstalled(page);
    await page.goto("/sign-in");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect(turnUpright(page)).toBeHidden();
    const box = await boxOf(bar(page));
    expect(box.height).toBeGreaterThan(box.width);
    expect(box.x + box.width).toBeGreaterThan(667 - 24);
  });
});
