import type { Cookies } from "@sveltejs/kit";
import { describe, expect, it, vi } from "vitest";
import { ARRIVAL_COOKIE } from "../../../src/features/membership/arrival.ts";
import { SIGN_UP_COOKIE } from "../../../src/features/accounts/forms.ts";
import { cookiePolicy, WELCOME_BACK_COOKIE } from "../../../src/features/accounts/cookies.ts";
import {
  agree,
  CONSENT_COOKIE,
  consentDay,
  hasConsent,
  RUKEN_COOKIE_NAMES,
  takeBack,
} from "../../../src/features/consent/consent.ts";

describe("the consent cookie", () => {
  it("says yes only to the current wording", () => {
    expect(hasConsent({ get: () => "v1" })).toBe(true);
    expect(hasConsent({ get: () => "v1.2026-11-22" })).toBe(true);
    expect(hasConsent({ get: () => "v10" })).toBe(false);
    expect(hasConsent({ get: () => "v0" })).toBe(false);
    expect(hasConsent({ get: () => undefined })).toBe(false);
  });

  it("is set for 180 days, HttpOnly, Lax and Secure on https", () => {
    const set = vi.fn<Cookies["set"]>();
    agree({ set }, true, "2026-11-22");
    expect(set).toHaveBeenCalledWith("rk_consent", "v1.2026-11-22", {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      maxAge: 15_552_000,
    });
  });
});

describe("the day of the yes", () => {
  it("is read back from the cookie", () => {
    expect(consentDay({ get: () => "v1.2026-11-22" })).toBe("2026-11-22");
    expect(consentDay({ get: () => "v1" })).toBeNull();
    expect(consentDay({ get: () => undefined })).toBeNull();
  });
});

describe("taking it back", () => {
  it("deletes every Ruken cookie this browser sent, the consent last, on the path it was set", () => {
    const names = [CONSENT_COOKIE, ARRIVAL_COOKIE, SIGN_UP_COOKIE, "__Host-rk_session", "other-site"];
    const deleted: string[] = [];
    const paths: Record<string, string | undefined> = {};
    takeBack({
      getAll: () => names.map((name) => ({ name, value: "x" })),
      delete: (name, options) => {
        deleted.push(name);
        paths[name] = options?.path;
      },
    });
    expect(deleted.at(-1)).toBe("rk_consent");
    expect(deleted.sort()).toEqual(["__Host-rk_session", "rk_arrival", "rk_consent", "ruken_sign_up"]);
    expect(paths.ruken_sign_up).toBe("/sign-up");
  });

  it("knows every cookie the code sets", () => {
    const session = cookiePolicy("https://ruken.test").sessionCookieName;
    for (const name of [
      ARRIVAL_COOKIE,
      SIGN_UP_COOKIE,
      WELCOME_BACK_COOKIE,
      session,
      "rk_session_data",
      "rk_follow_pressed",
    ]) {
      expect(RUKEN_COOKIE_NAMES).toContain(name);
    }
  });
});
