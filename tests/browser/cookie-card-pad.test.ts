import { expect, test, type Page } from "@playwright/test";
import { pageHasSettled } from "./support/account.ts";
import { NOT_CONSENTED } from "./support/consent.ts";
import { PAD, plugInPad, pressPad } from "./support/pad.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

// The cookie question with a gamepad alone (the owner, 2026-11-27: "everything should be fully navigable using a
// gamepad", and nobody is ever stuck). Before any answer the question is a card at the foot of every screen, or the
// whole screen when a press needs the yes (sign in): on each, the pad reaches I agree, Not now and What we keep, and A
// presses each one. Nothing is made here but the yes itself, which the cookie journeys create, read and take back.

const ANSWERS = ["I agree", "Not now", "What we keep"] as const;
type Answer = (typeof ANSWERS)[number];

const isAnswer = (name: string | null): name is Answer =>
  (ANSWERS as readonly (string | null)[]).includes(name);

/** Each screen a stranger can open first, and the place the question stands on it. */
const SCREENS = ["/followed", "/your-turn", "/search", "/make", "/help", "/privacy", "/sign-in"];

test.use({ storageState: NOT_CONSENTED });
test.beforeEach(async ({ page }) => {
  await forgetRateLimits();
  await plugInPad(page);
});

/** The focused control's name, as a person reads it. */
function focusedName(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const one = document.activeElement;
    if (!(one instanceof HTMLElement) || one === document.body) return null;
    return (one.getAttribute("aria-label") ?? one.innerText).trim().replaceAll(/\s+/g, " ");
  });
}

/**
 * On the feed up and down are its clips and its controls are one row (src/lib/pad-focus.ts), so a person goes right
 * along it: this does, from the first press, and gives each answer it lands on. With `stopAt` it stops the moment a
 * press lands on that answer, with the focus left there.
 */
async function rightAlongTheFeed(page: Page, stopAt: Answer | null = null): Promise<Set<Answer>> {
  await pageHasSettled(page);
  await page.mouse.move(0, 0);
  const found = new Set<Answer>();
  for (let step = 0; step < 40 && found.size < ANSWERS.length; step += 1) {
    await pressPad(page, PAD.right);
    expect(page.url(), "a move of the pad changed the page").toMatch(/\/$/);
    const name = await focusedName(page);
    if (isAnswer(name)) found.add(name);
    if (stopAt !== null && name === stopAt) break;
  }
  return found;
}

/** Goes right along the feed to the answer, and presses A on it. */
async function pressWithThePad(page: Page, wanted: Answer): Promise<void> {
  await page.goto("/");
  await rightAlongTheFeed(page, wanted);
  expect(await focusedName(page), `the pad never reaches ${wanted}`).toBe(wanted);
  await pressPad(page, PAD.a);
}

test("on the feed, the pad reaches I agree, Not now and What we keep", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "I agree" })).toBeVisible();
  expect([...(await rightAlongTheFeed(page))].sort()).toEqual([...ANSWERS].sort());
});

/**
 * Every answer the pad reaches, walked as `padReachesEverything` walks (tests/browser/support/pad.ts): from the first
 * press, every way from every control it has reached, each one focused again as a person last left it.
 */
async function answersThePadReaches(page: Page): Promise<string[]> {
  await pageHasSettled(page);
  await page.mouse.move(0, 0);
  const url = page.url();
  const mark = () =>
    page.evaluate(() => {
      const one = document.activeElement;
      if (!(one instanceof HTMLElement) || one === document.body) return null;
      if (!one.hasAttribute("data-pad-seen"))
        one.setAttribute("data-pad-seen", String(document.querySelectorAll("[data-pad-seen]").length));
      return one.getAttribute("data-pad-seen");
    });
  await pressPad(page, PAD.right);
  const first = await mark();
  expect(first, "the pad's first press focused nothing").not.toBeNull();
  const reached = new Set([first ?? ""]);
  const waiting = [first ?? ""];
  const found = new Set<string>();
  for (let from = waiting.shift(); from !== undefined; from = waiting.shift()) {
    for (const way of [PAD.up, PAD.down, PAD.left, PAD.right]) {
      await page.evaluate(
        (id) => document.querySelector<HTMLElement>(`[data-pad-seen="${id}"]`)?.focus(),
        from,
      );
      await pressPad(page, way);
      expect(page.url(), "a move of the pad changed the page").toBe(url);
      const name = await focusedName(page);
      if (isAnswer(name)) found.add(name);
      const landed = await mark();
      if (landed !== null && !reached.has(landed)) {
        reached.add(landed);
        waiting.push(landed);
      }
    }
  }
  return [...found].sort();
}

// Every other screen, the card or the whole-screen question (sign in).
for (const path of SCREENS) {
  test(`on ${path}, the pad reaches I agree, Not now and What we keep`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(path);
    await expect(page.getByRole("button", { name: "I agree" })).toBeVisible();
    expect(await answersThePadReaches(page), path).toEqual([...ANSWERS].sort());
  });
}

test("A on Not now puts the question away", async ({ page }) => {
  await pressWithThePad(page, "Not now");
  await expect(page.getByRole("button", { name: "I agree" })).toHaveCount(0);
});

test("A on What we keep opens it", async ({ page }) => {
  await pressWithThePad(page, "What we keep");
  await expect(page).toHaveURL("/privacy");
});

test("A on I agree keeps the yes", async ({ page, context }) => {
  await pressWithThePad(page, "I agree");
  await expect(page.getByRole("button", { name: "I agree" })).toHaveCount(0);
  await expect
    .poll(async () => (await context.cookies()).some((one) => one.name === "rk_consent"))
    .toBe(true);
});
