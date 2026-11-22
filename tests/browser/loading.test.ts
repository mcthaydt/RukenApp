import { expect, test } from "@playwright/test";
import { freshNumber, nationalOf, pageHasSettled } from "./support/account.ts";
import { addGame, connectGitHubFromFiles, holdAnswersTo, startAtFiles } from "./support/game.ts";
import { showTheOwner } from "./support/look.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

// Every wait shows it (this-repo, "Every wait shows it"). Each journey holds the site's answer back, the way a slow
// phone line would, looks for the loading sign while it is held, then lets it through and sees the sign go.

test.beforeEach(forgetRateLimits);

test("moving to another page shows the loading bar until the page arrives", async ({ page }, testInfo) => {
  await page.goto("/sign-in");
  await pageHasSettled(page);
  const held = await holdAnswersTo(page, /\/sign-up\/__data\.json/);

  await page.getByRole("link", { name: "Create an account" }).click();

  const bar = page.getByRole("progressbar", { name: "Loading the page" });
  await expect(bar).toBeVisible();
  await showTheOwner(page, testInfo, "loading bar while a page loads");
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

  await expect.poll(() => seen).toEqual(["busy=true", "second press stopped=true"]);
  expect(held.requestsSoFar()).toBe(1);
  held.release();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in" })).not.toHaveAttribute("aria-busy", "true");
});

test("a video shimmers until it has loaded", async ({ page, browser, request, browserName }, testInfo) => {
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
  // The picture waits for the page's fonts, and WebKit says its fonts are ready only once the held clips have come, so
  // the phone would wait for ever. The tablet and the computer still take it.
  if (browserName !== "webkit") await showTheOwner(page, testInfo, "a video while it loads");
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

  await expect(page.getByText("Looking up branches…")).toBeVisible();
  held.release();
  await expect(page.getByText("Looking up branches…")).toHaveCount(0);
});
