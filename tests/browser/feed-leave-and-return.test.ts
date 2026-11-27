import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { addGame } from "./support/game.ts";
import { pageHasSettled } from "./support/account.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

// Leaving the feed and coming back, each move plays once (the owner, 2026-11-27: "The feed like does a double swipe on
// page transition out", "When I leave it and swipe", and "we need more tests here, do e2e with screenshots for this
// flow"). Every way out of the feed and back in is walked here: a sideways swipe to the other tab and back, a game
// opened from its clip and Back, the bar's You and Back, and a swipe made once the person has come back. For each one
// the journey counts the slides the page starts and the history entries the move adds, and films the slide frame by
// frame, so the owner can see it play once.

let game: Awaited<ReturnType<typeof addGame>>;

test.beforeAll(async ({ browser, request }) => {
  test.setTimeout(240_000);
  await forgetRateLimits();
  game = await addGame(browser, request);
});
test.beforeEach(forgetRateLimits);

type Seen = { slides: number; pushes: number; filming: boolean; frozen: boolean };

/**
 * Counts each slide the page starts and each history entry it adds. While a move is being filmed, its slide is held
 * still the moment it is ready, so the journey can step it through by hand.
 */
async function watchMoves(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const seen: Seen = { slides: 0, pushes: 0, filming: false, frozen: false };
    (window as unknown as { seen: Seen }).seen = seen;
    if ("startViewTransition" in document) {
      const start = document.startViewTransition.bind(document);
      document.startViewTransition = ((update: ViewTransitionUpdateCallback) => {
        seen.slides += 1;
        const move = start(update);
        move.ready.then(
          () => {
            if (!seen.filming) return;
            for (const one of document.documentElement.getAnimations({ subtree: true })) one.pause();
            seen.frozen = true;
          },
          () => undefined,
        );
        return move;
      }) as typeof document.startViewTransition;
    }
    const push = history.pushState.bind(history);
    history.pushState = (...args: Parameters<History["pushState"]>) => {
      seen.pushes += 1;
      push(...args);
    };
  });
}

const seen = (page: Page) => page.evaluate(() => ({ ...(window as unknown as { seen: Seen }).seen }));

/** When, in milliseconds from its start, each picture of a slide is taken: its start, its middle and its end. */
const FRAMES = [0, 50, 100, 150, 200, 250, 300, 450];

/**
 * Does one thing that moves the page, and checks it started at most one slide of the page's own and added at most one
 * history entry. Where the browser draws slides, the slide is filmed: held still, stepped to each time in FRAMES, and
 * pictured, so the report shows it frame by frame.
 */
async function oneMove(
  page: Page,
  testInfo: TestInfo,
  name: string,
  act: () => Promise<void>,
  arrived: () => Promise<void>,
  expected: { slides: number; pushes: number },
): Promise<void> {
  const before = await seen(page);
  const slides = await page.evaluate(() => "startViewTransition" in document);
  if (slides && expected.slides > 0) {
    await page.evaluate(() => {
      const watch = (window as unknown as { seen: Seen }).seen;
      watch.filming = true;
      watch.frozen = false;
    });
  }
  await act();
  if (slides && expected.slides > 0) {
    await expect.poll(async () => (await seen(page)).frozen).toBe(true);
    for (const at of FRAMES) {
      await page.evaluate((time) => {
        for (const one of document.documentElement.getAnimations({ subtree: true })) one.currentTime = time;
      }, at);
      await testInfo.attach(`strip: ${name}, ${String(at).padStart(3, "0")}ms`, {
        body: await page.screenshot(),
        contentType: "image/png",
      });
    }
    await page.evaluate(() => {
      const watch = (window as unknown as { seen: Seen }).seen;
      watch.filming = false;
      for (const one of document.documentElement.getAnimations({ subtree: true })) one.play();
    });
  }
  await arrived();
  await pageHasSettled(page);
  // The move has ended: nothing of it is still on its way to start a second slide.
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document
            .getAnimations()
            .filter(
              (one) =>
                one.playState === "running" &&
                (one.effect as KeyframeEffect | null)?.pseudoElement?.startsWith("::view-transition") ===
                  true,
            ).length,
      ),
    )
    .toBe(0);
  const after = await seen(page);
  expect({ slides: after.slides - before.slides, pushes: after.pushes - before.pushes }, name).toEqual(
    slides ? expected : { ...expected, slides: 0 },
  );
}

/**
 * A one-finger touch from one point to another, as a quick swipe. Safari's engine will not let a page make a Touch of
 * its own ("Illegal constructor"), so the events are plain touch events that carry the finger's place, which is all
 * the feed reads.
 */
async function swipe(page: Page, from: [number, number], to: [number, number]): Promise<void> {
  await page.evaluate(
    ([x0, y0, x1, y1]) => {
      const target = document.elementFromPoint(x0, y0) ?? document.body;
      const touch = (type: string, touches: object[], changed: object) => {
        const event = new Event(type, { bubbles: true });
        Object.defineProperty(event, "touches", { value: touches });
        Object.defineProperty(event, "changedTouches", { value: [changed] });
        target.dispatchEvent(event);
      };
      const begun = { identifier: 1, clientX: x0, clientY: y0 };
      touch("touchstart", [begun], begun);
      touch("touchend", [], { identifier: 1, clientX: x1, clientY: y1 });
    },
    [...from, ...to] as [number, number, number, number],
  );
}

const tab = (page: Page, name: "Fresh" | "Followed") =>
  page.getByRole("navigation", { name: "Feeds" }).getByRole("link", { name });

