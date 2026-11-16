import { expect, test, type Locator, type Page } from "@playwright/test";
import { pageHasSettled } from "./support/account.ts";
import { makerWithGameWhere, signInAsStaff } from "./support/game.ts";
import { boxOf } from "./support/look.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

// The design check of the staff screens (docs/superpowers/audits/2026-11-16-staff-review-screens-design.md). CI checks
// values and places, not taste: an edge that is there, a box that is as wide as its sheet, a button that is in the window.

test.beforeEach(forgetRateLimits);

/** The part's own box on the check page, found by its title. */
const partNamed = (page: Page, title: string) => page.getByRole("region", { name: title });
/** The tick on a part. */
const tickOn = (page: Page, title: string) => page.getByRole("checkbox", { name: `This is wrong: ${title}` });
/** The card a radio button or checkbox lies over. */
const cardOf = (field: Locator) => field.locator("xpath=..");

/** Staff open the check page of a game, signed in as a curator. */
async function checkingAGame(page: Page, slug: string): Promise<void> {
  await signInAsStaff(page);
  await page.goto(`/admin/games/${slug}`);
  await pageHasSettled(page);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

/** The colour and width of an edge, and the colour of the sheet the thing is on. */
const edgeOf = (thing: Locator) =>
  thing.evaluate((element) => {
    const style = getComputedStyle(element);
    const sheet = element.closest(".sheet");
    return {
      colour: style.borderTopColor,
      width: Number.parseFloat(style.borderTopWidth),
      sheet: sheet === null ? "" : getComputedStyle(sheet).backgroundColor,
    };
  });

test("only one Ruken wordmark is at the top of a staff page", async ({ page, browser }) => {
  const maker = await makerWithGameWhere(browser, { state: "waiting" });
  try {
    await signInAsStaff(page);
    for (const address of ["/admin/games", `/admin/games/${maker.slug}`]) {
      await page.goto(address);
      await pageHasSettled(page);
      await expect(page.getByRole("link", { name: "Ruken", exact: true }), address).toHaveCount(1);
    }
  } finally {
    await maker.close();
  }
});

test("the left half of the check page is its first child, not the hidden field", async ({
  page,
  browser,
}) => {
  const maker = await makerWithGameWhere(browser, { state: "waiting" });
  try {
    await checkingAGame(page, maker.slug);
    // The look keeps the first child in view while the sheet scrolls; the hidden field was that child.
    const first = await page.locator("form.halves").evaluate((form) => form.firstElementChild?.tagName);
    expect(first).toBe("DIV");
  } finally {
    await maker.close();
  }
});

test("on the white sheet a choice, a box to type in and a reason's mark can be seen when nothing is picked", async ({
  page,
  browser,
}) => {
  const maker = await makerWithGameWhere(browser, { state: "waiting" });
  try {
    await checkingAGame(page, maker.slug);
    await tickOn(page, "Upright video").check();
    const video = partNamed(page, "Upright video");

    const choices = [
      cardOf(video.getByRole("radio", { name: "It's too dark to see." })),
      cardOf(video.getByRole("checkbox", { name: "This is wrong: Upright video" })),
      cardOf(page.getByRole("radio", { name: "3+" })),
    ];
    for (const choice of choices) {
      const edge = await edgeOf(choice);
      expect(edge.width, "an edge is drawn").toBeGreaterThan(0);
      expect(edge.colour, "and it is not the sheet's own colour").not.toBe(edge.sheet);
    }

    const box = await edgeOf(video.locator("textarea"));
    expect(box.width, "the box to type in has an edge").toBeGreaterThan(0);
    expect(box.colour, "that is not the sheet's own colour").not.toBe(box.sheet);

    // A reason that is not picked has an empty mark, as a tick box that is not ticked has an empty square.
    const mark = await cardOf(video.getByRole("radio", { name: "It's too dark to see." })).evaluate(
      (card) => getComputedStyle(card, "::after").content,
    );
    expect(mark).not.toBe("none");
    expect(mark).not.toBe("normal");
  } finally {
    await maker.close();
  }
});

test("on the sheet each choice is one to a row, as wide as its part", async ({ page, browser }) => {
  const maker = await makerWithGameWhere(browser, { state: "waiting" });
  try {
    await checkingAGame(page, maker.slug);
    await tickOn(page, "Name").check();
    const name = partNamed(page, "Name");
    const part = await boxOf(name);

    for (const card of [
      cardOf(tickOn(page, "Name")),
      cardOf(name.getByRole("radio", { name: "It's rude." })),
      cardOf(name.getByRole("radio", { name: "Something else" })),
    ]) {
      expect((await boxOf(card)).width).toBeGreaterThanOrEqual(part.width - 2);
    }
  } finally {
    await maker.close();
  }
});

test("each video is drawn in its own shape, whole", async ({ page, browser }) => {
  const maker = await makerWithGameWhere(browser, { state: "waiting" });
  try {
    await checkingAGame(page, maker.slug);
    const upright = partNamed(page, "Upright video").locator("video");
    const wide = partNamed(page, "Wide video").locator("video");

    const tall = await boxOf(upright);
    expect(tall.width / tall.height).toBeCloseTo(9 / 16, 1);
    const broad = await boxOf(wide);
    expect(broad.width / broad.height).toBeCloseTo(16 / 9, 1);
    // The whole picture shows, never a cropped one.
    await expect(upright).toHaveCSS("object-fit", "contain");
    await expect(wide).toHaveCSS("object-fit", "contain");
  } finally {
    await maker.close();
  }
});

test("who it is for says it once, in small words, with the way to send it back right under the ages", async ({
  page,
  browser,
}) => {
  const maker = await makerWithGameWhere(browser, { state: "waiting" });
  try {
    await checkingAGame(page, maker.slug);
    const age = partNamed(page, "Who it's for");

    // The maker's pick is the picked age, and is not written a second time above the ages.
    await expect(age.getByText("12+", { exact: true })).toHaveCount(1);
    await expect(age.getByText("The maker picked 12+. Pick who it's for.")).toHaveCSS("font-size", "14px");
    const underAges = await age
      .getByText("Or send it back, and the maker will choose again.")
      .evaluate((note) => note.previousElementSibling?.matches("[data-ratings]") === true);
    expect(underAges).toBe(true);
  } finally {
    await maker.close();
  }
});

test("the line about a line of your own is a small note, and the instruction is read at body size", async ({
  page,
  browser,
}) => {
  const maker = await makerWithGameWhere(browser, { state: "waiting" });
  try {
    await checkingAGame(page, maker.slug);
    await tickOn(page, "Name").check();

    const own = partNamed(page, "Name").getByText(
      "Add a line of your own. You need one if you picked Something else.",
    );
    await expect(own).toHaveCSS("font-size", "14px");
    await expect(
      page.getByText(
        "Play it and look at each part. Tick anything that's wrong, then press the blue button.",
      ),
    ).toHaveCSS("font-size", "18px");
  } finally {
    await maker.close();
  }
});

test("a part's title is a step larger, so the parts can be told apart", async ({ page, browser }) => {
  const maker = await makerWithGameWhere(browser, { state: "waiting" });
  try {
    await checkingAGame(page, maker.slug);
    await expect(page.getByRole("heading", { level: 2, name: "Name" })).toHaveCSS("font-size", "16px");
  } finally {
    await maker.close();
  }
});

test("the line above the name keeps 'Waiting' whole and the email in one piece", async ({
  page,
  browser,
}) => {
  const maker = await makerWithGameWhere(browser, { state: "waiting" });
  try {
    await checkingAGame(page, maker.slug);
    const line = page.locator("p.count");
    await expect(line.getByText(/^Waiting /)).toHaveCSS("white-space", "nowrap");
    await expect(line.getByText(maker.makerEmail)).toHaveCSS("display", "inline-block");
  } finally {
    await maker.close();
  }
});

// The windows below are set by the test, so one browser tells the five layouts apart.
test.describe("the windows", () => {
  // The sizes are set by each test, so one project runs them and the others would only repeat it.
  const onlyOnComputer = (projectName: string) => {
    test.skip(projectName !== "computer", "the sizes are set here, so one project runs them");
  };

  const WINDOWS = [
    { name: "computer 1440x900", width: 1440, height: 900 },
    { name: "computer 1280x720", width: 1280, height: 720 },
    { name: "iPad sideways", width: 1080, height: 810 },
    { name: "iPad upright", width: 810, height: 1080 },
    { name: "phone sideways", width: 932, height: 430 },
    { name: "phone", width: 393, height: 852 },
    { name: "small phone", width: 375, height: 667 },
  ];

  test("the blue button is in the window at the end of the sheet, in every window", async ({
    page,
    browser,
  }, testInfo) => {
    onlyOnComputer(testInfo.project.name);
    const maker = await makerWithGameWhere(browser, { state: "waiting" });
    try {
      await signInAsStaff(page);
      for (const size of WINDOWS) {
        await page.setViewportSize({ width: size.width, height: size.height });
        await page.goto(`/admin/games/${maker.slug}`);
        await pageHasSettled(page);
        await page.emulateMedia({ reducedMotion: "reduce" });
        await tickOn(page, "Name").check();
        await page.evaluate(() => {
          window.scrollTo(0, document.documentElement.scrollHeight);
        });

        const button = await boxOf(page.getByRole("button", { name: "Send back" }));
        expect(button.y, size.name).toBeGreaterThanOrEqual(0);
        expect(button.y + button.height, size.name).toBeLessThanOrEqual(size.height);
      }
    } finally {
      await maker.close();
    }
  });

  test("where the game sits beside the sheet, the whole left half fits the window", async ({
    page,
    browser,
  }, testInfo) => {
    onlyOnComputer(testInfo.project.name);
    const maker = await makerWithGameWhere(browser, { state: "waiting" });
    try {
      await signInAsStaff(page);
      for (const size of WINDOWS.filter(
        (one) => one.width >= 700 && one.height >= 450 && one.width > one.height,
      )) {
        await page.setViewportSize({ width: size.width, height: size.height });
        await page.goto(`/admin/games/${maker.slug}`);
        await pageHasSettled(page);
        const left = await boxOf(page.locator("form.halves > :first-child"));
        expect(left.height, size.name).toBeLessThanOrEqual(size.height);
        // And it is a game that can be played there, not a sliver.
        expect((await boxOf(page.locator("iframe.frame"))).height, size.name).toBeGreaterThanOrEqual(190);
      }
    } finally {
      await maker.close();
    }
  });

  test("a phone held sideways gives the game room to be played", async ({ page, browser }, testInfo) => {
    onlyOnComputer(testInfo.project.name);
    const maker = await makerWithGameWhere(browser, { state: "waiting" });
    try {
      await signInAsStaff(page);
      await page.setViewportSize({ width: 932, height: 430 });
      await page.goto(`/admin/games/${maker.slug}`);
      await pageHasSettled(page);

      const frame = await boxOf(page.locator("iframe.frame"));
      expect(frame.width).toBeGreaterThanOrEqual(340);
      expect(frame.height).toBeGreaterThanOrEqual(300);
    } finally {
      await maker.close();
    }
  });

  test("on a wide computer the bar and the page start at one left edge", async ({
    page,
    browser,
  }, testInfo) => {
    onlyOnComputer(testInfo.project.name);
    const maker = await makerWithGameWhere(browser, { state: "waiting" });
    try {
      await signInAsStaff(page);
      for (const size of WINDOWS.slice(0, 2)) {
        await page.setViewportSize({ width: size.width, height: size.height });
        await page.goto(`/admin/games/${maker.slug}`);
        await pageHasSettled(page);
        const mark = await boxOf(page.getByRole("link", { name: "Ruken", exact: true }));
        const name = await boxOf(page.getByRole("heading", { level: 1 }));
        expect(Math.abs(mark.x - name.x), size.name).toBeLessThanOrEqual(1);
      }
    } finally {
      await maker.close();
    }
  });
});
