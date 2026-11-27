# Panels slide away and Reposted: implementation audit 6 (merge-only re-review)

- PR: #425, head `e1f7359` (`e1f73599554ce78b61cc4bd4fa7f43efa17e6033`), lane 2.
- Reviewer: a fresh session, Opus 5.5, medium. Scope: only what changed since review 5 passed `22c627a`.
- Verdict: **PASS**, 0 red, 1 note (outside this change).

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## What changed since `22c627a`

`e1f7359` is a merge of `main` at `4ce8b51` (#429, trackpad swipe between the feed's tabs) into the branch. Its parents are `22c627a` and `4ce8b51`.

## Checks

| Check | How | Result |
| --- | --- | --- |
| The PR's own code is unchanged | `git diff 22c627a^2 22c627a` and `git diff e1f7359^2 e1f7359` (each merge against its `main` parent), `progress.md` left out, compared with `diff` | identical: the same 10 files (Feed, ShareSheet, TasteSheet, ReportSheet, `look.css`, `sheet.ts`, four journey files) |
| The merge brings only `main`'s changes | `git diff 22c627a e1f7359` against `git diff 22c627a^2 4ce8b51`, `progress.md` left out | identical: FeedTop.svelte, tabs.ts, trackpad-swipe.test.ts, tabs.test.ts |
| `progress.md` resolution | `diff` of `main`'s `4ce8b51` copy against the head's | the head is `main`'s file plus exactly this PR's three lines (the owner-ask line for the panels, and the money-job and late-frame flaky entries). Every `main` line is kept, including #429's owner-ask line, its Stages row and its your-feed flaky entry. No conflict markers anywhere in the tree (`git grep`) |
| Trackpad guard with sliding-away panels: no tab move mid-close | Read: `slideAway` keeps the dialog `open` until the slide ends (`sheet.close()` only in `finish`), and #429 checks `dialog[open]` both in the wheel listener and in `stepTab`. Probe journey (not committed): open the ••• panel, start its close by Cancel, Escape and a gamepad's B, and in the same task and again 80 ms later (dialog still `open` and `closing`) send a full 23-move trackpad swipe | computer and tablet: 3 of 3 each, tab stayed Fresh, URL unchanged |
| No stuck block after close | Same probe: once the panel is hidden, a new trackpad swipe | moved to Followed in all 6 runs. `finish` is bounded by the 2 s safety close (from the press and from the slide's start), so `open` cannot stay set |
| The probe can fail | Both `dialog[open]` checks removed from FeedTop.svelte, probe run again on computer (then restored, `git status` clean) | 3 of 3 failed (one ended on `/followed`, two could not reach the closing panel), so the probe sees the guard |
| #429's own journey on this head | `trackpad-swipe.test.ts`, computer and tablet, locally | passed (with the probe, 8 of 8) |
| Full CI on `e1f7359` | run 46046546608 (`pull_request`, full run, not draft), watched to the end | success: verify, postgres, browser shards 1 to 6, gate. commit-authors run 46046546539 success. pr-rules red only for the missing review naming `e1f7359` |

Not run: phone (WebKit) locally, as this container has no WebKit build for Playwright 1.63; the phone journeys ran in the CI run above.

## Note (outside this change, not fixed here)

- UNIT: `src/features/feed/FeedTop.svelte` wheel listener (from #429). VERDICT: note. REASON: while any dialog is open the listener returns before `preventDefault`, so a sideways trackpad swipe over an open panel reaches the browser, whose own Back and Forward it is on a computer. This PR lengthens the time a panel stays `open` by its 260 ms slide away. EVIDENCE: `if (event.ctrlKey || document.querySelector("dialog[open]") !== null) return;` comes before `event.preventDefault()`. Not seen on a real Mac (emulated wheel only). EXPECTED: a sideways swipe over an open panel does nothing. FIX (for its own thread): call `preventDefault` for sideways moves before the dialog check; only FeedTop.svelte and trackpad-swipe.test.ts.
