# Endless feed: implementation audit, round 2

Reviewed: branch `claude/project-thread-7fe1cy` at `50e6992` (PR #329), the fix for round 1 (`8382400`, on top of
audit 1 `dd9c378`, which named `05dd53d`). Lane 2, one fresh review. Brief: the owner, 2026-11-22 16:00 UTC, "the feed
should be infinite", plus the acceptance criteria in the PR body.

**Verdict: PASS, 0 red, 2 notes.**

## What was checked

- Scope: `git diff --stat dd9c378 50e6992` touches only `src/features/feed/Feed.svelte`, `src/features/feed/service.ts`,
  `tests/browser/feed-controls.test.ts`, `tests/features/feed/empty.test.ts`, `tests/features/feed/service.test.ts`
  and the builder's live-state file, which is gone again at `50e6992`. Merges cleanly with `main` at `2381058`.
- `pnpm lint`, `pnpm typecheck`: exit 0. `vitest run tests/features/feed`: 45 passed.
- CI at `50e6992` (quick draft run): verify, postgres, all six browser pieces and `gate (quick, draft)` green. "The
  feed never ends ..." (with the new let-go check) and "when more games do not come ..." passed on phone (WebKit),
  tablet and computer.

### R1 (a game twice in a row at a page edge): fixed

- The address is now `day~round~offset~swapped~last`. `last` must match `[a-z0-9-]{1,100}`, which covers every slug
  (`GAME_SLUG_SHAPE` in `src/features/games/ids.ts` is `^[a-z0-9]+(-[a-z0-9]+)*$`, 3 to 40 characters), so a real
  address is never refused.
- Rounds 1 and on are a shuffle of the day, the round and the games alone, so they no longer move with plays; the swap
  that keeps a round from starting with the game just seen is decided once, against the game in the address, and
  carried in it for the rest of the round. A page that ends exactly where a round starts decides it before answering.
  In round 0, a page that goes on past 50 skips the game just seen if plays have moved it to where the page goes on.
- The new unit test fails by itself: with `service.ts` from `dd9c378` it fails (`2 games: g1 g0 g0 g1 ...`); with
  `50e6992` it passes.
- A wider probe (not committed): 1, 2, 3, 4, 5, 7, 12, 30, 49, 50, 51, 77 and 120 games, 40 tries each, play counts
  redrawn at random before each of 12 later pages. No game twice in a row anywhere; every round after the first that the
  walk passed holds every game exactly once. The only repeats are inside round 0 with more than 50 games (N1).

### R2 (clips behind keep their video): fixed

- Only the clip before, the one on screen and the next have an address (`near`). A new effect takes the address off
  every other video and calls `load()`, which is what round 1 measured to release it; it skips a video already empty, so
  it does not call `load()` again on every update. Scrolling back gives a clip its address again through the template,
  which starts a fresh load.
- The play effect and #325's `stopIfOffScreen` are unchanged; the clip just left (one behind) keeps its video and is
  paused and rewound as before. `load()` with no address does not start a play.
- The journey line checks every clip more than one behind has no `src`, `readyState` 0 and `networkState` EMPTY. The
  builder says Chromium keeps `currentSrc` after a video lets go; that matches round 1's measurement (500 videos at
  `readyState` 0 after `load()`), so not checking `currentSrc` is right. On `05dd53d` passed clips kept `src`, so the
  line could not have passed there.

### N2 (spinner with no script): fixed

The spinner screen renders only once the script runs (`next !== null && ready`). The server-rendered test now checks
there is no spinner and the last clip is there. The client's first render matches the server's (no spinner), so
hydration is unchanged.

### N4 (PR body footer): fixed

The body at `50e6992` ends with "Requested by **McThayDT**".

## Notes (not fixed here)

- N1 stays, and the PR's "Known limits" now says it right: with more than 50 live games, round 0 spans two requests and
  can skip or repeat a game when plays move (never twice in a row). The client drops a repeated `key`.
- N3 stays for the coordinator: the tap-to-open branch (`claude/project-thread-74qnu2`) brings a person back by slug,
  and slugs repeat in this feed; whichever merges second restores by `key` and handles a place past the first page.
