// The consent feature's entry: what routes, the request hook and other features may import.
// Anything not exported here is internal to the feature.
export {
  agree,
  consentDay,
  CONSENT_COOKIE,
  CONSENT_VERSION,
  hasConsent,
  RUKEN_COOKIE_NAMES,
  takeBack,
} from "./cookies.ts";
export { actionOfRoute, consentGate, stripCookies, type GatedAction } from "./gate.ts";
export { kindsOfRoute, routeKind, type RouteKind } from "./routes.ts";
