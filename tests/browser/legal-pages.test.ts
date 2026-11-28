import { expect, test } from "@playwright/test";

// The privacy and terms pages: anyone can read them without an account, each says at the top that a lawyer has not
// checked it yet, the terms list what no game may have (pornography, gambling, ads), and a person finds them from
// sign-up, from each other and from the maker agreement's own page.

test("privacy opens for anyone, says it is a draft, and leads to the terms", async ({ page }) => {
  await page.goto("/privacy");
  await expect(page.getByRole("heading", { level: 1, name: "Privacy" })).toBeVisible();
  await expect(page).toHaveTitle("Privacy · Ruken");
  await expect(page.getByText("This is a draft.")).toBeVisible();
  await expect(page.getByText("A lawyer has not checked it yet.", { exact: false })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Cookies and your browser" })).toBeVisible();
  await expect(
    page.getByText("Ruken has no ads, and no game on Ruken may have ads.", { exact: false }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Read the terms" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Terms" })).toBeVisible();
});

test("privacy lists the name you give, the address made from it, that your page is not public, and the nickname ask", async ({
  page,
}) => {
  await page.goto("/privacy");
  await expect(page.getByText("The name you give when you join.", { exact: false })).toBeVisible();
  await expect(page.getByText("We make one from your name", { exact: false })).toBeVisible();
  await expect(page.getByText("Your page is not public yet.", { exact: false })).toBeVisible();
  await expect(
    page.getByText("When you join, we ask you to use a nickname, not your full name.", { exact: false }),
  ).toBeVisible();
});

test("terms open for anyone, say they are a draft, and lead to the maker agreement and to privacy", async ({
  page,
}) => {
  await page.goto("/terms");
  await expect(page.getByRole("heading", { level: 1, name: "Terms" })).toBeVisible();
  await expect(page).toHaveTitle("Terms · Ruken");
  await expect(page.getByText("This is a draft.")).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Waiting for a lawyer" })).toBeVisible();
  const rules = page.getByRole("heading", { level: 2, name: "What no game may have" }).locator("+ ul");
  await expect(rules.getByRole("listitem")).toHaveText([
    "No pornography.",
    "No gambling.",
    "No ads. A game can't show ads of any kind.",
  ]);
  await expect(page.getByRole("link", { name: "Read the maker agreement" })).toHaveAttribute(
    "href",
    "/legal/maker-agreement",
  );
  await page.getByRole("link", { name: "Read what we keep about you" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Privacy" })).toBeVisible();
  await page.getByRole("link", { name: "Back to Ruken" }).first().click();
  await expect(page).toHaveURL("/");
});

test("sign-up links to the terms and to privacy, and the keyboard alone reaches them", async ({ page }) => {
  await page.goto("/sign-up");
  await expect(page.getByRole("heading", { name: "Join Ruken", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "privacy page" })).toHaveAttribute("href", "/privacy");
  const terms = page.getByRole("link", { name: "terms", exact: true });
  await expect(terms).toHaveAttribute("href", "/terms");
  await terms.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 1, name: "Terms" })).toBeVisible();
});
