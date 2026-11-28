import { expect, test, type Page } from "@playwright/test";
import { pageHasSettled, signUp } from "./support/account.ts";
import { givePage } from "./support/database.ts";
import { boxOf, showTheOwner, type Box } from "./support/look.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";
import { asInstalled } from "./support/installed.ts";

// Social icons on a maker's page (feed-and-makers-page spec, unit K, K4 to K6): a maker adds a small icon for a site
// Ruken has a mark for, a visitor sees it as a round link after the page's links and taps through Ruken's own address,
// the maker changes it and takes it away again; a site Ruken has no mark for is refused in plain words.

test.beforeEach(({ page }) => asInstalled(page));
test.beforeEach(forgetRateLimits);

const ICON_CHOICE = "A small icon, for YouTube, Discord and the like";

/** Whether two boxes share any area. */
const overlap = (a: Box, b: Box): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/** Adds a link through the room's two questions, as a person taps them. */
async function addLink(page: Page, words: string, address: string, icon: boolean): Promise<void> {
  await page.goto("/make/page/links");
  await pageHasSettled(page);
  await page.getByRole("link", { name: "Add a link" }).click();
  await page.getByLabel("What should the link say?").fill(words);
  if (icon) {
    await page.locator("label.pick", { hasText: ICON_CHOICE }).click();
    await expect(page.getByLabel(ICON_CHOICE)).toBeChecked();
  }
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Where does it go?");
  await page.getByLabel("Where does it go?").fill(address);
  await page.getByRole("button", { name: "Save" }).click();
}

test("a maker's page with social icons: add, see, tap, change and remove an icon", async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  const maker = await signUp(page);
  const { handle } = await givePage(maker, {
    name: "Icon Maker",
    oneLine: "",
    links: [{ title: "My site", url: "https://example.com/mine" }],
  });

  // The two kinds stand alone: ticking the icon unticks the game, and the other way round.
  await page.goto("/make/page/links/add");
  await pageHasSettled(page);
  await page.locator("label.pick", { hasText: "A game somewhere else" }).click();
  await page.locator("label.pick", { hasText: ICON_CHOICE }).click();
  await expect(page.getByLabel(ICON_CHOICE)).toBeChecked();
  await expect(page.getByLabel("A game somewhere else")).not.toBeChecked();

  // A site with no icon is refused in plain words, and the address stays to fix.
  await addLink(page, "My blog", "https://blog.example.com", true);
  await expect(page.getByRole("alert")).toHaveText(
    "We don't have an icon for that site yet. Add it as a link.",
  );
  await expect(page.getByLabel("Where does it go?")).toHaveValue("https://blog.example.com");

  // Create: two icons.
  await addLink(page, "Our Discord", "https://discord.gg/abc", true);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your links");
  await addLink(page, "Videos", "https://www.youtube.com/@iconmaker", true);
  const rows = page.locator("form[data-link]");
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(1)).toContainText("A small icon");

  // Read: on the page the icons sit after the links, each a 48px round link named for its site, through /out/.
  await page.goto(`/${handle}`);
  const words = page.getByRole("navigation", { name: "Links" }).getByRole("link");
  await expect(words).toHaveCount(1);
  await expect(words.first()).toContainText("My site");
  const icons = page.getByRole("navigation", { name: "Elsewhere" }).getByRole("link");
  await expect(icons).toHaveCount(2);
  await expect(icons.nth(0)).toHaveAccessibleName("Discord");
  await expect(icons.nth(1)).toHaveAccessibleName("YouTube");
  await expect(icons.nth(0)).toHaveAttribute("href", new RegExp(`^/${handle}/out/`));
  const linksBox = await boxOf(page.getByRole("navigation", { name: "Links" }));
  for (const icon of await icons.all()) {
    const box = await boxOf(icon);
    expect(box.width).toBeGreaterThanOrEqual(48);
    expect(box.height).toBeGreaterThanOrEqual(48);
    expect(box.y).toBeGreaterThan(linksBox.y + linksBox.height - 1);
  }
  // Tapping one goes through Ruken's address to the site.
  const sent = await page.request.get((await icons.nth(0).getAttribute("href")) ?? "", { maxRedirects: 0 });
  expect(sent.status()).toBe(303);
  expect(sent.headers().location).toBe("https://discord.gg/abc");
  // Nothing on the page overlaps, at the small windows the owner named.
  for (const size of [
    { width: 320, height: 568 },
    { width: 375, height: 667 },
    { width: 667, height: 375 },
  ]) {
    await page.setViewportSize(size);
    const controls = await page.locator("a:visible, button:visible").all();
    const boxes: { name: string; box: Box }[] = [];
    for (const control of controls) {
      const box = await control.boundingBox();
      if (box === null || box.width === 0) continue;
      boxes.push({ name: (await control.getAttribute("aria-label")) ?? (await control.innerText()), box });
    }
    for (const [index, one] of boxes.entries())
      for (const other of boxes.slice(index + 1))
        expect(
          overlap(one.box, other.box),
          `"${one.name}" overlaps "${other.name}" at ${String(size.width)}×${String(size.height)}`,
        ).toBe(false);
  }
  await page.setViewportSize({ width: 375, height: 667 });
  await showTheOwner(page, testInfo, "a maker's page with social icons");

  // Update: the Discord icon becomes a GitHub one; changed to a site with no icon, it is refused.
  await page.goto("/make/page/links");
  await pageHasSettled(page);
  await rows.nth(1).getByRole("link", { name: "Change" }).click();
  await expect(page.getByLabel(ICON_CHOICE)).toBeChecked();
  await page.getByRole("button", { name: "Save" }).click();
  await page.getByLabel("Where does it go?").fill("https://example.com/nope");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "We don't have an icon for that site yet. Add it as a link.",
  );
  await page.getByLabel("Where does it go?").fill("https://github.com/iconmaker");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your links");
  await page.goto(`/${handle}`);
  await expect(icons.nth(0)).toHaveAccessibleName("GitHub");

  // Delete: removing both icons takes the row away.
  for (let left = 2; left > 0; left -= 1) {
    await page.goto("/make/page/links");
    await pageHasSettled(page);
    await rows.nth(1).getByRole("button", { name: "Remove" }).click();
    await expect(rows).toHaveCount(left);
  }
  await page.goto(`/${handle}`);
  await expect(page.getByRole("navigation", { name: "Elsewhere" })).toHaveCount(0);
  await expect(words).toHaveCount(1);
});
