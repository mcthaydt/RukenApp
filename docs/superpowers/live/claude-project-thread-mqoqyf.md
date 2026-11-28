# Live state: claude/project-thread-mqoqyf

- Current task: owner's Galaxy (Chrome) shows a double slide after Back from a game page to the feed, then swiping DOWN (previous clip); not on swipe up. Intermittent ("now it randomly works", 02:58 UTC). Owner uses the "back button" (unclear: phone Back or in-app arrow).
- Last commit: 2b777a8 (main, nothing of this branch's own yet)
- Next step: PAUSED by the coordinator (over session/PR limits) at 2026-11-28 02:59 UTC until #441, #442, #440 merge. Then build tests/browser journey: Chrome at Galaxy S24 size (test.use devices["Galaxy S24"], browserName chromium), feed clip 3 → game → Back (arrow, browser Back, spoofed hasUAVisualTransition) → real CDP touch swipe down and up; fail on more than one page slide, a swipe moving more than one clip, or any move after it settles. Draft PR, lane 1 (tests only) unless a fix lands.
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
