import type { ListedGame } from "../../../src/features/games/games.ts";
import type { FeedServiceDeps } from "../../../src/features/feed/service.ts";
import { seededNumber } from "../../../src/lib/random.ts";
import { TestClock } from "../../support/test-clock.ts";

// Seeded worlds of 0, 1, 2, 3 and 60 live games, the same on every run, for the test that the feed's order did not
// change when it moved behind the Ranker (tests/features/feed/feed-329-pages.json was written from the order before).

const DAY = 86_400_000;
const START = "2026-11-21T15:00:00Z";
const NOW = Date.parse(START);

function listed(index: number, world: string): ListedGame {
  const slug = `${world}-g${String(index)}`;
  // Some games are new, some old, some 18+, from a fixed seed.
  const daysAgo = Math.floor(seededNumber(world, `age-${String(index)}`) * 30);
  const adults = seededNumber(world, `rating-${String(index)}`) < 0.1;
  return {
    id: `id-${slug}`,
    publicId: `pub-${slug}`,
    slug,
    name: `Game ${slug}`,
    oneLine: `About ${slug}.`,
    freeToPlay: false,
    showsPlayerCount: false,
    makerUserId: `maker-${String(index % 7)}`,
    livePullId: "pull",
    connectHosts: [],
    ageRating: adults ? "age_18" : "age_12",
    contentMarks: [],
    clips: { upright: `clips/${slug}-up.mp4`, wide: `clips/${slug}-wide.mp4` },
    liveSince: new Date(NOW - daysAgo * DAY - index * 1000),
  };
}

export interface World {
  name: string;
  deps: FeedServiceDeps;
}

export function worlds(): World[] {
  return [0, 1, 2, 3, 60].map((count) => {
    const name = `w${String(count)}`;
    const games = Array.from({ length: count }, (_, index) => listed(index, name));
    const beats = new Map(
      games.map((game, index) => [
        game.id,
        Math.floor(seededNumber(name, `beats-${String(index)}`) * 5) * 10,
      ]),
    );
    return {
      name,
      deps: {
        clock: new TestClock(START),
        liveGames: () => Promise.resolve(games),
        memberBeatsByGame: () => Promise.resolve(beats),
        makersOf: (ids) =>
          Promise.resolve(
            new Map(
              ids
                .filter((id) => id !== "maker-3")
                .map((id) => [id, { handle: `h-${id}`, name: id, photoKey: null }]),
            ),
          ),
        media: (key) => `https://media.test/${key}`,
      },
    };
  });
}
