import type { Clock } from "../../lib/clock.ts";
import { normalizePath } from "../../lib/files/safe-path.ts";
import type { FileStore } from "../../lib/files/store.ts";
import { tarEntries, type TarEntry } from "../../lib/files/tar.ts";
import type { PrismaClient } from "../../lib/server/db.ts";
import {
  checkGameFiles,
  MAX_FILE_BYTES,
  MAX_GAME_BYTES,
  MAX_GAME_FILES,
  type PulledFile,
} from "./files-check.ts";
import { GameError } from "./game-error.ts";
import type { GitHub } from "./github.ts";

// Pulling a game: ask GitHub for one commit of the maker's repository, check what is in the chosen folder, and only
// then copy it into the bucket. A refused game leaves nothing behind, and a pull never touches the files of the pull
// a live game is running on.

export interface PullDeps {
  db: PrismaClient;
  clock: Clock;
  github: GitHub;
  files: FileStore;
}

/** What a pull measured. Nobody types any of it. */
export interface Pull {
  id: string;
  commitSha: string;
  fileCount: number;
  totalBytes: number;
}

/** A Git LFS pointer is a short text file that starts with this line; the real file is kept elsewhere. */
const LFS_POINTER_START = "version https://git-lfs.github.com/spec/v1";
const LFS_POINTER_MAX_BYTES = 200;

/** The top `index.html` is read, up to this much, to check where it loads its files from. */
const INDEX_HTML_MAX_BYTES = 2_000_000;

/** Where in a repository a game lives. */
interface Target {
  repoFullName: string;
  repoBranch: string | null;
  repoFolder: string;
}

/**
 * The files of the maker's folder in one commit, as the tarball streams them, with each path made relative to that
 * folder. GitHub puts the whole commit under one top folder, so the first part of every path is dropped. Folders
 * are left out, and so is anything outside the maker's folder (`web/builder` is not in `web/build`).
 */
async function* folderEntries(
  github: GitHub,
  target: Target,
  commitSha: string,
): AsyncGenerator<{ path: string; entry: TarEntry }> {
  const folder = target.repoFolder;
  for await (const entry of tarEntries(await github.tarball(target.repoFullName, commitSha))) {
    const slash = entry.path.indexOf("/");
    if (slash === -1) continue;
    const inRepository = entry.path.slice(slash + 1);
    let path: string | null = null;
    if (folder === "") path = inRepository;
    else if (inRepository.startsWith(`${folder}/`)) path = inRepository.slice(folder.length + 1);
    if (path === null || path === "" || entry.kind === "directory" || entry.kind === "other") continue;
    yield { path, entry };
  }
}

/**
 * The first read: lists every file of the folder and reads the top `index.html`, storing nothing. It stops as soon
 * as the count or the total passes its limit, so a huge repository is not read to the end to be refused.
 */
async function scanFolder(
  github: GitHub,
  target: Target,
  commitSha: string,
): Promise<{ files: PulledFile[]; indexHtml: string | null }> {
  const files: PulledFile[] = [];
  let indexHtml: string | null = null;
  let totalBytes = 0;
  let stoppedEarly = false;

  for await (const { path, entry } of folderEntries(github, target, commitSha)) {
    if (entry.kind === "link") {
      files.push({ path, size: 0, kind: "link" });
      continue;
    }
    // A short file may be a Git LFS pointer, and the top index.html is needed for the address check: those are read.
    const isIndex = path === "index.html";
    const isShort = entry.size <= LFS_POINTER_MAX_BYTES;
    const content =
      isShort || (isIndex && entry.size <= INDEX_HTML_MAX_BYTES)
        ? await entry.bytes(INDEX_HTML_MAX_BYTES)
        : null;
    const text = content === null ? null : new TextDecoder().decode(content);
    // An index.html over the read limit counts as present but unchecked; the other rules still apply to it.
    if (isIndex) indexHtml = text ?? "";
    const isPointer = isShort && text !== null && text.startsWith(LFS_POINTER_START);

    files.push({ path, size: entry.size, kind: isPointer ? "lfs" : "file" });
    totalBytes += entry.size;
    if (files.length > MAX_GAME_FILES || totalBytes > MAX_GAME_BYTES) {
      stoppedEarly = true;
      break;
    }
  }
  // Stopped early, the index.html may simply not have come past yet: the limit is what to tell the maker, not that.
  return { files, indexHtml: stoppedEarly ? (indexHtml ?? "") : indexHtml };
}

/**
 * Pulls a game's files from GitHub into the bucket, under a folder of their own, and records the pull. The game's
 * `livePullId` is not touched: a new pull becomes live only when a person accepts it.
 */
export async function pullGame(deps: PullDeps, gameId: string): Promise<Pull> {
  const game = await deps.db.game.findUnique({
    where: { id: gameId },
    select: { publicId: true, repoFullName: true, repoBranch: true, repoFolder: true, connectHosts: true },
  });
  if (game === null) throw new GameError("NOT_FOUND", "We can't find that game.");

  // One commit, resolved once: both reads below are of the same files even if the branch moves in between.
  const commitSha = await deps.github.commitOf(game.repoFullName, game.repoBranch);

  const scan = await scanFolder(deps.github, game, commitSha);
  const verdict = checkGameFiles(scan.files, scan.indexHtml);
  if (!verdict.ok) {
    await deps.db.game.update({ where: { id: gameId }, data: { pullProblem: verdict.problem } });
    throw new GameError("FILES_REFUSED", verdict.problem);
  }

  // The folder is named before its row exists, so a file's address never depends on the row.
  const pullId = crypto.randomUUID();
  for await (const { path, entry } of folderEntries(deps.github, game, commitSha)) {
    // The name the gate will look for: the check refused every path `normalizePath` would not answer.
    const name = normalizePath(path);
    if (entry.kind !== "file" || name === null) continue;
    // One file at a time: R2 needs a file's length before it takes it, so each is held in memory just long enough.
    await deps.files.put(`files/${game.publicId}/${pullId}/${name}`, await entry.bytes(MAX_FILE_BYTES));
  }

  await deps.db.$transaction([
    deps.db.gamePull.create({
      data: {
        id: pullId,
        gameId,
        commitSha,
        fileCount: verdict.fileCount,
        totalBytes: BigInt(verdict.totalBytes),
        connectHosts: game.connectHosts,
        pulledAt: new Date(deps.clock.epochMs()),
      },
    }),
    deps.db.game.update({ where: { id: gameId }, data: { pullProblem: null } }),
  ]);
  return { id: pullId, commitSha, fileCount: verdict.fileCount, totalBytes: verdict.totalBytes };
}
