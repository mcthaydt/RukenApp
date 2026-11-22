import { expect, test, type FileChooser, type Page } from "@playwright/test";
import { rgb, token } from "../support/look-tokens.ts";
import { pageHasSettled, signUp } from "./support/account.ts";
import { filesOf, fillAnswers, putGameWhereStaffLeaveIt } from "./support/database.ts";
import {
  addDraft,
  answerAge,
  answerEveryQuestion,
  answerLine,
  aviFile,
  BROKEN_GAME,
  chooseVideo,
  connectGitHubFromFiles,
  freshName,
  holdAnswersTo,
  MAKER_ADDRESSES,
  nextButton,
  pageNamedAsVideo,
  quickTimeFile,
  slugOfPage,
  startAtFiles,
  startAtVideo,
  startDraft,
  TINY_GAME,
  tooBigVideo,
  videoField,
  videoFile,
} from "./support/game.ts";
import { boxOf, showTheOwner } from "./support/look.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";
import { consented } from "./support/consent.ts";

// The maker's questions, one to a screen, and Your games (spec 3, 4, 10.1 and 15.2). A game is asked its name first on
// `/make/new`; every answer after that is saved the moment it is given. The size and look of each layout are in
// make-look.test.ts. GitHub and the videos have their own questions, in later journeys.

// Every journey makes an account, and the site lets one address make five an hour; the counters are cleared before each.
test.beforeEach(forgetRateLimits);

/** The box a question's answer is typed in, found by the question the heading asks. */
const boxFor = (page: Page, question: string) => page.getByLabel(question);

// ---- Your games ------------------------------------------------------------------------------------------------

test("Your games, with none, says what a maker needs and has one blue button", async ({ page }, testInfo) => {
  await signUp(page);
  await page.goto("/make");

  await expect(page.getByRole("heading", { name: "Your games" })).toBeVisible();
  await expect(page.getByText("You haven't added a game yet.")).toBeVisible();
  await expect(
    page.getByText("You'll need your game on GitHub, ready to run in a browser, and two short videos of it."),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Add a game" })).toHaveCSS(
    "background-color",
    rgb(token("--pay")),
  );
  await showTheOwner(page, testInfo, "Your games, none");

  await page.getByRole("link", { name: "Your account" }).click();
  await expect(page).toHaveURL("/me");
});

test("Your games shows each game as one link with where it stands, and Sent back in blue", async ({
  page,
}, testInfo) => {
  await signUp(page);
  const draft = await addDraft(page);
  const sentBack = await addDraft(page);
  // Something is still to fix: a game sent back with nothing left to fix says "Fixed. Send it again." instead.
  await putGameWhereStaffLeaveIt(sentBack.slug, {
    state: "sent_back",
    toFix: [{ part: "one_line", reason: "not_this_game" }],
  });

  await page.goto("/make");

  const row = (slug: string) => page.locator(`a[href="/make/${slug}"]`);
  await expect(row(draft.slug)).toContainText(draft.name);
  await expect(row(draft.slug)).toContainText("Not finished. Go on from question 2.");
  await expect(row(sentBack.slug)).toContainText("Sent back. See what to fix.");
  // "Sent back" in a list is blue words, not red and not a box (spec 15.1).
  await expect(row(sentBack.slug).getByText("Sent back. See what to fix.")).toHaveCSS(
    "color",
    rgb(token("--pay")),
  );
  await showTheOwner(page, testInfo, "Your games, with two games");

  await row(draft.slug).click();
  await expect(page).toHaveURL(`/make/${draft.slug}/line`);
});

test("signed out, the maker's area asks for sign-in", async ({ page }) => {
  await page.goto("/make");

  await expect(page).toHaveURL("/sign-in?next=%2Fmake");
});

// ---- The questions ---------------------------------------------------------------------------------------------

test("a maker answers the name and is asked the next question, with her name in it", async ({
  page,
}, testInfo) => {
  await signUp(page);
  await page.goto("/make/new");
  await pageHasSettled(page);
  await expect(page.getByText("Question 1 of 6")).toBeVisible();
  await showTheOwner(page, testInfo, "question 1, the name");

  const name = freshName("Floor Fifty");
  await boxFor(page, "What's your game called?").fill(name);
  await nextButton(page).click();

  await expect(page).toHaveURL(/\/make\/floor-fifty-[a-z0-9]+\/line$/);
  await expect(page.getByRole("heading", { name: `What's ${name} about, in one line?` })).toBeVisible();
  await expect(page.getByText("Question 2 of 6")).toBeVisible();
  await showTheOwner(page, testInfo, "question 2, the line");
});

