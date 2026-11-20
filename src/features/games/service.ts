import type { Clock } from "../../lib/clock.ts";
import type { FileStore } from "../../lib/files/store.ts";
import type {
  AgeRating,
  ClipShape,
  ContentMark,
  GamePart,
  GameState,
  PrismaClient,
} from "../../lib/server/db.ts";
import { countAcceptance, type AcceptanceCounts } from "./acceptance.ts";
import { clipKeyFor, clipProblem, type ClipContentType } from "./clips.ts";
import { connectHostsFrom } from "./files-check.ts";
import { GameError } from "./game-error.ts";
import type { Connection } from "./github-connect.ts";
import {
  ageProblem,
  branchProblem,
  folderProblem,
  marksProblem,
  nameProblem,
  oneLineProblem,
  repoProblem,
} from "./fields.ts";
import { NOT_VISIBLE, type GitHub } from "./github.ts";
import { newPublicId, slugOf } from "./ids.ts";
import { pullGame, type Pull } from "./pull.ts";
import { counterOf, firstUnanswered, type Answers } from "./questions.ts";
import { listWords, stateParts, stateWords } from "./review.ts";
import { isReasonFor, makerWords, partTitle } from "./send-back.ts";
import {
  dayWords,
  decisionDaysDue,
  decisionSchedule,
  nextDecisionDay,
  type DecisionSchedule,
} from "./seats.ts";

// What a game goes through, from its first clip to going live. It is built from what it needs (the database, the
// clock, the bucket, GitHub) so a test hands it stand-ins and no test reaches for the real ones.

export { GameError, type GameErrorCode } from "./game-error.ts";

export interface GamesServiceDeps {
  db: PrismaClient;
  clock: Clock;
  files: FileStore;
  github: GitHub;
  /** The decision day schedule; a test hands its own. Left out, the schedule in `library/decision-days.json`. */
  schedule?: DecisionSchedule;
}

/** A live game as the pages and the gate need it. `clips` holds the two clips' keys in the bucket. */
export interface LiveGame {
  id: string;
  publicId: string;
  slug: string;
  name: string;
  oneLine: string;
  freeToPlay: boolean;
  makerUserId: string;
  livePullId: string;
  /** The servers the live pull's game may reach (the list as it stood at that pull). */
  connectHosts: string[];
  /** Who the game is for, and what an 18+ game says it has: what the page shows players. */
  ageRating: AgeRating;
  contentMarks: ContentMark[];
  clips: { upright: string; wide: string };
}

/**
 * One answer of a game, as a screen hands it over. Each question keeps only its own answer, so a maker can stop after
 * any one and a game that is half answered is still a game.
 */
export type Answer =
  | { question: "name"; name: string }
  | { question: "line"; oneLine: string }
  | { question: "files"; repo: { fullName: string; branch: string | null; folder: string } }
  // A game past draft that is made 18+ brings its marks with the rating: the database holds an 18+ game that is past
  // draft to having them, so the two are one write.
  | { question: "age"; ageRating: AgeRating; contentMarks?: ContentMark[] }
  | { question: "marks"; contentMarks: ContentMark[] }
  | { question: "websites"; connectHosts: string[] };

/** What the maker's list shows for a game: its name, the key of its wide video (for its still) and where it stands. */
export interface MakerGameRow {
  slug: string;
  name: string;
  wideClipKey: string | null;
  words: string;
}

/** A video a game holds, as the screens need it: where it is in the bucket and how big it was when saved. */
export interface ClipFile {
  key: string;
  bytes: number;
}

/** A part staff sent back that the maker has not changed yet, in the words the maker reads. */
export interface PartToFix {
  part: GamePart;
  title: string;
  words: string;
  /** Staff's own line, when they wrote one beside a reason from the list. */
  note: string | null;
}

/** What a game's page in the maker's area shows. Sizes are measured from the pull; nobody types them. */
export interface MakerGame {
  id: string;
  slug: string;
  publicId: string;
  name: string;
  state: GameState;
  /** The state in one line, with staff's reason after a colon when there is one. */
  words: string;
  /** The state alone, and staff's reason apart from it, so a screen sets the reason as a paragraph. */
  headline: string;
  reason: string | null;
  /** True while an update waits for a person's yes. */
  hasPending: boolean;
  /** Null until the maker answers it. */
  oneLine: string | null;
  ageRating: AgeRating | null;
  contentMarks: ContentMark[];
  /** True once staff have accepted the game at least once: its address never changes after that. */
  everLive: boolean;
  /** Null until the maker chooses where the game's files are. */
  repoFullName: string | null;
  repoBranch: string | null;
  repoFolder: string;
  connectHosts: string[];
  /** The words of the last pull's refusal, or null. */
  pullProblem: string | null;
  newestPull: { id: string; fileCount: number; totalBytes: number } | null;
  /** Each video that was added, with its size measured when it was saved, or null when it was not added. */
  clips: { upright: ClipFile | null; wide: ClipFile | null };
  /** What staff sent back that is still to fix, from their newest sent-back review. */
  toFix: PartToFix[];
  /**
   * True while staff's newest word on this game is a send back: a live game's update that came back, mended or not. It is
   * what lets the maker send the copy Ruken already holds again, without copying from GitHub.
   */
  sentBackLast: boolean;
  /** For a game that is off Ruken: whether some of its files are still in the bucket. False for every other state. */
  filesLeft: boolean;
}

/** What staff see of a game waiting for review: the maker's view, and the files that wait. */
export interface ReviewGame extends MakerGame {
  /** First send, a game that was live before, or a live game's update (see `ReviewKind`). */
  kind: ReviewKind;
  /** What the Owner held on it that has not lapsed, and the decision day it goes out on. */
  decided: "yes" | "sent back" | null;
  heldDay: string | null;
  pending: { id: string; fileCount: number; totalBytes: number; connectHosts: string[] } | null;
  clipKeys: { upright: string | null; wide: string | null };
}

/**
 * Parts staff may have sent back before games stopped being asked about them: every game now meets them, no question fixes them
 * and no screen shows them. A game that still holds one is not stopped by it.
 */
const MET_PARTS: readonly GamePart[] = ["plays_on"];

function stillToFix(toFix: readonly GamePart[]): GamePart[] {
  return toFix.filter((part) => !MET_PARTS.includes(part));
}

/** Staff's own line beside a reason, at most this many characters (GameReviewPart_note_check). */
const NOTE_MAX = 500;

/** The values the answers may take, for answers that arrive from a form and are never believed. */
const AGE_RATINGS: AgeRating[] = ["age_3", "age_7", "age_12", "age_16", "age_18"];
const CONTENT_MARKS: ContentMark[] = ["sex_or_nudity", "gore", "drugs", "none"];

/** The page's address may end in `-2` to `-9`, so a name that makes the same address nine times over is refused. */
const MAX_SLUG_NUMBER = 9;
/** 38 characters and `-9` is 40, the most the database takes for an address. */
const SLUG_STEM_MAX = 38;

