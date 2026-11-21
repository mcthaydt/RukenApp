import { expect, test, type Browser, type Page } from "@playwright/test";
import { pageHasSettled, signUp } from "./support/account.ts";
import { changeGame, givePage, makerEmailOf } from "./support/database.ts";
import { answerAge, chooseVideo, gameWhere, realClip, reviewJob } from "./support/game.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

// A live game's videos and rating (unit A of the everything-editable spec): the maker changes them on Live, the new
// value is held apart and sent for review in the same save, players keep what staff said yes to, and only staff's yes,
// for the look they made, makes it live. "Keep the old one" drops a change.

test.beforeEach(forgetRateLimits);
test.setTimeout(120_000);

const SITE = "http://localhost:4173";

type Shape = "upright" | "wide";

/** What players see of a game: its two clips' addresses and its rating chip, in a window of its own with no account. */
async function playersSee(browser: Browser, slug: string) {
  const context = await browser.newContext({ baseURL: SITE });
  try {
    const page = await context.newPage();
    await page.goto(`/g/${slug}`, { waitUntil: "domcontentloaded" });
    await pageHasSettled(page);
    const address = async (shape: Shape) =>
      (
        (await page.locator(`button[aria-label="Watch the ${shape} video"] video`).getAttribute("src")) ?? ""
      ).split("#")[0] ?? "";
    return {
      upright: await address("upright"),
      wide: await address("wide"),
      chip: (await page.locator(".chip").first().textContent()) ?? "",
    };
  } finally {
    await context.close();
  }
}

/**
 * The status the game gate answers for one address. A browser asks, since Node cannot reach `*.localhost`, and a window
 * of its own each time, since a video the gate said yes to once is kept by the browser's own cache.
 */
async function gateAnswers(browser: Browser, address: string): Promise<number> {
  const context = await browser.newContext({ baseURL: SITE });
  try {
    return (await (await context.newPage()).goto(address))?.status() ?? 0;
  } finally {
    await context.close();
  }
}

interface Look {
  says: string;
  seen?: string | null;
  changes?: { part: string; now: string | null; waiting: string }[];
}

async function lookAt(
  request: Parameters<typeof reviewJob>[0],
  browser: Browser,
  slug: string,
): Promise<Look> {
  const response = await reviewJob(request, { do: "look", game: slug }, browser);
  expect(response.status()).toBe(200);
  return (await response.json()) as Look;
}

async function waitingSlugs(request: Parameters<typeof reviewJob>[0], browser: Browser): Promise<string[]> {
  const list = (await (await reviewJob(request, { do: "list" }, browser)).json()) as {
    waiting: { game: string }[];
  };
  return list.waiting.map((one) => one.game);
}

/** The maker changes one video from Live, through the screens, with the keyboard for the link. */
async function changeVideo(page: Page, slug: string, shape: Shape): Promise<void> {
  await page.goto(`/make/${slug}`);
  await pageHasSettled(page);
  // The video Live draws has a bare Change, heard as "Change the wide video"; the other is a link in words, "Change the
  // video for computers". Which is which depends on the window, so either name opens the question.
  const change = page.getByRole("link", {
    name: new RegExp(`^Change the (${shape} video|video for ${shape === "wide" ? "computers" : "phones"})$`),
  });
  await change.focus();
  await expect(change).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(`/make/${slug}/${shape}`);
  await pageHasSettled(page);
  await page.getByRole("link", { name: "Choose a different video" }).click();
  await expect(page).toHaveURL(`/make/${slug}/${shape}?again=1`);
  await chooseVideo(page, await realClip(page, shape));
  await expect(page).toHaveURL(`/make/${slug}`);
  await pageHasSettled(page);
}

/** The video a video question shows in its frame (a live game's frame shows the one that waits). */
async function videoInFrame(page: Page, slug: string, shape: Shape): Promise<string> {
  await page.goto(`/make/${slug}/${shape}`);
  await pageHasSettled(page);
  const src = await page.locator(`[data-frame="${shape}"] video`).getAttribute("src");
  return (src ?? "").split("#")[0] ?? "";
}

