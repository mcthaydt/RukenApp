import { expect, test, type Locator, type Page } from "@playwright/test";
import { pageHasSettled } from "./support/account.ts";
import { makerWithGameWhere, signInAsStaff } from "./support/game.ts";
import { decideButton, heading, nextButton, partBox, tickOn, toTheDecision } from "./support/check.ts";
import { boxOf, wordsHaveSettled } from "./support/look.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

// The design check of the staff screens (docs/superpowers/audits/2026-11-16-staff-review-screens-design.md). CI checks
// values and places, not taste: an edge that is there, a choice that is as wide as its part, a button that is in the window.

test.beforeEach(forgetRateLimits);

/** The card a radio button or checkbox lies over. */
const cardOf = (field: Locator) => field.locator("xpath=..");

/** Staff open the check page of a game, signed in as a curator. */
async function checkingAGame(page: Page, slug: string): Promise<void> {
  await signInAsStaff(page);
  await page.goto(`/admin/games/${slug}`);
  await pageHasSettled(page);
  await expect(heading(page)).toBeVisible();
}

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

test("each choice is one to a row, as wide as its part", async ({ page, browser }) => {
  const maker = await makerWithGameWhere(browser, { state: "waiting" });
  try {
    await checkingAGame(page, maker.slug);
    await tickOn(page, "Name").check();
    const name = partBox(page, "Name");
    const part = await boxOf(name);

    for (const card of [
      cardOf(tickOn(page, "Name")),
      cardOf(name.getByRole("radio", { name: "It's rude" })),
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
    const upright = partBox(page, "Upright video").locator("video");
    const wide = partBox(page, "Wide video").locator("video");

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

test("who it is for says it once, in small words, with the way to send it back right over its box", async ({
  page,
  browser,
}) => {
  const maker = await makerWithGameWhere(browser, { state: "waiting" });
  try {
    await checkingAGame(page, maker.slug);
    await toTheDecision(page);
    const age = partBox(page, "Who it's for");

    // The maker's pick is the picked age, and is not written a second time above the ages.
    await expect(age.getByText("12+", { exact: true })).toHaveCount(1);
    await expect(age.getByText("The maker picked 12+. Pick who it's for.")).toHaveCSS("font-size", "14px");
    // The line that explains the box is the line right over it (HL2), not over the ages with the marks between.
    const overItsBox = await age
      .getByText("Or send it back, and the maker will choose again.")
      .evaluate(
        (note) => note.nextElementSibling?.querySelector('input[name="wrong"]') instanceof HTMLInputElement,
      );
    expect(overItsBox).toBe(true);
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

    const own = partBox(page, "Name").getByText(
      "Add a line of your own. You need one if you picked Something else.",
    );
    await expect(own).toHaveCSS("font-size", "14px");
    await expect(page.getByText("Play it, then look at each part. Tick anything that's wrong.")).toHaveCSS(
      "font-size",
      "18px",
    );
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
    const line = page.locator("p.facts");
    await expect(line.getByText(/^Waiting /)).toHaveCSS("white-space", "nowrap");
    // A dot goes with the words after it (HL6), so it is never left at the end of a line.
    const email = await line.getByText(maker.makerEmail).evaluate((one) => one.textContent);
    expect(email).toBe(`\u00b7\u00a0${maker.makerEmail}`);
    await expect(line.getByText(maker.makerEmail)).toHaveCSS("display", "inline-block");
  } finally {
    await maker.close();
  }
});

// The harsh last look (docs/superpowers/audits/2026-11-16-staff-review-screens-harsh-look.md).

test("a refusal inside a part wears the needs-fixing edge, and the page opens with the part's name in view", async ({
  page,
  browser,
}) => {
  // HL3
  const maker = await makerWithGameWhere(browser, { state: "waiting" });
  try {
    await checkingAGame(page, maker.slug);
    await tickOn(page, "One line").check();
    await toTheDecision(page);
    await decideButton(page, "Send back").click();

    const refusal = partBox(page, "One line").getByText("Pick a reason for One line.");
    await expect(refusal).toBeVisible();
    const edge = await refusal.evaluate((words) => getComputedStyle(words).borderLeftWidth);
    expect(Number.parseFloat(edge), "the edge").toBeGreaterThanOrEqual(4);

    // The lines of the page rise into place as it opens, so the place is settled a moment after.
    await expect(async () => {
      const name = await boxOf(partBox(page, "One line").getByRole("heading", { name: "One line" }));
      const size = page.viewportSize();
      expect(name.y).toBeGreaterThanOrEqual(0);
      expect(name.y + name.height).toBeLessThanOrEqual(size?.height ?? 0);
    }).toPass();
  } finally {
    await maker.close();
  }
});

test("the box for who it's for says what it sends back, and the decision's heading names the step", async ({
  page,
  browser,
}) => {
  const maker = await makerWithGameWhere(browser, { state: "waiting" });
  try {
    await checkingAGame(page, maker.slug);
    // The files say what to look for, so staff are not asked to judge a file count.
    await expect(
      partBox(page, "Game files").getByText("Wrong if the game didn't load or parts were missing."),
    ).toBeVisible();
    await toTheDecision(page);
    await expect(heading(page)).toHaveText(`Decide on ${maker.name}`);
    await expect(tickOn(page, "Who it's for")).toBeVisible();
    await expect(partBox(page, "Who it's for").getByText("This is wrong")).toHaveCount(0);
  } finally {
    await maker.close();
  }
});

test("'This is wrong' for who it's for comes after the marks, beside the line that explains it", async ({
  page,
  browser,
}) => {
  // HL2
  const maker = await makerWithGameWhere(browser, { state: "waiting" });
  try {
    await checkingAGame(page, maker.slug);
    await toTheDecision(page);
    await page.getByRole("radio", { name: "18+" }).check();
    const age = partBox(page, "Who it's for");
    const none = await boxOf(cardOf(age.getByRole("checkbox", { name: "None of these" })));
    const explains = await boxOf(age.getByText("Or send it back, and the maker will choose again."));
    const box = await boxOf(cardOf(tickOn(page, "Who it's for")));
    expect(explains.y).toBeGreaterThan(none.y);
    expect(box.y).toBeGreaterThan(explains.y);
  } finally {
    await maker.close();
  }
});

test("a rating's number is in the middle of its tile's height", async ({ page, browser }) => {
  const maker = await makerWithGameWhere(browser, { state: "waiting" });
  try {
    await checkingAGame(page, maker.slug);
    await toTheDecision(page);
    const size = page.viewportSize();
    // The five ratings sit in one row of tiles only from a tablet up; below that each is a row of its own.
    test.skip((size?.width ?? 0) < 500 || (size?.height ?? 0) < 450, "the ratings are rows here");
    await expect
      .poll(async () => {
        const tile = await boxOf(page.locator(".picks[data-ratings] .pick").first());
        const number = await boxOf(page.locator(".picks[data-ratings] .pick > b").first());
        return Math.abs(tile.y + tile.height / 2 - (number.y + number.height / 2));
      })
      .toBeLessThan(4);
  } finally {
    await maker.close();
  }
});

test("the game fits above the pinned bar, on first view where the window is big enough", async ({
  page,
  browser,
}) => {
  const maker = await makerWithGameWhere(browser, { state: "waiting" });
  try {
    await checkingAGame(page, maker.slug);
    await wordsHaveSettled(page);
    const size = page.viewportSize();
    const wideEnough =
      (size?.width ?? 0) >= 500 && (size?.height ?? 0) >= 450 && (size?.width ?? 0) > (size?.height ?? 0);
    const short = (size?.height ?? 0) < 450;
    test.skip(!wideEnough && !short, "an upright window scrolls to the game");
    // A short window shows the game once it is scrolled to; a big one shows it as the page opens.
    if (short)
      await page.locator("iframe.frame").evaluate((one) => {
        one.scrollIntoView({ block: "start" });
      });
    await expect
      .poll(async () => {
        const frame = await boxOf(page.locator("iframe.frame"));
        const bar = await boxOf(page.locator(".acts"));
        return frame.y >= 0 && frame.y + frame.height <= bar.y && frame.height >= 160;
      })
      .toBe(true);
  } finally {
    await maker.close();
  }
});

test("on a phone held sideways the game shows on first view, and the bar is not over it", async ({
  page,
  browser,
}) => {
  const maker = await makerWithGameWhere(browser, { state: "waiting" });
  try {
    await checkingAGame(page, maker.slug);
    await wordsHaveSettled(page);
    test.skip((page.viewportSize()?.height ?? 0) >= 450, "only a short window has this");
    // The first screen's bar is part of the page, not pinned over the window, so it never covers the game.
    expect(await page.locator(".acts").evaluate((one) => getComputedStyle(one).position)).toBe("static");
    // More than 120px of the game are in view as the page opens (before, 44px with the bar over it).
    const frame = await boxOf(page.locator("iframe.frame"));
    const height = page.viewportSize()?.height ?? 0;
    expect(Math.min(frame.y + frame.height, height) - frame.y).toBeGreaterThanOrEqual(120);
    // The decision's bar is pinned again: the one blue button stays in reach where nothing is being played.
    await toTheDecision(page);
    await expect
      .poll(async () => page.locator(".acts").evaluate((one) => getComputedStyle(one).position))
      .toBe("fixed");
  } finally {
    await maker.close();
  }
});

test("a refusal about a part is in view at the top with what it asks for, above the bar", async ({
  page,
  browser,
}) => {
  const maker = await makerWithGameWhere(browser, { state: "waiting" });
  try {
    await checkingAGame(page, maker.slug);
    // A video part: its video stands between its title and its reasons (a part of words is the test above).
    await tickOn(page, "Upright video").check();
    await toTheDecision(page);
    await decideButton(page, "Send back").click();

    // Its refusal and its reasons are in view together, clear of a pinned bar.
    const alert = page.getByRole("alert");
    await expect(alert).toHaveText("Pick a reason for Upright video.");
    const part = partBox(page, "Upright video");
    await expect
      .poll(async () => {
        const refusal = await boxOf(alert);
        const first = await boxOf(part.getByRole("radio").first());
        const pinned = await page
          .locator(".acts")
          .evaluate((one) => getComputedStyle(one).position === "fixed");
        const bar = await boxOf(page.locator(".acts"));
        const height = page.viewportSize()?.height ?? 0;
        return (
          refusal.y >= 0 &&
          refusal.y < first.y &&
          (pinned ? first.y + first.height <= bar.y : first.y < height)
        );
      })
      .toBe(true);
  } finally {
    await maker.close();
  }
});

test("'Full size' is a step under the game's frame, not touching it", async ({ page, browser }) => {
  // HL8
  const maker = await makerWithGameWhere(browser, { state: "waiting" });
  try {
    await checkingAGame(page, maker.slug);
    const fullSize = page.getByRole("button", { name: "Full size" });
    // Only a browser that can show a frame full screen offers it.
    test.skip((await fullSize.count()) === 0, "this browser has no full screen");
    const frame = await boxOf(page.locator("iframe.frame"));
    const button = await boxOf(fullSize);
    expect(button.y - (frame.y + frame.height)).toBeGreaterThanOrEqual(16);
  } finally {
    await maker.close();
  }
});

test("the staff's three links share one line on the narrowest phone", async ({ page }, testInfo) => {
  // HL5
  test.skip(testInfo.project.name !== "computer", "the size is set here, so one project runs it");
  await signInAsStaff(page);
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/admin/games");
  await pageHasSettled(page);
  const tops = [];
  for (const name of ["Ruken", "Games to check", "Your account"])
    tops.push(Math.round((await boxOf(page.getByRole("link", { name, exact: true }).first())).y));
  expect(new Set(tops).size, `top of each link: ${tops.join(", ")}`).toBe(1);
});

test("on a computer the bar starts where the list and the check start, and the blue button is in view as the check opens", async ({
  page,
  browser,
}, testInfo) => {
  // HL9 and HL7
  test.skip(testInfo.project.name !== "computer", "the sizes are set here, so one project runs them");
  const maker = await makerWithGameWhere(browser, { state: "waiting" });
  try {
    await signInAsStaff(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/admin/games");
    await pageHasSettled(page);
    const mark = await boxOf(page.getByRole("link", { name: "Ruken", exact: true }));
    const title = await boxOf(heading(page));
    expect(Math.abs(mark.x - title.x)).toBeLessThanOrEqual(1);

    for (const size of [
      { width: 1440, height: 900 },
      { width: 1080, height: 810 },
    ]) {
      await page.setViewportSize(size);
      await page.goto(`/admin/games/${maker.slug}`);
      await pageHasSettled(page);
      const button = await boxOf(nextButton(page));
      expect(button.y + button.height, `${String(size.width)}x${String(size.height)}`).toBeLessThanOrEqual(
        size.height,
      );
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/admin/games/${maker.slug}`);
    await pageHasSettled(page);
    const first = await boxOf(page.getByRole("link", { name: "Ruken", exact: true }));
    expect(Math.abs(first.x - (await boxOf(heading(page))).x), "the check page").toBeLessThanOrEqual(1);
  } finally {
    await maker.close();
  }
});

test("the error page inside the staff's area has the wordmark, for staff and for anyone else", async ({
  page,
}) => {
  // HL10
  await page.goto("/admin/games/no-such-game");
  await expect(page.getByRole("heading", { name: "We can't find that page." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Ruken", exact: true })).toHaveCount(1);

  await signInAsStaff(page);
  await page.goto("/admin/games/no-such-game");
  await expect(page.getByRole("heading", { name: "We can't find that page." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Ruken", exact: true })).toHaveCount(1);
});

test("on Your account the door to games to check is not on top of Delete my account", async ({ page }) => {
  // HL11
  await signInAsStaff(page);
  await page.goto("/me");
  await pageHasSettled(page);
  const own = await boxOf(page.getByRole("link", { name: "Add yours to Ruken." }));
  const door = await boxOf(page.getByRole("link", { name: "Games to check" }));
  const remove = await boxOf(page.getByRole("link", { name: "Delete my account" }));
  // Delete my account has the step the look gives a thing apart (2rem), not the one between two lines of one group (1rem).
  expect(remove.y - door.y, "the step before Delete my account").toBeGreaterThan(door.y - own.y + 10);
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

  test("the blue button is in the window on both screens, in every window", async ({
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

        // On the first screen, which is long, the button is in view wherever staff are on it; on the decision too.
        const first = await boxOf(nextButton(page));
        expect(first.y, `${size.name}, check`).toBeGreaterThanOrEqual(0);
        expect(first.y + first.height, `${size.name}, check`).toBeLessThanOrEqual(size.height);
        await nextButton(page).click();
        const last = await boxOf(decideButton(page, "Send back"));
        expect(last.y, `${size.name}, decision`).toBeGreaterThanOrEqual(0);
        expect(last.y + last.height, `${size.name}, decision`).toBeLessThanOrEqual(size.height);
      }
    } finally {
      await maker.close();
    }
  });

  test("the game can be played where the check opens, in every window", async ({
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
        // Not a sliver, and as wide as the question it sits in.
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
        const name = await boxOf(heading(page));
        expect(Math.abs(mark.x - name.x), size.name).toBeLessThanOrEqual(1);
      }
    } finally {
      await maker.close();
    }
  });
});
