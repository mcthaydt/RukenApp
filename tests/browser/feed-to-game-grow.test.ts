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
    (window as unknown as { drawn: string[][] }).drawn = [];
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
          // How the move draws: which picture of the page and of the clip fades, and the clip's curve.
          const drawn: string[] = [];
          for (const one of document.documentElement.getAnimations({ subtree: true })) {
            if (!(one.effect instanceof KeyframeEffect)) continue;
            const where = one.effect.pseudoElement ?? "";
            const name = one instanceof CSSAnimation ? one.animationName : "";
            if (/^::view-transition-(old|new)\((root|clip)\)$/.test(where) && name !== "")
              drawn.push(`${where.replace("::view-transition-", "")} ${name}`);
            if (where === "::view-transition-group(clip)")
              drawn.push(`curve ${one.effect.getKeyframes()[0]?.easing ?? ""}`);
            // The bar of places: when each of its pictures fades (each has two animations, its fade and its blend).
            if (/^::view-transition-(old|new)\(tabs\)$/.test(where)) {
              const timing = one.effect.getComputedTiming();
              drawn.push(
                `${where.replace("::view-transition-", "")} from ${String(timing.delay)}ms for ${String(timing.duration)}ms`,
              );
            }
          }
          const bar = getComputedStyle(document.documentElement, "::view-transition-group(tabs)").zIndex;
          drawn.push(`tabs ${bar === "auto" ? "under the clip" : "over the clip"}`);
          (window as unknown as { drawn: string[][] }).drawn.push([...new Set(drawn)].sort());
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

test("the game page's back arrow shrinks the clip into the feed, on the clip that was left", async ({
  page,
}) => {
  test.skip(
    !(await page.evaluate(() => "startViewTransition" in document)),
    "this browser has no view transitions, so every move comes at once",
  );
  await watchMoves(page);
  const clip = await openFeedAt(page);

  await clip.getByRole("link", { name: game.name }).click();
  await expect(page.getByRole("heading", { level: 1, name: game.name })).toBeVisible();
  expect(await moves(page)).toEqual(["clip moved"]);

  await page.getByRole("link", { name: "Back to the feed" }).click();
  await expect(page).toHaveURL("/");
  await expect(clip).toHaveAttribute("data-current", "true");
  expect(await lastMove(page)).toBe("grow");
  expect(await moves(page)).toEqual(["clip moved", "clip moved"]);
  await expect.poll(() => namedLeft(page)).toBe(0);
  // It was the browser's Back: nothing ahead of the feed was added, so Forward opens the game again.
  await page.goForward();
  await expect(page).toHaveURL(`/g/${game.slug}`);
});

