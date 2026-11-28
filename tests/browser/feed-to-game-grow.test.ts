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

/** A video that has its picture for now (HTMLMediaElement.HAVE_CURRENT_DATA, which only a page can read). */
const HAS_A_PICTURE = 2;

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

test("the bar is drawn four fifths of the way through Back, as strongly as on the settled feed", async ({
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
  // How much the bar shows on the settled feed: its place with the bar, against the same place with it hidden. A hidden
  // bar leaves the accessibility tree, so it is held by its handle while it is hidden.
  const shown = await bar.elementHandle();
  const withBar = await page.screenshot({ clip: where, animations: "allow" });
  await shown.evaluate((element) => {
    element.style.visibility = "hidden";
  });
  const withoutBar = await page.screenshot({ clip: where, animations: "allow" });
  await shown.evaluate((element) => {
    element.style.visibility = "";
  });
  await shown.dispose();
  await clip.getByRole("link", { name: game.name }).click();
  await expect(page.getByRole("heading", { level: 1, name: game.name })).toBeVisible();
  await pageHasSettled(page);

  // Back, held four fifths of the way through, with the bar over the clip: its place must show the bar at least three
  // quarters as strongly as the settled feed does. In Chrome's engine the bar shows there at every moment of Back, on
  // main as here (the order of the bar's pictures is checked by the journey above); this check is for an engine that
  // leaves the bar out during the move.
  await page.evaluate(() => {
    const start = document.startViewTransition.bind(document);
    document.startViewTransition = ((update: ViewTransitionUpdateCallback) => {
      const move = start(update);
      void move.ready.then(() => {
        const timed = document.documentElement
          .getAnimations({ subtree: true })
          .filter((one) => Number.isFinite(Number(one.effect?.getComputedTiming().endTime)));
        const end = Math.max(...timed.map((one) => Number(one.effect?.getComputedTiming().endTime)));
        for (const one of timed) {
          one.pause();
          one.currentTime = end * 0.8;
        }
        document.documentElement.dataset.held = "yes";
      });
      return move;
    }) as typeof document.startViewTransition;
  });
  await page.getByRole("link", { name: "Back to the feed" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-held", "yes");
  const held = await page.screenshot({ clip: where, animations: "allow" });
  // The same held moment with the bar's pictures hidden: what is left is the clip and the page.
  await page.addStyleTag({ content: "::view-transition-group(tabs) { visibility: hidden; }" });
  const heldBare = await page.screenshot({ clip: where, animations: "allow" });
  await page.evaluate(() => {
    for (const one of document.documentElement.getAnimations({ subtree: true }))
      if (Number.isFinite(Number(one.effect?.getComputedTiming().endTime))) one.finish();
  });
  await expect(clip).toHaveAttribute("data-current", "true");

  for (const [name, body] of Object.entries({ withBar, withoutBar, held, heldBare }))
    await testInfo.attach(name, { body, contentType: "image/png" });
  const settledBar = await pictureGap(page, withBar, withoutBar);
  const heldBar = await pictureGap(page, held, heldBare);
  expect(heldBar, `the settled bar stands ${String(settledBar)} from the clip`).toBeGreaterThan(
    settledBar * 0.75,
  );
});

/** Holds the next move part of the way through: every animation of it paused at that share of its length. */
async function holdNextMove(page: Page, share: number): Promise<void> {
  await page.evaluate((at) => {
    const start = document.startViewTransition.bind(document);
    document.startViewTransition = ((update: ViewTransitionUpdateCallback) => {
      document.startViewTransition = start;
      const move = start(update);
      void move.ready.then(() => {
        const timed = document.documentElement
          .getAnimations({ subtree: true })
          .filter((one) => Number.isFinite(Number(one.effect?.getComputedTiming().endTime)));
        const end = Math.max(...timed.map((one) => Number(one.effect?.getComputedTiming().endTime)));
        for (const one of timed) {
          one.pause();
          one.currentTime = end * at;
        }
        document.documentElement.dataset.held = "yes";
      });
      return move;
    }) as typeof document.startViewTransition;
  }, share);
}

/** Lets the held move finish. */
async function letGo(page: Page): Promise<void> {
  await page.evaluate(() => {
    for (const one of document.documentElement.getAnimations({ subtree: true }))
      if (Number.isFinite(Number(one.effect?.getComputedTiming().endTime))) one.finish();
    delete document.documentElement.dataset.held;
  });
}

/**
 * Where the held move's clip is, and how much of its pictures show outside it: the held frame against the same frame
 * with the clip's pictures hidden, as the mean difference per colour (0 to 255) outside the clip's box, and in a
 * patch at each of its corners, which a rounded box leaves out; and inside it, to show the clip is drawn at all. The patch
 * is 2 by 2: the card's corner reaches 20px (the owner, 2026-11-27: "less rounded"), about 13px a third of the way out,
 * and a 4 by 4 patch reaches past the part that corner leaves out.
 *
 * The page behind the clip is live while the move is held, so its other pictures can change between the two frames: a
 * game page's video that comes in between them swaps its shimmer for its first frame, which once read as the clip
 * spilling 1.7 to 2.1 over the whole window (progress.md, Flaky tests). So every picture that is not the clip is hidden
 * in both frames: only the clip differs between them.
 */
async function clipSpill(
  page: Page,
): Promise<{ box: string; inside: number; outside: number; corners: number }> {
  const box = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement, "::view-transition-group(clip)");
    const at = new DOMMatrixReadOnly(style.transform === "none" ? undefined : style.transform);
    return { x: at.e, y: at.f, width: parseFloat(style.width), height: parseFloat(style.height) };
  });
  // The clip is the feed's video (`video[data-grows]`) or the game page's box round its video (`[data-grows]`).
  const stillBehind = await page.addStyleTag({
    content: ":is(video, img):not([data-grows], [data-grows] *) { visibility: hidden !important; }",
  });
  const shown = await page.screenshot({ animations: "allow", scale: "css" });
  const hiding = await page.addStyleTag({
    content: "::view-transition-old(clip), ::view-transition-new(clip) { visibility: hidden; }",
  });
  const bare = await page.screenshot({ animations: "allow", scale: "css" });
  for (const tag of [hiding, stillBehind])
    await tag.evaluate((element) => {
      (element as Element).remove();
    });
  const spill = await page.evaluate(
    async ({ first, second, box, CORNER_PATCH }) => {
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
        return { width: image.width, data: pen.getImageData(0, 0, image.width, image.height).data };
      };
      const a = await pixels(first);
      const b = await pixels(second);
      const gapAt = (x: number, y: number) => {
        const at = (y * a.width + x) * 4;
        let gap = 0;
        for (let colour = 0; colour < 3; colour++)
          gap += Math.abs((a.data[at + colour] ?? 0) - (b.data[at + colour] ?? 0));
        return gap / 3;
      };
      const rows = a.data.length / 4 / a.width;
      // Two pixels of give round the box, for the edge's smoothing.
      const left = Math.floor(box.x) - 2;
      const top = Math.floor(box.y) - 2;
      const right = Math.ceil(box.x + box.width) + 2;
      const bottom = Math.ceil(box.y + box.height) + 2;
      let outside = 0;
      let counted = 0;
      let inside = 0;
      let within = 0;
      for (let y = 0; y < rows; y++)
        for (let x = 0; x < a.width; x++) {
          if (x >= left && x < right && y >= top && y < bottom) {
            inside += gapAt(x, y);
            within++;
            continue;
          }
          outside += gapAt(x, y);
          counted++;
        }
      let corners = 0;
      const x0 = Math.ceil(box.x);
      const y0 = Math.ceil(box.y);
      const x1 = Math.floor(box.x + box.width) - CORNER_PATCH;
      const y1 = Math.floor(box.y + box.height) - CORNER_PATCH;
      for (const [cx, cy] of [
        [x0, y0],
        [x1, y0],
        [x0, y1],
        [x1, y1],
      ] as const)
        for (let y = cy; y < cy + CORNER_PATCH; y++)
          for (let x = cx; x < cx + CORNER_PATCH; x++) corners += gapAt(x, y);
      return {
        inside: inside / within,
        outside: counted === 0 ? 0 : outside / counted,
        corners: corners / (4 * CORNER_PATCH * CORNER_PATCH),
      };
    },
    { first: shown.toString("base64"), second: bare.toString("base64"), box, CORNER_PATCH: 2 },
  );
  return {
    box: `${String(box.width)} by ${String(box.height)} at ${String(box.x)}, ${String(box.y)}`,
    ...spill,
  };
}

