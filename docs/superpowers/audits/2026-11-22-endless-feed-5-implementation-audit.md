# Endless feed: implementation audit, round 5

Reviewed: branch `claude/project-thread-7fe1cy` at `3c244b4` (PR #329), the range `5da37ae..3c244b4`: `31d7b92` (the
fix) and `3c244b4` (removes the live-state file; none is left). Lane 2. The full run at `5da37ae` found that coming
back to `/` put back the kept clips from the snapshot, so a game accepted in between was missing
(`tests/browser/cli-games.test.ts:71`).

**Verdict: PASS, 0 red, 1 note.**

## What was checked

- The diff touches only `src/features/feed/Feed.svelte` (+7 −3) and `tests/browser/feed-controls.test.ts` (+42 −2).
- `returnTo` now puts back the kept clips and `next` only when the kept place's key is not on the fresh first page.
  A place on the first page is found by key in the fresh first page (the feed remounts on new `data.first` through
  `{#key}`, so `first` is the page just loaded). A game that went live since shows, a renamed game shows its new name, and
  `next` is the fresh page's. A place past the first page still puts back every kept page, as round 3 checked.
- New journey "a reload on the first page shows the feed as it is now": it changes the kept name of the clip on
  screen, reloads, and checks that clip comes back with its current name and the old name is nowhere. On `5da37ae` the
  kept clips were put back unconditionally, so the old name would show there (by reading; not run against `5da37ae`).
- The shorter-kept-feed journey from round 4 moves its kept keys to round 7 (`0~` → `7~`), so it still exercises the
  kept-clips path it was written for, and still checks for page errors.
- CI at `3c244b4`, **full run**: verify, postgres, all 12 browser pieces and `gate` green. `cli-games.test.ts:71` (the
  journey that found the bug) passed on phone (WebKit), tablet and computer. The three Back and reload journeys passed
  on all three. No retries in the logs I read. `pr-rules-run` failed before any verdict named `3c244b4`, as expected.

## Note (not fixed here)

- N1, `Feed.svelte` `returnTo`: the comment says a game that "came off" since shows as it is now, but if the clip
  the person was on is the game that came off, its key is not on the fresh first page and the kept clips are put back,
  gone game included (tapping it would open a game page that no longer exists). This is narrow: it needs the very game on
  screen to come off while the person is away. A bounded fix: put back the kept clips only when the key is past round
  0 (it does not start with `0~`). Otherwise use the fresh first page from its top, with a journey that removes the
  clip on screen from the fresh page.
- Round 4's note (ArrowUp stuck on the spinner after a shorter restore) stays.
