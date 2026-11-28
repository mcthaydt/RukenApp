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

/** The small windows the owner named, upright and sideways. */
const SMALL_SIZES = [
  { width: 320, height: 568 },
  { width: 375, height: 667 },
  { width: 667, height: 375 },
];

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
  // The stand-in's page waits until the first page has been counted: with few games live, the screen asks for the next
  // page as soon as it starts.
  let release: () => void = () => undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
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
    await held;
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
  release();

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
  const sizes = [page.viewportSize(), ...SMALL_SIZES];
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

// A person caught up from the very first clip, opening Ruken on a device that has not seen the first open's tips: the
// line and the tips are both on the first clip, and neither may cover the other or any control (review 3 of #440: on an
// upright phone the tips stood where the line does and hid it). The first page comes in the page itself, so the stand-in
// here is at the same edge in the page: the page's own first page, told that the person is caught up at its first clip.
test("caught up from the first clip, the line and the first open's tips stand apart", async ({
  page,
  context,
}) => {
  test.setTimeout(120_000);
  let first: string | null = null;
  await context.route(
    (address) => address.pathname === "/",
    async (route) => {
      if (route.request().resourceType() !== "document") {
        await route.continue();
        return;
      }
      const response = await route.fetch();
      const html = await response.text();
      // The page carries its first page as data, in the shape `first:{next:…,clips:[{key:"…"`.
      const at = html.lastIndexOf("first:{");
      const found = at === -1 ? null : /clips:\[\{key:"([^"]+)"/.exec(html.slice(at));
      first = found?.[1] ?? null;
      const body =
        found === null || first === null
          ? html
          : `${html.slice(0, at)}first:{caughtUp:"${first}",${html.slice(at + "first:{".length)}`;
      await route.fulfill({ response, body });
    },
  );
  const sizes = [page.viewportSize(), ...SMALL_SIZES];
  for (const size of sizes) {
    if (size === null) continue;
    // A first open at each size, in a window of its own: a reload of the same window may come back where it was left
    // (seen in CI: the line out of view at 320×568), and a first open starts at the first clip.
    const opened = await context.newPage();
    await asInstalled(opened);
    // The tips show again at each size: the note that they were seen is forgotten before the page reads it.
    await opened.addInitScript(() => {
      try {
        localStorage.removeItem("rk_seen_hints");
      } catch {
        // A browser that keeps no notes has nothing to forget.
      }
    });
    await opened.setViewportSize(size);
    await opened.goto("/");
    await expect(opened.locator("main.feed")).toHaveAttribute("data-ready", "true");
    expect(first, "the page's first page names its first clip").not.toBeNull();
    const clip = clips(opened).first();
    const where = `${String(size.width)}×${String(size.height)}`;
    await expect(clip, `${where}: the feed opens on its first clip`).toHaveAttribute("data-current", "true");
    const line = clip.getByText(LINE);
    const tips = clip.locator(".hints");
    await expect(line, where).toBeInViewport({ ratio: 1 });
    await expect(tips, where).toBeInViewport({ ratio: 1 });
    const lineBox = await boxOf(line);
    const tipsBox = await boxOf(tips);
    expect(overlap(lineBox, tipsBox), `the tips cover the line at ${where}`).toBe(false);
    for (const control of await controlBoxes(opened)) {
      expect(overlap(lineBox, control.box), `the line covers "${control.name}" at ${where}`).toBe(false);
      expect(overlap(tipsBox, control.box), `the tips cover "${control.name}" at ${where}`).toBe(false);
    }
    await opened.close();
  }
});
