import { expect, test, type Locator, type Page } from "@playwright/test";
import { rgb, token } from "../support/look-tokens.ts";
import { signUp } from "./support/account.ts";
import { boxOf, CARD_SCREENS, type Box } from "./support/look.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

// The Owner looked at the screenshots of branch L ("fix all the issues", 2026-11-14). These journeys pin what
// the look fixes changed: spacing, left edges, tap targets, the way home and the words on a few screens.
// Every distance is measured from the page itself, in px at the usual text size.

test.beforeEach(forgetRateLimits);

const bottomOf = (box: Box): number => box.y + box.height;

/**
 * The air a 48px target adds above and below its words. A link or a quiet button is as tall as a button, but
 * its words are one line, so the rest is split above and below them.
 */
async function airAround(target: Locator): Promise<number> {
  const lineHeight = await target.evaluate((element) => parseFloat(getComputedStyle(element).lineHeight));
  return ((await boxOf(target)).height - lineHeight) / 2;
}

/** The text of an element only, from its first letter's edge: an element's own box may start earlier. */
function textLeft(thing: Locator): Promise<number> {
  return thing.evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    return range.getBoundingClientRect().x;
  });
}

function closeTo(actual: number, expected: number, within = 1): void {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(within);
}

// Where a window is wide enough for the computer's look (design 5.8: 48rem).
function wide(page: Page): boolean {
  return (page.viewportSize()?.width ?? 0) >= 768;
}

test.describe("sign up", () => {
  test("the birthday question starts where the fields start, a rem under the password note", async ({
    page,
  }) => {
    await page.goto("/sign-up");
    const email = await boxOf(page.getByLabel("Email"));
    const legend = page.getByText("When were you born?");
    closeTo(await textLeft(legend), email.x, 0.5);
    const passwordNote = await boxOf(page.getByText("At least 10 characters."));
    closeTo((await boxOf(legend)).y - bottomOf(passwordNote), 16);
  });

  test("both notes sit the same small step under what they explain", async ({ page }) => {
    await page.goto("/sign-up");
    const passwordNote = await boxOf(page.getByText("At least 10 characters."));
    const password = await boxOf(page.getByLabel("Password"));
    closeTo(passwordNote.y - bottomOf(password), 6);
    const birthdayNote = await boxOf(page.getByText("We only check that you're 13 or older."));
    const year = await boxOf(page.getByLabel("Year"));
    closeTo(birthdayNote.y - bottomOf(year), 6);
  });

  test("the question has half a rem of air above Month, Day and Year", async ({ page }) => {
    await page.goto("/sign-up");
    const legend = await boxOf(page.getByText("When were you born?"));
    const row = await boxOf(page.locator(".row"));
    closeTo(row.y - bottomOf(legend), 8);
  });

  test("Month, Day and Year say what goes in them", async ({ page }) => {
    await page.goto("/sign-up");
    await expect(page.getByLabel("Month")).toHaveAttribute("placeholder", "MM");
    await expect(page.getByLabel("Day")).toHaveAttribute("placeholder", "DD");
    await expect(page.getByLabel("Year")).toHaveAttribute("placeholder", "YYYY");
  });
});

