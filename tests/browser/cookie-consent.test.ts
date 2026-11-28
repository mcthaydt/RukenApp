import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { pageHasSettled, signUp } from "./support/account.ts";
import { letInTerminal, terminal } from "./support/computers.ts";
import { NOT_CONSENTED } from "./support/consent.ts";
import { givePage, pageCounts, playOf, rateLimitRows, setListed } from "./support/database.ts";
import { addGame } from "./support/game.ts";
import { beforeLaunch } from "./support/launch.ts";
import { forgetRateLimits, journeyClientHeaders } from "./support/rate-limits.ts";

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
  const inPage = await page.evaluate(async () => {
    // The page's own sessionStorage is a stand-in until a yes; a blank frame of the same origin shows the real one.
    const realSessionKeys = () => {
      const frame = document.createElement("iframe");
      (document.documentElement as unknown as { appendChild(node: unknown): void }).appendChild(frame);
      const keys = Object.keys(frame.contentWindow?.sessionStorage ?? {});
      frame.remove();
      return keys;
    };
    return {
      local: Object.keys(localStorage),
      session: realSessionKeys(),
      databases: (await indexedDB.databases()).length,
    };
  });
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
    "/privacy",
    "/terms",
    "/no-such-page-here",
  ]) {
    await page.goto(address);
    await expect(page.locator("body")).toBeVisible();
    // The legal pages open where they are, never behind the notice.
    if (address === "/privacy" || address === "/terms") await expect(page).toHaveURL(address);
  }
  // A tap on the maker's link opens it, and is not counted.
  const tapped = await page.request.get(`/${maker.handle}/out/${maker.linkIds[0] ?? ""}`, {
    maxRedirects: 0,
  });
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
  await pageHasSettled(page);
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
  await expect(
    page.getByText("To sign in, Ruken needs to keep a few small things in your browser."),
  ).toBeVisible();
  await pageHasSettled(page);
  await notNow(page).click();
  await expect(page).toHaveURL("/");
  expect(await whatIsKept(page, context)).toEqual(NOTHING);
});

