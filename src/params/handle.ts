import { isHandleShape } from "../features/pages/pages.browser.ts";

// The first word of an address, `/<handle>`, matches only when it has a maker's address shape. Ruken's own screens are
// fixed paths (`/me`, `/join`, `/make`), which a router tries before a matcher, so a reserved word still opens its own
// screen; a word with a capital or a dot is the ordinary missing page. The pages feature owns the rule, so the form,
// the server and this matcher cannot say different things.
export function match(param: string): boolean {
  return isHandleShape(param);
}
