import { expect, test, type Page } from "@playwright/test";
import { pageHasSettled, SITE_ANSWER_TIMEOUT, signUp } from "./support/account.ts";
import { pageCounts } from "./support/database.ts";
import { showTheOwner } from "./support/look.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";
import { THEMES } from "../../src/features/pages/themes.ts";

// Editing your page (spec 5.5): a maker with no page answers one question and has one, then changes it a room at a time.
// Every maker needs an account, and the site lets one address make five an hour; the counters are cleared first.
test.beforeEach(forgetRateLimits);

const SITE = "http://localhost:4173";

/** A real 1 by 1 picture, so the browser can read it and the server finds a picture's first bytes. */
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

/** A fresh address: three letters or more, only letters, numbers and hyphens. */
function freshAddress(): string {
  return `owl-${crypto.randomUUID().replaceAll("-", "").slice(0, 10)}`;
}

/** Answers the room's question: types the answer in its box and presses Save, then waits for the rooms. */
async function answerRoom(page: Page, question: string, answer: string): Promise<void> {
  await page.getByLabel(question).fill(answer);
  await page.getByRole("button", { name: "Save" }).click({ timeout: SITE_ANSWER_TIMEOUT });
  await expect(page).toHaveURL("/make/page");
}

async function makePage(page: Page, handle: string): Promise<void> {
  await page.goto("/make/page");
  await pageHasSettled(page);
  await answerRoom(page, "Pick your page's address", handle);
}

test("signed out, Your page goes to sign in", async ({ page }) => {
  await page.goto("/make/page");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fmake%2Fpage/);
});

