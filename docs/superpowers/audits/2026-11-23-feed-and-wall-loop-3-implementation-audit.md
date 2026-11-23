# #372 Feed and landing wall loop only past their start: lane 2 review, round 3

- Pull request: #372, branch `claude/project-thread-b5qgzu`.
- Verdict: **PASS** at head `80e40d98938dc5de9cdacfb1daef43e5d21eeeb0`.
- Examined: the change since round 2's head `5e19e6b` (`git diff 5e19e6b 80e40d9`, which includes a merge of `main` with #367). Apart from that merge, only `tests/browser/feed-controls.test.ts` and `docs/superpowers/progress.md` changed. `git diff 22648ff 80e40d9` is one line of `progress.md`. No `src/` file changed since round 1, so round 1's reading of the code stands. The PR's diff against `main` is 9 files: `Feed.svelte`, `on-screen-video.ts`, `quiet-video.ts`, the `about` and `join` pages, three test files and `progress.md`.
- Reviewer: fresh session, Opus 5.5, medium. Finished 2026-11-23 19:50 UTC.

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## Round 2's red, and what changed

Round 2 failed because the new feed phone journey failed about 1 run in 20 at 20 parallel. The cause was the page not answering Playwright. Since then:

- `watchClip` no longer holds one `evaluate` open for 5 s. It leaves a record on the element (`watched`) and polls it with `expect.poll` (up to 15 s). If that fails, it asks the page once more, waiting up to 40 s, and puts how long the page took to answer and what the clip had done into the error. A stuck clip (many jumps, stays at 0 s) and a frozen page ("no answer in 40 s") now look different in a failure.
- `isPlaying` first waits until the clip's time has moved past 0.05 s, for up to 15 s. A clip stuck at its `#t=0.001` start still fails here, so the journey still catches the original bug.
- The jumps limit (at most 5) now covers one round, up to the point where the clip comes back. Before, it covered 5 s. That is stricter or the same for a 2 s clip, and it still matches criterion 1.
- The test timeout went from 60 s to 120 s, which leaves room for the 15 s polls and the 40 s diagnostic.

## Evidence for the residual freeze, checked against its source

The controls come from the thread "Find the cause of the Safari feed freeze" (2026-11-23 19:43 UTC message: 100 probe runs per variant, 4 workers, WebKit in the Playwright 1.63 image, 4 cores). The table in the PR body and the `progress.md` entry match that message number for number: #372 had 1 freeze and 0 stuck, #367's way 3 and 5, plain loop with no `#t` 0 and 44, `main` 0 and 39. The PR body also includes `main`'s 0 freezes, so the trade is shown honestly. It is 1 freeze in 100 against a clip that is stuck at 0 s on its first view every time on `main`, and stuck after coming back in 39 of 100.

The claim "the freeze predates this change" holds for the mechanism. The freeze comes when `loop` is switched on mid-play, and #367's `quietVideo`, already on `main`, does exactly that. #367's own way froze 3 times in 100.

## What ran

| Check | Result |
|---|---|
| `git diff 22648ff 80e40d9` | One line of `progress.md` (the controls). Code unchanged since 22648ff. |
| CI at 80e40d9 (draft, quick) | gate, postgres, verify, pr-rules and the 6 browser shards were green. The new feed journey passed on phone (6.5 s), tablet (5.4 s) and computer (5.7 s). The wall journey passed on all three. |
| PR body | Starts with the attribution comment and the "Requested by" line, has `## Lane` and `## Acceptance criteria`, and its last line is `Requested by **McThayDT**`. |
| Residual flake record | It is in `progress.md` under Flaky tests as "Open, cause not found", with rates, the run conditions and the controls. |

Not run here: the 100-run stress test of the real journey. The investigation thread is running it (ETA about 20:10 UTC). The full ready-PR CI is also not run yet, because the PR is a draft.

## Judgement

The journey's residual rate is about 1 in 30 to 40 at 4 workers on a 4-core container, and 0 of 1 in CI here. That is acceptable for merge for three reasons. It is recorded with its conditions and a diagnostic failure message. The same journey on `main`'s code fails every time. And the controls show this branch has fewer freezes than #367's approach, which is already merged. No acceptance criterion is broken.

## Findings

No red.

- **Note 1 (evidence source).** UNIT: `progress.md` and the PR body. The controls are cited as "a separate session", and there is no file yet (nothing about them is in `/mnt/project-files/audits/`). The only source is a thread message. EXPECTED: when the investigation writes its audit, link it from the Flaky tests entry. That is a lane 1 doc change, and it is not needed for this merge.
- **Note 2 (wording).** UNIT: PR body, criterion 1 and "The rare freeze". "From before this change" is true of the mechanism, but `main`'s feed itself showed 0 freezes in 100. A future reader would be clearer with: "the freeze comes from switching `loop` on mid-play, as #367 does on `main`; `main`'s feed doesn't freeze but its clip never plays". The table already shows this, so it is not misleading.
- **Note 3 (evidence kind).** The controls come from a probe that repeats the journey's steps, not from the journey itself. 1 freeze against 3 in 100 runs is a weak difference. "#372 is not worse than #367's way" is supported. "Clearly better on freezes" is not. "Much better than `main`" refers to stuck clips (0 against 39), which is well supported.
- **Note 4 (test hygiene).** `watchClip` adds a `setInterval` and a `seeking` listener that are never removed, and the second call adds a second pair to the same element. That is harmless, because the old closures update the old record and the page closes at the end of the test.
