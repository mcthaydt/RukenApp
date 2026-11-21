import { expect, test, type Page } from "@playwright/test";
import { pageHasSettled, signUp, signUpInItsOwnContext, signInAs } from "./support/account.ts";
import { givePage, makeDeletionDue } from "./support/database.ts";
import { addDraft } from "./support/game.ts";
import { showTheOwner } from "./support/look.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";
import { rgb } from "../support/look-tokens.ts";
import { THEMES } from "../../src/features/pages/themes.ts";

// Editing your page (spec 5.5): a maker makes her page from nothing, reads it where visitors see it, changes every part
// of it and takes the parts away again, all on the real screens.

const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);
const theme = THEMES[2];
if (theme === undefined) throw new Error("the book gives no readable combination");

test.beforeEach(forgetRateLimits);

/** Opens one of the rooms from the list, as a person taps it. */
async function openRoom(page: Page, room: string): Promise<void> {
  await page.goto("/make/page");
  await pageHasSettled(page);
  await page.getByRole("link", { name: new RegExp(`^${room}`) }).click();
  await pageHasSettled(page);
}

/**
 * Waits for the step between two screens to end. A tap on a room is a step (a view transition), and a long screen such
 * as the colours can make the browser cancel one still running; a cancelled animation is the screen at rest, so it
 * counts as ended.
 */
async function atRest(page: Page): Promise<void> {
  await page.evaluate(() =>
    Promise.allSettled(
      document
        .getAnimations()
        .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
        .map((animation) => animation.finished),
    ),
  );
}

/**
 * The answer of the photo's own address, asked as a browser does (`media.localhost` is only for browsers) and by a
 * browser that has never seen it: a photo's address is kept by the one that fetched it, which is why a new photo gets a
 * new address.
 */
async function statusOf(page: Page, address: string | null): Promise<number> {
  const context = await page.context().browser()?.newContext();
  if (context === undefined) throw new Error("the page has no browser");
  try {
    return (await (await context.newPage()).goto(address ?? ""))?.status() ?? 0;
  } finally {
    await context.close();
  }
}

/** Answers the question on screen and presses Save. */
async function answerRoom(page: Page, question: string, answer: string): Promise<void> {
  const box = page.getByLabel(question);
  await box.fill(answer);
  await page.getByRole("button", { name: "Save" }).click();
}

test("signed out, your page asks for an account and comes back", async ({ page }) => {
  await page.goto("/make/page");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fmake%2Fpage/);
});

