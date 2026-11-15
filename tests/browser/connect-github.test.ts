import { expect, test } from "@playwright/test";
import { rgb, token } from "../support/look-tokens.ts";
import { pageHasSettled, signUp } from "./support/account.ts";
import {
  connectStateFor,
  forgetTheirRepositories,
  githubConnectionOf,
  userIdOf,
} from "./support/database.ts";
import { connectGitHubFromFiles, startAtFiles, startDraft } from "./support/game.ts";
import { boxOf, showTheOwner } from "./support/look.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

// A maker connects their GitHub on the site and the site remembers which repositories GitHub says they can reach. The
// stand-in GitHub (support/fake-github-server.ts) holds one installation with three repositories the app can read, two
// of them listed for the person. A connection started from a game's third question comes back to that question; one
// started from nowhere comes back to Your games.

// Every journey but the last makes an account, and the site lets one address make five an hour; the counters are
// cleared before each.
test.beforeEach(forgetRateLimits);

test("connecting GitHub comes back with the maker's repositories remembered", async ({ page }) => {
  const maker = await signUp(page);

  await page.goto("/make/github");

  await expect(page).toHaveURL("/make");
  // Never `ruken-test/not-yours`: the app can read it, but GitHub did not list it for this person.
  expect(await githubConnectionOf(maker.email)).toMatchObject([
    {
      installationId: 1n,
      accountLogin: "ruken-test",
      repositories: ["ruken-test/broken-game", "ruken-test/tiny-game"],
    },
  ]);
});

test("choosing repositories on GitHub's own page also comes back remembered", async ({ page }) => {
  const maker = await signUp(page);

  await page.goto("/make/github?choose=1");

  await expect(page).toHaveURL("/make");
  expect(await githubConnectionOf(maker.email)).toMatchObject([{ installationId: 1n }]);
});

test("a callback with a state nobody started is refused, and nothing is remembered", async ({ page }) => {
  const maker = await signUp(page);

  await page.goto("/make/github/callback?code=test-code&state=made-up");

  await expect(page).toHaveURL("/make?github=failed");
  expect(await githubConnectionOf(maker.email)).toEqual([]);
});

// The state travels through GitHub in an address, so it must open only for the account that started it.
test("a state that another account started is refused, and nothing is remembered", async ({ page }) => {
  const maker = await signUp(page);

  await page.goto(
    `/make/github/callback?code=test-code&state=${encodeURIComponent(connectStateFor("another-account"))}`,
  );

  await expect(page).toHaveURL("/make?github=failed");
  expect(await githubConnectionOf(maker.email)).toEqual([]);
});

test("a callback with no code is refused", async ({ page }) => {
  const maker = await signUp(page);
  const state = connectStateFor(await userIdOf(maker.email));

  await page.goto(`/make/github/callback?state=${encodeURIComponent(state)}`);

  await expect(page).toHaveURL("/make?github=failed");
  expect(await githubConnectionOf(maker.email)).toEqual([]);
});

test("signed out, connecting asks for sign-in first", async ({ page }) => {
  await page.goto("/make/github");

  await expect(page).toHaveURL("/sign-in?next=%2Fmake%2Fgithub");
});

// ---- From a game's third question ------------------------------------------------------------------------------

test("before GitHub is connected, the files question says what Ruken will see, with a way to learn GitHub", async ({
  page,
}, testInfo) => {
  const { slug } = await startAtFiles(page);

  await expect(page.getByRole("heading", { name: "Where are your game's files?" })).toBeVisible();
  await expect(page.getByText("Question 3 of 7")).toBeVisible();
  await expect(page.getByText("Your game lives on GitHub. Connect it, then pick the folder.")).toBeVisible();
  await expect(
    page.getByText("You choose which repositories Ruken can see. It can't see anything else."),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Here's how to put your game there" })).toHaveAttribute(
    "href",
    `/help/github?from=${encodeURIComponent(`/make/${slug}/files`)}`,
  );
  const connect = page.getByRole("link", { name: "Connect GitHub" });
  await expect(connect).toHaveCSS("background-color", rgb(token("--pay")));
  await expect(connect).toHaveAttribute("href", `/make/github?choose=1&game=${slug}`);
  // One blue button: the link, and nothing that submits.
  await expect(page.locator("main button")).toHaveCount(0);
  await showTheOwner(page, testInfo, "question 3, GitHub not connected");
});