test("every Next saves: after Finish later the game is in Your games, and goes on where she left", async ({
  page,
}) => {
  const { name } = await startDraft(page);

  await page.getByRole("link", { name: "Finish later" }).click();

  await expect(page).toHaveURL("/make");
  const row = page.getByRole("link", { name: new RegExp(name) });
  await expect(row).toContainText("Not finished. Go on from question 2.");
  await row.click();
  await expect(page).toHaveURL(/\/line$/);
});

test("a name with fewer than three letters is refused under the box, and what she typed stays", async ({
  page,
}, testInfo) => {
  await signUp(page);
  await page.goto("/make/new");
  await pageHasSettled(page);
  const box = boxFor(page, "What's your game called?");

  await box.fill("ab");
  await nextButton(page).click();

  await expect(page.getByText("Pick a name with at least three letters or numbers.")).toBeVisible();
  await expect(box).toHaveAttribute("aria-invalid", "true");
  await expect(box).toBeFocused();
  await expect(box).toHaveValue("ab");
  await expect(page).toHaveURL("/make/new");
  await showTheOwner(page, testInfo, "question 1, refused");
});

test("an empty line is refused in today's words", async ({ page }) => {
  await startDraft(page);
  const box = page.getByRole("textbox");

  await nextButton(page).click();

  await expect(page.getByText("A game needs one line about it.")).toBeVisible();
  await expect(box).toHaveAttribute("aria-invalid", "true");
  await expect(box).toBeFocused();
});

test("a line is kept, and the next question waits where she left it", async ({ page }) => {
  await startDraft(page);

  await answerLine(page, "Climb. Fall. Climb again.");

  await expect(page).toHaveURL(/\/files$/);
  await page.goto("/make");
  await expect(page.locator("a.game")).toContainText("Not finished. Go on from question 3.");
});

test("the age question offers five choices with nothing picked", async ({ page }, testInfo) => {
  const { slug } = await startDraft(page);
  await fillAnswers(slug, { files: true, videos: true });
  await page.goto(`/make/${slug}/age`);
  await pageHasSettled(page);

  await expect(page.getByText("Question 6 of 6")).toBeVisible();
  await expect(page.getByRole("radio")).toHaveCount(5);
  await expect(page.getByRole("radio", { checked: true })).toHaveCount(0);
  for (const words of [
    "Fine for anyone.",
    "Cartoon fighting, or a little scary.",
    "Real-looking fighting, or scary bits.",
    "More violence or strong words.",
    "Only for adults.",
  ])
    await expect(page.getByText(words)).toBeVisible();
  await expect(page.getByText("We check this when we look at your game.")).toBeVisible();
  await showTheOwner(page, testInfo, "question 6, who it is for");

  await nextButton(page).click();

  await expect(page.getByText("Choose who your game is for.")).toBeVisible();
});

test("a choice tapped before the question has come alive is kept when it does, and is saved", async ({
  page,
}) => {
  // The same moment as run 44977261003 on a box of words: a choice made before the screen came alive was taken away
  // as it did. Holding the scripts back makes that moment as long as it needs to be.
  const { slug } = await startDraft(page);
  await fillAnswers(slug, { files: true, videos: true });
  let release: () => void = () => undefined;
  const scriptsMayRun = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(/\.m?js(\?.*)?$/, async (route) => {
    await scriptsMayRun;
    await route.continue();
  });
  await page.goto(`/make/${slug}/age`, { waitUntil: "commit" });
  await page.getByRole("radio", { name: /^7\+/ }).check();
  release();
  await pageHasSettled(page);
  await expect(page.getByRole("radio", { name: /^7\+/ })).toBeChecked();
  await nextButton(page).click();
  await expect(page).not.toHaveURL(`/make/${slug}/age`);
  await page.unrouteAll({ behavior: "wait" });
  await page.goto(`/make/${slug}/age`);
  await pageHasSettled(page);
  await expect(page.getByRole("radio", { name: /^7\+/ })).toBeChecked();
});

test("an 18+ game is asked one more question, and a 12+ game is not", async ({ page }, testInfo) => {
  const { slug } = await startDraft(page);
  await fillAnswers(slug, { files: true, videos: true });
  await page.goto(`/make/${slug}/age`);
  await pageHasSettled(page);

  await answerAge(page, "18+");

  await expect(page).toHaveURL(`/make/${slug}/marks`);
  await expect(page.getByText("Question 7 of 7")).toBeVisible();
  await expect(
    page.getByText(
      "Only adults will see this game. Sex or nudity is fine here. No game may have pornography or gambling.",
    ),
  ).toBeVisible();
  // "None of these" stands alone: choosing it unticks the others, and choosing another unticks it.
  await page.getByLabel("Gore").check();
  await page.getByLabel("Drugs").check();
  await page.getByLabel("None of these").check();
  await expect(page.getByLabel("Gore")).not.toBeChecked();
  await expect(page.getByLabel("Drugs")).not.toBeChecked();
  await page.getByLabel("Gore").check();
  await expect(page.getByLabel("None of these")).not.toBeChecked();
  await showTheOwner(page, testInfo, "question 7, what an 18+ game has");

  // Back, and a younger rating: the marks are cleared and the question is not asked.
  await page.getByRole("link", { name: "Back" }).click();
  await expect(page).toHaveURL(`/make/${slug}/age`);
  await answerAge(page, "12+");
  // Six questions are done, so the maker's first game is led on to the agreement (a maker who agreed goes to Check and send).
  await expect(page).toHaveURL(new RegExp(`/make/${slug}/(agreement|check)$`));
  expect((await page.goto(`/make/${slug}/marks`))?.status()).toBe(404);
});

