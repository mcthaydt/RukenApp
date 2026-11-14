import type { Cookies } from "@sveltejs/kit";
import Stripe from "stripe";
import { afterAll, describe, expect, it } from "vitest";
import {
  createMembershipServices,
  stripeKeyMode,
  stripeModeProblem,
} from "../../../src/features/membership/services.ts";
import { createPrismaClient } from "../../../src/lib/server/db.ts";
import { TestClock } from "../../support/test-clock.ts";

// The services are built from the settings. Nothing here connects: the database address is one that
// nothing listens on, and Stripe is never called.

const SETTINGS = {
  STRIPE_SECRET_KEY: "sk_test_fake",
  STRIPE_WEBHOOK_SECRET: "whsec_test_fake",
  STRIPE_LIVE: "false",
  BETTER_AUTH_URL: "https://ruken.example",
  BETTER_AUTH_SECRET: "a".repeat(32),
};

const NOW = "2026-11-13T12:00:00Z";
const prisma = createPrismaClient("postgresql://postgres:x@127.0.0.1:1/ruken");

afterAll(async () => {
  await prisma.$disconnect();
});

function build(changes: Record<string, string | undefined> = {}, clock = new TestClock(NOW)) {
  const cookies = { secure: true, sessionCookieName: "__Host-rk_session" };
  return createMembershipServices({ ...SETTINGS, ...changes }, { prisma, clock, cookies });
}

type CookieOptions = Parameters<Cookies["set"]>[2];

/** A cookie jar that remembers what was set, the way SvelteKit's does. */
function cookieJar() {
  const stored = new Map<string, { value: string; options: CookieOptions }>();
  return {
    stored,
    set(name: string, value: string, options: CookieOptions) {
      stored.set(name, { value, options });
    },
    get(name: string): string | undefined {
      return stored.get(name)?.value;
    },
  };
}

describe("the Stripe client", () => {
  it("is part of what the services answer, for features above the membership to use", () => {
    expect(build().stripe).toBeInstanceOf(Stripe);
  });
});

describe("the arrival cookie", () => {
  it("answers what remember set, with the clock's time", () => {
    const { arrival } = build();
    const jar = cookieJar();
    arrival.remember(jar, { makerUserId: "maker-1", path: "/g/a-game" });
    expect(arrival.read(jar)).toEqual({
      makerUserId: "maker-1",
      path: "/g/a-game",
      atMs: Date.parse(NOW),
    });
  });

  it("is set so only the server can write it and a browser keeps it for 400 days", () => {
    const { arrival } = build();
    const jar = cookieJar();
    arrival.remember(jar, { makerUserId: "maker-1", path: "/g/a-game" });
    expect(jar.stored.get("rk_arrival")?.options).toMatchObject({
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      maxAge: 34_560_000,
    });
  });

  it("each new arrival replaces the last", () => {
    const clock = new TestClock(NOW);
    const { arrival } = build({}, clock);
    const jar = cookieJar();
    arrival.remember(jar, { makerUserId: "maker-1", path: "/g/a-game" });
    clock.advance(1000);
    arrival.remember(jar, { makerUserId: "maker-2", path: "/other" });
    expect(arrival.read(jar)).toMatchObject({ makerUserId: "maker-2", path: "/other" });
  });

  it("answers null for a cookie typed by hand, and for no cookie", () => {
    const { arrival } = build();
    const jar = cookieJar();
    expect(arrival.read(jar)).toBeNull();
    jar.set("rk_arrival", "eyJtYWtlclVzZXJJZCI6Im1ha2VyLTEifQ.forged", { path: "/" });
    expect(arrival.read(jar)).toBeNull();
  });
});

describe("verify", () => {
  const payload = JSON.stringify({ id: "evt_1", object: "event", type: "invoice.paid" });

  it("accepts a delivery signed with the webhook secret at the clock's time", async () => {
    const services = build();
    const signature = await Stripe.webhooks.generateTestHeaderStringAsync({
      payload,
      secret: "whsec_test_fake",
      timestamp: Date.parse(NOW) / 1000,
    });
    await expect(services.verify(payload, signature)).resolves.toMatchObject({ id: "evt_1" });
  });

  it("rejects a delivery signed with another secret", async () => {
    const services = build();
    const signature = await Stripe.webhooks.generateTestHeaderStringAsync({
      payload,
      secret: "whsec_other",
      timestamp: Date.parse(NOW) / 1000,
    });
    await expect(services.verify(payload, signature)).rejects.toThrow();
  });
});

describe("the settings", () => {
  it("builds from good settings", () => {
    expect(() => build()).not.toThrow();
  });

  it("stops without the webhook secret, naming it", () => {
    expect(() => build({ STRIPE_WEBHOOK_SECRET: undefined })).toThrow(
      "Missing setting STRIPE_WEBHOOK_SECRET",
    );
  });

  it("stops without the Stripe key, naming it", () => {
    expect(() => build({ STRIPE_SECRET_KEY: undefined })).toThrow("Missing setting STRIPE_SECRET_KEY");
  });

  it("stops when STRIPE_LIVE is neither true nor false", () => {
    expect(() => build({ STRIPE_LIVE: "maybe" })).toThrow(/STRIPE_LIVE/);
    expect(() => build({ STRIPE_LIVE: undefined })).toThrow("Missing setting STRIPE_LIVE");
  });

  it("never lets a live site be pointed at a stand-in Stripe", () => {
    expect(() =>
      build({
        STRIPE_LIVE: "true",
        STRIPE_SECRET_KEY: "sk_live_x",
        STRIPE_API_BASE: "http://127.0.0.1:12111",
      }),
    ).toThrow(/STRIPE_API_BASE/);
    expect(() => build({ STRIPE_API_BASE: "http://127.0.0.1:12111" })).not.toThrow();
  });

  it("stops when the key's mode and STRIPE_LIVE disagree", () => {
    expect(() => build({ STRIPE_SECRET_KEY: "sk_live_x", STRIPE_LIVE: "false" })).toThrow(/live key/);
    expect(() => build({ STRIPE_SECRET_KEY: "sk_test_x", STRIPE_LIVE: "true" })).toThrow(/test key/);
    expect(() => build({ STRIPE_SECRET_KEY: "rk_live_x", STRIPE_LIVE: "false" })).toThrow(/live key/);
  });

  it("stops for a key with no known prefix", () => {
    expect(() => build({ STRIPE_SECRET_KEY: "made-up" })).toThrow(/not a Stripe secret or restricted key/);
  });

  it("accepts a live key with STRIPE_LIVE=true, and a restricted test key", () => {
    expect(() => build({ STRIPE_SECRET_KEY: "sk_live_x", STRIPE_LIVE: "true" })).not.toThrow();
    expect(() => build({ STRIPE_SECRET_KEY: "rk_test_x" })).not.toThrow();
  });
});

describe("the key's mode", () => {
  it.each([
    ["sk_live_abc", "live"],
    ["rk_live_abc", "live"],
    ["sk_test_abc", "test"],
    ["rk_test_abc", "test"],
    ["pk_test_abc", undefined],
    ["", undefined],
  ] as const)("reads %j as %j", (key, mode) => {
    expect(stripeKeyMode(key)).toBe(mode);
  });

  it("has no problem when the mode matches", () => {
    expect(stripeModeProblem("sk_test_abc", false)).toBeUndefined();
    expect(stripeModeProblem("sk_live_abc", true)).toBeUndefined();
  });
});
