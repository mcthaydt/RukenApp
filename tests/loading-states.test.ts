// Every wait shows it (this-repo, "Every wait shows it"). The journeys in tests/browser/loading.test.ts show each loading
// sign working; this test keeps a new screen from leaving one out:
// - every <img> and <video> takes `use:loads`, the shimmer until it has loaded (a <noscript> copy has no script to run it);
// - every form with its own script (`use:enhance`) has a busy button: plain forms get theirs from the layout;
// - every <iframe> says when it has loaded, so its screen can show it is starting until then;
// - every `fetch(` in a screen or a browser module (`*.browser.ts`) sits in a file that shows the wait with `aria-busy`,
//   or is a background call nobody waits on, listed below with why.
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, test } from "vitest";

const ROOT = resolve(import.meta.dirname, "..");
const SRC = join(ROOT, "src");

function filesEndingIn(folder: string, ending: string): string[] {
  return readdirSync(folder, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(ending))
    .map((entry) => join(entry.parentPath, entry.name));
}

const screens = filesEndingIn(SRC, ".svelte").map((path) => ({
  name: relative(ROOT, path),
  // A <noscript> copy runs no script, so it is left out of what is looked at.
  text: readFileSync(path, "utf8").replaceAll(/<noscript>[\s\S]*?<\/noscript>/g, ""),
}));

// Code that runs in the browser outside a screen: the feed's, a maker page's and the play screen's modules.
const browserModules = filesEndingIn(SRC, ".browser.ts").map((path) => ({
  name: relative(ROOT, path),
  text: readFileSync(path, "utf8"),
}));

/** Fetches nobody waits on, so they show nothing. Each says why; a new entry needs the same. */
const BACKGROUND_FETCHES: Record<string, string> = {
  // The play screen tells the site, now and then, that the game is still being played. The person is playing, not
  // waiting; the game frame's own "Starting…" screen covers the wait for the game.
  "src/features/play/PlayScreen.svelte": "the play-time beat",
};

/** Each opening tag of this element in the text, attributes and all. */
function tagsOf(text: string, element: string): string[] {
  return [...text.matchAll(new RegExp(`<${element}\\b[^>]*>`, "g"))].map((found) => found[0]);
}

describe("every wait shows it", () => {
  test("the screens are found", () => {
    expect(screens.length).toBeGreaterThan(20);
  });

  test("every picture and video shimmers until it has loaded", () => {
    const missing = screens.flatMap(({ name, text }) =>
      [...tagsOf(text, "img"), ...tagsOf(text, "video")]
        .filter((tag) => !tag.includes("use:loads"))
        .map((tag) => `${name}: ${tag.slice(0, 60)}`),
    );
    expect(missing).toEqual([]);
  });

  test("every form with its own script has a busy button", () => {
    // Each such form on its own, from <form to </form> (forms never nest): a busy button in one form of a file does not
    // cover another.
    const missing = screens.flatMap(({ name, text }) =>
      [...text.matchAll(/<form\b[\s\S]*?<\/form>/g)]
        .map((found) => found[0])
        .filter((form) => form.includes("use:enhance") && !form.includes("aria-busy="))
        .map((form) => `${name}: ${form.slice(0, 60)}`),
    );
    expect(missing).toEqual([]);
  });

  test("every frame says when it has loaded", () => {
    const missing = screens.flatMap(({ name, text }) =>
      tagsOf(text, "iframe")
        .filter((tag) => !tag.includes("onload"))
        .map(() => name),
    );
    expect(missing).toEqual([]);
  });

  test("every screen and browser module that fetches shows the wait", () => {
    const missing = [...screens, ...browserModules]
      .filter(({ text }) => text.includes("fetch(") && !text.includes("aria-busy"))
      .map(({ name }) => name)
      .filter((name) => BACKGROUND_FETCHES[name] === undefined);
    expect(missing).toEqual([]);
  });

  test("the browser modules are found", () => {
    expect(browserModules.length).toBeGreaterThan(0);
  });

  test("the layout carries the page bar and the busy plain forms", () => {
    const layout = readFileSync(join(SRC, "routes", "+layout.svelte"), "utf8");
    expect(layout).toContain("<PageLoading />");
    expect(layout).toContain("onsubmit={markSending}");
  });
});
