import { expect, test } from "@playwright/test";

// The privacy and terms pages: anyone can read them without an account, each says at the top that a lawyer has not
// checked it yet, and a person finds them from sign-up, from each other and from the maker agreement's own page.

test("privacy opens for anyone, says it is a draft, and leads to the terms", async ({ page }) => {
  await page.goto("/privacy");
  await expect(page.getByRole("heading", { level: 1, name: "Privacy" })).toBeVisible();
  await expect(page).toHaveTitle("Privacy · Ruken");
  await expect(page.getByText("This is a draft.")).toBeVisible();
  await expect(page.getByText("A lawyer has not checked it yet.", { exact: false })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Cookies and your browser" })).toBeVisible();
  await page.getByRole("link", { name: "Read the terms" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Terms" })).toBeVisible();
});

test("terms open for anyone, say they are a draft, and lead to the maker agreement and to privacy", async ({
  page,
}) => {
  await page.goto("/terms");
  await expect(page.getByRole("heading", { level: 1, name: "Terms" })).toBeVisible();
  await expect(page).toHaveTitle("Terms · Ruken");
  await expect(page.getByText("This is a draft.")).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Waiting for a lawyer" })).toBeVisible();
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
