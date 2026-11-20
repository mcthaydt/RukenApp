import { expect, test } from "@playwright/test";
import { rgb, token } from "../support/look-tokens.ts";
import { pageHasSettled } from "./support/account.ts";
import { fillAnswers } from "./support/database.ts";
import {
  addDraft,
  agreeToTheAgreement,
  answerAge,
  answerEveryQuestion,
  holdAnswersTo,
  nextButton,
  startAtCheck,
  startDraft,
} from "./support/game.ts";
import { boxOf, showTheOwner } from "./support/look.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

// The last two screens before a game is sent: the maker agreement (a maker's first game only) and Check and send, where
// the game is laid out as members will see it (spec 3, 5, 5a note 2, 5b). The sizes of both are in make-look.test.ts.

test.beforeEach(forgetRateLimits);

const AGREEMENT_VERSION_LINE = "Version 2 · Last updated 15 November 2026";

test("a first game: six questions, the agreement, Check and send, then Waiting for review", async ({
  page,
}, testInfo) => {
  const { slug } = await answerEveryQuestion(page);

  // Six questions, then the agreement, which only a first game meets.
  await expect(page).toHaveURL(`/make/${slug}/agreement`);
  await expect(page.getByText("Almost done")).toBeVisible();
  await showTheOwner(page, testInfo, "the maker agreement, first game");
  await page.getByRole("button", { name: "I agree" }).click();

  await expect(page).toHaveURL(`/make/${slug}/check`);
  await expect(page.getByText("Last step")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Check it, then send");
  await expect(page.getByRole("button", { name: "Send for review" })).toHaveCSS(
    "background-color",
    rgb(token("--pay")),
  );
  await showTheOwner(page, testInfo, "Check and send");
  await page.getByRole("button", { name: "Send for review" }).click();

  await expect(page).toHaveURL(`/make/${slug}`);
  await expect(page.getByRole("heading", { name: "Waiting for review" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to your games" })).toHaveCSS(
    "background-color",
    rgb(token("--pay")),
  );
  await showTheOwner(page, testInfo, "Waiting for review, after sending");
});

test("the agreement is shown whole, with its version and date, and one button", async ({
  page,
}, testInfo) => {
  const { slug } = await startDraft(page);
  await fillAnswers(slug, { files: true, videos: true, age: "age_12" });

  // A game with every answer in is taken from Check and send to the agreement, since this maker has not agreed.
  await page.goto(`/make/${slug}/check`);
  await expect(page).toHaveURL(`/make/${slug}/agreement`);
  await pageHasSettled(page);

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Maker agreement");
  await expect(page.getByText(AGREEMENT_VERSION_LINE)).toBeVisible();
  await expect(page.locator(".sheet li")).toHaveCount(7);
  await expect(page.locator(".sheet li").first()).toContainText("Your game stays yours.");
  // No tick box, no fold-out and no link out: pressing "I agree" is the agreeing.
  await expect(page.locator('input[type="checkbox"]')).toHaveCount(0);
  await expect(page.locator("details")).toHaveCount(0);
  await expect(page.getByRole("button")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "I agree" })).toHaveCSS(
    "background-color",
    rgb(token("--pay")),
  );
  await expect(page.getByRole("link", { name: "Back", exact: true })).toHaveCSS(
    "background-color",
    rgb(token("--felt-raised")),
  );
  await showTheOwner(page, testInfo, "the maker agreement");

  // Back is the last question, with its answer in place.
  await page.getByRole("link", { name: "Back", exact: true }).click();
  await expect(page).toHaveURL(`/make/${slug}/age`);
});

test("I agree is the agreeing, and a second game is not asked again", async ({ page }) => {
  const first = await startDraft(page);
  await fillAnswers(first.slug, { files: true, videos: true, age: "age_12" });
  await agreeToTheAgreement(page, first.slug);

  // The second game goes from its last question straight to Check and send.
  const second = await addDraft(page);
  await fillAnswers(second.slug, { files: true, videos: true });
  await page.goto(`/make/${second.slug}/age`);
  await pageHasSettled(page);
  await answerAge(page, "12+");

  await expect(page).toHaveURL(`/make/${second.slug}/check`);
  // Nor is the agreement offered again, by its own address.
  await page.goto(`/make/${second.slug}/agreement`);
  await expect(page).toHaveURL(`/make/${second.slug}/check`);
});

test("Check and send lays the game out: two videos, its name and line, and three chips", async ({
  page,
}, testInfo) => {
  const { name } = await startAtCheck(page);

  await expect(page.getByText("On phones", { exact: true })).toBeVisible();
  await expect(page.getByText("On computers", { exact: true })).toBeVisible();
  await expect(page.locator(".tiles video")).toHaveCount(2);
  await expect(page.getByRole("heading", { level: 2, name })).toBeVisible();
  await expect(page.locator(".tagline")).toHaveText("A tiny game about tapping.");
  const chips = page.locator(".chip");
  await expect(chips).toHaveText(["ruken-test/tiny-game", "12+", "Uses no other websites"]);
  // Sizes and counts are not for a maker to weigh up here.
  await expect(page.getByText(/\d+ files?|\bKB\b|\bMB\b/)).toHaveCount(0);
  // Every game has to work on both, so it is said once, above Send for review, and never asked.
  const rule = page.getByText("Your game must work on phones and computers.");
  await expect(rule).toBeVisible();
  await expect(page.getByText("Plays on", { exact: false })).toHaveCount(0);
  const ruleBox = await boxOf(rule);
  const sendBox = await boxOf(page.getByRole("button", { name: "Send for review" }));
  expect(ruleBox.y).toBeLessThan(sendBox.y);
  await showTheOwner(page, testInfo, "Check and send, the game laid out");
});

test("where a game plays is not a page: there is no such question", async ({ page }) => {
  const { slug } = await startAtCheck(page);
  const response = await page.goto(`/make/${slug}/plays-on`);
  expect(response?.status()).toBe(404);
});

test("an 18+ game's chip names its marks", async ({ page }) => {
  const { slug } = await startDraft(page);
  await fillAnswers(slug, { files: true, videos: true, age: "age_18" });
  await page.goto(`/make/${slug}/marks`);
  await pageHasSettled(page);
  await page.getByLabel("Gore").check();
  await nextButton(page).click();
  await expect(page).toHaveURL(`/make/${slug}/agreement`);
  await pageHasSettled(page);
  await page.getByRole("button", { name: "I agree" }).click();

  await expect(page).toHaveURL(`/make/${slug}/check`);
  await expect(page.locator(".chip", { hasText: "18+" })).toHaveText("18+ · Gore");
});

test("Change opens that one question, which says Save and comes straight back", async ({
  page,
}, testInfo) => {
  const { slug } = await startAtCheck(page);

  await page.getByRole("link", { name: "Change the line" }).click();

  await expect(page).toHaveURL(`/make/${slug}/line`);
  // A game being changed has no counter and no Next.
  await expect(page.getByText(/^Question \d of/)).toHaveCount(0);
  await expect(nextButton(page)).toHaveText("Save");
  await showTheOwner(page, testInfo, "question 2, being changed (Save)");
  const line = page.getByLabel(/about, in one line\?$/);
  await line.fill("Tap. Tap. Tap again.");
  await nextButton(page).click();

  await expect(page).toHaveURL(`/make/${slug}/check`);
  await expect(page.locator(".tagline")).toHaveText("Tap. Tap. Tap again.");
});

test("the websites chip opens the websites question, and a name that is not a website is refused in its own words", async ({
  page,
}, testInfo) => {
  const { slug, name } = await answerEveryQuestion(page);
  await agreeToTheAgreement(page, slug);

  await page.getByRole("link", { name: "Change the other websites" }).click();

  await expect(page).toHaveURL(`/make/${slug}/websites`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Does ${name} use other websites?`);
  await expect(
    page.getByText("One per line, like api.example.com. Leave this empty if your game runs on its own."),
  ).toBeVisible();
  const box = page.getByLabel(`Does ${name} use other websites?`);
  await showTheOwner(page, testInfo, "the websites question, nothing typed");
  await box.fill("not a website");
  await nextButton(page).click();
  await expect(
    page.getByText("Write each website like api.example.com, one per line. Five at most."),
  ).toBeVisible();
  await expect(box).toHaveValue("not a website");
  await showTheOwner(page, testInfo, "the websites question, refused");

  await box.fill("API.example.com");
  await showTheOwner(page, testInfo, "the websites question, a website typed");
  await nextButton(page).click();
  await expect(page).toHaveURL(`/make/${slug}/check`);
  await expect(page.locator(".chip", { hasText: "api.example.com" })).toHaveText("Uses api.example.com");
});

test("Check and send opened with a question unanswered leads to that question", async ({ page }) => {
  const { slug } = await startDraft(page);
  // Everything but the two videos is in: the upright one is the first question not answered.
  await fillAnswers(slug, { files: true });

  await page.goto(`/make/${slug}/check`);
  await expect(page).toHaveURL(`/make/${slug}/upright`);
  await page.goto(`/make/${slug}/agreement`);
  await expect(page).toHaveURL(`/make/${slug}/upright`);
});

test("while a game is sent the button says so and cannot be pressed again", async ({ page }) => {
  const { slug } = await startAtCheck(page);
  const held = await holdAnswersTo(page, /\?\/send/);

  const send = page.getByRole("button", { name: "Send for review" });
  await send.click();

  const sending = page.getByRole("button", { name: "Sending your game…" });
  await expect(sending).toBeDisabled();
  held.release();
  await expect(page).toHaveURL(`/make/${slug}`);
  expect(held.requestsSoFar()).toBe(1);
});

// Sending is the one step a maker cannot take back for herself, so only a press on the button does it: the page does not
// ask her to press Enter, and Enter with nothing in reach does nothing.
test("on Check and send only a press on the button sends: no Enter hint, and Enter alone does nothing", async ({
  page,
}) => {
  const { slug } = await startAtCheck(page);
  await page.goto(`/make/${slug}/check`);
  await pageHasSettled(page);
  const held = await holdAnswersTo(page, /\?\/send/);

  await expect(page.getByText("press Enter")).toHaveCount(0);
  await page.keyboard.press("Enter");
  await page.getByRole("heading", { level: 1 }).click();
  await page.keyboard.press("Enter");

  expect(held.requestsSoFar()).toBe(0);
  await expect(page.getByRole("button", { name: "Send for review" })).toBeVisible();
});

test("a send posted by hand before the agreement is refused", async ({ page, baseURL }) => {
  const { slug } = await startDraft(page);
  await fillAnswers(slug, { files: true, videos: true, age: "age_12" });
  const site = baseURL ?? "http://localhost:4173";

  // The maker has not agreed, so the post is sent to the agreement and the game stays a draft.
  const posted = await page.request.post(`${site}/make/${slug}/check?/send`, {
    form: {},
    // A form post, as a browser makes it: asked for as a page, the answer is the redirect itself.
    headers: { origin: site, accept: "text/html" },
    maxRedirects: 0,
  });
  expect(posted.status()).toBe(303);
  expect(posted.headers()["location"]).toBe(`/make/${slug}/agreement`);
  await page.goto(`/make/${slug}`);
  await expect(page).toHaveURL(`/make/${slug}/agreement`);
});

test("the maker agreement stays a page anyone can read", async ({ page }) => {
  await page.goto("/legal/maker-agreement");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Maker agreement");
  await expect(page.getByText(AGREEMENT_VERSION_LINE)).toBeVisible();
  await expect(page.locator("li")).toHaveCount(7);
  await expect(page.getByRole("link", { name: "Back to your games" }).first()).toBeVisible();
});
