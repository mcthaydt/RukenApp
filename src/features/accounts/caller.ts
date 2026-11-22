import type { StaffRole } from "../../lib/server/db.ts";

/**
 * Who sent this request, decided once by the request hook (handle.ts) and read by routes from
 * `event.locals.caller`. Routes never read cookies themselves. A person who is not signed in, or
 * whose account is waiting to be deleted, is `none`.
 */
export type Caller =
  | { kind: "user"; userId: string; sessionId: string; staffRoles: StaffRole[] }
  /** A computer's key under /api/v1 and nowhere else: the maker's actions in the maker's area, never staff's or money's. */
  | { kind: "computer"; userId: string; keyId: string }
  | { kind: "none" };
