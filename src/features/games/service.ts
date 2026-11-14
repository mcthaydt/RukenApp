import type { Clock } from "../../lib/clock.ts";
import type { FileStore } from "../../lib/files/store.ts";
import type { ClipShape, GamePlaysOn, GameState, PrismaClient } from "../../lib/server/db.ts";
import { clipKeyFor, clipProblem, type ClipContentType } from "./clips.ts";
import { GameError } from "./game-error.ts";
import type { Connection } from "./github-connect.ts";
import { checkBranch, checkRepo, NOT_VISIBLE, type GitHub } from "./github.ts";
import { newPublicId, slugOf } from "./ids.ts";
import { pullGame, type Pull } from "./pull.ts";
import { stateWords } from "./review.ts";

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
  clips: { upright: string; wide: string };
}

/** What a maker types to start a game, after the form has read it. */
export interface CreateGameInput {
  makerUserId: string;
  name: string;
  oneLine: string;
  playsOn: GamePlaysOn;
  repo: { fullName: string; branch: string | null; folder: string };
  connectHosts: string[];
}

/** What the maker's list shows for a game: its name and where it stands, in words. */
export interface MakerGameRow {
  slug: string;
  name: string;
  words: string;
}

/** What a game's page in the maker's area shows. Sizes are measured from the pull; nobody types them. */
export interface MakerGame {
  id: string;
  slug: string;
  publicId: string;
  name: string;
  state: GameState;
  words: string;
  repoFullName: string;
  repoBranch: string | null;
  repoFolder: string;
  connectHosts: string[];
  /** The words of the last pull's refusal, or null. */
  pullProblem: string | null;
  newestPull: { id: string; fileCount: number; totalBytes: number } | null;
  clips: { upright: boolean; wide: boolean };
}

/** What staff see of a game waiting for review: the maker's view, and the files that wait. */
export interface ReviewGame extends MakerGame {
  pending: { id: string; fileCount: number; totalBytes: number; connectHosts: string[] } | null;
  clipKeys: { upright: string | null; wide: string | null };
}

const NAME_MAX = 60;
/** The most a reason for sending a game back may say. */
const REASON_MAX = 500;
const ONE_LINE_MAX = 100;
/** The page's address may end in `-2` to `-9`, so a name that makes the same address nine times over is refused. */
const MAX_SLUG_NUMBER = 9;
/** 38 characters and `-9` is 40, the most the database takes for an address. */
const SLUG_STEM_MAX = 38;

