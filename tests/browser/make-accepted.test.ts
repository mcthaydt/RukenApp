import { expect, test } from "@playwright/test";
import { forgetRateLimits } from "./support/rate-limits.ts";
import { letDecisionDayIn } from "./support/database.ts";
import { gameWhere } from "./support/game.ts";
import { showTheOwner } from "./support/look.ts";

// The Accepted screen (spec 5.2) and the label on Your games (5.3). The journeys run with decision day off, so a game a
// decision day let in is written into the rows as the release leaves it (letDecisionDayIn).

test.beforeEach(forgetRateLimits);

test("a game a decision day let in opens on You're in, once, and the button goes on to Live", async ({
  page,
}, testInfo) => {
  const { slug, name } = await gameWhere(page, { state: "waiting" });
  await letDecisionDayIn(slug);

  await page.goto(`/make/${slug}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("You're in.");
  await expect(page.getByText(`${name} is live on Ruken.`)).toBeVisible();
  await expect(page.getByText("It's the one game that got in this week.")).toBeVisible();
  await showTheOwner(page, testInfo, "You're in (Accepted)");

  // By keyboard alone: the button takes focus with Tab and Enter presses it.
  await page.getByRole("button", { name: "See your game" }).focus();
  await expect(page.getByRole("button", { name: "See your game" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(`/make/${slug}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Live");

  // Seen once: opening it again is Live.
  await page.goto(`/make/${slug}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Live");
});

test("opening a game's address is not seeing the screen: only the button uses it up", async ({ page }) => {
  const { slug } = await gameWhere(page, { state: "waiting" });
  await letDecisionDayIn(slug);

  await page.goto(`/make/${slug}`);
  await page.goto(`/make/${slug}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("You're in.");
});

test("a game that was live before, or that is live at once, opens on Live", async ({ page }) => {
  const { slug } = await gameWhere(page, { state: "live" });
  await page.goto(`/make/${slug}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Live");
});

// The journeys share one database, so how many games are decided depends on which ran before: the label is either line.
// Which one, and the rate itself, are the service tests' (acceptance.pg.test.ts, acceptance.test.ts).
test("Your games has the label at the top", async ({ page }, testInfo) => {
  await gameWhere(page, { state: "live" });
  await page.goto("/make");
  await expect(page.locator("[data-acceptance]")).toHaveText(
    /^(A person checks every game\.|\d+% of games get in\.)$/,
  );
  await showTheOwner(page, testInfo, "Your games, with the label");
});
