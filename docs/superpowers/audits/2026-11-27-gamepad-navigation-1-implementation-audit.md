# Gamepad navigation (#409): lane 2 implementation audit, cycle 1

Examined commit: `584c0851e2f64360667ea02269f6967271b59cb1` (branch `claude/project-thread-0ay036`). Reviewer: a fresh session, Opus 5.5, medium effort. Written 2026-11-27 04:22 UTC.

**Verdict: FAIL, 2 red.**

## What ran

- `pnpm lint`, `pnpm typecheck` (0 errors), `pnpm test`: 2278 passed, on 584c085.
- `tests/browser/gamepad.test.ts` on phone (WebKit, in the `mcr.microsoft.com/playwright:v1.63.0-noble` image), tablet and computer: every journey passed, on 5646455 and again on 584c085.
- A reviewer's probe (`2026-11-27-gamepad-navigation-1-probe.test.ts.txt`, not in the PR) with `padReachesEverything` on 21 more screens, on all three devices: `/terms`, `/legal/maker-agreement`, the four `/help/*` guides, `/join`, a maker's page, `/me/password`, `/me/computers`, `/me/delete`, `/me/link`, `/make/page`, `/make/page/links/add`, and a game's questions (`line`, `files`, `upright`, `wide`, `age`), Check and send and the game's own make page. All reached everything except Check and send (R1). It also opened the Report sheet with A, kept the focus inside it and closed it with B back onto Report (passed), walked the play screen as it opens (R2), and checked that after a mouse press a pad move still shows the focus ring (passed on all three: `:focus-visible`, 3px solid outline).
- Regression run with no pad: `feed`, `feed-controls`, `play`, `page-moves`, `report-a-game` journeys on phone and computer: 138 passed. The layer does nothing until a pad is connected, so mouse, touch and keyboard are unchanged.
- Not run: a real controller (none here). The full browser suite (CI's full run does it when the PR is marked ready).

## Red findings

### R1. A Change button on Check and send cannot be reached, depending on the game's name

UNIT: `src/lib/pad-moves.ts` (`ahead`), seen on `/make/<game>/check`.
VERDICT: red.
REQUIREMENT: the owner's rule, everything fully navigable with a gamepad; criterion 1 (the pad reaches every control Tab reaches).
REASON: when two boxes overlap along the move, `ahead` counts the other box as lying that way as soon as its middle is more than 2px further on. A Change button 6px to the right of the one under it then counts as "right", at a cost of 0, and wins over a real neighbour on the same row.
EVIDENCE: on computer (1280x720), the probe failed 1 of 3 runs on 584c085 (and passed on 5646455) with "the pad cannot reach these: Change the other websites". The boxes measured in the failing layout, fed to `nextBox` alone (`2026-11-27-gamepad-navigation-1-probe-nextbox.test.ts.txt`), leave `other` unreached every time. Right from "Change the line" (L905–953) goes to "Change the name" (L911–959, middle 6px further right, 20px up) instead of "Change the other websites" (L1093, same row); right from "Change who it's for" also climbs to "Change the name". "Change the name" moves its left edge with the length of the game's name (L883, L911, L914 in three runs), so whether the button can be reached depends on what the maker typed.
EXPECTED: every control Tab reaches on Check and send is reached by the pad, whatever the name.
FIX: in `ahead`, only count an overlapping box as lying that way when its middle is clearly further on (for example by more than half the moving box's own size along that way), so a slightly shifted button in the next row is not "right"; add the measured boxes above as a unit case in `tests/lib/pad-moves.test.ts`, and add Check and send (from `startAtCheck`) to the `padReachesEverything` journeys. Files: `src/lib/pad-moves.ts`, `tests/lib/pad-moves.test.ts`, `tests/browser/gamepad.test.ts`.

### R2. On the play screen the pad does not reach the game, and B leaves the player outside it

UNIT: `src/features/play/PlayScreen.svelte`, `src/lib/pad-focus.ts` (`back`).
VERDICT: red.
REQUIREMENT: the owner's rule (the game page usable with a gamepad alone); the PR's "The game keeps the pad".
REASON: when a game opens, nothing has the focus, so the layer reads the pad as page moves, not the game's; B on the menu closes it the way Escape does, which puts the focus on the RKN tab, not back on the game.
EVIDENCE: the probe's play screen walk, the same on all three devices: `opened: focus BODY` → A: focus on the tab (SUMMARY), menu closed → A again: menu open → B: focus on the tab, menu closed → A: menu open again. A pad-only player's A presses meant for the game focus the tab and then open Ruken's menu over the game, and after B they do it again; the only way into the game is Keep playing. Journeys 5 and 6 call `frame.focus()` by hand, so they never see this.
EXPECTED: when the game has loaded, the pad goes to the game (its frame has the focus, as Keep playing gives it), and B on the menu closes it back into the game, like Keep playing. Escape on a keyboard can keep its current behaviour.
FIX: on the play screen, focus the frame once it has loaded (unless the menu is open), and make the pad's B over the play menu do what Keep playing does (for example the play screen listens for a pad back event, or `back()` presses Keep playing inside `[data-pad-scope]`); change journeys 5 and 6 to start from the play screen as it opens, with no `frame.focus()`. Files: `src/features/play/PlayScreen.svelte`, `src/lib/pad-focus.ts`, `tests/browser/gamepad.test.ts`.

## Notes (not blocking)

- N1. The journeys check 12 screens; the probe's other 20 passed. Adding the game's questions and Check and send to the journeys (part of R1's fix) covers the screens with the most controls.
- N2. No screen on `main` marks a tab row yet, so LB and RB do nothing today; the PR says #402 adds it.
- N3. A on a box for words leaves typing to the system's on-screen keyboard; on a computer with only a pad there may be none. Recorded as a follow-up, not this change.
- N4. The no-page-scroll rule holds: `focusOn` uses `scrollIntoView({ block: "nearest" })`, which scrolls a screen's own box, and the journeys and probe saw no page move. No new control was added, so the 48px rule is untouched.

## Checked and fine

The pad reading (`gamepad.ts`: dead zone, repeat, View held, two pads), the Share and Report sheets (focus stays inside, B closes onto the opener), B going back only inside Ruken (`depth`), the feed's up and down landing on the new clip's main button, the landing page line in `sections.ts`, the progress row in the PR, the live-state file removed before review.
