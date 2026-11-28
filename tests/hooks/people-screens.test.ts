import { readdirSync } from "node:fs";
import { relative, resolve, sep } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { isRedirect } from "@sveltejs/kit";
import { nameGate, OPEN_SCREENS, PEOPLE_SCREENS } from "../../src/features/pages/people-screens.ts";

// Every screen is placed: a people screen, where an account with no page is asked its name first, or an open one. An
// endpoint (a folder with only +server.ts) is open and in neither list.

const ROUTES = resolve(import.meta.dirname, "../../src/routes");

/** Each route folder, with whether it holds a page (a screen) or only an endpoint. */
function routeFolders(): Map<string, "screen" | "endpoint"> {
  const folders = new Map<string, "screen" | "endpoint">();
  for (const entry of readdirSync(ROUTES, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !/^\+(server\.ts|page\.server\.ts|page\.ts|page(@\w*)?\.svelte)$/.test(entry.name))
      continue;
    const folder = relative(ROUTES, entry.parentPath).split(sep).join("/");
    const id = `/${folder}`;
    const kind = entry.name === "+server.ts" ? "endpoint" : "screen";
    if (folders.get(id) !== "screen") folders.set(id, kind);
  }
  return folders;
}

describe("the screens an account with no page is asked its name before", () => {
  const folders = routeFolders();
  const screens = [...folders].filter(([, kind]) => kind === "screen").map(([id]) => id);
  const endpoints = [...folders].filter(([, kind]) => kind === "endpoint").map(([id]) => id);

  it("finds the route folders", () => {
    expect(screens.length).toBeGreaterThan(40);
    expect(endpoints).toContain("/me/press");
  });

  it("places every screen in exactly one list", () => {
    const wrong = screens.filter((id) => Number(PEOPLE_SCREENS.has(id)) + Number(OPEN_SCREENS.has(id)) !== 1);
    expect(wrong, `place these in src/features/pages/people-screens.ts: ${wrong.join(", ")}`).toEqual([]);
  });

  it("names no endpoint and no folder that is not there", () => {
    const named = [...PEOPLE_SCREENS, ...OPEN_SCREENS];
    expect(named.filter((id) => folders.get(id) !== "screen")).toEqual([]);
  });

  it("keeps the question, the way out and the safety screens open", () => {
    for (const id of ["/me/name", "/sign-out", "/me/delete", "/me/password", "/me/computers", "/g/[game]/play"])
      expect(OPEN_SCREENS.has(id), id).toBe(true);
    for (const id of ["/", "/your-turn", "/search", "/g/[game]", "/me", "/make", "/[handle=handle]"])
      expect(PEOPLE_SCREENS.has(id), id).toBe(true);
  });
});

describe("the name gate", () => {
  /** What the gate does with one request: the address it sends to, or "through". */
  async function gate(
    routeId: string,
    caller: App.Locals["caller"],
    hasPage: boolean,
    path = "/your-turn?tab=1",
  ): Promise<string> {
    const resolve = vi.fn(() => Promise.resolve(new Response("ok")));
    const event = { locals: { caller }, route: { id: routeId }, url: new URL(`https://ruken.test${path}`) };
    try {
      // The handle reads only these three; the rest of the event is not used.
      await nameGate(() => Promise.resolve(hasPage))({ event, resolve } as never);
      return "through";
    } catch (thrown) {
      if (isRedirect(thrown)) return `${String(thrown.status)} ${thrown.location}`;
      throw thrown;
    }
  }

  const user: App.Locals["caller"] = { kind: "user", userId: "u1", sessionId: "s1", staffRoles: [] };

  it("sends an account with no page from a people screen to the question, carrying where it was going", async () => {
    expect(await gate("/your-turn", user, false)).toBe("303 /me/name?next=%2Fyour-turn%3Ftab%3D1");
  });

  it("lets an account with a page, a signed-out visitor and an open screen through", async () => {
    expect(await gate("/your-turn", user, true)).toBe("through");
    expect(await gate("/your-turn", { kind: "none" }, false)).toBe("through");
    expect(await gate("/me/name", user, false)).toBe("through");
    expect(await gate("/help", user, false)).toBe("through");
    expect(await gate("/me/press", user, false)).toBe("through");
  });
});
