import { devices, type APIRequestContext, type Page } from "@playwright/test";

// The screen rules that a program can judge (CLAUDE.md, "Visual review", step 1). Each one is a measurement of the page
// the browser really drew, and each fails by itself: no model looks at a picture. A review by eye is for what a program
// cannot judge, such as whether the words are plain.
//
// The rules:
// - nothing scrolls sideways, and no text is cut off by its box;
// - every thing a finger presses is at least 44 by 44 px;
// - every link and every button leads somewhere real: no 404, no empty or "#" address, no button that does nothing;
// - every screen but the front page has a plain way back.

/** A window a person may hold, and whether it is a touch screen. */
export interface View {
  name: string;
  width: number;
  height: number;
  touch: boolean;
}

/** Playwright's own window for a device, the one a project in playwright.config.ts gives. */
function windowOf(device: string): { width: number; height: number } {
  const viewport = devices[device]?.viewport;
  if (viewport === undefined) throw new Error(`Playwright has no window for ${device}`);
  return viewport;
}

/** The two sizes of a phone or tablet: held upright, and held sideways. */
function bothWays(name: string, size: { width: number; height: number }): View[] {
  return [
    { name, ...size, touch: true },
    { name: `${name} sideways`, width: size.height, height: size.width, touch: true },
  ];
}

/**
 * Every window the screens are reviewed in (CLAUDE.md, "Visual review"): four phones and tablets, each upright and sideways,
 * and two whole computer windows. The Pixel's and the iPad's sizes are Playwright's own, the same as the projects in
 * playwright.config.ts; the two iPhones' are the sizes the other journeys give themselves.
 */
export const VIEWS: View[] = [
  ...bothWays("iPhone SE", { width: 320, height: 568 }),
  ...bothWays("large iPhone", { width: 430, height: 739 }),
  ...bothWays("Pixel", windowOf("Pixel 7")),
  ...bothWays("iPad", windowOf("iPad (gen 7)")),
  { name: "computer 1440x900", width: 1440, height: 900, touch: false },
  { name: "computer 1280x720", width: 1280, height: 720, touch: false },
];

/** The smallest side of a thing a finger presses, in px (Apple's guideline, and CLAUDE.md's). */
export const LEAST_TARGET = 44;

/**
 * The words that make a link or a button a way back. A link to Ruken's front page (the wordmark) is one too, whatever it
 * says. Said in the person's words: "Back to Ruken", "Cancel", "Keep my account", "Close".
 */
export const WAY_BACK_WORDS = /\b(back|cancel|keep|close|home|never mind|leave)\b/i;

export type Rule =
  "sideways scroll" | "text cut off" | "tap target too small" | "dead link" | "dead button" | "no way back";

/** One screen that breaks one rule, and how. */
export interface Finding {
  rule: Rule;
  screen: string;
  what: string;
}

/** What the page, as drawn in one window, says about itself. Plain data, so it can leave the browser. */
export interface Measured {
  /** Set when the whole page is wider than the window. */
  sidewaysScroll: string | null;
  /** Things that stick out past the window's left or right edge, outermost only. */
  offscreen: string[];
  /** Things whose box hides some of their own words. */
  cutOff: string[];
  /** Things a finger presses that are under 44 by 44 px. */
  small: string[];
  /** Buttons that are in no form and open nothing, so pressing one has nowhere to go. */
  looseButtons: string[];
  /** Whether a visible link or button is a way back. */
  wayBack: boolean;
  /** Every link on the page, seen or not. */
  links: { raw: string | null; href: string; text: string; fragmentMissing: boolean }[];
  /** Every address a form or a button sends to. */
  sends: { action: string; where: string }[];
}

/**
 * Measures the page as it is drawn in the window it is in. Call it after the page has settled (`layoutHasSettled`), so
 * nothing is still moving. It reads and changes nothing.
 */
