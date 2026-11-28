import { sequence } from "@sveltejs/kit/hooks";
import { authServices, createHandle, httpsOnly, setMoneyCheck } from "./features/accounts/accounts.ts";
import {
  cloudflareFiles,
  cloudflareFrames,
  cloudflarePlatform,
  cloudflarePrivateFeed,
  cloudflarePrivateSendLimits,
} from "./lib/server/cloudflare.ts";
import { allowWrites, databasePerRequest } from "./lib/server/db.ts";
import { requireEnv } from "./lib/server/env.ts";
import { consentGate } from "./features/consent/consent.ts";
import { setFileStore } from "./lib/server/files.ts";
import { setFrameMaker } from "./lib/server/frames.ts";
import { setPrivateRanker } from "./features/feed/feed.ts";
import { nameGate, pagesServices } from "./features/pages/pages.ts";
import { setSendLimits } from "./features/sends/sends.ts";
import { membershipServices } from "./features/membership/membership.ts";
import { moneyServices } from "./features/money/money.ts";
import { setPlatform } from "./lib/server/platform.ts";

// The platform is what the host gives that code cannot get anywhere else: the database's address and a way to
// keep work alive after the answer.
setPlatform(cloudflarePlatform);
// The bucket that holds games and clips.
setFileStore(cloudflareFiles);
// What makes a video's still, one frame of a stored clip.
setFrameMaker(cloudflareFrames);
// The feed's private order, when this Worker is bound to it; without it the feed runs on its open order.
setPrivateRanker(cloudflarePrivateFeed);
// The send limits, when this Worker is bound to the private one; without them sends count against the stand-ins.
setSendLimits(cloudflarePrivateSendLimits);
// What forgot password needs to know about money: whether a Stripe customer was ever made for the account or any money
// was booked for it. accounts sits below the features that know, so the answer is handed in here.
setMoneyCheck(
  async (userId) =>
    (await membershipServices().service.hasBillingCustomer(userId)) ||
    (await moneyServices().hasBeenPaid(userId)),
);

// httpsOnly is first: a plain-http visit is sent to https before anything else runs, because the sign-in cookie is
// never kept over http. databasePerRequest is next, so every route and form reaches its own request's database
// client. The consent gate is next: a browser that has not said yes to cookies may not write to the database, keeps no
// cookie and is sent from a gated page to the notice. createHandle then says who sent the request; it builds the sign-in services on the first request that needs them, so
// /healthz answers without them. The name gate is last: it needs to know who is signed in, and sends an account with
// no page yet to the question before any people screen loads (features/pages/people-screens.ts).
export const handle = sequence(
  httpsOnly(() => requireEnv("BETTER_AUTH_URL", process.env)),
  databasePerRequest(),
  consentGate(allowWrites),
  createHandle(() => authServices().handleDeps),
  nameGate((userId) => pagesServices().service.hasPage(userId)),
);