const WAITING = "Your update is waiting for review.";
const FINE = "Players can find it on Ruken.";

// ---- A1, A2: a video, and the rating --------------------------------------------------------------------------------

for (const shape of ["upright", "wide"] as const) {
  test(`a live game's new ${shape} video waits for review, players keep the old one, and a yes makes it live`, async ({
    page,
    browser,
    request,
  }) => {
    const { slug } = await gameWhere(page, { state: "live" });
    const before = await playersSee(browser, slug);

    await changeVideo(page, slug, shape);

    // Live says it is waiting, with the new video marked, and nothing else to press.
    await expect(page.getByText(WAITING)).toBeVisible();
    await expect(page.locator(".laid .waits")).toHaveText("Waiting for review");
    await expect(page.getByRole("button", { name: "Send it again" })).toHaveCount(0);
    // Players still see the old one, and the old file is still served.
    const held = await videoInFrame(page, slug, shape);
    expect(held).not.toBe("");
    const during = await playersSee(browser, slug);
    expect(during[shape]).toBe(before[shape]);
    expect(held).not.toBe(before[shape]);
    expect(await gateAnswers(browser, before[shape])).toBe(200);

    // Staff look, and say yes for that look.
    const looked = await lookAt(request, browser, slug);
    // The look names the video players see now and the one that waits, as the addresses they are served from.
    expect(looked.changes).toEqual([{ part: `${shape}_video`, now: before[shape], waiting: held }]);
    const yes = await reviewJob(request, { do: "accept", game: slug, seen: looked.seen }, browser);
    expect(yes.status()).toBe(200);

    const after = await playersSee(browser, slug);
    expect(after[shape]).toBe(held);
    expect(await gateAnswers(browser, before[shape])).toBe(404);
    expect(await gateAnswers(browser, held)).toBe(200);
    await page.goto(`/make/${slug}`);
    await expect(page.locator(".laid .waits")).toHaveCount(0);
    await expect(page.getByText(FINE)).toBeVisible();
  });
}

test("a live game's new rating waits for review: the chip players see changes only after the yes", async ({
  page,
  browser,
  request,
}) => {
  const { slug } = await gameWhere(page, { state: "live" });
  expect((await playersSee(browser, slug)).chip).toBe("12+");

  await page.goto(`/make/${slug}`);
  await pageHasSettled(page);
  await page.getByRole("link", { name: "Change who it's for" }).click();
  await expect(page).toHaveURL(`/make/${slug}/age`);
  await pageHasSettled(page);
  await answerAge(page, "7+");

  await expect(page).toHaveURL(`/make/${slug}`);
  await expect(page.getByText(WAITING)).toBeVisible();
  await expect(page.locator(".chip", { hasText: "7+" })).toBeVisible();
  await expect(page.locator(".laid .waits")).toHaveText("Waiting for review");
  expect((await playersSee(browser, slug)).chip).toBe("12+");

  const looked = await lookAt(request, browser, slug);
  expect(looked.changes).toEqual([expect.objectContaining({ part: "age_rating" })]);
  await reviewJob(request, { do: "accept", game: slug, seen: looked.seen }, browser);

  expect((await playersSee(browser, slug)).chip).toBe("7+");
});

// ---- A3: 18+ and its marks ------------------------------------------------------------------------------------------

