# Feed edge swipe, implementation audit 1

- Pull request: #426, head `ebd01b4fdb7595cb69c1f960901ebc70290a9383`, base `84a3f98`.
- Reviewer: fresh session, Opus 5.5, medium (lane 2 audit, the builder's model).
- Finished: 2026-11-27 14:38 UTC.
- Verdict: **PASS**, 0 red, 4 notes.

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## Brief

The owner, 2026-11-27 13:41 UTC: "The feed like does a double swipe on page transition out, we need more tests here, do e2e with screenshots for this flow", then "When I leave it and swipe". The criteria are the five in the pull request body.

## What the change does

`src/features/feed/tabs.ts` adds `BROWSER_EDGE = 40` and `onBrowserEdge(x, width)` (`x < 40 || x > width - 40`). `FeedTop.svelte`'s window `touchstart` handler does not record a start point when the finger starts there, so `touchend` takes no tab step. Nothing else in the touch path, the gamepad path or the page-move code changed. `src/routes/+layout.svelte` already skips Ruken's own slide when `popstate` carries `hasUAVisualTransition` (`browserSlid`), so with the fix an edge swipe is only the browser's move.

## Checks run (phone profile, WebKit 1.63 in the Playwright docker image)

| Run | Files | Result |
| --- | --- | --- |
| At `ebd01b4` | `feed-leave-and-return`, `feed-top`, `gamepad`, reviewer probe | 37 passed, 3 skipped (the Android Chrome alignment cases, which skip on the phone project by design), 0 failed |
| Fix reverted (`FeedTop.svelte` and `tabs.ts` from `84a3f98`), tests kept | `feed-leave-and-return`, reviewer probe | edge-swipe journey **fails** ("edge swipe Back to Fresh": a slide and a push it should not have); probe **fails** (a swipe 39px from the edge stepped to `/followed`); "each move slides once" passes |

Tablet and computer were not run by this review; the builder reports them green and CI runs them.

The reviewer probe (`/mnt/project-files/audits/2026-11-27-feed-edge-swipe-1-probe.test.ts.txt`, not committed) swipes from 39px and 41px off the right edge and from 39px and exactly 40px off the left. At `ebd01b4`: 39px takes no step on either side, 41px from the right steps to Followed, 40px from the left steps to Fresh. So a swipe from near, but not at, the edge still changes tabs.

## Against the coordinator's questions

- **Ordinary sideways swipes still switch tabs:** yes, `feed-top` "swiping sideways…" passes, and the probe shows the boundary is exactly 40px.
- **Up and down clip swipes:** not affected. The handler only reads touches (it never cancels them), and the clips scroll natively. `feed-top`'s "a swipe up and down never does" passes.
- **Gamepad LB/RB:** that code path is unchanged. `feed-top` "a gamepad's shoulder buttons…" and `gamepad` "the shoulder buttons go from Fresh to Followed and back" pass.
- **The new tests fail without the fix:** the edge-swipe journey does. The "each move slides once" journey passes with and without it, so it guards the leave-and-return flow and adds the frame strips the owner asked for, but it does not reproduce the bug (note 3).
- **Is the cause right:** plausible for Safari on an iPhone, and the fix is safe either way. It is not proven on the owner's phone (note 1).

## Findings

UNIT: the cause (the PR body, "What was wrong"). VERDICT: note. REQUIREMENT: the owner's report. REASON: the fix targets Safari's edge Back/Forward swipe, but the owner's latest phone photos came from an Android phone. EVIDENCE: the owner's uploads at 2026-11-27 05:55 and 06:28 UTC carry EXIF `software=Android … S931U1…` (a Samsung Galaxy S25). On Android, an edge Back gesture is usually taken by the system, which cancels the page's touch (`touchcancel`, which already cleared `start` before this change). If that is the case, the old code would not have stepped there, and the double slide the owner saw would have another cause. No test browser can drive either system's gesture, so neither reading is proven. EXPECTED: the owner confirms on their own phone after the deploy. FIX: none in this PR. If the owner still sees it, the next session reproduces it on a real Android Chrome (remote device or the owner's recording) before changing code.

UNIT: PR #426 body, "## Lane". VERDICT: note. REQUIREMENT: Risk in CLAUDE.md. REASON: the body says Lane 1, but the hook counts a `src/features/feed/` change as lane 2, which is why this review was required. EVIDENCE: PR body; the builder's own note that the hook refused "ready" without a review. EXPECTED: the body says Lane 2. FIX: edit the PR body's Lane line only.

UNIT: `tests/browser/feed-leave-and-return.test.ts`, "leaving the feed and coming back, each move slides once". VERDICT: note. REQUIREMENT: "A check is a test that fails by itself". REASON: it passes without the fix, so it is a guard, not proof of this fix. EVIDENCE: the reverted run above. EXPECTED: nothing more needed. The edge-swipe journey is the failing check. The PR body does not claim otherwise. FIX: none.

UNIT: `tests/features/feed/tabs.test.ts`. VERDICT: note. REQUIREMENT: the quality bar in `build` (pure functions get unit tests). REASON: `onBrowserEdge` has no unit test for its boundary (39, 40, width-40, width-39). The journey covers only x = 2 and the probe was not committed. EVIDENCE: `tabs.test.ts` is unchanged in the diff. EXPECTED: a four-line unit case. FIX: add it to `tests/features/feed/tabs.test.ts` only, optional.

## CRUD

The change adds nothing a person makes, so no CRUD journey is owed.