test.describe("your account", () => {
  test("the address is printed once, and the line under it says what to do", async ({ page }) => {
    const { email } = await signUp(page);
    await page.goto("/me");
    await expect(page.getByText(email)).toHaveCount(1);
    await expect(page.getByText("Confirm your email. We sent you a link.", { exact: true })).toBeVisible();
  });

  test("'Send it again' starts where the words above it start, and sits a rem under them", async ({
    page,
  }) => {
    await signUp(page);
    await page.goto("/me");
    const heading = await boxOf(page.getByRole("heading", { name: "Your account" }));
    const again = page.getByRole("button", { name: "Send it again" });
    const box = await boxOf(again);
    closeTo(box.x, heading.x, 0.5);
    expect(box.height).toBeGreaterThanOrEqual(48);
    const air = await airAround(again);
    const line = await boxOf(page.getByText("Confirm your email. We sent you a link.", { exact: true }));
    closeTo(box.y + air - bottomOf(line), 16);
    // And what follows it, now the membership line, comes at the same rhythm: no hole below the button.
    const membership = await boxOf(page.getByText("You're not a member.", { exact: true }));
    closeTo(membership.y - (bottomOf(box) - air), 16);
  });

  // The Owner, 2026-11-14, "All six": two tap targets that overlap are one wrong tap from deleting an account.
  test("Sign out and Delete my account have room between them, so their tap areas do not overlap", async ({
    page,
  }) => {
    await signUp(page);
    await page.goto("/me");
    const signOut = await boxOf(page.getByRole("button", { name: "Sign out" }));
    const remove = await boxOf(page.getByRole("link", { name: "Delete my account" }));
    expect(signOut.height).toBeGreaterThanOrEqual(48);
    expect(remove.height).toBeGreaterThanOrEqual(48);
    expect(remove.y).toBeGreaterThanOrEqual(bottomOf(signOut));
  });

  test("a quiet button is never stretched across the card", async ({ page }) => {
    await signUp(page);
    await page.goto("/me");
    const card = await boxOf(page.locator("main.card"));
    const again = await boxOf(page.getByRole("button", { name: "Send it again" }));
    expect(again.width).toBeLessThan(card.width / 2);
  });
});

test.describe("a link on its own line", () => {
  const LINKS = [
    { screen: "/sign-in", name: "Forgot your password?" },
    { screen: "/sign-in", name: "Create an account" },
    { screen: "/sign-up", name: "Sign in" },
    { screen: "/forgot-password", name: "Back to sign in" },
    { screen: "/reset-password?token=nope", name: "Back to sign in" },
  ];

  for (const { screen, name } of LINKS) {
    test(`${name} on ${screen} is as easy to tap as a button`, async ({ page }) => {
      await page.goto(screen);
      const link = page.getByRole("link", { name, exact: true });
      await expect(link).toBeVisible();
      expect((await boxOf(link)).height).toBeGreaterThanOrEqual(48);
    });
  }

  test("a bigger target does not open holes: the words keep a rem between lines", async ({ page }) => {
    await page.goto("/sign-in");
    const form = await boxOf(page.locator("main.card form"));
    const forgot = page.getByRole("link", { name: "Forgot your password?" });
    const create = page.getByRole("link", { name: "Create an account" });
    const air = await airAround(forgot);
    const forgotBox = await boxOf(forgot);
    closeTo(forgotBox.y + air - bottomOf(form), 16);
    const createBox = await boxOf(create);
    closeTo(createBox.y + (await airAround(create)) - (bottomOf(forgotBox) - air), 16);
  });
});

test.describe("new password", () => {
  test("says how long it must be, and has a way back to sign in", async ({ page }) => {
    await page.goto("/reset-password?token=nope");
    await expect(page.getByText("At least 10 characters.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to sign in" })).toHaveAttribute("href", "/sign-in");
  });
});

test.describe("every card screen has a way home", () => {
  for (const screen of CARD_SCREENS) {
    test(`${screen.name}: a Ruken wordmark above the card`, async ({ page }) => {
      await screen.open(page);
      const wordmark = page.getByRole("link", { name: "Ruken", exact: true });
      await expect(wordmark).toHaveAttribute("href", "/");
      await expect(wordmark).toHaveCSS("font-family", /^"Young Serif"/);
      await expect(wordmark).toHaveCSS("color", rgb(token("--chalk")));
      await expect(wordmark).toHaveCSS("text-decoration-line", "none");
      const mark = await boxOf(wordmark);
      expect(mark.height).toBeGreaterThanOrEqual(48);
      expect(bottomOf(mark)).toBeLessThanOrEqual((await boxOf(page.locator("main.card"))).y);
    });
  }

  test("pressing it goes home", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByRole("link", { name: "Ruken", exact: true }).click();
    await expect(page).toHaveURL("/");
  });

  test("the wordmark and the card are at the same height on every screen, so nothing jumps between screens", async ({
    page,
  }) => {
    // Owner, 2026-11-14: top-aligned, not centred up and down, on a computer.
    const places: { screen: string; mark: number; card: number }[] = [];
    for (const screen of CARD_SCREENS) {
      await screen.open(page);
      const mark = await boxOf(page.getByRole("link", { name: "Ruken", exact: true }));
      const card = await boxOf(page.locator("main.card"));
      places.push({ screen: screen.name, mark: mark.y, card: card.y });
    }
    const first = places[0];
    for (const place of places) {
      closeTo(place.mark, first?.mark ?? 0, 0.5);
      closeTo(place.card, first?.card ?? 0, 0.5);
    }
  });
});

