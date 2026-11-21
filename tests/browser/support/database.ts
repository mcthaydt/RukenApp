import { PrismaPg } from "@prisma/adapter-pg";
import { sealState } from "../../../src/features/games/github-connect.ts";
import type { AgeRating, GamePart } from "../../../src/lib/server/db.ts";
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

/** The secret `playwright.config.ts` gives the app, which seals the connect state. */
const APP_SECRET = "test-only-secret-not-used-anywhere-real";

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

/** Where a game stands: its state, as the database holds it. */
export async function stateOf(slug: string): Promise<string> {
  return (await db().game.findUniqueOrThrow({ where: { slug }, select: { state: true } })).state;
}

/** Whether the maker has turned the player count on, as the database holds it. */
export async function showsPlayerCountOf(slug: string): Promise<boolean> {
  return (await db().game.findUniqueOrThrow({ where: { slug }, select: { showsPlayerCount: true } }))
    .showsPlayerCount;
}

/** The email of the account that made a game: what a journey gives a page or a sign-in to. */
export async function makerEmailOf(slug: string): Promise<string> {
  const game = await db().game.findUniqueOrThrow({
    where: { slug },
    select: { maker: { select: { email: true } } },
  });
  return game.maker.email;
}

/** A game's own ids, read from its row: what a journey needs to look inside the game. */
export async function idsOf(slug: string): Promise<{ id: string; publicId: string; makerUserId: string }> {
  return db().game.findUniqueOrThrow({
    where: { slug },
    select: { id: true, publicId: true, makerUserId: true },
  });
}

/** The commit a stand-in pull is made from: any 40 hex characters. */
const STAND_IN_COMMIT = "a".repeat(40);

/** Changes a game's name straight in the database, as a journey's setup. */
export async function changeGame(
  slug: string,
  changes: {
    name?: string;
    freeToPlay?: boolean;
    makerUserId?: string;
    /** An 18+ rating brings its marks with it, as the database holds a past-draft 18+ game to. */
    ageRating?: AgeRating;
    contentMarks?: ("sex_or_nudity" | "gore" | "drugs" | "none")[];
  },
): Promise<void> {
  await db().game.update({ where: { slug }, data: changes });
}

/**
 * Writes answers into a game straight into the database, so a journey about one screen does not have to walk all the
 * ones before it. The name is the game's own, and `line` is written unless set to false; every game plays on phones and computers. `files` writes
 * a repository and a pull that passed, `videos` the two clips (or `"upright"`, the upright one alone, so the wide
 * question is the next one), and `age` a rating (an 18+ game has no marks yet).
 */
