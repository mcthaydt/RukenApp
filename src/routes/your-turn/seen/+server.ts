import { isKnownAdultCaller } from "../../../features/accounts/accounts.ts";
import { launchServices } from "../../../features/launch/launch.ts";
import { playtestServices } from "../../../features/playtest/playtest.ts";
import { sendsServices } from "../../../features/sends/sends.ts";
import type { RequestHandler } from "./$types";

// Marks the person's Your turn list seen, so the tab's dot goes: the games sent and the playtest rows alike. The list
// page posts here once it is on screen: the page itself only reads, because it opens before the cookie yes (plan audit
// 3), and this route is gated.
export const POST: RequestHandler = async ({ locals, cookies }) => {
  const caller = locals.caller;
  if (caller.kind !== "user") return new Response(null, { status: 401 });
  await Promise.all([
    sendsServices().markSeen(caller.userId),
    playtestServices().service.markSeen(
      caller.userId,
      () => isKnownAdultCaller(caller),
      launchServices().now(cookies),
    ),
  ]);
  return new Response(null, { status: 204 });
};