test("a maker makes her page, reads it, changes every part of it and takes the parts away", async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  await signUp(page);
  const address = `owl${crypto.randomUUID().replaceAll("-", "").slice(0, 10)}`;
  const moved = `${address}x`;

  // ---- "Your games" has the way in ----
  await page.goto("/make");
  await pageHasSettled(page);
  await page.getByRole("link", { name: "Your page" }).click();

  // ---- Create: the first question makes the page ----
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Pick your page's address");
  await pageHasSettled(page);
  await showTheOwner(page, testInfo, "your page, the address question");
  // Refusals, in the service's own words, keep what was typed and put the keyboard in the box.
  await answerRoom(page, "Pick your page's address", "ab");
  await expect(
    page.getByRole("alert").filter({ hasText: "Use at least 3 letters or numbers." }),
  ).toBeVisible();
  const box = page.getByLabel("Pick your page's address");
  await expect(box).toHaveValue("ab");
  await expect(box).toBeFocused();
  await answerRoom(page, "Pick your page's address", "admin");
  await expect(page.getByRole("alert")).toHaveText("That one is taken. Pick another.");
  await answerRoom(page, "Pick your page's address", address);

  // ---- Read: the rooms say what is saved, and the page is where visitors see it ----
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your page");
  await expect(page.getByRole("status")).toHaveText("Saved. Your page is live.");
  await expect(page.getByRole("link", { name: /^Address/ })).toContainText(`/${address}`);
  await expect(page.getByRole("link", { name: /^Name/ })).toContainText(address);
  await expect(page.getByRole("link", { name: /^Photo/ })).toContainText("Not yet");
  await expect(page.getByRole("link", { name: /^Links/ })).toContainText("No links yet");
  await expect(page.getByText("Opened 0 times.")).toBeVisible();
  await showTheOwner(page, testInfo, "your page, the rooms");
  // The note is said once.
  await page.reload();
  await expect(page.getByRole("status")).toHaveCount(0);
  await page.getByRole("link", { name: "See your page" }).click();
  await expect(page).toHaveURL(`/${address}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(address);

  // ---- Update: the name, with its refusal ----
  await openRoom(page, "Name");
  await answerRoom(page, "What should your page call you?", "   ");
  await expect(page.getByRole("alert")).toHaveText("Your page needs a name.");
  await answerRoom(page, "What should your page call you?", "Night Owl");
  await expect(page.getByRole("status")).toHaveText("Saved.");

  // ---- Update: the one line, with its refusal ----
  await openRoom(page, "About you");
  await answerRoom(page, "Say one line about you", "x".repeat(101));
  await expect(page.getByRole("alert")).toHaveText("The one line can be up to 100 characters.");
  await answerRoom(page, "Say one line about you", "I make small, hard games.");
  await expect(page.getByRole("link", { name: /^About you/ })).toContainText("I make small, hard games.");
  await page.goto(`/${address}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Night Owl");
  await expect(page.getByText("I make small, hard games.")).toBeVisible();

  // ---- Update: the colours, each a tile of at least 48px; a number that is not offered changes nothing ----
  await openRoom(page, "Colours");
  await atRest(page);
  await showTheOwner(page, testInfo, "your page, the colours question");
  const tile = page.getByRole("radio", { name: `Colours ${String(theme.id)}`, exact: true });
  await expect(page.getByRole("radio", { name: "Ruken's own colours" })).toBeChecked();
  const tileBox = await page.locator("label.swatch").first().boundingBox();
  expect(tileBox?.height ?? 0).toBeGreaterThanOrEqual(48);
  await tile.check({ force: true });
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("link", { name: /^Colours/ })).toContainText(`Colours ${String(theme.id)}`);
  await page.goto(`/${address}`);
  await expect(page.locator("main")).toHaveCSS("background-color", rgb(theme.ground));
  await openRoom(page, "Colours");
  await page.evaluate(async () => {
    const form = new FormData();
    form.set("theme", "999999");
    await fetch("?/answer", { method: "POST", body: form, headers: { "x-sveltekit-action": "true" } });
  });
  await page.goto(`/${address}`);
  await expect(page.locator("main")).toHaveCSS("background-color", rgb(theme.ground));

  // ---- Update: the address moves the page ----
  await openRoom(page, "Address");
  await answerRoom(page, "Pick your page's address", moved);
  await expect(page.getByRole("link", { name: /^Address/ })).toContainText(`/${moved}`);
  expect((await page.goto(`/${address}`))?.status()).toBe(404);
  await page.goto(`/${moved}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Night Owl");

  // ---- Photo: a picture is kept, a new one replaces it and the old address is gone, Remove photo takes it off ----
  await openRoom(page, "Photo");
  await page.getByLabel("Add a photo for your page").setInputFiles({
    name: "me.png",
    mimeType: "image/png",
    buffer: ONE_PIXEL_PNG,
  });
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("link", { name: /^Photo/ })).toContainText("Added");
  await page.goto(`/${moved}`);
  const first = await page.locator(".who img").getAttribute("src");
  expect(first).not.toBeNull();
  expect(await statusOf(page, first)).toBe(200);
  await openRoom(page, "Photo");
  await page.getByLabel("Add a photo for your page").setInputFiles({
    name: "me2.png",
    mimeType: "image/png",
    buffer: ONE_PIXEL_PNG,
  });
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("link", { name: /^Photo/ })).toContainText("Added");
  await page.goto(`/${moved}`);
  const second = await page.locator(".who img").getAttribute("src");
  expect(second).not.toBe(first);
  expect(await statusOf(page, first)).toBe(404);
  // Not a picture: refused in words, and the photo stays.
  await openRoom(page, "Photo");
  await page.getByLabel("Add a photo for your page").setInputFiles({
    name: "note.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("hello"),
  });
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("alert")).toHaveText("A photo is a JPEG, PNG or WebP picture.");
  await page.getByRole("button", { name: "Remove photo" }).click();
  await expect(page.getByRole("status")).toHaveText("Photo removed.");
  await expect(page.getByRole("link", { name: /^Photo/ })).toContainText("Not yet");
  await page.goto(`/${moved}`);
  await expect(page.locator(".who img")).toHaveCount(0);
  await expect(page.locator(".initial")).toHaveText("N");
  expect(await statusOf(page, second)).toBe(404);

  // ---- Links: add (two questions), read, reorder, hide, show, remove ----
  await openRoom(page, "Links");
  await expect(page.getByText("You have no links yet.")).toBeVisible();
  await page.getByRole("link", { name: "Add a link" }).click();
  await answerRoom(page, "What should the link say?", "");
  await expect(page.getByRole("alert")).toHaveText("Give the link a name.");
  await answerRoom(page, "What should the link say?", "My Discord");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Where does it go?");
  await answerRoom(page, "Where does it go?", "http://discord.example.com");
  await expect(page.getByRole("alert")).toHaveText("A link starts with https://");
  await expect(page.getByLabel("Where does it go?")).toHaveValue("http://discord.example.com");
  await answerRoom(page, "Where does it go?", "https://discord.example.com/invite/abc");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your links");
  await page.getByRole("link", { name: "Add a link" }).click();
  await page.getByLabel("What should the link say?").fill("My other game");
  await page.locator("label.pick").click();
  await expect(page.getByLabel("A game somewhere else")).toBeChecked();
  await page.getByRole("button", { name: "Save" }).click();
  await answerRoom(page, "Where does it go?", "https://store.steampowered.com/app/1");
  const rows = page.locator("form[data-link]");
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText("My Discord");
  await expect(rows.nth(0)).toContainText("Tapped 0 times");
  await expect(rows.nth(0).getByRole("button", { name: "Up" })).toHaveCount(0);
  await expect(rows.nth(1).getByRole("button", { name: "Down" })).toHaveCount(0);
  await expect(rows.nth(1)).toContainText("A game somewhere else");
  await showTheOwner(page, testInfo, "your page, the links");

  // ---- Update a link: its words and address change where it sits; refusals are in the same words as adding ----
  await rows.nth(0).getByRole("link", { name: "Change" }).click();
  await expect(page.getByLabel("What should the link say?")).toHaveValue("My Discord");
  await answerRoom(page, "What should the link say?", "Our Discord");
  await expect(page.getByLabel("Where does it go?")).toHaveValue("https://discord.example.com/invite/abc");
  await answerRoom(page, "Where does it go?", "http://discord.example.com/new");
  await expect(page.getByRole("alert")).toHaveText("A link starts with https://");
  await answerRoom(page, "Where does it go?", "https://discord.example.com/invite/new");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your links");
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText("Our Discord");
  await expect(rows.nth(0)).toContainText("Tapped 0 times");
  await expect(rows.nth(1)).toContainText("My other game");

  await rows.nth(1).getByRole("button", { name: "Up" }).click();
  await expect(rows.nth(0)).toContainText("My other game");
  await rows.nth(0).getByRole("button", { name: "Hide" }).click();
  await expect(rows.nth(0)).toContainText("Hidden");
  await page.goto(`/${moved}`);
  const visitors = page.getByRole("navigation", { name: "Links" }).getByRole("link");
  await expect(visitors).toHaveCount(1);
  await expect(visitors.first()).toContainText("Our Discord");
  await openRoom(page, "Links");
  await rows.nth(0).getByRole("button", { name: "Show" }).click();
  await page.goto(`/${moved}`);
  await expect(visitors).toHaveCount(2);
  await expect(visitors.nth(0)).toContainText("My other game");
  await openRoom(page, "Links");
  await rows.nth(0).getByRole("button", { name: "Remove" }).click();
  await expect(rows).toHaveCount(1);
  await rows.nth(0).getByRole("button", { name: "Remove" }).click();
  await expect(page.getByText("You have no links yet.")).toBeVisible();
  await page.goto(`/${moved}`);
  await expect(page.getByRole("navigation", { name: "Links" })).toHaveCount(0);

  // ---- Delete: take the page down. Keeping it is the first choice; taking it down frees the address ----
  await page.goto("/make/page/take-down");
  await pageHasSettled(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Take Night Owl down?");
  await expect(page.getByRole("link", { name: "Keep my page" })).toBeFocused();
  await showTheOwner(page, testInfo, "your page, take it down");
  await page.getByRole("link", { name: "Keep my page" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your page");
  expect((await page.goto(`/${moved}`))?.status()).toBe(200);
  await openRoom(page, "Address");
  await page.goto("/make/page/take-down");
  await page.getByRole("button", { name: "Take my page down" }).click();
  await expect(page.getByRole("status")).toHaveText("Your page is down.");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Pick your page's address");
  expect((await page.goto(`/${moved}`))?.status()).toBe(404);
  // Nothing is left to take down, and the account is as it was; she can make a page again at the same address.
  expect((await page.goto("/make/page/name"))?.url()).toContain("/make/page");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Pick your page's address");
  await answerRoom(page, "Pick your page's address", moved);
  await expect(page.getByRole("status")).toHaveText("Saved. Your page is live.");
  await expect(page.getByRole("link", { name: /^Links/ })).toContainText("No links yet");
  await page.goto(`/${moved}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(moved);
});