test("connecting from question 3 comes back to question 3, with the first two answers kept", async ({
  page,
}, testInfo) => {
  const { slug, name, maker } = await startAtFiles(page);

  await connectGitHubFromFiles(page, slug);

  await expect(page.getByText("ruken-test/tiny-game")).toBeVisible();
  await expect(page.getByText("ruken-test/broken-game")).toBeVisible();
  // Never `ruken-test/not-yours`: the app can read it, but GitHub did not list it for this person.
  await expect(page.getByText("ruken-test/not-yours")).toHaveCount(0);
  expect(await githubConnectionOf(maker.email)).toMatchObject([{ installationId: 1n }]);
  await showTheOwner(page, testInfo, "question 3, GitHub connected");

  await page.getByRole("link", { name: "Back" }).click();
  await expect(page).toHaveURL(`/make/${slug}/line`);
  await expect(page.getByRole("textbox")).toHaveValue("Climb. Fall. Climb again.");
  await page.goto(`/make/${slug}/name`);
  await expect(page.getByLabel("What's your game called?")).toHaveValue(name);
});

test("a connection that failed says so on the question, above the way to try again", async ({
  page,
}, testInfo) => {
  const { slug, maker } = await startAtFiles(page);
  const userId = await userIdOf(maker.email);

  // A code GitHub refuses: the state opens, so she comes back to her own question.
  await page.goto(
    `/make/github/callback?code=refused&state=${encodeURIComponent(connectStateFor(userId, slug))}`,
  );

  await expect(page).toHaveURL(`/make/${slug}/files?github=failed`);
  const failure = page.getByText("GitHub didn't connect. Try again.");
  await expect(failure).toBeVisible();
  const sheet = page.getByText("Your game lives on GitHub. Connect it, then pick the folder.");
  expect((await boxOf(failure)).y).toBeLessThan((await boxOf(sheet)).y);
  await expect(page.getByRole("link", { name: "Connect GitHub" })).toBeVisible();
  expect(await githubConnectionOf(maker.email)).toEqual([]);
  await showTheOwner(page, testInfo, "question 3, the connection failed");
});

// She is connected and pressed "Don't see your game? Choose it on GitHub": GitHub came back with a refused code, and the
// rows she already had are still there. Saying nothing would leave her wondering whether the game was added.
test("a failed reconnect says so to a maker who is already connected, above her rows", async ({
  page,
}, testInfo) => {
  const { slug, maker } = await startAtFiles(page);
  await connectGitHubFromFiles(page, slug);
  const userId = await userIdOf(maker.email);

  await page.goto(
    `/make/github/callback?code=refused&state=${encodeURIComponent(connectStateFor(userId, slug))}`,
  );

  await expect(page).toHaveURL(`/make/${slug}/files?github=failed`);
  const failure = page.getByText("GitHub didn't connect. Try again.");
  await expect(failure).toBeVisible();
  await expect(page.getByRole("radio")).toHaveCount(2);
  const rows = page.getByRole("radio").first();
  expect((await boxOf(failure)).y).toBeLessThan((await boxOf(rows)).y);
  expect(await githubConnectionOf(maker.email)).toMatchObject([{ installationId: 1n }]);
  await showTheOwner(page, testInfo, "question 3, connected, the reconnect failed");
});

