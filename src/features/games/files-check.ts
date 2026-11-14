import { normalizePath } from "../../lib/files/safe-path.ts";

// What a pull checks before it stores anything. A refusal says what to fix, in words a maker can act on.

// FloorFifty's measured build (91,441,454 bytes in 326 files, the largest 10,680,799 bytes) times four, rounded up.
// They are a first guess, and the real site's first pull is what tells whether they hold.
export const MAX_GAME_BYTES = 400_000_000;
export const MAX_GAME_FILES = 1_500;
export const MAX_FILE_BYTES = 50_000_000;

/** The longest file path the pull takes, in characters. */
const MAX_PATH_LENGTH = 300;

/** The most servers a game may list. */
const MAX_CONNECT_HOSTS = 5;

/** One entry of a pulled folder. `path` is relative to the game's folder, as the tarball wrote it. */
export interface PulledFile {
  path: string;
  size: number;
  /** A real file, a link to another file, or a Git LFS pointer (a file that starts `version https://git-lfs.github.com/spec/v1`). */
  kind: "file" | "link" | "lfs";
}

/** Whole megabytes of 1,000,000 bytes, rounded up, with a thousands comma: `41 MB`. */
function megabytes(bytes: number): string {
  return `${count(Math.ceil(bytes / 1_000_000))} MB`;
}

/** A count with a thousands comma: `1,501`. */
function count(value: number): string {
  return value.toLocaleString("en-US");
}

const CONNECT_HOSTS_PROBLEM = "Write each server as a name like api.example.com, one per line, five at most.";

// A name with at least one dot, in labels of letters, digits and inner hyphens, and an optional port. No scheme,
// path or `*`: the gate puts each name in a `connect-src` as `https://<name> wss://<name>`.
const HOST_NAME = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+(:\d{1,5})?$/;

/**
 * The servers a maker listed, one name per line: blank lines are dropped and names are lower-cased. Answers the
 * list, or the words of the first thing wrong with it. An empty text is a game that talks to no server.
 */
export function connectHostsFrom(text: string): { hosts: string[] } | { problem: string } {
  const hosts = text
    .split("\n")
    .map((line) => line.trim().toLowerCase())
    .filter((line) => line !== "");
  const valid = hosts.every((host) => HOST_NAME.test(host));
  const noRepeats = new Set(hosts).size === hosts.length;
  if (!valid || !noRepeats || hosts.length > MAX_CONNECT_HOSTS) return { problem: CONNECT_HOSTS_PROBLEM };
  return { hosts };
}

// An address in index.html that starts with one slash but not two (`//cdn.example/x.js` names another site).
// At least one more character is needed, so the fix we suggest is never empty.
const TOP_OF_SITE_ADDRESS = /\b(?:src|href)\s*=\s*["'](\/(?!\/)[^"'\s>]+)["']/i;

/**
 * Checks a pulled folder against the rules of design 5.4. The first failing rule wins, so a maker fixes one thing
 * at a time. `indexHtml` is the text of the top `index.html`, or null when there is none.
 */
export function checkGameFiles(
  files: readonly PulledFile[],
  indexHtml: string | null,
): { ok: true; fileCount: number; totalBytes: number } | { ok: false; problem: string } {
  const refuse = (problem: string): { ok: false; problem: string } => ({ ok: false, problem });

  if (files.length === 0) {
    return refuse("We couldn't find that folder in your repository. Check the folder's name and pull again.");
  }
  if (indexHtml === null) {
    return refuse(
      "We couldn't find an index.html at the top of that folder. Ruken starts a game from index.html.",
    );
  }
  const link = files.find((entry) => entry.kind === "link");
  if (link !== undefined) {
    return refuse(
      `${link.path} is a link to another file. Ruken copies real files only. Replace it with the file itself.`,
    );
  }
  const lfs = files.find((entry) => entry.kind === "lfs");
  if (lfs !== undefined) {
    return refuse(
      `${lfs.path} is kept in Git LFS, and Ruken can't pull those yet. Add the real file to the repository.`,
    );
  }
  // The gate decodes a request's path the same way, so a name it could not match is refused here, not found
  // missing later.
  const unservable = files.find(
    (entry) => entry.path.length > MAX_PATH_LENGTH || normalizePath(entry.path) === null || entry.path === "",
  );
  if (unservable !== undefined) {
    return refuse(
      `One of your files has a name Ruken can't serve: ${unservable.path}. Rename it and pull again.`,
    );
  }
  if (files.length > MAX_GAME_FILES) {
    return refuse(
      `Your game has ${count(files.length)} files. The most Ruken takes is ${count(MAX_GAME_FILES)}.`,
    );
  }
  const tooBig = files.find((entry) => entry.size > MAX_FILE_BYTES);
  if (tooBig !== undefined) {
    return refuse(
      `${tooBig.path} is ${megabytes(tooBig.size)}. The biggest single file Ruken takes is ${megabytes(MAX_FILE_BYTES)}.`,
    );
  }
  const totalBytes = files.reduce((sum, entry) => sum + entry.size, 0);
  if (totalBytes > MAX_GAME_BYTES) {
    return refuse(
      `Your game's files add up to ${megabytes(totalBytes)}. The most Ruken takes is ${megabytes(MAX_GAME_BYTES)}.`,
    );
  }
  const topOfSite = TOP_OF_SITE_ADDRESS.exec(indexHtml)?.[1];
  if (topOfSite !== undefined) {
    return refuse(
      `index.html loads ${topOfSite} from the top of the site. On Ruken a game lives in a folder, so write it without the first slash: ${topOfSite.slice(1)}.`,
    );
  }
  return { ok: true, fileCount: files.length, totalBytes };
}
