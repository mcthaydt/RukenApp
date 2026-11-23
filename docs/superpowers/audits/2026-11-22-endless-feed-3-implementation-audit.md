# Endless feed: implementation audit, round 3

Reviewed: branch `claude/project-thread-7fe1cy` at `1950658` (PR #329), the diff `80364ab..1950658`. `80364ab` is
`main` with #334 (tap to open, Back to the clip) merged in cleanly. Lane 2. This round closes audit 2's note N3: #334
brought a person back by the game's slug, and slugs repeat in a feed that goes round.

**Verdict: PASS, 0 red, 1 note.**

## What was checked

- Scope: `src/features/feed/Feed.svelte` (+28 −15) and `tests/browser/feed-controls.test.ts` (+26) only.
- The snapshot keeps `{ clips, next, key }` of the clip on screen. Restoring puts back every clip the feed had and the
  next page's address, waits a tick for the sections, finds the clip by `key` (unique in the whole feed), sets
  `current` and scrolls to it. The `mounted` / `returning` split from #334 is kept, so a restore that comes before the
  feed mounts is applied on mount. Clips keep their keys, so the keyed list reuses what it can.
- After a restore, the R2 rule holds: only the clips near the restored `current` get an address. The load-more effect
  works off the restored `next`, which keeps the day, round and last game, so the pages after it go on with no game
  twice in a row (round 2's checks still apply).
- Storage: SvelteKit keeps snapshots in memory and writes them to `sessionStorage` on page hide, with any write
  error caught (`node_modules/@sveltejs/kit/src/runtime/client/session-storage.js`). A very long session's clips cannot
  break the page, at worst a restore after a full reload is lost.
- The new journey fails by itself, by reading (not run here: no browser database in this container): on `80364ab`
  the feed comes back with the first page only and the slug lookup finds the first showing of the game, so the "index is
  `before`" line cannot hold. It passes at `1950658` in CI.
- `pnpm lint`, `pnpm typecheck`: exit 0. `vitest run tests/features/feed`: 45 passed.
- CI at `1950658` (quick draft run): verify, postgres, all six browser pieces and `gate (quick, draft)` green. "Back from
  a game opened past the first page ...", "Back from a game's page ..." and "the feed never ends ..." passed on phone
  (WebKit), tablet and computer.

## Note (not fixed here)

- N1: a person who leaves from the spinner screen (past the last clip) has no clip key, so nothing is kept and Back
  starts the feed from the top. Rare, since the spinner shows only while a page loads.
- Audit 2's N1 (round 0 with more than 50 games) stays, as the PR's Known limits say.
