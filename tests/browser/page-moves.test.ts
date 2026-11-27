import { expect, test, type Page } from "@playwright/test";
import { addGame } from "./support/game.ts";
import { boxOf, showTheOwner } from "./support/look.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";
import {
  JOURNEY_PASSWORD,
  nationalOf,
  pageHasSettled,
  SITE_ANSWER_TIMEOUT,
  signUp,
  signUpInItsOwnContext,
} from "./support/account.ts";

// Ruken feels like an app, never a website loading pages (the owner, 2026-11-22: "the page should transition like a
// swipe when we go from Feed, Submit Game, You; we should almost never have page reload transitions because that's
// jarring"). Feed, Your games and You each carry the bar, and a move between them slides sideways the way the bar
// runs; nothing, a sent form included, loads a whole new page; and a person who asks for less motion gets none.

test.beforeEach(forgetRateLimits);

const bar = (page: Page) => page.getByRole("navigation", { name: "Ruken" });
const place = (page: Page, name: "Home" | "Add a game" | "You") =>
  bar(page).getByRole("link", { name, exact: true });

/** Leaves a mark in the page that a whole new page load would wipe. */
async function markThePage(page: Page): Promise<void> {
  // Before its script has come alive a page sends its forms the plain way, as it must without a script; the mark is
  // left once the page is alive (seen once on the computer: the sign-in was pressed before then).
  await pageHasSettled(page);
  await page.evaluate(() => {
    (window as unknown as { stayed: boolean }).stayed = true;
  });
}

/** The page is still the one that was marked: nothing loaded a whole new page since. */
async function expectNoNewPageLoad(page: Page): Promise<void> {
  expect(await page.evaluate(() => (window as unknown as { stayed?: boolean }).stayed)).toBe(true);
}

/** The way the last move slid: "on" from the right, "back" from the left, or none. */
function lastSlide(page: Page): Promise<string | undefined> {
  return page.evaluate(() => document.documentElement.dataset.move);
}

/** Signs in through the form, as a person would, without leaving the page. */
async function signIn(page: Page, number: string): Promise<void> {
  await page.getByLabel("Phone number").fill(nationalOf(number));
  await page.getByLabel("Password").fill(JOURNEY_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click({ timeout: SITE_ANSWER_TIMEOUT });
  await expect(page).toHaveURL("/");
  await pageHasSettled(page);
}

/** Stands in for a browser whose slide never starts (Safari in CI): it neither runs the move nor ever finishes. */
async function slideNeverStarts(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const never = new Promise<never>(() => {});
    const refused = Promise.reject(new DOMException("Skipped", "AbortError"));
    refused.catch(() => {});
    (document as unknown as { startViewTransition: () => unknown }).startViewTransition = () => ({
      ready: refused,
      finished: never,
      updateCallbackDone: never,
      skipTransition: () => {},
    });
  });
}

test("Feed, Your games and You slide sideways the way the bar runs, without a page load", async ({
  page,
  browser,
}, testInfo) => {
  const person = await signUpInItsOwnContext(browser);
  await page.goto("/sign-in");
  await markThePage(page);
  await signIn(page, person.number);
  await expect(place(page, "Home")).toHaveAttribute("aria-current", "page");

  await place(page, "Add a game").click();
  await expect(page).toHaveURL("/make");
  await expect(page.getByRole("heading", { name: "Your games" })).toBeVisible();
  await expect(place(page, "Add a game")).toHaveAttribute("aria-current", "page");
  expect(await lastSlide(page)).toBe("on");
  // Your games' own Add a game stays under its heading, clear of the bar, and the last line ends above the bar.
  const barBox = await boxOf(bar(page));
  const pageAdd = page.getByRole("main").getByRole("link", { name: "Add a game" });
  expect((await boxOf(pageAdd)).y + (await boxOf(pageAdd)).height).toBeLessThanOrEqual(barBox.y);
  await showTheOwner(page, testInfo, "Your games with the bar");

  await place(page, "You").click();
  await expect(page).toHaveURL("/me");
  await expect(page.getByRole("heading", { name: "Your account" })).toBeVisible();
  await expect(place(page, "You")).toHaveAttribute("aria-current", "page");
  expect(await lastSlide(page)).toBe("on");
  await page.evaluate(() => {
    document.body.scrollTo(0, document.body.scrollHeight);
  });
  const lastLine = await boxOf(page.getByRole("link", { name: "Delete my account" }));
  expect(lastLine.y + lastLine.height).toBeLessThanOrEqual((await boxOf(bar(page))).y);
  await showTheOwner(page, testInfo, "You with the bar");

  await place(page, "Add a game").click();
  await expect(page).toHaveURL("/make");
  expect(await lastSlide(page)).toBe("back");

  await place(page, "Home").click();
  await expect(page).toHaveURL("/");
  expect(await lastSlide(page)).toBe("back");

  await page.goBack();
  await expect(page).toHaveURL("/make");
  await expectNoNewPageLoad(page);
});

test("a form that is refused, a form that is answered and signing out all stay in the page", async ({
  page,
  browser,
}) => {
  const person = await signUpInItsOwnContext(browser);
  await page.goto("/sign-in");
  await markThePage(page);

  await page.getByLabel("Phone number").fill(nationalOf(person.number));
  await page.getByLabel("Password").fill("not the password at all");
  const signInButton = page.getByRole("button", { name: "Sign in" });
  await signInButton.click({ timeout: SITE_ANSWER_TIMEOUT });
  await expect(page.getByRole("alert")).toBeVisible();
  // The button is free again for the next try.
  await expect(signInButton).not.toHaveAttribute("aria-busy", /.*/);
  await expectNoNewPageLoad(page);

  await page.getByLabel("Password").fill(JOURNEY_PASSWORD);
  await signInButton.click({ timeout: SITE_ANSWER_TIMEOUT });
  await expect(page).toHaveURL("/");
  await pageHasSettled(page);
  await expectNoNewPageLoad(page);

  await place(page, "You").click();
  await expect(page.getByRole("heading", { name: "Your account" })).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL("/");
  await expectNoNewPageLoad(page);
  // Signed out for real: You asks to sign in.
  await place(page, "You").click();
  await expect(page).toHaveURL(/\/sign-in/);
  await expectNoNewPageLoad(page);
});

