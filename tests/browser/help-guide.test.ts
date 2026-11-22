import { expect, test } from "@playwright/test";
import { signUp } from "./support/account.ts";
import { showTheOwner } from "./support/look.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

// A maker who has never put a game on Ruken finds the step-by-step guide, copies the prompt for their AI helper, and
// finds their way to the other how-tos and back. The guide needs no account: a maker reads it before they have one.

test.beforeEach(forgetRateLimits);

const GUIDE = "/help/get-your-game-on-ruken";

/**
 * Keeps what the page puts on the clipboard where the test can read it. The browsers differ in whether a test may read
 * the real clipboard (WebKit never lets it), so the page's own call is recorded instead.
 */
async function recordTheClipboard(page: import("@playwright/test").Page): Promise<void> {
  await page.addInitScript(() => {
    const kept: string[] = [];
    Object.defineProperty(window, "copiedForTheTest", { value: kept });
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: (words: string) => {
          kept.push(words);
          return Promise.resolve();
        },
      },
    });
  });
}

async function copiedWords(page: import("@playwright/test").Page): Promise<string[]> {
  return page.evaluate(() => (window as unknown as { copiedForTheTest: string[] }).copiedForTheTest);
}

test("a new maker finds the guide from Your games and copies the prompt for their AI helper", async ({
  page,
}, testInfo) => {
  await recordTheClipboard(page);
  await signUp(page);
  await page.goto("/make");

  await page.getByRole("link", { name: "Here's how, step by step" }).click();

  await expect(page).toHaveURL(`${GUIDE}?from=%2Fmake`);
  await expect(page.getByRole("heading", { level: 1, name: "Get your game on Ruken" })).toBeVisible();
  for (const step of [
    "1. Join Ruken",
    "2. Add your game",
    "3. Check it, then send",
    "4. Wait for a person to look",
    "5. Players find it",
  ]) {
    await expect(page.getByRole("heading", { level: 3, name: step })).toBeVisible();
  }
  // The prompt is folded away until the maker opens it.
  const prompt = page.getByRole("region", { name: "The prompt for your AI helper" });
  await expect(prompt).toBeHidden();
  await page.getByText("Read the prompt").click();
  await expect(prompt).toContainText("Help me put my game on Ruken (ruken.io).");
  await expect(prompt).toContainText("press Add a game");
  await showTheOwner(page, testInfo, "the guide to getting a game on Ruken");

  // The keyboard alone reaches the one button and presses it.
  const copy = page.getByRole("button", { name: "Copy the prompt" });
  await copy.focus();
  await page.keyboard.press("Enter");

  await expect(page.getByRole("status")).toHaveText("Copied. Paste it into your AI helper.");
  const copied = await copiedWords(page);
  expect(copied).toHaveLength(1);
  // What lands on the clipboard is the whole prompt the page shows, word for word (the page's lists and paragraphs
  // become lines; only the spacing differs).
  const words = (text: string | null | undefined) =>
    (text ?? "")
      .replace(/^\s*(\d+\.|-)\s/gm, "")
      .replace(/\s+/g, " ")
      .trim();
  expect(words(copied[0])).toBe(words(await prompt.innerText()));

  // The way back is at the top and again at the foot, and goes to Your games.
  await expect(page.getByRole("link", { name: "Back to your games" })).toHaveCount(2);
  await page.getByRole("link", { name: "Back to your games" }).last().click();
  await expect(page).toHaveURL("/make");
});

test("when the browser won't copy, the guide says what still works", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: () => Promise.reject(new Error("refused")) },
    });
  });
  await page.goto(GUIDE);

  await page.getByRole("button", { name: "Copy the prompt" }).click();

  await expect(page.getByRole("status")).toHaveText(
    "We couldn't copy it. Open Read the prompt, then select the words and copy them yourself.",
  );
});

test("the guide needs no account, and its how-tos come back to it", async ({ page }) => {
  await page.goto("/help");

  await expect(page.getByRole("heading", { level: 1, name: "Help for makers" })).toBeVisible();
  await page.getByRole("link", { name: "Get your game on Ruken" }).click();
  await expect(page).toHaveURL(`${GUIDE}?from=%2Fhelp`);
  await expect(page.getByRole("link", { name: "Back to help" })).toHaveCount(2);

  await page.getByRole("link", { name: "Here's how to put it there" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Put your game on GitHub" })).toBeVisible();
  await page.getByRole("link", { name: "Back to the guide" }).first().click();
  await expect(page).toHaveURL(GUIDE);

  await page.getByRole("link", { name: "Here's how to record your screen" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Record your screen" })).toBeVisible();
  await page.getByRole("link", { name: "Back to the guide" }).last().click();
  await expect(page).toHaveURL(GUIDE);

  // Opened on its own, the way back is Ruken's front page.
  await expect(page.getByRole("link", { name: "Back to Ruken" })).toHaveCount(2);
});

test("every guide is listed on the help page and opens", async ({ page }) => {
  await page.goto("/help");
  const guides = page.getByRole("navigation", { name: "Guides" }).getByRole("link");
  await expect(guides).toHaveText([
    "Get your game on Ruken",
    "Put your game on GitHub",
    "Record your screen",
    "How the feed works",
  ]);
  // No guide on the list is underlined (the owner, 2026-11-22: "no text with underline links anywhere").
  for (const guide of await guides.all()) await expect(guide).toHaveCSS("text-decoration-line", "none");

  for (const name of ["Put your game on GitHub", "Record your screen", "How the feed works"]) {
    await page.goto("/help");
    await page.getByRole("link", { name }).click();
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to help" }).first()).toHaveAttribute("href", "/help");
  }
});

test("Your games always links to help", async ({ page }) => {
  await signUp(page);
  await page.goto("/make");

  await page.getByRole("link", { name: "Help for makers" }).click();

  await expect(page).toHaveURL("/help");
});