test("going back to the feed plays the move out backwards, with the browser's Back and with the arrow", async ({
  page,
}) => {
  test.skip(
    !(await page.evaluate(() => "startViewTransition" in document)),
    "this browser has no view transitions, so every move comes at once",
  );
  await watchMoves(page);
  const clip = await openFeedAt(page);
  // Out: the feed and its clip are on top and fade, on the quick-start curve.
  const out = [
    "curve cubic-bezier(0.22, 1, 0.36, 1)",
    "new(tabs) from 0ms for 250ms",
    "old(clip) clip-hands-over",
    "old(root) page-fades",
    "old(tabs) from 0ms for 250ms",
    "tabs under the clip",
  ];
  // Back: the same pictures, the other way: the feed and its clip on top come in, on the mirrored curve.
  // The bar of places too: its pictures fade over the last 250ms, where they faded over the first going out.
  const back = [
    "curve cubic-bezier(0.64, 0, 0.78, 0)",
    "new(clip) clip-takes-over",
    "new(root) page-shows",
    "new(tabs) from 200ms for 250ms",
    "old(tabs) from 200ms for 250ms",
    "tabs over the clip",
  ];

  await clip.getByRole("link", { name: game.name }).click();
  await expect(page.getByRole("heading", { level: 1, name: game.name })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL("/");
  await expect(clip).toHaveAttribute("data-current", "true");
  await clip.getByRole("link", { name: game.name }).click();
  await expect(page.getByRole("heading", { level: 1, name: game.name })).toBeVisible();
  await page.getByRole("link", { name: "Back to the feed" }).click();
  await expect(page).toHaveURL("/");
  // The arrow is the browser's Back: the address changes before the feed comes in and its move starts.
  await expect.poll(async () => (await moves(page)).length).toBe(4);

  expect(await moves(page)).toEqual(["clip moved", "clip moved", "clip moved", "clip moved"]);
  expect(await page.evaluate(() => (window as unknown as { drawn: string[][] }).drawn)).toEqual([
    out,
    back,
    out,
    back,
  ]);
  await expect.poll(() => namedLeft(page)).toBe(0);
});

/** How far two pictures of the same size differ: the mean difference per colour, 0 to 255. */
async function pictureGap(page: Page, one: Buffer, other: Buffer): Promise<number> {
  return page.evaluate(
    async ({ first, second }) => {
      const pixels = async (png: string) => {
        const image = new Image();
        image.src = `data:image/png;base64,${png}`;
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = image.width;
        canvas.height = image.height;
        const pen = canvas.getContext("2d");
        if (pen === null) throw new Error("no 2d canvas");
        pen.drawImage(image, 0, 0);
        return pen.getImageData(0, 0, image.width, image.height).data;
      };
      const a = await pixels(first);
      const b = await pixels(second);
      let gap = 0;
      for (let at = 0; at < a.length; at += 4)
        for (let colour = 0; colour < 3; colour++)
          gap += Math.abs((a[at + colour] ?? 0) - (b[at + colour] ?? 0));
      return gap / ((a.length / 4) * 3);
    },
    { first: one.toString("base64"), second: other.toString("base64") },
  );
}

test("the bar is drawn at the end of Back, as it is once the feed has settled", async ({
  page,
}, testInfo) => {
  test.skip(
    !(await page.evaluate(() => "startViewTransition" in document)),
    "this browser has no view transitions, so every move comes at once",
  );
  // Safari's engine never draws the new picture of the bar during the move (progress.md, Known issues, #399): it pops
  // in when the move ends, as on main. Confirm on a real iPhone before fixing.
  test.fixme(
    testInfo.project.name === "phone",
    "Safari's engine does not draw the bar's new picture during the move",
  );
  const clip = await openFeedAt(page);
  const bar = page.getByRole("navigation", { name: "Ruken" });
  const where = await bar.boundingBox();
  if (where === null) throw new Error("the feed has no bar");
  await clip.getByRole("link", { name: game.name }).click();
  await expect(page.getByRole("heading", { level: 1, name: game.name })).toBeVisible();
  await pageHasSettled(page);

  // Back, held at its last moment: every animation of the move paused at its end.
  await page.evaluate(() => {
    const start = document.startViewTransition.bind(document);
    document.startViewTransition = ((update: ViewTransitionUpdateCallback) => {
      const move = start(update);
      void move.ready.then(() => {
        for (const one of document.documentElement.getAnimations({ subtree: true })) {
          const end = Number(one.effect?.getComputedTiming().endTime);
          if (!Number.isFinite(end)) continue;
          one.pause();
          one.currentTime = end - 1;
        }
        document.documentElement.dataset.held = "yes";
      });
      return move;
    }) as typeof document.startViewTransition;
  });
  await page.getByRole("link", { name: "Back to the feed" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-held", "yes");
  const held = await page.screenshot({ clip: where, animations: "allow" });
  await page.evaluate(() => {
    for (const one of document.documentElement.getAnimations({ subtree: true }))
      if (Number.isFinite(Number(one.effect?.getComputedTiming().endTime))) one.finish();
  });
  await expect(clip).toHaveAttribute("data-current", "true");
  await pageHasSettled(page);
  const settled = await page.screenshot({ clip: where, animations: "allow" });
  // The same place with the bar hidden: the held picture must be nearer the settled bar than the bare clip, so a clip
  // that has moved on a frame does not decide it.
  // A hidden bar leaves the accessibility tree, so it is held by its handle while it is hidden.
  const shown = await bar.elementHandle();
  await shown.evaluate((element) => {
    element.style.visibility = "hidden";
  });
  const bare = await page.screenshot({ clip: where, animations: "allow" });
  await shown.evaluate((element) => {
    element.style.visibility = "";
  });
  await testInfo.attach("held", { body: held, contentType: "image/png" });
  await testInfo.attach("settled", { body: settled, contentType: "image/png" });
  await testInfo.attach("bare", { body: bare, contentType: "image/png" });
  const toBar = await pictureGap(page, held, settled);
  const toBare = await pictureGap(page, held, bare);
  expect(toBar, `the held picture is ${String(toBare)} from the bare clip`).toBeLessThan(toBare / 2);
});

test("the back arrow on a game's page opened another way goes to the feed with a slide", async ({ page }) => {
  test.skip(
    !(await page.evaluate(() => "startViewTransition" in document)),
    "this browser has no view transitions, so every move comes at once",
  );
  await watchMoves(page);
  await page.goto(`/g/${game.slug}`);
  await expect(page.getByRole("heading", { level: 1, name: game.name })).toBeVisible();
  await pageHasSettled(page);
  await page.getByRole("link", { name: "Back to the feed" }).click();
  await expect(page).toHaveURL("/");
  expect(await lastMove(page)).toBe("back");
  expect(await moves(page)).toEqual(["played"]);
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

test("a game's page opened another way slides back to the feed, with no clip moving", async ({ page }) => {
  test.skip(
    !(await page.evaluate(() => "startViewTransition" in document)),
    "this browser has no view transitions, so every move comes at once",
  );
  await watchMoves(page);
  await page.goto(`/g/${game.slug}`);
  await expect(page.getByRole("heading", { level: 1, name: game.name })).toBeVisible();
  await pageHasSettled(page);
  await page
    .getByRole("navigation", { name: "Ruken" })
    .getByRole("link", { name: "Home", exact: true })
    .click();
  await expect(page).toHaveURL("/");
  expect(await lastMove(page)).toBe("back");
  expect(await moves(page)).toEqual(["played"]);
  await expect.poll(() => namedLeft(page)).toBe(0);
});

test("with less motion asked for, opening a game from the feed moves nothing", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const clip = await openFeedAt(page);
  await clip.getByRole("link", { name: game.name }).click();
  await expect(page.getByRole("heading", { level: 1, name: game.name })).toBeVisible();
  expect(await lastMove(page)).toBeUndefined();
});
