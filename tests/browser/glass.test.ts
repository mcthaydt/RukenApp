import { expect, test, type Locator, type Page } from "@playwright/test";
import { gameWhere } from "./support/game.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

// The glass is clear (the owner, 2026-11-22: "a lot more transparent", darkened by "maybe 10" percent), so over a white
// clip the glass alone leaves chalk on near-white. What keeps the words and pictures on it readable is the dark halo
// they carry (--glass-ink, --glass-icon in src/lib/look.css). This measures that halo in the drawn pixels: with every
// clip turned plain white, the darkest pixels around each glyph must stand off the chalk by 4.5 to 1 or more, and the
// glyph itself must still be chalk. The first review of #370 found the hint line and the outline icons nearly gone. This replaces the band's sum in
// tests/browser/feed.test.ts, which counted the glass alone and so cannot pass on glass this clear.

test.beforeAll(async ({ browser }) => {
  test.setTimeout(240_000);
  await forgetRateLimits();
  // The feed shows the bar, Share and the first open's hints only once there is a clip.
  const context = await browser.newContext({ baseURL: "http://localhost:4173" });
  try {
    await gameWhere(await context.newPage(), { state: "live" });
  } finally {
    await context.close();
  }
});
test.beforeEach(forgetRateLimits);

/** Relative luminance (WCAG) of an sRGB channel triple, 0 to 255 each. */
const luminance = (red: number, green: number, blue: number): number => {
  const linear = (channel: number) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue);
};

/** The luminance of every pixel the thing covers on screen, read from a screenshot by the page's own canvas. */
async function luminancesOf(page: Page, thing: Locator): Promise<number[]> {
  const box = await thing.boundingBox();
  expect(box, "the thing is on screen").not.toBeNull();
  if (box === null) return [];
  const png = await page.screenshot({ clip: box, scale: "css" });
  const pixels = await page.evaluate(async (base64: string) => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext("2d");
    if (context === null) return [];
    context.drawImage(image, 0, 0);
    return [...context.getImageData(0, 0, image.width, image.height).data];
  }, png.toString("base64"));
  const values: number[] = [];
  for (let at = 0; at + 2 < pixels.length; at += 4)
    values.push(luminance(pixels[at] ?? 0, pixels[at + 1] ?? 0, pixels[at + 2] ?? 0));
  return values;
}

/** Chalk (white) against the darkest 2% of the pixels: the halo the glyph carries. */
async function haloContrast(page: Page, thing: Locator): Promise<{ halo: number; glyph: number }> {
  const values = (await luminancesOf(page, thing)).sort((a, b) => a - b);
  const darkest = values[Math.floor(values.length * 0.02)] ?? 1;
  const brightest = values[values.length - 1] ?? 0;
  return { halo: (1 + 0.05) / (darkest + 0.05), glyph: brightest };
}

test("words and pictures on the glass stand out over a white clip", async ({ page }) => {
  await page.goto("/");
  const first = page.locator("section[data-slug]").first();
  await expect(first).toBeVisible();
  // Every clip plain white: the worst case behind the glass.
  await page.addStyleTag({
    content:
      "section[data-slug] video { visibility: hidden !important; } section[data-slug] { background: #fff !important; }",
  });
  // Let the glass redraw over the white before reading it.
  await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));

  const things: [string, Locator][] = [
    ["the game's name on the band", first.locator(".band h2")],
    ["the hint line", first.locator(".hints p").first()],
    ["the small hint line", first.locator(".hints p").nth(1)],
    [
      "the bar's Home picture",
      page.getByRole("navigation", { name: "Ruken" }).getByRole("link", { name: "Home" }).locator("svg"),
    ],
    [
      "the bar's You picture",
      page.getByRole("navigation", { name: "Ruken" }).getByRole("link", { name: "You" }).locator("svg"),
    ],
    ["the Share picture", first.locator(".share svg")],
    ["the sound picture", first.locator(".sound svg")],
  ];
  for (const [name, thing] of things) {
    await expect(thing, name).toBeVisible();
    const { halo, glyph } = await haloContrast(page, thing);
    expect(glyph, `${name} is still chalk`).toBeGreaterThanOrEqual(0.85);
    expect(halo, `${name} stands off the white by 4.5 to 1 or more`).toBeGreaterThanOrEqual(4.5);
  }
});
