import { readdirSync } from "node:fs";
import { relative, resolve, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { kindsOfRoute, routeKind } from "../../../src/features/consent/consent.ts";

const ROUTES = resolve(import.meta.dirname, "../../../src/routes");

/** The route id of every `+server.ts`, `+page.server.ts` and `+page.ts` under src/routes (SvelteKit names routes by folder). */
function routeIds(): string[] {
  const ids = new Set<string>();
  for (const entry of readdirSync(ROUTES, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !/^\+(server|page\.server|page)\.ts$/.test(entry.name)) continue;
    const folder = relative(ROUTES, entry.parentPath).split(sep).join("/");
    ids.add(`/${folder}`);
  }
  return [...ids].sort();
}

describe("what every route does before a yes", () => {
  it("names every route exactly once: open, machine or gated", () => {
    const wrong = routeIds().filter((id) => kindsOfRoute(id).length !== 1);
    expect(wrong, `name these in src/features/consent/routes.ts: ${wrong.join(", ")}`).toEqual([]);
  });

  it("has no route in two kinds", () => {
    expect(routeIds().filter((id) => kindsOfRoute(id).length > 1)).toEqual([]);
  });

  it("gates the screens that keep something", () => {
    for (const id of [
      "/sign-in",
      "/sign-up",
      "/forgot-password",
      "/join",
      "/join/done",
      "/g/[game]/play",
      "/g/[game]/play/beat",
      "/api/auth/[...path]",
      "/me",
      "/make/new",
    ]) {
      expect(routeKind(id), id).toBe("gated");
    }
  });

  it("opens the screens a stranger reads, and treats servers as machines", () => {
    for (const id of [
      "/",
      "/[handle=handle]",
      "/g/[game]",
      "/help/github",
      "/legal/maker-agreement",
      "/cookies",
    ])
      expect(routeKind(id), id).toBe("open");
    for (const id of ["/webhooks/stripe", "/jobs/money", "/healthz"])
      expect(routeKind(id), id).toBe("machine");
  });

  it("gates a route it has never heard of, and opens a missing page", () => {
    expect(routeKind("/brand-new")).toBe("gated");
    expect(routeKind(null)).toBe("open");
  });
});
