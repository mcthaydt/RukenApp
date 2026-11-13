import { expect, test } from "@playwright/test";
import { rgb, token } from "../support/look-tokens.ts";
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
