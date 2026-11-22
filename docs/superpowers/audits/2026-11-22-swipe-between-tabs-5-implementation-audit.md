# Swipe between tabs: implementation audit, round 5

Reviewed: pull request #347 at `88c2d277528e8c5ffabe4880d100e6a48f2ebb55`, the two commits after the main merge
`ca859e2` (`c067dcb`, `88c2d27`). Lane 2. Earlier rounds: `2026-11-22-swipe-between-tabs-{1..4}-implementation-audit.md`;
the PASS at `ca859e2` was posted on #347.

**Verdict: PASS, 0 red, 3 notes.**

## What changed

CI found Safari leaving Back from the play screen on the old page: `startViewTransition`'s callback never ran, so the
promise handed to `onNavigate` never settled and SvelteKit never put the new page in. Both layouts now hand that wait to
one helper, `slideWhile(navigation.complete)` in `src/lib/page-moves.ts:42`, which answers when the callback runs, when
the slide's `ready` is refused, or after 1 second, whichever is first.

## What was checked

- `slideWhile`: the three ways out all call the same `resolve`, so a later one is a no-op. If the browser refuses the
  slide (`ready` rejects), the move goes on at once; if it neither runs the callback nor refuses, the move goes on after
  1 s. If a late callback does run after the timeout, it only awaits `navigation.complete`, which has settled: no second
  page swap, and no hang. `onNavigate` in `src/routes/+layout.svelte:84` and `src/routes/make/+layout.svelte:56` now
  both return it; the guards before it (reduced motion, no `startViewTransition`, Safari's own swipe back, the same
  page) are unchanged.
- The two new journeys, `page-moves.test.ts:161` (game page to Play and Back) and `:178` (Your games to the first
  question), stand in a `startViewTransition` whose callback never runs and whose `ready` is refused. With both layouts
  put back to `ca859e2`'s inline promise, on a fresh local Postgres 16, Chromium, computer: both fail, at `:171`
  (the game's Play link never goes) and `:185` ("Question 1 of 6" never shows). With `88c2d27`: both pass. They fail by
  themselves.
- On `88c2d27`: `pnpm lint` 0, `pnpm typecheck` 0 errors, `pnpm test` 1,983 passed. Journeys `page-moves`,
  `make-questions`, `play`, computer and tablet, fresh database: 132 passed.
- CI on #347 at `88c2d27` (run 45067950750, the quick draft run), the only place WebKit runs: every
  check green, `gate (quick, draft)` success at 20:52:44 UTC, browser shards 1 to 6 success, `verify`, `postgres`,
  `commit-authors`, `pr-rules-run` success. A draft run lists the journeys the change reaches with
  `playwright test --list --only-changed=origin/main` and no `--project` filter (`ci.yml:397-404`), so the changed
  `page-moves.test.ts` ran on all three profiles, the phone (WebKit) included, and `gate` passes only when the pieces
  ran every listed journey. I did not download the reports to read the phone lines one by one.

## Notes (not blocking)

1. The 1 second fallback (a slide that neither starts nor is refused) has no journey; the new ones cover the refused
   case, which is what the journeys can stand in for. It is read from the code above.
2. When Safari skips a slide the page comes in with no slide. That is the fallback the owner's "almost never" allows;
   the slide itself in Safari can only be judged on a phone.
3. The quick draft run is not the full run; the full run starts when the pull request is marked ready.