test("each button that needs a yes says what it is for, and I agree goes on to it", async ({
  page,
  context,
}) => {
  for (const [address, words] of [
    ["/sign-in", "To sign in"],
    ["/sign-up", "To make an account"],
    ["/join", "To join"],
    [`/g/${game.slug}/play`, "To play"],
  ] as const) {
    await context.clearCookies();
    await page.goto(address);
    await expect(
      page.getByText(`${words}, Ruken needs to keep a few small things in your browser.`),
    ).toBeVisible();
    await agreeButton(page).click();
    await expect(page).toHaveURL(new RegExp(`${address.replaceAll("/", "\\/")}$`));
    // Saying yes from a game's page also keeps who brought the person; nothing else is set.
    expect((await context.cookies()).map((cookie) => cookie.name).sort()).toEqual(
      address.startsWith("/g/") ? ["rk_arrival", "rk_consent"] : ["rk_consent"],
    );
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
  await pageHasSettled(page);
  await notNow(page).click();
  await expect(asking(page)).toHaveCount(0);
  await page.goto(`/g/${game.slug}`);
  await page.getByRole("link", { name: "Play" }).click();
  await expect(page.getByText("To play, Ruken needs")).toBeVisible();
  await agreeButton(page).click();
  await expect(page).toHaveURL(`/g/${game.slug}/play`);
  expect((await context.cookies()).map((cookie) => cookie.name)).toContain("rk_arrival");
});

test("saying yes from a maker's page keeps who brought the person, but never from an unlisted page's address", async ({
  page,
  context,
}) => {
  const fromAddress = async () => {
    await context.clearCookies();
    await page.goto(`/cookies?next=${encodeURIComponent(`/${maker.handle}`)}`);
    await agreeButton(page).click();
    await expect(page).toHaveURL(`/${maker.handle}`);
    return (await context.cookies()).map((cookie) => cookie.name);
  };
  expect(await fromAddress()).toContain("rk_arrival");
  await setListed(maker.handle, false);
  try {
    expect(await fromAddress()).toEqual(["rk_consent"]);
  } finally {
    await setListed(maker.handle, true);
  }
});

test("Take it back: create, read, update and delete the one thing a visitor makes here", async ({
  page,
  context,
}) => {
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

test("someone already signed in is signed out until they say yes, then carries on", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await agreeButton(page).click();
  await expect(asking(page)).toHaveCount(0);
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

// The machine's own door: the `ruken` command has no browser to say yes in, so its calls need no cookie, but a call
// with no valid key writes nothing (criterion 6).
// JSON, as the command sends it: a bodiless DELETE would be taken for a cross-site form.
const KEY_HEADER = (key: string) => ({
  authorization: `Bearer ${key}`,
  "content-type": "application/json",
  ...journeyClientHeaders(),
});

test("a computer's key writes with no cookie, and a made-up key writes nothing", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await agreeButton(page).click();
  await expect(asking(page)).toHaveCount(0);
  await signUp(page);
  const computer = terminal();
  await letInTerminal(page, computer);
  const key = computer.key() ?? "";

  // `request` holds no cookie at all. A made-up key is refused, and no row is written.
  const rowsBefore = await rateLimitRows();
  const refused = await request.delete("/api/v1/me/key", { headers: KEY_HEADER(`rk_${"a".repeat(52)}`) });
  expect(refused.status()).toBe(401);
  expect(await rateLimitRows()).toBe(rowsBefore);
  expect((await request.get("/api/v1/me", { headers: KEY_HEADER(key) })).status()).toBe(200);

  // The real key signs the computer out: a write, with no cookie and no yes.
  expect((await request.delete("/api/v1/me/key", { headers: KEY_HEADER(key) })).status()).toBe(200);
  expect((await request.get("/api/v1/me", { headers: KEY_HEADER(key) })).status()).toBe(401);
});

test("Not now on a screen that needs the yes goes back to the Ruken page before it, never to another site", async ({
  page,
}) => {
  await page.goto(`/g/${game.slug}`);
  await pageHasSettled(page);
  await notNow(page).click();
  await page.getByRole("link", { name: "Play" }).click();
  await expect(page.getByText("To play, Ruken needs")).toBeVisible();
  await pageHasSettled(page);
  await notNow(page).click();
  await expect(page).toHaveURL(`/g/${game.slug}`);

  // Arriving from another website, there is no Ruken page before it: Not now goes to the feed.
  await page.goto("/sign-in", { referer: "https://search.example.com/results" });
  await pageHasSettled(page);
  await notNow(page).click();
  await expect(page).toHaveURL("/");
});

test("Wishlist before a yes shows the notice and sets nothing; after the yes it signs you up, and Take it back clears it", async ({
  page,
  context,
}) => {
  await beforeLaunch(context);
  await page.goto(`/g/${game.slug}`);
  await pageHasSettled(page);
  await notNow(page).click();
  await page.getByRole("button", { name: "Wishlist", exact: true }).click();
  await expect(page.getByText("To save this game, Ruken needs")).toBeVisible();
  expect((await context.cookies()).map((cookie) => cookie.name)).not.toContain("rk_wish_pressed");
  await pageHasSettled(page);
  await agreeButton(page).click();
  await expect(page).toHaveURL(`/g/${game.slug}`);

  // Now it is allowed: pressing sets the cookie and goes to sign-up.
  await page.getByRole("button", { name: "Wishlist", exact: true }).click();
  await expect(page).toHaveURL(/\/sign-up/);
  expect((await context.cookies()).map((cookie) => cookie.name)).toContain("rk_wish_pressed");

  await page.goto("/cookies");
  await page.getByRole("button", { name: "Take it back" }).click();
  await expect(page.getByText("Done. Ruken keeps nothing on this browser now.")).toBeVisible();
  expect((await context.cookies()).map((cookie) => cookie.name)).not.toContain("rk_wish_pressed");
});
