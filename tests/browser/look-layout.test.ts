import { expect, test, type Locator, type Page } from "@playwright/test";
import { rgb, token } from "../support/look-tokens.ts";
import { shownAs } from "../../src/features/accounts/phone.ts";
import { freshNumber, nationalOf, signUp } from "./support/account.ts";
import { boxOf, CARD_SCREENS, startsWithFamily, wordsHaveSettled, type Box } from "./support/look.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

// The Owner looked at the screenshots of branch L ("fix all the issues", 2026-11-14). These journeys pin what
// the look fixes changed: spacing, left edges, tap targets, the way home and the words on a few screens.
// Every distance is measured from the page itself, in px at the usual text size.

test.beforeEach(forgetRateLimits);

const bottomOf = (box: Box): number => box.y + box.height;

/** The text of an element only, from its first letter's edge: an element's own box may start earlier. */
function textLeft(thing: Locator): Promise<number> {
  return thing.evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    return range.getBoundingClientRect().x;
  });
}

/**
 * Opens a screen and waits until its words have stopped moving by themselves. Two boxes here are read one after the other,
 * and a heading on the edge of wrapping changes height when its face arrives, so a pair read across that moment is a
 * heading's line apart. Run 43763535891 (phone-webkit) read the sign-up note 35.19px, one card-title line, from its field.
 */
async function visit(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await wordsHaveSettled(page);
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
    await visit(page, "/sign-up");
    const field = await boxOf(page.getByLabel("Phone number"));
    const legend = page.getByText("Date of birth", { exact: true });
    closeTo(await textLeft(legend), field.x, 0.5);
    const passwordNote = await boxOf(page.getByText("At least 10 characters."));
    closeTo((await boxOf(legend)).y - bottomOf(passwordNote), 16);
  });

  test("both notes sit the same small step under what they explain", async ({ page }) => {
    await visit(page, "/sign-up");
    const passwordNote = await boxOf(page.getByText("At least 10 characters."));
    const password = await boxOf(page.getByLabel("Password"));
    closeTo(passwordNote.y - bottomOf(password), 6);
    const birthdayNote = await boxOf(page.getByText("We only check that you're 13 or older."));
    const year = await boxOf(page.getByLabel("Year"));
    closeTo(birthdayNote.y - bottomOf(year), 6);
  });

  test("the question has half a rem of air above Month, Day and Year", async ({ page }) => {
    await visit(page, "/sign-up");
    const legend = await boxOf(page.getByText("Date of birth", { exact: true }));
    const row = await boxOf(page.locator(".row"));
    closeTo(row.y - bottomOf(legend), 8);
  });

  test("Month, Day and Year say what goes in them", async ({ page }) => {
    await visit(page, "/sign-up");
    await expect(page.getByLabel("Month")).toHaveAttribute("placeholder", "MM");
    await expect(page.getByLabel("Day")).toHaveAttribute("placeholder", "DD");
    await expect(page.getByLabel("Year")).toHaveAttribute("placeholder", "YYYY");
  });
});

test.describe("your account", () => {
  // The owner, 2026-11-23: "this is ugly, arrange this better", then "beside the number we can have a green or red badge".
  // The number with its badge and the one membership button first; then the side links stacked as → links; then Sign
  // out and Delete at the foot.
  test("the number is printed once with a red Not a member badge beside it, and the side links stacked as arrow links", async ({
    page,
  }) => {
    const { number } = await signUp(page);
    await visit(page, "/me");
    const shown = page.getByText(shownAs(number), { exact: true });
    await expect(shown).toHaveCount(1);
    const badge = page.locator(".badged .badge", { hasText: "Not a member" });
    await expect(badge).toHaveCSS("background-color", rgb(token("--pip")));
    const numberBox = await boxOf(shown);
    const beside = await boxOf(badge);
    // On the number's line: the badge's middle is level with the number's middle, and it starts after it.
    closeTo(beside.y + beside.height / 2, numberBox.y + numberBox.height / 2, 2);
    expect(beside.x).toBeGreaterThan(numberBox.x);
    await expect(page.getByText("You're not a member.")).toHaveCount(0);
    const names = ["Add your games to Ruken", "Change password", "Your computers", "What is Ruken?"];
    let above = bottomOf(await boxOf(page.getByRole("link", { name: "Join Ruken" })));
    for (const name of names) {
      const link = page.locator("ul.sidelinks a.go", { hasText: name });
      const box = await boxOf(link);
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.y).toBeGreaterThanOrEqual(above);
      above = bottomOf(box);
    }
    expect((await boxOf(page.getByRole("button", { name: "Sign out" }))).y).toBeGreaterThanOrEqual(above);
  });

  // The Owner, 2026-11-14, "All six": two tap targets that overlap are one wrong tap from deleting an account.
  test("Sign out and Delete my account have room between them, so their tap areas do not overlap", async ({
    page,
  }) => {
    await signUp(page);
    await visit(page, "/me");
    const signOut = await boxOf(page.getByRole("button", { name: "Sign out" }));
    const remove = await boxOf(page.getByRole("link", { name: "Delete my account" }));
    expect(signOut.height).toBeGreaterThanOrEqual(48);
    expect(remove.height).toBeGreaterThanOrEqual(48);
    expect(remove.y).toBeGreaterThanOrEqual(bottomOf(signOut));
  });

  test("a quiet button is never stretched across the card", async ({ page }) => {
    await signUp(page);
    await visit(page, "/me");
    const card = await boxOf(page.locator("main.card"));
    const quiet = await boxOf(page.getByRole("button", { name: "Sign out" }));
    expect(quiet.width).toBeLessThan(card.width / 2);
  });
});

