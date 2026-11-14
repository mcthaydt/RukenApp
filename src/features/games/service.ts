import type { Clock } from "../../lib/clock.ts";
import type { FileStore } from "../../lib/files/store.ts";
import type { ClipShape, GamePlaysOn, PrismaClient } from "../../lib/server/db.ts";
import { clipKeyFor, clipProblem, type ClipContentType } from "./clips.ts";
import { GameError } from "./game-error.ts";
import type { Connection } from "./github-connect.ts";
import { checkBranch, checkRepo, NOT_VISIBLE, type GitHub } from "./github.ts";
import { newPublicId, slugOf } from "./ids.ts";
import { pullGame, type Pull } from "./pull.ts";

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

const NAME_MAX = 60;
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

    const game = await deps.db.game.findUnique({ where: { id: gameId }, select: { publicId: true } });
    if (game === null) throw new GameError("NOT_FOUND", "We can't find that game.");

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
      select: { makerUserId: true, repoFullName: true },
    });
    // A game that is not there is `pullGame`'s to refuse, in its own words.
    if (game !== null) await checkReachable(game.makerUserId, game.repoFullName);
    return pullGame(deps, gameId);
  }

  /**
   * Makes a game live on one of its pulls. Sending for review and accepting replace this; until they exist it is what
   * puts a game on the site. The pull must be this game's, and both clips must be there.
   */
  async function goLive(gameId: string, pullId: string): Promise<void> {
    const [pull, clipCount] = await Promise.all([
      deps.db.gamePull.findFirst({ where: { id: pullId, gameId }, select: { id: true } }),
      // A game has at most one clip of each shape, so two clips are one of each.
      deps.db.gameClip.count({ where: { gameId } }),
    ]);
    if (pull === null || clipCount < 2) {
      throw new GameError(
        "NOT_READY",
        "A game needs its files, an upright clip and a wide clip before it can go live.",
      );
    }
    await deps.db.game.update({
      where: { id: gameId },
      data: { state: "live", livePullId: pullId, stateReason: null },
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
    goLive,
    liveGameBySlug,
    rememberConnection,
    repositoriesFor,
  };
}

export type GamesService = ReturnType<typeof createGamesService>;