test("a later question opened too early leads back to the first one not answered", async ({ page }) => {
  const { slug } = await startDraft(page);

  await page.goto(`/make/${slug}/age`);

  await pageHasSettled(page);

  await expect(page).toHaveURL(`/make/${slug}/line`);
});

test("Back goes to the question before, with its answer in place", async ({ page }) => {
  const { name } = await startDraft(page);

  await page.getByRole("link", { name: "Back" }).click();

  await expect(page).toHaveURL(/\/name$/);
  await expect(boxFor(page, "What's your game called?")).toHaveValue(name);
});

test("the first Back leads to Your games", async ({ page }) => {
  await signUp(page);
  await page.goto("/make/new");
  await pageHasSettled(page);

  await page.getByRole("link", { name: "Back" }).click();

  await expect(page).toHaveURL("/make");
});

test("changing an answer says Save and goes back to the game, with no counter", async ({ page }) => {
  const { slug } = await startDraft(page);
  await fillAnswers(slug, { files: true, videos: true, age: "age_12" });
  await putGameWhereStaffLeaveIt(slug, { state: "waiting" });

  await page.goto(`/make/${slug}/line`);

  await pageHasSettled(page);

  await expect(page.getByText(/^Question \d of \d$/)).toHaveCount(0);
  await page.getByRole("textbox").fill("A new line about it.");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).toHaveURL(`/make/${slug}`);
  await expect(page.getByRole("heading", { name: "Waiting for review" })).toBeVisible();
});

test("a second press of Next while the first is out makes one game", async ({ page }) => {
  await signUp(page);
  await page.goto("/make/new");
  await pageHasSettled(page);
  const held = await holdAnswersTo(page, /\/make\/new\?\/answer$/);
  const box = boxFor(page, "What's your game called?");
  await box.fill(freshName());

  await nextButton(page).click();

  const busy = page.getByRole("button", { name: "Saving…" });
  await expect(busy).toBeDisabled();
  await expect(busy).toHaveAttribute("aria-busy", "true");
  // Another press, from the keyboard, is not taken either.
  await box.press("Enter");
  expect(held.requestsSoFar()).toBe(1);

  held.release();
  await expect(page).toHaveURL(/\/line$/);
  expect(held.requestsSoFar()).toBe(1);
});

test("the questions work with script off", async ({ page, browser, baseURL }) => {
  await signUp(page);
  const context = await browser.newContext({
    ...consented,
    baseURL: baseURL ?? "http://localhost:4173",
    javaScriptEnabled: false,
    // Nothing here is about motion, and an entrance still moving is not a thing a person presses.
    reducedMotion: "reduce",
    // A computer's window whatever the project is, as this journey is about script and not about the window.
    viewport: { width: 1280, height: 720 },
    storageState: await page.context().storageState(),
  });
  try {
    const plain = await context.newPage();
    await plain.goto("/make/new");
    const name = freshName();
    await plain.getByLabel("What's your game called?").fill(name);
    await plain.getByRole("button", { name: "Next" }).click();
    await expect(plain).toHaveURL(/\/line$/);
    const slug = slugOfPage(plain);
    await plain.getByRole("textbox").fill("A tiny game about tapping.");
    await plain.getByRole("button", { name: "Next" }).click();
    await expect(plain).toHaveURL(`/make/${slug}/files`);

    await fillAnswers(slug, { files: true, videos: true });
    await plain.goto(`/make/${slug}/age`);
    await plain.getByRole("radio", { name: /^12\+/ }).check();
    await plain.getByRole("button", { name: "Next" }).click();
    await expect(plain).toHaveURL(new RegExp(`/make/${slug}/(agreement|check)$`));
  } finally {
    await context.close();
  }
});

// ---- Where the game's files are ----------------------------------------------------------------------------------

