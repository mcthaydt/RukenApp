import { expect, test, type Page } from "@playwright/test";
import { signUp } from "./support/account.ts";
import { expectOneCard, showTheOwner } from "./support/look.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

// The maker's area: the list of games, and the form that makes one. GitHub is the stand-in on this machine
// (support/fake-github-server.ts), which lists `ruken-test/broken-game` and `ruken-test/tiny-game` for the person.

// Every journey makes an account, and the site lets one address make five an hour; the counters are cleared before each.
test.beforeEach(forgetRateLimits);

/** Connects GitHub through the stand-in, which sends the maker to the new-game form. */
async function connectGitHub(page: Page): Promise<void> {
  await page.goto("/make/github");
  await expect(page).toHaveURL("/make/new");
}

/** A name no other journey has used, so its page address is its own. */
const freshName = () => `Tiny game ${crypto.randomUUID().slice(0, 8)}`;

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

  // The game's own page arrives in the next task; until then the address is a 404 page, and the address still holds.
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
