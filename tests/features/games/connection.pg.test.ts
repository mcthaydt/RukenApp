import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Connection } from "../../../src/features/games/github-connect.ts";
import type { GitHub } from "../../../src/features/games/github.ts";
import { createGamesService, type GamesService } from "../../../src/features/games/service.ts";
import { systemClock } from "../../../src/lib/clock.ts";
import type { PrismaClient } from "../../../src/lib/server/db.ts";
import { createUser } from "../../support/create-user.ts";
import { startTestDatabase, type TestDatabase } from "../../support/database.ts";
import { MemoryFileStore } from "../../support/memory-file-store.ts";
import { tarGz } from "../../support/tar.ts";

// What a maker's GitHub connection stores, and the rule that a maker can only use what GitHub listed for them.

const SHA = "0123456789abcdef0123456789abcdef01234567";

let database: TestDatabase | undefined;
let service: GamesService;
/** What GitHub's stand-in answers, and how often it was asked. */
const seen = { commits: 0, tarballs: 0, installationAsks: 0 };
/** The installation GitHub says holds each repository now. */
const holding = new Map<string, bigint>();

const github: GitHub = {
  commitOf: () => {
    seen.commits += 1;
    return Promise.resolve(SHA);
  },
  installationOf: (repo) => {
    seen.installationAsks += 1;
    return Promise.resolve(holding.get(repo) ?? null);
  },
  tarball: async () => {
    seen.tarballs += 1;
    return new Blob([await tarGz([{ path: "top/index.html", content: "<html></html>" }])]).stream();
  },
};

function db(): PrismaClient {
  if (database === undefined) throw new Error("the database did not start");
  return database.prisma;
}

beforeAll(async () => {
  database = await startTestDatabase();
  service = createGamesService({ db: db(), clock: systemClock, files: new MemoryFileStore(), github });
});

afterAll(async () => {
  await database?.stop();
});

beforeEach(() => {
  seen.commits = 0;
  seen.tarballs = 0;
  seen.installationAsks = 0;
  holding.clear();
});

const repo = (fullName: string, defaultBranch = "main") => ({ fullName, defaultBranch });
const installation = (
  installationId: bigint,
  accountLogin: string,
  repositories: Connection["repositories"],
) => ({
  installationId,
  accountLogin,
  repositories,
});

/** What is stored for a person: each installation with its repositories' names, in a fixed order. */
async function storedFor(userId: string) {
  const rows = await db().gitHubInstallation.findMany({
    where: { userId },
    orderBy: { installationId: "asc" },
    include: { repositories: { orderBy: { fullName: "asc" } } },
  });
  return rows.map((row) => ({
    installationId: row.installationId,
    accountLogin: row.accountLogin,
    repositories: row.repositories.map((one) => `${one.fullName}@${one.defaultBranch}`),
  }));
}

