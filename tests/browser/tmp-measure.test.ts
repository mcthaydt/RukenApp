// A one-off look at Your account on the phone, to be removed: where each control is and what lies at its middle.
import { test } from "@playwright/test";
import { signUp } from "./support/account.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

test("measure Your account's controls", async ({ page }) => {
  await forgetRateLimits();
  await signUp(page);
  await page.goto("/me");
  await page.waitForTimeout(1500);
  const rows = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("main a, main button")].map((a) => {
      const b = a.getBoundingClientRect();
      const hit = document.elementFromPoint((b.left + b.right) / 2, (b.top + b.bottom) / 2);
      return {
        text: a.innerText.trim(),
        box: [b.left, b.top, b.width, b.height].map(Math.round),
        rects: [...a.getClientRects()].map((r) => [r.left, r.top, r.width, r.height].map(Math.round)),
        hit: hit === null ? null : [hit.tagName, hit.className, hit.textContent.slice(0, 20)],
        visible: a.checkVisibility({ visibilityProperty: true }),
        display: [getComputedStyle(a).display, getComputedStyle(a.parentElement ?? a).display],
      };
    }),
  );
  const list = await page.evaluate(() => {
    const u = document.querySelector(".sidelinks");
    return u === null
      ? null
      : [
          u.getBoundingClientRect().width,
          getComputedStyle(u).display,
          getComputedStyle(u).flexFlow,
          innerWidth,
          innerHeight,
        ];
  });
  console.log(`MEASURE ${JSON.stringify({ rows, list })}`);
});
