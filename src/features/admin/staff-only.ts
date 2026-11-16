import { error } from "@sveltejs/kit";
import { GAME_STAFF_ROLES, type Caller } from "../accounts/accounts.ts";

/**
 * Whether this caller is staff who check games. The one rule behind both the staff pages (`staffOnly`) and the doors to them
 * (a link only staff are shown), so a link is never offered to someone the page would turn away.
 */
export function isStaff(caller: Caller): boolean {
  return caller.kind === "user" && caller.staffRoles.some((role) => GAME_STAFF_ROLES.includes(role));
}

/**
 * The staff member behind a request to a staff page, or a missing page for anyone else. It is a 404 and not "forbidden",
 * so the address looks like any address the site does not have. Every `load` and every action calls it first: SvelteKit
 * runs an action without its layout's `load`, so a guard in a layout alone would leave a decision open to a post by hand.
 */
export function staffOnly(caller: Caller): { userId: string } {
  if (caller.kind !== "user" || !isStaff(caller)) error(404, "Not found");
  return { userId: caller.userId };
}
