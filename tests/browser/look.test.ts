import { expect, test, type Locator, type Page } from "@playwright/test";
import { rgb, token } from "../support/look-tokens.ts";
import { signUp } from "./support/account.ts";
import { CARD_SCREENS, expectOneCard, pipRed, showTheOwner } from "./support/look.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

// Every journey starts as a new visitor (branch D's helper): the site's limits stay as they are, only the
// counters in the journeys' own database are cleared.
test.beforeEach(forgetRateLimits);

const FONT_FILES = [
  "/fonts/schibsted-grotesk-latin-400-normal.woff2",
  "/fonts/young-serif-latin-400-normal.woff2",
];

test("the page is felt, with chalk words in Young Serif", async ({ page, isMobile }) => {
  await page.goto("/");
  await expect(page.locator("body")).toHaveCSS("background-color", rgb(token("--felt")));
  const heading = page.getByRole("heading", { name: "Ruken" });
  await expect(heading).toHaveCSS("color", rgb(token("--chalk")));
  await expect(heading).toHaveCSS("font-family", /^"Young Serif"/);
  await expect(heading).toHaveCSS("font-size", isMobile ? "36px" : "64px");
  const line = page.getByText("Games, one swipe at a time. Coming soon.");
  await expect(line).toHaveCSS("font-family", /^"Young Serif"/);
  await expect(line).toHaveCSS("font-size", "24px");
  // The face is really loaded, not only named. (fonts.check() answers true for a family that has no face at
  // all, so it proves nothing; load() answers the faces themselves, and their status.)
  expect(
    await page.evaluate(async () =>
      (await document.fonts.load('400 32px "Young Serif"')).map((face) => face.status),
    ),
  ).toEqual(["loaded"]);
});

test("running text is Schibsted Grotesk, 18px at 1.55", async ({ page }) => {
  await page.goto("/sign-up");
  const label = page.getByText("Email", { exact: true });
  await expect(label).toHaveCSS("font-family", /^"Schibsted Grotesk"/);
  await expect(label).toHaveCSS("font-size", "18px");
  await expect(label).toHaveCSS("line-height", "27.9px");
});

test("the fonts come from Ruken's own address, and the page asks no other site for anything", async ({
  page,
}) => {
  const asked: { url: URL; kind: string }[] = [];
  page.on("request", (request) => asked.push({ url: new URL(request.url()), kind: request.resourceType() }));
  await page.goto("/sign-up");
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  const fonts = asked
    .filter((request) => request.kind === "font")
    .map((request) => request.url.pathname)
    .sort();
  expect(fonts).toEqual(expect.arrayContaining(FONT_FILES));
  expect(fonts.every((path) => path.startsWith("/fonts/"))).toBe(true);
  expect(asked.filter((request) => request.url.origin !== new URL(page.url()).origin)).toEqual([]);
});

test("a font file and its licence are served side by side", async ({ request }) => {
  const font = await request.get("/fonts/young-serif-latin-400-normal.woff2");
  expect(font.status()).toBe(200);
  expect(font.headers()["content-type"]).toContain("font/woff2");
  for (const licence of ["/fonts/young-serif-LICENSE.txt", "/fonts/schibsted-grotesk-LICENSE.txt"]) {
    const answer = await request.get(licence);
    expect(answer.status()).toBe(200);
    expect(await answer.text()).toContain("SIL Open Font License");
  }
});

test("the page still reads, with its button there to press, when the fonts do not arrive", async ({
  page,
}) => {
  await page.route("**/fonts/*.woff2", (route) => route.abort());
  await page.goto("/sign-up");
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create account" })).toBeEnabled();
});

for (const screen of CARD_SCREENS) {
  test(`${screen.name}: one paper card, one main button at most, no red, nothing sideways`, async ({
    page,
  }, testInfo) => {
    await screen.open(page);
    await expectOneCard(page);
    await showTheOwner(page, testInfo, screen.name);
  });
}

test("the home page sits on the felt, with no card and no red", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.locator(".card")).toHaveCount(0);
  expect(await pipRed(page)).toEqual([]);
  await showTheOwner(page, testInfo, "home");
});

