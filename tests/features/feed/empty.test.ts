import { render } from "svelte/server";
import { expect, test } from "vitest";
import Feed from "../../../src/features/feed/Feed.svelte";

// D12: with no live game, the feed says so in plain words and has no clip. (A journey cannot empty the database the
// other journeys share, so the screen is pinned here.)
test("a feed with no games says 'No games here yet.' and holds no clip", () => {
  const { body } = render(Feed, { props: { first: { clips: [], next: null } } });
  expect(body).toContain("No games here yet.");
  expect(body).not.toContain("<section");
  expect(body).not.toContain("<video");
});

test("a feed with a next page ends in a spinner that says what it waits for, not in a last clip", () => {
  const clip = {
    key: "0~one",
    slug: "one",
    name: "One",
    oneLine: "A game.",
    upright: "https://media.test/up.mp4",
    wide: "https://media.test/wide.mp4",
    maker: null,
  };
  const { body } = render(Feed, { props: { first: { clips: [clip], next: "2026-11-22~1~0" } } });
  expect(body).toMatch(/<section[^>]*class="more[^"]*"[^>]*aria-busy="true"/);
  expect(body).toContain('aria-label="Loading more games"');
  expect(body.lastIndexOf('data-slug="one"')).toBeLessThan(body.indexOf('class="more'));
});
