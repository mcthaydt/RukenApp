import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { signUp } from "./support/account.ts";
import { NOT_CONSENTED } from "./support/consent.ts";
import { givePage, pageCounts, playOf } from "./support/database.ts";
import { addGame } from "./support/game.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

// Nothing is kept before "I agree" (design: cookie consent, criteria 1 to 7). Every other journey starts out having said
// yes (support/consent.ts); this one does not.
test.use({ storageState: NOT_CONSENTED });

let game: Awaited<ReturnType<typeof addGame>>;
let maker: { handle: string; linkIds: string[] };

test.beforeAll(async ({ browser, request }) => {
  test.setTimeout(240_000);
  await forgetRateLimits();
  game = await addGame(browser, request, { free: true });
  maker = await givePage(game.maker, {
    name: "Night Owl",
    oneLine: "I make small, hard games.",
    links: [{ title: "My Discord", url: "https://discord.example.com/invite/abc" }],
  });
});
test.beforeEach(forgetRateLimits);

const asking = (page: Page) => page.getByRole("heading", { name: "Cookies?" });
const agreeButton = (page: Page) => page.getByRole("button", { name: "I agree" });
const notNow = (page: Page) => page.getByText("Not now", { exact: true });

/** Everything this browser holds for Ruken: cookies, both storages, IndexedDB. */
async function whatIsKept(page: Page, context: BrowserContext) {
  const inPage = await page.evaluate(async () => ({
    local: Object.keys(localStorage),
    session: Object.keys(sessionStorage),
    databases: (await indexedDB.databases()).length,
  }));
  return { cookies: (await context.cookies()).map((cookie) => cookie.name), ...inPage };
}

/** Makes the tab really hidden and leaves, so SvelteKit's own writes (when hidden, and on unload) would happen now. */
async function hideAndReload(page: Page): Promise<void> {
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("pagehide"));
  });
  await page.reload();
}

const NOTHING = { cookies: [], local: [], session: [], databases: 0 };

test("nothing is kept before a yes: every public screen opens, and nothing is set, stored, counted or posted", async ({
  page,
  context,
}) => {
  // The real sessionStorage at the very start of each page, before any page script (guard 4's included) runs.
  await page.addInitScript(() => {
    (window as unknown as { __atStart: string[] }).__atStart = Object.keys(sessionStorage);
  });
  const methods = new Set<string>();
  page.on("request", (request) => methods.add(request.method()));
  const before = await pageCounts(maker.handle);
  const playsBefore = (await playOf(game.slug)).sessions.length;

  await page.goto("/");
  await expect(asking(page)).toBeVisible();
  // Scroll the feed past the hints.
  for (let step = 0; step < 3; step++) await page.keyboard.press("ArrowDown");
  for (const address of [
    `/g/${game.slug}`,
    `/${maker.handle}`,
    "/help",
    "/legal/maker-agreement",
    "/no-such-page-here",
  ]) {
    await page.goto(address);
    await expect(page.locator("body")).toBeVisible();
  }
  // A tap on the maker's link opens it, and is not counted.
  const tapped = await page.request.get(`/${maker.handle}/out/${maker.linkIds[0] ?? ""}`, { maxRedirects: 0 });
  expect(tapped.status()).toBe(303);
  // The screens that need a yes show the notice and keep nothing (their forms are never reached).
  for (const address of ["/sign-in", "/sign-up", "/join", `/g/${game.slug}/play`]) {
    await page.goto(address);
    await expect(asking(page)).toBeVisible();
  }

  await hideAndReload(page);
  expect(await page.evaluate(() => (window as unknown as { __atStart: string[] }).__atStart)).toEqual([]);
  expect(await whatIsKept(page, context)).toEqual(NOTHING);
  expect([...methods].filter((method) => method !== "GET" && method !== "HEAD")).toEqual([]);
  expect(await pageCounts(maker.handle)).toEqual(before);
  expect((await playOf(game.slug)).sessions).toHaveLength(playsBefore);
});

test("Not now keeps nothing, stays closed while moving around, and comes back on a reload", async ({
  page,
  context,
}) => {
  await page.goto(`/g/${game.slug}`);
  await notNow(page).click();
  await expect(asking(page)).toHaveCount(0);
  await page.getByRole("link", { name: "Home" }).click();
  await expect(page).toHaveURL("/");
  await expect(asking(page)).toHaveCount(0);
  expect(await whatIsKept(page, context)).toEqual(NOTHING);
  await page.reload();
  await expect(asking(page)).toBeVisible();
  expect(await whatIsKept(page, context)).toEqual(NOTHING);

  // On a screen that needs the yes, Not now goes back to the screen before it.
  await page.goto("/sign-in");
  await expect(page.getByText("To sign in, Ruken needs to keep a few small things in your browser.")).toBeVisible();
  await notNow(page).click();
  await expect(page).toHaveURL("/");
  expect(await whatIsKept(page, context)).toEqual(NOTHING);
});

