# Gamepad navigation (#409): lane 2 implementation audit, cycle 3

Examined commit: `b2036f4afd646f4694ad124e4c73d079813ebdea` (branch `claude/project-thread-0ay036`). Reviewer: a fresh session, Opus 5.5, medium effort. Written 2026-11-27 09:48 UTC.

**Verdict: FAIL, 3 red.** Review 2's three reds are fixed. The PR's own new journeys fail under load on the phone, and two screens still have pad moves that skip or jump: Save on Your colours on a tablet, and Up into hidden Search results.

## What ran

- `pnpm lint` (0 problems in the PR's files), `pnpm typecheck` (0 errors), `pnpm test` (163 files, 2,332 tests passed), on b2036f4.
- **The full browser suite** on phone (WebKit, through `mcr.microsoft.com/playwright:v1.63.0-noble` in Docker), tablet and computer, 3 workers, 4-core container: 2,397 passed, 170 skipped, 4 failed, all on the phone (1.0 h). Judged below.
- The 4 failures alone: all 4 passed. The two gamepad journeys again with 4 workers, 6 times each: 4 of 12 failed.
- A reviewer's probe (`2026-11-27-gamepad-navigation-3-probe.test.ts.txt`, not in the PR) on phone, tablet, computer and an Android profile (Playwright's `Pixel 7`, Chrome's engine with touch): `padReachesEverything` on 45 more screens, the long Search walked down and up, the Search list scrolled to its end and to its middle, the feed after a swipe, and a tap on each bar button on Android.
- A second probe (`...-probe-debug.test.ts.txt`) that logs each move, with a stand-in pad (`...-probe-pad.ts.txt`) that lets go as soon as the page has read the press once.
- `main` has moved to `97e98cf` (#412) since the PR's last merge of main (#410). The PR merges with it cleanly; #412 was not walked with the pad.
- Not run: a real controller or a real Android phone (none here).

## Review 2's findings

- **R1 (bar journeys read an outline): fixed.** `bar.test.ts:123`, `feed-controls.test.ts:1030`, `game-page.test.ts:174` and `maker-page.test.ts` read the shadow and pass on all three profiles in the full run. All four are named in the body's "Tests changed".
- **R2 (the white ring on Your games): fixed.** Android profile, a tap on Add a game from `/me`, Home from `/make` and You from `/`: after each, the place you are on has `background: rgba(255, 255, 255, 0.22)` and only the glass edge, the same on all three, no 3px ring, no outline, 60px tall. The held picture shows no ring either. The Add button is the grey tile, not blue, on Your games, as the owner asked.
- **R3 (Up on a long Search jumps to the box): fixed.** With 20 results that scroll, on phone, tablet and computer: down from the box reaches every result in turn and up goes back one at a time to the box (probe, every run); `padReachesEverything` passes with the list scrolled to its end first; the PR's own journey passes.

## Red findings

### R1. The new gamepad journeys fail on the phone when the machine is busy

UNIT: `tests/browser/support/pad.ts` (`pressPad`), seen in `tests/browser/gamepad.test.ts:49` and `:81`.
VERDICT: red.
REQUIREMENT: criterion 13 (the journeys pass on phone, tablet and computer in CI); CLAUDE.md Verification: a test that fails once and passes on retry is a defect.
REASON: a "quick press" holds the button for two frames, not a set time. When frames are slow, two frames take over 450 ms, so the layer rightly counts a held direction and moves twice, skipping a control.
EVIDENCE: full run: `:49` failed (`a.gamelink` never focused after Left) and `:81` failed (`Received: [..., "Like", "Save", "Share", ...]`, Repost skipped). Both pass alone. With 4 workers, 6 runs each: 4 of 12 failed. The debug probe timed each press: holds of 515 to 656 ms came with a skipped control (Repost, Home, Like) every time; holds under 450 ms never skipped. Same journeys with the reviewer's stand-in, which lets go once the page has read the press: 22 of 23 passed at 4 workers (one failure, cause not captured).
EXPECTED: a stand-in press counts once however slow the frames, and both journeys pass under load.
FIX: in `pressPad`, let go as soon as the page has read the pad with the button held (count `getGamepads()` calls in the stand-in, as `...-probe-pad.ts.txt` does), and keep the timed hold only for a long press (`ms > 0`). Files: `tests/browser/support/pad.ts`.

### R2. On a tablet, Save on Your colours is skipped: Right from Back goes up into the colours

UNIT: `src/lib/pad-focus.ts` (`move`), seen on `/make/page/colours` (`src/routes/make/page/[room]/+page.svelte`).
VERDICT: red.
REQUIREMENT: the owner's rule, everything fully navigable with a gamepad; the PR's "Left and right keep to the row"; `padReachesEverything` as the reach check.
REASON: the screen's Back and Save sit side by side in the pinned foot under 136 colour tiles. Right from Back lands on the tile just above Back, not on Save next to it, unless the page is scrolled to its very end.
EVIDENCE: `padReachesEverything` on `/make/page/colours`, tablet: misses `"Save"`, 2 of 2 runs (once with each stand-in). Debug probe, tablet, Back focused (20,1000, 48x60): with the page scrolled to 0, 800 and 1600, Right goes to Colours 124, 210 and 273 (each the tile at 20,875, above Back); scrolled to the end (2624) Right goes to Save. Left from the first tile of any row goes to Back. Phone and computer reach Save.
EXPECTED: Right from Back goes to Save on every profile and at any scroll, and the reach check passes on `/make/page/colours`.
FIX: in `move`, when the focus is in a pinned part (the foot), Left and Right go along that part's own controls first. Add `/make/page/colours` (signed in, with a page) to the reach journeys. Files: `src/lib/pad-focus.ts`, `tests/browser/gamepad.test.ts`.

### R3. Up from the top of Search goes to a result hidden above the list

UNIT: `src/lib/pad-focus.ts` (`onScreen`), seen on `/search` with results (`src/features/feed/Search.svelte`).
VERDICT: red.
REQUIREMENT: the PR's "What counts as on screen: a control scrolled out of its view ... is not a target"; review 2's R3 fix ("is on screen only inside that box's view"); the drunk-grandma test.
REASON: `onScreen` works out the visible part of each scrolled box, then, for a control inside a fixed screen, ignores it and checks only the window. A result scrolled up out of the list, but still inside the window behind the search box, counts as on screen.
EVIDENCE: 20 results, the list scrolled to its middle by hand, a first press lands on Back, then Up: focus goes to result 6 (phone, computer) or result 4 (tablet), hidden above the list's top, and the list jumps to it. Every run on all three profiles (2 runs each).
EXPECTED: Up from Back finds nothing that way (or the search box), and no hidden result is a target from outside the list.
FIX: in `onScreen`, for a pinned control use the box clip already worked out (stop at the fixed ancestor, as the loop does) instead of only the window. Add this case to the Search journey. Files: `src/lib/pad-focus.ts`, `tests/browser/gamepad.test.ts`.

## Notes (not blocking)

- N1. The feed and `/followed` with clips fail `padReachesEverything` (Tab reaches every clip's controls, and Up or Down changes the clip). The PR covers the feed with journeys 2 and 3 instead, and `/followed` only signed out (no clips). With a follow on phone, tablet and computer, Right and Left from Play walk every control: the maker, follow, Like, Save, Repost, Share, the bar, Fresh, Followed, Search, the name and Sound.
- N2. B on a game's page opened from Search went to the feed, not Search, in 2 of 11 runs (tablet once, phone once); 9 more runs with a 2.5 s wait all went back to Search. Cause not found.
- N3. The bar's ring is a box shadow with `outline: none`. In Windows' high-contrast mode (`forced-colors`) shadows are not drawn, so a keyboard or pad focus on the bar would show nothing there. `outline: 3px solid transparent` beside the shadow would keep a ring in that mode.
- N4. The two other phone failures in the full run, `make-live-changes.test.ts:116` (wanted "Players can find it on Ruken.") and `make-second-look.test.ts:492` (the name field not there in 5 s), passed alone. The PR does not touch those screens and its layer does nothing with no pad. For the "Flaky tests" list.
- N5. Review 2's N3 stands: a box for words on a computer with only a pad has no on-screen keyboard.

## Checked and fine

The reach check on: `/terms`, `/legal/maker-agreement`, the four `/help/*` guides, `/join`, `/goodbye`, a maker's page, Search with a short list and with nothing found, signed in `/me/saved` and `/me/reposts` (with a saved and reposted game), `/followed`, `/settings/feed`, `/search`, `/me/password`, `/me/computers`, `/me/delete`, `/me/link`, `/make/page`, `/make/page/address`, `/name`, `/line`, `/photo`, `/colours` (phone and computer), `/make/page/links`, a link and its Where screen, `/make/page/links/add`, `/make/page/take-down`, a draft's `line`, `files`, `upright`, `wide`, `age`, `agreement`, `check`, `throw-away` and its own page, and a live game's `take-off` and own page. Save, Repost and the follow plus pressed with A from the feed. After a swipe, the first press lands on the main button of the clip on screen. No pad (mouse, touch, keyboard): the full suite passed on tablet and computer, and on phone except as above.
