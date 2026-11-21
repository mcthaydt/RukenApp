import { expect, test } from "@playwright/test";
import { pageHasSettled } from "./support/account.ts";
import { forgetTheirRepositories, stateOf } from "./support/database.ts";
import {
  agreeToTheAgreement,
  answerEveryQuestion,
  nextButton,
  reviewJob,
  TINY_GAME,
} from "./support/game.ts";
import { showTheOwner } from "./support/look.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

// One game through everything a maker does to it, on the real screens: made and sent (create), let in and found by
// players (read), changed after it is live (update), and taken off (delete). Every step goes through the screens a
// person uses, so a step with no way through on screen fails here.

test.beforeEach(forgetRateLimits);

test("a maker makes a game, players find it, the maker changes it while it is live, then takes it off", async ({
  page,
  request,
  browser,
}, testInfo) => {
  test.setTimeout(120_000);

  // ---- Create: every question, the agreement and Send for review ----
  const { slug, name, maker } = await answerEveryQuestion(page);
  if (maker === undefined) throw new Error("a new maker was signed up, so there is an account");
  await agreeToTheAgreement(page, slug);
  await page.getByRole("button", { name: "Send for review" }).click();
  await expect(page).toHaveURL(`/make/${slug}`);
  await expect(page.getByRole("heading", { name: "Waiting for review" })).toBeVisible();

  // ---- Read: staff say yes, and the game is on its page and in the maker's list ----
  expect((await reviewJob(request, { do: "accept", game: slug }, browser)).status()).toBe(200);
  await page.goto(`/g/${slug}`);
  await pageHasSettled(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
  await page.goto("/make");
  await expect(page.locator(`a[href="/make/${slug}"]`)).toBeVisible();
  await page.goto(`/make/${slug}`);
  await pageHasSettled(page);
  // The first look after a yes is the Accepted screen, once.
  const seeIt = page.getByRole("button", { name: "See your game" });
  if (await seeIt.isVisible()) await seeIt.click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Live");

  // ---- Update: the line, then the files after GitHub stopped listing the game (what happened to Floor Fifty) ----
  await page.getByRole("link", { name: "Change the line" }).click();
  await expect(page).toHaveURL(`/make/${slug}/line`);
  await pageHasSettled(page);
  await page.getByLabel(/about, in one line\?$/).fill("Climb higher, fall further.");
  await nextButton(page).click();
  await expect(page).toHaveURL(`/make/${slug}`);
  await expect(page.locator(".laid .tagline")).toHaveText("Climb higher, fall further.");

  await forgetTheirRepositories(maker.number);
  await page.reload();
  await pageHasSettled(page);
  await page.getByRole("link", { name: "Change the game's files" }).click();
  await expect(page).toHaveURL(`/make/${slug}/files`);
  await pageHasSettled(page);
  await expect(page.getByText("Ruken can't see any of your games on GitHub yet.")).toBeVisible();
  await page.getByRole("link", { name: "Choose on GitHub" }).click();
  // GitHub sends her back to the same question, now with her games to pick from.
  await expect(page).toHaveURL(`/make/${slug}/files`);
  await pageHasSettled(page);
  await expect(page.getByText("Save copies your game from GitHub and sends it for review.")).toBeVisible();
  await showTheOwner(page, testInfo, "a live game's files being changed (Save)");
  await page.getByLabel(TINY_GAME).check();
  await page.getByRole("button", { name: "Save" }).click();

  // Saving copies the newest files and sends them for review; players keep the old ones meanwhile.
  await expect(page).toHaveURL(`/make/${slug}`, { timeout: 20_000 });
  await expect(page.getByText("Your update is waiting for review.")).toBeVisible();
  await showTheOwner(page, testInfo, "Live, after the files were changed");
  expect(await stateOf(slug)).toBe("live");

  // The websites go with the files, so a new list is copied and sent the same way.
  await page.getByRole("link", { name: "Change the other websites" }).click();
  await expect(page).toHaveURL(`/make/${slug}/websites`);
  await pageHasSettled(page);
  await page.getByRole("textbox").first().fill("api.example.com");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).toHaveURL(`/make/${slug}`, { timeout: 20_000 });
  await expect(page.locator(".laid .chip", { hasText: "Uses api.example.com" })).toBeVisible();
  await expect(page.getByText("Your update is waiting for review.")).toBeVisible();

  // ---- Delete: taken off Ruken, and players can no longer find it ----
  await page.getByRole("link", { name: "Take it off Ruken" }).click();
  await expect(page).toHaveURL(`/make/${slug}/take-off`);
  await pageHasSettled(page);
  await page.getByRole("button", { name: "Take it off Ruken" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Taken off Ruken");
  expect(await stateOf(slug)).toBe("taken_off");
  expect((await page.request.get(`/g/${slug}`)).status()).toBe(404);
});
