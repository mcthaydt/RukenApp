import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
import { signUp } from "./support/account.ts";
import { forgetTheirRepositories, putGameWhereStaffLeaveIt } from "./support/database.ts";
import { boxOf, expectOneCard, showTheOwner } from "./support/look.ts";
import {
  BROKEN_GAME,
  chooseVideo,
  connectGitHub,
  fileFieldOf,
  freshName,
  makeGame,
  pageNamedAsVideo,
  quickTimeFile,
  sendButton,
  startGame,
  stepOf,
  tooBigVideo,
  uploadVideo,
  videoFile,
} from "./support/game.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

// The maker's area: the list of games, the form that makes one, a game's page and the agreement. GitHub is the stand-in
// on this machine (support/fake-github-server.ts), which lists `ruken-test/broken-game` and `ruken-test/tiny-game`.
// Each screen's states are shown to the Owner on a phone and a computer (docs/superpowers/audits/2026-11-14-maker-screens-review.md).

// Every journey makes an account, and the site lets one address make five an hour; the counters are cleared before each.
test.beforeEach(forgetRateLimits);

/** Checks the card's look, then attaches the screen for the Owner to look at. */
async function lookAt(page: Page, testInfo: TestInfo, screen: string): Promise<void> {
  await expectOneCard(page);
  await showTheOwner(page, testInfo, screen);
}

/**
 * Holds the answer to every request for an address until `release()` is called, and counts the requests. A press
 * is seen as taken only while its answer is out, so a journey that looks at that state holds the answer back.
 */
async function holdAnswersTo(page: Page, address: RegExp) {
  let requests = 0;
  let release = () => {};
  const mayFinish = new Promise<void>((done) => {
    release = done;
  });
  await page.route(address, async (route) => {
    requests += 1;
    await mayFinish;
    await route.continue();
  });
  return {
    release: () => {
      release();
    },
    requestsSoFar: () => requests,
  };
}

/** Where a thing's words are, from the top of its first line to the bottom of its last (its box also holds air). */
function wordsOf(thing: Locator): Promise<{ top: number; bottom: number }> {
  return thing.evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    const lines = [...range.getClientRects()];
    return {
      top: Math.min(...lines.map((line) => line.top)),
      bottom: Math.max(...lines.map((line) => line.bottom)),
    };
  });
}

// ---- Your games ------------------------------------------------------------------------------------------------

