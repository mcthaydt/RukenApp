# #399 Back to the feed is the clip move reversed: implementation audit, round 4

Reviewed head: `e07b97f` (`e07b97f402da5e13ef67e2264dc5b9b3f5ac1a93`), which contains main `67ba234`. Lane 2. Reviewer: a fresh session, Opus 5.5, medium. Written 2026-11-27 00:10 UTC.

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## Verdict: PASS, no red findings

Round 3's red (the bar check at `tests/browser/feed-to-game-grow.test.ts` could not fail) is fixed. The coordinator's scope decision stands: the phone (WebKit) bar gap is pre-existing, out of scope and recorded under Known issues; the bar pixel check is fixme on phone. The split the implementer argues for holds on all three points the coordinator asked to verify.

## What ran

Local, in this container: Postgres 16, the app under `wrangler dev` as the config builds it, Chromium for tablet and computer, and WebKit for phone from the `mcr.microsoft.com/playwright:v1.63.0-noble` image through `run-server` (a local config with no `globalSetup` and `connectOptions` for phone; not committed). "Main's styles" means `src/lib/look.css` taken from `origin/main` with everything else at `e07b97f`.

| # | Run | Result |
| --- | --- | --- |
| 1 | Whole `feed-to-game-grow.test.ts`, tablet and computer, at `e07b97f` | 16 passed |
| 2 | Whole file, phone, at `e07b97f` | 7 passed, 1 skipped (the fixme) |
| 3 | (a) Bar check, phone, fixme removed, `--repeat-each=2` | **failed 2 of 2**: held bar 11.9 against thresholds 24.6 and 19.5 (settled 32.8 and 26.0) |
| 4 | (b) Journey "going back to the feed plays the move out backwards", main's styles, tablet and computer | **failed on both**: each move back drew the move out's pictures (`curve cubic-bezier(0.22, 1, 0.36, 1)`, `old(root) page-fades`, `old(clip) clip-hands-over`, bar `from 0ms`, `tabs under the clip`) where the mirrored ones were expected |
| 5 | Bar check, main's styles, tablet and computer (same run as 4) | passed: it cannot tell main from the branch in Chromium, as the PR body says |
| 6 | (c) My own probe: the bar check held at 0.1, 0.3, 0.5, 0.65, 0.8, 0.95 of Back, held/settled ratio | see below |

The probe is `2026-11-27-back-glide-reversed-4-probe.test.ts.txt` next to this file: the bar check copied with the hold point as a parameter and the ratio logged.

Ratio of the bar's strength in the held frame to the settled feed's (the check needs over 0.75):

| Hold | main's styles, tablet | main's styles, computer | branch, tablet | branch, computer | branch, phone (two runs) |
| --- | --- | --- | --- | --- | --- |
| 0.1 | 1.14 | 1.03 | 1.07 | 0.93 | 0.65, 0.65 |
| 0.3 | 0.99 | 0.99 | 1.08 | 0.93 | 0.56, 0.62 |
| 0.5 | 1.00 | 1.01 | 1.08 | 0.93 | 0.64, 0.64 |
| 0.65 | 1.01 | 1.01 | 1.09 | 1.06 | 0.60, 0.60 |
| 0.8 | 1.01 | 1.01 | 1.18 | 1.01 | 0.45, 0.46 |
| 0.95 | 1.02 | 1.01 | 1.06 | 1.00 | 0.07, 0.07 |

(c) confirmed: in Chromium, main's bar shows at its place as strongly as on the settled feed at every hold point of Back, so no frame of the bar's place can fail main there. What differs between main and the branch in Chromium is the order and timing of the bar's pictures and the clip's curve, which run 4 shows the journey does catch. The phone column shows the check, held at 0.8, sits well clear of its threshold in WebKit (0.45 against 0.75) and of Chromium's values (1.01 to 1.18), so it is not on a knife edge either way.

## Other checks

- CI at `e07b97f`: the quick draft run is green (verify, postgres, six browser pieces, gate, pr-rules). The full run starts when the pull request is marked ready.
- The diff since `dcbcba3` touches only `tests/browser/feed-to-game-grow.test.ts` and `docs/superpowers/progress.md`. The live-state file for round 3 is deleted at the head; none is left in the tree.
- CRUD: the change adds nothing a user can make.
- The test comment's claim ("In Chrome's engine the bar shows there at every moment of Back, on main as here") matches the probe.

## Notes (not blocking)

- N1. `progress.md` Known issues says WebKit's new picture of the bar "never draws". In the probe the phone's held bar is about 0.45 to 0.65 of the settled bar for most of Back, not zero, so something of the bar does draw (likely the old picture, or a weaker blend). The wording could say "is not drawn at full strength" when the WebKit issue is picked up. Follow-up, not for this pull request.
- N2. Not tried on a real iPhone (as the PR body says).
