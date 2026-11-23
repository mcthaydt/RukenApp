import { expect, test } from "@playwright/test";
import { pageHasSettled, signUp } from "./support/account.ts";
import { fillAnswers } from "./support/database.ts";
import {
  aviFile,
  chooseVideo,
  connectGitHubFromFiles,
  gameWhere,
  nextButton,
  startAtFiles,
  startDraft,
  tooBigVideo,
  TINY_GAME,
} from "./support/game.ts";
import { pipRed } from "./support/look.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

// What the end-to-end walk of the submission screens found (docs/superpowers/audits/2026-11-15-submission-screens-end-to-end.md),
// one journey for each thing that was wrong, and the take-off button the Owner chose for the agreement's first point.

test.beforeEach(forgetRateLimits);

const WENT_WRONG = "Something went wrong on our side.";
const NO_INDEX = "Ruken starts your game from a file called index.html. We couldn't find one.";

// ---- E1: a waiting or sent-back game made 18+ ------------------------------------------------------------------------

for (const state of ["waiting", "sent_back"] as const) {
  test(`a ${state} game made 18+ is asked what is in it, and nothing breaks`, async ({ page }) => {
    const { slug } = await gameWhere(
      page,
      state === "waiting" ? { state } : { state, toFix: [{ part: "age_rating", reason: "wrong_age" }] },
    );
    await page.goto(`/make/${slug}/age`);
    await pageHasSettled(page);

    await page.getByRole("radio", { name: /^18\+/ }).check();
    await nextButton(page).click();

    // The rating is not kept on its own: the database holds an 18+ game that is past draft to having its marks.
    await expect(page).toHaveURL(new RegExp(`/make/${slug}/marks`));
    await expect(page.getByRole("heading", { level: 1 })).toContainText("any of these?");
    await expect(page.getByText(WENT_WRONG)).toHaveCount(0);

    await page.getByLabel("Gore").check();
    await nextButton(page).click();
    await expect(page).toHaveURL(`/make/${slug}`);
    await expect(page.getByText(WENT_WRONG)).toHaveCount(0);
    await expect(page.getByText("18+").first()).toBeVisible();
  });
}

// ---- E2: GitHub saying "empty" or "busy" --------------------------------------------------------------------------------