test("the moving clip is cut to its box and rounds its corners as it goes, both ways", async ({ page }) => {
  test.skip(
    !(await page.evaluate(() => "startViewTransition" in document)),
    "this browser has no view transitions, so every move comes at once",
  );
  const clip = await openFeedAt(page);

  // A third of the way out, and two thirds of the way back: the same place on the path.
  await holdNextMove(page, 1 / 3);
  await clip.getByRole("link", { name: game.name }).click();
  await expect(page.locator("html")).toHaveAttribute("data-held", "yes");
  const out = await clipSpill(page);
  await letGo(page);
  await expect(page.getByRole("heading", { level: 1, name: game.name })).toBeVisible();
  await pageHasSettled(page);

  await holdNextMove(page, 2 / 3);
  await page.goBack();
  await expect(page.locator("html")).toHaveAttribute("data-held", "yes");
  const back = await clipSpill(page);
  await letGo(page);
  await expect(clip).toHaveAttribute("data-current", "true");

  expect(out.inside, `going out, the clip at ${out.box}`).toBeGreaterThan(10);
  expect(back.inside, `coming back, the clip at ${back.box}`).toBeGreaterThan(10);
  expect(out.outside, `going out, the clip at ${out.box}`).toBeLessThan(0.5);
  expect(back.outside, `coming back, the clip at ${back.box}`).toBeLessThan(0.5);
  expect(out.corners, `going out, the clip at ${out.box}`).toBeLessThan(4);
  expect(back.corners, `coming back, the clip at ${back.box}`).toBeLessThan(4);
});

