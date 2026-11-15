import { expect, test } from "@playwright/test";
import { signUp, standInPayButton } from "./support/account.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

test.beforeEach(forgetRateLimits);

// The journeys wait for the stand-in's "Pay" button, then read the checkout's id from the page's address. A name of
// "Pay" also fits the card's own "Continue to payment" (a name matches as a part of the words), so on a slow
// browser the wait ended on the card, the address was still the card's, and the journey asked the stand-in about a
// checkout that does not exist (WebKit, run 43657290538, rejoin.test.ts:38). The card's request is held here, as a
// slow browser holds it, until the journey has looked.

test("while the payment page is on its way, the card's own button is not the stand-in's Pay button", async ({
  page,
}) => {
  await signUp(page);
  await page.goto("/join");

  let requestReached!: () => void;
  const reached = new Promise<void>((resolve) => (requestReached = resolve));
  let letItGo!: () => void;
  const gate = new Promise<void>((resolve) => (letItGo = resolve));
  await page.route(
    (url) => url.pathname === "/join",
    async (route) => {
      if (route.request().method() !== "POST") return route.fallback();
      requestReached();
      await gate;
      return route.fallback();
    },
  );

  // The press does not wait for the page change it starts: that page is held, and a press that waited for it
  // would time out before this journey has looked.
  const pressed = page.getByRole("button", { name: "Continue to payment" }).click({ noWaitAfter: true });
  try {
    await reached;
    await expect(page.getByRole("button", { name: "Continue to payment" })).toBeVisible();
    await expect(standInPayButton(page)).toHaveCount(0);
  } finally {
    letItGo();
    await pressed;
  }
  await expect(standInPayButton(page)).toBeVisible();
  expect(new URL(page.url()).pathname).toMatch(/^\/pay\/cs_test_\d+$/);
});
