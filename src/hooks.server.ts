import { sequence } from "@sveltejs/kit/hooks";
import { authServices, createHandle } from "./features/accounts/accounts.ts";
import { keepBackgroundWorkAlive } from "./lib/server/background.ts";

// keepBackgroundWorkAlive is first, so every route and form is inside it and mail sent after the
// answer is kept alive by the host. createHandle then says who sent the request; it builds the
// sign-in services on the first request that needs them, so /healthz answers without them.
export const handle = sequence(
  keepBackgroundWorkAlive,
  createHandle(() => authServices().handleDeps),
);
