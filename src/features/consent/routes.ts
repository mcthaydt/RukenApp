// What each route does before a visitor has said yes (design 3.7). Every route is exactly one of three kinds; a test
// fails for a route in none of them, so a new route must be named here before CI passes. Names are SvelteKit route ids.

/**
 * Open: answers without a yes. The write guard stays on, so an open route that tried to keep something would fail.
 */
const OPEN: readonly string[] = [
  "/",
  "/about",
  "/[handle=handle]",
  "/[handle=handle]/out/[link]",
  "/g/[game]",
  // A report: anyone may ask, so the sheet can say "Sign in". Only a signed-in person, who said yes to sign in, keeps one.
  "/g/[game]/report",
  "/goodbye",
  "/cookies",
  "/api/feed",
  // The feed's Followed tab and Search only read: nothing is kept on the device or about the person.
  "/followed",
  "/search",
  "/api/still/[...key]",
  "/help",
  "/help/get-your-game-on-ruken",
  "/help/github",
  "/help/how-the-feed-works",
  "/help/record-screen",
  "/legal/maker-agreement",
  "/privacy",
  "/terms",
];

/**
 * Machine: called by a server, never a visitor's browser, so writes are allowed without a yes.
 * - /webhooks/stripe: Stripe, signed.
 * - /jobs/*: the cron jobs and the owner's own calls, signed with a secret.
 * - /healthz: writes nothing.
 * - /api/v1/*: the `ruken` command on a person's own computer, which has no browser to say yes in; its keys are the
 *   person's own asking, and the privacy page says what is kept.
 */
const MACHINE: readonly string[] = ["/webhooks/stripe", "/healthz", "/jobs", "/api/v1"];

/**
 * Gated: shows the notice or refuses without a yes. A path matches itself and everything under it. A route in none of
 * the three kinds is neither of these either, and fails the test.
 */
export const GATED: readonly string[] = [
  "/sign-in",
  "/sign-up",
  "/sign-out",
  "/forgot-password",
  "/join",
  "/g/[game]/play",
  "/g/[game]/wishlist",
  // Following a maker keeps a row, and signed out a cookie for the way back from sign-up.
  "/[handle=handle]/follow",
  "/api/auth",
  "/api/feed/marks",
  "/me",
  "/make",
];

export type RouteKind = "open" | "machine" | "gated";

const under = (routeId: string, prefix: string): boolean =>
  routeId === prefix || routeId.startsWith(`${prefix}/`);

/** Every kind a route id belongs to. A route has exactly one; the test fails otherwise. */
export function kindsOfRoute(routeId: string): RouteKind[] {
  const kinds: RouteKind[] = [];
  if (OPEN.includes(routeId)) kinds.push("open");
  if (MACHINE.some((prefix) => under(routeId, prefix))) kinds.push("machine");
  if (GATED.some((prefix) => under(routeId, prefix))) kinds.push("gated");
  return kinds;
}

/**
 * The kind of a request's route. A request with no route (a missing page) is open. A route this list has never heard
 * of is gated, so a forgotten one keeps nothing.
 */
export function routeKind(routeId: string | null): RouteKind {
  if (routeId === null) return "open";
  return kindsOfRoute(routeId)[0] ?? "gated";
}
