import type Stripe from "stripe";
import { systemClock, type Clock } from "../../lib/clock.ts";
import { prisma, type PrismaClient } from "../../lib/server/db.ts";
import { optionalEnv, requireEnv } from "../../lib/server/env.ts";
import { membershipServices, stripeKeyMode } from "../membership/membership.ts";
import { runMoneyJob, type MoneyJobReport } from "./daily.ts";
import { bindMoneyStripe } from "./stripe-port.ts";

// What the money feature needs, built once per server process. It reads the settings slice 1 already reads and adds
// none: the one Stripe client, its secret key and its test address.

type Settings = Readonly<Record<string, string | undefined>>;

export interface MoneyServices {
  /** Runs the daily money job once. */
  runJob(): Promise<MoneyJobReport>;
}

/**
 * Why Stripe's fee report is not asked for, or undefined when it is. Stripe says some report types run only on a live
 * key, so a deployment on a test key has no report to read. A test key pointed at the stand-in (the journeys) still
 * runs it, because the stand-in answers it.
 */
export function feeReportSkipReason(source: Settings): string | undefined {
  const onTestKey = stripeKeyMode(requireEnv("STRIPE_SECRET_KEY", source)) === "test";
  return onTestKey && optionalEnv("STRIPE_API_BASE", source) === undefined
    ? "Stripe's fee report needs a live key"
    : undefined;
}

/**
 * Where Stripe's report files are: the only address the secret key may be sent to. It is Stripe's file host, unless
 * the Stripe address is changed (the journeys' stand-in), and then that address's own origin.
 */
export function fileOrigin(source: Settings): string {
  const base = optionalEnv("STRIPE_API_BASE", source);
  return base === undefined ? "https://files.stripe.com" : new URL(base).origin;
}

export function createMoneyServices(
  source: Settings,
  parts: { prisma: PrismaClient; clock: Clock; stripe: Stripe },
): MoneyServices {
  const stripe = bindMoneyStripe(parts.stripe, {
    secretKey: requireEnv("STRIPE_SECRET_KEY", source),
    origin: fileOrigin(source),
  });
  const feeReportSkipped = feeReportSkipReason(source);
  return {
    runJob: () =>
      runMoneyJob({
        db: parts.prisma,
        clock: parts.clock,
        stripe,
        ...(feeReportSkipped === undefined ? {} : { feeReportSkipped }),
      }),
  };
}

let shared: MoneyServices | undefined;

/** The process-wide money services, created on first use. */
export function moneyServices(): MoneyServices {
  shared ??= createMoneyServices(process.env, {
    prisma: prisma(),
    clock: systemClock,
    stripe: membershipServices().stripe,
  });
  return shared;
}
