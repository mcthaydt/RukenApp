import { expect, test } from "@playwright/test";
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

  // The list is sorted by name, so the first repository is the broken one.
  await expect(page.getByLabel("Game files")).toHaveValue("ruken-test/broken-game");
  await expectOneCard(page);
  await showTheOwner(page, testInfo, "the new-game form");
});

test("the form makes the game, pulls its files and goes to its page", async ({ page }) => {
  await signUp(page);
  await connectGitHub(page);

  await page.getByLabel("Name").fill(freshName());
  await page.getByLabel("One line").fill("A tiny game about tapping.");
  await page.getByLabel("Game files").selectOption("ruken-test/tiny-game");
  await page.getByRole("button", { name: "Next: add your clips" }).click();

  await expect(page).toHaveURL(/\/make\/tiny-game-[a-z0-9]+$/);
});

test("a name that is too short is refused in words, and what was typed stays", async ({ page }) => {
  await signUp(page);
  await connectGitHub(page);

  await page.getByLabel("Name").fill("!!");
  await page.getByLabel("One line").fill("A tiny game about tapping.");
  await page.getByRole("button", { name: "Next: add your clips" }).click();

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
    await page.getByRole("button", { name: "Next: add your clips" }).click();

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
  // Each point is a paragraph of its own, not one wall of words.
  await expect(page.getByText(/^2\. It's yours to share\./)).toBeVisible();
});
