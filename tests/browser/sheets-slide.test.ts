import { expect, test, type Locator, type Page } from "@playwright/test";
import { pageHasSettled, signUp } from "./support/account.ts";
import { consented } from "./support/consent.ts";
import { gameWhere } from "./support/game.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

// The panels that rise over a screen slide away the way they came in, whichever way the person leaves them (the owner,
// 2026-11-27: "The pull up panel has a transition in animation, but no transition out animation"). The Share panel's
// own journey is in feed-controls.test.ts; this one covers the ••• panel on the feed and Report on a game's page.

const SITE = "http://localhost:4173";

let live: { slug: string; name: string };

test.beforeAll(async ({ browser }) => {
  test.setTimeout(180_000);
  await forgetRateLimits();
  const context = await browser.newContext({ ...consented, baseURL: SITE });
  try {
    live = await gameWhere(await context.newPage(), { state: "live" });
  } finally {
    await context.close();
  }
});
test.beforeEach(forgetRateLimits);
test.use(consented);

/**
 * From now on, writes down the panel's own animations by name each time it opens or starts to close (not the dimmed
 * screen's, which run beside them). Answers a call that reads the names so far.
 */
async function recordSlides(page: Page, panel: string): Promise<() => Promise<string[]>> {
  await page.evaluate((selector) => {
    const names: string[] = [];
    (window as unknown as { slides: string[] }).slides = names;
    new MutationObserver((changes) => {
      for (const change of changes) {
        const dialog = change.target as Element;
        if (!dialog.matches(selector)) continue;
        for (const animation of dialog.getAnimations()) {
          if ((animation.effect as KeyframeEffect | null)?.pseudoElement) continue;
          const name = (animation as CSSAnimation).animationName;
          if (names.at(-1) !== name) names.push(name);
        }
      }
    }).observe(document.body, { subtree: true, attributeFilter: ["open", "class"] });
  }, panel);
  return () => page.evaluate(() => (window as unknown as { slides: string[] }).slides);
}

/** The names a panel's slide in and slide away have at this window's size. */
async function slidesHere(page: Page): Promise<{ open: string; shut: string }> {
  const upright = await page.evaluate(
    () => matchMedia("(orientation: portrait) and (max-width: 47.99rem)").matches,
  );
  return upright ? { open: "sheet-up", shut: "sheet-down" } : { open: "sheet-in", shut: "sheet-out" };
}

/** A gamepad's B on an open panel, as the gamepad layer presses it: the panel is asked to close, and may slide first. */
async function pressB(panel: Locator): Promise<void> {
  await panel.evaluate((dialog: HTMLDialogElement) => {
    const ask = new Event("cancel", { cancelable: true });
    if (dialog.dispatchEvent(ask)) dialog.close();
  });
}

test("the ••• panel slides away for Cancel, Escape, the dimmed screen, a gamepad's B and a choice", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await signUp(page);
  await page.goto(`/?at=${live.slug}`);
  await pageHasSettled(page);
  const clip = page.locator(`section[data-slug="${live.slug}"]`).first();
  const opener = clip.getByRole("button", { name: "More or less like this" });
  await expect(opener).toBeVisible();
  const panel = page.locator("dialog.tastesheet");
  const slides = await recordSlides(page, "dialog.tastesheet");
  const { open, shut } = await slidesHere(page);
  const ways: [string, () => Promise<void>][] = [
    ["Cancel", () => panel.getByRole("button", { name: "Cancel" }).click()],
    ["Escape", () => page.keyboard.press("Escape")],
    ["the dimmed screen", () => page.mouse.click(5, 5)],
    ["a gamepad's B", () => pressB(panel)],
    ["More like this", () => panel.getByRole("button", { name: "More like this" }).click()],
  ];
  const expected: string[] = [];
  for (const [way, leave] of ways) {
    await opener.click();
    await expect(panel, `opens before ${way}`).toBeVisible();
    await leave();
    await expect(panel, `${way} closes it`).toBeHidden();
    expected.push(open, shut);
    expect(await slides(), `${way} slides it away`).toEqual(expected);
  }
  await expect(page.getByRole("status").filter({ hasText: "Got it." })).toBeVisible();
});

test("the Report panel slides in, and away for the cross, Escape and a gamepad's B", async ({ page }) => {
  await signUp(page);
  await page.goto(`/g/${live.slug}`);
  await pageHasSettled(page);
  const opener = page.getByRole("button", { name: "Report", exact: true });
  const panel = page.locator("dialog.reportsheet");
  const slides = await recordSlides(page, "dialog.reportsheet");
  const { open, shut } = await slidesHere(page);
  const ways: [string, () => Promise<void>][] = [
    ["the cross", () => panel.getByRole("button", { name: "Close" }).click()],
    ["Escape", () => page.keyboard.press("Escape")],
    ["a gamepad's B", () => pressB(panel)],
  ];
  const expected: string[] = [];
  for (const [way, leave] of ways) {
    await opener.click();
    await expect(
      panel.getByRole("heading", { name: "Report this game" }),
      `opens before ${way}`,
    ).toBeVisible();
    await leave();
    await expect(panel, `${way} closes it`).toBeHidden();
    await expect(opener, `focus goes back after ${way}`).toBeFocused();
    expected.push(open, shut);
    expect(await slides(), `${way} slides it away`).toEqual(expected);
  }
});

test("with reduced motion the panels simply come and go", async ({ browser }) => {
  const context = await browser.newContext({ ...consented, reducedMotion: "reduce", baseURL: SITE });
  try {
    const page = await context.newPage();
    await signUp(page);
    await page.goto(`/?at=${live.slug}`);
    await pageHasSettled(page);
    const opener = page.locator(`section[data-slug="${live.slug}"]`).first().getByRole("button", {
      name: "More or less like this",
    });
    const panel = page.locator("dialog.tastesheet");
    const slides = await recordSlides(page, "dialog.tastesheet");
    await opener.click();
    await expect(panel).toBeVisible();
    await panel.getByRole("button", { name: "Cancel" }).click();
    await expect(panel).toBeHidden();
    await expect(opener).toBeFocused();
    expect(await slides()).toEqual([]);
  } finally {
    await context.close();
  }
});
