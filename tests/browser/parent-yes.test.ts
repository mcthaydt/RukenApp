import { expect, test, type Page } from "@playwright/test";
import { freshNumber, nationalOf, pageHasSettled, signUp } from "./support/account.ts";
import { NOT_CONSENTED } from "./support/consent.ts";
import { ageParentAsks, makeThemUnder18, parentAsksOf } from "./support/database.ts";
import { showTheOwner } from "./support/look.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";
import { textTo } from "./support/texts.ts";

// A parent's yes (learned feed spec 6.5, unit I, journey I4): a teen asks a parent from Your feed, sees the ask waiting,
// the parent opens the texted link and says yes, the teen's feed starts learning, the parent turns it off, and the teen
// asks again and cancels; a link whose ask has ended says so. The parent's page needs no account, but it is a page a
// browser opens, so it asks for the cookie yes before it keeps an answer (I5).

test.beforeEach(forgetRateLimits);

const SITE = "http://localhost:4173";
const TEXT_STARTS = "Your teen Sam asked for a Ruken feed that learns what they like.";
const learnSwitch = (page: Page) => page.getByRole("switch", { name: /Learn from what I do/ });
const LOCKED = "Your feed doesn't learn from what you do until a parent says yes.";
const WAITING = "We texted your parent. Your feed starts learning when they say yes.";

async function openYourFeed(page: Page): Promise<void> {
  await page.goto("/settings/feed");
  await expect(page.getByRole("heading", { name: "Your feed", level: 1 })).toBeVisible();
  await pageHasSettled(page);
}

/** Asks a parent from Your feed, as the teen would, and answers the link the parent was texted. */
async function askAParent(page: Page, parent: string, shoot?: () => Promise<void>): Promise<string> {
  await openYourFeed(page);
  await page.getByRole("link", { name: "Ask a parent" }).click();
  await expect(page.getByRole("heading", { name: "Ask a parent", level: 1 })).toBeVisible();
  await pageHasSettled(page);
  await page.getByLabel("Your first name").fill("Sam");
  await page.getByLabel("Phone number").fill(nationalOf(parent));
  await shoot?.();
  await page.getByRole("button", { name: "Text my parent" }).click();
  await expect(page).toHaveURL("/settings/feed");
  await expect(page.getByText(WAITING)).toBeVisible();
  const text = await textTo(parent, TEXT_STARTS);
  const link = /Say yes or no: (\S+)$/.exec(text.body)?.[1];
  expect(link, "the text ends with the parent's link").toBeDefined();
  expect(link?.startsWith(`${SITE}/parent/`)).toBe(true);
  return link ?? "";
}

test("a teen asks a parent, the parent says yes and turns it off, and the teen asks again and cancels", async ({
  page,
  browser,
}, testInfo) => {
  test.setTimeout(150_000);
  const teen = await signUp(page);
  await makeThemUnder18(teen.number);
  const parent = freshNumber();

  // Create: the ask, from Your feed.
  await openYourFeed(page);
  await expect(page.getByText(LOCKED)).toBeVisible();
  await showTheOwner(page, testInfo, "Your feed, teen with Ask a parent");
  const link = await askAParent(page, parent, () => showTheOwner(page, testInfo, "Ask a parent"));

  // Read: the ask waits, and the feed still does not learn.
  await expect(learnSwitch(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Cancel the ask" })).toBeVisible();
  await showTheOwner(page, testInfo, "Your feed, waiting for a parent");

  // The parent's browser has never said yes to cookies: the link shows the notice first, and nothing is kept.
  const parentContext = await browser.newContext({ storageState: NOT_CONSENTED, baseURL: SITE });
  try {
    const parentPage = await parentContext.newPage();
    await parentPage.goto(link);
    const agree = parentPage.getByRole("button", { name: "I agree" });
    await expect(agree).toBeVisible();
    // A Yes sent straight from that browser, without the notice's yes, is sent to the notice and keeps nothing.
    const early = await parentContext.request.post(`${link}?/yes`, {
      // As a browser's own form sends it, so the answer is a page's redirect, not a script's.
      headers: { origin: SITE, accept: "text/html" },
      form: {},
      maxRedirects: 0,
    });
    expect(early.status()).toBe(303);
    expect(early.headers().location).toContain("/cookies");
    expect((await parentAsksOf(teen.number)).map((ask) => ask.answer)).toEqual([null]);
    await pageHasSettled(parentPage);
    await agree.click();

    // Update: the parent says yes.
    await expect(parentPage).toHaveURL(link);
    await expect(
      parentPage.getByText("Your teen asked for a Ruken feed that learns what they like."),
    ).toBeVisible();
    await pageHasSettled(parentPage);
    await showTheOwner(parentPage, testInfo, "A parent's page");
    await parentPage.getByRole("button", { name: "Yes" }).click();
    await expect(parentPage.getByText("You said yes. Their feed learns what they like.")).toBeVisible();
    await showTheOwner(parentPage, testInfo, "A parent's page, after Yes");

    // The teen's feed learns at once: the switch is on, and each clip offers More or less like this.
    await openYourFeed(page);
    await expect(learnSwitch(page)).toHaveAttribute("aria-checked", "true");
    await page.goto("/");
    await expect(page.getByRole("button", { name: "More or less like this" }).first()).toBeAttached();

    // Update: the parent turns it off, and the teen is back to the calm feed.
    await pageHasSettled(parentPage);
    await parentPage.getByRole("button", { name: "Turn it off" }).click();
    await expect(parentPage.getByText("It's off. Their feed doesn't learn from what they do.")).toBeVisible();
    await openYourFeed(page);
    await expect(page.getByText(LOCKED)).toBeVisible();
    await expect(learnSwitch(page)).toHaveCount(0);

    // Delete: the teen asks again and cancels; the cancelled ask's link says it has ended.
    const second = await askAParent(page, parent);
    await page.getByRole("button", { name: "Cancel the ask" }).click();
    await expect(page.getByRole("link", { name: "Ask a parent" })).toBeVisible();
    await expect(page.getByText(WAITING)).toHaveCount(0);
    await parentPage.goto(second);
    await expect(parentPage.getByText("This ask has ended.")).toBeVisible();
    await expect(parentPage.getByRole("button", { name: "Yes" })).toHaveCount(0);
    await showTheOwner(parentPage, testInfo, "A parent's page, ended");
  } finally {
    await parentContext.close();
  }
  const asks = await parentAsksOf(teen.number);
  expect(asks.map((ask) => [ask.answer, ask.revoked])).toEqual([
    ["yes", true],
    [null, true],
  ]);
});

test("an ask nobody answers ends after five days, and its link says so", async ({ page, browser }) => {
  const teen = await signUp(page);
  await makeThemUnder18(teen.number);
  const link = await askAParent(page, freshNumber());
  await ageParentAsks(teen.number, 6);
  await openYourFeed(page);
  await expect(page.getByRole("link", { name: "Ask a parent" })).toBeVisible();
  const parentContext = await browser.newContext({ baseURL: SITE });
  try {
    const parentPage = await parentContext.newPage();
    // A browser that said yes to cookies before, as most parents' will have by now.
    await parentContext.addCookies(
      (await page.context().cookies()).filter((cookie) => cookie.name === "rk_consent"),
    );
    await parentPage.goto(link);
    await expect(parentPage.getByText("This ask has ended.")).toBeVisible();
  } finally {
    await parentContext.close();
  }
});
