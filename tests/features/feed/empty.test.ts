import { render } from "svelte/server";
import { expect, test } from "vitest";
import Feed from "../../../src/features/feed/Feed.svelte";

// D12: with no live game, the feed says so in plain words and has no clip. (A journey cannot empty the database the
// other journeys share, so the screen is pinned here.)
test("a feed with no games says 'No games here yet.' and holds no clip", () => {
  const { body } = render(Feed, { props: { clips: [] } });
  expect(body).toContain("No games here yet.");
  expect(body).not.toContain("<section");
  expect(body).not.toContain("<video");
});
