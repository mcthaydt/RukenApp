import { expect, test, type Page } from "@playwright/test";
import { rgb, token } from "../support/look-tokens.ts";
import { pageHasSettled, signUp } from "./support/account.ts";
import { fillAnswers, putGameWhereStaffLeaveIt } from "./support/database.ts";
import {
  addDraft,
  answerAge,
  answerLine,
  answerPlaysOn,
  freshName,
  holdAnswersTo,
  MAKER_ADDRESSES,
  nextButton,
  slugOfPage,
  startDraft,
} from "./support/game.ts";
import { showTheOwner } from "./support/look.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

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
  await putGameWhereStaffLeaveIt(sentBack.slug, { state: "sent_back" });

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
  await expect(page.getByText("Question 1 of 7")).toBeVisible();
  await showTheOwner(page, testInfo, "question 1, the name");

  const name = freshName("Floor Fifty");
  await boxFor(page, "What's your game called?").fill(name);
  await nextButton(page).click();

  await expect(page).toHaveURL(/\/make\/floor-fifty-[a-z0-9]+\/line$/);
  await expect(page.getByRole("heading", { name: `What's ${name} about, in one line?` })).toBeVisible();
  await expect(page.getByText("Question 2 of 7")).toBeVisible();
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

test("where it plays has nothing picked, and Next without a choice says so", async ({ page }, testInfo) => {
  const { slug } = await startDraft(page);
  await fillAnswers(slug, { playsOn: false, files: true });
  await page.goto(`/make/${slug}/plays-on`);
  await pageHasSettled(page);

  await expect(page.getByRole("radio")).toHaveCount(2);
  await expect(page.getByRole("radio", { checked: true })).toHaveCount(0);
  await expect(page.getByText("Phones and computers")).toBeVisible();
  await expect(page.getByText("Computers only")).toBeVisible();
  await expect(page.getByText("Choose this if your game needs a keyboard or a mouse.")).toBeVisible();
  await showTheOwner(page, testInfo, "question 4, where it plays");

  await nextButton(page).click();

  await expect(page.getByText("Choose where your game plays.")).toBeVisible();
  await expect(page.getByRole("radio", { checked: true })).toHaveCount(0);
});

test("a line is kept, and the next question waits where she left it", async ({ page }) => {
  await startDraft(page);

  await answerLine(page, "Climb. Fall. Climb again.");

  await expect(page).toHaveURL(/\/files$/);
  await page.goto("/make");
  await expect(page.locator("a.game")).toContainText("Not finished. Go on from question 3.");
});

test("a choice of where it plays is kept, and comes back chosen", async ({ page }) => {
  const { slug } = await startDraft(page);
  await fillAnswers(slug, { playsOn: false, files: true });
  await page.goto(`/make/${slug}/plays-on`);
  await pageHasSettled(page);

  await answerPlaysOn(page, "computers");

  await expect(page).toHaveURL(`/make/${slug}/upright`);
  await page.goto(`/make/${slug}/plays-on`);
  await pageHasSettled(page);
  await expect(page.getByLabel("Computers only")).toBeChecked();
  await expect(page.getByLabel("Phones and computers")).not.toBeChecked();
});

test("the age question offers five choices with nothing picked", async ({ page }, testInfo) => {
  const { slug } = await startDraft(page);
  await fillAnswers(slug, { files: true, videos: true });
  await page.goto(`/make/${slug}/age`);
  await pageHasSettled(page);

  await expect(page.getByText("Question 7 of 7")).toBeVisible();
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
  await showTheOwner(page, testInfo, "question 7, who it is for");

  await nextButton(page).click();

  await expect(page.getByText("Choose who your game is for.")).toBeVisible();
});

test("an 18+ game is asked one more question, and a 12+ game is not", async ({ page }, testInfo) => {
  const { slug } = await startDraft(page);
  await fillAnswers(slug, { files: true, videos: true });
  await page.goto(`/make/${slug}/age`);
  await pageHasSettled(page);

  await answerAge(page, "18+");

  await expect(page).toHaveURL(`/make/${slug}/marks`);
  await expect(page.getByText("Question 8 of 8")).toBeVisible();
  await expect(
    page.getByText("Only adults see it. Pornography and gambling are never allowed."),
  ).toBeVisible();
  // "None of these" stands alone: choosing it unticks the others, and choosing another unticks it.
  await page.getByLabel("Gore").check();
  await page.getByLabel("Drugs").check();
  await page.getByLabel("None of these").check();
  await expect(page.getByLabel("Gore")).not.toBeChecked();
  await expect(page.getByLabel("Drugs")).not.toBeChecked();
  await page.getByLabel("Gore").check();
  await expect(page.getByLabel("None of these")).not.toBeChecked();
  await showTheOwner(page, testInfo, "question 8, what an 18+ game has");

  // Back, and a younger rating: the marks are cleared and the question is not asked (Review Focus 5).
  await page.getByRole("link", { name: "Back" }).click();
  await expect(page).toHaveURL(`/make/${slug}/age`);
  await answerAge(page, "12+");
  await expect(page).toHaveURL(`/make/${slug}/check`);
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
  const held = await holdAnswersTo(page, /\/make\/new$/);
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

    await fillAnswers(slug, { playsOn: false, files: true });
    await plain.goto(`/make/${slug}/plays-on`);
    await plain.getByLabel("Computers only").check();
    await plain.getByRole("button", { name: "Next" }).click();
    await expect(plain).toHaveURL(`/make/${slug}/upright`);
  } finally {
    await context.close();
  }
});

// ---- Whose game it is ------------------------------------------------------------------------------------------

test("another maker cannot open or answer this game's questions", async ({ page, browser, baseURL }) => {
  const { slug } = await startDraft(page);
  const site = baseURL ?? "http://localhost:4173";
  const stranger = await browser.newContext({ baseURL: site });
  try {
    const other = await stranger.newPage();
    await signUp(other);

    // Review Focus 2: a 404 that says nothing, for every address and every answer.
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
  await expect(page.getByText(name)).toBeVisible();
  await expect(page.getByText("We're looking at it. Come back here to see when it's live.")).toBeVisible();
  const back = page.getByRole("link", { name: "Back to your games" });
  await expect(back).toHaveCSS("background-color", rgb(token("--pay")));
  await showTheOwner(page, testInfo, "a game waiting for review");

  await back.click();
  await expect(page).toHaveURL("/make");
});
