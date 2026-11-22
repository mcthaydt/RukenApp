// The planner that fills CI's browser pieces by time (tests/browser/support/shard-plan.ts). It lives here, not beside
// the planner: Playwright would run a test file under tests/browser as a journey, and the unit project leaves that
// folder out (vite.config.ts).
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, test } from "vitest";
import {
  exactly,
  listJourneyFiles,
  parseShard,
  pieceFromEnv,
  planFromEnv,
  planShards,
  readTimes,
  type Pair,
} from "../tests/browser/support/shard-plan.ts";

const made: string[] = [];
afterAll(() => {
  for (const dir of made) rmSync(dir, { recursive: true, force: true });
});
const folder = () => {
  const dir = mkdtempSync(join(tmpdir(), "shard-plan-"));
  made.push(dir);
  return dir;
};

const PROJECTS = ["phone", "tablet", "computer"];
// A small seeded random, so every run deals the same made-up suite.
const random = (seed: number) => () => (seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31) / 2 ** 31;

function suite(files: number, seed: number) {
  const next = random(seed);
  const pairs: Pair[] = [];
  const times: Record<string, number> = {};
  for (let f = 0; f < files; f++)
    for (const project of PROJECTS) {
      const file = `journey-${String(f).padStart(2, "0")}.test.ts`;
      pairs.push({ file, project });
      times[`${project}|${file}`] = Math.round(next() * 600) / 10 + (next() < 0.1 ? 120 : 0);
    }
  return { pairs, times };
}

const shuffled = <T>(items: T[], seed: number): T[] => {
  const next = random(seed);
  return items
    .map((item) => ({ item, order: next() }))
    .sort((a, b) => a.order - b.order)
    .map(({ item }) => item);
};

const keys = (pairs: Pair[]) => pairs.map((p) => `${p.project}|${p.file}`);

describe("planShards", () => {
  test("every pair lands in exactly one piece", () => {
    const { pairs, times } = suite(53, 1);
    const plan = planShards(pairs, times, 6);
    const dealt = plan.flatMap((piece) => keys(piece.pairs));
    expect(dealt.sort()).toEqual(keys(pairs).sort());
    expect(new Set(dealt).size).toBe(pairs.length);
  });

  test("the same input in any order gives the same plan", () => {
    const { pairs, times } = suite(53, 2);
    const first = planShards(pairs, times, 6);
    for (const seed of [3, 4, 5]) {
      const timesShuffled = Object.fromEntries(shuffled(Object.entries(times), seed));
      expect(planShards(shuffled(pairs, seed), timesShuffled, 6)).toEqual(first);
    }
  });

  test("equal times still give one plan, ties going to the lower piece", () => {
    const pairs = PROJECTS.flatMap((project) =>
      ["a.test.ts", "b.test.ts"].map((file) => ({ file, project })),
    );
    const plan = planShards(shuffled(pairs, 9), {}, 6);
    expect(plan.map((piece) => keys(piece.pairs))).toEqual([
      ["computer|a.test.ts"],
      ["computer|b.test.ts"],
      ["phone|a.test.ts"],
      ["phone|b.test.ts"],
      ["tablet|a.test.ts"],
      ["tablet|b.test.ts"],
    ]);
  });

  test("a pair with no recorded time still runs, counted as the median", () => {
    const { pairs, times } = suite(10, 6);
    const newFile = { file: "brand-new.test.ts", project: "phone" };
    const plan = planShards([...pairs, newFile], times, 6);
    expect(plan.flatMap((piece) => keys(piece.pairs))).toContain("phone|brand-new.test.ts");
    const all = Object.values(times).sort((a, b) => a - b);
    const median = ((all[all.length / 2 - 1] ?? NaN) + (all[all.length / 2] ?? NaN)) / 2;
    const total = plan.reduce((sum, piece) => sum + piece.seconds, 0);
    expect(total).toBeCloseTo(all.reduce((a, b) => a + b, 0) + median, 6);
  });

  test("the slowest piece is within the largest single pair of the mean", () => {
    for (const seed of [10, 11, 12, 13, 14]) {
      const { pairs, times } = suite(53, seed);
      const plan = planShards(pairs, times, 6);
      const seconds = plan.map((piece) => piece.seconds);
      const mean = seconds.reduce((a, b) => a + b, 0) / seconds.length;
      expect(Math.max(...seconds) - mean).toBeLessThanOrEqual(Math.max(...Object.values(times)));
    }
  });
});

