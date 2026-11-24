import { expect, test, type Page } from "@playwright/test";
import { addGame } from "./support/game.ts";
import { pageHasSettled } from "./support/account.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

// Opening a game from the feed slides its page in from the right, the way every other move in Ruken slides (the owner,
// 2026-11-23: "It'd also be nice if the feed does a page transition to the game page since we have page transitions
// everywhere else"), and Back slides the feed back in from the left. A slide the browser starts and then throws away
// looks to a person like no slide at all, so the journey checks that each slide really played.

let game: Awaited<ReturnType<typeof addGame>>;

test.beforeAll(async ({ browser, request }) => {
  test.setTimeout(240_000);
  await forgetRateLimits();
  game = await addGame(browser, request);
});
test.beforeEach(forgetRateLimits);

/** Keeps, for each slide the page starts, whether it played ("played") or the browser threw it away (its reason). */
async function watchSlides(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const seen: string[] = [];
    (window as unknown as { slides: string[] }).slides = seen;
    const start = document.startViewTransition.bind(document);
    document.startViewTransition = ((update: ViewTransitionUpdateCallback) => {
      const slide = start(update);
      const at = seen.push("started") - 1;
      slide.ready.then(
        () => {
          seen[at] = "played";
        },
        (why: unknown) => {
          seen[at] = why instanceof Error ? `${why.name}: ${why.message}` : String(why);
        },
      );
      return slide;
    }) as typeof document.startViewTransition;
  });
}

/** What became of each slide so far, once none is still starting. */
async function slides(page: Page): Promise<string[]> {
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { slides: string[] }).slides.includes("started")))
    .toBe(false);
  return page.evaluate(() => [...(window as unknown as { slides: string[] }).slides]);
}

const lastMove = (page: Page) => page.evaluate(() => document.documentElement.dataset.move);

test("a game opened from the feed slides in from the right, and Back slides the feed back", async ({
  page,
}) => {
  test.skip(
    !(await page.evaluate(() => "startViewTransition" in document)),
    "this browser has no view transitions, so every move comes at once",
  );
  await watchSlides(page);
  await page.goto("/");
  const clip = page.locator(`section[data-slug="${game.slug}"]`).first();
  await clip.scrollIntoViewIfNeeded();
  await pageHasSettled(page);

  await clip.getByRole("link", { name: game.name }).click();
  await expect(page).toHaveURL(`/g/${game.slug}`);
  await expect(page.getByRole("heading", { level: 1, name: game.name })).toBeVisible();
  expect(await lastMove(page)).toBe("on");
  expect(await slides(page)).toEqual(["played"]);

  await page.goBack();
  await expect(page).toHaveURL("/");
  await expect(clip).toBeVisible();
  expect(await lastMove(page)).toBe("back");
  expect(await slides(page)).toEqual(["played", "played"]);
});
