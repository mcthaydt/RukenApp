import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
import { addGame } from "./support/game.ts";
import { pageHasSettled } from "./support/account.ts";
import { oneMove, swipe, watchMoves } from "./support/moves.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

// The bar stays one piece through every move (the owner, 2026-11-27, of a slide from Fresh to Followed: "That weird
// rectangle outline happens when we go from fresh to followed", and "How can we prevent that from happening? This is
// the second time it's happened with for that bottom bar"). The bar stays still while the pages slide under it, so each
// move is filmed frame by frame and every frame is checked: just inside each corner of the bar's box, outside its
// rounded shape, the picture shows the same as just outside the box, so no square patch or edge is drawn round the bar.
// After each move, and in each frame, no button on the bar or the feed's tabs shows a ring or an outline unless the
// keyboard or the gamepad put it there.

let game: Awaited<ReturnType<typeof addGame>>;

test.beforeAll(async ({ browser, request }) => {
  test.setTimeout(240_000);
  await forgetRateLimits();
  game = await addGame(browser, request);
});
test.beforeEach(forgetRateLimits);

const bar = (page: Page) => page.getByRole("navigation", { name: "Ruken" });
const tab = (page: Page, name: "Fresh" | "Followed") =>
  page.getByRole("navigation", { name: "Feeds" }).getByRole("link", { name });

/** How far apart, out of 255, a corner of the bar's box and the page just beside it may be: a gentle slope in a clip. */
const CORNER_MATCH = 16;

/**
 * Just inside each corner of the bar's box (outside its rounded shape) and just outside the box, beside it, the picture
 * shows the same thing: the page under the bar. A picture of the bar that kept what was under it as the move began
 * shows there as a square patch that differs from the page now beside it.
 */
async function cornersShowThePage(page: Page, picture: Buffer, where: string): Promise<void> {
  const box = await bar(page).boundingBox();
  if (box === null) return;
  const { width, height } = page.viewportSize() ?? { width: 0, height: 0 };
  const left = box.x;
  const right = box.x + box.width;
  const top = box.y;
  const bottom = box.y + box.height;
  // Inside: half a pixel in from both edges of the corner. Beside: three pixels out from the box to the side, and three
  // pixels out above or below it. A square patch differs from both; the edge of a sliding clip that happens to pass
  // between the corner and one of them still leaves the other matching.
  const corners: { name: string; inside: [number, number]; beside: [number, number][] }[] = [
    {
      name: "top left",
      inside: [left + 0.5, top + 0.5],
      beside: [
        [left - 3, top + 0.5],
        [left + 0.5, top - 3],
      ],
    },
    {
      name: "top right",
      inside: [right - 0.5, top + 0.5],
      beside: [
        [right + 3, top + 0.5],
        [right - 0.5, top - 3],
      ],
    },
    {
      name: "bottom left",
      inside: [left + 0.5, bottom - 0.5],
      beside: [
        [left - 3, bottom - 0.5],
        [left + 0.5, bottom + 3],
      ],
    },
    {
      name: "bottom right",
      inside: [right - 0.5, bottom - 0.5],
      beside: [
        [right + 3, bottom - 0.5],
        [right - 0.5, bottom + 3],
      ],
    },
  ];
  const differences = await page.evaluate(
    async ({ png, points }) => {
      const bytes = Uint8Array.from(atob(png), (one) => one.charCodeAt(0));
      const image = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
      const canvas = new OffscreenCanvas(image.width, image.height);
      const drawn = canvas.getContext("2d");
      if (drawn === null) throw new Error("no 2d canvas");
      drawn.drawImage(image, 0, 0);
      const scale = image.width / window.innerWidth;
      const colour = ([x, y]: [number, number]) =>
        Array.from(drawn.getImageData(Math.floor(x * scale), Math.floor(y * scale), 1, 1).data.slice(0, 3));
      return points.map(({ inside, beside }) => {
        const a = colour(inside);
        return Math.min(
          ...beside.map((point) => {
            const b = colour(point);
            return Math.max(...a.map((value, index) => Math.abs(value - (b[index] ?? 0))));
          }),
        );
      });
    },
    { png: picture.toString("base64"), points: corners.map(({ inside, beside }) => ({ inside, beside })) },
  );
  expect(width).toBeGreaterThan(right + 3);
  expect(height).toBeGreaterThan(bottom + 3);
  for (const [index, corner] of corners.entries()) {
    expect(
      differences[index],
      `${where}: the bar's ${corner.name} corner against the page beside it`,
    ).toBeLessThanOrEqual(CORNER_MATCH);
  }
}