test("the main button on a card is an ink pill with a paper label in Schibsted Grotesk 600", async ({
  page,
}) => {
  const asked: string[] = [];
  page.on("request", (request) => asked.push(new URL(request.url()).pathname));
  await page.goto("/sign-up");
  const button = page.getByRole("button", { name: "Create account" });
  await expect(button).toHaveCSS("background-color", rgb(token("--ink")));
  await expect(button).toHaveCSS("color", rgb(token("--paper")));
  await expect(button).toHaveCSS("border-top-left-radius", "9999px");
  await expect(button).toHaveCSS("border-top-width", "0px");
  await expect(button).toHaveCSS("font-weight", "600");
  expect((await button.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(48);
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  expect(asked).toContain("/fonts/schibsted-grotesk-latin-600-normal.woff2");
});

test("a field has an ink edge and is easy to hit; a note is small and soft", async ({ page }) => {
  await page.goto("/sign-up");
  const email = page.getByLabel("Email");
  await expect(email).toHaveCSS("border-top-width", "1px");
  // Owner, 2026-11-14 ("fix all the issues"): the soft edge made fields look faint, so the edge is ink.
  await expect(email).toHaveCSS("border-top-color", rgb(token("--ink")));
  await expect(email).toHaveCSS("border-top-left-radius", "14px");
  expect((await email.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(48);
  const note = page.getByText("At least 10 characters.");
  await expect(note).toHaveCSS("font-size", "14px");
  await expect(note).toHaveCSS("color", rgb(token("--ink-soft")));
});

test("a refusal is in heavier ink, not in red", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill("nobody@ruken.test");
  await page.getByLabel("Password").fill("not the password");
  await page.getByRole("button", { name: "Sign in" }).click();
  const refusal = page.getByText("That email and password don't match. Try again, or reset your password.");
  await expect(refusal).toHaveCSS("font-weight", "600");
  await expect(refusal).toHaveCSS("color", rgb(token("--ink")));
});

test("your account: one card, and a quiet button looks like a link", async ({ page }, testInfo) => {
  await signUp(page);
  await page.goto("/me");
  await expect(page.getByRole("heading", { name: "Your account" })).toBeVisible();
  await expectOneCard(page);
  await showTheOwner(page, testInfo, "your account");
  const again = page.getByRole("button", { name: "Send it again" });
  await expect(again).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(again).toHaveCSS("text-decoration-line", "underline");
});

test("a link that looks like a button is as easy to hit, and gives when pressed", async ({ page }) => {
  await page.goto("/no-such-page");
  const back = page.getByRole("link", { name: "Back to Ruken" });
  await expect(back).toHaveCSS("background-color", rgb(token("--ink")));
  expect((await back.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(48);
  await whilePressed(page, back, () => expect(back).toHaveCSS("transform", "matrix(0.97, 0, 0, 0.97, 0, 0)"));
});

// Holds the pointer down on the button, then lets go away from it, so the form is never sent.
async function whilePressed(page: Page, button: Locator, check: () => Promise<void>): Promise<void> {
  const box = await button.boundingBox();
  if (box === null) throw new Error("the button has no box to press");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await check();
  await page.mouse.move(0, 0);
  await page.mouse.up();
}

test("pressing a button makes it give a little", async ({ page }) => {
  await page.goto("/sign-up");
  const button = page.getByRole("button", { name: "Create account" });
  await whilePressed(page, button, () =>
    expect(button).toHaveCSS("transform", "matrix(0.97, 0, 0, 0.97, 0, 0)"),
  );
});

test("with reduced motion, nothing moves", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/sign-up");
  const button = page.getByRole("button", { name: "Create account" });
  await expect(button).toHaveCSS("transition-duration", "0s");
  await whilePressed(page, button, () => expect(button).toHaveCSS("transform", "none"));
  // And nothing on the page is animated or eased at all.
  expect(
    await page.evaluate(
      () =>
        [...document.querySelectorAll("*")].filter((element) => {
          const style = getComputedStyle(element);
          return (
            style.animationName !== "none" ||
            style.transitionDuration.split(", ").some((time) => time !== "0s")
          );
        }).length,
    ),
  ).toBe(0);
});

test("a very long address wraps inside the card", async ({ page }) => {
  // 92 characters, far wider than a phone, yet a valid address: the part before the @ stays under 64.
  const long = `${"a-very-long-name-".repeat(3)}@a-long-domain-name-for-a-test.ruken.test`;
  await page.goto("/forgot-password");
  await page.getByLabel("Email").fill(long);
  await page.getByRole("button", { name: "Send the link" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
  ).toBe(true);
});