async function openFeed(page: Page): Promise<{ width: number; middle: number }> {
  await watchMoves(page);
  await page.goto("/");
  await expect(page.locator("main.feed")).toHaveAttribute("data-ready", "true");
  await pageHasSettled(page);
  const { width, height } = page.viewportSize() ?? { width: 0, height: 0 };
  return { width, middle: height / 2 };
}

test("leaving the feed and coming back, each move slides once", async ({ page }, testInfo) => {
  // Eight moves, each filmed in eight pictures.
  test.setTimeout(120_000);
  const { width, middle } = await openFeed(page);
  const toFollowed = () => swipe(page, [width * 0.8, middle], [width * 0.2, middle]);
  const toFresh = () => swipe(page, [width * 0.2, middle], [width * 0.8, middle]);
  const onFresh = () => expect(tab(page, "Fresh")).toHaveAttribute("aria-current", "page");
  const onFollowed = () => expect(tab(page, "Followed")).toHaveAttribute("aria-current", "page");

  await oneMove(page, testInfo, "1 swipe to Followed", toFollowed, onFollowed, { slides: 1, pushes: 1 });
  await oneMove(page, testInfo, "2 swipe back to Fresh", toFresh, onFresh, { slides: 1, pushes: 1 });

  // Out to a game from its clip, and Back: the clip grows into the game's page and shrinks back, once each way.
  const clip = page.locator(`section[data-slug="${game.slug}"]`).first();
  await clip.scrollIntoViewIfNeeded();
  await expect(clip).toHaveAttribute("data-current", "true");
  await oneMove(
    page,
    testInfo,
    "3 open a game from its clip",
    () => clip.getByRole("link", { name: game.name }).click(),
    () => expect(page.getByRole("heading", { level: 1, name: game.name })).toBeVisible(),
    { slides: 1, pushes: 1 },
  );
  await oneMove(page, testInfo, "4 Back to the feed", () => page.goBack().then(() => undefined), onFresh, {
    slides: 1,
    pushes: 0,
  });

  // Back on the feed, a swipe still moves one tab, once.
  await oneMove(page, testInfo, "5 swipe to Followed after coming back", toFollowed, onFollowed, {
    slides: 1,
    pushes: 1,
  });

  // Out by the bar, and Back.
  await oneMove(
    page,
    testInfo,
    "6 open You from the bar",
    () => page.getByRole("navigation", { name: "Ruken" }).getByRole("link", { name: "You" }).click(),
    () => expect(page).not.toHaveURL(/\/followed$/),
    { slides: 1, pushes: 1 },
  );
  await oneMove(page, testInfo, "7 Back to Followed", () => page.goBack().then(() => undefined), onFollowed, {
    slides: 1,
    pushes: 0,
  });
  await oneMove(page, testInfo, "8 swipe to Fresh after coming back", toFresh, onFresh, {
    slides: 1,
    pushes: 1,
  });
});

/**
 * Safari's own swipe from the edge of the screen: the finger starts at the very edge, and once it lifts, Safari goes
 * Back (or Forward) with a slide of its own, saying so on the popstate event (hasUAVisualTransition). No journey's
 * browser can draw that slide, so the journey answers the event's question as Safari would.
 */
async function browserSwipe(page: Page, way: "back" | "forward"): Promise<void> {
  const { width, height } = page.viewportSize() ?? { width: 0, height: 0 };
  const edge: [number, number] = way === "back" ? [2, height / 2] : [width - 2, height / 2];
  const end: [number, number] = way === "back" ? [width * 0.8, height / 2] : [width * 0.2, height / 2];
  await page.evaluate(() => ((window as unknown as { browserSlides: boolean }).browserSlides = true));
  await swipe(page, edge, end);
  // Safari goes once its own slide has played, a few hundred milliseconds after the finger lifts: about twenty frames.
  await page.evaluate(
    () =>
      new Promise<void>((done) => {
        let frames = 0;
        const count = () => {
          frames += 1;
          if (frames >= 20) done();
          else requestAnimationFrame(count);
        };
        requestAnimationFrame(count);
      }),
  );
  await (way === "back" ? page.goBack() : page.goForward());
  await page.evaluate(() => ((window as unknown as { browserSlides: boolean }).browserSlides = false));
}

test("a swipe in from the screen's edge is the browser's Back or Forward, and the feed takes no tab step too", async ({
  page,
}, testInfo) => {
  await page.addInitScript(() => {
    Object.defineProperty(PopStateEvent.prototype, "hasUAVisualTransition", {
      get: () => (window as unknown as { browserSlides?: boolean }).browserSlides === true,
    });
  });
  const { width, middle } = await openFeed(page);
  const onFresh = () => expect(tab(page, "Fresh")).toHaveAttribute("aria-current", "page");
  const onFollowed = () => expect(tab(page, "Followed")).toHaveAttribute("aria-current", "page");
  await oneMove(
    page,
    testInfo,
    "swipe to Followed",
    () => swipe(page, [width * 0.8, middle], [width * 0.2, middle]),
    onFollowed,
    {
      slides: 1,
      pushes: 1,
    },
  );

  // From the left edge: Safari slides back to Fresh. The feed must not also step to Fresh, which would add a page and
  // slide a second time.
  await oneMove(page, testInfo, "edge swipe Back to Fresh", () => browserSwipe(page, "back"), onFresh, {
    slides: 0,
    pushes: 0,
  });
  await expect(page).toHaveURL("/");
  // From the right edge: Safari slides forward to Followed again, once.
  await oneMove(
    page,
    testInfo,
    "edge swipe Forward to Followed",
    () => browserSwipe(page, "forward"),
    onFollowed,
    {
      slides: 0,
      pushes: 0,
    },
  );
  await expect(page).toHaveURL("/followed");
});