/**
 * Holding a decision and sending a decision day out both take this one lock first, so two yeses at the last seat
 * cannot both get in and a yes made while a day goes out is held for the next day, never left on a day that has gone.
 */
const DECISION_LOCK_KEY = 7_340_113;

/**
 * A decision that took effect: made at once, or held and then sent out as `applied`. A held or lapsed decision has not,
 * and nothing a maker sees may read it. Every reader of `GameReview` outside the review command and the release uses this.
 */
export const tookEffect = {
  OR: [{ goesOutOn: null }, { outcome: { is: { result: "applied" as const } } }],
};

/** The date column holds a plain day: "2026-11-27" and midnight UTC are the same day. */
const dateOfDay = (day: string): Date => new Date(`${day}T00:00:00.000Z`);
const dayOfDate = (date: Date): string => date.toISOString().slice(0, 10);

/**
 * A held decision applies only to the game as it was decided. It lapses when the game is no longer waiting, when
 * its waiting files are no longer the ones it names, or when the maker changed the game after it.
 */
function lapsed(
  review: { decidedAt: Date; pullId: string },
  game: { state: GameState; pendingPullId: string | null; changedAt: Date | null },
): boolean {
  return (
    game.state !== "waiting" ||
    game.pendingPullId !== review.pullId ||
    (game.changedAt !== null && game.changedAt.getTime() > review.decidedAt.getTime())
  );
}

/** A waiting game is a new game (a seat and a held decision), a game that was live before, or a live game's update. */
export type ReviewKind = "game" | "back" | "update";

/** What the Owner's command knows about a waiting game's standing beyond its state. */
export interface Standing {
  kind: ReviewKind;
  /** What the Owner decided on it that is held and has not lapsed, with the day it goes out; else null. */
  held: { decision: "accepted" | "sent_back"; day: string } | null;
}

/** What the Owner's list says of a held decision. */
function decidedWords(standing: Standing | undefined): "yes" | "sent back" | null {
  if (standing?.held == null) return null;
  return standing.held.decision === "accepted" ? "yes" : "sent back";
}

/** What a decision did: at once, or held for a day (with the seats that day has and how many are taken now). */
export type DecisionMade = { held: false } | { held: true; day: string; seats: number; taken: number };

type ReviewReader = Pick<PrismaClient, "gameReview">;

/** The words a seat refusal and a held decision share. */
const seatsTakenWords = (seats: number): string =>
  `This week's ${String(seats)} seats are taken. Send it back, or leave it for next week.`;

/** A game's pulls, the newest first. A plain array, not `as const`, because Prisma takes only a mutable one. */
const NEWEST_FIRST: ({ pulledAt: "desc" } | { createdAt: "desc" })[] = [
  { pulledAt: "desc" },
  { createdAt: "desc" },
];

