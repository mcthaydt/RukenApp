import { readFileSync } from "node:fs";

// Reads the look's stylesheet (src/lib/look.css) as text, so a test or a journey can ask what a token is
// instead of writing the value a second time. Shared by tests/lib/look.test.ts and the browser journeys.

const LOOK_CSS_PATH = new URL("../../src/lib/look.css", import.meta.url);

/** The text of src/lib/look.css. */
export function lookCss(): string {
  return readFileSync(LOOK_CSS_PATH, "utf8");
}

/** The stylesheet's `:root` block, with comments dropped first so a comment cannot fake a token. */
function rootBlock(): string {
  const withoutComments = lookCss().replace(/\/\*[\s\S]*?\*\//g, "");
  return /:root\s*\{([^}]*)\}/.exec(withoutComments)?.[1] ?? "";
}

/** The value of `--name` in the `:root` block. Throws when it is missing, or declared more than once. */
export function token(name: string): string {
  const values = [...rootBlock().matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)]
    .filter((match) => match[1] === `--${name.replace(/^--/, "")}`)
    .map((match) => (match[2] ?? "").trim());
  if (values.length === 0) throw new Error(`look.css has no ${name}`);
  if (values.length > 1) throw new Error(`look.css declares ${name} twice`);
  return values[0] ?? "";
}

/** A browser's way of writing a colour: `rgb("#1c3a2f")` is `"rgb(28, 58, 47)"`. */
export function rgb(hex: string): string {
  const [red = 0, green = 0, blue = 0] = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16));
  return `rgb(${[red, green, blue].map(String).join(", ")})`;
}

/** WCAG 2.x relative luminance of a hex colour such as `#1a2b3c`. */
function luminance(hex: string): number {
  const channels = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16) / 255);
  const [red = 0, green = 0, blue = 0] = channels.map((c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

/** WCAG contrast ratio between two hex colours, 1 to 21. */
export function contrast(foreground: string, background: string): number {
  const [lighter = 0, darker = 0] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}
