import { expect, test } from "@playwright/test";
import { rgb, token } from "../support/look-tokens.ts";
import {
  continueToPayment,
  finishSignUpForm,
  freshNumber,
  pageHasSettled,
  signUp,
} from "./support/account.ts";
import { addGame } from "./support/game.ts";
import { boxOf, expectFrame, expectOneCard, pipRed, showTheOwner } from "./support/look.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

test.beforeEach(forgetRateLimits);

const RENEWS = "Renews until you cancel. You can cancel any time from your account.";

// The Owner, 2026-11-14, "All six" (a design review of the newest screens).
test("the card says the price, that it renews, and what happens next", async ({ page }) => {
  await page.goto("/join");
  await expect(page.getByRole("heading", { name: "Join Ruken to play" })).toBeVisible();
  // The prices are in the two rows, once each; the line above them says only about tax (the Owner, "All six").
  await expect(page.getByText("Tax is added where it applies.", { exact: true })).toBeVisible();
  await expect(page.getByText("$9.99 a month")).toHaveCount(1);
  await expect(page.getByText("$99 a year")).toHaveCount(1);
  await expect(page.getByText(RENEWS)).toBeVisible();
  // Signed out, the next page is sign-up, so the card says the two steps in their order.
  await expect(
    page.getByText("First you make an account, then you pay. Then you come straight back."),
  ).toBeVisible();
  await expect(page.getByText("You pay on the next page")).toHaveCount(0);
  await expect(page.getByRole("button")).toHaveCount(1);
});

test("signed in, the card says the renewal and that the next page is payment", async ({ page }) => {
  await signUp(page);
  await page.goto("/join");
  await expect(page.getByText(RENEWS)).toBeVisible();
  await expect(page.getByText("You pay on the next page, then come straight back.")).toBeVisible();
  await expect(page.getByText("First you make an account")).toHaveCount(0);
});

test("the two plans are full-width rows of real radio buttons, each with its price once", async ({
  page,
}) => {
  await page.goto("/join");
  const monthly = page.getByRole("radio", { name: "$9.99 a month", exact: true });
  const annual = page.getByRole("radio", { name: "$99 a year", exact: true });
  // The card opens on the monthly price, and the other is one tap away.
  await expect(monthly).toBeChecked();
  await expect(annual).not.toBeChecked();
  await expect(page.getByText(/Monthly|Yearly/)).toHaveCount(0);

  // The paper half of the card, which holds the plans (on a computer it sits beside the title).
  const card = await boxOf(page.locator("main.card .cardbody"));
  const monthlyRow = await boxOf(page.locator("label", { has: monthly }));
  const annualRow = await boxOf(page.locator("label", { has: annual }));
  for (const row of [monthlyRow, annualRow]) {
    // As wide as the card's inside (its padding is at most 2rem a side) and as tall as a button.
    expect(row.width).toBeGreaterThanOrEqual(card.width - 2 * 32 - 1);
    expect(row.height).toBeGreaterThanOrEqual(48);
  }
  expect(annualRow.x).toBeCloseTo(monthlyRow.x, 0);
  expect(annualRow.width).toBeCloseTo(monthlyRow.width, 0);
  expect(annualRow.y).toBeGreaterThanOrEqual(monthlyRow.y + monthlyRow.height);
});

test("pressing anywhere on a plan's row picks it", async ({ page }) => {
  await page.goto("/join");
  const annualRow = page.locator("label", { has: page.getByRole("radio", { name: "$99 a year" }) });
  const box = await boxOf(annualRow);
  // The far end of the row, well away from the little circle and the words.
  await annualRow.click({ position: { x: box.width - 6, y: box.height / 2 } });
  await expect(page.getByRole("radio", { name: "$99 a year" })).toBeChecked();
  await expect(page.getByRole("radio", { name: "$9.99 a month" })).not.toBeChecked();
});

// A journey failed once in CI (slice 2's run 222, computer): the yearly plan was lost on the way to sign-up. The card set
// each radio button from the plan in the address, and when the page came alive that put the monthly plan back over a
// choice made a moment before. A person on a slow phone can do the same. This holds the page's scripts back, picks the
// plan on the page as the server sent it, lets the scripts run, and checks the choice is still there and still sent.
test("a plan picked before the page has come alive is kept when it does", async ({ page }) => {
  let release: () => void = () => undefined;
  const scriptsMayRun = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(/\.m?js(\?.*)?$/, async (route) => {
    await scriptsMayRun;
    await route.continue();
  });
  // The scripts are held, so the page never finishes loading: the server's page is all there is to wait for.
  await page.goto("/join?next=/me", { waitUntil: "commit" });
  await page.getByRole("radio", { name: "$99 a year" }).check();
  release();
  // SvelteKit adds its screen-reader announcer to the page once the app has started and the page has come alive
  // (hydrated), so its arrival says the scripts have run. It is the page's own sign, not a quiet network or a pause.
  await expect(page.locator("#svelte-announcer")).toBeAttached();
  await expect(page.getByRole("radio", { name: "$99 a year" })).toBeChecked();
  await expect(page.getByRole("radio", { name: "$9.99 a month" })).not.toBeChecked();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/sign-up\?next=.*plan%3Dannual/);
});

test("a signed-out person is asked to sign up only after pressing Continue, and keeps their plan", async ({
  page,
}) => {
  await page.goto("/join?next=/me");
  await page.getByRole("radio", { name: "$99 a year" }).check();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/sign-up\?next=/);

  await finishSignUpForm(page, freshNumber());

  // Back on the same card, with the plan still chosen, and now the button that spends money.
  await expect(page).toHaveURL(/\/join\?/);
  await expect(page.getByRole("radio", { name: "$99 a year" })).toBeChecked();
  await expect(page.getByRole("button", { name: "Continue to payment" })).toBeVisible();
});