test("she picks a repository from Ruken's own rows, and Next copies the game", async ({ page }) => {
  const { slug } = await startAtFiles(page);
  await connectGitHubFromFiles(page, slug);

  // Ruken's rows, never the browser's own list. The branch list is a select, so it is left out of this check.
  await expect(page.locator('select:not([name="branch"])')).toHaveCount(0);
  await expect(page.getByText("Pick the one that is your game.")).toBeVisible();
  await expect(page.getByRole("radio", { checked: true })).toHaveCount(0);
  await page.getByLabel(TINY_GAME).check();
  await nextButton(page).click();

  await expect(page).toHaveURL(`/make/${slug}/upright`);
  expect(await filesOf(slug)).toEqual({ repo: TINY_GAME, pulls: 1 });
});

test("Next with no repository chosen says so", async ({ page }) => {
  const { slug } = await startAtFiles(page);
  await connectGitHubFromFiles(page, slug);

  await nextButton(page).click();

  await expect(page.getByText("Pick your game from the list.")).toBeVisible();
  await expect(page).toHaveURL(`/make/${slug}/files`);
  expect(await filesOf(slug)).toEqual({ repo: null, pulls: 0 });
});

test("while the game is copied the button says so and cannot be pressed again", async ({
  page,
}, testInfo) => {
  const { slug } = await startAtFiles(page);
  await connectGitHubFromFiles(page, slug);
  const held = await holdAnswersTo(page, new RegExp(`/make/${slug}/files\\?/answer$`));
  await page.getByLabel(TINY_GAME).check();

  await nextButton(page).click();

  const busy = page.getByRole("button", { name: "Copying your game…" });
  await expect(busy).toBeDisabled();
  await expect(busy).toHaveAttribute("aria-busy", "true");
  await expect(page.getByText("Copying your game can take a minute. Keep this page open.")).toBeVisible();
  expect(held.requestsSoFar()).toBe(1);
  await showTheOwner(page, testInfo, "question 3, copying your game");

  held.release();
  await expect(page).toHaveURL(`/make/${slug}/upright`);
  expect(held.requestsSoFar()).toBe(1);
});

test("a repository with no index.html says so in plain words on the question that asked", async ({
  page,
}, testInfo) => {
  const { slug } = await startAtFiles(page);
  await connectGitHubFromFiles(page, slug);
  await page.getByLabel(BROKEN_GAME).check();

  await nextButton(page).click();

  await expect(page).toHaveURL(`/make/${slug}/files`);
  await expect(page.getByText("Needs fixing")).toBeVisible();
  await expect(page.getByText("We couldn't start your game")).toBeVisible();
  await expect(
    page.getByText(
      "Ruken starts your game from a file called index.html. We couldn't find one in ruken-test/broken-game.",
    ),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Here's how to set up your game's folder" })).toHaveAttribute(
    "href",
    `/help/github?from=${encodeURIComponent(`/make/${slug}/files`)}#folder`,
  );
  await showTheOwner(page, testInfo, "question 3, no index.html");

  // The one blue button opens the boxes that fix it, with the folder ready to be typed in; her choice is still picked.
  await page.getByRole("link", { name: "Pick another" }).click();
  await expect(page.getByLabel("Folder")).toBeFocused();
  await expect(page.getByLabel(BROKEN_GAME)).toBeChecked();
  await expect(page.getByLabel("Branch")).toBeVisible();
  // The refusal came back with the game, so it is there on a fresh visit too.
  await page.goto(`/make/${slug}/files`);
  await expect(page.getByText("We couldn't start your game")).toBeVisible();
});

test("a folder that cannot be right is refused beside its box", async ({ page }) => {
  const { slug } = await startAtFiles(page);
  await connectGitHubFromFiles(page, slug);
  await page.getByLabel(TINY_GAME).check();
  await page.getByText("Change the branch or folder").click();
  await expect(
    page.getByText("Pick the branch your game is on. Main branch is the usual one."),
  ).toBeVisible();
  await expect(page.getByText("Leave empty if index.html isn't inside a folder.")).toBeVisible();
  const folder = page.getByLabel("Folder");
  await folder.fill("/web");

  await nextButton(page).click();

  await expect(
    page.getByText(
      "That doesn't look like a folder. Write it like web/build, with no slash at the start or end.",
    ),
  ).toBeVisible();
  await expect(folder).toHaveAttribute("aria-invalid", "true");
  await expect(folder).toBeFocused();
  await expect(folder).toHaveValue("/web");
  await expect(page.getByLabel(TINY_GAME)).toBeChecked();
  expect(await filesOf(slug)).toEqual({ repo: null, pulls: 0 });
});