test("a failed reconnect says so to a maker whose connection holds no repositories", async ({ page }) => {
  const { slug, maker } = await startAtFiles(page);
  await connectGitHubFromFiles(page, slug);
  await forgetTheirRepositories(maker.email);

  await page.goto(`/make/${slug}/files?github=failed`);

  await expect(page.getByText("Ruken can't see any of your repositories yet.")).toBeVisible();
  await expect(page.getByText("GitHub didn't connect. Try again.")).toBeVisible();
});

// Review Focus 7: the state travels through GitHub in an address.
test("a state that someone changed lands on Your games, and says GitHub didn't connect", async ({ page }) => {
  await startDraft(page);

  await page.goto("/make/github/callback?code=test-code&state=made-up");

  await expect(page).toHaveURL("/make?github=failed");
  await expect(page.getByRole("heading", { name: "Your games" })).toBeVisible();
  await expect(page.getByText("GitHub didn't connect. Try again.")).toBeVisible();
});

test("a state for another maker's game lands on a 404, never on her question", async ({
  page,
  browser,
  baseURL,
}) => {
  const { slug } = await startDraft(page);
  const stranger = await browser.newContext({ baseURL: baseURL ?? "http://localhost:4173" });
  try {
    const other = await stranger.newPage();
    const intruder = await signUp(other);
    const state = connectStateFor(await userIdOf(intruder.email), slug);

    const landed = await other.goto(
      `/make/github/callback?code=test-code&state=${encodeURIComponent(state)}`,
    );

    expect(other.url()).toContain(`/make/${slug}/files`);
    expect(landed?.status()).toBe(404);
  } finally {
    await stranger.close();
  }
});

test("connected with nothing chosen, she is told, with one way to choose some", async ({
  page,
}, testInfo) => {
  const { slug, maker } = await startAtFiles(page);
  await connectGitHubFromFiles(page, slug);
  await forgetTheirRepositories(maker.email);

  await page.goto(`/make/${slug}/files`);
  await pageHasSettled(page);

  await expect(page.getByText("Ruken can't see any of your repositories yet.")).toBeVisible();
  await expect(page.getByRole("radio")).toHaveCount(0);
  const choose = page.getByRole("link", { name: "Choose repositories on GitHub" });
  await expect(choose).toHaveCSS("background-color", rgb(token("--pay")));
  await expect(choose).toHaveAttribute("href", `/make/github?choose=1&game=${slug}`);
  await showTheOwner(page, testInfo, "question 3, connected, nothing chosen on GitHub");
});

// ---- The how-to page ---------------------------------------------------------------------------------------------

test("the how-to page is plain steps, and leads back to her question", async ({ page }) => {
  const { slug } = await startAtFiles(page);

  await page.getByRole("link", { name: "Here's how to put your game there" }).click();

  await expect(page).toHaveURL(/\/help\/github\?from=/);
  await expect(page.getByRole("heading", { name: "Put your game on GitHub" })).toBeVisible();
  await expect(page.getByRole("listitem")).toHaveCount(5);
  await expect(page.getByText("Make a free account at github.com.")).toBeVisible();
  await expect(page.getByText("Come back to Ruken and choose Connect GitHub.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Set up your game's folder" })).toBeVisible();
  await expect(page.locator("#folder")).toBeAttached();

  await page.getByRole("link", { name: "Back to your game" }).first().click();
  await expect(page).toHaveURL(`/make/${slug}/files`);
});

test("the how-to page needs no account", async ({ page }) => {
  await page.goto("/help/github");

  await expect(page).toHaveURL("/help/github");
  await expect(page.getByRole("heading", { name: "Put your game on GitHub" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to Ruken" })).toHaveAttribute("href", "/");
});

test("the how-to page will not send anyone to another site", async ({ page }) => {
  for (const from of ["https://example.com", "//example.com", "/\\example.com"]) {
    await page.goto(`/help/github?from=${encodeURIComponent(from)}`);
    await expect(page.getByRole("link", { name: "Back to Ruken" })).toHaveAttribute("href", "/");
  }
});
