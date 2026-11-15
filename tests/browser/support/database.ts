import { PrismaPg } from "@prisma/adapter-pg";
import { sealState } from "../../../src/features/games/github-connect.ts";
import { ARRIVAL_COOKIE, sealArrival } from "../../../src/features/membership/arrival.ts";
import type { AgeRating } from "../../../src/lib/server/db.ts";
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

/**
 * Moves a waiting deletion back in time, so its 14 days are over: asked 15 days ago, due a day ago. The daily job reads
 * the real clock in a running site, and nothing in a browser can change that, so the dates move instead; the job
 * compares only `purgeAfter` with now, so the account is finished exactly as it is 14 days on.
 */
export async function makeDeletionDue(email: string): Promise<void> {
  const day = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const moved = await db().deletionRequest.updateMany({
    where: { user: { email }, cancelledAt: null, purgedAt: null },
    data: { requestedAt: new Date(now - 15 * day), purgeAfter: new Date(now - day) },
  });
  if (moved.count !== 1)
    throw new Error(`expected one waiting deletion for ${email}, found ${String(moved.count)}`);
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

/**
 * The state GitHub's sign-in sends back for an account, sealed with the app's own secret and the clock, for the game
 * whose address is `game` (none by default).
 */
export function connectStateFor(userId: string, game: string | null = null): string {
  return sealState(userId, Date.now(), APP_SECRET, game);
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

/** The posting of the payment a member made, or null while the daily money job has not posted it. */
export async function paymentPostingOf(email: string): Promise<{ stripeInvoiceId: string } | null> {
  return db().paymentPosting.findFirst({
    where: { payment: { user: { email } } },
    select: { stripeInvoiceId: true },
  });
}

/** How many rows of Stripe's fee report of one kind (by Stripe's name for it, such as "billing") the site has kept. */
export function feeRowsKept(product: string): Promise<number> {
  return db().stripeFeeRow.count({ where: { product } });
}

/**
 * Leaves a maker connected to GitHub with no repository listed for them, as when they connected and chose none. The
 * stand-in always lists two, so this is the only way to see that screen.
 */
export async function forgetTheirRepositories(email: string): Promise<void> {
  await db().gitHubRepository.deleteMany({ where: { connection: { user: { email } } } });
}

/** Where a game's files are, and how many times they were copied, read from its rows. */
export async function filesOf(slug: string): Promise<{ repo: string | null; pulls: number }> {
  const game = await db().game.findUniqueOrThrow({
    where: { slug },
    select: { repoFullName: true, _count: { select: { pulls: true } } },
  });
  return { repo: game.repoFullName, pulls: game._count.pulls };
}

/** The commit a stand-in pull is made from: any 40 hex characters. */
const STAND_IN_COMMIT = "a".repeat(40);

/**
 * Writes answers into a game straight into the database, so a journey about one screen does not have to walk all the
 * ones before it. The name is the game's own, and `line` and `playsOn` are written unless set to false. `files` writes
 * a repository and a pull that passed, `videos` the two clips (or `"upright"`, the upright one alone, so the wide
 * question is the next one), and `age` a rating (an 18+ game has no marks yet).
 */
export async function fillAnswers(
  slug: string,
  answers: {
    line?: boolean;
    playsOn?: boolean;
    files?: boolean;
    videos?: boolean | "upright";
    age?: AgeRating;
  } = {},
): Promise<void> {
  const game = await db().game.findUniqueOrThrow({ where: { slug }, select: { id: true, publicId: true } });
  await db().game.update({
    where: { id: game.id },
    data: {
      ...(answers.line === false ? {} : { oneLine: "A tiny game about tapping." }),
      ...(answers.playsOn === false ? {} : { playsOn: "phone_and_computer" as const }),
      ...(answers.age === undefined ? {} : { ageRating: answers.age, contentMarks: [] }),
      ...(answers.files === true ? { repoFullName: "ruken-test/tiny-game", pullProblem: null } : {}),
    },
  });
  // Asking twice leaves the game as asking once did: a journey may fill a game and then put it where staff leave it.
  if (answers.files === true && (await db().gamePull.count({ where: { gameId: game.id } })) === 0) {
    await db().gamePull.create({
      data: {
        id: crypto.randomUUID(),
        gameId: game.id,
        commitSha: STAND_IN_COMMIT,
        fileCount: 3,
        totalBytes: 1000n,
        connectHosts: [],
        pulledAt: new Date(),
      },
    });
  }
  if (answers.videos === true || answers.videos === "upright") {
    for (const shape of answers.videos === true ? (["upright", "wide"] as const) : (["upright"] as const)) {
      const clip = {
        gameId: game.id,
        shape,
        key: `clips/${game.publicId}/${shape}-${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}.mp4`,
        contentType: "video/mp4",
        bytes: 1000,
      };
      await db().gameClip.upsert({
        where: { gameId_shape: { gameId: game.id, shape } },
        create: clip,
        update: {},
      });
    }
  }
}

/**
 * Puts a game where staff's decision would leave it: waiting for a yes, sent back, or live on its newest files. There
 * is no staff screen on this branch, so a journey cannot get there by clicking. A game past draft holds every answer, so
 * every answer, the files and both videos are written first.
 */
export async function putGameWhereStaffLeaveIt(
  slug: string,
  decision: { state: "waiting" | "sent_back" | "live" },
): Promise<void> {
  await fillAnswers(slug, { files: true, videos: true, age: "age_12" });
  const game = await db().game.findUniqueOrThrow({
    where: { slug },
    select: { id: true, pulls: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true } } },
  });
  const newest = game.pulls[0];
  if (newest === undefined) throw new Error(`${slug} has no pull`);
  await db().game.update({
    where: { id: game.id },
    data:
      decision.state === "live"
        ? { state: "live", stateReason: null, pendingPullId: null, livePullId: newest.id }
        : { state: decision.state },
  });
}
