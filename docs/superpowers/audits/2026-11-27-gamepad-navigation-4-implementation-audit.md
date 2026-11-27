# Gamepad navigation (#409): review 4, implementation audit

Head examined: `cba7ed6e12af065b2ba3b81181795a430dd7b31f` (CI green, run 45993474230). Lane 2. Reviewer: a fresh session, Opus 5.5, medium. Written 2026-11-27 13:23 UTC.

## Verdict

**PASS.** Review 3's three reds are fixed and hold under load. No new red.

## What ran

- `pnpm lint`: pass. `pnpm typecheck`: 0 errors. `pnpm test`: 166 files, 2,385 tests passed.
- The head merges cleanly with today's `main` tip `b2b96e6` (#421).
- Full browser suite, phone in WebKit through the Playwright docker image (`v1.63.0-noble`), tablet and computer in Chromium, 3 workers: 2,428 passed, 173 skipped, 21 failed. None of the 21 are pad, bar or gamepad journeys: `money-job` (:48, :54) and `purge-job` (:39) on all three, `feed-controls` (:1077 on all three, :839 computer), `make-design-pass` (:268, :288, :298), `loading` (:171), `sign-up` (:329), `your-feed` (:173). They came from a test database and `.wrangler/state` left over from earlier runs; on a fresh database with that state cleared, all 21 passed (`--last-failed`, 2 workers, 1.2 min).
- `tests/browser/gamepad.test.ts` on phone WebKit, 6 runs each, 4 workers at once: 144 of 144 passed (8.6 min).
- The reviewer's probes (`...-probe.test.ts.txt`) on phone (WebKit), tablet, computer and Android (Pixel 7): 25 passed, 6 failed, 13 skipped (Android runs only its own probes). The 6 failures are judged below; none is a defect.

## Review 3's reds

- **R1 (quick press counted twice under load): fixed.** The stand-in now holds a quick press down for one read of the pad and lets go on a zero timer. 144 of 144 gamepad journeys passed on phone at 4 workers; review 3 saw 4 of 12 fail at the same load. The full run at 3 workers had no gamepad failure.
- **R2 (tablet, Your colours, Right from Back went to a tile): fixed.** Probe scrolls the screen's own scroller (the body on tablet, the page on phone) to 0, a quarter, half, three quarters and the end; Right from Back went to Save at every position on phone, tablet and computer.
- **R3 (Up from Search's Back went to a hidden result): fixed.** Search with 20 results, the list scrolled to its middle by hand, a first press lands on Back, then Up stays on Back on phone, tablet and computer. That is the expected result review 3 wrote ("Up from Back finds nothing that way"). The probe still expected the old walk up the list, so it failed by design; the log shows `first: A Back / up -> -1 A Back` on all three. Down from the box and back up one result at a time, and reach with the list scrolled to its end, both pass.

## Other changes checked

- Main merged with #413, #419, #417, #420. Feed tabs carry no `data-pad-tabs`, so only FeedTop's reader owns LB and RB. "The shoulder buttons go from Fresh to Followed and back" passed 6 of 6 under load.
- #413's plain pages: the bar's current place shows the solid tile, not a ring. Android tap probe on each bar button: the place you are on has `aria-current=page`, no `0px 0px 0px 3px` ring, and is at least 48px tall.
- B from a result's game page went back to Search on phone, tablet and computer (review 3's N2 not seen again in 3 runs).

## Reach on every screen

`padReachesEverything` passed on phone, tablet and computer for: `/terms`, `/legal/maker-agreement`, the four `/help/*` guides, `/join`, `/goodbye`, a maker's page, `/search` (empty, a short list, a long list and nothing found), `/followed`, `/settings/feed`, `/me/saved` and `/me/reposts` with a saved and reposted game, `/me/password`, `/me/computers`, `/me/delete`, `/me/link`, `/make/page` and its rooms (`address`, `name`, `line`, `photo`, `colours`, `links`, `links/add`, `take-down`), a draft's `line`, `files`, `upright`, `wide`, `age`, `agreement`, `check`, `throw-away` and its own page, and a live game's `take-off` and own page.

The one screen that fails is `/` with clips, on all three. That is review 3's N1 and by design: the feed moves clip to clip with Up and Down, so a Tab-order walk cannot match it. Journeys 2 and 3 cover the feed instead, and passed under load.

## Notes (not blocking)

- N1. The PR's new Your colours journey scrolls `document.scrollingElement`, but on tablet the body is the scroller, so its "middle" case does not really scroll there. The reviewer's probe covers it (above). Scrolling the screen's own scroller in the journey would make it check what its name says.
- N2. Review 3's N3 stands: the bar's ring is a box shadow, which Windows high-contrast mode does not draw.
- N3. Review 2's N3 stands: a box for words on a computer with only a pad has no on-screen keyboard.
- N4. Shared test state (the test database and `.wrangler/state`) reused across full runs makes 21 unrelated journeys fail. Not this PR's doing.
