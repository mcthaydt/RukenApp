import { expect, test, type Locator, type Page } from "@playwright/test";
import { signUp } from "./support/account.ts";
import { expectOneCard, showTheOwner } from "./support/look.ts";
import {
  BROKEN_GAME,
  connectGitHub,
  freshName,
  makeGame,
  sendClip,
  startGame,
  uploadClip,
  videoFile,
  clipLine,
  pageNamedAsVideo,
} from "./support/game.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

// The maker's area: the list of games, and the form that makes one. GitHub is the stand-in on this machine
// (support/fake-github-server.ts), which lists `ruken-test/broken-game` and `ruken-test/tiny-game` for the person.

// Every journey makes an account, and the site lets one address make five an hour; the counters are cleared before each.
test.beforeEach(forgetRateLimits);

test("a new maker is asked to connect GitHub, then picks a repository", async ({ page }, testInfo) => {
  await signUp(page);
  await page.goto("/make");
  await expect(page.getByText("You haven't added a game yet.")).toBeVisible();

  await page.getByRole("link", { name: "Add a game" }).click();
  await page.getByRole("link", { name: "Connect GitHub" }).click();

  // Nothing is chosen for the maker: a repository picked for them is one they might send without looking.
  await expect(page.getByLabel("Game files")).toHaveValue("");
  await expectOneCard(page);
  await showTheOwner(page, testInfo, "the new-game form");
});

test("the form makes the game, pulls its files and goes to its page", async ({ page }) => {
  await signUp(page);
  await connectGitHub(page);

  await page.getByLabel("Name").fill(freshName());
  await page.getByLabel("One line").fill("A tiny game about tapping.");
  await page.getByLabel("Game files").selectOption("ruken-test/tiny-game");
  await page.getByRole("button", { name: "Save and add your clips" }).click();

  await expect(page).toHaveURL(/\/make\/tiny-game-[a-z0-9]+$/);
});

test("a name that is too short is refused in words, and what was typed stays", async ({ page }) => {
  await signUp(page);
  await connectGitHub(page);

  await page.getByLabel("Name").fill("!!");
  await page.getByLabel("One line").fill("A tiny game about tapping.");
  await page.getByRole("button", { name: "Save and add your clips" }).click();

  await expect(page.getByText("Pick a name with at least three letters or numbers.")).toBeVisible();
  await expect(page.getByLabel("Name")).toHaveValue("!!");
  await expect(page.getByLabel("One line")).toHaveValue("A tiny game about tapping.");
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
    await page.getByLabel("One line").fill("A tiny game about tapping.");
    await page.getByRole("button", { name: "Save and add your clips" }).click();

    await expect(page.getByText(refused)).toBeVisible();
  }
});

test("a connection that failed says so, above the way to try again", async ({ page }) => {
  await signUp(page);

  await page.goto("/make/new?github=failed");

  await expect(page.getByText("GitHub didn't finish connecting. Try again.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Connect GitHub" })).toBeVisible();
});

test("signed out, the maker's area asks for sign-in", async ({ page }) => {
  await page.goto("/make");

  await expect(page).toHaveURL("/sign-in?next=%2Fmake");
});

// A game's page (design 5.4): the checklist a maker works down, top to bottom.
test("a maker submits a game and sees it waiting for review", async ({ page }, testInfo) => {
  await startGame(page);
  await expect(page.getByText("Not sent yet")).toBeVisible();
  await expect(page.getByText(/3 files/)).toBeVisible();

  await uploadClip(page, "Upright clip");
  await uploadClip(page, "Wide clip");
  await page.getByLabel("I agree to the maker agreement").check();
  await page.getByRole("button", { name: "Send for review" }).click();

  await expect(page.getByText("Waiting for review")).toBeVisible();
  await expect(page.getByText("Come back here to see when it's live.")).toBeVisible();
  await expectOneCard(page);
  await showTheOwner(page, testInfo, "a game waiting for review");
});

test("sending without clips says which one is missing", async ({ page }) => {
  await startGame(page);

  await page.getByLabel("I agree to the maker agreement").check();
  await page.getByRole("button", { name: "Send for review" }).click();
  await expect(page.getByText("Add an upright clip.")).toBeVisible();

  // The tick was taken when the maker pressed the button, so the box is not asked again.
  await expect(page.getByLabel("I agree to the maker agreement")).toHaveCount(0);
  await uploadClip(page, "Upright clip");
  await page.getByRole("button", { name: "Send for review" }).click();
  await expect(page.getByText("Add a wide clip.")).toBeVisible();
});

test("sending without agreeing says so, and the second game does not ask again", async ({ page }) => {
  await startGame(page);
  await uploadClip(page, "Upright clip");
  await uploadClip(page, "Wide clip");

  await page.getByRole("button", { name: "Send for review" }).click();
  await expect(page.getByText("Tick the box to agree to the maker agreement.")).toBeVisible();

  await page.getByLabel("I agree to the maker agreement").check();
  await page.getByRole("button", { name: "Send for review" }).click();
  await expect(page.getByText("Waiting for review")).toBeVisible();

  // Once agreed, a maker is not asked again.
  await page.goto("/make/new");
  await makeGame(page);
  await expect(page.getByLabel("I agree to the maker agreement")).toHaveCount(0);
});

