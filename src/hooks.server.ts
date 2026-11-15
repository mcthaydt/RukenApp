import { sequence } from "@sveltejs/kit/hooks";
import { authServices, createHandle } from "./features/accounts/accounts.ts";
import { cloudflareFiles, cloudflarePlatform } from "./lib/server/cloudflare.ts";
import { readCopy, stampedCopy } from "./lib/server/copy.ts";
import { copyGuard } from "./lib/server/copy-guard.ts";
import { databasePerRequest, prisma } from "./lib/server/db.ts";
import { setFileStore } from "./lib/server/files.ts";
import { setPlatform } from "./lib/server/platform.ts";

// The platform is what the host gives that code cannot get anywhere else: the database's address and a way to
// keep work alive after the answer.
setPlatform(cloudflarePlatform);
// The bucket that holds games and clips.
setFileStore(cloudflareFiles);

// databasePerRequest is first, so every route and form reaches its own request's database client. The copy guard is
// second: it needs this request's database to read the stamp, and must run before anything else reads a row, so a
// Worker pointed at the other copy's database answers 503 and touches nothing. createHandle then says who sent the
// request; it builds the sign-in services on the first request that needs them, so /healthz answers without them.
// /healthz does pass the guard, so it answers `ok` only on a database stamped for this copy.
export const handle = sequence(
  databasePerRequest(),
  copyGuard({
    copy: () => readCopy(),
    // Safe as an unsafe query: the statement is fixed text in copy.ts, and the only value is passed apart from it.
    stamped: () =>
      stampedCopy((sql, values) => prisma().$queryRawUnsafe<Record<string, unknown>[]>(sql, ...values)),
    report: (message) => {
      console.error(message);
    },
  }),
  createHandle(() => authServices().handleDeps),
);
