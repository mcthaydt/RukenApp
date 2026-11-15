import { error } from "@sveltejs/kit";
import { GAME_STAFF_ROLES, type Caller } from "../accounts/accounts.ts";

/**
 * The staff member behind a request to a staff page, or a missing page for anyone else. It is a 404 and not "forbidden",
 * so the address looks like any address the site does not have. Every `load` and every action calls it first: SvelteKit
 * runs an action without its layout's `load`, so a guard in a layout alone would leave a decision open to a post by hand.
 */
export function staffOnly(caller: Caller): { userId: string } {
  if (caller.kind !== "user") error(404, "Not found");
  if (!caller.staffRoles.some((role) => GAME_STAFF_ROLES.includes(role))) error(404, "Not found");
  return { userId: caller.userId };
}