for (const [branch, words] of [
  ["empty-branch", "Your game on GitHub is empty. Upload your game's files, then try again."],
  ["busy-branch", "GitHub isn't answering right now. Try again in a minute."],
] as const) {
  test(`the files question says it in words when GitHub answers "${branch}", and keeps the choice`, async ({
    page,
  }) => {
    const { slug } = await startAtFiles(page);
    await connectGitHubFromFiles(page, slug);
    await page.getByLabel(TINY_GAME).check();
    await page.getByText("Change the branch or folder").click();
    await page.getByLabel("Branch", { exact: true }).selectOption(branch);
    await nextButton(page).click();

    await expect(page.getByText(words)).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/make/${slug}/files`));
    // An empty repository is a refused copy, which has its own screen; "Pick another" opens the list, and the choice is
    // still there. GitHub being busy is nobody's mistake, so the list stays on the screen.
    if (branch === "empty-branch") await page.getByRole("link", { name: "Pick another" }).click();
    await expect(page.getByLabel(TINY_GAME)).toBeChecked();
    await expect(page.getByText(WENT_WRONG)).toHaveCount(0);
  });
}

// ---- E3: a way on from the feed and from the error page ----------------------------------------------------------------------

test("a new maker gets from the feed to the maker area: You, then Add your games to Ruken", async ({
  page,
}) => {
  await signUp(page);
  await page.goto("/");
  await page.getByRole("navigation", { name: "Ruken" }).getByRole("link", { name: "You" }).click();

  await expect(page).toHaveURL("/me");
  await expect(page.getByRole("link", { name: "Add your games to Ruken" })).toHaveAttribute("href", "/make");
});

test("the error page inside the maker's area goes back to Your games", async ({ page }) => {
  await signUp(page);
  await page.goto("/make/no-such-game-at-all");

  await expect(page.getByRole("heading", { name: "We can't find that page." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to your games" })).toHaveAttribute("href", "/make");
});

// ---- E4: a live game whose last copy was refused ----------------------------------------------------------------------------

test("a live game whose last copy was refused offers a new version, which copies again, not Send it again", async ({
  page,
}) => {
  const { slug } = await gameWhere(page, {
    state: "live",
    fixed: [{ part: "one_line", reason: "not_this_game" }],
    pullProblem: NO_INDEX,
  });
  await page.goto(`/make/${slug}`);
  await pageHasSettled(page);

  await expect(page.getByRole("button", { name: "Send a new version" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Send it again" })).toHaveCount(0);
  await expect(
    page.getByText("Your last copy from GitHub didn't work. Fix it there, then send a new version."),
  ).toBeVisible();
});

// ---- E5: a way to the game's page from Live ----------------------------------------------------------------------------------------------

test("Live has See it on Ruken, which opens the game's page", async ({ page }) => {
  const { slug } = await gameWhere(page, { state: "live" });
  await page.goto(`/make/${slug}`);
  await pageHasSettled(page);

  await expect(page.getByRole("button", { name: "Send a new version" })).toBeVisible();
  await expect(page.getByRole("link", { name: "See it on Ruken" })).toHaveAttribute("href", `/g/${slug}`);
});

// ---- E6: GitHub taking a long time ------------------------------------------------------------------------------------------

test("Your games says what to do after GitHub did not connect", async ({ page }) => {
  await startDraft(page);
  await page.goto("/make?github=failed");

  await expect(page.getByText("GitHub didn't connect. Try again.")).toBeVisible();
  await expect(page.getByText("Open your game to try again.")).toBeVisible();
});

// ---- E7: Change something on a waiting game --------------------------------------------------------------------------------

test("a waiting game's Change something has nothing to send: it is saved already", async ({ page }) => {
  const { slug } = await gameWhere(page, { state: "waiting" }, { agreed: true });
  await page.goto(`/make/${slug}/check`);
  await pageHasSettled(page);

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Change something");
  await expect(page.getByText("Your changes are saved. Staff see them.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Send for review" })).toHaveCount(0);
  await expect(page.getByText("Finish later")).toHaveCount(0);

  await page
    .getByRole("link", { name: "Done" })
    .or(page.getByRole("button", { name: "Done" }))
    .click();
  await expect(page).toHaveURL(`/make/${slug}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Waiting for review");
});

// ---- E8: a refused copy of a waiting game -----------------------------------------------------------------------------------

test("a waiting game whose newest copy was refused says so and leads to its files", async ({ page }) => {
  const { slug } = await gameWhere(page, { state: "waiting", pullProblem: NO_INDEX });
  await page.goto(`/make/${slug}`);
  await pageHasSettled(page);

  await expect(page.getByText(NO_INDEX)).toBeVisible();
  await expect(page.locator(`a[href="/make/${slug}/files"]`).first()).toBeVisible();
});

// ---- E9: the upright video ------------------------------------------------------------------------------------------------

test("the upright video question does not say a game might be for computers only", async ({ page }) => {
  const { slug } = await startDraft(page);
  await fillAnswers(slug, { files: true });
  await page.goto(`/make/${slug}/upright`);
  await pageHasSettled(page);

  await expect(page.getByText("Phone players see this in the feed")).toHaveCount(0);
});

test("the record-your-screen page says how to record a part of the screen that is taller than wide", async ({
  page,
}) => {
  await page.goto("/help/record-screen");

  await expect(page.getByText("Record Selected Portion")).toBeVisible();
  await expect(page.getByText(/taller than wide/).first()).toBeVisible();
});

// ---- E10: a video that is too big ----------------------------------------------------------------------------------------------

test("the record-your-screen page has a part for a video that is too big", async ({ page }) => {
  await page.goto("/help/record-screen");

  await expect(page.getByRole("heading", { name: "Too big?" })).toBeVisible();
  await expect(page.locator("#too-big")).toHaveCount(1);
});

test("a video over 30 MB is refused with a way to make it smaller", async ({ page }, testInfo) => {
  const { slug } = await startDraft(page);
  await fillAnswers(slug, { files: true });
  await page.goto(`/make/${slug}/upright`);
  await pageHasSettled(page);

  await chooseVideo(page, await tooBigVideo(testInfo.outputPath("too-big.mp4")));

  const help = page.getByRole("alert").getByRole("link", { name: "How to make it smaller" });
  await expect(help).toHaveAttribute("href", /\/help\/record-screen.*#too-big$/);
});

test("a file that is not a video is told to be saved as MP4, WebM or MOV", async ({ page }) => {
  const { slug } = await startDraft(page);
  await fillAnswers(slug, { files: true });
  await page.goto(`/make/${slug}/upright`);
  await pageHasSettled(page);

  await chooseVideo(page, aviFile());

  await expect(page.getByRole("alert")).toContainText("Save it as MP4");
  await expect(page.getByRole("alert")).toContainText("MP4, WebM or MOV");
});

// ---- E11: Your games after what was sent back is fixed --------------------------------------------------------------------

test("Your games says Fixed, send it again for a live game's mended update", async ({ page }) => {
  await gameWhere(page, { state: "live", fixed: [{ part: "one_line", reason: "not_this_game" }] });
  await page.goto("/make");
  await pageHasSettled(page);

  await expect(page.getByText("Fixed. Send it again.")).toBeVisible();
});

test("Your games says Fixed, send it again for a game sent back with nothing left to fix", async ({
  page,
}) => {
  await gameWhere(page, { state: "sent_back", fixed: [{ part: "one_line", reason: "not_this_game" }] });
  await page.goto("/make");
  await pageHasSettled(page);

  await expect(page.getByText("Fixed. Send it again.")).toBeVisible();
  await expect(page.getByText("Sent back. See what to fix.")).toHaveCount(0);
});

// ---- E12: the websites question says it copies again --------------------------------------------------------------------------------

test("the websites question says that saving copies the game from GitHub again", async ({ page }) => {
  const { slug } = await gameWhere(page, { state: "waiting" });
  await page.goto(`/make/${slug}/websites`);
  await pageHasSettled(page);

  await expect(page.getByText("Saving copies your game from GitHub again.")).toBeVisible();
});

// ---- E13: a waiting game's files question says Next copies again --------------------------------------------------------------

test("a waiting game's files question says that Next copies the game from GitHub again", async ({ page }) => {
  const { slug } = await gameWhere(page, { state: "waiting" });
  await page.goto(`/make/${slug}/files`);
  await pageHasSettled(page);
  await connectGitHubFromFiles(page, slug);

  await expect(page.getByText("Next copies your game from GitHub again.")).toBeVisible();
});

test("a draft's files question does not say that: it has not been copied yet", async ({ page }) => {
  const { slug } = await startAtFiles(page);
  await connectGitHubFromFiles(page, slug);

  await expect(page.getByText("Next copies your game from GitHub again.")).toHaveCount(0);
});

// ---- E15: the agreement can be found again ---------------------------------------------------------------------------------------

test("Your games has a link to the maker agreement", async ({ page }) => {
  await startDraft(page);
  await page.goto("/make");
  await pageHasSettled(page);

  await expect(page.getByRole("link", { name: "Maker agreement", exact: true })).toHaveAttribute(
    "href",
    "/legal/maker-agreement",
  );
});

// ---- E16: Your account's door to the maker's area ---------------------------------------------------------------------------------

test("Your account leads a maker who has games to Your games", async ({ page }) => {
  await startDraft(page);
  await page.goto("/me");
  await pageHasSettled(page);

  await expect(page.getByRole("link", { name: "Your games", exact: true })).toHaveAttribute("href", "/make");
  await expect(page.getByRole("link", { name: "Add your games to Ruken" })).toHaveCount(0);
});

test("Your account invites a person with no games to add theirs", async ({ page }) => {
  await signUp(page);
  await page.goto("/me");
  await pageHasSettled(page);

  await expect(page.getByRole("link", { name: "Add your games to Ruken" })).toHaveAttribute("href", "/make");
});

// ---- Taking a live game off Ruken (the agreement's first point, the Owner's choice) -------------------------------------------

test("a live game can be taken off Ruken, after a question whose safe answer has the focus", async ({
  page,
}) => {
  const { slug } = await gameWhere(page, { state: "live" });
  await page.goto(`/make/${slug}`);
  await pageHasSettled(page);
  await page.getByRole("link", { name: "Take it off Ruken" }).click();

  await expect(page).toHaveURL(`/make/${slug}/take-off`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("off Ruken?");
  // Keep is the green, safe choice and has the focus; the one thing that cannot be undone is the only red.
  await expect(page.getByRole("link", { name: "Keep it on Ruken" })).toBeFocused();
  expect(await pipRed(page)).toEqual(["Take it off Ruken"]);

  await page.getByRole("button", { name: "Take it off Ruken" }).click();
  await expect(page).toHaveURL(`/make/${slug}`);
  await expect(page.getByRole("button", { name: "Send a new version" })).toHaveCount(0);
  // It is off: the question is not asked a second time.
  expect((await page.request.get(`/make/${slug}/take-off`)).status()).toBe(404);
});

test("Keep it on Ruken changes nothing", async ({ page }) => {
  const { slug } = await gameWhere(page, { state: "live" });
  await page.goto(`/make/${slug}/take-off`);
  await pageHasSettled(page);

  await page.getByRole("link", { name: "Keep it on Ruken" }).click();

  await expect(page).toHaveURL(`/make/${slug}`);
  await expect(page.getByRole("button", { name: "Send a new version" })).toBeVisible();
});

test("only a live game can be taken off", async ({ page }) => {
  const { slug } = await startDraft(page);

  expect((await page.request.get(`/make/${slug}/take-off`)).status()).toBe(404);
});