export function measureScreen(page: Page): Promise<Measured> {
  return page.evaluate(
    ({ wayBackWords, least }): Measured => {
      const root = document.documentElement;
      const px = (value: number) => `${String(Math.round(value))}px`;
      const wayBack = new RegExp(wayBackWords, "i");

      // How a person would name a thing: its label, or else its words.
      const words = (element: Element) => element.textContent.trim().replace(/\s+/g, " ").slice(0, 40);
      const nameOf = (element: Element) => element.getAttribute("aria-label") ?? words(element);
      const describe = (element: Element) => {
        const classes = element.getAttribute("class")?.trim().split(/\s+/).join(".");
        const name = nameOf(element);
        return `<${element.tagName.toLowerCase()}${classes ? `.${classes}` : ""}>${name ? ` "${name}"` : ""}`;
      };

      // On the page and big enough to see. A box of a pixel or less is how a field is hidden from the eye and left to
      // the keyboard (the file picker's real field); its label is what a finger presses. Hidden for the screen reader
      // too (aria-hidden) means decoration, which no person reads or presses.
      const seen = (element: Element) => {
        const box = element.getBoundingClientRect();
        return (
          box.width > 1 &&
          box.height > 1 &&
          getComputedStyle(element).visibility !== "hidden" &&
          element.closest('[aria-hidden="true"]') === null
        );
      };
      const everything = [...document.body.querySelectorAll("*")].filter(seen);

      // 1. Sideways scroll: the page itself, and anything that sticks out where no box catches it.
      const sidewaysScroll =
        root.scrollWidth > root.clientWidth
          ? `the page is ${px(root.scrollWidth)} wide in a ${px(root.clientWidth)} window`
          : null;
      const catchesSideways = (element: Element) => {
        for (let up = element.parentElement; up !== null && up !== document.body; up = up.parentElement) {
          if (getComputedStyle(up).overflowX !== "visible") return true;
        }
        return false;
      };
      const stickingOut = new Set(
        everything.filter((element) => {
          const box = element.getBoundingClientRect();
          return (box.right > window.innerWidth + 0.5 || box.left < -0.5) && !catchesSideways(element);
        }),
      );
      const offscreen = [...stickingOut]
        .filter((element) => element.parentElement === null || !stickingOut.has(element.parentElement))
        .map((element) => {
          const box = element.getBoundingClientRect();
          return `${describe(element)} spans ${px(box.left)} to ${px(box.right)} in a ${px(window.innerWidth)} window`;
        });

      // 2. Cut-off words: a box that hides what overflows it, and has more inside than it shows. A box that scrolls
      // (auto or scroll) hides nothing, and a field scrolls its own value.
      const cutOff = everything
        .filter((element) => {
          if (["INPUT", "TEXTAREA", "SELECT"].includes(element.tagName) || words(element) === "")
            return false;
          const style = getComputedStyle(element);
          const hidesSideways = style.overflowX === "hidden" || style.overflowX === "clip";
          const hidesDown = style.overflowY === "hidden" || style.overflowY === "clip";
          return (
            (hidesSideways && element.scrollWidth > element.clientWidth + 1) ||
            (hidesDown && element.scrollHeight > element.clientHeight + 1)
          );
        })
        .map((element) => {
          // PROBE (temporary, removed before this change is ready): which child pushes the box wider than it shows.
          const edge = element.getBoundingClientRect().left + element.clientWidth;
          const wide = [...element.querySelectorAll("*")]
            .filter((child) => child.getBoundingClientRect().right > edge + 0.5)
            .slice(0, 6)
            .map((child) => {
              const box = child.getBoundingClientRect();
              return `${describe(child)} right=${box.right.toFixed(1)} w=${box.width.toFixed(1)}`;
            });
          const sizes = `scrollW=${String(element.scrollWidth)} clientW=${String(element.clientWidth)}`;
          return `${describe(element)} ${sizes} winW=${String(window.innerWidth)} past: ${wide.join(" ; ")}`;
        });

      // 3. Tap targets. A checkbox, a radio and a file field are pressed through their label, so the label is measured.
      const pressed = new Set<Element>();
      const pressables = document.body.querySelectorAll(
        'a[href], button, summary, select, textarea, input:not([type="hidden"]), [role="button"], [role="link"]',
      );
      for (const element of pressables) {
        if (element.matches(":disabled")) continue;
        let thing: Element = element;
        if (element instanceof HTMLInputElement && ["checkbox", "radio", "file"].includes(element.type)) {
          thing = element.closest("label") ?? element.labels?.item(0) ?? element;
        }
        if (seen(thing)) pressed.add(thing);
      }
      const small = [...pressed]
        .filter((element) => {
          const box = element.getBoundingClientRect();
          // 0.01 is rounding: a box laid out at 43.999px is 44px.
          return box.width + 0.01 < least || box.height + 0.01 < least;
        })
        .map((element) => {
          const box = element.getBoundingClientRect();
          return `${describe(element)} is ${box.width.toFixed(1)} by ${box.height.toFixed(1)}`;
        });

      // 4. A button with no form sends nothing. A button that closes or opens something says so (aria-controls,
      // aria-expanded) or sits in a dialog it closes.
      const looseButtons = [...document.body.querySelectorAll("button")]
        .filter(
          (button) =>
            seen(button) &&
            !button.disabled &&
            button.form === null &&
            button.closest("dialog") === null &&
            !button.hasAttribute("aria-controls") &&
            !button.hasAttribute("aria-expanded"),
        )
        .map(describe);

      // 5. A way back, in words or the way home.
      const hasWayBack = [...document.body.querySelectorAll("a[href], button")].some(
        (element) =>
          seen(element) &&
          (wayBack.test(nameOf(element)) ||
            (element instanceof HTMLAnchorElement &&
              new URL(element.href).origin === location.origin &&
              new URL(element.href).pathname === "/")),
      );

      // Where every link and every form goes, for the checks that need the network.
      const links = [...document.body.querySelectorAll<HTMLAnchorElement>("a[href]")].map((anchor) => {
        const raw = anchor.getAttribute("href");
        const id = raw?.startsWith("#") === true ? decodeURIComponent(raw.slice(1)) : "";
        return {
          raw,
          href: anchor.href,
          text: nameOf(anchor),
          fragmentMissing:
            id !== "" && document.getElementById(id) === null && document.getElementsByName(id).length === 0,
        };
      });
      const sends = [
        ...[...document.body.querySelectorAll("form")].map((form) => ({
          action: form.action,
          where: describe(form),
        })),
        ...[...document.body.querySelectorAll<HTMLButtonElement>("button[formaction]")].map((button) => ({
          action: button.formAction,
          where: describe(button),
        })),
      ];

      return { sidewaysScroll, offscreen, cutOff, small, looseButtons, wayBack: hasWayBack, links, sends };
    },
    { wayBackWords: WAY_BACK_WORDS.source, least: LEAST_TARGET },
  );
}

