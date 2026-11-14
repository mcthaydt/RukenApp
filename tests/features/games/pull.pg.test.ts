import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MAX_GAME_FILES } from "../../../src/features/games/files-check.ts";
import type { GitHub } from "../../../src/features/games/github.ts";
import { newPublicId } from "../../../src/features/games/ids.ts";
import { pullGame, type PullDeps } from "../../../src/features/games/pull.ts";
import { systemClock } from "../../../src/lib/clock.ts";
import type { PrismaClient } from "../../../src/lib/server/db.ts";
import { createUser } from "../../support/create-user.ts";
import { startTestDatabase, type TestDatabase } from "../../support/database.ts";
import { MemoryFileStore } from "../../support/memory-file-store.ts";
import { tarGz } from "../../support/tar.ts";

const SHA = "0123456789abcdef0123456789abcdef01234567";
/** GitHub puts a whole commit under one top folder named for the repository and the commit. */
const TOP = "acme-game-0123abc";

interface Entry {
  path: string;
  content: Uint8Array | string;
  link?: true;
}

const INDEX = '<html><script src="main.js"></script></html>';
const MAIN = "console.log(1);";
const DOT = new Uint8Array([1, 2, 3]);
const GOOD: Entry[] = [
  { path: "index.html", content: INDEX },
  { path: "main.js", content: MAIN },
  { path: "img/dot.png", content: DOT },
];
const GOOD_BYTES = INDEX.length + MAIN.length + DOT.length;

/** A stand-in GitHub that answers one commit and, for it, a tarball of `entries` under the top folder. */
function fakeGitHub(entries: readonly Entry[]) {
  const seen = { commits: 0, tarballs: [] as string[] };
  const github: GitHub = {
    commitOf: () => {
      seen.commits += 1;
      return Promise.resolve(SHA);
    },
    // Pulling never asks which installation holds a repository; the games service checks that before it pulls.
    installationOf: () => Promise.resolve(null),
    tarball: async (_repo, commitSha) => {
      seen.tarballs.push(commitSha);
      const tar = await tarGz(entries.map((entry) => ({ ...entry, path: `${TOP}/${entry.path}` })));
      return new Blob([tar]).stream();
    },
  };
  return { github, seen };
}

let database: TestDatabase | undefined;
let files: MemoryFileStore;

function db(): PrismaClient {
  if (database === undefined) throw new Error("the database did not start");
  return database.prisma;
}

beforeAll(async () => {
  database = await startTestDatabase();
});

afterAll(async () => {
  await database?.stop();
});

beforeEach(() => {
  files = new MemoryFileStore();
});

const depsFor = (github: GitHub): PullDeps => ({ db: db(), clock: systemClock, github, files });

let made = 0;

/** A draft game whose repository is `acme/game`; its own public id keeps its files apart from other tests'. */
async function newGame(options: { repoFolder?: string; connectHosts?: string[] } = {}) {
  made += 1;
  return db().game.create({
    data: {
      publicId: newPublicId(),
      slug: `pull-game-${String(made)}`,
      makerUserId: await createUser(db()),
      name: "A game",
      oneLine: "A game about a thing.",
      playsOn: "phone_and_computer",
      repoFullName: "acme/game",
      repoFolder: options.repoFolder ?? "",
      connectHosts: options.connectHosts ?? [],
    },
  });
}

const NO_INDEX =
  "We couldn't find an index.html at the top of that folder. Ruken starts a game from index.html.";

