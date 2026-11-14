import { sequence } from "@sveltejs/kit/hooks";
import { authServices, createHandle } from "./features/accounts/accounts.ts";
import { cloudflareFiles, cloudflarePlatform } from "./lib/server/cloudflare.ts";
import { databasePerRequest } from "./lib/server/db.ts";
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
export const handle = sequence(
  databasePerRequest(),
  createHandle(() => authServices().handleDeps),
);
