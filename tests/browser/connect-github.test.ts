import { expect, test } from "@playwright/test";
import { signUp } from "./support/account.ts";
import { connectStateFor, githubConnectionOf, userIdOf } from "./support/database.ts";

// A maker connects their GitHub on the site and the site remembers which repositories GitHub says they can reach. The
// stand-in GitHub (support/fake-github-server.ts) holds one installation with three repositories the app can read, two
// of them listed for the person. `/make/new` itself arrives in a later task, so until then it is a 404 page, and
// `toHaveURL` still holds for it.

test("connecting GitHub comes back with the maker's repositories remembered", async ({ page }) => {
  const maker = await signUp(page);

  await page.goto("/make/github");

  await expect(page).toHaveURL("/make/new");
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

  await expect(page).toHaveURL("/make/new");
  expect(await githubConnectionOf(maker.email)).toMatchObject([{ installationId: 1n }]);
});

test("a callback with a state nobody started is refused, and nothing is remembered", async ({ page }) => {
  const maker = await signUp(page);

  await page.goto("/make/github/callback?code=test-code&state=made-up");

  await expect(page).toHaveURL("/make/new?github=failed");
  expect(await githubConnectionOf(maker.email)).toEqual([]);
});

// The state travels through GitHub in an address, so it must open only for the account that started it.
test("a state that another account started is refused, and nothing is remembered", async ({ page }) => {
  const maker = await signUp(page);

  await page.goto(
    `/make/github/callback?code=test-code&state=${encodeURIComponent(connectStateFor("another-account"))}`,
  );

  await expect(page).toHaveURL("/make/new?github=failed");
  expect(await githubConnectionOf(maker.email)).toEqual([]);
});

test("a callback with no code is refused", async ({ page }) => {
  const maker = await signUp(page);
  const state = connectStateFor(await userIdOf(maker.email));

  await page.goto(`/make/github/callback?state=${encodeURIComponent(state)}`);

  await expect(page).toHaveURL("/make/new?github=failed");
  expect(await githubConnectionOf(maker.email)).toEqual([]);
});

test("signed out, connecting asks for sign-in first", async ({ page }) => {
  await page.goto("/make/github");

  await expect(page).toHaveURL("/sign-in?next=%2Fmake%2Fgithub");
});