/** 16 random hex characters: what gives each uploaded clip an address of its own (see `clipKeyFor`). */
function randomHex16(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(8)), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export function createGamesService(deps: GamesServiceDeps) {
  /**
   * Keeps a clip for a game, in place of the one of that shape it had. A clip that fails the clip rules is refused
   * before anything is stored. The new file is stored and the row points at it before the old file is deleted, so a
   * failure part way leaves the game with its old clip, and at worst a file nobody points at.
   */
  async function saveClip(
    gameId: string,
    shape: ClipShape,
    upload: { contentType: string; bytes: Uint8Array },
  ): Promise<void> {
    const problem = clipProblem(upload);
    if (problem !== null) throw new GameError("INVALID", problem);
    // `clipProblem` returned null, so the type is one of the two a clip may have.
    const contentType = upload.contentType as ClipContentType;

    const game = await deps.db.game.findUnique({
      where: { id: gameId },
      select: { publicId: true, state: true },
    });
    if (game === null) throw new GameError("NOT_FOUND", "We can't find that game.");
    // A new clip would go live without a person's yes. Changing a live game's clips through review comes in slice 4.
    if (game.state === "live") throw new GameError("NOT_READY", "A live game's videos can't be changed yet.");

    const key = clipKeyFor(game.publicId, shape, randomHex16(), contentType);
    const replaced = await deps.db.gameClip.findUnique({ where: { gameId_shape: { gameId, shape } } });

    await deps.files.put(key, upload.bytes);
    await markChanged(gameId);
    await deps.db.gameClip.upsert({
      where: { gameId_shape: { gameId, shape } },
      create: { gameId, shape, key, contentType, bytes: upload.bytes.length },
      update: { key, contentType, bytes: upload.bytes.length },
    });
    await takeOutOfToFix(gameId, shape === "upright" ? "upright_video" : "wide_video");
    if (replaced !== null) await deps.files.delete(replaced.key);
  }

  /** Every maker write to a game says so, so a decision held on it lapses (spec 2). */
  async function markChanged(gameId: string): Promise<void> {
    await deps.db.game.update({ where: { id: gameId }, data: { changedAt: new Date(deps.clock.epochMs()) } });
  }

  /** The maker changed a part that staff sent back: it is no longer to fix. */
  async function takeOutOfToFix(gameId: string, part: GamePart): Promise<void> {
    const game = await deps.db.game.findUnique({ where: { id: gameId }, select: { toFix: true } });
    if (game === null || !game.toFix.includes(part)) return;
    await deps.db.game.update({
      where: { id: gameId },
      data: { toFix: game.toFix.filter((one) => one !== part) },
    });
  }

  /**
   * Throws unless this maker may use this repository: GitHub listed it for them when they connected (so they can
   * reach it themselves), and GitHub still says the same installation holds it now (so the app was not moved or taken
   * off). Without this, an installation that can read a repository the maker cannot open would let them pull it.
   * GitHub writes a repository's name one way and the stored list is GitHub's own, so the names are compared as is.
   */
  async function checkReachable(makerUserId: string, repoFullName: string): Promise<void> {
    const listed = await deps.db.gitHubRepository.findMany({
      where: { fullName: repoFullName, connection: { userId: makerUserId } },
      select: { connection: { select: { installationId: true } } },
    });
    // Nothing is asked of GitHub for a repository the maker was never listed.
    if (listed.length > 0) {
      const holding = await deps.github.installationOf(repoFullName);
      if (holding !== null && listed.some((row) => row.connection.installationId === holding)) return;
    }
    throw new GameError("NOT_CONNECTED", NOT_VISIBLE, "repo");
  }

  /**
   * An address for a name: the name's own, or with `-2` to `-9` when that is taken. Refuses when all nine are. A game
   * being renamed does not count against itself, so a name it already has stays as it is.
   */
  async function freeSlug(base: string, exceptGameId?: string): Promise<string> {
    // Cut before the number goes on, so `<38 characters>-9` still fits the database's 40; a hyphen the cut leaves at
    // the end goes too.
    const stem = base.slice(0, SLUG_STEM_MAX).replace(/-+$/, "");
    const candidates = [
      base,
      ...Array.from({ length: MAX_SLUG_NUMBER - 1 }, (_, i) => `${stem}-${String(i + 2)}`),
    ];
    const rows = await deps.db.game.findMany({
      where: {
        slug: { in: candidates },
        ...(exceptGameId === undefined ? {} : { id: { not: exceptGameId } }),
      },
      select: { slug: true },
    });
    const taken = new Set(rows.map((row) => row.slug));
    const free = candidates.find((candidate) => !taken.has(candidate));
    if (free === undefined) throw new GameError("INVALID", "That name is taken. Pick another.", "name");
    return free;
  }

  /**
   * Pulls the maker's latest files for a game, with the service's own GitHub and bucket. The repository is checked
   * again every time: the maker may have taken the app off it since the game was made.
   */
  async function pullLatest(gameId: string): Promise<Pull> {
    const game = await deps.db.game.findUnique({
      where: { id: gameId },
      select: { makerUserId: true, repoFullName: true, pendingPullId: true },
    });
    // A game that is not there is `pullGame`'s to refuse, in its own words.
    if (game?.repoFullName != null) await checkReachable(game.makerUserId, game.repoFullName);
    // A refused copy throws here, so what follows happens only for a copy that passed.
    const pull = await pullGame(deps, gameId);
    // A passing copy is the fix for files staff sent back. A live game's maker has no files question to answer (it is a
    // 404 for her): she mends the files on GitHub and presses "Send a new version", which comes through here.
    await takeOutOfToFix(gameId, "files");
    await markChanged(gameId);
    // Files are waiting for a person's yes: the new ones take their place, so staff always review the newest.
    if (game?.pendingPullId != null) {
      await deps.db.game.update({
        where: { id: gameId },
        data: { pendingPullId: pull.id, pendingSince: new Date(deps.clock.epochMs()) },
      });
    }
    return pull;
  }

  /**
   * The maker sends a game's newest files for review. The game must be theirs, have its files and both clips, and the
   * first thing missing is what they are told. A game that is not live becomes `waiting`; a live game stays live on its
   * old files until the new ones are accepted (design 5.4).
   */
  async function sendForReview(gameId: string, makerUserId: string): Promise<void> {
    const game = await deps.db.game.findFirst({
      where: { id: gameId, makerUserId },
      select: {
        state: true,
        toFix: true,
        pullProblem: true,
        oneLine: true,
        playsOn: true,
        ageRating: true,
        contentMarks: true,
        pulls: { orderBy: NEWEST_FIRST, take: 1, select: { id: true } },
        clips: { select: { shape: true } },
      },
    });
    if (game === null || game.state === "thrown_away")
      throw new GameError("NOT_FOUND", "We can't find that game.");
    const newest = game.pulls[0];
    if (newest === undefined) throw new GameError("NOT_READY", "Add your game's files first.");
    // A refused copy writes no pull, so the older pull is still the newest one: it is not what the maker now points at.
    if (game.pullProblem !== null) throw new GameError("NOT_READY", "Your game's files need fixing first.");
    if (!game.clips.some((clip) => clip.shape === "upright")) {
      throw new GameError("NOT_READY", "Add an upright video.");
    }
    if (!game.clips.some((clip) => clip.shape === "wide"))
      throw new GameError("NOT_READY", "Add a wide video.");

    // The files and videos are asked for above, in their own words. Every other question is checked here, so a game
    // cannot go to staff with one open (the database's Game_answered_check holds the same line).
    const answers: Answers = {
      oneLine: game.oneLine,
      hasFiles: true,
      upright: true,
      wide: true,
      ageRating: game.ageRating,
      contentMarks: game.contentMarks,
    };
    if (firstUnanswered(answers) !== null) throw new GameError("NOT_READY", "Answer every question first.");
    if (stillToFix(game.toFix).length > 0) throw new GameError("NOT_READY", "Fix what was sent back first.");

    await deps.db.game.update({
      where: { id: gameId },
      data: {
        pendingPullId: newest.id,
        pendingSince: new Date(deps.clock.epochMs()),
        state: game.state === "live" ? "live" : "waiting",
        // Only parts that are met are left in `toFix` here (the refusal above), so sending clears them.
        toFix: [],
        // A game started before this change may have no answer: it plays on both, as every game does, and the database
        // holds a game past draft to having one.
        ...(game.playsOn === null ? { playsOn: "phone_and_computer" as const } : {}),
      },
    });
  }

  /** The game waiting for a person's yes and the files that wait, or a `NOT_READY` that says nothing waits. */
  async function waitingOf(tx: Pick<PrismaClient, "game">, gameId: string) {
    const game = await tx.game.findUnique({
      where: { id: gameId },
      select: { name: true, state: true, pendingPullId: true, changedAt: true },
    });
    if (game?.pendingPullId == null) throw new GameError("NOT_READY", "Nothing is waiting for review.");
    return { name: game.name, state: game.state, pullId: game.pendingPullId, changedAt: game.changedAt };
  }

  const schedule = (): DecisionSchedule => deps.schedule ?? decisionSchedule;
  const now = (): Date => new Date(deps.clock.epochMs());

  /** One lock for holding and for sending out (see DECISION_LOCK_KEY). Held until the transaction ends. */
  async function takeDecisionLock(tx: { $executeRaw: PrismaClient["$executeRaw"] }): Promise<void> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${DECISION_LOCK_KEY})`;
  }

  /**
   * Where each waiting game stands: a new game (its decision is held), a game that was live before, or a live game's
   * update (both are decided at once), and the held decision on it that has not lapsed. A game "was live before" when a
   * yes on it took effect; it does not read when the game first went live.
   */
  async function standingsOf(
    tx: ReviewReader,
    games: { id: string; state: GameState; pendingPullId: string | null; changedAt: Date | null }[],
  ): Promise<Map<string, Standing>> {
    const reviews = await tx.gameReview.findMany({
      where: {
        gameId: { in: games.map((game) => game.id) },
        OR: [
          { AND: [{ decision: "accepted" }, tookEffect] },
          { goesOutOn: { not: null }, outcome: { is: null } },
        ],
      },
      orderBy: { decidedAt: "desc" },
      select: { gameId: true, decision: true, decidedAt: true, pullId: true, goesOutOn: true, outcome: true },
    });
    return new Map(
      games.map((game) => {
        const own = reviews.filter((review) => review.gameId === game.id);
        const yesBefore = own.some(
          (review) =>
            review.decision === "accepted" &&
            (review.goesOutOn === null || review.outcome?.result === "applied"),
        );
        const held = own.find(
          (review) => review.goesOutOn !== null && review.outcome === null && !lapsed(review, game),
        );
        const kind: ReviewKind = game.state === "live" ? "update" : yesBefore ? "back" : "game";
        return [
          game.id,
          {
            kind,
            held:
              held?.goesOutOn == null ? null : { decision: held.decision, day: dayOfDate(held.goesOutOn) },
          },
        ];
      }),
    );
  }

  /** The held yeses for a decision day that have not lapsed: each takes one of its seats. */
  async function seatsTaken(tx: ReviewReader, day: string): Promise<number> {
    const yeses = await tx.gameReview.findMany({
      where: { goesOutOn: dateOfDay(day), decision: "accepted", outcome: { is: null } },
      select: {
        decidedAt: true,
        pullId: true,
        game: { select: { state: true, pendingPullId: true, changedAt: true } },
      },
    });
    return yeses.filter((review) => !lapsed(review, review.game)).length;
  }

  /**
   * Decides how the Owner's yes or no is made: held for the next decision day (a new game while the ritual is on), or
   * at once. The caller already holds the decision lock, and read the game after taking it. The day is picked here, after
   * the lock and from the clock as it reads now, so a yes made while a day goes out is held for the next day and never
   * left on a day that has gone. A decision already held and not lapsed is final.
   */
  async function holdOrNot(
    tx: Pick<PrismaClient, "game" | "gameReview" | "decisionDay">,
    gameId: string,
    game: { name: string; state: GameState; pullId: string; changedAt: Date | null },
    yes: boolean,
  ): Promise<{ goesOutOn: Date | null; made: DecisionMade }> {
    const atOnce = { goesOutOn: null, made: { held: false } } as const;
    let next = nextDecisionDay(now(), schedule());
    if (next === null) return atOnce;
    const standing = (
      await standingsOf(tx, [
        { id: gameId, state: game.state, pendingPullId: game.pullId, changedAt: game.changedAt },
      ])
    ).get(gameId);
    if (standing === undefined || standing.kind !== "game") return atOnce;
    if (standing.held !== null)
      throw new GameError(
        "CONFLICT",
        `You already decided on ${game.name}. It goes out on ${dayWords(standing.held.day)}.`,
      );
    // A day that already has its row has gone out, whatever the clock says.
    while ((await tx.decisionDay.findUnique({ where: { day: dateOfDay(next.day) } })) !== null) {
      const after = nextDecisionDay(next.at, schedule());
      if (after === null) return atOnce;
      next = after;
    }
    const taken = await seatsTaken(tx, next.day);
    if (yes && taken >= next.seats) throw new GameError("CONFLICT", seatsTakenWords(next.seats));
    return {
      goesOutOn: dateOfDay(next.day),
      made: { held: true, day: next.day, seats: next.seats, taken: yes ? taken + 1 : taken },
    };
  }

  /** What a yes does to a game: its waiting files go live. The release does the same thing on decision day. */
  function becomesLive(pullId: string) {
    return {
      state: "live" as const,
      livePullId: pullId,
      pendingPullId: null,
      pendingSince: null,
      stateReason: null,
      toFix: [],
    };
  }

  /**
   * Staff's yes. For a new game while the ritual is on, a seat is taken and the yes is held for decision day: the game
   * stays as it is and nothing a maker sees changes. Otherwise (an update, a game that was live before) the waiting
   * files go live now. One transaction, so a game is never live without its record.
   */
  async function accept(gameId: string, staffUserId: string): Promise<DecisionMade> {
    return deps.db.$transaction(async (tx) => {
      // The lock comes before anything is read, so what is read is what a release that ran first left behind.
      if (schedule().firstDay !== null) await takeDecisionLock(tx);
      const waiting = await waitingOf(tx, gameId);
      const { goesOutOn, made } = await holdOrNot(tx, gameId, waiting, true);
      const decidedAt = now();
      if (goesOutOn === null) {
        await tx.game.update({
          where: { id: gameId },
          data: becomesLive(waiting.pullId),
        });
        await tx.game.updateMany({
          where: { id: gameId, acceptedSeenAt: null },
          data: { acceptedSeenAt: decidedAt },
        });
      }
      await tx.gameReview.create({
        data: { gameId, pullId: waiting.pullId, staffUserId, decision: "accepted", decidedAt, goesOutOn },
      });
      return made;
    });
  }

  /**
   * The parts a live game's update may be sent back for: the ones its maker can fix (her name and line, by the
   * questions she may still answer) and the files (she mends them on GitHub and sends a new version). Its videos,
   * rating and websites go through staff again only in slice 4, so an update sent back for one would be stuck for good.
   */
  const LIVE_MAY_BE_SENT_BACK: GamePart[] = ["name", "one_line", "files"];

  /**
   * Staff's no, part by part: each part with a reason from that part's list, and for "Something else" their own line
   * (spec 11.2). A live game stays live on its old files, and the maker sees what to fix either way. One transaction,
   * so the game and its record never disagree.
   */
  async function sendBack(
    gameId: string,
    staffUserId: string,
    parts: { part: GamePart; reason: string; note?: string }[],
  ): Promise<DecisionMade> {
    if (parts.length === 0) throw new GameError("INVALID", "Tick what's wrong first.");
    const chosen = new Set<GamePart>();
    const kept = parts.map((one) => {
      // A part twice, or a reason that belongs to another part, is a screen that was not meant to be possible.
      if (chosen.has(one.part) || !isReasonFor(one.part, one.reason))
        throw new GameError("INVALID", "Pick a reason for each part you ticked.");
      chosen.add(one.part);
      const note = one.note?.trim() ?? "";
      if (one.reason === "something_else" && note === "")
        throw new GameError("INVALID", "Say what's wrong in your own words.");
      if (note.length > NOTE_MAX) throw new GameError("INVALID", "Keep your own words to 500 characters.");
      return { part: one.part, reason: one.reason, note: note === "" ? null : note };
    });

    return deps.db.$transaction(async (tx) => {
      if (schedule().firstDay !== null) await takeDecisionLock(tx);
      const waiting = await waitingOf(tx, gameId);
      const { state, pullId } = waiting;
      if (state === "live" && kept.some((one) => !LIVE_MAY_BE_SENT_BACK.includes(one.part))) {
        throw new GameError(
          "INVALID",
          "A live game can only be sent back for its name, its line or its files.",
        );
      }
      const { goesOutOn, made } = await holdOrNot(tx, gameId, waiting, false);
      const decidedAt = now();
      if (goesOutOn === null) await sentBackNow(tx, gameId, state, kept);
      await tx.gameReview.create({
        data: {
          gameId,
          pullId,
          staffUserId,
          decision: "sent_back",
          decidedAt,
          goesOutOn,
          parts: { create: kept },
        },
      });
      return made;
    });
  }

  /** What a send back does to a game: a live game stays live on its old files, and what to fix is listed either way. */
  async function sentBackNow(
    tx: Pick<PrismaClient, "game">,
    gameId: string,
    state: GameState,
    kept: { part: GamePart }[],
  ): Promise<void> {
    await tx.game.update({
      where: { id: gameId },
      data: {
        state: state === "live" ? "live" : "sent_back",
        pendingPullId: null,
        pendingSince: null,
        stateReason: null,
        toFix: kept.map((one) => one.part),
      },
    });
  }

  /** Starts a game as a draft with only its name, its public id and its address. */
  async function startGame(input: {
    makerUserId: string;
    name: string;
  }): Promise<{ id: string; slug: string }> {
    const name = input.name.trim();
    const problem = nameProblem(name);
    if (problem !== undefined) throw new GameError("INVALID", problem, "name");
    const base = slugOf(name);
    // `nameProblem` found at least three letters or numbers, so there is an address.
    if (base === null)
      throw new GameError("INVALID", "Pick a name with at least three letters or numbers.", "name");
    return deps.db.game.create({
      // Every game plays on phones and computers, so it is said once, here, and no one is asked.
      data: {
        publicId: newPublicId(),
        slug: await freeSlug(base),
        makerUserId: input.makerUserId,
        name,
        playsOn: "phone_and_computer",
      },
      select: { id: true, slug: true },
    });
  }

  /** What a game's rows say about who may change what: which game, in what state, and whether staff ever said yes. */
  async function ownGame(gameId: string, makerUserId: string) {
    const game = await deps.db.game.findFirst({
      where: { id: gameId, makerUserId, state: { not: "thrown_away" } },
      select: {
        slug: true,
        state: true,
        ageRating: true,
        toFix: true,
        publicId: true,
        name: true,
        repoFullName: true,
        reviews: { where: { decision: "accepted", ...tookEffect }, take: 1, select: { id: true } },
      },
    });
    if (game === null) throw new GameError("NOT_FOUND", "We can't find that game.");
    return game;
  }

  /** The answers a live game may still change by itself: the rest go through staff again (slice 4). */
  const LIVE_MAY_CHANGE: Answer["question"][] = ["name", "line"];

  /**
   * Keeps one answer. A draft, a waiting game and a sent-back game take every answer; a live game takes only its name
   * and its line; anything else is not the maker's to change. Answers the game's address, which a new
   * name may have changed.
   */
  async function saveAnswer(gameId: string, makerUserId: string, answer: Answer): Promise<{ slug: string }> {
    const game = await ownGame(gameId, makerUserId);
    const changeable =
      game.state === "draft" ||
      game.state === "waiting" ||
      game.state === "sent_back" ||
      (game.state === "live" && LIVE_MAY_CHANGE.includes(answer.question));
    if (!changeable) throw new GameError("NOT_READY", "That can't be changed right now.");

    const data: {
      name?: string;
      slug?: string;
      oneLine?: string;
      ageRating?: AgeRating;
      contentMarks?: ContentMark[];
      connectHosts?: string[];
      repoFullName?: string;
      repoBranch?: string | null;
      repoFolder?: string;
    } = {};
    let part: GamePart;
    let slug = game.slug;

    switch (answer.question) {
      case "name": {
        const name = answer.name.trim();
        const problem = nameProblem(name);
        if (problem !== undefined) throw new GameError("INVALID", problem, "name");
        data.name = name;
        // Before staff have ever said yes the address follows the name; after that it never moves, so a link a maker
        // shared keeps working.
        const base = slugOf(name);
        if (game.reviews.length === 0 && base !== null) slug = await freeSlug(base, gameId);
        data.slug = slug;
        part = "name";
        break;
      }
      case "line": {
        const oneLine = answer.oneLine.trim();
        const problem = oneLineProblem(oneLine);
        if (problem !== undefined) throw new GameError("INVALID", problem, "oneLine");
        data.oneLine = oneLine;
        part = "one_line";
        break;
      }
      case "files": {
        const { fullName, branch, folder } = answer.repo;
        const checks: ["repo" | "branch" | "folder", string | undefined][] = [
          ["repo", repoProblem(fullName)],
          ["branch", branch === null ? undefined : branchProblem(branch)],
          ["folder", folderProblem(folder)],
        ];
        const wrong = checks.find(([, words]) => words !== undefined);
        if (wrong?.[1] !== undefined) throw new GameError("INVALID", wrong[1], wrong[0]);
        await checkReachable(makerUserId, fullName);
        data.repoFullName = fullName;
        data.repoBranch = branch;
        data.repoFolder = folder;
        part = "files";
        break;
      }
      case "age": {
        const problem = AGE_RATINGS.includes(answer.ageRating) ? undefined : ageProblem(null);
        if (problem !== undefined) throw new GameError("INVALID", problem);
        data.ageRating = answer.ageRating;
        // Marks belong to an 18+ game only: a game made younger has none (Game_marks_check).
        if (answer.ageRating !== "age_18") {
          data.contentMarks = [];
        } else if (
          answer.contentMarks !== undefined ||
          (game.state !== "draft" && game.ageRating !== "age_18")
        ) {
          // A draft is asked its marks next, but a waiting or sent-back game made 18+ must have them now: the database
          // refuses an 18+ game that is past draft without, and the maker would be told nothing.
          const known = (answer.contentMarks ?? []).filter((mark) => CONTENT_MARKS.includes(mark));
          const problem = marksProblem(known);
          if (problem !== undefined) throw new GameError("INVALID", problem);
          data.contentMarks = known.includes("none") ? ["none"] : [...new Set(known)];
        }
        part = "age_rating";
        break;
      }
      case "marks": {
        const known = answer.contentMarks.filter((mark) => CONTENT_MARKS.includes(mark));
        const problem = marksProblem(known);
        if (problem !== undefined) throw new GameError("INVALID", problem);
        if (game.ageRating !== "age_18")
          throw new GameError("NOT_READY", "This question is only for games that are 18+.");
        // "None of these" stands alone.
        data.contentMarks = known.includes("none") ? ["none"] : [...new Set(known)];
        part = "age_rating";
        break;
      }
      case "websites": {
        // The route checks the text as it was typed; the list is checked again here so any other caller meets the same rules.
        const checked = connectHostsFrom(answer.connectHosts.join("\n"));
        if ("problem" in checked) throw new GameError("INVALID", checked.problem);
        data.connectHosts = checked.hosts;
        part = "other_websites";
        break;
      }
    }

    // The files are the one answer whose part comes off the list only when the pull passes, so it is not in this write.
    await deps.db.game.update({
      where: { id: gameId },
      data: {
        ...data,
        changedAt: now(),
        ...(part === "files" ? {} : { toFix: game.toFix.filter((one) => one !== part) }),
      },
    });

    // The files are the answer that copies: a refused copy leaves the choice kept, and the screen that asked shows the
    // refusal. A copy that passes takes the files off the list of what to fix (pullLatest).
    if (answer.question === "files") {
      await pullLatest(gameId);
    } else if (answer.question === "websites" && game.repoFullName !== null) {
      // The list is part of a copy: staff review it with the files, and the database never changes a copy once it is
      // made (GamePull is add-only). So a new list is a new copy, and the websites question says it copies again.
      await pullLatest(gameId);
    }
    return { slug };
  }

  /**
   * Takes a live game off Ruken. The row stays with its address, so what the game earned and who played it are still
   * there, and an update that was waiting for review is dropped with it. The database goes first: if deleting the files
   * stops halfway, the game is already off its page and no new pass is given, and `filesLeft` says some are still there.
   * Only a live game is taken off: every other state has its own way out (a draft or a sent-back game is thrown away, a
   * waiting one is with staff). Its two videos stay, because putting it back needs them.
   */
  async function takeOff(gameId: string, makerUserId: string): Promise<{ name: string }> {
    const game = await ownGame(gameId, makerUserId);
    if (game.state !== "live") throw new GameError("NOT_READY", "This game isn't live.");
    await deps.db.game.update({
      where: { id: gameId },
      data: {
        state: "taken_off",
        stateReason: null,
        livePullId: null,
        pendingPullId: null,
        pendingSince: null,
        toFix: [],
      },
    });
    await deps.files.deleteAll(`files/${game.publicId}/`);
    return { name: game.name };
  }

  /** The maker's own game, which must be off Ruken: what putting it back and cleaning up are for. */
  async function ownTakenOff(gameId: string, makerUserId: string) {
    const game = await ownGame(gameId, makerUserId);
    if (game.state !== "taken_off") throw new GameError("NOT_READY", "This game isn't off Ruken.");
    return game;
  }

  /** Deletes again what a delete that stopped left behind in the bucket, for a game that is off Ruken. */
  async function deleteLeftFiles(gameId: string, makerUserId: string): Promise<void> {
    const game = await ownTakenOff(gameId, makerUserId);
    await deps.files.deleteAll(`files/${game.publicId}/`);
  }

  /**
   * Puts a game that is off Ruken back: the newest files are copied from GitHub and sent for review like a new game's.
   * Nothing here makes it live; a person's yes does. A refused copy throws its own words and the game stays off.
   */
  async function putBack(gameId: string, makerUserId: string): Promise<void> {
    await ownTakenOff(gameId, makerUserId);
    await pullLatest(gameId);
    await sendForReview(gameId, makerUserId);
  }

  /**
   * Throws a draft or a sent-back game away. The database first, in one transaction, so a failure part way never
   * leaves a game that is gone from its list but still holds its name; then its files and videos in the bucket. The
   * row stays, with its address changed so the name is free again, because money and records may point at a game.
   */
  async function throwAway(gameId: string, makerUserId: string): Promise<{ name: string }> {
    const game = await ownGame(gameId, makerUserId);
    if (game.state !== "draft" && game.state !== "sent_back")
      throw new GameError("NOT_READY", "This game can't be thrown away.");
    await deps.db.$transaction([
      deps.db.game.update({
        where: { id: gameId },
        data: {
          state: "thrown_away",
          slug: `x-${game.publicId}`,
          pendingPullId: null,
          pendingSince: null,
          toFix: [],
        },
      }),
      deps.db.gameClip.deleteMany({ where: { gameId } }),
    ]);
    await deps.files.deleteAll(`files/${game.publicId}/`);
    await deps.files.deleteAll(`clips/${game.publicId}/`);
    return { name: game.name };
  }

  /**
   * Games with files waiting for a person's yes, the oldest first. `kind` says whether it is a first send, a game that
   * was live before, or the new files of a game that is live; `decided` says what the Owner held on it, if anything.
   */
  async function waitingGames(): Promise<
    {
      slug: string;
      name: string;
      kind: ReviewKind;
      decided: "yes" | "sent back" | null;
      makerEmail: string;
      sentAt: Date;
    }[]
  > {
    const rows = await deps.db.game.findMany({
      where: { pendingPullId: { not: null } },
      orderBy: { pendingSince: "asc" },
      select: {
        id: true,
        slug: true,
        name: true,
        state: true,
        pendingPullId: true,
        changedAt: true,
        pendingSince: true,
        maker: { select: { email: true } },
      },
    });
    const standings = await standingsOf(deps.db, rows);
    return rows.map((row) => {
      const standing = standings.get(row.id);
      return {
        slug: row.slug,
        name: row.name,
        kind: standing?.kind ?? "game",
        decided: decidedWords(standing),
        makerEmail: row.maker.email,
        // `pendingSince` is set with `pendingPullId`, so a waiting game always has it.
        sentAt: row.pendingSince ?? new Date(0),
      };
    });
  }

  /** The coming decision day and how many of its seats are taken; null while the ritual is off. */
  async function thisWeek(): Promise<{ day: string; words: string; seats: number; taken: number } | null> {
    const next = nextDecisionDay(now(), schedule());
    if (next === null) return null;
    return {
      day: next.day,
      words: dayWords(next.day),
      seats: next.seats,
      taken: await seatsTaken(deps.db, next.day),
    };
  }

  /**
   * The coming decision day in words ("Friday 27 November") for a waiting game that would be held, which is what its
   * waiting line names; null for any other game and while the ritual is off. It reads the same whether or not the
   * Owner has decided, so nothing is given away early.
   */
  async function decisionDayWordsFor(gameId: string): Promise<string | null> {
    const next = nextDecisionDay(now(), schedule());
    if (next === null) return null;
    const game = await deps.db.game.findUnique({
      where: { id: gameId },
      select: { id: true, state: true, pendingPullId: true, changedAt: true },
    });
    if (game === null) return null;
    const standing = (await standingsOf(deps.db, [game])).get(gameId);
    return standing?.kind === "game" ? dayWords(next.day) : null;
  }

  /**
   * What the Accepted screen says for a live game, or null when it is not to be shown: the game is live, its maker has
   * not seen it, and its newest decision that took effect is a yes that a decision day sent out. The count is that
   * day's yeses that took effect, this game's among them.
   */
  async function acceptedScreenFor(gameId: string): Promise<{ count: number } | null> {
    const game = await deps.db.game.findUnique({
      where: { id: gameId },
      select: {
        state: true,
        acceptedSeenAt: true,
        reviews: {
          where: tookEffect,
          orderBy: { decidedAt: "desc" },
          take: 1,
          select: { decision: true, goesOutOn: true },
        },
      },
    });
    const newest = game?.reviews[0];
    if (game?.state !== "live" || game.acceptedSeenAt !== null) return null;
    if (newest?.decision !== "accepted" || newest.goesOutOn === null) return null;
    const count = await deps.db.gameReview.count({
      where: { decision: "accepted", goesOutOn: newest.goesOutOn, outcome: { is: { result: "applied" } } },
    });
    return { count };
  }

  /** The maker has seen the Accepted screen: it never shows again for this game. */
  async function markAcceptedSeen(gameId: string): Promise<void> {
    await deps.db.game.updateMany({
      where: { id: gameId, state: "live", acceptedSeenAt: null },
      data: { acceptedSeenAt: now() },
    });
  }

  /**
   * Sends out every decision day whose moment has passed and that has not gone out, oldest first, each in its own
   * transaction under the lock. A held decision that lapsed is recorded as lapsed and changes nothing; the others take
   * effect together. Safe to run again: a day with a row is never sent out twice.
   */
  async function sendOutDecisionDays(): Promise<string[]> {
    const due = decisionDaysDue(now(), schedule());
    const says: string[] = [];
    for (const moment of due) {
      const line = await deps.db.$transaction(async (tx) => {
        await takeDecisionLock(tx);
        const day = dateOfDay(moment.day);
        if ((await tx.decisionDay.findUnique({ where: { day } })) !== null) return null;
        const held = await tx.gameReview.findMany({
          where: { goesOutOn: day, outcome: { is: null } },
          orderBy: { decidedAt: "asc" },
          include: {
            parts: true,
            game: { select: { state: true, pendingPullId: true, changedAt: true } },
          },
        });
        let gotIn = 0;
        let wentBack = 0;
        for (const review of held) {
          const game = await tx.game.findUniqueOrThrow({
            where: { id: review.gameId },
            select: { state: true, pendingPullId: true, changedAt: true },
          });
          if (lapsed(review, game)) {
            await tx.decisionOutcome.create({ data: { reviewId: review.id, result: "lapsed" } });
            continue;
          }
          if (review.decision === "accepted") {
            await tx.game.update({ where: { id: review.gameId }, data: becomesLive(review.pullId) });
            gotIn += 1;
          } else {
            await sentBackNow(tx, review.gameId, game.state, review.parts);
            wentBack += 1;
          }
          await tx.decisionOutcome.create({ data: { reviewId: review.id, result: "applied" } });
        }
        await tx.decisionDay.create({ data: { day, seats: moment.seats, wentOutAt: now() } });
        return `${dayWords(moment.day)} went out: ${String(gotIn)} got in, ${String(wentBack)} went back.`;
      });
      if (line !== null) says.push(line);
    }
    return says;
  }

  /** What a game's rows say, for the maker's screens and staff's. */
  const gameSelect = {
    id: true,
    slug: true,
    publicId: true,
    name: true,
    state: true,
    stateReason: true,
    repoFullName: true,
    repoBranch: true,
    repoFolder: true,
    connectHosts: true,
    pullProblem: true,
    pendingPullId: true,
    changedAt: true,
    oneLine: true,
    ageRating: true,
    contentMarks: true,
    toFix: true,
    pulls: { orderBy: NEWEST_FIRST, take: 1, select: { id: true, fileCount: true, totalBytes: true } },
    clips: { select: { shape: true, key: true, bytes: true } },
    // Newest first: the first sent-back review is what the maker still has to fix, and any accepted one means the
    // game has been live.
    reviews: {
      where: tookEffect,
      orderBy: { decidedAt: "desc" },
      select: {
        decision: true,
        parts: { select: { part: true, reason: true, note: true } },
      },
    },
  } as const;

  /** The clip of one shape, with its size, or null when there is none. */
  function clipFile(clips: { shape: ClipShape; key: string; bytes: number }[], shape: ClipShape) {
    const found = clips.find((clip) => clip.shape === shape);
    return found === undefined ? null : { key: found.key, bytes: found.bytes };
  }

  /** A game row as the maker sees it. */
  function makerView(row: {
    id: string;
    slug: string;
    publicId: string;
    name: string;
    state: GameState;
    stateReason: string | null;
    repoFullName: string | null;
    repoBranch: string | null;
    repoFolder: string;
    connectHosts: string[];
    pullProblem: string | null;
    pendingPullId: string | null;
    oneLine: string | null;
    ageRating: AgeRating | null;
    contentMarks: ContentMark[];
    toFix: GamePart[];
    pulls: { id: string; fileCount: number; totalBytes: bigint }[];
    clips: { shape: ClipShape; key: string; bytes: number }[];
    reviews: {
      decision: "accepted" | "sent_back";
      parts: { part: GamePart; reason: string; note: string | null }[];
    }[];
  }): MakerGame {
    const newest = row.pulls[0];
    const state = { state: row.state, stateReason: row.stateReason, hasPending: row.pendingPullId !== null };
    return {
      id: row.id,
      slug: row.slug,
      publicId: row.publicId,
      name: row.name,
      state: row.state,
      words: stateWords(state),
      headline: stateParts(state).headline,
      reason: stateParts(state).reason,
      hasPending: state.hasPending,
      oneLine: row.oneLine,
      ageRating: row.ageRating,
      contentMarks: row.contentMarks,
      everLive: row.reviews.some((review) => review.decision === "accepted"),
      repoFullName: row.repoFullName,
      repoBranch: row.repoBranch,
      repoFolder: row.repoFolder,
      connectHosts: row.connectHosts,
      pullProblem: row.pullProblem,
      newestPull:
        newest === undefined
          ? null
          : { id: newest.id, fileCount: newest.fileCount, totalBytes: Number(newest.totalBytes) },
      clips: {
        upright: clipFile(row.clips, "upright"),
        wide: clipFile(row.clips, "wide"),
      },
      toFix: partsToFix(row),
      // Newest first (see `gameSelect`), so the first review is staff's latest word.
      sentBackLast: row.reviews[0]?.decision === "sent_back",
      // Asking the bucket is `withFilesLeft`'s job, and only for a game that is off.
      filesLeft: false,
    };
  }

  /**
   * What staff sent back that is still to fix, in the words the maker reads: the parts of the newest sent-back review
   * that `Game.toFix` still holds, in the order staff ticked them. A part the maker has fixed is not in `toFix`.
   */
  function partsToFix(row: {
    name: string;
    toFix: GamePart[];
    reviews: {
      decision: "accepted" | "sent_back";
      parts: { part: GamePart; reason: string; note: string | null }[];
    }[];
  }): PartToFix[] {
    const newest = row.reviews.find((review) => review.decision === "sent_back");
    return stillToFix(row.toFix).flatMap((part) => {
      const found = newest?.parts.find((one) => one.part === part);
      if (found === undefined) return [];
      return [
        {
          part,
          title: partTitle(part, row.name),
          words: makerWords(part, found.reason, found.note, row.name),
          // For "Something else" staff's line is the words already; as a note too it would show twice.
          note: found.reason === "something_else" ? null : found.note,
        },
      ];
    });
  }

  /** A maker's games for their list, newest first, with where each stands and what to do next, in words. */
  async function gamesOf(makerUserId: string): Promise<MakerGameRow[]> {
    const rows = await deps.db.game.findMany({
      where: { makerUserId, state: { not: "thrown_away" } },
      orderBy: { createdAt: "desc" },
      select: {
        slug: true,
        name: true,
        state: true,
        stateReason: true,
        pendingPullId: true,
        pullProblem: true,
        oneLine: true,
        ageRating: true,
        contentMarks: true,
        toFix: true,
        clips: { select: { shape: true, key: true } },
        _count: { select: { pulls: true } },
        reviews: { where: tookEffect, orderBy: { decidedAt: "desc" }, take: 1, select: { decision: true } },
      },
    });
    return rows.map((row) => {
      const answers: Answers = {
        oneLine: row.oneLine,
        hasFiles: row._count.pulls > 0 && row.pullProblem === null,
        upright: row.clips.some((clip) => clip.shape === "upright"),
        wide: row.clips.some((clip) => clip.shape === "wide"),
        ageRating: row.ageRating,
        contentMarks: row.contentMarks,
      };
      const next = firstUnanswered(answers);
      return {
        slug: row.slug,
        name: row.name,
        wideClipKey: row.clips.find((clip) => clip.shape === "wide")?.key ?? null,
        words: listWords({
          state: row.state,
          hasPending: row.pendingPullId !== null,
          toFix: stillToFix(row.toFix).length,
          firstUnanswered: next,
          questionNumber: next === null ? null : counterOf(next, answers).n,
          sentBackLast: row.reviews[0]?.decision === "sent_back",
        }),
      };
    });
  }

  /** One of a maker's games for its page. Someone else's game, or none, is null. */
  async function gameForMaker(slug: string, makerUserId: string): Promise<MakerGame | null> {
    const row = await deps.db.game.findFirst({
      where: { slug, makerUserId, state: { not: "thrown_away" } },
      select: gameSelect,
    });
    return row === null ? null : withFilesLeft(makerView(row));
  }

  /** The view with `filesLeft` asked of the bucket, which only a game that is off Ruken needs. */
  async function withFilesLeft<View extends MakerGame>(view: View): Promise<View> {
    if (view.state !== "taken_off") return view;
    return { ...view, filesLeft: await deps.files.hasAny(`files/${view.publicId}/`) };
  }

  /** A game as staff see it: the maker's view, the files that wait and the two clips' keys. Null when there is none. */
  async function gameForReview(slug: string): Promise<ReviewGame | null> {
    const row = await deps.db.game.findUnique({
      where: { slug },
      select: {
        ...gameSelect,
        pendingPull: { select: { id: true, fileCount: true, totalBytes: true, connectHosts: true } },
      },
    });
    if (row === null) return null;
    const pending = row.pendingPull;
    const standing = (await standingsOf(deps.db, [{ ...row, pendingPullId: row.pendingPullId }])).get(row.id);
    return withFilesLeft({
      ...makerView(row),
      kind: standing?.kind ?? "game",
      decided: decidedWords(standing),
      heldDay: standing?.held == null ? null : standing.held.day,
      pending:
        pending === null
          ? null
          : {
              id: pending.id,
              fileCount: pending.fileCount,
              totalBytes: Number(pending.totalBytes),
              connectHosts: pending.connectHosts,
            },
      clipKeys: {
        upright: row.clips.find((clip) => clip.shape === "upright")?.key ?? null,
        wide: row.clips.find((clip) => clip.shape === "wide")?.key ?? null,
      },
    });
  }

  /** The game at `/g/<slug>`, only while it is live. */
  async function liveGameBySlug(slug: string): Promise<LiveGame | null> {
    const game = await deps.db.game.findUnique({
      where: { slug },
      select: {
        id: true,
        publicId: true,
        slug: true,
        name: true,
        oneLine: true,
        freeToPlay: true,
        makerUserId: true,
        state: true,
        ageRating: true,
        contentMarks: true,
        livePull: { select: { id: true, connectHosts: true } },
        clips: { select: { shape: true, key: true } },
      },
    });
    if (game === null || game.state !== "live" || game.livePull === null) return null;
    const upright = game.clips.find((clip) => clip.shape === "upright")?.key;
    const wide = game.clips.find((clip) => clip.shape === "wide")?.key;
    if (upright === undefined || wide === undefined) return null;
    // A live game has every answer (Game_answered_check), so these are only absent in a row that cannot be live.
    if (game.oneLine === null || game.ageRating === null) return null;
    return {
      id: game.id,
      publicId: game.publicId,
      slug: game.slug,
      name: game.name,
      oneLine: game.oneLine,
      freeToPlay: game.freeToPlay,
      makerUserId: game.makerUserId,
      livePullId: game.livePull.id,
      connectHosts: game.livePull.connectHosts,
      ageRating: game.ageRating,
      contentMarks: game.contentMarks,
      clips: { upright, wide },
    };
  }

  /** A maker's other live games, newest accepted first, for the "More from" row of a game's page. */
  async function moreLiveGamesBy(
    makerUserId: string,
    exceptSlug: string,
  ): Promise<{ slug: string; name: string; wideClip: string; ageRating: AgeRating }[]> {
    const rows = await deps.db.game.findMany({
      where: { makerUserId, state: "live", slug: { not: exceptSlug }, livePullId: { not: null } },
      orderBy: { livePull: { createdAt: "desc" } },
      take: 6,
      select: {
        slug: true,
        name: true,
        ageRating: true,
        clips: { where: { shape: "wide" }, select: { key: true } },
      },
    });
    return rows.flatMap((row) => {
      const wideClip = row.clips[0]?.key;
      return wideClip === undefined || row.ageRating === null
        ? []
        : [{ slug: row.slug, name: row.name, wideClip, ageRating: row.ageRating }];
    });
  }

  /**
   * Makes a person's stored installations and repositories exactly what GitHub listed: rows GitHub stopped listing
   * are removed, the rest are brought up to date. It is one transaction, so a list that cannot be stored leaves what
   * was there.
   */
  async function rememberConnection(userId: string, found: Connection[]): Promise<void> {
    await deps.db.$transaction(async (tx) => {
      await tx.gitHubInstallation.deleteMany({
        where: { userId, installationId: { notIn: found.map((one) => one.installationId) } },
      });
      for (const one of found) {
        const { id } = await tx.gitHubInstallation.upsert({
          where: { userId_installationId: { userId, installationId: one.installationId } },
          create: { userId, installationId: one.installationId, accountLogin: one.accountLogin },
          update: { accountLogin: one.accountLogin },
          select: { id: true },
        });
        await tx.gitHubRepository.deleteMany({ where: { connectionId: id } });
        await tx.gitHubRepository.createMany({
          data: one.repositories.map((repo) => ({ connectionId: id, ...repo })),
        });
      }
    });
  }

  /** A person's stored repositories, sorted by name. It asks GitHub nothing. */
  async function repositoriesFor(userId: string): Promise<{ fullName: string; defaultBranch: string }[]> {
    const rows = await deps.db.gitHubRepository.findMany({
      where: { connection: { userId } },
      select: { fullName: true, defaultBranch: true },
    });
    // The same repository can sit under two installations, and the form lists it once. Sorted here, by character,
    // because the database's own order depends on the server's language settings.
    const byName = new Map(rows.map((row) => [row.fullName, row]));
    return [...byName.values()].sort((a, b) =>
      a.fullName < b.fullName ? -1 : a.fullName > b.fullName ? 1 : 0,
    );
  }

  /**
   * True once the maker has connected GitHub, even if they chose no repository there. The new-game screen tells "not
   * connected" (one button to connect) from "connected, but Ruken can see nothing yet" (one button to choose some).
   */
  async function hasConnectedGitHub(userId: string): Promise<boolean> {
    return (await deps.db.gitHubInstallation.count({ where: { userId } })) > 0;
  }

  /** How many games were decided lately, and how many got in: the label on Your games and the Accepted screen. */
  function acceptance(): Promise<AcceptanceCounts> {
    return countAcceptance(deps.db, deps.clock.now());
  }

  return {
    acceptance,
    saveClip,
    startGame,
    saveAnswer,
    throwAway,
    takeOff,
    deleteLeftFiles,
    putBack,
    pullLatest,
    sendForReview,
    accept,
    sendBack,
    waitingGames,
    thisWeek,
    decisionDayWordsFor,
    acceptedScreenFor,
    markAcceptedSeen,
    sendOutDecisionDays,
    standingsOf,
    gamesOf,
    gameForMaker,
    gameForReview,
    liveGameBySlug,
    moreLiveGamesBy,
    rememberConnection,
    repositoriesFor,
    hasConnectedGitHub,
  };
}

export type GamesService = ReturnType<typeof createGamesService>;