test.describe("a link that looks like a button", () => {
  for (const path of ["/no-such-page", "/reset-password?token=nope"]) {
    test(`${path}: spans the card on a phone, and is only as wide as its words on a computer`, async ({
      page,
    }) => {
      // The missing page's button, like the main button of every form on a phone (Owner, 2026-11-14).
      await page.goto(path);
      if (path.startsWith("/reset")) {
        await page.getByLabel("New password").fill("a long enough password");
        await page.getByLabel("Type it again").fill("a long enough password");
        await page.getByRole("button", { name: "Save password" }).click();
      }
      const button = page.locator("main.card a.button");
      await expect(button).toBeVisible();
      const heading = await boxOf(page.getByRole("heading", { level: 1 }));
      const box = await boxOf(button);
      if (wide(page)) expect(box.width).toBeLessThan(heading.width / 2);
      else closeTo(box.width, heading.width);
    });
  }
});

test.describe("home", () => {
  test("a Sign in button under the line, the paper button on felt", async ({ page }) => {
    await page.goto("/");
    const button = page.getByRole("link", { name: "Sign in", exact: true });
    await expect(button).toHaveAttribute("href", "/sign-in");
    await expect(button).toHaveCSS("background-color", rgb(token("--paper")));
    await expect(button).toHaveCSS("color", rgb(token("--ink")));
    const box = await boxOf(button);
    expect(box.height).toBeGreaterThanOrEqual(48);
    const line = await boxOf(page.getByText("Games, one swipe at a time. Coming soon."));
    expect(box.y).toBeGreaterThanOrEqual(bottomOf(line));
  });

  test("the heading is the name already, so there is no second Ruken above it", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Ruken", exact: true })).toHaveCount(0);
  });

  test("someone already signed in is not asked to sign in", async ({ page }) => {
    await signUp(page);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Ruken" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign in", exact: true })).toHaveCount(0);
  });
});

test.describe("the card", () => {
  test("a heading breaks into even lines", async ({ page }) => {
    await page.goto("/sign-up");
    await expect(page.getByRole("heading", { name: "Create your account" })).toHaveCSS(
      "text-wrap-style",
      "balance",
    );
  });

  test("the heading is a step and a half from what follows, and so is the main button from its field", async ({
    page,
  }) => {
    await page.goto("/sign-in");
    const heading = await boxOf(page.getByRole("heading", { name: "Sign in" }));
    const form = await boxOf(page.locator("main.card form"));
    closeTo(form.y - bottomOf(heading), 24);
    const password = await boxOf(page.getByLabel("Password"));
    const button = await boxOf(page.getByRole("button", { name: "Sign in" }));
    closeTo(button.y - bottomOf(password), 24);
  });

  test("on a phone the main button spans the card; on a computer it is only as wide as its words", async ({
    page,
  }) => {
    await page.goto("/sign-in");
    const form = await boxOf(page.locator("main.card form"));
    const button = await boxOf(page.getByRole("button", { name: "Sign in" }));
    if (wide(page)) expect(button.width).toBeLessThan(form.width / 2);
    else closeTo(button.width, form.width);
  });

  test("a field has an edge in ink, easy to see on paper", async ({ page }) => {
    await page.goto("/sign-in");
    await expect(page.getByLabel("Email")).toHaveCSS("border-top-color", rgb(token("--ink")));
  });
});
