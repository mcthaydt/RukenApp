import { expect, test, type Locator, type Page } from "@playwright/test";
import { addGame } from "./support/game.ts";
import { boxOf, showTheOwner, type Box } from "./support/look.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";
import { asInstalled } from "./support/installed.ts";

// "You're all caught up" (learned feed spec 6.1, journey A11): once a person has seen everything new, the feed says so
// in one frosted line on the first clip they have seen before, and keeps going under it.
//
// The private order is what says where a person is caught up, and the journeys' site runs on the open order, which never
// does. So the next page the screen asks for is stood in for here, at the edge between the screen and the site: it is the
// site's own next page, told that the person is caught up at its third clip, with an address of the stand-in's making.
// What the site does with a ranker's `caughtUpAt` is checked on a stub ranker in tests/features/feed/ranker.test.ts.

// The sideways windows are a phone opened from the Home Screen, where Ruken works sideways.
test.beforeEach(({ page }) => asInstalled(page));
test.beforeEach(forgetRateLimits);

test.beforeAll(async ({ browser, request }) => {
  test.setTimeout(240_000);
  await forgetRateLimits();
  // At least one live game, so every page of the feed has clips (the feed goes round).
  await addGame(browser, request);
});

const LINE = "You're all caught up";
/** The address the stand-in gives its page, so the screen's next ask can be seen to use it. */
const STAND_IN_NEXT = "stand-in-next-page";

const clips = (page: Page): Locator => page.locator("section[data-slug]");

/** Whether two boxes share any area. */
const overlap = (a: Box, b: Box): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/** The boxes of every control a person can see on screen. */
async function controlBoxes(page: Page): Promise<{ name: string; box: Box }[]> {
  const found: { name: string; box: Box }[] = [];
  for (const control of await page
    .locator("button:visible, a[href]:visible:not([aria-hidden='true'])")
    .all()) {
    const box = await control.boundingBox();
    if (box === null || box.width === 0 || box.height === 0) continue;
    const window = page.viewportSize() ?? { width: 0, height: 0 };
    if (box.y >= window.height || box.y + box.height <= 0 || box.x >= window.width || box.x + box.width <= 0)
      continue;
    found.push({ name: (await control.getAttribute("aria-label")) ?? (await control.innerText()), box });
  }
  return found;
}

/** Presses the down arrow, one clip at a time, until the clip at `index` is the one on screen. */
async function goTo(page: Page, index: number): Promise<void> {
  const at = await clips(page).evaluateAll((all) => all.findIndex((one) => one.dataset.current === "true"));
  for (let step = at + 1; step <= index; step++) {
    await page.keyboard.press("ArrowDown");
    // Past the last clip the spinner waits for the next page, and the feed moves on to it when it comes.
    await expect(clips(page).nth(step)).toHaveAttribute("data-current", "true");
  }
}

test("after the new games, the feed says You're all caught up, and keeps going", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const asked: string[] = [];
  let siteNext: string | null = null;
  await page.route("**/api/feed?*", async (route) => {
    const address = new URL(route.request().url());
    const after = address.searchParams.get("after") ?? "";
    asked.push(after);
    if (after === STAND_IN_NEXT && siteNext !== null) {
      // The address the stand-in made goes on to the site's own page after it.
      address.searchParams.set("after", siteNext);
      await route.continue({ url: address.toString() });
      return;
    }
    if (asked.length > 1) {
      await route.continue();
      return;
    }
    const response = await route.fetch();
    const page = (await response.json()) as {
      clips: { key: string }[];
      next: string | null;
      caughtUp?: string;
    };
    expect(page.clips.length).toBeGreaterThanOrEqual(4);
    siteNext = page.next;
    await route.fulfill({ response, json: { ...page, caughtUp: page.clips[2]?.key, next: STAND_IN_NEXT } });
  });

  await page.goto("/");
  await expect(page.locator("main.feed")).toHaveAttribute("data-ready", "true");
  const firstCount = await clips(page).count();
  // The site's first page says nothing of being caught up: the journeys' site runs on the open order.
  await expect(page.getByText(LINE)).toHaveCount(0);

  // On through the first page; near its end the screen asks for the next one, which the stand-in answers.
  await goTo(page, firstCount);
  expect(asked[0]).not.toBe("");
  expect(await clips(page).count()).toBeGreaterThan(firstCount + 3);

  // The next page's first two clips are new to the person: no line.
  await expect(clips(page).nth(firstCount).getByText(LINE)).toHaveCount(0);
  await goTo(page, firstCount + 1);
  await expect(
    clips(page)
      .nth(firstCount + 1)
      .getByText(LINE),
  ).toHaveCount(0);

  // Then the line, on the clip the page said, and only there.
  await goTo(page, firstCount + 2);
  const third = clips(page).nth(firstCount + 2);
  const line = third.getByText(LINE);
  await expect(line).toBeInViewport({ ratio: 1 });
  await expect(page.getByText(LINE)).toHaveCount(1);
  expect(
    await clips(page)
      .nth(firstCount + 2)
      .evaluate((section) => section.querySelector("video") !== null),
  ).toBe(true);
  // It is a line to read, never in the way: it covers no control, at this window and at the small ones the owner named.
  const sizes = [
    page.viewportSize(),
    { width: 320, height: 568 },
    { width: 375, height: 667 },
    { width: 667, height: 375 },
  ];
  for (const size of sizes) {
    if (size === null) continue;
    await page.setViewportSize(size);
    await third.scrollIntoViewIfNeeded();
    await expect(line).toBeInViewport({ ratio: 1 });
    const box = await boxOf(line);
    for (const control of await controlBoxes(page))
      expect(
        overlap(box, control.box),
        `the line covers "${control.name}" at ${String(size.width)}×${String(size.height)}`,
      ).toBe(false);
  }
  await page.setViewportSize(sizes[0] ?? { width: 375, height: 667 });
  await third.scrollIntoViewIfNeeded();
  await expect(line).toBeInViewport({ ratio: 1 });
  await showTheOwner(page, testInfo, "feed-caught-up");

  // The feed keeps going under it, and asks for the page after with the address it was given.
  await goTo(page, firstCount + 3);
  await expect(
    clips(page)
      .nth(firstCount + 3)
      .getByText(LINE),
  ).toHaveCount(0);
  for (let index = firstCount + 4; !asked.includes(STAND_IN_NEXT); index++) await goTo(page, index);
  expect(asked.filter((after) => after === STAND_IN_NEXT)).toHaveLength(1);
});