describe("planFromEnv", () => {
  function testDir() {
    const dir = folder();
    mkdirSync(join(dir, "support"));
    mkdirSync(join(dir, "nested"));
    for (const file of ["b.test.ts", "a.test.ts", "nested/c.spec.ts", "support/helper.ts", "notes.md"])
      writeFileSync(join(dir, file), "");
    const times = join(dir, "times.json");
    writeFileSync(times, JSON.stringify({ "phone|a.test.ts": 30, "computer|nested/c.spec.ts": 5 }));
    return { dir, times };
  }

  test("lists the journey files by Playwright's rule, sorted", () => {
    expect(listJourneyFiles(testDir().dir)).toEqual(["a.test.ts", "b.test.ts", "nested/c.spec.ts"]);
  });

  test("the pieces together hold every file for every device, once", () => {
    const { dir, times } = testDir();
    const seen: string[] = [];
    for (let n = 1; n <= 4; n++) {
      const plan = planFromEnv({ RUKEN_SHARD: `${String(n)}/4`, RUKEN_SHARD_TIMES: times }, dir, PROJECTS);
      expect(plan).not.toBeNull();
      for (const project of PROJECTS)
        seen.push(...(plan?.[project] ?? []).map((file) => `${project}|${file}`));
    }
    expect(seen.sort()).toEqual(
      PROJECTS.flatMap((project) =>
        ["a.test.ts", "b.test.ts", "nested/c.spec.ts"].map((file) => `${project}|${file}`),
      ).sort(),
    );
  });

  test("anything it cannot read means no plan, so the config runs as before", () => {
    const { dir, times } = testDir();
    const broken = join(dir, "broken.json");
    writeFileSync(broken, "{not json");
    const negative = join(dir, "negative.json");
    writeFileSync(negative, JSON.stringify({ "phone|a.test.ts": -1 }));
    const cases: Record<string, string | undefined>[] = [
      {},
      { RUKEN_SHARD: "1/6" },
      { RUKEN_SHARD_TIMES: times },
      { RUKEN_SHARD: "", RUKEN_SHARD_TIMES: "" },
      { RUKEN_SHARD: "7/6", RUKEN_SHARD_TIMES: times },
      { RUKEN_SHARD: "0/6", RUKEN_SHARD_TIMES: times },
      { RUKEN_SHARD: "one", RUKEN_SHARD_TIMES: times },
      { RUKEN_SHARD: "1/6", RUKEN_SHARD_TIMES: join(dir, "missing.json") },
      { RUKEN_SHARD: "1/6", RUKEN_SHARD_TIMES: broken },
      { RUKEN_SHARD: "1/6", RUKEN_SHARD_TIMES: negative },
    ];
    for (const env of cases) expect(planFromEnv(env, dir, PROJECTS)).toBeNull();
    expect(
      planFromEnv({ RUKEN_SHARD: "1/6", RUKEN_SHARD_TIMES: times }, join(dir, "gone"), PROJECTS),
    ).toBeNull();
  });

  test("reads a times file and a piece number", () => {
    expect(readTimes(testDir().times)).toEqual({ "phone|a.test.ts": 30, "computer|nested/c.spec.ts": 5 });
    expect(parseShard("3/6")).toEqual({ piece: 3, of: 6 });
  });

  // Audit R1 (docs/superpowers/audits/2026-11-22-faster-ci-t-1-implementation-audit.md): CI drops `--shard` once a
  // times file is there, so a times file that cannot be read must still split the journeys, never run them all six times.
  test("times that cannot be read fall back to Playwright's split, so six pieces still run everything once", () => {
    const { dir, times } = testDir();
    const bad = {
      "cut off": '{"phone|a.test.ts": 3',
      "a blank value": JSON.stringify({ "phone|a.test.ts": null }),
      "a list": "[1, 2]",
      empty: "",
    };
    for (const [name, text] of Object.entries(bad)) {
      const path = join(dir, `${name}.json`);
      writeFileSync(path, text);
      const pieces = [1, 2, 3, 4, 5, 6].map((n) =>
        pieceFromEnv({ RUKEN_SHARD: `${String(n)}/6`, RUKEN_SHARD_TIMES: path }, dir, PROJECTS),
      );
      expect(pieces, name).toEqual([1, 2, 3, 4, 5, 6].map((current) => ({ shard: { current, total: 6 } })));
    }
    const missing = { RUKEN_SHARD: "2/6", RUKEN_SHARD_TIMES: join(dir, "missing.json") };
    expect(pieceFromEnv(missing, dir, PROJECTS)).toEqual({ shard: { current: 2, total: 6 } });
    expect(pieceFromEnv({ RUKEN_SHARD: "2/6" }, dir, PROJECTS)).toEqual({ shard: { current: 2, total: 6 } });
    expect(
      pieceFromEnv({ RUKEN_SHARD: "2/6", RUKEN_SHARD_TIMES: times }, join(dir, "gone"), PROJECTS),
    ).toEqual({ shard: { current: 2, total: 6 } });
  });

  test("good times give files; no piece number leaves the config alone", () => {
    const { dir, times } = testDir();
    const piece = pieceFromEnv({ RUKEN_SHARD: "1/1", RUKEN_SHARD_TIMES: times }, dir, PROJECTS);
    const all = ["a.test.ts", "b.test.ts", "nested/c.spec.ts"];
    expect(piece).toEqual({ files: { phone: all, tablet: all, computer: all } });
    for (const env of [
      {},
      { RUKEN_SHARD: "", RUKEN_SHARD_TIMES: times },
      { RUKEN_SHARD: "7/6", RUKEN_SHARD_TIMES: times },
    ])
      expect(pieceFromEnv(env, dir, PROJECTS)).toBeNull();
  });
});

describe("exactly", () => {
  test("matches the named files and no other", () => {
    const match = exactly("/repo/tests/browser", ["a.b(1).test.ts"])[0] ?? /^$/;
    expect(match.test("/repo/tests/browser/a.b(1).test.ts")).toBe(true);
    expect(match.test("/repo/tests/browser/nested/a.b(1).test.ts")).toBe(false);
    expect(match.test("/repo/tests/browser/aXb(1).test.ts")).toBe(false);
  });
});
