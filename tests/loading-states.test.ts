// Every wait shows it (this-repo, "Every wait shows it"). The journeys in tests/browser/loading.test.ts show each loading
// sign working; this test keeps a new screen from leaving one out:
// - every <img> and <video> takes `use:loads`, the shimmer until it has loaded (a <noscript> copy has no script to run it);
// - every form with its own script (`use:enhance`) has a busy button: plain forms get theirs from the layout;
// - every <iframe> says when it has loaded, so its screen can show it is starting until then;
// - every `fetch(` on a screen sits in a file that shows a wait (`aria-busy`, or a "Starting…" screen it names).
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, test } from "vitest";

const ROOT = resolve(import.meta.dirname, "..");
const SRC = join(ROOT, "src");

function svelteFiles(folder: string): string[] {
  return readdirSync(folder, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".svelte"))
    .map((entry) => join(entry.parentPath, entry.name));
}

const screens = svelteFiles(SRC).map((path) => ({
  name: relative(ROOT, path),
  // A <noscript> copy runs no script, so it is left out of what is looked at.
  text: readFileSync(path, "utf8").replaceAll(/<noscript>[\s\S]*?<\/noscript>/g, ""),
}));

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
    const missing = screens
      .filter(({ text }) => text.includes("use:enhance") && !text.includes("aria-busy"))
      .map(({ name }) => name);
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

  test("every screen that fetches shows the wait", () => {
    const missing = screens
      .filter(({ text }) => text.includes("fetch(") && !/aria-busy|Starting \{/.test(text))
      .map(({ name }) => name);
    expect(missing).toEqual([]);
  });

  test("the layout carries the page bar and the busy plain forms", () => {
    const layout = readFileSync(join(SRC, "routes", "+layout.svelte"), "utf8");
    expect(layout).toContain("<PageLoading />");
    expect(layout).toContain("onsubmit={markSending}");
  });
});