describe("rememberConnection", () => {
  it("stores the installations and repositories GitHub listed", async () => {
    const maker = await createUser(db());

    await service.rememberConnection(maker, [
      installation(11n, "alice", [repo("alice/b"), repo("alice/a", "dev")]),
      installation(12n, "a-team", [repo("a-team/shared")]),
    ]);

    expect(await storedFor(maker)).toEqual([
      { installationId: 11n, accountLogin: "alice", repositories: ["alice/a@dev", "alice/b@main"] },
      { installationId: 12n, accountLogin: "a-team", repositories: ["a-team/shared@main"] },
    ]);
  });

  it("forgets what GitHub stopped listing, and takes what changed", async () => {
    const maker = await createUser(db());
    await service.rememberConnection(maker, [
      installation(11n, "alice", [repo("alice/a"), repo("alice/b")]),
      installation(12n, "a-team", [repo("a-team/shared")]),
    ]);

    // Installation 12 is gone, `alice/b` is gone, `alice/a` has a new default branch, and 13 is new.
    await service.rememberConnection(maker, [
      installation(11n, "alice-renamed", [repo("alice/a", "trunk")]),
      installation(13n, "other", [repo("other/new")]),
    ]);

    expect(await storedFor(maker)).toEqual([
      { installationId: 11n, accountLogin: "alice-renamed", repositories: ["alice/a@trunk"] },
      { installationId: 13n, accountLogin: "other", repositories: ["other/new@main"] },
    ]);
  });

  it("forgets everything when GitHub lists nothing", async () => {
    const maker = await createUser(db());
    await service.rememberConnection(maker, [installation(11n, "alice", [repo("alice/a")])]);

    await service.rememberConnection(maker, []);

    expect(await storedFor(maker)).toEqual([]);
    expect(await db().gitHubRepository.count({ where: { fullName: "alice/a" } })).toBe(0);
  });

  it("changes only this person's rows", async () => {
    const maker = await createUser(db());
    const other = await createUser(db());
    // The same installation is open to both: a shared organisation.
    await service.rememberConnection(other, [installation(11n, "a-team", [repo("a-team/shared")])]);

    await service.rememberConnection(maker, [installation(11n, "a-team", [repo("a-team/mine")])]);
    await service.rememberConnection(maker, []);

    expect(await storedFor(other)).toEqual([
      { installationId: 11n, accountLogin: "a-team", repositories: ["a-team/shared@main"] },
    ]);
  });

  it("is all or nothing: a list that cannot be stored leaves what was there", async () => {
    const maker = await createUser(db());
    await service.rememberConnection(maker, [installation(11n, "alice", [repo("alice/a")])]);

    // The same repository twice under one installation breaks the table's own rule, part way through.
    await expect(
      service.rememberConnection(maker, [installation(11n, "alice", [repo("alice/x"), repo("alice/x")])]),
    ).rejects.toThrow();

    expect(await storedFor(maker)).toEqual([
      { installationId: 11n, accountLogin: "alice", repositories: ["alice/a@main"] },
    ]);
  });
});

describe("repositoriesFor", () => {
  it("lists the repositories of every installation, sorted by name", async () => {
    const maker = await createUser(db());
    await service.rememberConnection(maker, [
      installation(11n, "alice", [repo("alice/zed"), repo("alice/alpha", "dev")]),
      installation(12n, "a-team", [repo("a-team/shared")]),
    ]);

    expect(await service.repositoriesFor(maker)).toEqual([
      repo("a-team/shared"),
      repo("alice/alpha", "dev"),
      repo("alice/zed"),
    ]);
  });

  it("lists nothing for a person who has not connected, and asks GitHub nothing", async () => {
    expect(await service.repositoriesFor(await createUser(db()))).toEqual([]);
    expect(seen).toEqual({ commits: 0, tarballs: 0, installationAsks: 0 });
  });

  it("does not list another person's repositories", async () => {
    const maker = await createUser(db());
    const other = await createUser(db());
    await service.rememberConnection(other, [installation(21n, "bob", [repo("bob/secret")])]);

    expect(await service.repositoriesFor(maker)).toEqual([]);
  });
});