test("Your games, with none, says what a maker needs ready", async ({ page }, testInfo) => {
  await signUp(page);

  await page.goto("/make");

  await expect(page.getByText("You haven't added a game yet.")).toBeVisible();
  await expect(
    page.getByText("You'll need your game on GitHub, ready to run in a browser, and two short videos of it."),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Add a game" })).toBeVisible();
  await lookAt(page, testInfo, "Your games, with none");
});

test("Your games shows each game as one link with where it stands and what to do, never staff's whole reason", async ({
  page,
}, testInfo) => {
  await signUp(page);
  await connectGitHub(page);
  const draft = await makeGame(page);
  await page.goto("/make/new");
  const refused = await makeGame(page, BROKEN_GAME);
  await page.goto("/make/new");
  const sentBack = await makeGame(page);
  await putGameWhereStaffLeaveIt(sentBack, {
    sentBack: "The upright video is sideways. Turn it the right way up.",
  });

  await page.goto("/make");

  const row = (slug: string) => page.locator(`a[href="/make/${slug}"]`);
  await expect(row(draft)).toContainText("Not sent yet. Add your videos.");
  await expect(row(refused)).toContainText("Not sent yet. Fix your game's files.");
  await expect(row(sentBack)).toContainText("Sent back. See what to fix.");
  await expect(page.getByText("The upright video is sideways")).toHaveCount(0);
  // Whole rows are links, 1.5rem apart, so the rows are told apart and each is easy to tap.
  const boxes = [await boxOf(row(draft)), await boxOf(row(refused)), await boxOf(row(sentBack))].sort(
    (a, b) => a.y - b.y,
  );
  for (const [index, upper] of boxes.entries()) {
    const lower = boxes[index + 1];
    if (lower !== undefined) expect(lower.y - (upper.y + upper.height)).toBeGreaterThanOrEqual(16);
  }
  await lookAt(page, testInfo, "Your games, with three games");
});

// ---- New game --------------------------------------------------------------------------------------------------

test("before GitHub is connected, the new-game screen says what Ruken will see, with no step count", async ({
  page,
}, testInfo) => {
  await signUp(page);

  await page.goto("/make/new");

  await expect(
    page.getByText("You choose which repositories Ruken can see. It can't see anything else."),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Connect GitHub" })).toBeVisible();
  await expect(page.getByText("Step 3 of 3")).toHaveCount(0);
  await lookAt(page, testInfo, "new game, before GitHub");
});

test("a connection that failed says so, above the way to try again", async ({ page }, testInfo) => {
  await signUp(page);

  await page.goto("/make/new?github=failed");

  await expect(page.getByText("GitHub didn't finish connecting. Try again.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Connect GitHub" })).toBeVisible();
  await lookAt(page, testInfo, "new game, after GitHub failed");
});

test("connected with no repository chosen, the maker is told, with one way to choose some", async ({
  page,
}, testInfo) => {
  const maker = await signUp(page);
  await connectGitHub(page);
  await forgetTheirRepositories(maker.email);

  await page.goto("/make/new");

  await expect(page.getByText("Ruken can't see any of your repositories yet.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Choose repositories on GitHub" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Connect GitHub" })).toHaveCount(0);
  await lookAt(page, testInfo, "new game, connected but no repository chosen");
});

test("a new maker is asked to connect GitHub, then picks a repository", async ({ page }, testInfo) => {
  await signUp(page);
  await page.goto("/make");
  await page.getByRole("link", { name: "Add a game" }).click();
  await page.getByRole("link", { name: "Connect GitHub" }).click();

  // Nothing is chosen for the maker: a repository picked for them is one they might send without looking.
  await expect(page.getByLabel("Game files")).toHaveValue("");
  await lookAt(page, testInfo, "the new-game form");
});

test("the form puts the game's files first, so the trip to GitHub wipes nothing, and says what goes in each box", async ({
  page,
}) => {
  await signUp(page);
  await connectGitHub(page);

  const files = await boxOf(page.getByLabel("Game files"));
  const name = await boxOf(page.getByLabel("Name"));
  const line = await boxOf(page.getByLabel("One line about your game"));
  expect(files.y).toBeLessThan(name.y);
  expect(name.y).toBeLessThan(line.y);
  await expect(page.getByText("The GitHub repository with your game's index.html.")).toBeVisible();
  await expect(page.getByText("The name players see. Like: Floor Fifty.")).toBeVisible();
  await expect(
    page.getByText("Players see it under the name. Like: Climb. Fall. Climb again."),
  ).toBeVisible();
  await expect(
    page.getByText("Choose Computer only if your game needs a keyboard or a mouse."),
  ).toBeVisible();
  // The link sits right under the files' hint, not under the last box.
  const hint = await boxOf(page.getByText("The GitHub repository with your game's index.html."));
  const link = await boxOf(page.getByRole("link", { name: "Don't see your game? Choose it on GitHub" }));
  expect(link.y).toBeGreaterThan(hint.y);
  expect(link.y).toBeLessThan(name.y);
  await expect(page.getByRole("button", { name: "Choose other repositories on GitHub" })).toHaveCount(0);
});

test("the new-game form uses plain words for the games that talk to other websites", async ({ page }) => {
  await signUp(page);
  await connectGitHub(page);

  await expect(page.getByText("My game talks to a server")).toHaveCount(0);
  await expect(page.getByText("My game uses other websites")).toBeVisible();
});

test("the form makes the game, pulls its files and goes to its page", async ({ page }) => {
  await signUp(page);
  await connectGitHub(page);

  await page.getByLabel("Name").fill(freshName());
  await page.getByLabel("One line about your game").fill("A tiny game about tapping.");
  await page.getByLabel("Game files").selectOption("ruken-test/tiny-game");
  await expect(page.getByRole("button", { name: "Save and add videos" })).toBeVisible();
  await page.getByRole("button", { name: "Save and add videos" }).click();

  await expect(page).toHaveURL(/\/make\/tiny-game-[a-z0-9]+$/);
});

test("with choices made, the form keeps them for the Owner to look at", async ({ page }, testInfo) => {
  await signUp(page);
  await connectGitHub(page);

  await page.getByLabel("Game files").selectOption("ruken-test/tiny-game");
  await page.getByLabel("Name").fill("Floor Fifty");
  await page.getByLabel("One line about your game").fill("Climb. Fall. Climb again.");
  await page.getByLabel("Computer only").check();

  await lookAt(page, testInfo, "the new-game form, with choices made");
});

test("every refusal shows at once, each under its own box, with the first box in focus", async ({
  page,
}, testInfo) => {
  await signUp(page);
  await connectGitHub(page);
  await page.waitForLoadState("networkidle");

  await page.getByLabel("Name").fill("!!");
  await page.getByRole("button", { name: "Save and add videos" }).click();

  const repoProblem = page.getByText("Choose the repository your game is in.");
  const nameProblem = page.getByText("Pick a name with at least three letters or numbers.");
  const lineProblem = page.getByText("A game needs one line about it.");
  for (const problem of [repoProblem, nameProblem, lineProblem]) await expect(problem).toBeVisible();
  // Each box is marked, and a reader is told its refusal with its hint.
  for (const [box, problem] of [
    [page.getByLabel("Game files"), repoProblem],
    [page.getByLabel("Name"), nameProblem],
    [page.getByLabel("One line about your game"), lineProblem],
  ] as const) {
    await expect(box).toHaveAttribute("aria-invalid", "true");
    const problemId = await problem.getAttribute("id");
    expect(problemId).not.toBeNull();
    expect(await box.getAttribute("aria-describedby")).toContain(problemId ?? "");
  }
  // Right under the box's own hint, above the next box.
  const hint = await boxOf(page.getByText("The name players see. Like: Floor Fifty."));
  const refusal = await boxOf(nameProblem);
  const next = await boxOf(page.getByLabel("One line about your game"));
  expect(refusal.y).toBeGreaterThan(hint.y);
  expect(refusal.y).toBeLessThan(next.y);
  // The first refused box takes focus, so a phone scrolls to it; what was typed stays.
  await expect(page.getByLabel("Game files")).toBeFocused();
  await expect(page.getByLabel("Name")).toHaveValue("!!");
  await lookAt(page, testInfo, "new game, every refusal at once");
});

test("a name that is too short is refused in words, and what was typed stays", async ({ page }, testInfo) => {
  await signUp(page);
  await connectGitHub(page);

  await page.getByLabel("Game files").selectOption("ruken-test/tiny-game");
  await page.getByLabel("Name").fill("!!");
  await page.getByLabel("One line about your game").fill("A tiny game about tapping.");
  await page.getByRole("button", { name: "Save and add videos" }).click();

  await expect(page.getByText("Pick a name with at least three letters or numbers.")).toBeVisible();
  await expect(page.getByLabel("Name")).toHaveValue("!!");
  await expect(page.getByLabel("One line about your game")).toHaveValue("A tiny game about tapping.");
  await lookAt(page, testInfo, "new game, a name that is too short");
});

test("a missing line and a missing repository each have their own refusal screen", async ({
  page,
}, testInfo) => {
  await signUp(page);
  await connectGitHub(page);

  // The refusal is shown, and the box taken to, by the page's script: wait for it, as a person on a slow phone would.
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Game files").selectOption("ruken-test/tiny-game");
  await page.getByLabel("Name").fill(freshName());
  await page.getByRole("button", { name: "Save and add videos" }).click();
  await expect(page.getByText("A game needs one line about it.")).toBeVisible();
  await expect(page.getByLabel("One line about your game")).toBeFocused();
  await lookAt(page, testInfo, "new game, no line");

  await page.getByLabel("One line about your game").fill("A tiny game about tapping.");
  await page.getByLabel("Game files").selectOption("");
  await page.getByRole("button", { name: "Save and add videos" }).click();
  await expect(page.getByText("Choose the repository your game is in.")).toBeVisible();
  await expect(page.getByText("A game needs one line about it.")).toHaveCount(0);
  await lookAt(page, testInfo, "new game, no repository");
});

test("a website that is not a name is refused beside its own box, in the box's own words", async ({
  page,
}, testInfo) => {
  await signUp(page);
  await connectGitHub(page);
  await page.getByLabel("Game files").selectOption("ruken-test/tiny-game");
  await page.getByLabel("Name").fill(freshName());
  await page.getByLabel("One line about your game").fill("A tiny game about tapping.");
  await page.getByText("My game uses other websites").click();
  await expect(page.getByText("One per line, like api.example.com. Five at most.")).toBeVisible();

  await page.getByLabel("Websites it uses").fill("https://not-a-name");
  await page.getByRole("button", { name: "Save and add videos" }).click();

  await expect(
    page.getByText("Write each website like api.example.com, one per line. Five at most."),
  ).toBeVisible();
  await expect(page.getByLabel("Websites it uses")).toHaveAttribute("aria-invalid", "true");
  await lookAt(page, testInfo, "new game, a website that is not a name");
});

test("a folder that cannot be right is refused beside its box, in the fold-out that holds it", async ({
  page,
}) => {
  await signUp(page);
  await connectGitHub(page);
  await page.getByLabel("Game files").selectOption("ruken-test/tiny-game");
  await page.getByLabel("Name").fill(freshName());
  await page.getByLabel("One line about your game").fill("A tiny game about tapping.");
  await page.getByText("Change the branch or folder").click();

  await page.getByLabel("Folder").fill("/web");
  await page.getByRole("button", { name: "Save and add videos" }).click();

  await expect(
    page.getByText(
      "That doesn't look like a folder. Write it like web/build, with no slash at the start or end.",
    ),
  ).toBeVisible();
  await expect(page.getByLabel("Folder")).toHaveAttribute("aria-invalid", "true");
});

// Review Focus 17 and 23: what a person types is not believed. A repository the form never offered is refused, even one
// that the app can read through the maker's own installation but that GitHub did not list for them.
test("a repository typed by hand that was never connected is refused", async ({ page }) => {
  await signUp(page);
  await connectGitHub(page);
  const refused = "Ruken can't see that repository. Choose it on GitHub, then try again.";

  // The form only offers the repositories GitHub listed, so a person who edits the page is simulated by changing the
  // field as the form is sent.
  let wanted = "";
  await page.route(/\/make\/new\?\/create$/, async (route) => {
    const body = new URLSearchParams(route.request().postData() ?? "");
    body.set("repo", wanted);
    await route.continue({ postData: body.toString() });
  });

  for (const repository of ["someone/else", "ruken-test/not-yours"]) {
    wanted = repository;
    await page.getByLabel("Name").fill(freshName());
    await page.getByLabel("One line about your game").fill("A tiny game about tapping.");
    await page.getByRole("button", { name: "Save and add videos" }).click();

    await expect(page.getByText(refused)).toBeVisible();
  }
});

test("while the game is copied the button says so and cannot be pressed again, so one game is made", async ({
  page,
}, testInfo) => {
  await signUp(page);
  await connectGitHub(page);
  const held = await holdAnswersTo(page, /\/make\/new\?\/create/);
  await page.getByLabel("Game files").selectOption("ruken-test/tiny-game");
  await page.getByLabel("Name").fill(freshName());
  await page.getByLabel("One line about your game").fill("A tiny game about tapping.");
  await page.waitForLoadState("networkidle");

  await page.getByRole("button", { name: "Save and add videos" }).click();

  const busy = page.getByRole("button", { name: "Copying your game…" });
  await expect(busy).toBeDisabled();
  await expect(busy).toHaveAttribute("aria-busy", "true");
  await expect(
    page.getByText("Copying your game from GitHub. This can take a minute. Keep this page open."),
  ).toBeVisible();
  // Another press, from the keyboard, is not taken either.
  await page.getByLabel("Name").press("Enter");
  expect(held.requestsSoFar()).toBe(1);
  await lookAt(page, testInfo, "new game, while copying");

  held.release();
  await expect(page).toHaveURL(/\/make\/tiny-game-[a-z0-9]+$/);
  expect(held.requestsSoFar()).toBe(1);
});

test("the fold-outs on the new-game form wear the look and a chevron, not the browser's triangles", async ({
  page,
}) => {
  await signUp(page);
  await connectGitHub(page);

  const summaries = page.locator("summary");
  await expect(summaries).toHaveCount(2);
  for (const summary of await summaries.all()) {
    expect(await summary.evaluate((element) => getComputedStyle(element).listStyleType)).toBe("none");
  }
  const mark = (summary: Locator) =>
    summary.evaluate((element) => getComputedStyle(element, "::after").content);
  expect(await mark(summaries.first())).toContain("›");
  await summaries.first().click();
  expect(await mark(summaries.first())).toContain("⌄");
});

test("signed out, the maker's area asks for sign-in", async ({ page }) => {
  await page.goto("/make");

  await expect(page).toHaveURL("/sign-in?next=%2Fmake");
});

test("the new-game form and a game's page both lead back to Your games", async ({ page }) => {
  await signUp(page);
  await page.goto("/make/new");
  await page.getByRole("link", { name: "Back to your games" }).click();
  await expect(page).toHaveURL("/make");

  await connectGitHub(page);
  await page.getByRole("link", { name: "Back to your games" }).click();
  await expect(page).toHaveURL("/make");

  await page.goto("/make/new");
  await makeGame(page);
  await page.getByRole("link", { name: "Back to your games" }).click();
  await expect(page).toHaveURL("/make");
});

// ---- A game's page ---------------------------------------------------------------------------------------------

test("a game's page reads as one checklist: where it stands, the one next step, then files, two videos, agree, send", async ({
  page,
}, testInfo) => {
  await startGame(page);

  await expect(page.getByText("Not sent yet", { exact: true })).toBeVisible();
  await expect(page.getByText("Add your two videos, then send it for review.")).toBeVisible();
  await expect(stepOf(page, "Game files").getByText(/ruken-test\/tiny-game · 3 files, 1 KB/)).toBeVisible();
  await expect(page.getByText("Players see these in the feed before they play.")).toBeVisible();
  await expect(
    stepOf(page, "Upright video").getByText("For phones: taller than wide. MP4 or WebM, up to 30 MB."),
  ).toBeVisible();
  await expect(
    stepOf(page, "Wide video").getByText("For computers: wider than tall. MP4 or WebM, up to 30 MB."),
  ).toBeVisible();
  // No two buttons sound alike, and none says only "Upload" or "Replace".
  await expect(page.getByRole("button", { name: "Copy my game from GitHub again" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Upload|Replace|Get the newest/ })).toHaveCount(0);
  // The state is the only serif line under the title: no second heading says "Game files".
  await expect(page.locator("main h2")).toHaveCount(0);
  // One filled button at a time: the first video still missing; Send and the copy are quiet.
  await expect(stepOf(page, "Upright video").locator(".file")).not.toHaveAttribute("data-quiet");
  await expect(stepOf(page, "Upright video").locator(".file > span")).toHaveText("Choose upright video");
  await expect(stepOf(page, "Wide video").locator(".file")).toHaveAttribute("data-quiet");
  await expect(stepOf(page, "Wide video").locator(".file > span")).toHaveText("Choose wide video");
  await expect(sendButton(page)).toHaveClass(/quiet/);
  await expect(page.getByRole("button", { name: "Copy my game from GitHub again" })).toHaveClass(/quiet/);
  await lookAt(page, testInfo, "a game's page, no videos");
});

test("a video is added the moment it is chosen, and the screen shows its name and size while it goes", async ({
  page,
}, testInfo) => {
  await startGame(page);
  const held = await holdAnswersTo(page, /\/make\/[^/]+\?\/clip/);
  await page.waitForLoadState("networkidle");

  await chooseVideo(page, "Upright video", videoFile("my-game-upright.mp4"));

  const row = stepOf(page, "Upright video");
  await expect(row.getByText("my-game-upright.mp4 · 1 KB")).toBeVisible();
  await expect(row.getByText("Adding your video. Keep this page open.")).toBeVisible();
  await expect(row.locator(".file > span")).toHaveText("Adding your video…");
  await expect(fileFieldOf(page, "Upright video")).toBeDisabled();
  await expect(fileFieldOf(page, "Upright video")).toHaveAttribute("aria-busy", "true");
  await lookAt(page, testInfo, "a game's page, a video being added");

  held.release();
  await expect(row.getByText("Added · 1 KB")).toBeVisible();
  expect(held.requestsSoFar()).toBe(1);
});

test("a video of the wrong kind or size is refused in plain words before anything is sent", async ({
  page,
}, testInfo) => {
  await startGame(page);
  let sent = 0;
  await page.route(/\/make\/[^/]+\?\/clip/, async (route) => {
    sent += 1;
    await route.continue();
  });
  await page.waitForLoadState("networkidle");
  const row = stepOf(page, "Upright video");

  await chooseVideo(page, "Upright video", quickTimeFile());
  await expect(
    row.getByText(
      "That's a .mov file. Ruken takes MP4 or WebM videos. Export it as MP4 and choose it again.",
    ),
  ).toBeVisible();
  // The maker can see which file was refused.
  await expect(row.getByText("holiday.mov · 1 KB")).toBeVisible();
  await lookAt(page, testInfo, "a game's page, a video refused for its kind");

  await chooseVideo(page, "Upright video", await tooBigVideo(testInfo.outputPath("too-big.mp4")));
  await expect(
    row.getByText(
      "That video is 31 MB. Videos can be up to 30 MB. Make it shorter or smaller, then choose it again.",
    ),
  ).toBeVisible();
  await expect(row.getByText("too-big.mp4 · 31 MB")).toBeVisible();
  expect(sent).toBe(0);

  // A good video chosen next is added, and the refusal goes.
  await chooseVideo(page, "Upright video", videoFile());
  await expect(row.getByText(/^Added/)).toBeVisible();
  await expect(row.getByText(/Ruken takes MP4 or WebM|Videos can be up to/)).toHaveCount(0);
});

test("a web page named as a video is refused under its own box, and the file stays named", async ({
  page,
}, testInfo) => {
  await startGame(page);

  await chooseVideo(page, "Upright video", pageNamedAsVideo());

  const row = stepOf(page, "Upright video");
  await expect(
    row.getByText("That file doesn't look like a video. Export it as MP4 or WebM and try again."),
  ).toBeVisible();
  await expect(stepOf(page, "Wide video").getByText(/doesn't look like a video/)).toHaveCount(0);
  await lookAt(page, testInfo, "a game's page, a video the server refused");
});

test("with one video in, the other is the one filled button, and the added one can be changed", async ({
  page,
}, testInfo) => {
  await startGame(page);

  await uploadVideo(page, "Upright video");

  await expect(page.getByText("Add your wide video, then send it for review.")).toBeVisible();
  await expect(stepOf(page, "Upright video").getByText("Added · 1 KB")).toBeVisible();
  await expect(stepOf(page, "Upright video").locator(".file > span")).toHaveText("Choose a different video");
  await expect(stepOf(page, "Upright video").locator(".file")).toHaveAttribute("data-quiet");
  await expect(stepOf(page, "Wide video").locator(".file")).not.toHaveAttribute("data-quiet");
  await expect(page.getByText("Replace", { exact: true })).toHaveCount(0);
  await lookAt(page, testInfo, "a game's page, one video");

  // A different video takes the place of the first, with no fold-out and no second press.
  await chooseVideo(page, "Upright video", videoFile("other.mp4"));
  await expect(stepOf(page, "Upright video").getByText("Added · 1 KB")).toBeVisible();
});

test("with both videos in, Send is the one filled button", async ({ page }, testInfo) => {
  await startGame(page);

  await uploadVideo(page, "Upright video");
  await uploadVideo(page, "Wide video");

  await expect(page.getByText("Everything's here. Send it for review.")).toBeVisible();
  await expect(sendButton(page)).not.toHaveClass(/quiet/);
  await expect(stepOf(page, "Wide video").locator(".file")).toHaveAttribute("data-quiet");
  await lookAt(page, testInfo, "a game's page, both videos");
});

test("a maker submits a game and sees it waiting for review", async ({ page }, testInfo) => {
  await startGame(page);
  await expect(page.getByText(/3 files/)).toBeVisible();

  await uploadVideo(page, "Upright video");
  await uploadVideo(page, "Wide video");
  await page.getByLabel("I've read and agree to the maker agreement").check();
  await sendButton(page).click();

  await expect(page.getByText("Waiting for review", { exact: true })).toBeVisible();
  await expect(page.getByText("We're looking at it. Come back here to see when it's live.")).toBeVisible();
  // The copy button is quiet, and says what pressing it changes.
  await expect(page.getByRole("button", { name: "Copy my game from GitHub again" })).toBeVisible();
  await expect(page.getByText("We'll review the newest copy.")).toBeVisible();
  await expect(stepOf(page, "Upright video").locator(".file > span")).toHaveText("Choose a different video");
  await lookAt(page, testInfo, "a game's page, waiting for review");
});

test("sending with nothing done lists everything missing, marks the boxes and takes the maker to the first", async ({
  page,
}, testInfo) => {
  await startGame(page);

  await page.waitForLoadState("networkidle");
  await sendButton(page).click();

  await expect(
    page.getByText("Before you send it: add the upright video, add the wide video, and tick the box."),
  ).toBeVisible();
  await expect(fileFieldOf(page, "Upright video")).toBeFocused();
  await expect(page.getByLabel("I've read and agree to the maker agreement")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await lookAt(page, testInfo, "a game's page, send refused for nothing done");
});

test("sending with both videos in but no tick says only that, and the tick takes focus", async ({
  page,
}, testInfo) => {
  await startGame(page);
  await uploadVideo(page, "Upright video");
  await uploadVideo(page, "Wide video");

  await page.waitForLoadState("networkidle");
  await sendButton(page).click();

  await expect(page.getByText("Before you send it: tick the box.")).toBeVisible();
  await expect(page.getByLabel("I've read and agree to the maker agreement")).toBeFocused();
  await lookAt(page, testInfo, "a game's page, send refused for no tick");

  await page.getByLabel("I've read and agree to the maker agreement").check();
  await sendButton(page).click();
  await expect(page.getByText("Waiting for review", { exact: true })).toBeVisible();
});

test("sending without videos says which are missing, and the tick is kept, so the box is not asked again", async ({
  page,
}) => {
  await startGame(page);

  await page.getByLabel("I've read and agree to the maker agreement").check();
  await sendButton(page).click();
  await expect(
    page.getByText("Before you send it: add the upright video and add the wide video."),
  ).toBeVisible();

  // The tick was taken when the maker pressed the button, so the box is not asked again.
  await expect(page.getByLabel("I've read and agree to the maker agreement")).toHaveCount(0);
  await uploadVideo(page, "Upright video");
  await sendButton(page).click();
  await expect(page.getByText("Before you send it: add the wide video.")).toBeVisible();
});

test("while a game is sent the button says so and cannot be pressed again", async ({ page }) => {
  await startGame(page);
  await uploadVideo(page, "Upright video");
  await uploadVideo(page, "Wide video");
  await page.getByLabel("I've read and agree to the maker agreement").check();
  const held = await holdAnswersTo(page, /\/make\/[^/]+\?\/send/);
  await page.waitForLoadState("networkidle");

  await sendButton(page).click();

  const busy = page.getByRole("button", { name: "Sending your game…" });
  await expect(busy).toBeDisabled();
  await expect(busy).toHaveAttribute("aria-busy", "true");
  expect(held.requestsSoFar()).toBe(1);
  held.release();
  await expect(page.getByText("Waiting for review", { exact: true })).toBeVisible();
});

test("the second game does not ask for the agreement again", async ({ page }) => {
  await startGame(page);
  await uploadVideo(page, "Upright video");
  await uploadVideo(page, "Wide video");
  await page.getByLabel("I've read and agree to the maker agreement").check();
  await sendButton(page).click();
  await expect(page.getByText("Waiting for review", { exact: true })).toBeVisible();

  await page.goto("/make/new");
  await makeGame(page);
  await expect(page.getByLabel("I've read and agree to the maker agreement")).toHaveCount(0);
});

test("the agreement can be read in place on a game's page, without losing the tick", async ({ page }) => {
  await startGame(page);
  await page.getByLabel("I've read and agree to the maker agreement").check();

  await page.getByText("Read the maker agreement").click();

  await expect(page.getByText("Your game stays yours.")).toBeVisible();
  await expect(page.locator("details li")).toHaveCount(7);
  await expect(page.getByLabel("I've read and agree to the maker agreement")).toBeChecked();
});

test("a repository with no index.html says what to fix, with its name kept, and the copy button is the filled one", async ({
  page,
}, testInfo) => {
  await startGame(page, BROKEN_GAME);

  const files = stepOf(page, "Game files");
  await expect(files.getByText("ruken-test/broken-game")).toBeVisible();
  await expect(
    files.getByText(
      "We couldn't find an index.html at the top of that folder. Ruken starts a game from index.html.",
    ),
  ).toBeVisible();
  await expect(files.getByText("Fix it on GitHub, then press Copy my game from GitHub again.")).toBeVisible();
  await expect(page.getByText("Fix your game's files on GitHub, then copy it again.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy my game from GitHub again" })).not.toHaveClass(/quiet/);
  await expect(sendButton(page)).toHaveClass(/quiet/);
  await expect(stepOf(page, "Upright video").locator(".file")).toHaveAttribute("data-quiet");
  await lookAt(page, testInfo, "a game's page, files refused");
});

test("while the files are copied again the button says so and cannot be pressed twice, and the note shows only then", async ({
  page,
}, testInfo) => {
  const slug = await startGame(page);
  const note = page.getByText("Copying your game from GitHub. This can take a minute. Keep this page open.");
  await expect(note).toHaveCount(0);
  const held = await holdAnswersTo(page, /\/make\/[^/]+\?\/pull/);
  await page.waitForLoadState("networkidle");

  await page.getByRole("button", { name: "Copy my game from GitHub again" }).click();

  const busy = page.getByRole("button", { name: "Copying your game…" });
  await expect(busy).toBeDisabled();
  await expect(busy).toHaveAttribute("aria-busy", "true");
  await expect(note).toBeVisible();
  expect(held.requestsSoFar()).toBe(1);
  await lookAt(page, testInfo, "a game's page, copying from GitHub");

  held.release();
  await expect(note).toHaveCount(0);
  await expect(page).toHaveURL(`/make/${slug}`);
  await expect(page.getByRole("button", { name: "Copy my game from GitHub again" })).toBeVisible();
});

test("a game that was sent back shows what to fix apart from the state, and its button says again", async ({
  page,
}, testInfo) => {
  const slug = await startGame(page);
  await uploadVideo(page, "Upright video");
  await uploadVideo(page, "Wide video");
  await page.getByLabel("I've read and agree to the maker agreement").check();
  await sendButton(page).click();
  await expect(page.getByText("Waiting for review", { exact: true })).toBeVisible();
  const reason = "The upright video is sideways. Turn it the right way up and send it again.";
  await putGameWhereStaffLeaveIt(slug, { sentBack: reason });

  await page.goto(`/make/${slug}`);

  await expect(page.getByText("Sent back", { exact: true })).toBeVisible();
  await expect(page.getByText("What to fix", { exact: true })).toBeVisible();
  await expect(page.getByText(reason, { exact: true })).toBeVisible();
  await expect(page.getByText("Fix it, then send it again.")).toBeVisible();
  await expect(page.getByText(/^Sent back:/)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Send it again" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Send for review" })).toHaveCount(0);
  await lookAt(page, testInfo, "a game's page, sent back");
});

test("a live game says players can find it, and its newest version goes for review on one press", async ({
  page,
}, testInfo) => {
  const slug = await startGame(page);
  await uploadVideo(page, "Upright video");
  await uploadVideo(page, "Wide video");
  await putGameWhereStaffLeaveIt(slug, "live");

  await page.goto(`/make/${slug}`);

  await expect(page.getByText("Live", { exact: true })).toBeVisible();
  await expect(page.getByText("Players can find it on Ruken.")).toBeVisible();
  await expect(page.getByRole("link", { name: "See it on Ruken" })).toBeVisible();
  await expect(page.getByText("Players keep the version they have until we say yes.")).toBeVisible();
  await expect(page.getByText("Videos can't be changed on a live game yet.")).toBeVisible();
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
  await lookAt(page, testInfo, "a game's page, live");

  await page.getByRole("button", { name: "Send my newest version for review" }).click();
  await expect(page.getByText("Live. Your update is waiting for review", { exact: true })).toBeVisible();
});

test("the file picker is reached and opened from the keyboard, and shows where the keyboard is", async ({
  page,
}) => {
  await startGame(page);
  await page.waitForLoadState("networkidle");
  const field = fileFieldOf(page, "Upright video");

  for (let presses = 0; presses < 40; presses += 1) {
    await page.keyboard.press("Tab");
    if (await field.evaluate((element) => element === document.activeElement)) break;
  }
  await expect(field).toBeFocused();
  const ring = await stepOf(page, "Upright video")
    .locator(".file > span")
    .evaluate((span) => getComputedStyle(span).outlineWidth);
  expect(ring).toBe("3px");

  const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.keyboard.press("Space")]);
  await chooser.setFiles(videoFile());
  await expect(stepOf(page, "Upright video").getByText(/^Added/)).toBeVisible();
});

test("another maker cannot open this game's page", async ({ page, browser, baseURL }) => {
  const slug = await startGame(page);
  const stranger = await browser.newContext(baseURL === undefined ? {} : { baseURL });
  try {
    const other = await stranger.newPage();
    await signUp(other);

    const answer = await other.goto(`/make/${slug}`);

    expect(answer?.status()).toBe(404);
  } finally {
    await stranger.close();
  }
});

test("a game's page names the address and the other websites only for a game that uses some", async ({
  page,
}) => {
  await signUp(page);
  await connectGitHub(page);

  await makeGame(page);
  await expect(page.getByText(/Your game runs at/)).toHaveCount(0);
  await expect(page.getByText(/which address to allow/)).toHaveCount(0);

  await page.goto("/make/new");
  await page.getByText("My game uses other websites").click();
  await page.getByLabel("Websites it uses").fill("api.example.com");
  await makeGame(page);
  await expect(page.getByText("Websites your game uses: api.example.com")).toBeVisible();
  await expect(page.getByText(/If one of them asks which address to allow, give it http/)).toBeVisible();
});

test("the rows of a game's page sit a label, a line and a button apart, with room between rows", async ({
  page,
}) => {
  await startGame(page);
  const row = stepOf(page, "Upright video");

  const label = await wordsOf(row.getByText("Upright video", { exact: true }));
  const line = await wordsOf(row.getByText("For phones: taller than wide. MP4 or WebM, up to 30 MB."));
  // Inside a row, one line under the other: a small step, never a gap.
  expect(line.top - label.bottom).toBeGreaterThanOrEqual(0);
  expect(line.top - label.bottom).toBeLessThanOrEqual(16);
  const files = await boxOf(stepOf(page, "Game files"));
  const upright = await boxOf(row);
  // Between rows, two rem.
  expect(upright.y - (files.y + files.height)).toBeGreaterThanOrEqual(24);
});

// ---- The maker agreement ---------------------------------------------------------------------------------------

test("the maker agreement is a page anyone can read, a numbered list with its version and date", async ({
  page,
}, testInfo) => {
  await page.goto("/legal/maker-agreement");

  await expect(page.getByRole("heading", { name: "Maker agreement" })).toBeVisible();
  // "Version 1", and "Last updated <date>" once the file's title line carries its date.
  await expect(page.locator("main .note").first()).toHaveText(
    /^Version 1(?: · Last updated \d{1,2} [A-Z][a-z]+ \d{4})?$/,
  );
  await expect(page.getByText("You agree to this once, when you send your first game.")).toBeVisible();
  // The version is said once: the Owner's file starts with a title line that says it too, and the page leaves it out.
  await expect(page.getByText(/version 1/i)).toHaveCount(1);
  await expect(page.locator("main ol > li")).toHaveCount(7);
  await expect(page.locator("main ol > li").nth(1).locator("strong")).toHaveText("It's yours to share.");
  await lookAt(page, testInfo, "the maker agreement");
});

test("each point of the maker agreement has its number hung in the margin, its title in bold and its words under it", async ({
  page,
}) => {
  await page.goto("/legal/maker-agreement");

  const points = page.locator("main ol > li");
  await expect(points.first().locator("strong")).toHaveText("Your game stays yours.");
  await expect(points.first().locator("strong")).toHaveCSS("font-weight", "600");
  await expect(page.locator("main ol")).toHaveCSS("list-style-position", "outside");
  // The title and the words start on one line, with the number out in the margin.
  const title = await boxOf(points.first().locator("strong"));
  const words = await boxOf(points.first().locator("p"));
  expect(Math.abs(title.x - words.x)).toBeLessThanOrEqual(1);
  const gap =
    (await wordsOf(points.first().locator("p"))).top -
    (await wordsOf(points.first().locator("strong"))).bottom;
  expect(gap).toBeGreaterThanOrEqual(0);
  // One small step, measured from the words: a line's own air is in it.
  expect(gap).toBeLessThanOrEqual(12);
  // 1.75rem between points, so each reads as one block.
  const first = await boxOf(points.nth(0));
  const second = await boxOf(points.nth(1));
  expect(second.y - (first.y + first.height)).toBeGreaterThanOrEqual(27);
});

test("the way back is at the top of the agreement as well as at the end, and leads where the maker came from", async ({
  page,
}) => {
  const slug = await startGame(page);
  await page.getByRole("link", { name: "maker agreement", exact: true }).click();

  const back = page.getByRole("link", { name: "Back to your game", exact: true });
  await expect(back).toHaveCount(2);
  const list = await boxOf(page.locator("main ol"));
  expect((await boxOf(back.first())).y).toBeLessThan(list.y);
  expect((await boxOf(back.last())).y).toBeGreaterThan(list.y);
  await back.first().click();
  await expect(page).toHaveURL(`/make/${slug}`);

  await page.goto("/legal/maker-agreement");
  await page.getByRole("link", { name: "Back to your games" }).first().click();
  await expect(page).toHaveURL("/make");
});
