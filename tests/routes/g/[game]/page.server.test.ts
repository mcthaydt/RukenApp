import { describe, expect, it, vi } from "vitest";

// A game's page answers only once every question about the game has come back, and the feed slides the page in only
// then (src/routes/+layout.svelte), so questions asked one after another were a pause after the tap before the slide.
// Here no question answers until all of them have been asked: a load that waits on one before asking the next never
// ends, and this test fails on its timeout.

const asked: string[] = [];
const EVERY_QUESTION = [
  "isMember",
  "cardOf",
  "moreLiveGamesBy",
  "screenFor",
  "sittingOf",
  "playersThisWeek",
  "friendsOf",
];
let allAsked: () => void = () => {};
let gate = new Promise<void>((open) => {
  allAsked = open;
});

/** A question that answers only once every question has been asked. */
function question<T>(name: string, answer: T): () => Promise<T> {
  return async () => {
    asked.push(name);
    if (EVERY_QUESTION.every((one) => asked.includes(one))) allAsked();
    await gate;
    return answer;
  };
}

const GAME = {
  id: "game_1",
  publicId: "pub_1",
  slug: "tiny",
  name: "Tiny",
  oneLine: "Climb.",
  freeToPlay: false,
  showsPlayerCount: true,
  makerUserId: "maker_1",
  livePullId: "pull_1",
  connectHosts: [],
  ageRating: "everyone",
  contentMarks: [],
  clips: { upright: "u.mp4", wide: "w.mp4" },
};

vi.mock("../../../../src/features/games/games.ts", async (original) => ({
  ...(await original<object>()),
  gamesServices: () => ({
    service: {
      liveGameBySlug: () => Promise.resolve(GAME),
      moreLiveGamesBy: question("moreLiveGamesBy", [
        { slug: "other", name: "Other", wideClip: "o.mp4", ageRating: "everyone" },
      ]),
    },
    media: (key: string) => `/media/${key}`,
  }),
}));
vi.mock("../../../../src/features/membership/membership.ts", async (original) => ({
  ...(await original<object>()),
  membershipServices: () => ({
    arrival: { remember: () => {} },
    service: { isMember: question("isMember", true) },
  }),
}));
vi.mock("../../../../src/features/pages/pages.ts", async (original) => ({
  ...(await original<object>()),
  pagesServices: () => ({
    service: {
      cardOf: question("cardOf", {
        handle: "night",
        name: "Night Owl",
        oneLine: "Hard games.",
        photoKey: null,
      }),
    },
  }),
}));
vi.mock("../../../../src/features/launch/launch.ts", async (original) => ({
  ...(await original<object>()),
  launchServices: () => ({ screenFor: question("screenFor", { before: false }) }),
}));
vi.mock("../../../../src/features/play/play.ts", async (original) => ({
  ...(await original<object>()),
  playServices: () => ({
    service: { sittingOf: question("sittingOf", null), playersThisWeek: question("playersThisWeek", 3) },
  }),
}));

vi.mock("../../../../src/features/sends/sends.ts", async (original) => ({
  ...(await original<object>()),
  sendsServices: () => ({ friendsOf: question("friendsOf", [{ handle: "pal", name: "Pal", photo: null }]) }),
}));

const { load } = await import("../../../../src/routes/g/[game]/+page.server.ts");

describe("a game's page", () => {
  it("asks every question about the game at once, and still answers the same", async () => {
    asked.length = 0;
    gate = new Promise<void>((open) => {
      allAsked = open;
    });
    const data = (await load({
      params: { game: "tiny" },
      locals: { caller: { kind: "user", userId: "player_1", staffRoles: [] } },
      cookies: { get: () => undefined, set: () => {} },
      url: new URL("http://localhost/g/tiny"),
      request: new Request("http://localhost/g/tiny"),
    } as never)) as Record<string, unknown>;
    expect([...asked].sort()).toEqual([...EVERY_QUESTION].sort());
    expect(data.cost).toBe("member");
    expect(data.maker).toEqual({ handle: "night", name: "Night Owl", oneLine: "Hard games.", photo: null });
    expect(data.more).toEqual([{ slug: "other", name: "Other", wideClip: "/media/o.mp4" }]);
    expect(data.launch).toEqual({ before: false });
    expect(data.friends).toEqual([{ handle: "pal", name: "Pal", photo: null }]);
  }, 2_000);
});
