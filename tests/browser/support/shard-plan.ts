// Fills CI's six browser pieces by time, so they end together (docs/superpowers/specs/2026-11-22-faster-ci-design.md,
// unit T). Playwright's own `--shard` splits by count, and its pieces ended up to 1.4 times the mean.
//
// The plan is made of (file, device profile) pairs: every journey file under the test folder, crossed with the device
// profiles. The longest pair is dealt first, each to the piece with the least time so far, ties to the lower piece.
// A pair with no recorded time counts as the median of the recorded ones. Every input is sorted first, so all six
// pieces make the same plan from the same times, whatever order the disk or the file gives them.
//
// The times come from `main` (ci.yml, the `test-times` job): {"<device profile>|<file>": seconds}, the file relative
// to the test folder. playwright.config.ts asks `pieceFromEnv` what this piece runs. When the piece number can be read
// but the times cannot, the piece falls back to Playwright's own split by count, which CI no longer passes as `--shard`
// once a times file is there; so with good times or bad, the six pieces together run every journey once. With no piece
// number at all, the config is as if the planner were not there.
import { readdirSync, readFileSync } from "node:fs";
import { join, posix, relative, sep } from "node:path";

export type Pair = { file: string; project: string };

/** Playwright's own test match rule, which playwright.config.ts does not change. */
export const JOURNEY_FILE = /\.(test|spec)\.(c|m)?[jt]sx?$/;

/** Every journey file under `testDir`, relative to it with "/" between folders, sorted. */
export function listJourneyFiles(testDir: string): string[] {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules") continue;
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile() && JOURNEY_FILE.test(entry.name))
        files.push(relative(testDir, path).split(sep).join(posix.sep));
    }
  };
  walk(testDir);
  return files.sort();
}

const keyOf = (pair: Pair) => `${pair.project}|${pair.file}`;

function median(values: number[]): number {
  if (!values.length) return 1;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const upper = sorted[mid] ?? 1;
  return sorted.length % 2 ? upper : ((sorted[mid - 1] ?? upper) + upper) / 2;
}

export type Piece = { pairs: Pair[]; seconds: number };

/** Deals `pairs` into `pieces` pieces by `times` (seconds per "<project>|<file>"). */
export function planShards(pairs: Pair[], times: Record<string, number>, pieces: number): Piece[] {
  const unique = [...new Map(pairs.map((p) => [keyOf(p), p])).values()];
  const known = unique.map((p) => times[keyOf(p)]).filter((s): s is number => typeof s === "number");
  const fallback = median(known);
  const weighed = unique
    .map((pair) => ({ pair, key: keyOf(pair), seconds: times[keyOf(pair)] ?? fallback }))
    .sort((a, b) => b.seconds - a.seconds || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  const plan: Piece[] = Array.from({ length: pieces }, () => ({ pairs: [], seconds: 0 }));
  for (const { pair, seconds } of weighed) {
    // The first piece with the least time so far, so a tie goes to the lower piece.
    const least = plan.reduce((best, piece) => (piece.seconds < best.seconds ? piece : best));
    least.pairs.push(pair);
    least.seconds += seconds;
  }
  return plan;
}

/** Reads a times file; `null` unless it is an object of numbers that are not negative. */
export function readTimes(path: string): Record<string, number> | null {
  try {
    const times: unknown = JSON.parse(readFileSync(path, "utf8"));
    if (typeof times !== "object" || times === null || Array.isArray(times)) return null;
    for (const value of Object.values(times))
      if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
    return times as Record<string, number>;
  } catch {
    return null;
  }
}

/** "3/6" as { piece: 3, of: 6 }; `null` for anything else. */
export function parseShard(value: string | undefined): { piece: number; of: number } | null {
  const match = /^([1-9]\d*)\/([1-9]\d*)$/.exec(value ?? "");
  if (!match) return null;
  const piece = Number(match[1]);
  const of = Number(match[2]);
  return piece <= of ? { piece, of } : null;
}

/**
 * This piece's journey files for each device profile, from RUKEN_SHARD ("<n>/<pieces>") and RUKEN_SHARD_TIMES (the
 * times file); `null`, meaning "run as without the planner", when either is unset or cannot be read.
 */
export function planFromEnv(
  env: Record<string, string | undefined>,
  testDir: string,
  projects: string[],
): Record<string, string[]> | null {
  const shard = parseShard(env.RUKEN_SHARD);
  if (!shard || !env.RUKEN_SHARD_TIMES) return null;
  const times = readTimes(env.RUKEN_SHARD_TIMES);
  if (!times) return null;
  let files: string[];
  try {
    files = listJourneyFiles(testDir);
  } catch {
    return null;
  }
  const pairs = files.flatMap((file) => projects.map((project) => ({ file, project })));
  const mine = planShards(pairs, times, shard.of)[shard.piece - 1]?.pairs ?? [];
  return Object.fromEntries(
    projects.map((project) => [project, mine.filter((p) => p.project === project).map((p) => p.file)]),
  );
}

/**
 * What this piece runs: `files` (each device profile's journey files) when the planner can deal; `shard` (Playwright's
 * own split by count) when RUKEN_SHARD can be read but the times or the test folder cannot; nothing when RUKEN_SHARD
 * cannot be read, which leaves the config as it always was.
 */
export function pieceFromEnv(
  env: Record<string, string | undefined>,
  testDir: string,
  projects: string[],
): { files: Record<string, string[]> } | { shard: { current: number; total: number } } | null {
  const files = planFromEnv(env, testDir, projects);
  if (files) return { files };
  const shard = parseShard(env.RUKEN_SHARD);
  return shard ? { shard: { current: shard.piece, total: shard.of } } : null;
}

/** A test match that takes exactly these files under `testDir`, and no others. */
export function exactly(testDir: string, files: string[]): RegExp[] {
  const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return files.map((file) => new RegExp(`^${escape(join(testDir, file).split(sep).join(posix.sep))}$`));
}
