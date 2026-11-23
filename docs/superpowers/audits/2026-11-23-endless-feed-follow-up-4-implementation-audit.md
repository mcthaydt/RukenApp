# Endless feed follow-up: implementation audit, round 4 (re-point after the bottom-bar merge)

**Commit examined:** `7db4dd12fe84362f062f41729beb92a118127d90` (PR #363, branch `claude/project-thread-7fe1cy`)
**Prior audit:** round 3, `502a74a` PASS (`2026-11-23-endless-feed-follow-up-3-implementation-audit.md`)
**Lane:** 2. One fresh review after the build.
**Verdict:** PASS. No red findings.
**Written:** 2026-11-23 14:54 UTC

## What changed since 502a74a

`7db4dd1` merges `main` at `f421c37` (#364, bottom bar everywhere and the sideways phone layout). Its parents are `502a74a` and `f421c37`. `git diff f421c37 7db4dd1` is exactly #363's own change and nothing else: `src/features/feed/Feed.svelte` (15 lines) and `tests/browser/feed-controls.test.ts` (63 lines). So the merge kept every line #364 brought, and added no resolution edits of its own.

## The merge in Feed.svelte

- **#364 intact.** `git diff 502a74a 7db4dd1 -- src/features/feed/Feed.svelte` is only #364's CSS: `.side` as a flex column, `.share` on the glass tokens (`--glass-bg`, `--glass-filter`, both `backdrop-filter` prefixes), and the `@media (orientation: landscape) and (max-height: 449px)` block that moves the band, hints, sound and side buttons clear of the right-edge bar. #364 changed no script in `Feed.svelte`; the two touch different parts of the file.
- **Spinner up-arrow fix intact.** The watcher still builds its screens from `sections.slice(0, clips.length)` (`Feed.svelte:117`), so a slot left over after a restore that put back fewer clips cannot be picked as current.
- **Came-off-game fix intact.** `returnTo` puts back the kept clips only when the place's index in them is at or past `place.firstCount` (`Feed.svelte:256`); otherwise it keeps the fresh first page and, when the key is gone from it, `index <= 0` leaves the feed at the top. `firstCount` is captured in the snapshot (`Feed.svelte:271`).
- **No interaction.** The watcher's root is the feed itself, and the sideways styles only move positioned pieces inside a clip; neither changes which section is current or how the snapshot is kept.

## Checks run (this container, at 7db4dd1)

| Check | Result |
|---|---|
| `pnpm lint` | exit 0 |
| `pnpm typecheck` | 2178 files, 0 errors, 0 warnings |
| Feed unit tests (`tests/features/feed`) | 76 passed, 7 files |
| `feed.test.ts`, `feed-controls.test.ts`, `loading.test.ts`, `sideways-phone.test.ts`, computer + tablet | 89 passed, 15 skipped (the 15 are `sideways-phone.test.ts` on computer, which skips itself: "a computer has no sideways"; it ran on tablet), exit 0 |
| Watcher line put back to `[...sections, moreScreen]`, "kept feed is shorter ..." + "came off ...", computer + tablet, no retries | "kept feed is shorter" failed on both, each at `feed-controls.test.ts:422` (the up-arrow check); "came off" passed |
| `returnTo` condition put back to `!first.clips.some(...)`, same two journeys | all 4 failed: "came off" at `:457` (`toHaveCount`), "kept feed is shorter" at `:417` |
| Fix restored, `git status` | clean |

GitHub at `7db4dd1`: the quick draft run is green (`verify`, `postgres`, the six browser shards, `gate`, `commit-authors`, `pr-rules-run`).

Database: local Postgres 16 in the container, `TEST_DATABASE_URL` pointed at an empty `ruken_test`.

**Not run here:** the phone project (WebKit is not installed in this container). The full CI run, which includes it, starts when the pull request is marked ready.

## Findings

No red findings.

Notes (not blocking, not fixed here):

1. **`main` moved again.** `main` is now `c0d05cc` (#365), which changes only `tests/browser/support/database.ts` and `progress.md`, neither of which #363 touches. Branch protection does not require the branch to be up to date. If the merge order wants a fresh merge of `main` first, this verdict goes stale on that push and needs a re-point.
2. **Snapshots from before the deploy.** A snapshot kept by a tab opened before #363 ships has no `firstCount`; `index >= undefined` is false, so that one return keeps the fresh first page instead of the kept later pages. It lands on the top or on the same game if still on the first page; it never errors. One-time, harmless.
