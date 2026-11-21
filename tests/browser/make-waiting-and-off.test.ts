import { expect, test, type Browser, type Page } from "@playwright/test";
import { pageHasSettled, signInAs, signUp } from "./support/account.ts";
import { fillAnswers, putGameWhereStaffLeaveIt, stateOf } from "./support/database.ts";
import {
  addDraft,
  addGame,
  answerName,
  chooseVideo,
  gameWhere,
  giveRealClips,
  realClip,
  reviewJob,
  videoField,
} from "./support/game.ts";
import { boxOf } from "./support/look.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

// Unit B of the everything-editable spec: a game waiting for review can be thrown away from its Waiting screen, and a
// game its maker took off Ruken can be changed and deleted for good from its Taken off screen.

test.beforeEach(forgetRateLimits);
test.setTimeout(120_000);

const SITE = "http://localhost:4173";

type Request = Parameters<typeof reviewJob>[0];

async function waitingSlugs(request: Request, browser: Browser): Promise<string[]> {
  const list = (await (await reviewJob(request, { do: "list" }, browser)).json()) as {
    waiting: { game: string }[];
  };
  return list.waiting.map((one) => one.game);
}

/** What players see of a game: its upright video's address and its line, in a window of its own with no account. */
async function playersSee(browser: Browser, slug: string) {
  const context = await browser.newContext({ baseURL: SITE });
  try {
    const page = await context.newPage();
    await page.goto(`/g/${slug}`, { waitUntil: "domcontentloaded" });
    await pageHasSettled(page);
    const src = await page
      .locator('button[aria-label="Watch the upright video"] video')
      .getAttribute("src");
    return {
      upright: (src ?? "").split("#")[0] ?? "",
      line: (await page.locator(".tagline").first().textContent()) ?? "",
    };
  } finally {
    await context.close();
  }
}

/** The status the game gate answers for one address, asked in a window of its own (a browser keeps a video it was given). */
async function gateAnswers(browser: Browser, address: string): Promise<number> {
  const context = await browser.newContext({ baseURL: SITE });
  try {
    return (await (await context.newPage()).goto(address))?.status() ?? 0;
  } finally {
    await context.close();
  }
}

/** The status of a page, asked in a window of its own with no account. */
async function statusOf(browser: Browser, address: string): Promise<number> {
  return gateAnswers(browser, address);
}

/** A live game's maker takes it off on the real screens and lands on its page. */
async function takeOff(page: Page, slug: string): Promise<void> {
  await page.goto(`/make/${slug}/take-off`);
  await pageHasSettled(page);
  await page.getByRole("button", { name: "Take it off Ruken" }).click();
  await expect(page).toHaveURL(`/make/${slug}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Taken off Ruken");
  await pageHasSettled(page);
}

// ---- B1: a waiting game is thrown away ------------------------------------------------------------------------------

test("a waiting game is thrown away from its Waiting screen: it leaves Your games, staff's list and frees its name", async ({
  page,
  browser,
  request,
}) => {
  const { slug, name } = await gameWhere(page, { state: "waiting" });
  expect(await waitingSlugs(request, browser)).toContain(slug);

  await page.goto(`/make/${slug}`);
  await pageHasSettled(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Waiting for review");
  // Quiet, and under "Change something".
  const change = page.getByRole("link", { name: "Change something" });
  const throwIt = page.getByRole("link", { name: "Throw it away" });
  await expect(throwIt).toBeVisible();
  expect((await boxOf(throwIt)).y).toBeGreaterThan((await boxOf(change)).y);

  // By keyboard alone: the link is reached and pressed with Enter.
  await throwIt.focus();
  await expect(throwIt).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(`/make/${slug}/throw-away`);
  await pageHasSettled(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Throw ${name} away?`);
  await expect(page.getByRole("link", { name: "Keep it" })).toBeFocused();

  await page.getByRole("button", { name: "Throw it away" }).click();

  await expect(page).toHaveURL("/make");
  await expect(page.getByText(`${name} was thrown away.`)).toBeVisible();
  await expect(page.locator(`a[href="/make/${slug}"]`)).toHaveCount(0);
  expect(await stateOf(slug)).toBe("thrown_away");
  expect(await waitingSlugs(request, browser)).not.toContain(slug);

  // Its name can be used for a new game, with the plain address.
  await page.goto("/make/new");
  await pageHasSettled(page);
  await answerName(page, name);
  await expect(page).toHaveURL(`/make/${slug}/line`);
});