test("Back keeps the game's picture until the feed's clip has one of its own, so the clip never goes dark", async ({
  page,
}) => {
  test.skip(
    !(await page.evaluate(() => "startViewTransition" in document)),
    "this browser has no view transitions, so every move comes at once",
  );
  const clip = await openFeedAt(page);
  const address = await clip
    .locator("video")
    .evaluate((video) => new URL((video as HTMLVideoElement).currentSrc).pathname);
  await clip.getByRole("link", { name: game.name }).click();
  await expect(page.getByRole("heading", { level: 1, name: game.name })).toBeVisible();
  await pageHasSettled(page);

  // The feed's clip comes back as a new video that must fetch its picture again; on a slow line that takes a while.
  const theClip = (url: URL) => url.pathname === address;
  await page.route(theClip, async (route) => {
    await new Promise((done) => setTimeout(done, 3000));
    await route.continue().catch(() => undefined);
  });
  await holdNextMove(page, 1 / 3);
  await page.goBack();
  await expect(page.locator("html")).toHaveAttribute("data-held", "yes");
  expect(
    await clip.locator("video").evaluate((video) => (video as HTMLVideoElement).readyState),
  ).toBeLessThan(HAS_A_PICTURE);
  // The held frame against the same frame showing only the game's picture of the clip.
  const shown = await page.screenshot({ animations: "allow", scale: "css" });
  const onlyOld = await page.addStyleTag({ content: "::view-transition-new(clip) { visibility: hidden; }" });
  const old = await page.screenshot({ animations: "allow", scale: "css" });
  await onlyOld.evaluate((tag) => {
    (tag as Element).remove();
  });
  const gap = await pictureGap(page, shown, old);
  await letGo(page);
  await page.unroute(theClip);
  await expect(clip).toHaveAttribute("data-current", "true");
  expect(gap, "the feed's clip with no picture yet covers the game's picture").toBeLessThan(1);
});

test("a picture that comes late from an earlier Back does not end the wait of the next Back", async ({
  page,
}) => {
  test.skip(
    !(await page.evaluate(() => "startViewTransition" in document)),
    "this browser has no view transitions, so every move comes at once",
  );
  const clip = await openFeedAt(page);
  const address = await clip
    .locator("video")
    .evaluate((video) => new URL((video as HTMLVideoElement).currentSrc).pathname);
  await clip.getByRole("link", { name: game.name }).click();
  await expect(page.getByRole("heading", { level: 1, name: game.name })).toBeVisible();
  await pageHasSettled(page);

  // On a slow line, the first Back's clip gets its picture late: only once the second Back is under way, whatever
  // time the steps between take in this browser. The second Back's clip gets its picture only when the test ends.
  let secondBack = false;
  let letFirstIn = () => {};
  let letSecondIn = () => {};
  const firstMayCome = new Promise<void>((done) => (letFirstIn = done));
  const secondMayCome = new Promise<void>((done) => (letSecondIn = done));
  const firstWaiting: Promise<void>[] = [];
  const theClip = (url: URL) => url.pathname === address;
  await page.route(theClip, async (route) => {
    const answered = (async () => {
      await (secondBack ? secondMayCome : firstMayCome);
      await route.continue().catch(() => undefined);
    })();
    if (!secondBack) firstWaiting.push(answered);
    await answered;
  });
  await page.goBack();
  await expect(clip).toHaveAttribute("data-current", "true");
  await pageHasSettled(page);
  // Straight back into the game and out again, while the first Back's picture is still on its way.
  await clip.getByRole("link", { name: game.name }).click();
  await expect(page.getByRole("heading", { level: 1, name: game.name })).toBeVisible();
  await pageHasSettled(page);
  expect(firstWaiting.length, "the first Back asked for its clip").toBeGreaterThan(0);
  secondBack = true;
  await holdNextMove(page, 1 / 3);
  await page.goBack();
  await expect(page.locator("html")).toHaveAttribute("data-held", "yes");
  // Now the first Back's picture comes, in the middle of the second Back.
  letFirstIn();
  await Promise.all(firstWaiting);
  await page.waitForTimeout(500);
  expect(
    await clip.locator("video").evaluate((video) => (video as HTMLVideoElement).readyState),
  ).toBeLessThan(HAS_A_PICTURE);
  const shown = await page.screenshot({ animations: "allow", scale: "css" });
  const onlyOld = await page.addStyleTag({ content: "::view-transition-new(clip) { visibility: hidden; }" });
  const old = await page.screenshot({ animations: "allow", scale: "css" });
  await onlyOld.evaluate((tag) => {
    (tag as Element).remove();
  });
  const gap = await pictureGap(page, shown, old);
  await letGo(page);
  letSecondIn();
  await page.unroute(theClip);
  expect(gap, "the second Back's clip with no picture yet covers the game's picture").toBeLessThan(1);
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