test("a page goes when its account is deleted, after the 14 days", async ({ page }) => {
  test.setTimeout(120_000);
  const maker = await signUp(page);
  const { handle } = await givePage(maker, {
    name: "Soon Gone",
    oneLine: "",
    links: [{ title: "A link", url: "https://gone.example.com/x" }],
  });
  expect((await page.goto(`/${handle}`))?.status()).toBe(200);

  await page.goto("/me");
  await page.getByRole("link", { name: "Delete my account" }).click();
  await page.getByRole("button", { name: "Delete my account" }).click();
  await expect(page.getByRole("heading", { name: "Your account will be deleted." })).toBeVisible();
  // For the 14 days the page stays, so a maker who changes their mind loses nothing.
  expect((await page.goto(`/${handle}`))?.status()).toBe(200);

  await makeDeletionDue(maker.email);
  const answer = await page.request.post("/jobs/purge-accounts", {
    headers: { "content-type": "application/json", authorization: "Bearer test-only-jobs-secret" },
  });
  expect(answer.status()).toBe(200);
  expect((await page.goto(`/${handle}`))?.status()).toBe(404);
});

test("nobody changes another maker's links, and thirty is the most", async ({ page, browser }) => {
  test.setTimeout(120_000);
  const mine = await signUp(page);
  const { linkIds } = await givePage(mine, {
    name: "Mine",
    oneLine: "",
    links: [{ title: "Keep me", url: "https://keep.example.com/x" }],
  });
  const other = await signUpInItsOwnContext(browser);
  await givePage(other, { name: "Theirs", oneLine: "" });
  const [victim = ""] = linkIds;

  // The other maker posts every change at my link: each is the missing page, and my link stays.
  const context = await browser.newContext({ baseURL: "http://localhost:4173" });
  try {
    const theirs = await context.newPage();
    await signInAs(theirs, other);
    await theirs.goto("/make/page/links");
    await pageHasSettled(theirs);
    // Changing it, too: the question is the missing page for anyone but its maker.
    for (const path of [`/make/page/links/${victim}`, `/make/page/links/${victim}/where?title=x`]) {
      expect((await theirs.goto(path))?.status(), path).toBe(404);
    }
    await theirs.goto("/make/page/links");
    for (const action of ["up", "down", "hide", "show", "remove"]) {
      const status = await theirs.evaluate(
        async ({ action, victim }) => {
          const form = new FormData();
          form.set("link", victim);
          const answer = await fetch(`?/${action}`, {
            method: "POST",
            body: form,
            headers: { "x-sveltekit-action": "true" },
          });
          const body: { status?: number } = await answer.json();
          return body.status ?? answer.status;
        },
        { action, victim },
      );
      expect(status, action).toBe(404);
    }
  } finally {
    await context.close();
  }
  await page.goto("/make/page/links");
  await expect(page.locator("form[data-link]")).toHaveCount(1);
  await expect(page.locator("form[data-link]")).toContainText("Keep me");
  await expect(page.getByRole("button", { name: "Hide" })).toBeVisible();

  // At thirty, the way to add is gone and the page says why.
  const full = await signUpInItsOwnContext(browser);
  await givePage(full, {
    name: "Full",
    oneLine: "",
    links: Array.from({ length: 30 }, (_, index) => ({
      title: `Link ${String(index + 1)}`,
      url: `https://full.example.com/${String(index + 1)}`,
    })),
  });
  const context2 = await browser.newContext({ baseURL: "http://localhost:4173" });
  try {
    const fullPage = await context2.newPage();
    await signInAs(fullPage, full);
    await fullPage.goto("/make/page/links");
    await expect(fullPage.getByText("A page can have up to 30 links. Remove one first.")).toBeVisible();
    await expect(fullPage.getByRole("link", { name: "Add a link" })).toHaveCount(0);
  } finally {
    await context2.close();
  }
});

test("a game named like one of the maker's screens gets an address of its own", async ({
  page,
}, testInfo) => {
  // /make/new, /make/github and /make/page are the maker's own screens, so a game with one of those names must not be
  // there: its screens would be hidden behind them. Each screen size takes a word, so the three never share a database's
  // nine numbered addresses.
  const word = { phone: "New", tablet: "GitHub", computer: "Page" }[testInfo.project.name] ?? "New";
  await signUp(page);
  const { slug } = await addDraft(page, word);
  expect(slug).toMatch(new RegExp(`^${word.toLowerCase()}-[2-9]$`));
  await page.goto(`/make/${slug}/line`);
  await expect(page.getByLabel(/about, in one line\?$/)).toBeVisible();
});