test("a web page named as a video is refused beside its clip", async ({ page }) => {
  await startGame(page);

  await sendClip(page, "Upright clip", pageNamedAsVideo());

  await expect(
    clipLine(page, "Upright clip").getByText(
      "That file doesn't look like a video. Export it as MP4 or WebM and try again.",
    ),
  ).toBeVisible();
});

test("a repository with no index.html says what to fix, on the game's page", async ({ page }) => {
  await startGame(page, BROKEN_GAME);

  await expect(
    page.getByText(
      "We couldn't find an index.html at the top of that folder. Ruken starts a game from index.html.",
    ),
  ).toBeVisible();
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

test("the maker agreement is a page anyone can read", async ({ page }) => {
  await page.goto("/legal/maker-agreement");

  await expect(page.getByRole("heading", { name: "Maker agreement" })).toBeVisible();
  await expect(page.getByText("Version 1", { exact: true })).toBeVisible();
  // The version is said once: the Owner's file starts with a title line that says it too, and the page leaves it out.
  await expect(page.getByText(/version 1/i)).toHaveCount(1);
  // Each point is a paragraph of its own, not one wall of words.
  await expect(page.getByText(/^2\. It's yours to share\./)).toBeVisible();
});

// Review of branch M's screens (Owner: the new-game form and a game's page must pass the drunk-grandma test).
test("the new-game form says what goes in each box, and which step it is", async ({ page }) => {
  await signUp(page);
  await connectGitHub(page);

  await expect(page.getByText("Step 3 of 3")).toBeVisible();
  await expect(page.getByText("The name players will see.")).toBeVisible();
  await expect(page.getByText("One short sentence about your game.")).toBeVisible();
  await expect(page.getByText("The GitHub repository that holds your game.")).toBeVisible();
  await expect(
    page.getByText("Choose Computer only if your game needs a keyboard or a mouse."),
  ).toBeVisible();
});

test("the new-game form uses plain words for the games that talk to other websites", async ({ page }) => {
  await signUp(page);
  await connectGitHub(page);

  await expect(page.getByText("My game talks to a server")).toHaveCount(0);
  await expect(page.getByText("My game uses other websites")).toBeVisible();
});

test("pressing the button with no repository chosen says to choose one, and keeps what was typed", async ({
  page,
}) => {
  await signUp(page);
  await connectGitHub(page);

  await page.getByLabel("Name").fill(freshName());
  await page.getByLabel("One line").fill("A tiny game about tapping.");
  await page.getByRole("button", { name: "Save and add your clips" }).click();

  await expect(page.getByText("Choose the repository your game is in.")).toBeVisible();
  await expect(page.getByLabel("One line")).toHaveValue("A tiny game about tapping.");
});

test("the fold-outs on the new-game form wear the look, not the browser's triangles", async ({ page }) => {
  await signUp(page);
  await connectGitHub(page);

  const summaries = page.locator("summary");
  await expect(summaries).toHaveCount(2);
  for (const summary of await summaries.all()) {
    expect(await summary.evaluate((element) => getComputedStyle(element).listStyleType)).toBe("none");
  }
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

test("a clip that was added shows Replace, not an empty file box, and a new file can still be sent", async ({
  page,
}) => {
  await startGame(page);
  const upright = clipLine(page, "Upright clip");

  // Not added yet: the file box is there to use, and nothing offers to replace.
  await expect(page.getByLabel("Upright clip")).toBeVisible();
  await expect(upright.getByText("Replace", { exact: true })).toHaveCount(0);

  await uploadClip(page, "Upright clip");

  // Added: one word to press, and the file box stays folded away until it is pressed.
  await expect(page.getByLabel("Upright clip")).toBeHidden();
  await upright.getByText("Replace", { exact: true }).click();
  await expect(page.getByLabel("Upright clip")).toBeVisible();
  await sendClip(page, "Upright clip", videoFile());
  await expect(upright.getByText("Added", { exact: true })).toBeVisible();
});

test("a file field wears the look's button", async ({ page }) => {
  await startGame(page);

  const radius = await page
    .getByLabel("Upright clip")
    .evaluate((input) => getComputedStyle(input, "::file-selector-button").borderRadius);

  expect(radius).toBe("12px");
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

test("a game's page has one face for its headings", async ({ page }) => {
  await startGame(page);

  const face = (selector: string) =>
    page
      .locator(selector)
      .first()
      .evaluate((element) => getComputedStyle(element).fontFamily);

  expect(await face("main h2")).toBe(await face("main h1"));
});

test("the maker agreement leads back to the page it was opened from, or to Your games", async ({ page }) => {
  const slug = await startGame(page);
  await page.getByRole("link", { name: "maker agreement" }).click();
  await page.getByRole("link", { name: "Back to your game", exact: true }).click();
  await expect(page).toHaveURL(`/make/${slug}`);

  await page.goto("/legal/maker-agreement");
  await page.getByRole("link", { name: "Back to your games" }).click();
  await expect(page).toHaveURL("/make");
});

// Second look at branch M's screens.

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

/** Fills the new-game form and presses its button, without waiting for the game's page. */
async function makeGameWithoutWaiting(page: Page): Promise<void> {
  await page.getByLabel("Name").fill(freshName());
  await page.getByLabel("One line").fill("A tiny game about tapping.");
  await page.getByLabel("Game files").selectOption("ruken-test/tiny-game");
  await page.getByRole("button", { name: "Save and add your clips" }).click();
}

test("the new-game form's last button reads as the last step, and the other link has air above it", async ({
  page,
}) => {
  await signUp(page);
  await connectGitHub(page);

  await expect(page.getByText("Step 3 of 3")).toBeVisible();
  await expect(page.getByRole("button", { name: "Save and add your clips" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Next: add your clips" })).toHaveCount(0);

  const hint = await wordsOf(page.getByText("The GitHub repository that holds your game."));
  const link = await wordsOf(page.getByRole("link", { name: "Choose other repositories on GitHub" }));
  expect(link.top - hint.bottom).toBeGreaterThanOrEqual(12);
});

// Copying a game takes a minute, and the note about it is true only then. The scripts must have run for the page to
// know a copy has started, so the journey waits for them; a copy is held at the server until the note has been seen.
test("the note about copying shows only while the new game is being copied", async ({ page }) => {
  await signUp(page);
  await connectGitHub(page);
  const note = page.getByText("Copying your game can take a minute. Keep this page open.");
  await expect(note).toHaveCount(0);

  let release = () => {};
  const copyMayFinish = new Promise<void>((done) => {
    release = done;
  });
  await page.route(/\/make\/new\?\/create/, async (route) => {
    await copyMayFinish;
    await route.continue();
  });
  await page.waitForLoadState("networkidle");
  await makeGameWithoutWaiting(page);

  await expect(note).toBeVisible();
  release();
  await expect(page).toHaveURL(/\/make\/tiny-game-[a-z0-9]+$/);
});

test("a game's page offers the newest version in plain words, and the copying note shows only while it runs", async ({
  page,
}) => {
  const slug = await startGame(page);
  const note = page.getByText("Copying your game can take a minute. Keep this page open.");
  await expect(page.getByRole("button", { name: "Pull the latest" })).toHaveCount(0);
  await expect(note).toHaveCount(0);

  let release = () => {};
  const copyMayFinish = new Promise<void>((done) => {
    release = done;
  });
  await page.route(/\/make\/[^/]+\?\/pull/, async (route) => {
    await copyMayFinish;
    await route.continue();
  });
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Get the newest version from GitHub" }).click();

  await expect(note).toBeVisible();
  release();
  await expect(note).toHaveCount(0);
  await expect(page).toHaveURL(`/make/${slug}`);
});

test('on a game\'s page "Replace" sits one line under "Added", with no big gap', async ({ page }) => {
  await startGame(page);
  await uploadClip(page, "Upright clip");

  const line = clipLine(page, "Upright clip");
  const added = await wordsOf(line.getByText("Added", { exact: true }));
  const replace = await wordsOf(line.getByText("Replace", { exact: true }));

  // One rem between one line and the next is 16px; a few more would still read as one group.
  expect(replace.top - added.bottom).toBeGreaterThan(0);
  expect(replace.top - added.bottom).toBeLessThanOrEqual(24);
});

test("each point of the maker agreement has its title in bold, on a line of its own", async ({ page }) => {
  await page.goto("/legal/maker-agreement");

  const titles = page.locator("main p strong");
  await expect(titles).toHaveCount(7);
  await expect(titles.first()).toHaveText("1. Your game stays yours.");
  await expect(titles.first()).toHaveCSS("font-weight", "600");
  const bodyStartsBelow = await titles.first().evaluate((title) => {
    const paragraph = title.parentElement;
    const words = [...(paragraph?.childNodes ?? [])].filter((node) => node.nodeType === Node.TEXT_NODE).pop();
    if (words === undefined) return false;
    const range = document.createRange();
    range.selectNodeContents(words);
    const first = range.getClientRects()[0];
    return first !== undefined && first.top >= title.getBoundingClientRect().bottom - 1;
  });
  expect(bodyStartsBelow).toBe(true);
});

test("Your games shows each game with where it stands, for the Owner to look at", async ({
  page,
}, testInfo) => {
  await startGame(page);

  await page.goto("/make");

  await expect(page.getByText("Not sent yet")).toBeVisible();
  await expectOneCard(page);
  await showTheOwner(page, testInfo, "Your games");
});
