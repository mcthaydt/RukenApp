# Endless feed: implementation audit, round 1

Reviewed: branch `claude/project-thread-7fe1cy` at `05dd53d` (PR #329), against `main` at `c556cc0`. Lane 2, one fresh
review. Brief: the owner, 2026-11-22 16:00 UTC, "the feed should be infinite", plus the eight acceptance criteria in the
PR body (load the next batch near the end with a spinner; when there are no new games, reshuffle and loop).

**Verdict: FAIL, 2 red, 5 notes.**

## What was checked

- Scope: 10 files, all in the PR's list (`src/features/feed/{Feed.svelte,feed.ts,service.ts}`, `src/routes/+page.*`,
  new `src/routes/api/feed/+server.ts`, four test files). The live-state file is gone at `05dd53d`. Merges cleanly
  with `main` (`git merge-tree`).
- `pnpm lint`, `pnpm typecheck`: exit 0 here. `vitest run tests/features/feed`: 5 files, 44 passed.
- CI at `05dd53d` (run 45043362528, quick draft run): verify, postgres and all six browser pieces green. The two new
  journeys ("the feed never ends ...", "when more games do not come ...") passed on phone (WebKit), tablet and
  computer. The full run (ready for review) has not run.
- Paging (`service.page`): read through every branch. First page is round 0 alone (no game twice, at most 50); a later
  page walks rounds until it has 10 or more, never more than 50; a round of exactly 50 and a round over 50 both carry on
  correctly. With fixed play counts there are no repeats or skips within a round and no game twice in a row (the
  PR's unit tests cover 1, 2, many and over-50 games). But see R1: the order is recomputed on every request.
- Cursor tampering: the address must match `^\d{4}-\d{2}-\d{2}~\d{1,6}~\d{1,6}$`, else 400. The worst a made-up
  address does is pick another day's seed, round 999999 or an offset past the end (it rolls to the next round). Work per
  request is the same two queries `/` already runs. Nothing private is in a page. Fine.
- `/api/feed` auth and caching: public like `/` (no route-level gate exists for `/` either; 18+ games are filtered in
  the service for every page). `cache-control: no-store`. Fine.
- Screen: the observer watches clips added later, the spinner screen counts as the place after the last clip, a fast
  swipe to the spinner asks for more, and a person on the spinner is moved to the first new clip. The spinner uses the
  shared `.spinner`; failure shows plain words and a 48px "Try again" (no browser default UI). Keys go on past the
  first page.
- WebKit play/pause (#325, on `main`): `stopIfOffScreen` and the play effect are unchanged; on the spinner screen
  `current` is past every clip, so every clip pauses. Fine.
- Swipes in the panel (#323, branch `claude/project-thread-9hbbq0`): it changes only `overscroll-behavior` in
  `Feed.svelte`; merges with this branch with no conflict in `Feed.svelte`.
- Tap to open (branch `claude/project-thread-74qnu2`, not on `main`): merges without a text conflict, but see N3.
- Memory and page growth on a long session: measured, see R2.

## Findings

### R1: a game can show twice in a row where one page ends and the next begins

UNIT: `src/features/feed/service.ts`, `page()` and `roundOrder()`. VERDICT: red. REQUIREMENT: PR criterion 2,
"never one game twice in a row while two or more are live". REASON: round 0's order is "most played first" and is
recomputed on every request from live play counts, so the "game that ended the round before" that round 1 checks
against (`first.at(-1)`, and for one or two games the whole order) can differ from the game the person actually saw last.
EVIDENCE: a probe test (not committed) with the PR's own fakes: open the first page, then let members play the
round's last game so it is no longer last, then ask for `next`. For 2, 3, 4, 5, 6 and 8 games the joined sequence shows
one game twice in a row, e.g. 3 games `g0 g1 g2 g2 g0 g1 ...`, 2 games `g0 g1 g1 g0 ...`, 8 games
`... g6 g7 g7 g6 ...`. One member play on a quiet game is enough when few games are live (most have 0 plays and are
ordered by the day's seed). EXPECTED: the first clip of a page is never the game that ended the page before, whatever
happened to play counts in between. FIX: the address carries the last game shown (its slug or id, matched to the
same strict pattern), and the round that starts a later page avoids that game first (the same swap, against the carried
game instead of a recomputed one; for one or two games, start the round with the game that is not the carried one).
Add a unit test that changes play counts between `page(null)` and `page(next)` for 2 to 8 games and checks no two
neighbours are the same across the join. Files: `src/features/feed/service.ts`, `tests/features/feed/service.test.ts`.

### R2: every clip a person has passed keeps its video loaded, so a long session grows without end

UNIT: `src/features/feed/Feed.svelte`, `fetches()` / `preloads()`. VERDICT: red. REQUIREMENT: the owner's ask (a feed
that never ends) and the coordinator's brief for this audit (memory on long sessions). Before this PR the page held at
most 50 clips; now it has no ceiling. REASON: `fetches(index)` is `warm && index <= current + 1`, so every clip behind
the person keeps its address and its media player. EVIDENCE: measured in Chromium (Playwright, the repo's 22 KB
`tests/fixtures/clips/upright.mp4`, `preload="metadata"`): renderer + GPU + utility memory 297 MB with no videos,
366 MB with 50, 506 MB with 200, 772 MB with 500, about 1 MB per passed clip before real clips' larger buffers. Taking
the `src` attribute off alone frees nothing (733 MB, all 500 still `readyState >= 1`); calling `load()` after it
releases them (461 MB, 0 ready). The PR's "Known limits" names this and leaves it. EXPECTED: only the clips near the
person (the one before, the one on screen, the next) hold a video; the rest have no address and have let go of it.
FIX: `fetches` and `preloads` also need `index >= current - 1`, and when a clip loses its address the element is told
to let go (`removeAttribute("src")` then `load()`), keeping #325's pause-and-rewind behaviour for the clip just left.
Add to the "never ends" journey: after moving several clips on, no `video` more than one behind the current clip has a
`currentSrc` or `readyState > 0`. Files: `src/features/feed/Feed.svelte`, `tests/browser/feed-controls.test.ts`.

### Notes (not fixed here)

- N1, `service.ts`: with more than 50 live games, round 0 goes on over two requests and its order is recomputed from
  live play counts, so a game can be skipped or repeated within round 0 whenever plays move, not only when games go live
  or come off as "Known limits" says. Today far fewer than 50 games are live. The learned-feed work (which builds on this
  `page(after)` contract) should keep a round's order stable, or the PR's limit should say plays too.
- N2, `Feed.svelte`: without script the server renders the spinner screen past the last clip (`next !== null`), and it
  spins for ever because nothing will load. Showing it only once the script runs (`ready`) keeps "it reads without
  script" true.
- N3, cross-branch, for the coordinator: branch `claude/project-thread-74qnu2` (tap to open) brings a person back to
  their place by slug (`clips.findIndex((clip) => clip.slug === slug)`). With this PR a slug repeats, so it would land on
  the first copy, and `{#key data.first}` starts a returning person from the first page only. Whichever of the two merges
  second must restore by `key` and handle a place beyond the first page. Not a defect of #329 on its own.
- N4, PR body: the last line is "_Generated by [Claude Code](https://claude.ai/code)_" under a rule, after
  "Requested by **McThayDT**". CLAUDE.md wants the body to end with the Requested-by line.
- N5, `+page.svelte`: `{#key data.first}` remounts the feed (back to the top) whenever the `/` load runs again. Today that
  is only on navigating to `/`; a later `invalidateAll()` while on the feed would also reset it.

## Re-check for round 2

R1: the new unit test fails on `05dd53d` and passes on the fix. R2: the journey line fails on `05dd53d` (clips behind
still have `currentSrc`) and passes on the fix, on phone (WebKit) in CI as well as tablet and computer.
