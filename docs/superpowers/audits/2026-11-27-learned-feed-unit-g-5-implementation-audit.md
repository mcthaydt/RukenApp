# Learned feed, unit G (#404): implementation audit 5

Commit examined: `3b33ae3` (3b33ae3fb6768a3f1fe15618e520e890388917d1), the merge of `main` at `89caede` (#403, the private
ordering Worker's binding and `/healthz/feed`; #408) into the marks branch at `6185f34`, which audit 4 passed.
Reviewer: a fresh session, Opus 5.5, medium. Written 2026-11-27 05:20 UTC.

Verdict: **PASS**. No red findings.

## What changed since audit 4

`git show --remerge-diff 3b33ae3` shows two hand-made changes beyond what the two parents bring:

1. `src/features/feed/service.ts`: the one conflict. The resolution keeps both sides whole: the marks' `NO_MARKS`
   constant from the branch, then #403's `FeedHealth` interface and `isHealth` guard. Nothing from either side is
   dropped or edited.
2. `docs/superpowers/progress.md`: one sentence added to the unit G line, audit 4's non-blocking follow-up (the
   first open's "Swipe up" tip covering the maker's name and Like at 320 wide).

## Checks

- Feed health and fallback still work: `git diff 6185f34 3b33ae3 -- src/features/feed/service.ts` is exactly #403's
  change (`within`, `askPrivate` built on it, `health()`, `return { page, health }`). The page builder, where marks are
  read (`deps.marksOf`, once per page, in `Promise.all` with the makers) and put on each clip (`marks.get(game.id) ??
  NO_MARKS`), is untouched by the merge and runs after either ranker answers, so marks ride on private and open pages
  alike. `src/features/feed/services.ts` wires both `marksOf` and `privateRanker` into the one `createFeedService`
  call. `src/routes/healthz/feed/+server.ts` reads `service.health()`.
- `pnpm lint`: exit 0. `pnpm typecheck`: 0 errors, 0 warnings.
- `pnpm test`: 159 files, 2,286 tests passed.
- `pnpm test:pg` (local Postgres 16): 54 files, 805 tests passed.
- Browser, in Playwright's own `mcr.microsoft.com/playwright:v1.63.0-noble` image (WebKit for phone), local Postgres,
  all three devices: `feed-marks`, `feed`, `healthz`, `feed-controls`, `feed-top`, `follow-a-maker`, `edit-page`:
  212 of 213 passed. The one failure was `feed-controls.test.ts:438` [phone] at line 447 (the fourth clip never became
  current), a known flake already listed under "Flaky tests" in `progress.md`; it then passed 5 of 5 alone
  (`--repeat-each=5`). `healthz.test.ts` passed its new `/healthz/feed` journey (`{ ranker: "open", health:
  "defaults" }`) on every device.
- CRUD: unchanged since audit 4; the merge adds nothing a person can make.

## CI at `3b33ae3` (run 45941115815)

verify, postgres, commit-authors and browser shards 2 to 6 passed. Shard 1 failed on one journey:
`real-buttons.test.ts:201` [phone] "a waiting game's screen: the way back and the foot are real buttons", a 30 s
timeout inside `layoutHasSettled` (`tests/browser/support/look.ts:154`, waiting for videos' metadata); 345 passed in
that shard. The merge touches no route but `/healthz/feed` and no screen. Locally the whole `real-buttons.test.ts` file
on [phone] in the WebKit image passed 120 of 120 (`--repeat-each=5`). So this is a flake, not a defect of this change;
`gate` is red until shard 1 is re-run. `pr-rules-run` was red waiting for this audit's verdict.

## Notes (not blocking)

- Record the `real-buttons.test.ts:201` [phone] failure under "Flaky tests" in `progress.md` (run 45941115815, shard 1,
  job 140315397026; passed 5 of 5 locally). First time this journey failed this way as far as `progress.md` shows.
- No unit test puts marks on a page the private ranker ordered; the code path is shared, so this is a gap in coverage,
  not a defect.