test("a repository GitHub never listed for her is refused", async ({ page }) => {
  const { slug } = await startAtFiles(page);
  await connectGitHubFromFiles(page, slug);
  // A form changed by hand: the row says one thing and the post says another.
  await page.getByLabel(TINY_GAME).evaluate((row) => {
    if (row instanceof HTMLInputElement) row.value = "ruken-test/not-yours";
  });
  await page.getByLabel(TINY_GAME).check();

  await nextButton(page).click();

  await expect(
    page.getByText("Ruken can't see that game on GitHub. Choose it on GitHub, then try again."),
  ).toBeVisible();
  await expect(page).toHaveURL(`/make/${slug}/files`);
  expect(await filesOf(slug)).toEqual({ repo: null, pulls: 0 });
});

// ---- Whose game it is ------------------------------------------------------------------------------------------

test("another maker cannot open or answer this game's questions", async ({ page, browser, baseURL }) => {
  const { slug } = await startDraft(page);
  const site = baseURL ?? "http://localhost:4173";
  const stranger = await browser.newContext({ ...consented, baseURL: site });
  try {
    const other = await stranger.newPage();
    await signUp(other);

    // A 404 that says nothing, for every address and every answer.
    for (const { path, form } of MAKER_ADDRESSES(slug)) {
      expect((await other.goto(path))?.status(), `GET ${path}`).toBe(404);
      if (form !== undefined) {
        // The site refuses a form posted from another address, so the post says where it comes from, as a form does.
        const posted = await stranger.request.post(path, { form, headers: { origin: site } });
        expect(posted.status(), `POST ${path}`).toBe(404);
      }
    }
  } finally {
    await stranger.close();
  }
});

// ---- A game waiting ---------------------------------------------------------------------------------------------

test("a waiting game says so, and its one blue button goes back to Your games", async ({
  page,
}, testInfo) => {
  const { slug, name } = await startDraft(page);
  await putGameWhereStaffLeaveIt(slug, { state: "waiting" });

  await page.goto(`/make/${slug}`);

  await expect(page.getByRole("heading", { name: "Waiting for review" })).toBeVisible();
  // The name is said once, as the title of the game laid out (the Owner, 2026-11-15, "2.b"): not above the heading too.
  await expect(page.locator("p.count")).toHaveCount(0);
  await expect(page.locator(".laid .title")).toHaveText(name);
  await expect(page.getByText("We're looking at it. Come back here to see when it's live.")).toBeVisible();
  const back = page.getByRole("link", { name: "Back to your games" });
  await expect(back).toHaveCSS("background-color", rgb(token("--pay")));
  await showTheOwner(page, testInfo, "a game waiting for review");

  await back.click();
  await expect(page).toHaveURL("/make");
});

// ---- The two videos --------------------------------------------------------------------------------------------

/** The words of the one blue button that opens the picker; it is the real file field's label. */
const pickerButton = (page: Page) => page.locator("label.file > span");