/** No button on the bar or the feed's tabs shows a ring, an outline or a tap flash, unless the keyboard put it there. */
async function noRingWithoutKeys(page: Page, where: string): Promise<void> {
  const rings = await page.evaluate(() =>
    [...document.querySelectorAll('nav[aria-label="Ruken"] a, nav[aria-label="Feeds"] a')]
      .filter((one) => !one.matches(":focus-visible"))
      .flatMap((one) => {
        const look = getComputedStyle(one);
        const name = one.getAttribute("aria-label") ?? one.textContent.trim();
        const found: string[] = [];
        if (look.outlineStyle !== "none" && parseFloat(look.outlineWidth) > 0) found.push(`${name}: outline`);
        // A ring is a shadow drawn outside the button with no offset and no blur, only a spread.
        const shadows = look.boxShadow.split(/,(?![^(]*\))/);
        if (shadows.some((shadow) => !shadow.includes("inset") && /\b0px 0px 0px [1-9]/.test(shadow))) {
          found.push(`${name}: ring ${look.boxShadow}`);
        }
        const flash = look.getPropertyValue("-webkit-tap-highlight-color");
        if (flash !== "" && flash !== "rgba(0, 0, 0, 0)" && flash !== "transparent")
          found.push(`${name}: tap ${flash}`);
        return found;
      }),
  );
  expect(rings, `${where}: rings on the bar or the tabs`).toEqual([]);
}

async function throughOneMove(
  page: Page,
  testInfo: TestInfo,
  name: string,
  act: () => Promise<void>,
  arrived: () => Promise<void>,
  pushes: number,
): Promise<void> {
  await oneMove(page, testInfo, name, act, arrived, { slides: 1, pushes }, async (picture, at) => {
    const where = `${name}, ${String(at)}ms`;
    await cornersShowThePage(page, picture, where);
    await noRingWithoutKeys(page, where);
  });
  await noRingWithoutKeys(page, `${name}, after`);
}

test("the bar stays one piece, with no ring, through every move in and out of the feed", async ({
  page,
  hasTouch,
}, testInfo) => {
  // Eight moves, each filmed in eight pictures, each picture checked.
  test.setTimeout(180_000);
  await watchMoves(page);
  await page.goto("/");
  await expect(page.locator("main.feed")).toHaveAttribute("data-ready", "true");
  await pageHasSettled(page);
  const { width, height } = page.viewportSize() ?? { width: 0, height: 0 };
  const middle = height / 2;
  const press = (target: Locator) => (hasTouch ? target.tap() : target.click());
  const onFresh = () => expect(tab(page, "Fresh")).toHaveAttribute("aria-current", "page");
  const onFollowed = () => expect(tab(page, "Followed")).toHaveAttribute("aria-current", "page");

  await throughOneMove(
    page,
    testInfo,
    "1 swipe to Followed",
    () => swipe(page, [width * 0.8, middle], [width * 0.2, middle]),
    onFollowed,
    1,
  );
  await throughOneMove(page, testInfo, "2 press Fresh", () => press(tab(page, "Fresh")), onFresh, 1);
  await throughOneMove(page, testInfo, "3 press Followed", () => press(tab(page, "Followed")), onFollowed, 1);
  await throughOneMove(
    page,
    testInfo,
    "4 swipe to Fresh",
    () => swipe(page, [width * 0.2, middle], [width * 0.8, middle]),
    onFresh,
    1,
  );

  const clip = page.locator(`section[data-slug="${game.slug}"]`).first();
  await clip.scrollIntoViewIfNeeded();
  await expect(clip).toHaveAttribute("data-current", "true");
  await throughOneMove(
    page,
    testInfo,
    "5 open a game from its clip",
    () => press(clip.getByRole("link", { name: game.name })),
    () => expect(page.getByRole("heading", { level: 1, name: game.name })).toBeVisible(),
    1,
  );
  await throughOneMove(
    page,
    testInfo,
    "6 Back to the feed",
    () => page.goBack().then(() => undefined),
    onFresh,
    0,
  );

  await throughOneMove(
    page,
    testInfo,
    "7 press You on the bar",
    () => press(bar(page).getByRole("link", { name: "You", exact: true })),
    () => expect(page).not.toHaveURL(/\/$/),
    1,
  );
  await throughOneMove(
    page,
    testInfo,
    "8 press Home on the bar",
    () => press(bar(page).getByRole("link", { name: "Home", exact: true })),
    onFresh,
    1,
  );
});
