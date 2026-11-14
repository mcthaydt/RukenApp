import { authServices, createHandle } from "./features/accounts/accounts.ts";
import { requireEnv } from "./lib/server/env.ts";
import { setPlatform } from "./lib/server/platform.ts";

// The platform is what the host gives that code cannot get anywhere else. Until the site runs on Workers
// (the next task) it still runs in Node, where started work runs to its end by itself and the database's
// address is a setting.
setPlatform({ databaseUrl: () => requireEnv("DATABASE_URL"), waitUntil: () => undefined });

// createHandle says who sent the request; it builds the sign-in services on the first request that needs
// them, so /healthz answers without them.
export const handle = createHandle(() => authServices().handleDeps);
