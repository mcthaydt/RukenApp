# #447 implementation audit 5: instant slide done carefully

- Pull request: #447, head `8cc5a430afe3b217f98b2bdea244be78d3b542d3` (base `6192c84`).
- Reviewer: fresh session, Opus 5.5, medium. Lane 2.
- Run: 2026-11-28, Playwright 1.63 image (`mcr.microsoft.com/playwright:v1.63.0-noble`), phone (WebKit), tablet and computer (Chromium), fresh Postgres 16 database.

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## Verdict

PASS: 0 red.

## Review 4's R1: fixed

- The fix (`4a251f6`, `db9d394`): `YourTurn.svelte` posts `/your-turn/seen` from an `$effect` on `signedIn && news`, so it posts again when a quiet refresh turns `news` true. `kept.seenAt` records when the list was marked seen, and `newsShown()` in `kept.svelte.ts` hides the dot on any tab whose page was asked for before that. `quietRefresh()` now moves `landed.since` to the refresh's ask time.
- New journey `tabs-show-now.test.ts` "a game sent since Your turn's page was asked for is marked seen once it comes in, and its dot goes":
  - With the `src/` changes of `dbff9bf..db9d394` reversed (journey kept): **fails 3 of 3** (phone, tablet, computer), the send stays `seen: false`.
  - At `8cc5a43`: passes 3 of 3. Whole `tabs-show-now.test.ts`: 18 of 18.

## What ran at 8cc5a43

- Earlier reviews' probes, re-run: review 2 (`snappier-trackpad-swipe-2`: a send while on Followed, a like on Fresh), review 3 (`rework-3-probe-nudge`: follow and send after a swipe that only set off), review 4 (`rework-4-probe`: P1 failed refresh by abort and by 500, P2 clip stays during a slow refresh, P3 dot after a quiet refresh, P4 hover).
- Review 5 probes (`/mnt/project-files/audits/2026-11-28-trackpad-swipe-rework-5-probe.test.ts.txt`):
  - S: Save, and Repost, on Fresh after Followed was asked for ahead show pressed on Followed, and still pressed 2.5 s later, after the quiet refresh.
  - F: unfollow on Followed shows on Fresh, and Followed again says "You don't follow anyone yet."
  - D1: after the list was seen once, a new send lights the dot on Followed shown from a page asked for ahead (it comes with the quiet refresh). The fix does not hide new news.
  - D2: the same on Fresh, reached by a fresh load.
  - D3: an unseen send shows the dot on Fresh and on Followed (asked ahead), and stays `seen: false` while the list is never opened.
- With `follow-a-maker.test.ts` and `trackpad-swipe.test.ts`: 87 tests, **82 passed, 4 skipped, 1 failed**. The one failure is P4 on computer, review 4's N1: the hover preload, which fails the same way on main and is not from this PR.
- Overlap: `controls-overlap.test.ts` (320×568, 375×667, 667×375 sideways; before and after launch; with a friend's face) with `sent-to-you`, `feed-top` and `feed-marks`: **96 passed, 6 skipped, 0 failed**. No overlap. The PR changes no style.
- CI on `8cc5a43`: quick run 46126057777 green (verify, postgres, 6 browser shards, gate), commit-authors and pr-rules green.
- Not run here: the rest of the browser suite (the quick CI run covers its draft share), lint, typecheck and unit tests (CI `verify (quick, draft)` green).

## Notes (not blocking)

- N1, there before this PR (review 4's N1, P4): a hover preload on a computer keeps a Your turn page with no age limit, so a friend's send that comes after the hover is missing when the tab is pressed. Fails on main too.
- N2: `/your-turn/seen` marks every send seen, not only those on screen. A Your turn page asked for ahead under 1 s before it is shown gets no quiet refresh, so a send that lands in that second is marked seen without being drawn. It is still in the list on the next visit; only its dot is lost. The same race is on main, in a shorter window (load to post).
- N3: while a quiet refresh is loading, `newsShown()` hides the dot whenever the list was ever seen in this visit, then works it out again when the refresh is in. A tab with a real new send can blink its dot off for one round trip. Not seen in the probes.
- N4: the PR body's acceptance criteria and checks still name `dbff9bf` and do not list the new dot journey. Update before marking ready.
- Checked and fine: the feed merge keeps the clips up to the one on screen (P2 and the "without moving" journey); a failed refresh leaves the tab as it was (P1); own likes, saves, reposts and follows show on the other tabs at once (journeys and S, F).
