import type { Clock } from "../../lib/clock.ts";
import type { FileStore } from "../../lib/files/store.ts";
import type {
  AgeRating,
  ClipShape,
  ContentMark,
  GamePart,
  GamePlaysOn,
  GameState,
  PrismaClient,
} from "../../lib/server/db.ts";
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
  playsOnProblem,
  repoProblem,
} from "./fields.ts";
import { NOT_VISIBLE, type GitHub } from "./github.ts";
import { newPublicId, slugOf } from "./ids.ts";
import { seenOf } from "./seen.ts";
import { pullGame, type Pull } from "./pull.ts";
import { counterOf, firstUnanswered, type Answers } from "./questions.ts";
import {
  FILES_BEING_FIXED_WORDS,
  GAME_CHANGED_WORDS,
  listWords,
  STAFF_NO_AGE_WORDS,
  stateParts,
  stateWords,
} from "./review.ts";
import { isReasonFor, LIVE_MAY_BE_SENT_BACK, makerWords, partTitle } from "./send-back.ts";

// What a game goes through, from its first clip to going live. It is built from what it needs (the database, the
// clock, the bucket, GitHub) so a test hands it stand-ins and no test reaches for the real ones.

export { GameError, type GameErrorCode } from "./game-error.ts";

export interface GamesServiceDeps {
  db: PrismaClient;
  clock: Clock;
  files: FileStore;
  github: GitHub;
}

/** A live game as the pages and the gate need it. `clips` holds the two clips' keys in the bucket. */
export interface LiveGame {
  id: string;
  publicId: string;
  slug: string;
  name: string;
  oneLine: string;
  playsOn: GamePlaysOn;
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
  | { question: "plays-on"; playsOn: GamePlaysOn }
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
  playsOn: GamePlaysOn | null;
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
  /** When its maker last took it off Ruken, for a game that is off now; null for every other game, or with no record. */
  takenOffAt: Date | null;
  /**
   * True when a game that is off Ruken still has files in the bucket: deleting them stopped halfway, and a member who
   * had it open could still load them until they go. Asked of the bucket only for a game that is off; false otherwise.
   */
  filesLeft: boolean;
}

/** What staff see of a game waiting for review: the maker's view, and the files that wait. */
export interface ReviewGame extends MakerGame {
  /** The maker's email: a maker has no handle until slice 3, so staff see this. */
  makerEmail: string;
  /** When the waiting files were sent, or null when none wait. */
  sentAt: Date | null;
  /** A sign of what staff are looking at: the decision carries it back, and a game that changed since is not decided. */
  seen: string;
  pending: { id: string; fileCount: number; totalBytes: number; connectHosts: string[] } | null;
  clipKeys: { upright: string | null; wide: string | null };
}

/** A game waiting for a person's yes, as staff's list shows it. */
export interface WaitingGame {
  slug: string;
  name: string;
  makerEmail: string;
  sentAt: Date;
  /** A first send, or the new files of a game that is live already. */
  kind: "game" | "update";
}

/** What staff decided to put with a yes: who it is for, and what was seen when they decided. */
export interface ReviewDecision {
  ageRating: AgeRating;
  contentMarks: ContentMark[];
  seen: string;
}

/** Staff's own line beside a reason, at most this many characters (GameReviewPart_note_check). */
const NOTE_MAX = 500;

/** The values the answers may take, for answers that arrive from a form and are never believed. */
const PLAYS_ON: GamePlaysOn[] = ["phone_and_computer", "computer_only"];
const AGE_RATINGS: AgeRating[] = ["age_3", "age_7", "age_12", "age_16", "age_18"];
const CONTENT_MARKS: ContentMark[] = ["sex_or_nudity", "gore", "drugs", "none"];
const GAME_PARTS: GamePart[] = [
  "name",
  "one_line",
  "files",
  "plays_on",
  "upright_video",
  "wide_video",
  "age_rating",
  "other_websites",
];

/** What a maker is told when they take off a game that is not on Ruken: a draft, a waiting game, a sent-back one. */
const NOT_ON_RUKEN = "This game isn't on Ruken.";

/** A game put back while its copy from GitHub is still running, or was cut off: the files question asks again. */
const COPY_NOT_FINISHED = "Copying your game from GitHub didn't finish. Choose Next to copy it again.";

/** A copy from GitHub that failed for a reason that is not one of Ruken's own refusals. */
const COPY_FAILED = "We couldn't copy your game from GitHub. Try again.";

