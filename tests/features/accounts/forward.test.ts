import { describe, expect, it, vi } from "vitest";
import { forwardToAuth } from "../../../src/features/accounts/forward.ts";

describe("forwardToAuth", () => {
  it("passes the request to better-auth with the client address in our header", async () => {
    const handler = vi.fn((request: Request) =>
      Promise.resolve(new Response(request.headers.get("x-ruken-client-ip"))),
    );
    const request = new Request("http://localhost:5173/api/auth/sign-in/email", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: "rk_session=x" },
      body: JSON.stringify({ email: "pat@example.test" }),
    });

    const response = await forwardToAuth(handler, request, "198.51.100.7");

    expect(await response.text()).toBe("198.51.100.7");
    const forwarded = handler.mock.calls[0]?.[0];
    expect(forwarded?.method).toBe("POST");
    expect(forwarded?.headers.get("cookie")).toBe("rk_session=x");
    expect(await forwarded?.clone().json()).toEqual({ email: "pat@example.test" });
  });

  it("replaces a client-sent copy of the header, so nobody picks their own rate-limit bucket", async () => {
    const handler = vi.fn((request: Request) =>
      Promise.resolve(new Response(request.headers.get("x-ruken-client-ip"))),
    );
    const request = new Request("http://localhost:5173/api/auth/get-session", {
      headers: { "x-ruken-client-ip": "1.2.3.4" },
    });

    const response = await forwardToAuth(handler, request, "198.51.100.7");

    expect(await response.text()).toBe("198.51.100.7");
  });

  it("marks the request as coming through the public route, whatever the client sent", async () => {
    const handler = vi.fn((request: Request) =>
      Promise.resolve(new Response(request.headers.get("x-ruken-public-route"))),
    );
    const request = new Request("http://localhost:5173/api/auth/sign-up/email", {
      method: "POST",
      headers: { "x-ruken-public-route": "" },
    });

    const response = await forwardToAuth(handler, request, "198.51.100.7");

    expect(await response.text()).toBe("1");
  });
});
