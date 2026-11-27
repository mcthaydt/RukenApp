# Followed feed (#410), merge review 3: cbc3a58 FAIL, 1 red

Examined: `cbc3a5863d28f7c72482be7f67f126b679df5e25` (the merge of `main` at `1825d1a` as `2d8063a`, plus a progress note). Review 2 passed `c011f86`. Lane 2. Written 2026-11-27 06:30 UTC.

## Red

**R1.** UNIT: `src/features/feed/service.ts:284`. VERDICT: red. REQUIREMENT: CI green (`gate`), `pnpm lint`. REASON: the merge's resolved line in `followedPage` is not Prettier-formatted, so lint fails. EVIDENCE: CI run 45950726959, job `verify (quick, draft)` 140345694540, failed at `pnpm lint`: "[warn] src/features/feed/service.ts … Code style issues found"; `gate (quick, draft)` failed. Same result locally (`pnpm lint` exit 1, only that file). In CI the unit tests and build did not run after it. EXPECTED: lint passes. FIX: `pnpm exec prettier --write src/features/feed/service.ts`. The fix only splits the two-`Map` tuple on line 284 over four lines. Touches only that file.

## What was checked, and passed

- **The merge kept both sides.** `git show --cc 2d8063a`: `FeedServiceDeps` keeps both `followedMakerIds` (#410) and `marksOf` (#404). `page()` keeps #405's new `ask` logic (`asking.kind === "full"`, `deps.asking`) and passes `marks` to `clipOf`. `followedPage` asks `makersOf` and `marksOf(viewerId, games)` together. `clipOf` carries `marks.get(game.id) ?? NO_MARKS`. `Feed.svelte` keeps both the `tab` and `tune` props. `Followed.svelte` passes no `tune`, so More/Less like this shows on Fresh only. `services.ts` wires `followedMakerIds` beside `marksOf`. Nothing else from `main` was dropped: the PR's diff against `main` is the same 12 files as before the merge.
- **The private feed's health and fallback.** `health()` and the `privateRanker`/open ranker path in `page()` match `main` except the `clipOf` refactor. `tests/features/feed/service.test.ts` passes, 26 of 26 with the probe. `/healthz/feed` is not touched.
- **Marks on Followed.** The unit probe (`2026-11-27-followed-feed-3-probe-service.test.ts.txt`) shows that `followedPage` asks `marksOf` once for the viewer with every game, carries each clip's marks, and gives `NO_MARKS` where marks are missing. It passed. The browser probe (`2026-11-27-followed-feed-3-probe-marks.test.ts.txt`) ran on the phone in WebKit and passed. It follows a maker, then on `/followed` sees Like, Save and Repost unpressed and no "More or less like this". It presses all three (each `/api/feed/marks` 200, likes 1), reloads and sees them pressed, sees them pressed on Fresh too, then takes each back on Followed and reloads to see them off. Marks use `fetch` with no `invalidate`, so the tab's `{#key data}` does not reset the clip.
- **Back from Followed returns to Followed.** `feed-top.test.ts:239` passed on the phone in WebKit. It opens the game from Followed, presses Back to the feed, lands on `/followed` with Followed marked, and the clip is current. `isFeed` in `page-moves.ts` and the layout's grow/back wiring are unchanged from `c011f86`.
- **Runs** (this container, Node 22 on the host for unit and typecheck; journeys in `mcr.microsoft.com/playwright:v1.63.0-noble`, Node 24, local Postgres 16):
  - `pnpm typecheck`: 0 errors, 2326 files.
  - `pnpm test`: 2298 of 2301 on the first run. 3 failed in `tests/pr-rules.test.ts` and `tests/rules-pr-routes.test.ts`, at 5 s timeouts while typecheck ran beside them. Both files then passed alone, 62 of 62. #410 does not touch either file. This was load from my own parallel run, not recorded as a flake.
  - `pnpm test:pg`: 816 of 816.
  - Phone (WebKit), 4 workers: `feed-top`, `feed-marks`, `follow-a-maker`, `feed-to-game-grow`, `page-moves`, `feed-controls`, `feed` and the probe gave 76 passed and 1 skipped (`feed-to-game-grow.test.ts:231`, which skips itself on phone). None failed.
  - CI quick draft run 45950726959: postgres and all 6 browser shards passed. `verify` failed (R1).

## Notes (not blocking, not fixed here)

- **N1, owner rule 2026-11-27 06:14 UTC (another thread owns it).** On `main` a maker still cannot like, save or repost their own game. `Feed.svelte:621` hides the marks when `marksOf(clip).own`, and `marks.ts:47` answers `"own"` and changes nothing. The maker credit on their own clip does show: only the follow plus is hidden (`Feed.svelte:608`, `{#if !maker.mine}`), as the rule wants. Followed never holds a person's own games, because nobody can follow themselves, so this PR is not affected.
- **N2.** No committed test covers marks on a Followed clip. The merge brought that behaviour in, and the probes above show it works. Adding a line for it to `feed-top.test.ts:239` and a `followedPage` marks case to `service.test.ts` would keep it from breaking later.
