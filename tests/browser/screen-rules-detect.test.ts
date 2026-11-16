import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { layoutHasSettled } from "./support/look.ts";
import {
  linkFindings,
  measureScreen,
  VIEWS,
  viewFindings,
  type Finding,
  type Rule,
  type View,
} from "./support/screen-rules.ts";

// A rule that cannot fail is no rule. These journeys give each screen rule a page made to break it, and a page made to
// keep every rule, and check that the rule sees the one and passes the other. The real screens are walked by
// screen-rules.test.ts.

/** A page that breaks every rule once. Each breakage is marked by the word in its own words. */
const BREAKS_EVERY_RULE = `<!doctype html>
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Breaks every rule</title>
<body style="margin: 0; font: 16px sans-serif">
  <h1>Breaks every rule</h1>
  <div style="width: 1200px; height: 20px; background: #ccc">wide</div>
  <p style="width: 80px; overflow: hidden; white-space: nowrap">cutoffwords are far too long for their box</p>
  <a href="/" style="display: inline-block; width: 20px; height: 20px">tinylink</a>
  <p><a href="/no-such-page" style="display: inline-block; min-height: 48px">missingpage</a></p>
  <p><a href="#" style="display: inline-block; min-height: 48px">emptyaddress</a></p>
  <p><a href="#not-on-the-page" style="display: inline-block; min-height: 48px">missingpart</a></p>
  <p><a href="javascript:void(0)" style="display: inline-block; min-height: 48px">runsscript</a></p>
  <p><button type="button" style="min-width: 60px; min-height: 60px">loosebutton</button></p>
  <form method="post" action="/no-such-page">
    <button style="min-width: 60px; min-height: 60px">deadform</button>
  </form>
</body>`;

/** A page that keeps every rule: it fits, every press is 44 by 44, every address is real, and it has a way back. */
const KEEPS_EVERY_RULE = `<!doctype html>
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Keeps every rule</title>
<body style="margin: 0; font: 16px sans-serif">
  <h1>Keeps every rule</h1>
  <p style="max-width: 100%; overflow-wrap: anywhere">Plain words that wrap inside their box instead of leaving it.</p>
  <p><a href="#end" style="display: inline-block; min-width: 44px; min-height: 44px">Down</a></p>
  <p><a href="/healthz" style="display: inline-block; min-width: 44px; min-height: 44px">Health</a></p>
  <form method="post" action="/healthz">
    <button style="min-width: 44px; min-height: 44px">Send</button>
  </form>
  <label style="display: block; min-height: 44px; min-width: 44px">
    <input type="checkbox" style="position: absolute; opacity: 0; width: 1px; height: 1px"> Tick me
  </label>
  <p id="end"><a href="/" style="display: inline-block; min-width: 44px; min-height: 44px">Back to Ruken</a></p>
</body>`;

/** Serves a page made here at an address of the site, so its own links and forms are asked of the real site. */
async function serve(page: Page, path: string, html: string): Promise<void> {
  await page.route(`**${path}`, (route) => route.fulfill({ contentType: "text/html", body: html }));
}

/** Opens a served page in a window, and waits until it has settled. */
async function show(page: Page, path: string, view: View): Promise<void> {
  await page.setViewportSize({ width: view.width, height: view.height });
  await page.goto(path);
  await layoutHasSettled(page);
}

/** The first window, an iPhone SE. */
const SMALL_PHONE = VIEWS[0] ?? { name: "iPhone SE", width: 320, height: 568, touch: true };

/** Every finding for the page open now: the rules of the page and the rules of its links and forms together. */
async function findingsNow(page: Page, request: APIRequestContext, baseURL: string): Promise<Finding[]> {
  const measured = await measureScreen(page);
  const links = await linkFindings("a made page", measured, request, new URL(baseURL).origin, new Map());
  return [...viewFindings("a made page", measured, false), ...links];
}

/** One browser project is enough: the pages and the window are made here. */
function onlyOnTheComputer(): void {
  test.skip(test.info().project.name !== "computer", "the pages and the window are made here");
}

/** The site's address, which the journeys always have. */
function siteOf(baseURL: string | undefined): string {
  if (baseURL === undefined) throw new Error("the site's address is not set");
  return baseURL;
}

test.describe("each screen rule fails on a page made to break it", () => {
  const cases: { rule: Rule; sees: string }[] = [
    { rule: "sideways scroll", sees: "the page is" },
    { rule: "text cut off", sees: "cutoffwords" },
    { rule: "tap target too small", sees: "tinylink" },
    { rule: "dead link", sees: "missingpage" },
    { rule: "dead link", sees: "emptyaddress" },
    { rule: "dead link", sees: "missingpart" },
    { rule: "dead link", sees: "runsscript" },
    { rule: "dead button", sees: "loosebutton" },
    { rule: "dead button", sees: "/no-such-page" },
  ];
  for (const { rule, sees } of cases) {
    test(`${rule}: sees "${sees}"`, async ({ page, playwright, baseURL }) => {
      onlyOnTheComputer();
      const site = siteOf(baseURL);
      const request = await playwright.request.newContext({ baseURL: site });
      await serve(page, "/breaks-every-rule", BREAKS_EVERY_RULE);
      await show(page, "/breaks-every-rule", SMALL_PHONE);
      const found = await findingsNow(page, request, site);
      await request.dispose();
      expect(found.filter((one) => one.rule === rule && one.what.includes(sees))).not.toHaveLength(0);
    });
  }
});

test("a page that keeps every rule has no findings", async ({ page, playwright, baseURL }) => {
  onlyOnTheComputer();
  const site = siteOf(baseURL);
  const request = await playwright.request.newContext({ baseURL: site });
  await serve(page, "/keeps-every-rule", KEEPS_EVERY_RULE);
  const found: Finding[] = [];
  for (const view of VIEWS) {
    await show(page, "/keeps-every-rule", view);
    const here = await findingsNow(page, request, site);
    found.push(...here.map((one) => ({ ...one, screen: `${one.screen} in ${view.name}` })));
  }
  await request.dispose();
  expect(found).toEqual([]);
});

test("the front page needs no way back, and no other page is let off", async ({ page }) => {
  onlyOnTheComputer();
  await serve(page, "/has-no-way-back", "<!doctype html><title>x</title><h1>Nowhere to go</h1>");
  await show(page, "/has-no-way-back", SMALL_PHONE);
  const measured = await measureScreen(page);
  expect(viewFindings("the front page", measured, true)).toEqual([]);
  expect(viewFindings("any other page", measured, false).map((one) => one.rule)).toEqual(["no way back"]);
});