test("Continue to payment opens the payment page", async ({ page }) => {
  await signUp(page);
  await page.goto("/join");
  // The stand-in Stripe's page, with its one button.
  await continueToPayment(page);
});

test("next pointing off the site is ignored", async ({ page }) => {
  await page.goto("/join?next=//evil.example");
  await expect(page.getByRole("link", { name: "Not now" })).toHaveAttribute("href", "/");
  await expect(page.locator('input[name="next"]')).toHaveValue("/");
  await page.goto("/join?next=https://evil.example");
  await expect(page.locator('input[name="next"]')).toHaveValue("/");
});

// As the Owner changed it (2026-11-14, "I want it to stand out, but red seems bad", then "go with D"):
// the paid button is Blue with white words, and no button is red. The pip mark is not built yet, so nothing is.
test("Continue to payment is Blue with white words, and nothing on the card is red", async ({
  page,
}, testInfo) => {
  await page.goto("/join");
  await expect(page.getByRole("button", { name: "Continue" })).toBeVisible();
  expect(await pipRed(page)).toEqual([]);

  await signUp(page);
  await page.goto("/join");
  const pay = page.getByRole("button", { name: "Continue to payment" });
  await expect(pay).toBeVisible();
  expect(await pipRed(page)).toEqual([]);
  await expect(pay).toHaveCSS("background-color", rgb(token("--pay")));
  await expect(pay).toHaveCSS("color", rgb(token("--chalk")));
  await showTheOwner(page, testInfo, "the paywall card, signed in");
});

test("Not now goes back to the game the person came from, and to the front page from anywhere else", async ({
  page,
}) => {
  await page.goto("/join?next=/g/some-game/play");
  await expect(page.getByRole("link", { name: "Not now" })).toHaveAttribute("href", "/g/some-game");
  await page.goto("/join?next=/me");
  await expect(page.getByRole("link", { name: "Not now" })).toHaveAttribute("href", "/");
});

// The card over the clip (design 5.3): a stranger who presses Play on a game meets the card with that game's clip, dimmed,
// behind it. The card itself does not change.
test.describe("the card over a game's clip", () => {
  let game: Awaited<ReturnType<typeof addGame>>;
  test.beforeAll(async ({ browser, request }) => {
    test.setTimeout(120_000);
    game = await addGame(browser, request);
  });

  test("a stranger who presses Play meets the card over that game's clip", async ({ page }, testInfo) => {
    await page.goto(`/g/${game.slug}`, { waitUntil: "domcontentloaded" });
    // A press while the page is still coming alive can be lost (seen in WebKit, run 44951754611, phone).
    await pageHasSettled(page);
    await page.getByRole("link", { name: "Play" }).click();
    await expect(page.getByRole("heading", { name: "Join Ruken to play" })).toBeVisible();
    await expect(page).toHaveURL(/\/join\?next=/);

    const clip = page.locator(".behindcard video");
    await expect(clip).toHaveCount(1);
    await expectFrame(clip);
    // Where a video may move by itself (quiet-video.ts), the clip is playing, in the window's own shape.
    const mayPlay = await page.evaluate(() => {
      const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
      return !matchMedia("(prefers-reduced-motion: reduce)").matches && (memory === undefined || memory >= 4);
    });
    if (mayPlay) {
      await expect.poll(() => clip.evaluate((video: HTMLVideoElement) => video.paused)).toBe(false);
    }
    await expect(page.locator(".behindcard")).toHaveAttribute("aria-hidden", "true");
    await expect(clip).toHaveAttribute("tabindex", "-1");
    await expect(page.locator(".behindcard")).toHaveCSS("pointer-events", "none");
    // The play menu's dim over it, frosted: the darkest felt at 62%, and what is behind a little blurred.
    const dim = await page.locator(".behindcard").evaluate((node) => {
      const after = getComputedStyle(node, "::after");
      return `${after.backgroundColor}|${after.backdropFilter || after.getPropertyValue("-webkit-backdrop-filter")}`;
    });
    expect(dim).toBe(
      `${rgb(token("--felt-deep")).replace("rgb(", "rgba(").replace(")", ", 0.62)")}|blur(6px)`,
    );

    // The card is the same card, above the clip.
    await expectOneCard(page);
    await expect(page.getByRole("button")).toHaveCount(1);
    // Tab goes to the card's own controls, never to the clip.
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => document.activeElement?.closest(".behindcard") ?? null)).toBeNull();
    await showTheOwner(page, testInfo, "the price card over a clip");

    await page.getByRole("link", { name: "Not now" }).click();
    await expect(page).toHaveURL(new RegExp(`/g/${game.slug}$`));
  });

  test("the game's own page address puts the same clip behind the card", async ({ page }) => {
    await page.goto(`/join?next=${encodeURIComponent(`/g/${game.slug}`)}`);
    await expect(page.locator(".behindcard video")).toHaveCount(1);
    await page.getByRole("link", { name: "Not now" }).click();
    await expect(page).toHaveURL(new RegExp(`/g/${game.slug}$`));
  });

  test.describe("any other address has no clip", () => {
    for (const next of ["/me", "/g/no-such-game/play", "/g/x/play/beat"]) {
      test(`next=${next}`, async ({ page }) => {
        const answer = await page.goto(`/join?next=${encodeURIComponent(next)}`);
        expect(answer?.status()).toBe(200);
        await expect(page.getByRole("heading", { name: "Join Ruken to play" })).toBeVisible();
        await expect(page.locator("video")).toHaveCount(0);
        await expectOneCard(page);
      });
    }
  });
});
