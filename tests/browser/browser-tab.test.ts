import { expect, test, type APIRequestContext } from "@playwright/test";
import { pageHasSettled } from "./support/account.ts";
import { addGame } from "./support/game.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

// What the browser tab and a phone's home screen show: the RKN icon on Ruken's green, "Ruken - The Everyday
// Console" on every screen, and "Ruken - " and the game's name on a game's page and while it is played.

const BASE = "Ruken - The Everyday Console";

type Manifest = {
  name: string;
  short_name: string;
  theme_color: string;
  icons: { src: string; sizes: string; purpose?: string }[];
};

test.beforeEach(forgetRateLimits);

// A PNG names its own width and height in its first chunk, at bytes 16 to 24.
async function pngSize(request: APIRequestContext, href: string): Promise<{ width: number; height: number }> {
  const answer = await request.get(href);
  expect(answer.status(), href).toBe(200);
  expect(answer.headers()["content-type"], href).toBe("image/png");
  const bytes = await answer.body();
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

test("every screen points the browser at the RKN icon, in each size a browser or phone asks for", async ({
  page,
  request,
}) => {
  await page.goto("/sign-in");
  await expect(page).toHaveTitle(BASE);

  const favicon = await request.get(
    (await page.locator('link[rel="icon"][sizes="48x48"]').getAttribute("href")) ?? "",
  );
  expect(favicon.status()).toBe(200);
  // An .ico file starts 00 00 01 00.
  expect([...(await favicon.body()).subarray(0, 4)]).toEqual([0, 0, 1, 0]);

  const small = await page.locator('link[rel="icon"][type="image/png"]').getAttribute("href");
  expect(await pngSize(request, small ?? "")).toEqual({ width: 32, height: 32 });
  const touch = await page.locator('link[rel="apple-touch-icon"]').getAttribute("href");
  expect(await pngSize(request, touch ?? "")).toEqual({ width: 180, height: 180 });

  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute("href");
  const manifest = (await (await request.get(manifestHref ?? "")).json()) as Manifest;
  expect(manifest.name).toBe(BASE);
  expect(manifest.short_name).toBe("Ruken");
  expect(manifest.theme_color).toBe("#112f2c");
  for (const icon of manifest.icons) {
    const [width, height] = icon.sizes.split("x").map(Number);
    expect(await pngSize(request, icon.src)).toEqual({ width, height });
  }
  expect(manifest.icons.some((icon) => icon.purpose === "maskable")).toBe(true);
});

test("a game's page and its play screen name the game, and the tab goes back to Ruken after", async ({
  page,
  browser,
  request,
}) => {
  test.setTimeout(120_000);
  const free = await addGame(browser, request, { free: true });
  await page.goto("/help", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveTitle(BASE);

  await page.goto(`/g/${free.slug}`, { waitUntil: "domcontentloaded" });
  await pageHasSettled(page);
  await expect(page).toHaveTitle(`Ruken - ${free.name}`);

  await page.getByRole("link", { name: "Play" }).click();
  await expect(page).toHaveURL(`/g/${free.slug}/play`);
  await expect(page).toHaveTitle(`Ruken - ${free.name}`);

  // Back in the browser, then forward to a screen that is not a game: the base title again.
  await page.goBack();
  await expect(page).toHaveURL(`/g/${free.slug}`);
  // The address changes before the page does, so wait for what only the game's page shows.
  await expect(page.getByRole("link", { name: "Play" })).toBeVisible();
  await pageHasSettled(page);
  await expect(page).toHaveTitle(`Ruken - ${free.name}`);
  await page.goto("/help", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveTitle(BASE);
});
