import { sequence } from "@sveltejs/kit/hooks";
import { authServices, createHandle, setMoneyCheck } from "./features/accounts/accounts.ts";
import { cloudflareFiles, cloudflarePlatform } from "./lib/server/cloudflare.ts";
import { databasePerRequest } from "./lib/server/db.ts";
import { setFileStore } from "./lib/server/files.ts";
import { membershipServices } from "./features/membership/membership.ts";
import { moneyServices } from "./features/money/money.ts";
import { setPlatform } from "./lib/server/platform.ts";

// The platform is what the host gives that code cannot get anywhere else: the database's address and a way to
// keep work alive after the answer.
setPlatform(cloudflarePlatform);
// The bucket that holds games and clips.
setFileStore(cloudflareFiles);
// What forgot password needs to know about money: whether a Stripe customer was ever made for the account or any money
// was booked for it. accounts sits below the features that know, so the answer is handed in here.
setMoneyCheck(
  async (userId) =>
    (await membershipServices().service.hasBillingCustomer(userId)) ||
    (await moneyServices().hasBeenPaid(userId)),
);

// databasePerRequest is first, so every route and form reaches its own request's database client. createHandle
// then says who sent the request; it builds the sign-in services on the first request that needs them, so
// /healthz answers without them.
export const handle = sequence(
  databasePerRequest(),
  createHandle(() => authServices().handleDeps),
);
