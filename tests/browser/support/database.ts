import { PrismaPg } from "@prisma/adapter-pg";
import { sealState } from "../../../src/features/games/github-connect.ts";
import { ARRIVAL_COOKIE, sealArrival } from "../../../src/features/membership/arrival.ts";
import { PrismaClient, type MembershipStart } from "../../support/generated/prisma/client.ts";

// The one place a journey reads the app's database. No screen shows who brought a member, so the journeys that check
// it read the row. Playwright runs in Node, where the app's Workers-generated client cannot load its WebAssembly, so
// this uses the client generated for Node (tests/support/generated), as the Postgres tests do.

let client: PrismaClient | undefined;

/** One small client for the worker; its connections close themselves a second after the last use. */
function db(): PrismaClient {
  const connectionString = process.env.TEST_DATABASE_URL;
  if (connectionString === undefined || connectionString === "") {
    throw new Error("TEST_DATABASE_URL is not set. The journeys run in CI's browser job.");
  }
  client ??= new PrismaClient({
    adapter: new PrismaPg({ connectionString, max: 1, idleTimeoutMillis: 1000 }),
  });
  return client;
}

export async function userIdOf(email: string): Promise<string> {
  return (await db().user.findUniqueOrThrow({ where: { email }, select: { id: true } })).id;
}

/**
 * Puts a member's membership where a failed card leaves it: past due, the first failure `daysAgo` days back. The
 * stand-in Stripe has no failing card, so a journey cannot get there by paying; this is the only way to see that
 * screen.
 */
export async function failTheirCard(email: string, daysAgo: number): Promise<void> {
  const failedAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  await db().premiumMembership.updateMany({
    where: { user: { email } },
    data: { state: "past_due", pastDueSince: failedAt },
  });
}

/** The staff roles the account with this address has, by name. */
export async function staffRolesOfEmail(email: string): Promise<string[]> {
  const rows = await db().staffAssignment.findMany({ where: { user: { email } }, select: { role: true } });
  return rows.map((row) => row.role);
}

/**
 * What the site remembers a person can reach on GitHub: each installation with its repositories' names, in a fixed
 * order. Nothing on a screen shows it yet, so a journey reads the rows.
 */
export async function githubConnectionOf(email: string) {
  const rows = await db().gitHubInstallation.findMany({
    where: { user: { email } },
    orderBy: { installationId: "asc" },
    include: { repositories: { orderBy: { fullName: "asc" } } },
  });
  return rows.map((row) => ({
    installationId: row.installationId,
    accountLogin: row.accountLogin,
    repositories: row.repositories.map((repository) => repository.fullName),
  }));
}

/** The state GitHub's sign-in sends back for an account, sealed with the app's own secret and the clock. */
export function connectStateFor(userId: string): string {
  return sealState(userId, Date.now(), APP_SECRET);
}

export function membershipStartsOf(email: string): Promise<MembershipStart[]> {
  return db().membershipStart.findMany({ where: { user: { email } }, orderBy: { startedAt: "asc" } });
}

/** The secret `playwright.config.ts` gives the app, which seals the arrival cookie. */
const APP_SECRET = "test-only-secret-not-used-anywhere-real";

/**
 * The cookie a visitor has after landing on a maker's link, sealed as the server seals it. It is test code: until
 * slices 2 and 3 bring the links, this is the only way an arrival exists in a journey.
 */
export function arrivalCookie(link: { makerUserId: string; path: string }): {
  name: string;
  value: string;
  url: string;
} {
  return {
    name: ARRIVAL_COOKIE,
    value: sealArrival({ ...link, atMs: Date.now() }, APP_SECRET),
    url: "http://localhost:4173",
  };
}