test("each button that needs a yes says what it is for, and I agree goes on to it", async ({ page, context }) => {
  for (const [address, words] of [
    ["/sign-in", "To sign in"],
    ["/sign-up", "To make an account"],
    ["/join", "To join"],
    [`/g/${game.slug}/play`, "To play"],
  ] as const) {
    await context.clearCookies();
    await page.goto(address);
    await expect(page.getByText(`${words}, Ruken needs to keep a few small things in your browser.`)).toBeVisible();
    await agreeButton(page).click();
    await expect(page).toHaveURL(new RegExp(`${address.replaceAll("/", "\\/")}$`));
    expect(await context.cookies()).toHaveLength(1);
    expect((await context.cookies())[0]?.name).toBe("rk_consent");
  }
  // Playing now works, and the maker's page now counts a visit and remembers who brought the person.
  await page.goto(`/${maker.handle}`);
  expect((await pageCounts(maker.handle)).views).toBeGreaterThan(0);
  expect((await context.cookies()).map((cookie) => cookie.name)).toContain("rk_arrival");
});

test("saying yes from a game's page keeps the maker who brought the person", async ({ page, context }) => {
  await page.goto(`/g/${game.slug}`);
  await agreeButton(page).click();
  await expect(asking(page)).toHaveCount(0);
  expect((await context.cookies()).map((cookie) => cookie.name).sort()).toEqual(["rk_arrival", "rk_consent"]);
  // Pressing a button that needs the yes first sends the person to the notice from the game's page, and keeps it too.
  await context.clearCookies();
  await page.goto(`/g/${game.slug}`);
  await notNow(page).click();
  await page.goto(`/g/${game.slug}`);
  await page.getByRole("link", { name: "Play" }).click();
  await expect(page.getByText("To play, Ruken needs")).toBeVisible();
  await agreeButton(page).click();
  await expect(page).toHaveURL(`/g/${game.slug}/play`);
  expect((await context.cookies()).map((cookie) => cookie.name)).toContain("rk_arrival");
});

test("Take it back: create, read, update and delete the one thing a visitor makes here", async ({ page, context }) => {
  // Create: agree.
  await page.goto("/");
  await agreeButton(page).click();
  await expect(asking(page)).toHaveCount(0);
  const account = await signUp(page);
  // Read: /cookies says yes, and when.
  await page.goto("/cookies");
  await expect(page.getByText(/You said yes on this browser on /)).toBeVisible();
  // Delete: Take it back leaves no Ruken cookie, no rk_ key, signs the browser out and shows the notice again.
  await page.getByRole("button", { name: "Take it back" }).click();
  await expect(page.getByText("Done. Ruken keeps nothing on this browser now.")).toBeVisible();
  expect(await whatIsKept(page, context)).toEqual(NOTHING);
  await page.goto("/me");
  await expect(page).toHaveURL(/\/cookies\?for=account/);
  await expect(asking(page)).toBeVisible();
  // Update: agree again; the person is signed out (they have to sign in again), and signing in needs the yes too.
  await agreeButton(page).click();
  await expect(page).toHaveURL(/\/me$|\/sign-in/);
  await expect(page).toHaveURL(/\/sign-in/);
  expect(account.number).not.toBe("");
});

test("someone already signed in is signed out until they say yes, then carries on", async ({ page, context }) => {
  await page.goto("/");
  await agreeButton(page).click();
  await signUp(page);
  await context.clearCookies({ name: "rk_consent" });
  await page.goto("/me");
  await expect(page).toHaveURL(/\/cookies\?for=account/);
  await agreeButton(page).click();
  await expect(page).toHaveURL(/\/me$/);
  await expect(page.getByRole("heading", { name: "Your account" })).toBeVisible();
});

test("I agree and Not now are the same size and weight, and reachable by keyboard", async ({ page }) => {
  await page.goto("/");
  const agree = agreeButton(page);
  const no = page.getByRole("button", { name: "Not now" });
  const [a, b] = [await agree.boundingBox(), await no.boundingBox()];
  expect(a).not.toBeNull();
  expect(b).not.toBeNull();
  expect(Math.abs((a?.height ?? 0) - (b?.height ?? 1))).toBeLessThanOrEqual(1);
  expect(Math.abs((a?.width ?? 0) - (b?.width ?? 1))).toBeLessThanOrEqual(1);
  const style = (button: typeof agree) =>
    button.evaluate((element) => {
      const css = getComputedStyle(element);
      return [css.fontSize, css.fontWeight, css.borderRadius, css.fontFamily];
    });
  expect(await style(agree)).toEqual(await style(no));
  await agree.focus();
  await page.keyboard.press("Tab");
  await expect(no).toBeFocused();
});
