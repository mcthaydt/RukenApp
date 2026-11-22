import { describe, expect, it, vi } from "vitest";
import { HSTS_HEADER, httpsOnly } from "../../../src/features/accounts/https-only.ts";

// The 2026-11-22 sign-in bug: http://ruken.io answered with the full site, a phone signed in there, and the browser
// threw the Secure sign-in cookie away, so the person was back on Sign in with no word of why.

function eventFor(address: string, init: RequestInit = {}) {
  const url = new URL(address);
  return { url, request: new Request(url, init) };
}

async function answer(siteOrigin: string, address: string, init: RequestInit = {}) {
  const resolve = vi.fn(() => Promise.resolve(new Response("the page", { status: 200 })));
  const response = await httpsOnly(() => siteOrigin)({ event: eventFor(address, init) as never, resolve });
  return { response, resolved: resolve.mock.calls.length > 0 };
}

describe("httpsOnly on a site served over https", () => {
  it("sends a plain-http visit to the same address over https, before any page runs", async () => {
    const { response, resolved } = await answer("https://ruken.io", "http://ruken.io/sign-in?next=%2Fme");
    expect(resolved).toBe(false);
    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe("https://ruken.io/sign-in?next=%2Fme");
  });

  it("sends a form posted over plain http to https with its method kept, so the sign-in is not lost", async () => {
    const { response, resolved } = await answer("https://ruken.io", "http://ruken.io/sign-in", {
      method: "POST",
      body: "phone=1",
    });
    expect(resolved).toBe(false);
    // 308, not 301 or 302: a browser repeats the same POST at the new address.
    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe("https://ruken.io/sign-in");
  });

  it("keeps the address the visitor used, so the workers.dev address goes to its own https", async () => {
    const { response } = await answer("https://ruken.io", "http://ruken.example.workers.dev/g/a-game");
    expect(response.headers.get("location")).toBe("https://ruken.example.workers.dev/g/a-game");
  });

  it("redirects when a proxy in front says the visit came by http", async () => {
    const { response, resolved } = await answer("https://ruken.io", "https://ruken.io/", {
      headers: { "x-forwarded-proto": "http" },
    });
    expect(resolved).toBe(false);
    expect(response.status).toBe(308);
  });

  it("answers an https visit as usual, and tells the browser to use https from now on", async () => {
    const { response, resolved } = await answer("https://ruken.io", "https://ruken.io/sign-in");
    expect(resolved).toBe(true);
    expect(response.status).toBe(200);
    expect(response.headers.get("strict-transport-security")).toBe(HSTS_HEADER);
  });

  it("still lets the health probe answer over http", async () => {
    const { resolved } = await answer("https://ruken.io", "http://ruken.io/healthz");
    expect(resolved).toBe(true);
  });
});

describe("httpsOnly on a machine running the site over http", () => {
  it("changes nothing: no redirect and no HSTS", async () => {
    const { response, resolved } = await answer("http://localhost:4173", "http://localhost:4173/sign-in");
    expect(resolved).toBe(true);
    expect(response.headers.get("strict-transport-security")).toBeNull();
  });
});