test("with less motion asked for, a move does not slide", async ({ page, browser }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const person = await signUpInItsOwnContext(browser);
  await page.goto("/sign-in");
  await markThePage(page);
  await signIn(page, person.number);
  await place(page, "You").click();
  await expect(page.getByRole("heading", { name: "Your account" })).toBeVisible();
  expect(await lastSlide(page)).toBeUndefined();
  await expectNoNewPageLoad(page);
});

test("a browser that skips the slide still shows the new page", async ({ page, browser, request }) => {
  // Safari in CI once left Back from the play screen on the old page: the address changed and the page never did.
  // Here the browser's slide never starts at all, the worst it can do.
  const free = await addGame(browser, request, { free: true });
  await slideNeverStarts(page);
  await page.goto(`/g/${free.slug}`);
  await markThePage(page);
  await page.getByRole("link", { name: "Play" }).click();
  await expect(page).toHaveURL(`/g/${free.slug}/play`);
  // The address changes before the page does, so wait for the game's page to go.
  await expect(page.getByRole("link", { name: "Play" })).toHaveCount(0);
  await page.goBack();
  await expect(page).toHaveURL(`/g/${free.slug}`);
  await expect(page.getByRole("link", { name: "Play" })).toBeVisible();
  await expectNoNewPageLoad(page);
});

test("a browser that skips the slide still shows the maker's next question", async ({ page }) => {
  await signUp(page);
  await slideNeverStarts(page);
  await page.goto("/make");
  await markThePage(page);
  await page.getByRole("main").getByRole("link", { name: "Add a game" }).click();
  await expect(page).toHaveURL("/make/new");
  await expect(page.getByText("Question 1 of 6")).toBeVisible();
  await expectNoNewPageLoad(page);
});

test("on a slow machine the new page waits until the browser has pictured the old one", async ({ page }) => {
  // Safari on a busy CI phone pictured the old page more than a second late, and the page came in before it, so the
  // clip had nothing to move from. Here each frame takes 250 ms and the picture comes on the fifth frame.
  await page.addInitScript(() => {
    const seen = window as unknown as { oldPageWhenPictured?: string };
    (
      document as unknown as { startViewTransition: (update: () => Promise<void>) => unknown }
    ).startViewTransition = (update) => {
      let frames = 0;
      const done = new Promise<void>((resolve) => {
        const frame = () => {
          const until = performance.now() + 250;
          while (performance.now() < until) {
            // A busy machine: this frame takes a quarter of a second to draw.
          }
          frames += 1;
          if (frames < 5) {
            requestAnimationFrame(frame);
            return;
          }
          seen.oldPageWhenPictured = document.querySelector("h1")?.textContent ?? "";
          void update().then(resolve);
        };
        requestAnimationFrame(frame);
      });
      return { ready: done, finished: done, updateCallbackDone: done, skipTransition: () => {} };
    };
  });
  await page.goto("/sign-in");
  await markThePage(page);
  await page.getByRole("link", { name: "Create an account" }).click();
  await expect(page).toHaveURL(/\/sign-up/);
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as { oldPageWhenPictured?: string }).oldPageWhenPictured),
    )
    .toBe("Sign in");
  await expect(page.getByRole("heading", { level: 1 })).not.toHaveText("Sign in");
  await expectNoNewPageLoad(page);
});

test("a browser whose slide hangs without a word still shows the new page", async ({ page }) => {
  // The slide neither starts nor says it failed: the new page comes in once a few frames have gone by.
  await page.addInitScript(() => {
    const never = new Promise<never>(() => {});
    (document as unknown as { startViewTransition: () => unknown }).startViewTransition = () => ({
      ready: never,
      finished: never,
      updateCallbackDone: never,
      skipTransition: () => {},
    });
  });
  await page.goto("/sign-in");
  await markThePage(page);
  await page.getByRole("link", { name: "Create an account" }).click();
  await expect(page).toHaveURL(/\/sign-up/);
  await expect(page.getByRole("heading", { level: 1 })).not.toHaveText("Sign in", { timeout: 2000 });
  await expectNoNewPageLoad(page);
});

test("Back pressed while a page is still sliding in comes back, and stays back", async ({ page }) => {
  // The slide holds the new page until the old one has been pictured, which on a busy phone takes a moment (Safari in
  // CI, Back from a game opened in the feed). Here the picture takes 600 ms, and Back is pressed in that time.
  await page.addInitScript(() => {
    (
      document as unknown as { startViewTransition: (update: () => Promise<void>) => unknown }
    ).startViewTransition = (update) => {
      const done = new Promise<void>((resolve) => {
        setTimeout(() => {
          void update().then(resolve);
        }, 600);
      });
      return { ready: Promise.resolve(), finished: done, updateCallbackDone: done, skipTransition: () => {} };
    };
  });
  await page.goto("/sign-in");
  await markThePage(page);
  await page.getByRole("link", { name: "Create an account" }).click();
  await expect(page).toHaveURL(/\/sign-up/);
  await page.goBack();
  await expect(page).toHaveURL(/\/sign-in/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sign in");
  // Well after the held slide has let its page go: the page that was left behind does not come back over this one.
  await page.waitForTimeout(1500);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sign in");
  await expectNoNewPageLoad(page);
});