/** Throws unless `folder` is a folder inside a repository: "" for the top, no slash at either end, no `..` step. */
function checkFolder(folder: string): void {
  if (
    folder.length > 200 ||
    folder.startsWith("/") ||
    folder.endsWith("/") ||
    folder.split("/").includes("..")
  ) {
    throw new GameError(
      "INVALID",
      "That doesn't look like a folder. Write it like web/build, with no slash at the start or end.",
    );
  }
}

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
    if (game.state === "live") throw new GameError("NOT_READY", "A live game's clips can't be changed yet.");

    const key = clipKeyFor(game.publicId, shape, randomHex16(), contentType);
    const replaced = await deps.db.gameClip.findUnique({ where: { gameId_shape: { gameId, shape } } });

    await deps.files.put(key, upload.bytes);
    await deps.db.gameClip.upsert({
      where: { gameId_shape: { gameId, shape } },
      create: { gameId, shape, key, contentType, bytes: upload.bytes.length },
      update: { key, contentType, bytes: upload.bytes.length },
    });
    if (replaced !== null) await deps.files.delete(replaced.key);
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
    throw new GameError("NOT_CONNECTED", NOT_VISIBLE);
  }

  /** An address for a name: the name's own, or with `-2` to `-9` when that is taken. Refuses when all nine are. */
  async function freeSlug(base: string): Promise<string> {
    // Cut before the number goes on, so `<38 characters>-9` still fits the database's 40; a hyphen the cut leaves at
    // the end goes too.
    const stem = base.slice(0, SLUG_STEM_MAX).replace(/-+$/, "");
    const candidates = [
      base,
      ...Array.from({ length: MAX_SLUG_NUMBER - 1 }, (_, i) => `${stem}-${String(i + 2)}`),
    ];
    const rows = await deps.db.game.findMany({ where: { slug: { in: candidates } }, select: { slug: true } });
    const taken = new Set(rows.map((row) => row.slug));
    const free = candidates.find((candidate) => !taken.has(candidate));
    if (free === undefined) throw new GameError("INVALID", "That name is taken. Pick another.");
    return free;
  }

  /**
   * Starts a game as a draft. What the maker typed is checked before anything is kept: the name and the line, the
   * repository, the branch and the folder, so nothing unchecked is ever put in a GitHub address later.
   */
  async function createGame(input: CreateGameInput): Promise<{ id: string; slug: string; publicId: string }> {
    const name = input.name.trim();
    if (name === "") throw new GameError("INVALID", "A game needs a name.");
    if (name.length > NAME_MAX) throw new GameError("INVALID", "A game's name can be up to 60 characters.");
    const oneLine = input.oneLine.trim();
    if (oneLine === "") throw new GameError("INVALID", "A game needs one line about it.");
    if (oneLine.length > ONE_LINE_MAX)
      throw new GameError("INVALID", "The one line can be up to 100 characters.");
    const base = slugOf(name);
    if (base === null) throw new GameError("INVALID", "Pick a name with at least three letters or numbers.");

    checkRepo(input.repo.fullName);
    if (input.repo.branch !== null) checkBranch(input.repo.branch);
    checkFolder(input.repo.folder);
    await checkReachable(input.makerUserId, input.repo.fullName);

    return deps.db.game.create({
      data: {
        publicId: newPublicId(),
        slug: await freeSlug(base),
        makerUserId: input.makerUserId,
        name,
        oneLine,
        playsOn: input.playsOn,
        repoFullName: input.repo.fullName,
        repoBranch: input.repo.branch,
        repoFolder: input.repo.folder,
        connectHosts: input.connectHosts,
      },
      select: { id: true, slug: true, publicId: true },
    });
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
    if (game !== null) await checkReachable(game.makerUserId, game.repoFullName);
    const pull = await pullGame(deps, gameId);
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
        pulls: { orderBy: NEWEST_FIRST, take: 1, select: { id: true } },
        clips: { select: { shape: true } },
      },
    });
    if (game === null) throw new GameError("NOT_FOUND", "We can't find that game.");
    const newest = game.pulls[0];
    if (newest === undefined) throw new GameError("NOT_READY", "Pull your game's files first.");
    if (!game.clips.some((clip) => clip.shape === "upright")) {
      throw new GameError("NOT_READY", "Add an upright clip.");
    }
    if (!game.clips.some((clip) => clip.shape === "wide"))
      throw new GameError("NOT_READY", "Add a wide clip.");

    await deps.db.game.update({
      where: { id: gameId },
      data: {
        pendingPullId: newest.id,
        pendingSince: new Date(deps.clock.epochMs()),
        state: game.state === "live" ? "live" : "waiting",
      },
    });
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
   * Staff's yes: the waiting files go live, and one review row records who said so and when. One transaction, so a
   * game is never live without its record. The files the game was live on stay in the bucket.
   */
  async function accept(gameId: string, staffUserId: string): Promise<void> {
    await deps.db.$transaction(async (tx) => {
      const { pullId } = await waitingOf(tx, gameId);
      const decidedAt = new Date(deps.clock.epochMs());
      await tx.game.update({
        where: { id: gameId },
        data: {
          state: "live",
          livePullId: pullId,
          pendingPullId: null,
          pendingSince: null,
          stateReason: null,
        },
      });
      await tx.gameReview.create({
        data: { gameId, pullId, staffUserId, decision: "accepted", decidedAt },
      });
    });
  }

  /**
   * Staff's no, with what the maker should fix (1 to 500 characters). The waiting files are dropped. A game that was not
   * live becomes `sent_back`; a live game stays live on its old files and keeps the reason to show.
   */
  async function sendBack(gameId: string, staffUserId: string, reason: string): Promise<void> {
    const why = reason.trim();
    if (why === "" || why.length > REASON_MAX)
      throw new GameError("INVALID", "Say what the maker should fix.");
    await deps.db.$transaction(async (tx) => {
      const { state, pullId } = await waitingOf(tx, gameId);
      const decidedAt = new Date(deps.clock.epochMs());
      await tx.game.update({
        where: { id: gameId },
        data: {
          state: state === "live" ? "live" : "sent_back",
          pendingPullId: null,
          pendingSince: null,
          stateReason: why,
        },
      });
      await tx.gameReview.create({
        data: { gameId, pullId, staffUserId, decision: "sent_back", reason: why, decidedAt },
      });
    });
  }

  /** Games with files waiting for a person's yes, the oldest first. */
  async function waitingGames(): Promise<{ slug: string; name: string; makerEmail: string; sentAt: Date }[]> {
    const rows = await deps.db.game.findMany({
      where: { pendingPullId: { not: null } },
      orderBy: { pendingSince: "asc" },
      select: { slug: true, name: true, pendingSince: true, maker: { select: { email: true } } },
    });
    return rows.map((row) => ({
      slug: row.slug,
      name: row.name,
      makerEmail: row.maker.email,
      // `pendingSince` is set with `pendingPullId`, so a waiting game always has it.
      sentAt: row.pendingSince ?? new Date(0),
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
    pulls: { orderBy: NEWEST_FIRST, take: 1, select: { id: true, fileCount: true, totalBytes: true } },
    clips: { select: { shape: true, key: true } },
  } as const;

  /** A game row as the maker sees it. */
  function makerView(row: {
    id: string;
    slug: string;
    publicId: string;
    name: string;
    state: GameState;
    stateReason: string | null;
    repoFullName: string;
    repoBranch: string | null;
    repoFolder: string;
    connectHosts: string[];
    pullProblem: string | null;
    pendingPullId: string | null;
    pulls: { id: string; fileCount: number; totalBytes: bigint }[];
    clips: { shape: ClipShape; key: string }[];
  }): MakerGame {
    const newest = row.pulls[0];
    return {
      id: row.id,
      slug: row.slug,
      publicId: row.publicId,
      name: row.name,
      state: row.state,
      words: stateWords({
        state: row.state,
        stateReason: row.stateReason,
        hasPending: row.pendingPullId !== null,
      }),
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
        upright: row.clips.some((clip) => clip.shape === "upright"),
        wide: row.clips.some((clip) => clip.shape === "wide"),
      },
    };
  }

  /** A maker's games for their list, newest first, with each one's state in words. */
  async function gamesOf(makerUserId: string): Promise<MakerGameRow[]> {
    const rows = await deps.db.game.findMany({
      where: { makerUserId },
      orderBy: { createdAt: "desc" },
      select: { slug: true, name: true, state: true, stateReason: true, pendingPullId: true },
    });
    return rows.map((row) => ({
      slug: row.slug,
      name: row.name,
      words: stateWords({
        state: row.state,
        stateReason: row.stateReason,
        hasPending: row.pendingPullId !== null,
      }),
    }));
  }

  /** One of a maker's games for its page. Someone else's game, or none, is null. */
  async function gameForMaker(slug: string, makerUserId: string): Promise<MakerGame | null> {
    const row = await deps.db.game.findFirst({ where: { slug, makerUserId }, select: gameSelect });
    return row === null ? null : makerView(row);
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
    return {
      ...makerView(row),
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
        livePull: { select: { id: true, connectHosts: true } },
        clips: { select: { shape: true, key: true } },
      },
    });
    if (game === null || game.state !== "live" || game.livePull === null) return null;
    const upright = game.clips.find((clip) => clip.shape === "upright")?.key;
    const wide = game.clips.find((clip) => clip.shape === "wide")?.key;
    if (upright === undefined || wide === undefined) return null;
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

  return {
    saveClip,
    createGame,
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
  };
}

export type GamesService = ReturnType<typeof createGamesService>;
