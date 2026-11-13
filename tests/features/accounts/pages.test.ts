import { isRedirect } from "@sveltejs/kit";
import { describe, expect, it } from "vitest";
import type { Caller } from "../../../src/features/accounts/caller.ts";
import { signedInOnly, signedInRedirect } from "../../../src/features/accounts/pages.ts";

const USER: Caller = { kind: "user", userId: "u1", sessionId: "s1", staffRoles: [] };

/** Where an action or load redirected, or null if it returned. */
function redirectOf(run: () => unknown): { status: number; location: string } | null {
  try {
    run();
  } catch (thrown) {
    if (isRedirect(thrown)) return { status: thrown.status, location: thrown.location };
    throw thrown;
  }
  return null;
}

describe("signedInRedirect (load for /sign-in and /sign-up)", () => {
  it("gives the page a safe next for a visitor", () => {
    const visitor: Caller = { kind: "none" };
    expect(signedInRedirect(visitor, new URL("http://localhost/sign-in?next=/me"))).toEqual({ next: "/me" });
    expect(signedInRedirect(visitor, new URL("http://localhost/sign-in?next=//evil.example"))).toEqual({
      next: "/",
    });
    expect(signedInRedirect(visitor, new URL("http://localhost/sign-in?next=https://evil.example"))).toEqual({
      next: "/",
    });
    expect(signedInRedirect(visitor, new URL("http://localhost/sign-in"))).toEqual({ next: "/" });
  });

  it("sends someone already signed in straight on to next", () => {
    expect(redirectOf(() => signedInRedirect(USER, new URL("http://localhost/sign-in?next=/me")))).toEqual({
      status: 303,
      location: "/me",
    });
  });
});

describe("signedInOnly (load for pages only a signed-in person sees)", () => {
  it("gives the user and the checked next", () => {
    expect(signedInOnly(USER, new URL("http://localhost/me?next=/join"))).toEqual({
      userId: "u1",
      next: "/join",
    });
    expect(signedInOnly(USER, new URL("http://localhost/me?next=//evil.example"))).toEqual({
      userId: "u1",
      next: "/",
    });
  });

  it("sends anyone else to sign in and back to this page afterwards", () => {
    expect(redirectOf(() => signedInOnly({ kind: "none" }, new URL("http://localhost/me?tab=1")))).toEqual({
      status: 303,
      location: "/sign-in?next=%2Fme%3Ftab%3D1",
    });
  });
});
