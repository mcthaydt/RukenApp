import { expect, test, type Page } from "@playwright/test";
import { pageHasSettled } from "./support/account.ts";
import { NOT_CONSENTED } from "./support/consent.ts";
import { PAD, padReachesEverything, plugInPad, pressPad } from "./support/pad.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

// The cookie question never stands in the way of reading what Ruken keeps (the owner, 2026-11-28: "Make sure the cookie
// question doesn't block the what we track"). The card asks in front of every other screen; its What we keep opens the
// page with no card and no dim, readable and usable by touch, wheel and pad, and the question waits until the person
// comes back to answer it. Nothing is made here but the yes, which cookie-consent.test.ts creates, reads and takes back.

test.use({ storageState: NOT_CONSENTED });
test.beforeEach(async ({ page }) => {
  await forgetRateLimits();
  await plugInPad(page);
});

const card = (page: Page) => page.locator("dialog.consent");

/** The focused control's words, as a person reads them. */
function focusedName(page: Page): Promise<string> {
  return page.evaluate(() => (document.activeElement as HTMLElement | null)?.innerText.trim() ?? "");
}

for (const start of ["/", "/help"]) {
  test(`from ${start}, the card's What we keep opens the page in full, and the question waits for the way back`, async ({
    page,
    context,
  }) => {
    await page.goto(start);
    await pageHasSettled(page);
    await expect(page.locator("dialog.consent:modal")).toBeVisible();

    // The pad goes down the card to What we keep, and A opens it.
    for (let moves = 0; moves < 6 && (await focusedName(page)) !== "What we keep"; moves += 1)
      await pressPad(page, PAD.down);
    expect(await focusedName(page)).toBe("What we keep");
    await pressPad(page, PAD.a);

    // The page in full: no card, nothing held in front of it, nothing dimmed.
    await expect(page).toHaveURL("/privacy");
    await expect(page.getByRole("heading", { name: "Privacy", level: 1 })).toBeVisible();
    await expect(card(page)).toHaveCount(0);
    await expect(page.locator("dialog:modal")).toHaveCount(0);
    // It scrolls by wheel to its end, where Read the terms is, once it has slid in (src/lib/page-moves).
    // Aimed at the middle of its column, which is centred on a computer and the whole width on a phone.
    const middle = await page.waitForFunction(() => {
      const main = document.querySelector("main");
      if (main === null) return null;
      const box = main.getBoundingClientRect();
      const x = box.left + box.width / 2;
      const y = Math.min(box.top + box.height / 2, innerHeight / 2);
      return document.elementFromPoint(x, y)?.closest("main") === main ? { x, y } : null;
    });
    const { x, y } = (await middle.jsonValue()) ?? { x: 0, y: 0 };
    await page.mouse.move(x, y);
    await page.mouse.wheel(0, 20_000);
    await expect(page.getByRole("link", { name: "Read the terms" })).toBeInViewport();
    // A tap presses its links: How the feed works opens, and the browser's Back comes back to What we keep.
    await page.getByRole("link", { name: "How the feed works" }).click();
    await expect(page).toHaveURL(/\/help\/how-the-feed-works/);
    await page.goBack();
    await expect(page).toHaveURL("/privacy");
    await expect(card(page)).toHaveCount(0);
    // The pad reaches every control on it.
    await padReachesEverything(page);

    // Back where they came from, the question waits there, in front, and the answer is kept.
    await page.goBack();
    await expect(page).toHaveURL(start);
    await expect(page.locator("dialog.consent:modal")).toBeVisible();
    await page.getByRole("button", { name: "I agree" }).click();
    await expect(card(page)).toHaveCount(0);
    expect((await context.cookies()).map((cookie) => cookie.name)).toContain("rk_consent");
  });
}
