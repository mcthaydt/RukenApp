import { expect, test } from "@playwright/test";
import { finishSignUpForm, freshNumber, nationalOf, pageHasSettled, signInAs } from "./support/account.ts";
import { addGame, connectGitHubFromFiles, holdAnswersTo, startAtFiles } from "./support/game.ts";
import { beforeLaunch } from "./support/launch.ts";
import { showTheOwner } from "./support/look.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

// Every wait shows it (this-repo, "Every wait shows it"). Each journey holds the site's answer back, the way a slow
// phone line would, looks for the loading sign while it is held, then lets it through and sees the sign go.

test.beforeEach(forgetRateLimits);

test("moving to another page shows only the spinner, once the page has taken over 2 seconds", async ({
  page,
}, testInfo) => {
  // The page's own clock, so the 2 seconds are counted exactly rather than waited out.
  await page.clock.install();
  await page.goto("/sign-in");
  await pageHasSettled(page);
  const held = await holdAnswersTo(page, /\/sign-up\/__data\.json/);

  await page.getByRole("link", { name: "Create an account" }).click();
  await expect.poll(() => held.requestsSoFar()).toBe(1);

  // The owner, 2026-11-24: "only show the spinner if more than 2 seconds have elapsed", for pages. A page that comes
  // inside 2 seconds never shows it.
  const bar = page.getByRole("progressbar", { name: "Loading the page" });
  await page.clock.runFor(1_900);
  await expect(bar).toHaveCount(0);
  await page.clock.runFor(200);
  await expect(bar).toBeVisible();
  await expect(page.locator(".page-loading")).toHaveCount(0);
  await showTheOwner(page, testInfo, "the spinner while a page loads");
  held.release();
  await expect(page.getByRole("heading", { name: "Join Ruken" })).toBeVisible();
  await expect(bar).toHaveCount(0);
});

test("a plain form shows its button busy while it sends, and a second press sends nothing", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await pageHasSettled(page);
  await page.getByLabel("Phone number").fill(nationalOf(freshNumber()));
  await page.getByLabel("Password").fill("not the password at all");
  const held = await holdAnswersTo(page, /\/sign-in/);
  // While a plain form's page load is out, Playwright waits for it before it reads the page, so the page reports what
  // it sees itself: the button as the press leaves it, and whether a second press went out.
  const seen: string[] = [];
  page.on("console", (message) => {
    seen.push(message.text());
  });
  await page.evaluate(() => {
    let presses = 0;
    document.addEventListener("submit", (event) => {
      presses += 1;
      const button = event.submitter;
      if (presses === 1 && event.target instanceof HTMLFormElement && button instanceof HTMLButtonElement) {
        console.log(`busy=${String(button.getAttribute("aria-busy"))}`);
        const form = event.target;
        setTimeout(() => {
          form.requestSubmit(button);
        }, 0);
      } else {
        console.log(`second press stopped=${String(event.defaultPrevented)}`);
      }
    });
  });

  // The press leaves the page, and the answer is held, so the click does not wait for the page to load.
  await page.getByRole("button", { name: "Sign in" }).click({ noWaitAfter: true });

  // The form is sent from inside the page (src/lib/stay-in-app.ts), which sends it once more through SvelteKit's own
  // sender; that send and the second press are each stopped from going out as a plain page load.
  await expect.poll(() => seen.length).toBeGreaterThanOrEqual(3);
  expect(seen[0]).toBe("busy=true");
  expect(new Set(seen.slice(1))).toEqual(new Set(["second press stopped=true"]));
  // The page's words and the held post reach the journey by separate messages, in either order, so the post is waited
  // for too (run on #315: read at once, it was still 0 while a recording slowed the browser).
  await expect.poll(() => held.requestsSoFar()).toBe(1);
  held.release();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in" })).not.toHaveAttribute("aria-busy", "true");
});

