import { expect, test, type Page } from "@playwright/test";
import { addGame } from "./support/game.ts";
import { pageHasSettled } from "./support/account.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

// Opening a game from the feed, the clip itself grows from the feed into its box on the game's page while the rest of
// the page fades across, and Back shrinks it into the feed again (the owner, 2026-11-24: "when you click on a game page
// for the feed, the page transitions to the game page via the video moving into the container"). A move the browser
// starts and then throws away looks to a person like no move at all, so the journey checks that each one really played
// and that the clip was the thing that moved.

let game: Awaited<ReturnType<typeof addGame>>;

test.beforeAll(async ({ browser, request }) => {
  test.setTimeout(240_000);
  await forgetRateLimits();
  game = await addGame(browser, request);
});
test.beforeEach(forgetRateLimits);

/**
 * Keeps, for each move the page starts, "clip moved" when it played with the clip moving on its own, "played" when it
 * played without, or the reason the browser threw it away.
 */
async function watchMoves(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const seen: string[] = [];
    (window as unknown as { moves: string[] }).moves = seen;
    const start = document.startViewTransition.bind(document);
    document.startViewTransition = ((update: ViewTransitionUpdateCallback) => {
      const move = start(update);
      const at = seen.push("started") - 1;
      move.ready.then(
        () => {
          const clipMoves = document.documentElement
            .getAnimations({ subtree: true })
            .some(
              (one) =>
                one.effect instanceof KeyframeEffect &&
                one.effect.pseudoElement === "::view-transition-group(clip)",
            );
          seen[at] = clipMoves ? "clip moved" : "played";
        },
        (why: unknown) => {
          seen[at] = why instanceof Error ? `${why.name}: ${why.message}` : String(why);
        },
      );
      return move;
    }) as typeof document.startViewTransition;
  });
}

/** What became of each move so far, once none is still starting. */
async function moves(page: Page): Promise<string[]> {
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { moves: string[] }).moves.includes("started")))
    .toBe(false);
  return page.evaluate(() => [...(window as unknown as { moves: string[] }).moves]);
}

const lastMove = (page: Page) => page.evaluate(() => document.documentElement.dataset.move);
/** The elements that still carry a view transition name of their own once a move is over: none should. */
const namedLeft = (page: Page) =>
  page.evaluate(
    () =>
      [...document.querySelectorAll<HTMLElement>("[data-grows]")].filter(
        (one) => one.style.viewTransitionName !== "",
      ).length,
  );

async function openFeedAt(page: Page): Promise<ReturnType<Page["locator"]>> {
  await page.goto("/");
  const clip = page.locator(`section[data-slug="${game.slug}"]`).first();
  await clip.scrollIntoViewIfNeeded();
  await expect(clip).toHaveAttribute("data-current", "true");
  await pageHasSettled(page);
  return clip;
}

test("a game opened from the feed grows out of its clip, and Back shrinks it into the feed", async ({
  page,
}) => {
  test.skip(
    !(await page.evaluate(() => "startViewTransition" in document)),
    "this browser has no view transitions, so every move comes at once",
  );
  await watchMoves(page);
  const clip = await openFeedAt(page);

  await clip.getByRole("link", { name: game.name }).click();
  await expect(page).toHaveURL(`/g/${game.slug}`);
  await expect(page.getByRole("heading", { level: 1, name: game.name })).toBeVisible();
  expect(await lastMove(page)).toBe("grow");
  expect(await moves(page)).toEqual(["clip moved"]);
  await expect.poll(() => namedLeft(page)).toBe(0);

  await page.goBack();
  await expect(page).toHaveURL("/");
  await expect(clip).toBeVisible();
  expect(await lastMove(page)).toBe("grow");
  expect(await moves(page)).toEqual(["clip moved", "clip moved"]);
  await expect.poll(() => namedLeft(page)).toBe(0);
});

test("Play in the feed still slides to the game, with no clip moving", async ({ page }) => {
  test.skip(
    !(await page.evaluate(() => "startViewTransition" in document)),
    "this browser has no view transitions, so every move comes at once",
  );
  await watchMoves(page);
  const clip = await openFeedAt(page);
  const play = clip.getByRole("link", { name: "Play", exact: true });
  test.skip((await play.count()) === 0, "before launch the feed shows Wishlist where Play goes");
  await play.click();
  // Signed out, Play asks the person to join first: still a move away from the feed, and not to the game's page.
  await expect(page).not.toHaveURL("/");
  expect(await lastMove(page)).toBe("on");
  expect(await moves(page)).toEqual(["played"]);
});

test("with less motion asked for, opening a game from the feed moves nothing", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const clip = await openFeedAt(page);
  await clip.getByRole("link", { name: game.name }).click();
  await expect(page.getByRole("heading", { level: 1, name: game.name })).toBeVisible();
  expect(await lastMove(page)).toBeUndefined();
});