/**
 * The rules that need only the page: sideways scroll, cut-off words, tap targets, buttons that do nothing and the way
 * back. `isFrontPage` is the one screen that needs no way back, because it is the place the others go back to.
 */
export function viewFindings(screen: string, measured: Measured, isFrontPage: boolean): Finding[] {
  const found: Finding[] = [];
  if (measured.sidewaysScroll !== null)
    found.push({ rule: "sideways scroll", screen, what: measured.sidewaysScroll });
  for (const what of measured.offscreen) found.push({ rule: "sideways scroll", screen, what });
  for (const what of measured.cutOff) found.push({ rule: "text cut off", screen, what });
  for (const what of measured.small) found.push({ rule: "tap target too small", screen, what });
  for (const what of measured.looseButtons)
    found.push({ rule: "dead button", screen, what: `${what} is in no form and opens nothing` });
  if (!measured.wayBack && !isFrontPage)
    found.push({ rule: "no way back", screen, what: "no visible link or button goes back or home" });
  return found;
}

/** What an address answers, kept so each is asked once however many screens link to it. */
export type Answers = Map<string, Promise<number>>;

/** The status an address answers with a GET, after redirects. 0 when nothing answers. */
function answerOf(api: APIRequestContext, answers: Answers, url: URL): Promise<number> {
  const key = `${url.pathname}${url.search}`;
  let answer = answers.get(key);
  if (answer === undefined) {
    const withoutHash = new URL(url);
    withoutHash.hash = "";
    answer = api
      .get(withoutHash.href, { failOnStatusCode: false, maxRedirects: 5, timeout: 15_000 })
      .then((response) => response.status())
      .catch(() => 0);
    answers.set(key, answer);
  }
  return answer;
}

/**
 * The rules that need the network: every link and every form lands on a real screen. Only this site's own addresses are
 * asked (another site's is not ours to test, and the journeys have no network for it). `api` is a request context with
 * the same sign-in as the person who saw the page, and its own cookies, so asking a link changes nothing for the journey.
 *
 * A link is dead when it has no address, is "#", runs script, points at a part of the page that is not there, or answers
 * with an error. A form is dead when its address is not there (404), or breaks (500 or more). A form's address answers a
 * GET with 405 when it takes only a POST, which proves it is there.
 */
export async function linkFindings(
  screen: string,
  measured: Measured,
  api: APIRequestContext,
  siteOrigin: string,
  answers: Answers,
): Promise<Finding[]> {
  const found: Finding[] = [];
  const dead = (what: string) => found.push({ rule: "dead link", screen, what });
  for (const link of measured.links) {
    const name = link.text === "" ? "a link with no words" : `the link "${link.text}"`;
    if (link.raw === null || link.raw.trim() === "" || link.raw.trim() === "#") {
      dead(`${name} has no address (href="${link.raw ?? ""}")`);
    } else if (/^javascript:/i.test(link.raw.trim())) {
      dead(`${name} runs script instead of going anywhere`);
    } else if (link.fragmentMissing) {
      dead(`${name} points at ${link.raw}, which is not on the page`);
    } else if (link.raw.trim().startsWith("#")) {
      // A part of this very page, found above: there is no other address to ask.
      continue;
    } else {
      const url = new URL(link.href);
      if (!["http:", "https:"].includes(url.protocol) || url.origin !== siteOrigin) continue;
      const status = await answerOf(api, answers, url);
      if (status === 0 || status >= 400)
        dead(`${name} goes to ${url.pathname}${url.search}, which answers ${String(status)}`);
    }
  }
  for (const send of measured.sends) {
    const url = new URL(send.action);
    if (url.origin !== siteOrigin) continue;
    const status = await answerOf(api, answers, url);
    if (status === 0 || status === 404 || status >= 500)
      found.push({
        rule: "dead button",
        screen,
        what: `${send.where} sends to ${url.pathname}${url.search}, which answers ${String(status)}`,
      });
  }
  return found;
}
