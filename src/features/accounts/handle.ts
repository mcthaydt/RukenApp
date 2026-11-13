import type { Handle } from "@sveltejs/kit/hooks";
import type { StaffRole } from "../../lib/server/db.ts";
import type { SessionInfo } from "./auth.ts";
import type { CookiePolicy } from "./cookies.ts";

export interface HandleDeps {
  cookies: CookiePolicy;
  getSession(headers: Headers): Promise<SessionInfo | null>;
  staffRolesOf(userId: string): Promise<StaffRole[]>;
}

export function createHandle(getDeps: () => HandleDeps): Handle {
  throw new Error(`not built yet (${typeof getDeps})`);
}