test("a live game made 18+ is asked its marks first, keeps nothing until they are answered, and leaves a maker's page only after the yes", async ({
  page,
  browser,
  request,
}) => {
  const { slug } = await gameWhere(page, { state: "live" });
  const owner = { email: await makerEmailOf(slug) };
  const { handle } = await givePage(owner, { name: "Night Owl", oneLine: "Small, hard games." });
  const stranger = await browser.newContext({ baseURL: SITE });
  try {
    const visitor = await stranger.newPage();
    await visitor.goto(`/${handle}`, { waitUntil: "domcontentloaded" });
    await expect(visitor.locator(`a[href="/g/${slug}"]`).first()).toBeVisible();

    await page.goto(`/make/${slug}/age`);
    await pageHasSettled(page);
    await answerAge(page, "18+");
    await expect(page).toHaveURL(`/make/${slug}/marks?age=18`);
    await pageHasSettled(page);

    // Leaving the marks screen keeps nothing: the rating is not held.
    await page.goto(`/make/${slug}`);
    await expect(page.getByText(FINE)).toBeVisible();
    await expect(page.locator(".laid .waits")).toHaveCount(0);

    await page.goto(`/make/${slug}/age`);
    await pageHasSettled(page);
    await answerAge(page, "18+");
    await expect(page).toHaveURL(`/make/${slug}/marks?age=18`);
    await pageHasSettled(page);
    await page.getByRole("checkbox", { name: /^Gore/ }).check();
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page).toHaveURL(`/make/${slug}`);
    await expect(page.getByText(WAITING)).toBeVisible();

    // Until the yes, players and the maker's page still have it as it was.
    await visitor.reload({ waitUntil: "domcontentloaded" });
    await expect(visitor.locator(`a[href="/g/${slug}"]`).first()).toBeVisible();
    expect((await playersSee(browser, slug)).chip).toBe("12+");

    const looked = await lookAt(request, browser, slug);
    await reviewJob(request, { do: "accept", game: slug, seen: looked.seen }, browser);

    expect((await playersSee(browser, slug)).chip).toMatch(/^18\+/);
    // An 18+ game is not shown on a maker's page.
    await visitor.reload({ waitUntil: "domcontentloaded" });
    await expect(visitor.locator(`a[href="/g/${slug}"]`)).toHaveCount(0);
  } finally {
    await stranger.close();
  }
});

test("only the marks of a live 18+ game change: players see the old marks until the yes, then the new ones", async ({
  page,
  browser,
  request,
}) => {
  const { slug } = await gameWhere(page, { state: "live" });
  // A game that is already 18+, with its marks (as the database holds one past draft).
  await makeEighteen(slug, ["gore"]);
  const before = (await playersSee(browser, slug)).chip;
  expect(before).toMatch(/^18\+/);

  await page.goto(`/make/${slug}/marks`);
  await pageHasSettled(page);
  await page.getByRole("checkbox", { name: /^Gore/ }).uncheck();
  await page.getByRole("checkbox", { name: /^Drugs/ }).check();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).toHaveURL(`/make/${slug}`);
  await expect(page.getByText(WAITING)).toBeVisible();

  expect((await playersSee(browser, slug)).chip).toBe(before);
  const looked = await lookAt(request, browser, slug);
  await reviewJob(request, { do: "accept", game: slug, seen: looked.seen }, browser);

  const after = (await playersSee(browser, slug)).chip;
  expect(after).not.toBe(before);
  expect(after).toMatch(/^18\+/);
});

// ---- A4: staff send a held change back ------------------------------------------------------------------------------

test("a held video staff sent back shows its words and the refused video, and another video sends it again", async ({
  page,
  browser,
  request,
}) => {
  const { slug } = await gameWhere(page, { state: "live" });
  await changeVideo(page, slug, "wide");
  const refused = await videoInFrame(page, slug, "wide");

  const sent = await reviewJob(
    request,
    { do: "send-back", game: slug, parts: [{ part: "wide_video", words: "It is too dark to see." }] },
    browser,
  );
  expect(sent.status()).toBe(200);

  await page.goto(`/make/${slug}`);
  await pageHasSettled(page);
  const card = page.locator("a.fix");
  await expect(card).toContainText("It is too dark to see.");
  // The card says it needs fixing, so the video itself carries no mark that says it waits.
  await expect(page.locator(".laid .waits")).toHaveCount(0);
  await expect(card.locator("video")).toHaveAttribute("src", new RegExp(`^${escapeRegExp(refused)}`));
  await expect(page.getByText(WAITING)).toHaveCount(0);

  // The card, with the keyboard, opens the picker; a new video sends it in the same save.
  await card.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(`/make/${slug}/wide?again=1`);
  await pageHasSettled(page);
  await chooseVideo(page, await realClip(page, "wide"));
  await expect(page).toHaveURL(`/make/${slug}`);
  await expect(page.getByText(WAITING)).toBeVisible();
  await expect(page.locator("a.fix")).toHaveCount(0);

  const looked = await lookAt(request, browser, slug);
  await reviewJob(request, { do: "accept", game: slug, seen: looked.seen }, browser);
  const now = await videoInFrame(page, slug, "wide");
  expect((await playersSee(browser, slug)).wide).toBe(now);
  expect(now).not.toBe(refused);
});

