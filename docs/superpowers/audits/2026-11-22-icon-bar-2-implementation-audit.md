# Icon bar: lane 2 review, cycle 2

Reviewed: PR #319 at ac156ff (branch claude/project-thread-nwu9v5). Re-review of cycle 1 (FAIL at aa0ed3d, audit 33260c4). Reviewer: fresh session, Opus 5.5, medium.

Verdict: **FAIL, 1 red (PR body only; no code change needed).**

## What was checked, and how

- Diff aa0ed3d..ac156ff: only `tests/browser/feed-controls.test.ts` (+5 -4) besides the cycle 1 audit file. No other file changed since cycle 1.
- R1 fix: the Tab-order journey now expects `names.slice(0, 4)` to be `["Home", "Add a game", "You", "Sound"]` and `play` after index 3; the 9 presses still reach Play, Share and the next Sound (it passes). Matches cycle 1's FIX.
- N1 taken: the sound-button cover check now lists Home, Add a game and You with `exact: true`.
- Other tests that could assume the two-link bar: the bar shows on `/`, `/g/[game]` and `/[handle]` (`src/routes/+layout.svelte:21-23`). Searched `tests/` for Home/You/Add a game names, `nav a`, link counts and every Tab walk. The Tab walks on the maker page (`maker-page.test.ts:238`, up to 10 presses, stops at "My Discord") and game page (`game-page.test.ts`, 14 presses, collects a set) tolerate one more stop; `make-walk.test.ts:84` picks You inside the bar by name; the "Add a game" matches in `make-questions`, `make-screen-review` and `make-second-look` are on `/make`, where the bar is not shown. None assumes two links.
- Ran here at ac156ff, Chromium, local Postgres 16:
  - `feed-controls`, `bar`, `maker-page`, `game-page`, `make-walk` on computer and tablet: 156 passed.
  - The whole browser suite on computer: 542 passed, 62 skipped, 3 failed (`money-job.test.ts:48`, `:54`, `purge-job.test.ts:39`: "No such invoice" and a 500). The database was reused from the run before, with the fake Stripe restarted; on a fresh database those two files pass, 9 of 9. Not caused by this change (it touches no job or money code). Phone profile not run (no WebKit here).
- CI at ac156ff: draft quick run all green (6 browser pieces, postgres, verify, gate, commit-authors, pr-rules-run).
- CRUD: the bar adds nothing a person makes. Not applicable.

## Findings

### R2 (red): the PR body does not name the changed `feed-controls` test

- UNIT: PR #319 body, "Changed tests"
- VERDICT: red
- REQUIREMENT: `review` skill: a PR that changes an existing test names each one and why in its body; cycle 1's R1 FIX asked for this line.
- REASON: ac156ff changes two tests in `tests/browser/feed-controls.test.ts`; "Changed tests" lists only `bar.test.ts`.
- EVIDENCE: PR body at 14:29 UTC (last edited 14:06 UTC) has no mention of `feed-controls`.
- EXPECTED: a line under "Changed tests" naming both `feed-controls.test.ts` tests and why (the bar now has three links, so the Tab order expects Home, Add a game, You, Sound, and the cover check includes Add a game with exact names).
- FIX: edit the PR body only; the head does not change, so this review can re-check the body at ac156ff and post PASS.

## Notes

- N2 from cycle 1 (proxy footer after "Requested by **McThayDT**") still stands; known proxy footer, recorded only.

## Re-check

The PR body names the `feed-controls` changes; head still ac156ff. Before merge, the full browser run on the ready PR passes in CI.