describe("pullGame", () => {
  it("stores the game's files under a new pull and records what it measured", async () => {
    const game = await newGame();
    const { github } = fakeGitHub(GOOD);

    const pull = await pullGame(depsFor(github), game.id);

    const folder = `files/${game.publicId}/${pull.id}`;
    expect(files.keys().sort()).toEqual([
      `${folder}/img/dot.png`,
      `${folder}/index.html`,
      `${folder}/main.js`,
    ]);
    expect(pull).toMatchObject({ commitSha: SHA, fileCount: 3, totalBytes: GOOD_BYTES });
    expect(await db().gamePull.findUniqueOrThrow({ where: { id: pull.id } })).toMatchObject({
      gameId: game.id,
      commitSha: SHA,
      fileCount: 3,
      totalBytes: BigInt(GOOD_BYTES),
    });
  });

  it("keeps the bytes of each file as they were", async () => {
    const game = await newGame();
    const pull = await pullGame(depsFor(fakeGitHub(GOOD).github), game.id);
    const stored = await files.get(`files/${game.publicId}/${pull.id}/img/dot.png`);
    expect(new Uint8Array(await new Response(stored?.body).arrayBuffer())).toEqual(DOT);
  });

  it("takes only the folder the maker picked", async () => {
    const game = await newGame({ repoFolder: "web/build" });
    const { github } = fakeGitHub([
      { path: "README.md", content: "read me" },
      { path: "web/build/index.html", content: INDEX },
      { path: "web/build/main.js", content: MAIN },
      { path: "web/builder/index.html", content: "a folder whose name only starts the same" },
      { path: "web/other/x.js", content: "elsewhere" },
    ]);

    const pull = await pullGame(depsFor(github), game.id);

    const folder = `files/${game.publicId}/${pull.id}`;
    expect(files.keys().sort()).toEqual([`${folder}/index.html`, `${folder}/main.js`]);
    expect(pull.fileCount).toBe(2);
  });

  it("keeps the game's server list with the pull, as it stood", async () => {
    const game = await newGame({ connectHosts: ["api.example.com"] });
    const pull = await pullGame(depsFor(fakeGitHub(GOOD).github), game.id);
    expect(await db().gamePull.findUniqueOrThrow({ where: { id: pull.id } })).toMatchObject({
      connectHosts: ["api.example.com"],
    });
  });

  // Review Focus 6
  it("stores nothing when the files are refused, and leaves the live game alone", async () => {
    const game = await newGame();
    const pullA = await pullGame(depsFor(fakeGitHub(GOOD).github), game.id);
    await db().game.update({ where: { id: game.id }, data: { state: "live", livePullId: pullA.id } });
    const keysOfPullA = files.keys();

    const refused = fakeGitHub([{ path: "main.js", content: MAIN }]);
    await expect(pullGame(depsFor(refused.github), game.id)).rejects.toMatchObject({
      name: "GameError",
      code: "FILES_REFUSED",
      message: NO_INDEX,
    });

    expect(files.keys()).toEqual(keysOfPullA);
    const after = await db().game.findUniqueOrThrow({ where: { id: game.id } });
    expect(after).toMatchObject({ state: "live", livePullId: pullA.id, pullProblem: NO_INDEX });
    expect(await db().gamePull.count({ where: { gameId: game.id } })).toBe(1);
    // The refusal was reached on the first read: the second, which stores, never ran.
    expect(refused.seen.tarballs).toEqual([SHA]);
  });

  it("forgets the last refusal once a pull passes", async () => {
    const game = await newGame();
    await expect(
      pullGame(depsFor(fakeGitHub([{ path: "main.js", content: MAIN }]).github), game.id),
    ).rejects.toMatchObject({ code: "FILES_REFUSED" });
    expect((await db().game.findUniqueOrThrow({ where: { id: game.id } })).pullProblem).toBe(NO_INDEX);

    await pullGame(depsFor(fakeGitHub(GOOD).github), game.id);

    expect((await db().game.findUniqueOrThrow({ where: { id: game.id } })).pullProblem).toBeNull();
  });

  // Review Focus 5
  it("refuses a pointer to Git LFS by name", async () => {
    const game = await newGame();
    const pointer = "version https://git-lfs.github.com/spec/v1\noid sha256:0123abcd\nsize 123456\n";
    const { github } = fakeGitHub([...GOOD, { path: "assets/big.bin", content: pointer }]);

    await expect(pullGame(depsFor(github), game.id)).rejects.toMatchObject({
      code: "FILES_REFUSED",
      message:
        "assets/big.bin is kept in Git LFS, and Ruken can't pull those yet. Add the real file to the repository.",
    });
    expect(files.keys()).toEqual([]);
  });

  it("refuses a link by name", async () => {
    const game = await newGame();
    const { github } = fakeGitHub([...GOOD, { path: "shortcut.js", content: "main.js", link: true }]);
    await expect(pullGame(depsFor(github), game.id)).rejects.toMatchObject({
      code: "FILES_REFUSED",
      message: expect.stringContaining("shortcut.js is a link to another file.") as unknown,
    });
  });

  it("refuses too many files for that, even when index.html comes last", async () => {
    const game = await newGame();
    const many: Entry[] = Array.from({ length: MAX_GAME_FILES + 1 }, (_, i) => ({
      path: `f${String(i).padStart(4, "0")}.txt`,
      content: "x",
    }));
    const { github } = fakeGitHub([...many, { path: "index.html", content: INDEX }]);

    await expect(pullGame(depsFor(github), game.id)).rejects.toMatchObject({
      code: "FILES_REFUSED",
      message: expect.stringContaining("1,501 files") as unknown,
    });
    expect(files.keys()).toEqual([]);
  });

  it("reads the commit it resolved, both times", async () => {
    const game = await newGame();
    const { github, seen } = fakeGitHub(GOOD);
    await pullGame(depsFor(github), game.id);
    expect(seen.commits).toBe(1);
    expect(seen.tarballs).toEqual([SHA, SHA]);
  });

  it("gives a second pull its own folder, and the first one's files stay", async () => {
    const game = await newGame();
    const first = await pullGame(depsFor(fakeGitHub(GOOD).github), game.id);
    const second = await pullGame(depsFor(fakeGitHub(GOOD).github), game.id);

    expect(second.id).not.toBe(first.id);
    const keys = files.keys();
    expect(keys).toHaveLength(6);
    expect(keys.filter((key) => key.startsWith(`files/${game.publicId}/${first.id}/`))).toHaveLength(3);
    expect(keys.filter((key) => key.startsWith(`files/${game.publicId}/${second.id}/`))).toHaveLength(3);
  });

  it("says so when the game is not there", async () => {
    await expect(pullGame(depsFor(fakeGitHub(GOOD).github), "no-such-game")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
