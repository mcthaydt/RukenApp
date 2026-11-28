import { expect, test, type Browser, type BrowserContext, type Locator, type Page } from "@playwright/test";
import { answerTheName, freshNumber, pageHasSettled, startSignUpForm } from "./support/account.ts";
import { consented } from "./support/consent.ts";
import { changeGame, followsOf, makeDeletionDue, pageOfId, pageOfNumber, sentTo, userIdOf } from "./support/database.ts";
import { gameWhere } from "./support/game.ts";
import { asInstalled } from "./support/installed.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";
import { codeTo } from "./support/texts.ts";

// Two people who only signed up, with no page given by a test helper: the page sign-up made from each name is enough to
// follow each other from a clip, be friends, send a game from the share sheet and find it on Your turn. Then one of them
// deletes the account, and the daily job takes their page with it.

const SITE = "http://localhost:4173";
const SECRET = "test-only-jobs-secret";

interface Person {
  context: BrowserContext;
  page: Page;
  number: string;
  name: string;
  game: { slug: string; name: string };
}

const games: { slug: string; name: string }[] = [];

test.beforeAll(async ({ browser }) => {
  test.setTimeout(240_000);
  for (let made = 0; made < 2; made += 1) {
    await forgetRateLimits();
    const context = await browser.newContext({ ...consented, baseURL: SITE });
    try {
      games.push(await gameWhere(await context.newPage(), { state: "live" }));
    } finally {
      await context.close();
    }
  }
});
test.beforeEach(forgetRateLimits);

/** A person who signs up in a browser of their own, answers the name question, and is given one of the live games. */
async function signsUp(browser: Browser, name: string, game: { slug: string; name: string }): Promise<Person> {
  const context = await browser.newContext({ ...consented, baseURL: SITE });
  const page = await context.newPage();
  await asInstalled(page);
  const number = freshNumber();
  await page.goto("/sign-up");
  await startSignUpForm(page, number);
  await page.getByLabel("The code we texted you").fill(await codeTo(number));
  await page.getByRole("button", { name: "Join Ruken" }).click();
  await answerTheName(page, name);
  await expect(page).toHaveURL("/");
  await pageHasSettled(page);
  await changeGame(game.slug, { makerUserId: await userIdOf(number) });
  return { context, page, number, name, game };
}

/** Brings a game's first clip on the feed to the screen. */
async function clipOn(page: Page, slug: string): Promise<Locator> {
  await page.goto("/");
  await expect(page.locator("main.feed")).toHaveAttribute("data-ready", "true");
  const clip = page.locator(`section[data-slug="${slug}"]`).first();
  await clip.scrollIntoViewIfNeeded();
  return clip;
}

/** Follows the maker of this game from the plus on its clip. */
async function followFromClip(page: Page, slug: string, maker: string): Promise<void> {
  const clip = await clipOn(page, slug);
  const plus = clip.getByRole("button", { name: `Follow ${maker}` });
  await expect(plus).toHaveAttribute("aria-pressed", "false");
  await plus.click();
  await expect(plus).toHaveAttribute("aria-pressed", "true");
}

test("two people who only signed up follow each other, send a game and find it on Your turn; deleting takes the page", async ({
  browser,
  page: unused,
}) => {
  test.setTimeout(240_000);
  await unused.close();
  const [gameA, gameB] = games;
  if (gameA === undefined || gameB === undefined) throw new Error("no games made");
  const tag = String(Date.now()).slice(-5);
  const ada = await signsUp(browser, `Ada ${tag}`, gameA);
  const bo = await signsUp(browser, `Bo ${tag}`, gameB);
  try {
    const boPage = await pageOfNumber(bo.number);
    expect(boPage).toMatchObject({ name: bo.name, listed: false });

    // A follows B from B's clip, where B's name is words, not a link to an address that is not there.
    const clip = await clipOn(ada.page, bo.game.slug);
    await expect(clip.locator(".credit")).toContainText(bo.name);
    await expect(clip.locator(".credit a")).toHaveCount(0);
    await followFromClip(ada.page, bo.game.slug, bo.name);
    // B follows A back: now they are friends.
    await followFromClip(bo.page, ada.game.slug, ada.name);
    await expect.poll(() => followsOf(ada.number)).toEqual([boPage?.handle]);

    // A sees B's face in the share sheet's Your turn and sends B's own game.
    await ada.page.goto(`/g/${bo.game.slug}`, { waitUntil: "domcontentloaded" });
    await pageHasSettled(ada.page);
    await ada.page.getByRole("button", { name: "Share" }).click();
    const sheet = ada.page.getByRole("dialog", { name: /^(Share|Send to friends)$/ });
    await sheet.getByRole("button", { name: "Your turn", exact: true }).click();
    await sheet.getByRole("button", { name: bo.name, exact: true }).click();
    await sheet.getByRole("button", { name: "Send", exact: true }).click();
    await expect(sheet.getByRole("status")).toHaveText(`Sent to ${bo.name}.`);
    expect(await sentTo(bo.number)).toEqual([{ game: bo.game.slug, seen: false }]);

    // B finds it on Your turn, under A's name.
    await bo.page.goto("/your-turn");
    await pageHasSettled(bo.page);
    await expect(bo.page.locator("main.yourturn li").filter({ hasText: bo.game.name })).toContainText(
      `From ${ada.name}`,
    );

    // B deletes the account; once the 14 days have passed, the daily job removes B's page with it.
    const boId = await userIdOf(bo.number);
    await bo.page.goto("/me");
    await bo.page.getByRole("link", { name: "Delete my account" }).click();
    await bo.page.getByRole("button", { name: "Delete my account" }).click();
    await expect(bo.page.getByRole("heading", { name: "Your account will be deleted." })).toBeVisible();
    await makeDeletionDue(bo.number);
    const job = await ada.page.request.post("/jobs/purge-accounts", {
      headers: { "content-type": "application/json", authorization: `Bearer ${SECRET}` },
    });
    expect(job.status()).toBe(200);
    await expect.poll(() => pageOfId(boId)).toBeNull();
  } finally {
    await ada.context.close();
    await bo.context.close();
  }
});
