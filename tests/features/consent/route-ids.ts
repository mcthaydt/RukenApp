import { readdirSync } from "node:fs";
import { relative, resolve, sep } from "node:path";

const ROUTES = resolve(import.meta.dirname, "../../../src/routes");

/** The route id of every page and endpoint under src/routes: SvelteKit names a route by its folder, whatever files it holds. */
export function routeIds(): string[] {
  const ids = new Set<string>();
  for (const entry of readdirSync(ROUTES, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !/^\+(server\.ts|page\.server\.ts|page\.ts|page\.svelte)$/.test(entry.name))
      continue;
    const folder = relative(ROUTES, entry.parentPath).split(sep).join("/");
    ids.add(`/${folder}`);
  }
  return [...ids].sort();
}
