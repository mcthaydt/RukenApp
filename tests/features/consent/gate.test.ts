import { isRedirect } from "@sveltejs/kit";
import { describe, expect, it, vi } from "vitest";
import { actionOfRoute, consentGate, stripCookies } from "../../../src/features/consent/consent.ts";

const CONSENT = "rk_consent=v1.2026-11-22; Path=/; HttpOnly; Max-Age=15552000";

interface Run {
  response: Response;
  allowed: boolean[];
  resolved: boolean;
  log: string[];
  html: string;
}

async function run(
  path: string,
  options: {
    agreed?: boolean;
    routeId: string | null;
    method?: string;
    answer?: () => Response;
    html?: string;
  },
): Promise<Run> {
  const log: string[] = [];
  const allowed: boolean[] = [];
  let resolved = false;
  let html = "";
  const handle = consentGate(
    (value) => allowed.push(value),
    (line) => log.push(line),
  );
  const url = new URL(path, "https://ruken.test");
  let response: Response;
  try {
    response = await handle({
      event: {
        url,
        request: new Request(url, { method: options.method ?? "GET" }),
        route: { id: options.routeId },
        cookies: {
          get: (name: string) => (options.agreed === true && name === "rk_consent" ? "v1" : undefined),
        },
      } as never,
      resolve: ((
        _event: unknown,
        resolveOptions?: { transformPageChunk?: (chunk: { html: string; done: boolean }) => string },
      ) => {
        resolved = true;
        html = resolveOptions?.transformPageChunk?.({ html: options.html ?? "", done: true }) ?? "";
        return Promise.resolve(options.answer?.() ?? new Response("ok"));
      }) as never,
    });
  } catch (error) {
    // A thrown redirect is how the gate sends a browser to the notice.
    if (!isRedirect(error)) throw error;
    response = new Response(null, { status: error.status, headers: { location: error.location } });
  }
  return { response, allowed, resolved, log, html };
}

const answerWith =
  (...lines: string[]) =>
  () => {
    const headers = new Headers();
    for (const line of lines) headers.append("set-cookie", line);
    return new Response("ok", { headers });
  };

describe("the consent gate", () => {
  it("lets a browser with no yes write nothing, and a browser with a yes write", async () => {
    expect((await run("/", { routeId: "/" })).allowed).toEqual([false]);
    expect((await run("/", { routeId: "/", agreed: true })).allowed).toEqual([true]);
  });

  it("lets servers write without a yes", async () => {
    expect((await run("/jobs/money", { routeId: "/jobs/money", method: "POST" })).allowed).toEqual([true]);
  });

  it("sends a gated page to the notice, naming what was pressed and where to go on", async () => {
    const answer = await run("/sign-in?next=/me", { routeId: "/sign-in" });
    expect(answer.resolved).toBe(false);
    expect(answer.response.status).toBe(303);
    expect(answer.response.headers.get("location")).toBe(
      "/cookies?for=sign-in&next=%2Fsign-in%3Fnext%3D%2Fme",
    );
  });

  it("refuses a script's call to a gated route", async () => {
    for (const [path, routeId] of [
      ["/api/auth/sign-out", "/api/auth/[...path]"],
      ["/g/x/play/beat", "/g/[game]/play/beat"],
    ] as const) {
      const answer = await run(path, { routeId, method: "POST" });
      expect(answer.resolved).toBe(false);
      expect(answer.response.status).toBe(403);
    }
  });

  it("opens a gated page for a browser that said yes", async () => {
    const answer = await run("/sign-in", { routeId: "/sign-in", agreed: true });
    expect(answer.resolved).toBe(true);
  });

  it("tells the page this browser agreed, and says no by default", async () => {
    const page = '<script data-rk-consent="no">';
    expect((await run("/", { routeId: "/", html: page })).html).toBe(page);
    expect((await run("/", { routeId: "/", html: page, agreed: true })).html).toBe(
      '<script data-rk-consent="yes">',
    );
  });

  it("removes a cookie set for a browser with no yes, and says which, never its value", async () => {
    const answer = await run("/", { routeId: "/", answer: answerWith("rk_arrival=secret; Path=/") });
    expect(answer.response.headers.getSetCookie()).toEqual([]);
    expect(answer.log).toEqual(["consent: dropped a cookie set before a yes: rk_arrival"]);
  });

  it("keeps the answer that gives the yes, with the arrival cookie set in the same answer", async () => {
    const answer = await run("/cookies", {
      routeId: "/cookies",
      method: "POST",
      answer: answerWith(CONSENT, "rk_arrival=x; Path=/"),
    });
    expect(answer.response.headers.getSetCookie()).toEqual([CONSENT, "rk_arrival=x; Path=/"]);
  });

  it("names what was pressed", () => {
    expect(actionOfRoute("/sign-in")).toBe("sign-in");
    expect(actionOfRoute("/forgot-password")).toBe("sign-in");
    expect(actionOfRoute("/sign-up")).toBe("sign-up");
    expect(actionOfRoute("/join")).toBe("join");
    expect(actionOfRoute("/g/[game]/play")).toBe("play");
    expect(actionOfRoute("/g/[game]/wishlist")).toBe("save");
    expect(actionOfRoute("/me")).toBe("account");
  });
});

describe("stripCookies", () => {
  it("keeps rk_consent and a deletion, drops the rest", () => {
    const headers = new Headers();
    for (const line of [CONSENT, "rk_arrival=; Max-Age=0; Path=/", "rk_session=abc; Path=/"])
      headers.append("set-cookie", line);
    const log = vi.fn();
    const stripped = stripCookies(new Response("ok", { headers }), log);
    expect(stripped.headers.getSetCookie()).toEqual([CONSENT, "rk_arrival=; Max-Age=0; Path=/"]);
    expect(log).toHaveBeenCalledOnce();
  });

  it("hands back the same answer when nothing is stray", () => {
    const response = new Response("ok");
    expect(stripCookies(response, vi.fn())).toBe(response);
  });
});