test("a video sent back while the rating waits too: Keep the old one drops the video, and the rating waits for review again", async ({
  page,
  browser,
  request,
}) => {
  const { slug } = await gameWhere(page, { state: "live" });
  await changeVideo(page, slug, "wide");
  await page.goto(`/make/${slug}/age`);
  await pageHasSettled(page);
  await answerAge(page, "7+");
  await expect(page).toHaveURL(`/make/${slug}`);
  await reviewJob(
    request,
    { do: "send-back", game: slug, parts: [{ part: "wide_video", words: "Too dark." }] },
    browser,
  );

  await page.goto(`/make/${slug}/wide?again=1`);
  await pageHasSettled(page);
  const keep = page.getByRole("button", { name: "Keep the old one" });
  await keep.focus();
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(`/make/${slug}`);
  await expect(page.locator("a.fix")).toHaveCount(0);
  await expect(page.getByText(WAITING)).toBeVisible();
  await expect(page.locator(".chip", { hasText: "7+" })).toBeVisible();
  expect(await waitingSlugs(request, browser)).toContain(slug);
});

test("a video sent back and nothing else held: Keep the old one makes the game plain Live again", async ({
  page,
  browser,
  request,
}) => {
  const { slug, name } = await gameWhere(page, { state: "live" });
  await changeVideo(page, slug, "wide");
  await reviewJob(
    request,
    { do: "send-back", game: slug, parts: [{ part: "wide_video", words: "Too dark." }] },
    browser,
  );

  await page.goto(`/make/${slug}/wide?again=1`);
  await pageHasSettled(page);
  await page.getByRole("button", { name: "Keep the old one" }).click();

  await expect(page).toHaveURL(`/make/${slug}`);
  await expect(page.getByText(FINE)).toBeVisible();
  await expect(page.locator("a.fix")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Send it again" })).toHaveCount(0);
  // Your games says Live, and staff are not asked to look at nothing.
  await page.goto("/make");
  await expect(page.locator(`a[href="/make/${slug}"]`)).toContainText(name);
  await expect(page.locator(`a[href="/make/${slug}"]`).getByText("Live", { exact: true })).toBeVisible();
  expect(await waitingSlugs(request, browser)).not.toContain(slug);
});

test("staff cannot send back a video, or the rating, that holds no change", async ({
  page,
  browser,
  request,
}) => {
  const { slug } = await gameWhere(page, { state: "live", updateWaiting: true });

  for (const part of ["upright_video", "wide_video", "age_rating"]) {
    const refused = await reviewJob(
      request,
      { do: "send-back", game: slug, parts: [{ part, words: "No." }] },
      browser,
    );
    expect(refused.status(), part).toBe(400);
  }
  expect(await waitingSlugs(request, browser)).toContain(slug);
});

// ---- A5: keep the old one -------------------------------------------------------------------------------------------

test("Keep the old one drops a held video and a held rating, and the held file is no longer served", async ({
  page,
  browser,
  request,
}) => {
  const { slug } = await gameWhere(page, { state: "live" });
  await changeVideo(page, slug, "wide");
  await page.goto(`/make/${slug}/age`);
  await pageHasSettled(page);
  await answerAge(page, "7+");
  await expect(page).toHaveURL(`/make/${slug}`);
  const held = await videoInFrame(page, slug, "wide");
  expect(await gateAnswers(browser, held)).toBe(200);

  for (const [question, button] of [
    ["wide", "Keep the old one"],
    ["age", "Keep the old one"],
  ] as const) {
    await page.goto(`/make/${slug}/${question}`);
    await pageHasSettled(page);
    await page.getByRole("button", { name: button }).click();
    await expect(page).toHaveURL(`/make/${slug}`);
  }

  await expect(page.locator(".laid .waits")).toHaveCount(0);
  await expect(page.getByText(FINE)).toBeVisible();
  await expect(page.locator(".chip", { hasText: "12+" })).toBeVisible();
  expect(await waitingSlugs(request, browser)).not.toContain(slug);
  expect(await gateAnswers(browser, held)).toBe(404);
  // Pressing it again, from an old page, changes nothing.
  const again = await page.request.post(`${SITE}/make/${slug}/wide?/keepOld`, {
    form: {},
    headers: { origin: SITE },
  });
  expect(again.ok()).toBe(true);
});

test("Keep the old one is not offered where nothing is held", async ({ page }) => {
  const { slug } = await gameWhere(page, { state: "live" });
  for (const question of ["upright", "wide", "age"]) {
    await page.goto(`/make/${slug}/${question}`);
    await pageHasSettled(page);
    await expect(page.getByRole("button", { name: "Keep the old one" })).toHaveCount(0);
  }
});

// ---- A10: a yes is for the look it came from -------------------------------------------------------------------------

test("a yes needs the time of the latest look: a video changed after the look, or no look, is a clash and nothing goes live", async ({
  page,
  browser,
  request,
}) => {
  const { slug } = await gameWhere(page, { state: "live" });
  await changeVideo(page, slug, "wide");
  const first = await lookAt(request, browser, slug);
  expect(first.seen).toEqual(expect.any(String));
  const liveBefore = (await playersSee(browser, slug)).wide;

  // The maker saves another video after the look.
  await changeVideo(page, slug, "wide");
  const changed = await videoInFrame(page, slug, "wide");

  for (const order of [
    { do: "accept", game: slug, seen: first.seen },
    { do: "accept", game: slug },
  ]) {
    const clash = await reviewJob(request, order, browser);
    expect(clash.status()).toBe(409);
    expect(await clash.json()).toEqual({ problem: "It changed since you looked. Look again." });
  }
  expect((await playersSee(browser, slug)).wide).toBe(liveBefore);

  const second = await lookAt(request, browser, slug);
  expect(second.seen).not.toBe(first.seen);
  const yes = await reviewJob(request, { do: "accept", game: slug, seen: second.seen }, browser);
  expect(yes.status()).toBe(200);
  expect((await playersSee(browser, slug)).wide).toBe(changed);
});

test("an update with nothing held is looked at and accepted as before, with no time", async ({
  page,
  browser,
  request,
}) => {
  const { slug, name } = await gameWhere(page, { state: "live", updateWaiting: true });

  const looked = await lookAt(request, browser, slug);
  expect(looked).not.toHaveProperty("changes");
  expect(looked).not.toHaveProperty("seen");
  const yes = await reviewJob(request, { do: "accept", game: slug }, browser);

  expect(await yes.json()).toEqual({ says: `${name}'s new version is live.` });
});

test("a copy GitHub refused: a held video is kept and not sent, and Live says what to fix", async ({
  page,
  browser,
  request,
}) => {
  const { slug } = await gameWhere(page, {
    state: "live",
    pullProblem: "Your game's files had no index.html.",
  });

  await changeVideo(page, slug, "wide");

  await expect(page.getByText("Your last copy from GitHub didn't work.")).toBeVisible();
  await expect(page.getByText(WAITING)).toHaveCount(0);
  // Nobody is reviewing it, so the mark does not say so.
  await expect(page.locator(".laid .waits")).toHaveText("Not sent yet");
  expect(await waitingSlugs(request, browser)).not.toContain(slug);
});

// ---- What the screens say about what waits ---------------------------------------------------------------------------

test("a video sent back while the rating waits: the rating says it is not sent yet, and the video says nothing of waiting", async ({
  page,
  browser,
  request,
}) => {
  const { slug } = await gameWhere(page, { state: "live" });
  await changeVideo(page, slug, "wide");
  await page.goto(`/make/${slug}/age`);
  await pageHasSettled(page);
  await answerAge(page, "7+");
  await expect(page).toHaveURL(`/make/${slug}`);
  await expect(page.locator(".laid .waits")).toHaveText(["Waiting for review", "Waiting for review"]);
  await reviewJob(
    request,
    { do: "send-back", game: slug, parts: [{ part: "wide_video", words: "Too dark." }] },
    browser,
  );

  await page.goto(`/make/${slug}`);
  await pageHasSettled(page);
  await expect(page.locator("a.fix")).toHaveCount(1);
  await expect(page.locator(".laid .waits")).toHaveText("Not sent yet");
  await expect(page.locator(".laid").getByText("Waiting for review")).toHaveCount(0);
});

test("the question screens say what waits, and Keep the old one is under the buttons, never before Save", async ({
  page,
}) => {
  const { slug } = await gameWhere(page, { state: "live" });
  await changeVideo(page, slug, "wide");
  await page.goto(`/make/${slug}/age`);
  await pageHasSettled(page);
  await answerAge(page, "7+");
  await expect(page).toHaveURL(`/make/${slug}`);

  await page.goto(`/make/${slug}/wide`);
  await pageHasSettled(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Change your wide video");
  await expect(page.getByText("Waiting for review. Players see the old one until we say yes.")).toBeVisible();

  await page.goto(`/make/${slug}/age`);
  await pageHasSettled(page);
  await expect(page.getByText("Waiting for review. Players see 12+ until we say yes.")).toBeVisible();
  // Not in the row of buttons, and after Save in the form, so Enter in the form presses Save.
  await expect(page.locator(".acts").getByRole("button", { name: "Keep the old one" })).toHaveCount(0);
  const buttons = await page
    .locator("form button")
    .evaluateAll((all) => all.map((one) => one.textContent.trim()));
  expect(buttons.indexOf("Save")).toBeGreaterThanOrEqual(0);
  expect(buttons.indexOf("Save")).toBeLessThan(buttons.indexOf("Keep the old one"));
  // Enter on a choice saves it; it does not drop the change.
  await page.getByRole("radio", { name: /^16\+/ }).check();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(`/make/${slug}`);
  await expect(page.locator(".chip", { hasText: "16+" })).toBeVisible();
});

// ---- Everyone else -------------------------------------------------------------------------------------------------

test("another maker cannot keep the old one of a game that holds a change, and it stays held", async ({
  page,
  browser,
}) => {
  const { slug } = await gameWhere(page, { state: "live" });
  await changeVideo(page, slug, "wide");
  const other = await browser.newContext({ baseURL: SITE });
  try {
    await signUp(await other.newPage());
    for (const question of ["wide", "age"]) {
      const posted = await other.request.post(`${SITE}/make/${slug}/${question}?/keepOld`, {
        form: {},
        headers: { origin: SITE },
      });
      expect(posted.status(), question).toBe(404);
    }
    const asked = await other.request.post(`${SITE}/make/${slug}/age?/answer`, {
      form: { ageRating: "age_3" },
      headers: { origin: SITE },
    });
    expect(asked.status()).toBe(404);
  } finally {
    await other.close();
  }

  await page.goto(`/make/${slug}`);
  await expect(page.getByText(WAITING)).toBeVisible();
  await expect(page.locator(".laid .waits")).toHaveText("Waiting for review");
});

// ---- helpers -------------------------------------------------------------------------------------------------------

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Makes a live game 18+ with its marks, as the database holds one past draft. */
async function makeEighteen(slug: string, marks: ("sex_or_nudity" | "gore" | "drugs" | "none")[]) {
  await changeGame(slug, { ageRating: "age_18", contentMarks: marks });
}