test.describe("a link on its own line", () => {
  const LINKS = [
    { screen: "/sign-in", name: "Forgot your password?" },
    { screen: "/sign-in", name: "Create an account" },
    { screen: "/sign-up", name: "Sign in" },
    { screen: "/forgot-password", name: "Back to sign in" },
  ];

  for (const { screen, name } of LINKS) {
    test(`${name} on ${screen} is as easy to tap as a button`, async ({ page }) => {
      await visit(page, screen);
      const link = page.getByRole("link", { name, exact: true });
      await expect(link).toBeVisible();
      expect((await boxOf(link)).height).toBeGreaterThanOrEqual(48);
    });
  }

  // Each is a real button now (the owner, 2026-11-22: no underlined words as buttons), so its line is the button's own
  // height: a rem from the form, and a rem from the next line, with nothing overlapping.
  test("a bigger target does not open holes: a rem between each line", async ({ page }) => {
    await visit(page, "/sign-in");
    const form = await boxOf(page.locator("main.card form"));
    const forgotLine = await boxOf(
      page.locator("p", { has: page.getByRole("link", { name: "Forgot your password?" }) }),
    );
    const createLine = await boxOf(
      page.locator("p", { has: page.getByRole("link", { name: "Create an account" }) }),
    );
    closeTo(forgotLine.y - bottomOf(form), 16);
    closeTo(createLine.y - bottomOf(forgotLine), 16);
  });
});

test.describe("new password", () => {
  test("says how long it must be, and has a way back to sign in", async ({ page }) => {
    await visit(page, "/forgot-password");
    await page.getByLabel("Phone number").fill(nationalOf(freshNumber()));
    await page.getByRole("button", { name: "Text me a code" }).click();
    await expect(page.getByRole("heading", { name: "Choose a new password" })).toBeVisible();
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
      await expect(wordmark).toHaveCSS("font-family", startsWithFamily("Young Serif"));
      await expect(wordmark).toHaveCSS("color", rgb(token("--chalk")));
      await expect(wordmark).toHaveCSS("text-decoration-line", "none");
      const mark = await boxOf(wordmark);
      expect(mark.height).toBeGreaterThanOrEqual(48);
      expect(bottomOf(mark)).toBeLessThanOrEqual((await boxOf(page.locator("main.card"))).y);
    });
  }

  test("pressing it goes home", async ({ page }) => {
    await visit(page, "/sign-in");
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
  for (const path of ["/no-such-page"]) {
    test(`${path}: spans the card on a phone, and is only as wide as its words on a computer`, async ({
      page,
    }) => {
      // The missing page's button, like the main button of every form on a phone (Owner, 2026-11-14).
      await visit(page, path);
      const button = page.locator("main.card a.button");
      await expect(button).toBeVisible();
      const heading = await boxOf(page.getByRole("heading", { level: 1 }));
      const box = await boxOf(button);
      if (wide(page)) expect(box.width).toBeLessThan(heading.width / 2);
      else closeTo(box.width, heading.width);
    });
  }
});

test.describe("the card", () => {
  test("a heading breaks into even lines", async ({ page }) => {
    await visit(page, "/sign-up");
    await expect(page.getByRole("heading", { name: "Join Ruken", exact: true })).toHaveCSS(
      "text-wrap-style",
      "balance",
    );
  });

  test("the heading is a step and a half from what follows, and so is the main button from its field", async ({
    page,
  }) => {
    await visit(page, "/sign-in");
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
    await visit(page, "/sign-in");
    const form = await boxOf(page.locator("main.card form"));
    const button = await boxOf(page.getByRole("button", { name: "Sign in" }));
    if (wide(page)) expect(button.width).toBeLessThan(form.width / 2);
    else closeTo(button.width, form.width);
  });

  test("a field has an edge in ink, easy to see on paper", async ({ page }) => {
    await visit(page, "/sign-in");
    await expect(page.getByLabel("Phone number")).toHaveCSS("border-top-color", rgb(token("--ink")));
  });
});