// Review Focus 23: an installation can read private repositories, some of which the maker cannot open (in an
// organisation). So a game is made or pulled only from a repository GitHub listed for that maker, and only while
// GitHub still says the same installation holds it.
describe("a maker can only use what GitHub listed for them", () => {
  const NOT_VISIBLE = "Ruken can't see that repository. Choose it on GitHub, then try again.";

  /** What a maker's form says, for one repository. */
  const formFor = (makerUserId: string, fullName: string) => ({
    makerUserId,
    name: "Tower Run",
    oneLine: "Climb fifty floors.",
    playsOn: "phone_and_computer" as const,
    repo: { fullName, branch: null, folder: "" },
    connectHosts: [],
  });

  /** A draft game on a repository, as if it had been made before the maker's list changed. */
  async function gameOn(makerUserId: string, fullName: string, publicId: string) {
    return db().game.create({
      data: {
        publicId,
        slug: `slug-${publicId}`,
        makerUserId,
        name: "A game",
        oneLine: "A game about a thing.",
        playsOn: "phone_and_computer",
        repoFullName: fullName,
      },
    });
  }

  it("makes a game from a listed repository that GitHub still places in the same installation", async () => {
    const maker = await createUser(db());
    await service.rememberConnection(maker, [installation(11n, "acme", [repo("acme/game")])]);
    holding.set("acme/game", 11n);

    const made = await service.createGame(formFor(maker, "acme/game"));

    expect(made.slug).toBe("tower-run");
  });

  it("pulls from it too", async () => {
    const maker = await createUser(db());
    await service.rememberConnection(maker, [installation(11n, "acme", [repo("acme/game")])]);
    holding.set("acme/game", 11n);
    const game = await gameOn(maker, "acme/game", "aaaaaaaaaa");

    const pull = await service.pullLatest(game.id);

    expect(pull.commitSha).toBe(SHA);
    expect(seen.tarballs).toBe(1);
  });

  it("refuses a repository GitHub did not list for the maker, even one in an installation they reach", async () => {
    const maker = await createUser(db());
    await service.rememberConnection(maker, [installation(11n, "acme", [repo("acme/game")])]);
    // GitHub's app can read `acme/private-other` through the maker's own installation, but never listed it for them.
    holding.set("acme/private-other", 11n);
    const before = await db().game.count();
    const game = await gameOn(maker, "acme/private-other", "bbbbbbbbbb");

    await expect(service.createGame(formFor(maker, "acme/private-other"))).rejects.toMatchObject({
      name: "GameError",
      code: "NOT_CONNECTED",
      message: NOT_VISIBLE,
    });
    await expect(service.pullLatest(game.id)).rejects.toMatchObject({
      code: "NOT_CONNECTED",
      message: NOT_VISIBLE,
    });

    expect(await db().game.count()).toBe(before + 1); // only the one made by hand above
    expect(seen.tarballs).toBe(0);
    expect(seen.commits).toBe(0);
  });

  it("refuses a repository that is listed only for someone else, under their installation", async () => {
    const maker = await createUser(db());
    const other = await createUser(db());
    await service.rememberConnection(maker, [installation(11n, "acme", [repo("acme/game")])]);
    await service.rememberConnection(other, [installation(21n, "bob", [repo("bob/secret")])]);
    holding.set("bob/secret", 21n);
    const game = await gameOn(maker, "bob/secret", "cccccccccc");

    await expect(service.createGame(formFor(maker, "bob/secret"))).rejects.toMatchObject({
      code: "NOT_CONNECTED",
      message: NOT_VISIBLE,
    });
    await expect(service.pullLatest(game.id)).rejects.toMatchObject({ code: "NOT_CONNECTED" });
    expect(seen.tarballs).toBe(0);
  });

  it("refuses a listed repository that GitHub now places in a different installation", async () => {
    const maker = await createUser(db());
    await service.rememberConnection(maker, [
      installation(11n, "acme", [repo("acme/game")]),
      installation(12n, "other", [repo("other/thing")]),
    ]);
    // The repository moved to the maker's other installation, which does not list it.
    holding.set("acme/game", 12n);
    const game = await gameOn(maker, "acme/game", "dddddddddd");

    await expect(service.createGame(formFor(maker, "acme/game"))).rejects.toMatchObject({
      code: "NOT_CONNECTED",
    });
    await expect(service.pullLatest(game.id)).rejects.toMatchObject({ code: "NOT_CONNECTED" });
    expect(seen.tarballs).toBe(0);
  });

  it("refuses a listed repository the app is no longer installed on", async () => {
    const maker = await createUser(db());
    await service.rememberConnection(maker, [installation(11n, "acme", [repo("acme/game")])]);
    // GitHub answers null: the app was uninstalled since the list was stored.
    const game = await gameOn(maker, "acme/game", "eeeeeeeeee");

    await expect(service.createGame(formFor(maker, "acme/game"))).rejects.toMatchObject({
      code: "NOT_CONNECTED",
    });
    await expect(service.pullLatest(game.id)).rejects.toMatchObject({ code: "NOT_CONNECTED" });
    expect(seen.tarballs).toBe(0);
  });

  it("says a game is not there when it is not, as before", async () => {
    await expect(service.pullLatest("no-such-game")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
