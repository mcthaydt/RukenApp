import { expect, test } from "@playwright/test";
import { token } from "../support/look-tokens.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

// Ruken's own corner (the owner, 2026-11-24): every rounded corner is drawn in one soft shape whose curve starts
// far out and melts into the edge, and a button keeps most of its ends straight. The browsers
// the journeys run (Chromium and Safari's engine) both draw it, so here it must be the drawn shape, not the fallback.

test.beforeEach(forgetRateLimits);

test("a card, its buttons and the glass bar are drawn in Ruken's own corner shape", async ({ page }) => {
  await page.goto("/sign-up");
  const send = page.getByRole("button", { name: "Text me a code" });
  await expect(send).toBeVisible();
  const card = page.locator("main.card");
  const bar = page.getByRole("navigation", { name: "Ruken" });

  for (const [thing, radius] of [
    [card, "--radius-card"],
    [send, "--radius-button"],
  ] as const) {
    await expect(thing).toHaveCSS("corner-top-left-shape", token("--corner-shape"));
    await expect(thing).toHaveCSS("corner-bottom-right-shape", token("--corner-shape"));
    await expect(thing).toHaveCSS("border-top-left-radius", token(radius));
  }
  await expect(bar).toHaveCSS("corner-top-left-shape", token("--corner-shape"));

  // Not a pill (the owner, 2026-11-27: "make them less rounded"): the corners reach a quarter of its height or less, so
  // most of each end is straight.
  const height = (await send.boundingBox())?.height ?? 0;
  expect(Number.parseFloat(token("--radius-button"))).toBeLessThanOrEqual(height / 4);
});
