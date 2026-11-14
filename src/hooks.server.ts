import type { Handle } from "@sveltejs/kit";
import { sequence } from "@sveltejs/kit/hooks";
import { authServices, createHandle } from "./features/accounts/accounts.ts";
import { cloudflareFiles, cloudflarePlatform } from "./lib/server/cloudflare.ts";
import { databasePerRequest, diagRequestId } from "./lib/server/db.ts";
import { setFileStore } from "./lib/server/files.ts";
import { setPlatform } from "./lib/server/platform.ts";

// The platform is what the host gives that code cannot get anywhere else: the database's address and a way to
// keep work alive after the answer.
setPlatform(cloudflarePlatform);
// The bucket that holds games and clips.
setFileStore(cloudflareFiles);

// databasePerRequest is first, so every route and form reaches its own request's database client. createHandle
// then says who sent the request; it builds the sign-in services on the first request that needs them, so
// /healthz answers without them.
// DIAGNOSTIC ONLY: one line when a request starts and one when it ends, so the log shows which never ended. On
// each start it also names every request still running after 4 seconds.
const running = new Map<number, { path: string; started: number }>();
const trace: Handle = async ({ event, resolve }) => {
  const id = diagRequestId();
  const started = Date.now();
  for (const [other, info] of running) {
    if (started - info.started > 4000) {
      console.error(`STUCK r${String(other)} ${info.path} for ${String(started - info.started)}ms`);
    }
  }
  running.set(id, { path: event.url.pathname, started });
  console.error(`REQ> r${String(id)} ${event.request.method} ${event.url.pathname} at ${new Date(started).toISOString()}`);
  try {
    return await resolve(event);
  } finally {
    running.delete(id);
    console.error(`REQ< r${String(id)} ${event.url.pathname} ${String(Date.now() - started)}ms at ${new Date().toISOString()}`);
  }
};

export const handle = sequence(
  databasePerRequest(),
  trace,
  createHandle(() => authServices().handleDeps),
);
