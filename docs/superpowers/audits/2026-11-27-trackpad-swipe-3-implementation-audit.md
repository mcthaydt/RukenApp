# Trackpad swipe, implementation audit 3 (lane 2 re-review after merging main)

Pull request #429. Reviewed head: `ba941955cfee91788067fb2732c5406b501d2836` (merge of `de5eca6`, main with #428, into `804986a`).
Reviewer: fresh session, Opus 5.5, medium. Written 2026-11-27 17:11 UTC.
Previous: audit 2 passed `804986a` (PR comment 7223985392).

## Verdict: PASS, 0 red, 1 note

## What was checked

1. **The PR's own change is untouched.** Merge base of `804986a` and `de5eca6` is `872bb55`.
   `diff <(git diff 872bb55 804986a -- . ':!docs/superpowers/progress.md') <(git diff de5eca6 ba94195 -- . ':!docs/superpowers/progress.md')`
   prints nothing: the PR's change to `src/features/feed/FeedTop.svelte`, `src/features/feed/tabs.ts`,
   `tests/browser/trackpad-swipe.test.ts` and `tests/features/feed/tabs.test.ts` is byte for byte what audit 2 passed.
2. **What came in from main is only main.**
   `diff <(git diff 872bb55 de5eca6 -- . ':!docs/superpowers/progress.md') <(git diff 804986a ba94195 -- . ':!docs/superpowers/progress.md')`
   prints nothing. Main brought `tests/browser/bar-through-moves.test.ts` and `tests/browser/support/moves.ts` (#428), tests only.
3. **progress.md resolution.** `git diff de5eca6 ba94195 -- docs/superpowers/progress.md` adds exactly the PR's two lines
   (the 16:35 UTC owner quote and the trackpad stage row). `git diff 804986a ba94195` on the file is exactly main's three
   changes (#427 row now merged `872bb55`, the new #428 row, the `feed-leave-and-return` flaky entry). No conflict markers
   (`grep -cE '^(<<<<<<<|>>>>>>>|=======$)'` gives 0).
4. **No clash with the bar and ring check.** #428 changes only tests: the ring check now also looks at borders and
   `::before`/`::after`, adds a Galaxy walk, and lets held-slide pictures take 30 s. The trackpad listener in FeedTop acts
   only on `wheel` events, which the bar journey never sends (it uses clicks, keys and touch swipes), and it adds no
   outline, border or shadow. Run here at `ba94195` with a local Postgres 16, `--retries 0`:
   `bar-through-moves.test.ts` and `trackpad-swipe.test.ts` on `computer` and `tablet`: 5 passed, 1 skipped (the Galaxy
   walk runs only in the tablet's Chrome, by design). `tests/features/feed/tabs.test.ts`: 10 passed.
   The global WebKit warm-up was skipped by a scratch config (no WebKit in this container); the phone (WebKit) project
   was not run here.
5. **CI at `ba94195`** (quick draft run): `verify`, `postgres`, six browser shards, `gate (quick, draft)`, `commit-authors`,
   `pr-rules-run` all success. The quick run picked `trackpad-swipe.test.ts` (3 passed across shards, phone included);
   it did not run `bar-through-moves.test.ts`. The full run starts when the PR is marked ready; `gate` decides the merge.
6. The merge commit is authored by McThayDT; no live-state file under `docs/superpowers/live/` at this head.

## Notes (not blocking, not this PR's to fix)

- UNIT: `docs/superpowers/progress.md` (from main). VERDICT: note. REASON: main's #428 row still says
  "branch `claude/project-thread-pej2xk`" though #428 merged as `de5eca6`. FIX: the coordinator updates that row
  in its next progress edit.
