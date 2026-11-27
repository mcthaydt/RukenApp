import { expect, type Page, type TestInfo } from "@playwright/test";
import { pageHasSettled } from "./account.ts";

// Helpers for the journeys that film a page's moves: tests/browser/feed-leave-and-return.test.ts and
// tests/browser/bar-through-moves.test.ts.

type Seen = { slides: number; pushes: number; filming: boolean; frozen: boolean };

/**
 * Counts each slide the page starts and each history entry it adds. While a move is being filmed, its slide is held
 * still the moment it is ready, so the journey can step it through by hand.
 */
export async function watchMoves(page: Page): Promise<void> {
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
 * pictured, so the report shows it frame by frame. `atFrame`, if given, is handed each picture while the slide is held
 * at that time, to check what it shows.
 */
export async function oneMove(
  page: Page,
  testInfo: TestInfo,
  name: string,
  act: () => Promise<void>,
  arrived: () => Promise<void>,
  expected: { slides: number; pushes: number },
  atFrame?: (picture: Buffer, at: number) => Promise<void>,
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
      const picture = await page.screenshot();
      await testInfo.attach(`strip: ${name}, ${String(at).padStart(3, "0")}ms`, {
        body: picture,
        contentType: "image/png",
      });
      await atFrame?.(picture, at);
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
export async function swipe(page: Page, from: [number, number], to: [number, number]): Promise<void> {
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