/** The page's address may end in `-2` to `-9`, so a name that makes the same address nine times over is refused. */
const MAX_SLUG_NUMBER = 9;
/** 38 characters and `-9` is 40, the most the database takes for an address. */
const SLUG_STEM_MAX = 38;

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
    await deps.db.gameClip.upsert({
      where: { gameId_shape: { gameId, shape } },
      create: { gameId, shape, key, contentType, bytes: upload.bytes.length },
      update: { key, contentType, bytes: upload.bytes.length },
    });
    await takeOutOfToFix(gameId, shape === "upright" ? "upright_video" : "wide_video");
    if (replaced !== null) await deps.files.delete(replaced.key);
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
    // Files are waiting for a person's yes: the new ones take their place, so staff always review the newest.
    // Only while files still wait and the game is still on Ruken: a game taken off during the copy dropped what waited,
    // and must not come back into staff's queue when the copy ends.
    if (game?.pendingPullId != null) {
      await deps.db.game.updateMany({
        where: { id: gameId, pendingPullId: { not: null }, state: { notIn: ["taken_off", "taken_down"] } },
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
    // A game off Ruken goes back only through Put it back, which makes it a draft first: a copy that was still running
    // when it was taken off must not send it to staff.
    if (game.state === "taken_off" || game.state === "taken_down")
      throw new GameError("NOT_READY", NOT_ON_RUKEN);
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
      playsOn: game.playsOn,
      upright: true,
      wide: true,
      ageRating: game.ageRating,
      contentMarks: game.contentMarks,
    };
    if (firstUnanswered(answers) !== null) throw new GameError("NOT_READY", "Answer every question first.");
    if (game.toFix.length > 0) throw new GameError("NOT_READY", "Fix what was sent back first.");

    await deps.db.game.update({
      where: { id: gameId },
      data: {
        pendingPullId: newest.id,
        pendingSince: new Date(deps.clock.epochMs()),
        state: game.state === "live" ? "live" : "waiting",
      },
    });
  }

  /**
   * Holds the game's row until the transaction ends. A decision reads what is waiting, checks what staff saw and then
   * writes, and under READ COMMITTED a second decision or a maker's save that lands between those reads and the write
   * would slip past `checkSeen`. Taking the row first makes the second one wait, then read what the first one left: a
   * game with nothing waiting, or one that changed.
   */
  async function lockGame(tx: Pick<PrismaClient, "$queryRaw">, gameId: string): Promise<void> {
    await tx.$queryRaw`SELECT "id" FROM "Game" WHERE "id" = ${gameId} FOR UPDATE`;
  }

  /** The game waiting for a person's yes and the files that wait, or a `NOT_READY` that says nothing waits. */
  async function waitingOf(tx: Pick<PrismaClient, "game">, gameId: string) {
    const game = await tx.game.findUnique({
      where: { id: gameId },
      select: { state: true, pendingPullId: true },
    });
    if (game?.pendingPullId == null) throw new GameError("NOT_READY", "Nothing is waiting for review.");
    return { state: game.state, pullId: game.pendingPullId };
  }

  /**
   * Throws unless the game is still what staff saw (audit S-1): its maker can change a waiting game's answers and videos
   * at any moment, and each change is saved at once, so a decision made on a page that went stale would put live, or send
   * back, something nobody looked at. Returns whether the newest copy of its files was refused.
   */
  async function checkSeen(tx: Pick<PrismaClient, "game">, gameId: string, seen: string): Promise<boolean> {
    const row = await tx.game.findUniqueOrThrow({ where: { id: gameId }, select: judgedSelect });
    if (seenOf(row) !== seen) throw new GameError("NOT_READY", GAME_CHANGED_WORDS);
    return row.pullProblem !== null;
  }

  /**
   * Staff's yes: the waiting files go live with the rating staff chose, and one review row records who said so and when.
   * One transaction, so a game is never live without its record. The files the game was live on stay in the bucket.
   * It refuses a game that changed since staff looked (`decision.seen`), and a game whose newest copy of its files was
   * refused: the waiting files are older than what its maker now points at (audit S-6).
   */
  async function accept(gameId: string, staffUserId: string, decision: ReviewDecision): Promise<void> {
    const marks = ratingMarks(decision);
    await deps.db.$transaction(async (tx) => {
      await lockGame(tx, gameId);
      const { pullId } = await waitingOf(tx, gameId);
      const filesRefused = await checkSeen(tx, gameId, decision.seen);
      if (filesRefused) throw new GameError("NOT_READY", FILES_BEING_FIXED_WORDS);
      const decidedAt = new Date(deps.clock.epochMs());
      await tx.game.update({
        where: { id: gameId },
        data: {
          state: "live",
          livePullId: pullId,
          pendingPullId: null,
          pendingSince: null,
          stateReason: null,
          toFix: [],
          ageRating: decision.ageRating,
          contentMarks: marks,
        },
      });
      await tx.gameReview.create({
        data: { gameId, pullId, staffUserId, decision: "accepted", decidedAt },
      });
    });
  }

  /**
   * The marks that go with the rating staff chose, or a refusal in words. Marks belong to an 18+ game only; one sent with
   * any other rating is dropped, since the check page hides the marks until 18+ is chosen and a hidden box that was
   * ticked is still posted. An 18+ game has at least one, and "None of these" stands alone.
   */
  function ratingMarks(choice: { ageRating: AgeRating; contentMarks: ContentMark[] }): ContentMark[] {
    if (!AGE_RATINGS.includes(choice.ageRating)) throw new GameError("INVALID", STAFF_NO_AGE_WORDS);
    if (choice.ageRating !== "age_18") return [];
    const known = choice.contentMarks.filter((mark) => CONTENT_MARKS.includes(mark));
    const problem = marksProblem(known);
    if (problem !== undefined) throw new GameError("INVALID", problem);
    if (known.includes("none")) {
      if (known.length > 1)
        throw new GameError("INVALID", "Pick None of these on its own, or pick what's in it.");
      return ["none"];
    }
    return [...new Set(known)];
  }

  /**
   * Staff's no, part by part: each part with a reason from that part's list, and for "Something else" their own line
   * (spec 11.2). A live game stays live on its old files, and the maker sees what to fix either way. One transaction,
   * so the game and its record never disagree.
   */
  async function sendBack(
    gameId: string,
    staffUserId: string,
    parts: { part: GamePart; reason: string; note?: string }[],
    seen: string,
  ): Promise<void> {
    if (parts.length === 0) throw new GameError("INVALID", "Tick what's wrong first.");
    const chosen = new Set<GamePart>();
    const kept = parts.map((one) => {
      // A part twice, or a reason that belongs to another part, is a screen that was not meant to be possible.
      if (!GAME_PARTS.includes(one.part) || chosen.has(one.part) || !isReasonFor(one.part, one.reason))
        throw new GameError("INVALID", "Pick a reason for each part you ticked.");
      chosen.add(one.part);
      const note = one.note?.trim() ?? "";
      if (one.reason === "something_else" && note === "")
        throw new GameError("INVALID", "Say what's wrong in your own words.");
      if (note.length > NOTE_MAX) throw new GameError("INVALID", "Keep your own words to 500 characters.");
      return { part: one.part, reason: one.reason, note: note === "" ? null : note };
    });

    await deps.db.$transaction(async (tx) => {
      await lockGame(tx, gameId);
      const { state, pullId } = await waitingOf(tx, gameId);
      await checkSeen(tx, gameId, seen);
      if (state === "live" && kept.some((one) => !LIVE_MAY_BE_SENT_BACK.includes(one.part))) {
        throw new GameError(
          "INVALID",
          "A live game can only be sent back for its name, its line, where it plays or its files.",
        );
      }
      const decidedAt = new Date(deps.clock.epochMs());
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
      await tx.gameReview.create({
        data: {
          gameId,
          pullId,
          staffUserId,
          decision: "sent_back",
          decidedAt,
          parts: { create: kept },
        },
      });
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
      data: { publicId: newPublicId(), slug: await freeSlug(base), makerUserId: input.makerUserId, name },
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
        reviews: { where: { decision: "accepted" }, take: 1, select: { id: true } },
      },
    });
    if (game === null) throw new GameError("NOT_FOUND", "We can't find that game.");
    return game;
  }

  /** The answers a live game may still change by itself: the rest go through staff again (slice 4). */
  const LIVE_MAY_CHANGE: Answer["question"][] = ["name", "line", "plays-on"];

  /**
   * Keeps one answer. A draft, a waiting game and a sent-back game take every answer; a live game takes only its name,
   * its line and where it plays; anything else is not the maker's to change. Answers the game's address, which a new
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
      playsOn?: GamePlaysOn;
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
      case "plays-on": {
        const problem = PLAYS_ON.includes(answer.playsOn) ? undefined : playsOnProblem(null);
        if (problem !== undefined) throw new GameError("INVALID", problem);
        data.playsOn = answer.playsOn;
        part = "plays_on";
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
      data: { ...data, ...(part === "files" ? {} : { toFix: game.toFix.filter((one) => one !== part) }) },
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
   * Takes a live game off Ruken (the agreement's first point: the maker may remove a game at any time). The row stays
   * with its address and its clips, so what the game earned and who played it are still there, and an update that was
   * waiting for review is dropped with it. Only a live game is taken off: every other state has its own way out (a
   * draft or a sent-back game is thrown away, a waiting one is with staff).
   *
   * The database goes first, in one transaction with the record of who did it: if deleting the files then stops
   * halfway, the game is already off its page and no new pass is given, and the maker's page offers to delete the rest
   * (`filesLeft`, `deleteLeftFiles`).
   */
  async function takeOff(gameId: string, makerUserId: string): Promise<{ name: string }> {
    const game = await ownGame(gameId, makerUserId);
    if (game.state !== "live") throw new GameError("NOT_READY", NOT_ON_RUKEN);
    await deps.db.$transaction(async (tx) => {
      // Only while it is still live: a second press, from another tab or device, finds nothing to change and writes no
      // second record.
      const changed = await tx.game.updateMany({
        where: { id: gameId, state: "live" },
        data: {
          state: "taken_off",
          livePullId: null,
          pendingPullId: null,
          pendingSince: null,
          stateReason: null,
          toFix: [],
        },
      });
      if (changed.count === 0) throw new GameError("NOT_READY", NOT_ON_RUKEN);
      await tx.makerAction.create({
        data: { gameId, userId: makerUserId, action: "taken_off", at: new Date(deps.clock.epochMs()) },
      });
    });
    await deps.files.deleteAll(`files/${game.publicId}/`);
    return { name: game.name };
  }

  /** Deletes what is left of a taken-off game's files, after a delete that stopped halfway. */
  async function deleteLeftFiles(gameId: string, makerUserId: string): Promise<void> {
    const game = await ownGame(gameId, makerUserId);
    if (game.state !== "taken_off") throw new GameError("NOT_READY", "This game is on Ruken.");
    await deps.files.deleteAll(`files/${game.publicId}/`);
  }

  /**
   * Puts a taken-off game back: it becomes a draft again, its newest files are copied from GitHub and sent for review,
   * so it waits for a person's yes like a new game and is never live without one. Its old files were deleted when it
   * was taken off, so the old copy must never count as its files: the draft is made with a problem on its files in the
   * same write, which only a copy that passes clears. A request cut off mid-copy leaves a draft whose files question
   * asks again, and a refused copy puts its own words in that problem's place.
   */
  async function putBack(gameId: string, makerUserId: string): Promise<void> {
    const game = await ownGame(gameId, makerUserId);
    if (game.state !== "taken_off") throw new GameError("NOT_READY", "This game is on Ruken.");
    await deps.db.$transaction(async (tx) => {
      // Only while it is still off: a second press finds nothing to change, writes no second record and copies nothing.
      const changed = await tx.game.updateMany({
        where: { id: gameId, state: "taken_off" },
        data: { state: "draft", pullProblem: COPY_NOT_FINISHED },
      });
      if (changed.count === 0) throw new GameError("NOT_READY", "This game is on Ruken.");
      await tx.makerAction.create({
        data: { gameId, userId: makerUserId, action: "put_back", at: new Date(deps.clock.epochMs()) },
      });
    });
    try {
      await pullLatest(gameId);
    } catch (refusal) {
      // A refused check of the files writes its own words already, but a refusal before the copy (GitHub, the
      // connection) does not, so this one's words are written here for every refusal alike. A failure that is not
      // Ruken's own refusal is told in plain words too, because the draft and its problem are already kept.
      const words = refusal instanceof GameError ? refusal.message : COPY_FAILED;
      await deps.db.game.update({ where: { id: gameId }, data: { pullProblem: words } });
      throw refusal instanceof GameError ? refusal : new GameError("NOT_READY", words);
    }
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

  /** Games with files waiting for a person's yes, the oldest first. */
  async function waitingGames(): Promise<WaitingGame[]> {
    const rows = await deps.db.game.findMany({
      where: { pendingPullId: { not: null } },
      orderBy: { pendingSince: "asc" },
      select: { slug: true, name: true, state: true, pendingSince: true, maker: { select: { email: true } } },
    });
    return rows.map((row) => ({
      slug: row.slug,
      name: row.name,
      makerEmail: row.maker.email,
      // `pendingSince` is set with `pendingPullId`, so a waiting game always has it.
      sentAt: row.pendingSince ?? new Date(0),
      // A live game's waiting files are an update to it; every other game waits for its first yes.
      kind: row.state === "live" ? ("update" as const) : ("game" as const),
    }));
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
    oneLine: true,
    playsOn: true,
    ageRating: true,
    contentMarks: true,
    toFix: true,
    pulls: { orderBy: NEWEST_FIRST, take: 1, select: { id: true, fileCount: true, totalBytes: true } },
    clips: { select: { shape: true, key: true, bytes: true } },
    // Newest first: the first sent-back review is what the maker still has to fix, and any accepted one means the
    // game has been live.
    reviews: {
      orderBy: { decidedAt: "desc" },
      select: {
        decision: true,
        parts: { select: { part: true, reason: true, note: true } },
      },
    },
    // The newest time its maker took it off, for the Taken off screen's "You took it off on 12 December".
    makerActions: { where: { action: "taken_off" }, orderBy: { at: "desc" }, take: 1, select: { at: true } },
  } as const;

  /** What a decision is made on: the parts a person judges (`seenOf`), and whether the newest copy of the files was refused. */
  const judgedSelect = {
    name: true,
    oneLine: true,
    playsOn: true,
    ageRating: true,
    contentMarks: true,
    connectHosts: true,
    pendingPullId: true,
    pullProblem: true,
    clips: { select: { shape: true, key: true } },
  } as const;

  /** The clip of one shape, with its size, or null when there is none. */
  function clipFile(clips: { shape: ClipShape; key: string; bytes: number }[], shape: ClipShape) {
    const found = clips.find((clip) => clip.shape === shape);
    return found === undefined ? null : { key: found.key, bytes: found.bytes };
  }

  /** A game row as the maker sees it. */
  function makerView(
    row: {
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
      playsOn: GamePlaysOn | null;
      ageRating: AgeRating | null;
      contentMarks: ContentMark[];
      toFix: GamePart[];
      pulls: { id: string; fileCount: number; totalBytes: bigint }[];
      clips: { shape: ClipShape; key: string; bytes: number }[];
      reviews: {
        decision: "accepted" | "sent_back";
        parts: { part: GamePart; reason: string; note: string | null }[];
      }[];
      makerActions: { at: Date }[];
    },
    filesLeft: boolean,
  ): MakerGame {
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
      playsOn: row.playsOn,
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
      takenOffAt: row.state === "taken_off" ? (row.makerActions[0]?.at ?? null) : null,
      filesLeft,
    };
  }

  /** Whether a game that is off Ruken still has files in the bucket. Only such a game is asked about. */
  async function filesLeftOf(row: { state: GameState; publicId: string }): Promise<boolean> {
    return row.state === "taken_off" && (await deps.files.hasAny(`files/${row.publicId}/`));
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
    return row.toFix.flatMap((part) => {
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
        playsOn: true,
        ageRating: true,
        contentMarks: true,
        toFix: true,
        clips: { select: { shape: true, key: true } },
        _count: { select: { pulls: true } },
        reviews: { orderBy: { decidedAt: "desc" }, take: 1, select: { decision: true } },
      },
    });
    return rows.map((row) => {
      const answers: Answers = {
        oneLine: row.oneLine,
        hasFiles: row._count.pulls > 0 && row.pullProblem === null,
        playsOn: row.playsOn,
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
          toFix: row.toFix.length,
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
    return row === null ? null : makerView(row, await filesLeftOf(row));
  }

  /** A game as staff see it: the maker's view, the files that wait and the two clips' keys. Null when there is none. */
  async function gameForReview(slug: string): Promise<ReviewGame | null> {
    const row = await deps.db.game.findUnique({
      where: { slug },
      select: {
        ...gameSelect,
        pendingSince: true,
        maker: { select: { email: true } },
        pendingPull: { select: { id: true, fileCount: true, totalBytes: true, connectHosts: true } },
      },
    });
    if (row === null) return null;
    const pending = row.pendingPull;
    return {
      ...makerView(row, await filesLeftOf(row)),
      makerEmail: row.maker.email,
      sentAt: row.pendingSince,
      seen: seenOf(row),
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
    };
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
        playsOn: true,
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
    if (game.oneLine === null || game.playsOn === null || game.ageRating === null) return null;
    return {
      id: game.id,
      publicId: game.publicId,
      slug: game.slug,
      name: game.name,
      oneLine: game.oneLine,
      playsOn: game.playsOn,
      freeToPlay: game.freeToPlay,
      makerUserId: game.makerUserId,
      livePullId: game.livePull.id,
      connectHosts: game.livePull.connectHosts,
      ageRating: game.ageRating,
      contentMarks: game.contentMarks,
      clips: { upright, wide },
    };
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

  return {
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
    gamesOf,
    gameForMaker,
    gameForReview,
    liveGameBySlug,
    rememberConnection,
    repositoriesFor,
    hasConnectedGitHub,
  };
}

export type GamesService = ReturnType<typeof createGamesService>;