test("a video shimmers, with a spinner, until it has loaded", async ({
  page,
  browser,
  request,
  browserName,
}, testInfo) => {
  test.setTimeout(180_000);
  const game = await addGame(browser, request);
  await page.goto(`/g/${game.slug}`);
  await pageHasSettled(page);
  // Opening the page again with every clip held back (the games' address serves them from its media name).
  const held = await holdAnswersTo(page, /\/\/media\./);
  // Not the page's load event: WebKit holds that back until the held clips have come, so the reload would never end.
  await page.reload({ waitUntil: "domcontentloaded" });
  await pageHasSettled(page);

  const loading = page.locator("video[data-loading]");
  await expect(loading.first()).toBeVisible();
  // Owner, 2026-11-22: "The videos don't have a spinner before they load in the panel": a spinner turns in it too.
  await expect(loading.first()).toHaveCSS(
    "background-image",
    /^url\("data:image\/svg\+xml.*animateTransform/,
  );
  // The picture waits for the page's fonts, and WebKit says its fonts are ready only once the held clips have come, so
  // the phone would wait for ever. The tablet and the computer still take it.
  if (browserName !== "webkit") await showTheOwner(page, testInfo, "a video while it loads");
  held.release();
  await expect(loading).toHaveCount(0);
});

test("a clip in the feed shows the spinner until it has loaded", async ({ page, browser, request }) => {
  test.setTimeout(180_000);
  const game = await addGame(browser, request);
  const held = await holdAnswersTo(page, /\/\/media\./);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await pageHasSettled(page);

  const clip = page.locator(`section[data-slug="${game.slug}"] video`).first();
  await clip.scrollIntoViewIfNeeded();
  await expect(clip).toHaveAttribute("data-loading", "");
  await expect(clip).toHaveCSS("background-image", /^url\("data:image\/svg\+xml.*animateTransform/);
  held.release();
  await expect(clip).not.toHaveAttribute("data-loading");
});

// Owner, 2026-11-22, on "Change your upright video": "The videos don't have a spinner before they load in the panel".
test("the maker's upright video panel, and what players will see, show the spinner until the videos load", async ({
  page,
  browser,
  request,
}) => {
  test.setTimeout(180_000);
  const game = await addGame(browser, request);
  await signInAs(page, game.maker.number, game.maker.password);
  const held = await holdAnswersTo(page, /\/\/media\./);
  await page.goto(`/make/${game.slug}/upright?again=1`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Change your upright video");

  const panel = page.locator(".vframe video");
  await expect(panel).toHaveAttribute("data-loading", "");
  await expect(panel).toHaveCSS("background-image", /^url\("data:image\/svg\+xml.*animateTransform/);
  const loading = page.locator("video[data-loading]");
  for (const video of await loading.all()) {
    await expect(video).toHaveCSS("background-image", /^url\("data:image\/svg\+xml.*animateTransform/);
  }
  held.release();
  await expect(loading).toHaveCount(0);
});

test("ticking another game on GitHub says the branches are being looked up", async ({ page }) => {
  const { slug } = await startAtFiles(page);
  await connectGitHubFromFiles(page, slug);
  await pageHasSettled(page);
  const held = await holdAnswersTo(page, /\/branches/);

  const radios = page.getByRole("radio");
  const unticked = (await radios.nth(0).isChecked()) ? radios.nth(1) : radios.nth(0);
  await unticked.check();

  const spinner = page.getByRole("progressbar", { name: "Looking up branches" });
  await expect(spinner).toBeVisible();
  held.release();
  await expect(spinner).toHaveCount(0);
});

test("Wishlist shows it is busy while it sends, and keeps the keyboard's focus", async ({
  page,
  browser,
  request,
}) => {
  test.setTimeout(150_000);
  const game = await addGame(browser, request);
  await page.goto("/sign-up");
  await finishSignUpForm(page, freshNumber());
  await expect(page).toHaveURL("/");
  await beforeLaunch(page.context());
  await page.goto(`/g/${game.slug}`);
  await pageHasSettled(page);
  const held = await holdAnswersTo(page, new RegExp(`/g/${game.slug}/wishlist$`));

  const button = page.getByRole("button", { name: "Wishlist", exact: true });
  await button.focus();
  await page.keyboard.press("Enter");
  const busy = page.getByRole("button", { name: "Wishlist", exact: true });
  await expect(busy).toHaveAttribute("aria-busy", "true");
  await expect(busy).toBeFocused();
  // A second press while the first is out sends nothing more.
  await page.keyboard.press("Enter");
  expect(held.requestsSoFar()).toBe(1);

  held.release();
  const done = page.getByRole("button", { name: "On your wishlist", exact: true });
  await expect(done).toBeVisible();
  await expect(done).not.toHaveAttribute("aria-busy", "true");
  await expect(done).toBeFocused();
});