test("the upright question shows its frame before anything is chosen, in the right shape", async ({
  page,
}, testInfo) => {
  await startAtVideo(page, "upright");

  await expect(page.getByText("Question 4 of 6")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Add your upright video");
  const frame = page.locator('[data-frame="upright"]');
  await expect(frame).toContainText("Taller than wide");
  const shape = await boxOf(frame);
  expect(shape.height).toBeGreaterThan(shape.width);
  await expect(frame).toHaveCSS("background-color", rgb(token("--felt-raised")));
  await expect(
    page.getByText(
      "Record your screen while you play for 10 to 30 seconds. Players see it in the feed before they play.",
    ),
  ).toBeVisible();
  await expect(page.getByText("For phones: taller than wide. MP4, WebM or MOV, up to 30 MB.")).toBeVisible();
  await expect(pickerButton(page)).toHaveText("Choose video");
  await expect(pickerButton(page)).toHaveCSS("background-color", rgb(token("--pay")));
  // The blue button opens a picker, not a form post, so Enter does not press it.
  await expect(page.getByText("press Enter")).toHaveCount(0);
  await showTheOwner(page, testInfo, "Question 5, the upright video");
});

test("a video is added the moment it is chosen, then Next is the blue button", async ({ page }, testInfo) => {
  const { slug } = await startAtVideo(page, "upright");
  const held = await holdAnswersTo(page, /\?\/clip/);

  await chooseVideo(page, videoFile("my-game-upright.mp4"));
  await expect(pickerButton(page)).toHaveText("Adding your video…");
  await expect(videoField(page)).toBeDisabled();
  await showTheOwner(page, testInfo, "Question 5, a video being added");
  held.release();

  const video = page.locator('[data-frame="upright"] video');
  await expect(video).toHaveAttribute("src", /\/clips\//);
  expect(held.requestsSoFar()).toBe(1);
  await expect(nextButton(page)).toHaveText("Next");
  await expect(nextButton(page)).toHaveCSS("background-color", rgb(token("--pay")));
  await expect(page.getByRole("link", { name: "Choose a different video" })).toBeVisible();
  await showTheOwner(page, testInfo, "Question 5, the video is in");

  await nextButton(page).click();
  await expect(page).toHaveURL(`/make/${slug}/wide`);
});

test("the wide question follows, and after it the age question", async ({ page }, testInfo) => {
  const { slug } = await startAtVideo(page, "upright");
  await chooseVideo(page, videoFile());
  await expect(page.locator('[data-frame="upright"] video')).toBeAttached();
  await nextButton(page).click();

  await expect(page).toHaveURL(`/make/${slug}/wide`);
  await expect(page.getByText("Question 5 of 6")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Add your wide video");
  const frame = page.locator('[data-frame="wide"]');
  await expect(frame).toContainText("Wider than tall");
  const shape = await boxOf(frame);
  expect(shape.width).toBeGreaterThan(shape.height);
  await expect(
    page.getByText("For computers: wider than tall. MP4, WebM or MOV, up to 30 MB."),
  ).toBeVisible();
  await showTheOwner(page, testInfo, "Question 6, the wide video");

  await chooseVideo(page, videoFile());
  await expect(page.locator('[data-frame="wide"] video')).toBeAttached();
  await nextButton(page).click();
  await expect(page).toHaveURL(`/make/${slug}/age`);
});

// A draft's video can be swapped as often as the maker likes: the new one takes the old one's place and stays.
for (const shape of ["upright", "wide"] as const) {
  test(`a draft's ${shape} video is swapped through Choose a different video, and the new one stays after a reload`, async ({
    page,
  }) => {
    const { slug } = await startAtVideo(page, shape);
    const video = page.locator(`[data-frame="${shape}"] video`);
    await chooseVideo(page, videoFile(`first-${shape}.mp4`));
    await expect(video).toHaveAttribute("src", /\/clips\//);
    const first = await video.getAttribute("src");

    await page.getByRole("link", { name: "Choose a different video" }).click();
    await expect(page).toHaveURL(`/make/${slug}/${shape}?again=1`);
    await pageHasSettled(page);
    await chooseVideo(page, videoFile(`second-${shape}.mp4`));
    await expect(video).toHaveAttribute("src", /\/clips\//);
    await expect(video).not.toHaveAttribute("src", first ?? "");
    const second = await video.getAttribute("src");

    await page.goto(`/make/${slug}/${shape}`);
    await pageHasSettled(page);
    await expect(video).toHaveAttribute("src", second ?? "");
  });
}

// ---- Recording the screen -----------------------------------------------------------------------------------------

// One journey for each question: each makes its own maker and game, so a second sign-up is never made in a signed-in browser.
for (const shape of ["upright", "wide"] as const) {
  test(`the ${shape} video question has a link to how to record a screen, which leads back to the question`, async ({
    page,
  }) => {
    const { slug } = await startAtVideo(page, shape);
    const how = page.getByRole("link", { name: "How do I record my screen?" });
    await expect(how).toHaveAttribute(
      "href",
      `/help/record-screen?from=${encodeURIComponent(`/make/${slug}/${shape}`)}`,
    );

    await how.click();

    await expect(page.getByRole("heading", { level: 1, name: "Record your screen" })).toBeVisible();
    await page.getByRole("link", { name: "Back to your game" }).first().click();
    await expect(page).toHaveURL(`/make/${slug}/${shape}`);
  });
}

test("the record-your-screen page has steps for a phone and for a computer, and needs no account", async ({
  page,
}) => {
  await page.goto("/help/record-screen");

  await expect(page.getByRole("heading", { level: 1, name: "Record your screen" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "On a phone or tablet" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "On a computer" })).toBeVisible();
  for (const kind of ["iPhone or iPad", "Android phone", "Windows computer", "Mac"]) {
    await expect(page.getByRole("heading", { level: 3, name: kind })).toBeVisible();
  }
  // A Mac saves a .mov file, which Ruken takes (Owner, 2026-11-15: "Yes, take .mov"), so a Mac maker records and sends it.
  await expect(page.getByText("Press Shift, Command and 5 together.")).toBeVisible();
  await expect(page.getByText("Your video is on your Desktop. Ruken takes this kind of file.")).toBeVisible();
  // The steps use the words the phone and Ruken show: an iPhone in the US says Control Center, and the button is pressed.
  await expect(page.getByText("Open Settings, then Control Center. Add Screen Recording.")).toBeVisible();
  await expect(page.getByText("Then come back to Ruken and press Choose video.")).toBeVisible();
  // The way back is at the top and again at the foot.
  const back = page.getByRole("link", { name: "Back to Ruken" });
  await expect(back).toHaveCount(2);
  for (const link of await back.all()) await expect(link).toHaveAttribute("href", "/");
});

test("the record-your-screen page will not send anyone to another site", async ({ page }) => {
  for (const from of ["https://example.com", "//example.com", "/\\example.com"]) {
    await page.goto(`/help/record-screen?from=${encodeURIComponent(from)}`);
    for (const link of await page.getByRole("link", { name: "Back to Ruken" }).all()) {
      await expect(link).toHaveAttribute("href", "/");
    }
  }
});

test("a video of the wrong kind or size is refused in plain words before anything is sent", async ({
  page,
}, testInfo) => {
  await startAtVideo(page, "upright");
  let sent = 0;
  await page.route(/\?\/clip/, async (route) => {
    sent += 1;
    await route.continue();
  });

  await chooseVideo(page, aviFile());
  await expect(
    page.getByText(
      "That's a .avi file. Ruken takes MP4, WebM or MOV videos. Save it as MP4 and choose it again.",
    ),
  ).toBeVisible();
  // The maker can see which file was refused.
  await expect(page.getByText("holiday.avi · 1 KB")).toBeVisible();

  await chooseVideo(page, await tooBigVideo(testInfo.outputPath("too-big.mp4")));
  await expect(
    page.getByText(
      "That video is 31 MB. Videos can be up to 30 MB. Make it shorter or smaller, then choose it again.",
    ),
  ).toBeVisible();
  await expect(page.getByText("too-big.mp4 · 31 MB")).toBeVisible();
  expect(sent).toBe(0);

  // A good video chosen next is added, and the refusal goes.
  await chooseVideo(page, videoFile());
  await expect(page.locator('[data-frame="upright"] video')).toBeAttached();
  await expect(page.getByText(/Ruken takes MP4, WebM or MOV|Videos can be up to/)).toHaveCount(0);
});

// A Mac's screen recording is a .mov (Owner, 2026-11-15: "Yes, take .mov"), so it is added like any other video.
test("a QuickTime video, as a Mac saves a screen recording, is added", async ({ page }) => {
  await startAtVideo(page, "upright");

  await chooseVideo(page, quickTimeFile());

  await expect(page.locator('[data-frame="upright"] video')).toBeAttached();
  await expect(nextButton(page)).toBeVisible();
  await expect(page.getByText(/Ruken takes MP4, WebM or MOV/)).toHaveCount(0);
});

test("a web page named as a video is refused by the server, under the hint", async ({ page }, testInfo) => {
  await startAtVideo(page, "upright");

  await chooseVideo(page, pageNamedAsVideo());

  await expect(
    page.getByText("That file doesn't look like a video. Save it as MP4, WebM or MOV and try again."),
  ).toBeVisible();
  await expect(page.locator('[data-frame="upright"] video')).toHaveCount(0);
  await expect(pickerButton(page)).toHaveText("Choose video");
  await showTheOwner(page, testInfo, "Question 5, a video the server refused");
});

test("choosing the video opens it full size, and Close and Escape close it", async ({ page }) => {
  await startAtVideo(page, "upright");
  await chooseVideo(page, videoFile());
  const frame = page.locator('[data-frame="upright"]');
  // The tile's own video, inside its link: the full-size one in the dialog is another video in the same frame.
  const tile = frame.locator("a > video");
  await expect(tile).toBeAttached();

  await tile.click();
  const full = page.locator("dialog[open]");
  await expect(full).toBeVisible();
  await expect(full.locator("video")).toHaveAttribute("controls", "");
  const close = full.getByRole("button", { name: "Close" });
  await expect(close).toHaveCSS("background-color", rgb(token("--felt-raised")));
  await close.click();
  await expect(page.locator("dialog[open]")).toHaveCount(0);

  await tile.click();
  await expect(page.locator("dialog[open]")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("dialog[open]")).toHaveCount(0);
});

test("with reduced motion a video does not start by itself", async ({ page }) => {
  await startAtVideo(page, "upright");
  await chooseVideo(page, videoFile());
  // The video is added the moment it is chosen; a reload before it is in would lose it.
  await expect(page.locator('[data-frame="upright"] video')).toBeAttached();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await pageHasSettled(page);

  const video = page.locator('[data-frame="upright"] video');
  await expect(video).toBeAttached();
  expect(await video.evaluate((element: HTMLVideoElement) => element.paused)).toBe(true);
});

test("the picker is reached and opened from the keyboard", async ({ page }) => {
  await startAtVideo(page, "upright");
  const field = videoField(page);
  // Playwright catches the browser's file picker only once something listens for it, and it tells the browser so without
  // waiting for the answer. A listener added in the same breath as the Space press lost that race on a busy machine: the
  // picker opened before it was caught and no event came (CI on 2026-11-15 and on #138; 12 times in 30 here with the
  // processor slowed eightfold, never once with the listener added first). Listening before the walk with Tab means the
  // browser has heard by the Space press: every Tab and focus check below is a round trip through the same page.
  const chooserOpened = new Promise<FileChooser>((resolve) => page.once("filechooser", resolve));

  for (let presses = 0; presses < 40; presses += 1) {
    await page.keyboard.press("Tab");
    if (await field.evaluate((element) => element === document.activeElement)) break;
  }
  await expect(field).toBeFocused();
  expect(await pickerButton(page).evaluate((span) => getComputedStyle(span).outlineWidth)).toBe("3px");

  await page.keyboard.press("Space");
  const chooser = await chooserOpened;
  await chooser.setFiles(videoFile());
  await expect(page.locator('[data-frame="upright"] video')).toBeAttached();
});

test("a game's card in Your games shows a still from its wide video", async ({ page }) => {
  const { slug } = await startAtVideo(page, "upright");
  await fillAnswers(slug, { files: true, videos: true, age: "age_12" });
  await page.goto("/make");
  await pageHasSettled(page);

  const still = page.locator("video").first();
  await expect(still).toHaveAttribute("preload", "metadata");
  // A still never plays, and nothing is added to the video to make it start.
  await expect(still).not.toHaveAttribute("autoplay", /.*/);
  const small = await boxOf(still);
  expect([64, 96, 128]).toContain(Math.round(small.width));
  expect(Math.round(small.height)).toBe(Math.round((small.width * 9) / 16));
});

// ---- The other websites: one line each ------------------------------------------------------------------------------

test("each website is its own line: add, remove, five at most, two kept, and a bad one is refused", async ({
  page,
}) => {
  // Saving copies the game from GitHub again, so this game's files come from the stand-in GitHub, not the database.
  const { slug } = await answerEveryQuestion(page);
  await page.goto(`/make/${slug}/websites`);
  await pageHasSettled(page);
  const boxes = page.getByRole("textbox");
  const add = page.getByRole("button", { name: "Add another website" });

  // A new game starts with one empty line to type in.
  await expect(boxes).toHaveCount(1);
  await boxes.first().fill("api.example.com");
  // On a phone 375 wide a whole address shows in its box, with the keyboard in it and without, and Remove is still 44 tall.
  if (test.info().project.name === "phone") {
    await page.setViewportSize({ width: 375, height: 812 });
    const fits = () => boxes.first().evaluate((box: HTMLInputElement) => box.scrollWidth <= box.clientWidth);
    for (const address of ["api.example.com", "cdn.example.com"]) {
      await boxes.first().fill(address);
      await boxes.first().focus();
      expect(await fits(), `${address} fits its box while it has focus`).toBe(true);
      await page.getByRole("button", { name: "Add another website" }).focus();
      expect(await fits(), `${address} fits its box without focus`).toBe(true);
    }
    await boxes.first().fill("api.example.com");
    expect((await boxOf(page.getByRole("button", { name: "Remove line 1" }))).height).toBeGreaterThanOrEqual(
      44,
    );
  }
  await add.click();
  // The keyboard is in the new line, so typing goes on without a click.
  await expect(boxes.nth(1)).toBeFocused();
  await page.keyboard.type("cdn.example.com");
  await expect(boxes).toHaveCount(2);

  // Five is the most: the fifth line takes the Add button away.
  for (let line = 3; line <= 5; line++) await add.click();
  await expect(boxes).toHaveCount(5);
  await expect(add).toHaveCount(0);
  await page.getByRole("button", { name: "Remove line 5" }).click();
  await page.getByRole("button", { name: "Remove line 4" }).click();
  await page.getByRole("button", { name: "Remove line 3" }).click();
  await expect(add).toBeVisible();

  // A bad line is refused in the same words, and every line stays as typed.
  await boxes.nth(1).fill("not a website");
  await nextButton(page).click();
  await expect(page.getByText("Write each website like api.example.com. Five at most.")).toBeVisible();
  await expect(boxes.first()).toHaveValue("api.example.com");
  await expect(boxes.nth(1)).toHaveValue("not a website");

  // Removing the bad line leaves the good one, which is saved; coming back shows it with an empty line after it.
  await page.getByRole("button", { name: "Remove line 2" }).click();
  await expect(boxes.first()).toBeFocused();
  await nextButton(page).click();
  await expect(page).not.toHaveURL(/\/websites/);
  await page.goto(`/make/${slug}/websites`);
  await expect(boxes).toHaveCount(2);
  await expect(boxes.first()).toHaveValue("api.example.com");
  await expect(boxes.nth(1)).toHaveValue("");
});
