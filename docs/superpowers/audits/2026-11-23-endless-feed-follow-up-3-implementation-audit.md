# Endless feed follow-up: implementation audit, round 3 (re-point after main merge)

**Commit examined:** `502a74a8bd6a3d75a1f1127d29872d12dd75c82f` (PR #363, branch `claude/project-thread-7fe1cy`)
**Prior audit:** round 2, `08b8d5d` PASS (`2026-11-23-endless-feed-follow-up-2-implementation-audit.md`, branch `claude/project-thread-sqj82c`, commit `be6c2e48`)
**Lane:** 2. One fresh review after the build.
**Verdict:** PASS. No red findings.
**Written:** 2026-11-23 14:29 UTC

## What changed since 08b8d5d

`502a74a` merges `main` at `e0a9fdc` (#361, private feed ranking seam). `git diff e0a9fdc 502a74a` is still exactly #363's own change: `src/features/feed/Feed.svelte` (15 lines) and `tests/browser/feed-controls.test.ts` (63 lines). The merge brought no conflict edits into either file; #361 did not touch `Feed.svelte`.

## Does #363 still hold with #361's paging

#361 moved ordering into rankers (`ranker.ts`, `public-ranker.ts`) and prefixes every address with `o.` (open) or `p.` (private) in `service.ts`. What #363 relies on, checked against the merged code:

- **Clip keys.** #363 finds the kept place by `clip.key`. Keys now come from the ranker; the open ranker still makes them `round~slug` (`public-ranker.ts:141`), as `service.ts` did before, and the ranker contract says a key is its own in the whole feed (`ranker.ts:48`). Appended pages still drop a key already held (`Feed.svelte:162`).
- **First page.** `+page.server.ts` still hands the screen `first` from `page(null, ...)`; #363's `firstCount` is `first.clips.length` at mount and travels in the snapshot, so it does not depend on how the page was ranked.
- **Later-page restore.** A kept `next` is an `o.` or `p.` address. `service.ts` accepts both: an address from a ranker not answering now starts that feed fresh, and anything else is a 400 as before. So a restored later page keeps scrolling; the spinner and "Try again" paths are unchanged.
- **Game came off.** A place on the first page whose key is not in the fresh first page starts from the top. If the ranker changed between leaving and coming back (private up or down), the fresh keys can differ and the feed also starts from the top. That is the same outcome as a game coming off, and #361's own design for an address from the other ranker; no fault.
- **Spinner up arrow.** The watcher change (`sections.slice(0, clips.length)`) depends only on the client's own clip list, not on cursors.

## Checks run (this container, at 502a74a)

| Check | Result |
|---|---|
| `pnpm lint` | exit 0 |
| `pnpm typecheck` | 0 errors, 0 warnings |
| Feed unit + private-boundary tests (`tests/features/feed`, `tests/feed-private-boundary.test.ts`) | 78 passed, 8 files |
| `feed-controls.test.ts` + `feed.test.ts`, computer + tablet | 60 passed |
| Watcher line put back to `[...sections, moreScreen]`, journey "kept feed is shorter ...", computer + tablet, `--repeat-each 2` | 4 failed, each at `feed-controls.test.ts:422` |
| `returnTo` condition put back to `!first.clips.some(...)`, journey "came off ...", computer + tablet, `--repeat-each 2` | 4 failed (`toHaveCount`) |
| Fix restored, `git status` | clean |

Database: local Postgres 16 in the container, `TEST_DATABASE_URL` pointed at an empty `ruken_test`. The private ranker is not bound in tests, so the journeys ran on the open ranker with `o.` addresses.

**Not run here:** the phone project (WebKit not installed in this container); CI runs it.

## Findings

No red findings. No notes.

## CRUD

The change adds nothing a user can make; no CRUD journey is due.
