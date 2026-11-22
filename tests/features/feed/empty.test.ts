import { render } from "svelte/server";
import { expect, test } from "vitest";
import Feed from "../../../src/features/feed/Feed.svelte";

// D12: with no live game, the feed says so in plain words and has no clip. (A journey cannot empty the database the
// other journeys share, so the screen is pinned here.)
test("a feed with no games says 'No games here yet.' and holds no clip", () => {
  const { body } = render(Feed, { props: { first: { clips: [], next: null }, launch: { before: false } } });
  expect(body).toContain("No games here yet.");
  expect(body).not.toContain("<section");
  expect(body).not.toContain("<video");
});

test("without script the feed ends at its last clip: no spinner that would turn for ever", () => {
  const clip = {
    key: "0~one",
    slug: "one",
    name: "One",
    oneLine: "A game.",
    upright: "https://media.test/up.mp4",
    wide: "https://media.test/wide.mp4",
    maker: null,
  };
  const { body } = render(Feed, {
    props: { first: { clips: [clip], next: "2026-11-22~1~0~0~one" }, launch: { before: false } },
  });
  expect(body).toContain('data-slug="one"');
  expect(body).not.toContain('class="more');
  expect(body).not.toContain("Loading more games");
});
