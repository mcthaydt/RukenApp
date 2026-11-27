# Feed top bar (#402), review 4: the merge of main with #400

Commit examined: `40f875e` (40f875ee1069c5269f78d634532d72819b77512a), a merge of `5416e24` (review 3 PASS) with main at `5852e02` (#400, maker credit and follow). Lane 2. Reviewer: Opus 5.5, medium, fresh session, 2026-11-27 03:23 UTC.

**Verdict: PASS.** No red findings. One note on CI.

## What was checked

- **The four conflict fixes**, read with `git show --remerge-diff 40f875e`:
  - `src/features/feed/Feed.svelte`: the header comment keeps #400's maker-in-the-column wording and adds the top bar sentence; both imports (`FeedTop`, `FollowBadge`) are kept. Right.
  - `src/features/feed/services.ts`: both `search` (#402) and `viewerOf` (#400) are kept. Right.
  - `tests/browser/feed-controls.test.ts`: the Tab test keeps #402's first seven (Home, Add a game, You, Fresh, Followed, Search, Sound) and #400's maker-aware tail (maker, plus, Share, next Sound). The longest order is 13 stops (7 + game + Play + maker + plus + Share + Sound), so 14 presses covers it. The comment matches. Right.
  - `docs/superpowers/progress.md`: keeps main's two Share flake entries (the `:836` entry with its #400 sighting and the newer `:809` entry) and drops #402's own older `:809` line, whose sighting (#402 review at `691c7db`) is now not recorded. Minor; see the note.
  - The rest of `git diff 5852e02 40f875e` is #402's own files only (21 files), nothing of #400's lost.
- **Checks run on `40f875e`** (cloud container, Postgres 16): `pnpm lint` clean, `pnpm typecheck` 0 errors, `pnpm test` 2,260 of 2,260 passed. Browser: `feed-controls`, `feed-top`, `follow-a-maker` and `look-layout` on tablet and computer, 154 of 154 passed. The phone profile did not run: this container has no WebKit, so its global setup was left out through a scratch config that was then deleted.
- **Top bar against the maker credit**, measured with the probe saved beside this file (Chromium, touch, a maker with a page and a long name, the maker's clip on screen). No box of the top bar (tabs, Search) or the sound button meets any box of the credit (picture, name, plus) or Share:
  - 375 × 667 upright: tabs y 12–64, credit y 410–523. No overlap.
  - 667 × 375 sideways (installed): tabs y 12–64 and Search x 597–645 y 12–60; credit x 499–587 y 250–363; the bar on the right x 591–655 y 100–276. No overlap.
  - 320 × 568 upright: no overlap.
  Screens looked at by eye: both read cleanly, nothing covered.

## Note (not blocking)

- CI on `40f875e` is red: the quick run's shard 2 failed on `feed-controls.test.ts:809` [tablet] ("the sheet was not hidden" after closing, job 140289167859), and shards 3 and 6 were cancelled after it. That journey is already under Flaky tests twice; it passed locally on tablet and computer here, and this merge does not touch the share sheet. The PR needs a rerun to green before merging, and the implementer should add this sighting (and put back #402's own `691c7db` sighting) under Flaky tests in `progress.md`. This is the fourth sighting of the Share closing flake on the feed; its cause still needs looking for, as its own piece of work.
