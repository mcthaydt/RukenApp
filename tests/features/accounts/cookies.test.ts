import type { Cookies } from "@sveltejs/kit";
import { describe, expect, it, vi } from "vitest";
import { cookiePolicy, copyAuthCookies } from "../../../src/features/accounts/cookies.ts";

describe("cookiePolicy", () => {
  it("uses a __Host- name and Secure on an https origin", () => {
    const policy = cookiePolicy("https://ruken.test");
    expect(policy.secure).toBe(true);
    expect(policy.sessionCookieName).toBe("__Host-rk_session");
  });

  it("uses a plain name without Secure on http://localhost", () => {
    const policy = cookiePolicy("http://localhost:4173");
    expect(policy.secure).toBe(false);
    expect(policy.sessionCookieName).toBe("rk_session");
  });
});

// SvelteKit would add `Secure` to a cookie that better-auth sent without it (plain-http localhost) and
// would make every cookie HttpOnly, so the Set-Cookie lines are copied across as they were sent.
describe("copyAuthCookies", () => {
  type Parsed = ReturnType<Cookies["parse"]>;

  function fakeCookies(parsed: Record<string, Parsed>) {
    const set = vi.fn<Cookies["set"]>();
    const parse = vi.fn<Cookies["parse"]>((line) => parsed[line] ?? { name: "", value: "" });
    return { set, parse };
  }

  it("copies a cookie with the flags it was sent with", () => {
    const line = "rk_session=token; Path=/; HttpOnly; SameSite=Lax";
    const cookies = fakeCookies({
      [line]: { name: "rk_session", value: "token", path: "/", httpOnly: true },
    });

    copyAuthCookies(cookies, [line]);

    expect(cookies.set).toHaveBeenCalledWith("rk_session", "token", {
      path: "/",
      secure: false,
      httpOnly: true,
    });
  });

  it("does not add Secure or HttpOnly to a cookie that was sent without them", () => {
    const line = "flag=1; Path=/";
    const cookies = fakeCookies({ [line]: { name: "flag", value: "1", path: "/" } });

    copyAuthCookies(cookies, [line]);

    expect(cookies.set).toHaveBeenCalledWith("flag", "1", { path: "/", secure: false, httpOnly: false });
  });
});