test("Keep it on a waiting game's throw-away screen changes nothing", async ({ page, browser, request }) => {
  const { slug } = await gameWhere(page, { state: "waiting" });
  await page.goto(`/make/${slug}/throw-away`);
  await pageHasSettled(page);

  await page.getByRole("link", { name: "Keep it" }).click();

  await expect(page).toHaveURL(`/make/${slug}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Waiting for review");
  expect(await stateOf(slug)).toBe("waiting");
  expect(await waitingSlugs(request, browser)).toContain(slug);
});

// ---- B3: a taken-off game is changed and put back --------------------------------------------------------------------

test("a taken-off game's line and upright video are changed from the Taken off screen, put back, and staff's yes shows them to players", async ({
  page,
  browser,
  request,
}) => {
  const game = await addGame(browser, request);
  const before = await playersSee(browser, game.slug);
  await signInAs(page, game.maker);
  await takeOff(page, game.slug);

  // Every part has a Change, above the blue button that puts it back.
  await expect(page.getByRole("link", { name: "Change the line" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Change the game's files" })).toBeVisible();
  const putBack = page.getByRole("button", { name: "Put it back on Ruken" });
  await expect(putBack).toBeVisible();

  await page.getByRole("link", { name: "Change the line" }).click();
  await expect(page).toHaveURL(`/make/${game.slug}/line`);
  await pageHasSettled(page);
  await page.getByLabel(/about, in one line\?$/).fill("Back again, and better.");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).toHaveURL(`/make/${game.slug}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Taken off Ruken");
  await expect(page.locator(".laid .tagline")).toHaveText("Back again, and better.");

  // The upright video: the link is named for what the window draws, so either name opens the question.
  await page
    .getByRole("link", { name: /^Change the (upright video|video for phones)$/ })
    .first()
    .click();
  await expect(page).toHaveURL(`/make/${game.slug}/upright`);
  await pageHasSettled(page);
  await page.getByRole("link", { name: "Choose a different video" }).click();
  await chooseVideo(page, await realClip(page, "upright"));
  await expect(videoField(page)).toHaveCount(0);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).toHaveURL(`/make/${game.slug}`);
  await pageHasSettled(page);
  expect(await stateOf(game.slug)).toBe("taken_off");
  // Off Ruken, nothing is waiting for staff and nobody can find it.
  expect(await waitingSlugs(request, browser)).not.toContain(game.slug);
  expect(await statusOf(browser, `/g/${game.slug}`)).toBe(404);

  await page.getByRole("button", { name: "Put it back on Ruken" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Waiting for review");
  expect(await waitingSlugs(request, browser)).toContain(game.slug);

  const yes = await reviewJob(request, { do: "accept", game: game.slug }, browser);
  expect(yes.status()).toBe(200);
  const after = await playersSee(browser, game.slug);
  expect(after.line).toBe("Back again, and better.");
  expect(after.upright).not.toBe("");
  expect(after.upright).not.toBe(before.upright);
});

// ---- B4: a taken-off game is deleted for good ------------------------------------------------------------------------

test("a taken-off game is deleted for good: it leaves Your games, its address and its video addresses are 404", async ({
  page,
  browser,
  request,
}) => {
  const game = await addGame(browser, request);
  const live = await playersSee(browser, game.slug);
  expect(await gateAnswers(browser, live.upright)).toBe(200);
  await signInAs(page, game.maker);
  await takeOff(page, game.slug);

  const quiet = page.getByRole("link", { name: "Delete it for good" });
  await expect(quiet).toBeVisible();
  await quiet.focus();
  await expect(quiet).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(`/make/${game.slug}/throw-away`);
  await pageHasSettled(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Throw ${game.name} away?`);
  await page.getByRole("button", { name: "Throw it away" }).click();

  await expect(page).toHaveURL("/make");
  await expect(page.getByText(`${game.name} was thrown away.`)).toBeVisible();
  await expect(page.locator(`a[href="/make/${game.slug}"]`)).toHaveCount(0);
  expect(await stateOf(game.slug)).toBe("thrown_away");
  expect(await statusOf(browser, `/g/${game.slug}`)).toBe(404);
  expect(await gateAnswers(browser, live.upright)).toBe(404);
  expect((await page.request.get(`/make/${game.slug}`)).status()).toBe(404);
});

// ---- G3: someone else's game --------------------------------------------------------------------------------------

test("another maker's waiting or taken-off game is not found, and a throw-away posted by hand leaves it as it was", async ({
  page,
  browser,
}) => {
  const waiting = await gameWhere(page, { state: "waiting" });
  // The same maker's second game: signing up again while signed in would find no sign-up form.
  const off = await addDraft(page);
  await fillAnswers(off.slug, { files: true, videos: true, age: "age_12" });
  await giveRealClips(page, off.slug);
  await putGameWhereStaffLeaveIt(off.slug, { state: "live" });
  await takeOff(page, off.slug);

  const stranger = await browser.newContext({ baseURL: SITE });
  try {
    const other = await stranger.newPage();
    await signUp(other);
    for (const slug of [waiting.slug, off.slug]) {
      expect((await other.goto(`/make/${slug}/throw-away`))?.status(), `GET throw-away of ${slug}`).toBe(404);
      // Answered with Your games whatever happened, so what is proved is that the game is still where it was.
      await stranger.request.post(`${SITE}/make?/throwAway`, {
        form: { game: slug },
        headers: { origin: SITE },
      });
    }
    expect(await stateOf(waiting.slug)).toBe("waiting");
    expect(await stateOf(off.slug)).toBe("taken_off");
  } finally {
    await stranger.close();
  }
});
