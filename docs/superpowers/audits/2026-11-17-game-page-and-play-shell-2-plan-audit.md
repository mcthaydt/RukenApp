# Plan audit: the game's page and playing it (cycle 2)

Date: 2026-11-17 (written 06:24 UTC). Commits examined: `ec37c00`, then `fdc36a9` (two lines after it) on `claude/project-thread-ozoxv5` (PR #193), against cycle 1 (`2026-11-17-game-page-and-play-shell-1-plan-audit.md`, on `36e2014`). The same session as cycle 1, Opus 5.5, medium. The fixes were made by the planner's session, not this one.

Read: the diffs `691f18e..ec37c00` and `ec37c00..fdc36a9` of the spec and the plan, in full, and the lines it touches in context; `src/lib/look.css` (`.button`, `.outline`), `src/features/play/may-play.ts` (`backFromPaywall`). No test ran: this audit reads a plan.

## Verdict

At `fdc36a9` every cycle 1 red passes, and the one new red the fixes caused at `ec37c00` (C1) passes too. Two notes are left (C2, C3). **Unit P is ready to build** once the Owner has seen P6, the default-off call. **Unit F is ready to build** on `fdc36a9`.

## Cycle 1 reds at `ec37c00`

| Finding | Result | Evidence at `ec37c00` |
|---|---|---|
| P1 the merge applies the migration | PASS | Spec 8 and the plan's Unit P paragraph now say that merging applies the migration through the deploy command (`prisma migrate deploy`). The Owner's approval is for that merge, and undoing it is a second migration (`DROP COLUMN`). Step 2's "one command" is gone |
| P2 the switch is new | PASS | Task 25 Modify lists `src/lib/look.css` and `tests/lib/look.test.ts`. The switch is described as a plain form with one button whose name reads its state. It has the On/Off chip, is at least 44 by 44, and its class is in `CLASSES`. Step 1 has the rule case |
| P3 "a counted play" | PASS | Spec 5 and Task 25 say: at least one attentive beat. Step 1 adds a member with no beat and a member whose beats all say looked away; neither is counted |
| P4 route-level refusal | PASS | The action is named `playerCount` and starts with `ownGame(event)` and a `state === "live"` check. The journey checks that another account's post answers 404 and leaves the column unchanged |
| F1 the page's ground | PASS | Spec 1 now says only Live has the blurred video and the page keeps the plain felt. The circles are gone from 3.5, and `backdrop` is gone from Task 20's Consumes |
| F2 no bar | PASS | Task 20: "No bar: the page leaves room at its foot for slice 3's (spec 3.3)" |
| F3 a computer-only game on an iPad | PASS | Spec 3.4 has a row for tablets: a coarse pointer and a computer-only game put "This one needs a computer." and Share where Play was. Section 10 and Task 20 say the same, and a journey emulates a desktop agent with a coarse pointer |
| F4 the sitting line counts only time played | PASS | Spec 5 and `sittingOf`: at least one attentive beat, counted time above 0. Step 1 adds a play whose only beat says looked away |
| F5 `addPlays` | PASS | `addPlays(slug, count, minutes)` writes beats every 15 seconds. The journey expects "about 12 minutes". The 60-minute words are pinned ("about an hour"), along with 105 minutes ("about 2 hours") |
| F6 the age lines | PASS | The question's `+page.server.ts` passes the five lines from `ratingLine`, and its `.svelte` reads them from `data`, importing no feature |
| F7 how states are styled | PASS | The tile uses `aria-pressed`. The tab and the menu use `data-side` and `[open]`, styled by attribute selectors. `--tab-at` is set by script with `style.setProperty`, and a drag's closing click calls `preventDefault()` (Task 21) |
| F8 the 12px label | PASS | Spec 4.1: `--text-small`, 14px |
| F9 `expectNoSidewaysScroll` | PASS | The journey checks `scrollWidth <= clientWidth` inline, as the other look journeys do |
| F10 Share's name | PASS | "Share" everywhere |
| F11 the contrast test | PASS | The test blends the tab at its rest opacity over `#ffffff` and expects 4.5:1 or better; the spec works it out at 7.48:1 for 72% (this audit measured 7.47:1, the same to rounding) |

Notes N2 to N6 from cycle 1 were taken up (N2 the photo's address, N3 the Keep playing exception in Task 22, N4 the "Tap" exception, N5 as Join, N6 the 60-minute words). N1 (reuse `playBasis` for `cost`) was not; it stays a note.

## New in cycle 2

### C1. red at `ec37c00`, PASS at `fdc36a9`: Join was marked Pending, yet the plan built it

- UNIT: spec 3.4 ("**Join.** ... Pending"); plan Task 20 ("Join ... Pending the Owner's answer"), its journey, and Unit F's acceptance criteria.
- REQUIREMENT: the spec's own rule (its opening): "Lines marked **Pending** wait for the Owner and are not built until the answer comes." Section 9 lists every open decision.
- REASON: the plan builds Join now and takes it out if the Owner says no. The spec's rule says a Pending line is not built, and section 9 does not list Join, so the brief contradicts itself on whether to build it.
- EVIDENCE: spec line 7 (the rule); spec 3.4 Join paragraph; plan Task 20 Interfaces bullet "Join, for `cost` "join" only ... Pending"; spec section 9 has items 1 to 3 only.
- EXPECTED: one status. It is easy to undo and is the recommended answer, so `CLAUDE.md` ("keep working on the option you recommend") supports building it as a **Call** the Owner can overrule.
- FIX: in spec 3.4 and Task 20, change "Pending" to "Call, the Owner can overrule". Add item 4 to spec section 9: "Join beside the price on the game's page (Call; the coordinator has asked the Owner)". Files: the spec and the plan only.
- AT `fdc36a9`: PASS. The Owner answered on a card, "Yes, a quiet Join beside the price"; spec 3.4 and Task 20 record those words in place of "Pending", so Join is settled and is built. (Section 0 does not repeat the answer; 3.4 holds it, which is enough.)

### C2. note: "Not now" on the card reached from Join goes to the front page

`backFromPaywall` (`src/features/play/may-play.ts:44`) leads back to the game's page only from a `/g/<slug>/play` address. From Join's `next=/g/<slug>`, "Not now" goes to `/`, so a person who pressed Join and changed their mind is sent home, not back to the game they were looking at. If the planner wants them returned to the game, `backFromPaywall` should also accept `/g/<slug>`, with a case in `tests/features/play/may-play.test.ts` and in Task 21's `join.test.ts` case. Recorded, not required.

### C3. note: two outlines beside one blue button

For someone who is not a member, the page now has Play (blue), Share (outline) and Join (outline). That is within 15.1 (a second forward action is a quiet outline), but it is the one place with two outlines in a row. The first design round should look at it on the phone.