test("a maker makes a page from one question and sees it live", async ({ page }, testInfo) => {
  await signUp(page);
  await page.goto("/make");
  await page.getByRole("link", { name: "Your page" }).click();
  await expect(page).toHaveURL("/make/page");
  await expect(page.getByRole("heading", { name: "Pick your page's address" })).toBeVisible();
  await expect(page.getByText("Use letters, numbers and hyphens.")).toBeVisible();
  await showTheOwner(page, testInfo, "Your page, the first question");
  await pageHasSettled(page);

  // Each refusal is in plain words, keeps what was typed and puts the keyboard on the box.
  const box = page.getByLabel("Pick your page's address");
  for (const [typed, words] of [
    ["ab", "Use at least 3 letters or numbers."],
    ["admin", "That one is taken. Pick another."],
    ["no spaces here", "Use only letters, numbers and hyphens."],
  ] as const) {
    await box.fill(typed);
    await page.getByRole("button", { name: "Save" }).click({ timeout: SITE_ANSWER_TIMEOUT });
    await expect(page.getByRole("alert")).toHaveText(words);
    await expect(box).toHaveValue(typed);
    await expect(box).toBeFocused();
  }

  const handle = freshAddress();
  await answerRoom(page, "Pick your page's address", handle);
  await expect(page.getByRole("status")).toHaveText("Saved. Your page is live.");
  await expect(page.getByRole("heading", { name: "Your page" })).toBeVisible();
  // The address is the name until it is changed.
  await expect(page.getByRole("link", { name: /^Name/ })).toContainText(handle);
  await expect(page.getByRole("link", { name: /^Address/ })).toContainText(`localhost:4173/${handle}`);
  await expect(page.getByText("Opened 0 times.")).toBeVisible();
  await showTheOwner(page, testInfo, "Your page, the rooms");

  await page.getByRole("link", { name: "See your page" }).click();
  await expect(page).toHaveURL(`/${handle}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(handle);
  // Its own maker is not a visitor, so the count stays at nothing.
  expect((await pageCounts(handle)).views).toBe(0);
});

test("a maker changes the name, the line, the colours and the address", async ({ page }, testInfo) => {
  await signUp(page);
  const handle = freshAddress();
  await makePage(page, handle);

  await page.getByRole("link", { name: /^Name/ }).click();
  await expect(page.getByRole("heading", { name: "What should your page call you?" })).toBeVisible();
  await page.getByLabel("What should your page call you?").fill("");
  await page.getByRole("button", { name: "Save" }).click({ timeout: SITE_ANSWER_TIMEOUT });
  await expect(page.getByRole("alert")).toHaveText("Your page needs a name.");
  await answerRoom(page, "What should your page call you?", "Night Owl");

  await page.getByRole("link", { name: /^About you/ }).click();
  const tooLong = "x".repeat(101);
  await page.getByLabel("Say one line about you").fill(tooLong);
  await page.getByRole("button", { name: "Save" }).click({ timeout: SITE_ANSWER_TIMEOUT });
  await expect(page.getByRole("alert")).toHaveText("The one line can be up to 100 characters.");
  await answerRoom(page, "Say one line about you", "I make small, hard games.");

  // Colours: Ruken's own and one tile per offered combination, each at least 48px tall.
  await page.getByRole("link", { name: /^Colours/ }).click();
  const own = page.getByRole("radio", { name: "Ruken's own colours" });
  await expect(own).toBeChecked();
  await expect(page.getByRole("radio")).toHaveCount(THEMES.length + 1);
  const tile = page.locator("label.theme").nth(1);
  expect((await tile.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(48);
  const [theme] = THEMES;
  if (theme === undefined) throw new Error("the book gives no readable combination");
  await showTheOwner(page, testInfo, "Your page, colours");
  await pageHasSettled(page);
  await page
    .locator("label.theme", { hasText: `Colours ${String(theme.id)}` })
    .first()
    .click();
  await expect(page.getByRole("radio", { name: `Colours ${String(theme.id)}`, exact: true })).toBeChecked();
  await page.getByRole("button", { name: "Save" }).click({ timeout: SITE_ANSWER_TIMEOUT });
  await expect(page).toHaveURL("/make/page");
  await expect(page.getByRole("link", { name: /^Colours/ })).toContainText(`Colours ${String(theme.id)}`);

  await page.goto(`/${handle}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Night Owl");
  await expect(page.getByText("I make small, hard games.")).toBeVisible();

  // The address moves the page: the old one is the missing page and the new one opens.
  const moved = freshAddress();
  await page.goto("/make/page/address");
  await answerRoom(page, "Pick your page's address", moved);
  expect((await page.request.get(`/${handle}`)).status()).toBe(404);
  await page.goto(`/${moved}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Night Owl");
});

test("a maker adds a photo and takes it away", async ({ page, browser }) => {
  await signUp(page);
  const handle = freshAddress();
  await makePage(page, handle);

  await page.goto("/make/page/photo");
  await pageHasSettled(page);
  await expect(page.getByText("A JPEG, PNG or WebP, up to 5 MB.")).toBeVisible();

  // A file that is not a picture is refused in words.
  await page
    .locator("#photo-file")
    .setInputFiles({ name: "notes.png", mimeType: "image/png", buffer: Buffer.from("not a picture") });
  await expect(page.getByRole("alert")).toContainText("doesn't look like a picture");

  // The page cuts a picture to a square before it is sent, so what is kept is a JPEG.
  await page
    .locator("#photo-file")
    .setInputFiles({ name: "me.png", mimeType: "image/png", buffer: TINY_PNG });
  await expect(page).toHaveURL("/make/page");
  await expect(page.getByRole("link", { name: /^Photo/ })).toContainText("Added");
  await page.goto(`/${handle}`);
  const shown = page.locator("img").first();
  await expect(shown).toHaveAttribute("src", /\/photos\/[0-9a-f]{16}\.jpg$/);

  // A different photo takes the first one's place, and the first one's address answers 404.
  const first = (await shown.getAttribute("src")) ?? "";
  // The media address is a name only a browser resolves (`*.localhost`), so the browser opens it.
  expect((await page.goto(first))?.status()).toBe(200);
  await page.goto("/make/page/photo");
  await pageHasSettled(page);
  await page
    .locator("#photo-file")
    .setInputFiles({ name: "again.png", mimeType: "image/png", buffer: TINY_PNG });
  await expect(page).toHaveURL("/make/page");
  await page.goto(`/${handle}`);
  await expect(shown).not.toHaveAttribute("src", first);
  // A browser that has the old photo kept it, as it should; one that has not is told it is gone.
  const stranger = await browser.newContext();
  try {
    expect((await (await stranger.newPage()).goto(first))?.status()).toBe(404);
  } finally {
    await stranger.close();
  }

  await page.goto("/make/page/photo");
  await page.getByRole("button", { name: "Remove photo" }).click({ timeout: SITE_ANSWER_TIMEOUT });
  await expect(page).toHaveURL("/make/page");
  await expect(page.getByRole("link", { name: /^Photo/ })).toContainText("None yet");
});

test("a maker adds, orders, hides and removes links; nobody else can touch them", async ({
  page,
  browser,
}, testInfo) => {
  await signUp(page);
  const handle = freshAddress();
  await makePage(page, handle);

  await page.getByRole("link", { name: /^Links/ }).click();
  await expect(page.getByText("You have no links yet.")).toBeVisible();

  /** Adds a link by its two questions. */
  async function addLink(words: string, address: string, elsewhere = false): Promise<void> {
    await page.getByRole("link", { name: "Add a link" }).click();
    await expect(page.getByRole("heading", { name: "What should the link say?" })).toBeVisible();
    await pageHasSettled(page);
    await page.getByRole("textbox", { name: "What should the link say?" }).fill(words);
    if (elsewhere) await page.locator("label.pick", { hasText: "A game somewhere else" }).click();
    await page.getByRole("button", { name: "Next" }).click({ timeout: SITE_ANSWER_TIMEOUT });
    await expect(page.getByRole("heading", { name: "Where does it go?" })).toBeVisible();
    await page.getByLabel("Where does it go?").fill(address);
    await page.getByRole("button", { name: "Save" }).click({ timeout: SITE_ANSWER_TIMEOUT });
    await expect(page).toHaveURL("/make/page");
    await page.getByRole("link", { name: /^Links/ }).click();
  }

  // A first question left empty is refused; an address that is not https is refused and kept.
  await page.getByRole("link", { name: "Add a link" }).click();
  await pageHasSettled(page);
  await page.getByRole("button", { name: "Next" }).click({ timeout: SITE_ANSWER_TIMEOUT });
  await expect(page.getByRole("alert")).toHaveText("Give the link a name.");
  await page.getByRole("textbox", { name: "What should the link say?" }).fill("My Discord");
  await page.getByRole("button", { name: "Next" }).click({ timeout: SITE_ANSWER_TIMEOUT });
  await page.getByLabel("Where does it go?").fill("http://discord.example.com/x");
  await page.getByRole("button", { name: "Save" }).click({ timeout: SITE_ANSWER_TIMEOUT });
  await expect(page.getByRole("alert")).toHaveText("A link starts with https://");
  await expect(page.getByLabel("Where does it go?")).toHaveValue("http://discord.example.com/x");
  await page.getByLabel("Where does it go?").fill("https://discord.example.com/invite/abc");
  await page.getByRole("button", { name: "Save" }).click({ timeout: SITE_ANSWER_TIMEOUT });
  await expect(page).toHaveURL("/make/page");
  await page.getByRole("link", { name: /^Links/ }).click();

  await addLink("My other game", "https://store.steampowered.com/app/1", true);
  const items = page.locator(".mylinks > li");
  await expect(items).toHaveCount(2);
  await expect(items.first()).toContainText("My Discord");
  await expect(items.nth(1)).toContainText("A game on Steam");
  await expect(items.first()).toContainText("Tapped 0 times.");
  // No Up on the first, no Down on the last.
  await expect(items.first().getByRole("button", { name: /Move .* up/ })).toHaveCount(0);
  await expect(items.nth(1).getByRole("button", { name: /Move .* down/ })).toHaveCount(0);
  await showTheOwner(page, testInfo, "Your links");

  await items
    .nth(1)
    .getByRole("button", { name: "Move My other game up" })
    .click({ timeout: SITE_ANSWER_TIMEOUT });
  await expect(items.first()).toContainText("My other game");

  await items
    .first()
    .getByRole("button", { name: "Hide My other game" })
    .click({ timeout: SITE_ANSWER_TIMEOUT });
  await expect(items.first()).toContainText("Hidden.");
  await page.goto(`/${handle}`);
  await expect(page.getByRole("link", { name: /My Discord/ })).toBeVisible();
  await expect(page.getByText("My other game")).toHaveCount(0);

  await page.goto("/make/page/links");
  await items
    .first()
    .getByRole("button", { name: "Show My other game" })
    .click({ timeout: SITE_ANSWER_TIMEOUT });
  await expect(items.first()).not.toContainText("Hidden.");
  const [otherLinkId = ""] = await items
    .first()
    .locator("input[name=link]")
    .evaluateAll((all) => all.map((one) => (one as HTMLInputElement).value));

  // Another maker's post for this link is the missing page, and nothing changes.
  const strangerContext = await browser.newContext({ baseURL: SITE });
  try {
    const stranger = await strangerContext.newPage();
    await forgetRateLimits();
    await signUp(stranger);
    await makePage(stranger, freshAddress());
    const posted = await stranger.request.post("/make/page/links?/remove", {
      form: { link: otherLinkId },
      headers: { origin: SITE },
    });
    expect(posted.status()).toBe(404);
  } finally {
    await strangerContext.close();
  }
  await page.goto("/make/page/links");
  await expect(items).toHaveCount(2);

  await items
    .first()
    .getByRole("button", { name: "Remove My other game" })
    .click({ timeout: SITE_ANSWER_TIMEOUT });
  await expect(items).toHaveCount(1);
});
