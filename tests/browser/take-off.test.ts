import { expect, test, type Page } from "@playwright/test";
import { pageHasSettled, signUp } from "./support/account.ts";
import { putGameWhereStaffLeaveIt, stateOf } from "./support/database.ts";
import { addDraft, answerEveryQuestion, gameWhere, MAKER_ADDRESSES, startDraft } from "./support/game.ts";
import { filledButtons, pipRed, showTheOwner } from "./support/look.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

// A maker takes their own live game off Ruken, and puts it back (spec 13.1 M1 and M2). The journeys that look at the
// screens make their game through the maker's real screens, so its files are really in the bucket and Put it back
// really copies them again from the stand-in GitHub; the rest make their live game from rows.

test.beforeEach(forgetRateLimits);

/** A live game made through the real screens: connected to the stand-in GitHub, its files copied, both videos added. */
async function realLiveGame(page: Page): Promise<{ slug: string; name: string }> {
  const game = await answerEveryQuestion(page);
  await putGameWhereStaffLeaveIt(game.slug, { state: "live" });
  return game;
}

test("a maker takes a live game off Ruken", async ({ page }, testInfo) => {
  const { slug, name } = await realLiveGame(page);
  await page.goto(`/make/${slug}`);
  await pageHasSettled(page);

  await page.getByRole("link", { name: `Take ${name} off Ruken` }).click();

  await expect(page).toHaveURL(`/make/${slug}/take-off`);
  await expect(page.getByRole("heading", { name: `Take “${name}” off Ruken?` })).toBeVisible();
  await expect(page.getByText("Players can't find it or play it.")).toBeVisible();
  await expect(page.getByText("You can put it back later. We'll check it again first.")).toBeVisible();
  // Keep is the green, safe choice and has the focus; taking it off is the only red, and nothing is blue.
  await expect(page.getByRole("link", { name: "Keep it on Ruken" })).toBeFocused();
  expect(await pipRed(page)).toEqual(["Take it off"]);
  expect(await filledButtons(page).count()).toBe(0);
  await showTheOwner(page, testInfo, "taking a game off Ruken");

  await page.getByRole("button", { name: "Take it off" }).click();

  await expect(page).toHaveURL(`/make/${slug}`);
  await expect(page.getByRole("heading", { name: "Taken off Ruken" })).toBeVisible();
  await expect(
    page.getByText(/^You took it off on \d{1,2} [A-Z][a-z]+\. Players can't find it\.$/),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Put it back on Ruken" })).toBeVisible();
  // Its files were all deleted, so there is nothing left to offer to delete.
  await expect(page.getByRole("button", { name: "Delete them" })).toHaveCount(0);
  await showTheOwner(page, testInfo, "a game taken off Ruken");
  expect(await stateOf(slug)).toBe("taken_off");
  // It is off: the question is not asked a second time.
  expect((await page.request.get(`/make/${slug}/take-off`)).status()).toBe(404);
});

test("Keep it on Ruken changes nothing", async ({ page }) => {
  const { slug } = await gameWhere(page, { state: "live" });
  await page.goto(`/make/${slug}/take-off`);
  await pageHasSettled(page);

  await page.getByRole("link", { name: "Keep it on Ruken" }).click();

  await expect(page).toHaveURL(`/make/${slug}`);
  await expect(page.getByRole("heading", { name: "Live", exact: true })).toBeVisible();
  expect(await stateOf(slug)).toBe("live");
});

test("putting it back sends it for review", async ({ page }) => {
  const { slug } = await realLiveGame(page);
  await page.goto(`/make/${slug}/take-off`);
  await pageHasSettled(page);
  await page.getByRole("button", { name: "Take it off" }).click();
  await expect(page.getByRole("heading", { name: "Taken off Ruken" })).toBeVisible();
  await pageHasSettled(page);

  await page.getByRole("button", { name: "Put it back on Ruken" }).click();

  await expect(page).toHaveURL(`/make/${slug}`);
  await expect(page.getByRole("heading", { name: "Waiting for review" })).toBeVisible();
  // It waits for a person's yes, like a new game: putting it back never makes it live.
  expect(await stateOf(slug)).toBe("waiting");
});

test("a refused copy is told at once, with the game still off Ruken", async ({ page }) => {
  // Made from rows, so the maker is not connected to GitHub and Ruken cannot see the game's repository.
  const { slug } = await gameWhere(page, { state: "live" });
  await page.goto(`/make/${slug}/take-off`);
  await pageHasSettled(page);
  await page.getByRole("button", { name: "Take it off" }).click();
  await expect(page.getByRole("heading", { name: "Taken off Ruken" })).toBeVisible();
  await pageHasSettled(page);

  await page.getByRole("button", { name: "Put it back on Ruken" }).click();

  // Ruken's refusal is on the screen she lands on, with the one step to fix it, and it says the game is still off.
  await expect(page.getByText("Needs fixing")).toBeVisible();
  await expect(page.getByText(/Ruken can't see that game on GitHub/)).toBeVisible();
  await expect(page.getByText("It stays off Ruken until this is fixed.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Connect GitHub" })).toBeVisible();
  expect(await stateOf(slug)).toBe("draft");
});

test("only a live game has the question", async ({ page }) => {
  const draft = await startDraft(page);
  expect((await page.request.get(`/make/${draft.slug}/take-off`)).status()).toBe(404);

  // The same maker's second game, waiting for review: signing up again while signed in would find no sign-up form.
  const waiting = await addDraft(page);
  await putGameWhereStaffLeaveIt(waiting.slug, { state: "waiting" });
  expect((await page.request.get(`/make/${waiting.slug}/take-off`)).status()).toBe(404);
});

test("another maker's game is a missing page", async ({ page, browser, baseURL }) => {
  const { slug } = await gameWhere(page, { state: "live" });
  const site = baseURL ?? "http://localhost:4173";
  const stranger = await browser.newContext({ baseURL: site });
  try {
    const other = await stranger.newPage();
    await signUp(other);
    const ours = MAKER_ADDRESSES(slug).filter(({ path }) => /take-off|putBack|deleteLeft/.test(path));
    expect(ours).toHaveLength(4);
    for (const { path, form } of ours) {
      expect((await other.goto(path))?.status(), `GET ${path}`).toBe(404);
      if (form !== undefined) {
        const posted = await stranger.request.post(path, { form, headers: { origin: site } });
        expect(posted.status(), `POST ${path}`).toBe(404);
      }
    }
  } finally {
    await stranger.close();
  }
  expect(await stateOf(slug)).toBe("live");
});
