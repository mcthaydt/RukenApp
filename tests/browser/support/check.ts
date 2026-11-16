import { expect, type Locator, type Page } from "@playwright/test";

// How the journeys move through staff's check of a game: two screens (the game and its parts, then who it's for with the decision),
// one form, and a blue button that says Next until the last.

export const heading = (page: Page): Locator => page.getByRole("heading", { level: 1 });
export const nextButton = (page: Page): Locator => page.getByRole("button", { name: "Next", exact: true });
/** The blue button that decides: it exists only on the last screen. */
export const decideButton = (page: Page, words: string | RegExp): Locator =>
  page.getByRole("button", { name: words });

/** A part's own block: on the first screen, found by its title; who it's for is on the decision's screen. */
export const partBox = (page: Page, title: string): Locator =>
  title === "Who it's for"
    ? page.locator("#part-age_rating")
    : page.locator(".part", { has: page.getByRole("heading", { level: 2, name: title, exact: true }) });

/** The tick on a part. */
export const tickOn = (page: Page, title: string): Locator =>
  partBox(page, title).getByRole("checkbox", {
    name: title === "Who it's for" ? "The maker's age pick is wrong" : "This is wrong",
  });

/** The part's own place, on screen: the first screen holds every part but who it's for. */
export async function onPart(page: Page, title: string): Promise<void> {
  if (title === "Who it's for") await toTheDecision(page);
  else await partBox(page, title).scrollIntoViewIfNeeded();
}

/** Staff press Next up to the decision: its blue button says Accept or Send back. */
export async function toTheDecision(page: Page): Promise<void> {
  for (let presses = 0; presses < 4; presses += 1) {
    if ((await nextButton(page).count()) === 0) return;
    const before = (await heading(page).innerText()).trim();
    await nextButton(page).click();
    await expect(heading(page)).not.toHaveText(before);
  }
}
