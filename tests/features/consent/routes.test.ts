import { describe, expect, it } from "vitest";
import { kindsOfRoute, routeKind } from "../../../src/features/consent/consent.ts";
import { routeIds } from "./route-ids.ts";

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
      "/[handle=handle]/follow",
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
      "/privacy",
      "/terms",
      "/legal/maker-agreement",
      "/cookies",
    ])
      expect(routeKind(id), id).toBe("open");
    for (const id of ["/webhooks/stripe", "/jobs/money", "/healthz"])
      expect(routeKind(id), id).toBe("machine");
  });

  // A swipe or RB from Followed must land on Your turn with its top bar, never on the cookie notice (plan audit 3); only
  // what keeps something under it is gated.
  it("opens the Your turn tab and gates every route under it", () => {
    expect(routeKind("/your-turn")).toBe("open");
    for (const id of [
      "/your-turn/send",
      "/your-turn/seen",
      "/your-turn/remove",
      "/your-turn/stop",
      "/your-turn/stopped",
    ])
      expect(routeKind(id), id).toBe("gated");
  });

  it("gates a route it has never heard of, and opens a missing page", () => {
    expect(routeKind("/brand-new")).toBe("gated");
    expect(routeKind(null)).toBe("open");
  });
});