export async function fillAnswers(
  slug: string,
  answers: {
    line?: boolean;
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
      playsOn: "phone_and_computer" as const,
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
 * Leaves a new copy of a live game's files waiting for review beside the copy that is live, as the maker's "Send a new
 * version" does (`updateWaiting` leaves the live copy itself as the waiting one).
 */
export async function leaveNewCopyWaiting(slug: string): Promise<void> {
  const game = await db().game.findUniqueOrThrow({ where: { slug }, select: { id: true } });
  const pull = await db().gamePull.create({
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
  await db().game.update({
    where: { id: game.id },
    data: { pendingPullId: pull.id, pendingSince: new Date() },
  });
}

/** A part staff sent back, with the reason they chose (a code from library/send-back-reasons.json) and their own line. */
export interface SentBackPart {
  part: GamePart;
  reason: string;
  note?: string;
}

/**
 * Puts a game where staff's decision would leave it: waiting for a yes, sent back, or live on its newest files. There
 * is no staff screen on this branch, so a journey cannot get there by clicking. A game past draft holds every answer, so
 * every answer, the files and both videos are written first. A game sent back (or a live one whose update was sent
 * back) lists what staff ticked in `toFix`, each with its reason, and what the maker has fixed since in `fixed`; a live
 * game also has the yes that made it live, and `updateWaiting` leaves an update of it waiting for review.
 */
export async function putGameWhereStaffLeaveIt(
  slug: string,
  decision: {
    state: "waiting" | "sent_back" | "live";
    toFix?: SentBackPart[];
    /** Parts staff sent back that the maker has fixed since: in staff's newest review, and no longer in `toFix`. */
    fixed?: SentBackPart[];
    updateWaiting?: boolean;
    /** The words a refused copy left on the game, as the newest copy of its files. */
    pullProblem?: string;
  },
): Promise<void> {
  await fillAnswers(slug, { files: true, videos: true, age: "age_12" });
  if (decision.pullProblem !== undefined)
    await db().game.update({ where: { slug }, data: { pullProblem: decision.pullProblem } });
  const game = await db().game.findUniqueOrThrow({
    where: { slug },
    select: {
      id: true,
      makerUserId: true,
      pulls: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true } },
    },
  });
  const newest = game.pulls[0];
  if (newest === undefined) throw new Error(`${slug} has no pull`);
  const toFix = decision.toFix ?? [];
  const sentBack = [...toFix, ...(decision.fixed ?? [])];
  // The maker's own account stands in for staff: no screen shows who decided.
  const review = (decision: "accepted" | "sent_back", parts: SentBackPart[]) =>
    db().gameReview.create({
      data: {
        gameId: game.id,
        pullId: newest.id,
        staffUserId: game.makerUserId,
        decision,
        decidedAt: new Date(),
        parts: {
          create: parts.map((one) => ({ part: one.part, reason: one.reason, note: one.note ?? null })),
        },
      },
    });
  if (decision.state === "live") await review("accepted", []);
  if (sentBack.length > 0) await review("sent_back", sentBack);
  await db().game.update({
    where: { id: game.id },
    data:
      decision.state === "live"
        ? {
            state: "live",
            stateReason: null,
            pendingPullId: decision.updateWaiting === true ? newest.id : null,
            pendingSince: decision.updateWaiting === true ? new Date() : null,
            livePullId: newest.id,
            toFix: toFix.map((one) => one.part),
            // A yes made at once also writes this, so the Accepted screen is not shown for it.
            acceptedSeenAt: new Date(),
          }
        : {
            state: decision.state,
            toFix: toFix.map((one) => one.part),
            // A game that waits holds the files that wait, as a real send leaves it.
            ...(decision.state === "waiting" ? { pendingPullId: newest.id, pendingSince: new Date() } : {}),
          },
  });
}

/**
 * A waiting game that a decision day has just let in: its yes was held for a day, and the day went out and applied it.
 * The game is live and its maker has not yet seen the Accepted screen. Written straight into the rows, as the release
 * writes them, because the journeys run with decision day off (DECISION_DAYS_TEST_OFF) and a real day is a Friday noon.
 */
export async function letDecisionDayIn(slug: string): Promise<void> {
  await putGameWhereStaffLeaveIt(slug, { state: "waiting" });
  const game = await db().game.findUniqueOrThrow({
    where: { slug },
    select: { id: true, makerUserId: true, pendingPullId: true },
  });
  if (game.pendingPullId === null) throw new Error(`${slug} holds no files that wait`);
  // A random old day, out of the way of any real decision day. Two games may land on the same day: they share its row.
  const day = new Date(Date.UTC(2000, 0, 1 + Math.floor(Math.random() * 9000)));
  const wentOutAt = new Date();
  await db().decisionDay.upsert({ where: { day }, update: {}, create: { day, seats: 10, wentOutAt } });
  const review = await db().gameReview.create({
    data: {
      gameId: game.id,
      pullId: game.pendingPullId,
      staffUserId: game.makerUserId,
      decision: "accepted",
      decidedAt: new Date(wentOutAt.getTime() - 86_400_000),
      goesOutOn: day,
    },
  });
  await db().decisionOutcome.create({ data: { reviewId: review.id, result: "applied" } });
  await db().game.update({
    where: { id: game.id },
    data: { state: "live", livePullId: game.pendingPullId, pendingPullId: null, pendingSince: null },
  });
}

/** The sign-up counter the site keeps for one client address: how many sign-ups it has counted, or 0 when none. */
export async function signUpsCountedFrom(clientAddress: string): Promise<number> {
  // better-auth keys its per-address counters as "<address>|<path>".
  const row = await db().rateLimit.findUnique({
    where: { key: `${clientAddress}|/sign-up/email` },
    select: { count: true },
  });
  return row?.count ?? 0;
}

/** A link to put on a page: its words and where it goes, hidden or not, and a game somewhere else or a plain link. */
export interface GivenLink {
  title: string;
  url: string;
  kind?: "link" | "game_elsewhere";
  hidden?: boolean;
}

/**
 * Gives an account a maker's page, as the page editor would have saved it: a name and a line, and as options its
 * address (a made-up one otherwise), a colour combination (0, Ruken's own, otherwise), a photo's key and links in
 * the order given. It answers the address and the links' ids in that order.
 */
export async function givePage(
  account: { email: string },
  page: {
    name: string;
    oneLine: string;
    handle?: string;
    themeId?: number;
    photoKey?: string;
    links?: GivenLink[];
  },
): Promise<{ handle: string; linkIds: string[] }> {
  const userId = await userIdOf(account.email);
  const { links = [], handle = `m${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`, ...rest } = page;
  const made = await db().makerPage.create({
    data: {
      userId,
      handle,
      ...rest,
      links: {
        create: links.map((link, position) => ({
          position,
          title: link.title,
          url: link.url,
          kind: link.kind ?? "link",
          hidden: link.hidden ?? false,
        })),
      },
    },
    select: { links: { orderBy: { position: "asc" }, select: { id: true } } },
  });
  return { handle, linkIds: made.links.map((link) => link.id) };
}

/** How many times a page was opened by a visitor, and how many times each of its links was tapped, in the page's order. */
export async function pageCounts(handle: string): Promise<{ views: number; taps: number[] }> {
  const page = await db().makerPage.findUniqueOrThrow({
    where: { handle },
    select: { views: true, links: { orderBy: { position: "asc" }, select: { taps: true } } },
  });
  return { views: page.views, taps: page.links.map((link) => link.taps) };
}

/**
 * Writes `count` plays of a game by members, each with attentive beats every 15 seconds for `minutes`, so each counts
 * that long. They are the rows the game's own play writes (a session and its beats), started just far enough back that
 * every beat is in the past.
 */
export async function addPlays(slug: string, count: number, minutes: number): Promise<void> {
  const game = await db().game.findUniqueOrThrow({
    where: { slug },
    select: { id: true, makerUserId: true, livePullId: true },
  });
  if (game.livePullId === null) throw new Error(`${slug} is not live`);
  const startedAt = new Date(Date.now() - (minutes * 60 + 60) * 1000);
  for (let play = 0; play < count; play += 1) {
    const pass = await db().playPass.create({
      data: {
        id: crypto.randomUUID().replaceAll("-", "").slice(0, 22),
        gameId: game.id,
        pullId: game.livePullId,
        userId: game.makerUserId,
        madeAt: startedAt,
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });
    const session = await db().playSession.create({
      data: {
        id: crypto.randomUUID(),
        gameId: game.id,
        pullId: game.livePullId,
        passId: pass.id,
        userId: game.makerUserId,
        basis: "member",
        tokenHash: "0".repeat(64),
        startedAt,
      },
    });
    await db().playBeat.createMany({
      data: Array.from({ length: minutes * 4 }, (_, beat) => ({
        sessionId: session.id,
        receivedAt: new Date(startedAt.getTime() + (beat + 1) * 15_000),
        attentive: true,
      })),
    });
  }
}

/** Ends a member's membership at once: the stand-in Stripe ends one only at its period's end. */
export async function endMembershipOf(account: { email: string }): Promise<void> {
  const ended = await db().premiumMembership.updateMany({
    where: { user: { email: account.email } },
    data: { state: "ended" },
  });
  if (ended.count !== 1) throw new Error(`expected one membership for ${account.email}`);
}

/**
 * A game's plays as the database holds them: for each session, why it was allowed, who played (null: nobody was signed
 * in), and each beat's "still here". Newest session last.
 */
export async function playOf(slug: string): Promise<{
  sessions: { id: string; basis: string; userId: string | null; beats: boolean[] }[];
}> {
  const sessions = await db().playSession.findMany({
    where: { game: { slug } },
    orderBy: { startedAt: "asc" },
    select: {
      id: true,
      basis: true,
      userId: true,
      beats: { orderBy: { receivedAt: "asc" }, select: { attentive: true } },
    },
  });
  return {
    sessions: sessions.map((one) => ({
      id: one.id,
      basis: one.basis,
      userId: one.userId,
      beats: one.beats.map((beat) => beat.attentive),
    })),
  };
}

/** Makes an account staff who check games, as the first-owner command or a later promotion would. */
export async function giveStaffRole(
  account: { email: string },
  role: "owner" | "head_curator" | "curator",
): Promise<void> {
  await db().staffAssignment.create({ data: { userId: await userIdOf(account.email), role } });
}

/** Leaves an account with no known age, as an account made before the age question was asked would be. */
export async function forgetAgeOf(email: string): Promise<void> {
  await db().user.update({ where: { email }, data: { adultOn: null } });
}
