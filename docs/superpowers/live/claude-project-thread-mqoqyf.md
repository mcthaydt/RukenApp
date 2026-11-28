# Live state: claude/project-thread-mqoqyf

- Current task: fix the owner's Galaxy double slide after Back then swipe. Cause found and fixed on this branch.
- Last commit: 773a029 (2026-11-28 07:04 UTC)
- Next step: wait for the coordinator to free a PR slot; then push, open draft PR (lane 2), delete this file, fresh lane 2 review, merge.
- Open decisions: none for the owner. Waiting on an optional screen recording from the owner.

## Findings so far (all in Chromium, Galaxy S9+ emulation, local app)
- Back from a game page plays exactly one view transition: arrow, browser Back, clip 0 and clip 3, after a game-page reload, at 6x CPU throttle; with hasUAVisualTransition spoofed true it plays none.
- After Back, a real touch swipe down (CDP Input.dispatchTouchEvent) moves one clip and stops; also with the viewport height changed mid-swipe (address bar lead) it moves one clip, monotonic.
- Why tests missed it: the phone project is WebKit (iPhone SE); no Chromium phone-size profile; Back journeys count only page slides; none swipes vertically after Back (the swipe helper sends synthetic touch events, which never scroll).
- Leads not yet ruled out: Chrome's toolbar / implicit root scroller after the game page scrolls in body; a new deploy turning the Back into a full page load (SvelteKit version change) since many deploys landed today; Chrome Android's own back animation reporting hasUAVisualTransition false.
- Probe script: /mnt/project-files/handoff/double-slide-back/probe.test.ts.txt (run with probe.config.ts, which drops the WebKit warm-up; needs TEST_DATABASE_URL).

## New evidence (2026-11-28 06:34 UTC)
- Slice 3 walk (main 43d9a3c, R3 in docs/superpowers/audits/2026-11-28-slice-3-e2e-walk.md on claude/project-thread-jqesp1, PR #449): Galaxy S9+ Chromium, CDP touch drag of 8 moves over 45% of the screen. Tap clip, page.goBack(), wait 900 ms, swipe down: 8 of 16 rounds did not move at all, and the next swipe moved one clip. With no Back first: 6 of 6 moved. My probe waited 2000 ms after Back, which is why it never saw it.
- Lead: a swipe made soon after Back is lost, likely while the Back slide or its clip hand-off still holds the page. On a real phone a lost swipe that snaps back, followed by one that moves, can look like a double. The failing check to write first: tap a clip, Back, wait ~900 ms, swipe down, expect exactly one clip back; 8 rounds.

## Fix (2026-11-28 07:04 UTC)
- Cause: during a view transition Chrome hit-tests touches to the transition pictures on html, so a swipe made while Back slides in never scrolls main.feed; the next swipe moves.
- Fix: src/lib/page-moves.ts slideWhile ends the slide (skipTransition) on touchstart/pointerdown.
- Journey tests/browser/back-then-swipe.test.ts (Chromium, Galaxy S24, CDP touch, phone piece only): 4 of 4 fail at round 1 without the fix, 4 of 4 pass with it. Tablet/computer page-move journeys: 61 passed. WebKit phone runs left to CI (no WebKit here).
