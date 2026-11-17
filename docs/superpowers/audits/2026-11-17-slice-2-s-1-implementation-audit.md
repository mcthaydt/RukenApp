# Slice 2, unit S: implementation audit 1

**Examined:** commit `ef29275` on `claude/project-thread-5oeffo` (pull request #194), against `docs/superpowers/plans/2026-11-15-slice-2-rest.md` as it is on `main` at `78008fc` (unit S: its acceptance criteria, Task 30 and Task 31), `CLAUDE.md`, and the `review`, `build`, `release`, `visual-check` and `this-repo` skills. Lane 2. A fresh session that wrote none of the code.

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

**Verdict:** two red findings, both small and bounded, then the unit can be marked ready. The review command, take off, put back and the files-left path do what the plan says, and their tests fail without the code.

## What ran, in this session's container, at `ef29275`

| Check | Result |
|---|---|
| `pnpm lint` | pass |
| `pnpm typecheck` | pass |
| `pnpm test` | 100 files, 1413 tests, all pass |
| `pnpm test:pg` (Postgres 16) | 39 files, 581 tests, all pass |
| `pnpm test:browser` `review-job`, `take-off`, `make-walk`, `make-second-look` on `phone`, `tablet`, `computer` | 208 passed, 65 skipped (skips are the files' own layout conditions), 0 failed |
| A test that fails by itself: `deleteAll` taken out of `takeOff` | 2 of 16 in `take-off.pg.test.ts` fail, as they should; restored |
| The words-and-design check (`visual-check` step 1) | small phone (320 by 568 and Pixel 7), tablet (iPad upright), computer; the question, Taken off, a refused copy, files left, after Delete them, and after Put it back. Screenshots taken by a throwaway journey that was not committed |

Not run here: the WebKit projects and the landscape projects (this container has Chromium only), and `pnpm build` on its own (the journeys' server builds the app, so it built). CI: the quick run on `ef29275` was cancelled by this audit's own first push (`25c3958`, the workflow's concurrency rule), not by a failure; its `verify`, `postgres` and two browser pieces had passed. The full run on the ready pull request is the gate.

## Acceptance criteria

| Criterion (the plan's, unit S) | Met? | Evidence |
|---|---|---|
| With the secret: list, look (a link that plays before live), accept, send back; one sentence under `says` or `problem` | yes | `src/routes/jobs/review/+server.ts`; `review-job.test.ts` loads the look link (`data-loaded`), reads the video's type, accepts, sends back |
| Without the secret: 404 and nothing changes | yes | first journey of `review-job.test.ts`; `hasJobSecret` first in `POST` |
| Accepted is `live`, maker sees Live; sent back shows the Owner's words | yes | `review-job.test.ts`, journeys 3 and 4 |
| Take off: off at once, files deleted, waiting update dropped | yes | `takeOff` clears `livePullId` and pending, then `deleteAll`; `take-off.pg.test.ts` |
| Taken off: one blue button, never live by itself, a refused copy leaves it off and says why | yes | `TakenOffScreen.svelte`; `putBack`; `take-off.pg.test.ts` and `take-off.test.ts` |
| Files left are named, with a button that deletes them | yes | `filesLeft` through `hasAny`; seen on screen and deleted on all three devices |
| Another maker: 404 at every address and action | yes | `MAKER_ADDRESSES` gains the four; last journey of `take-off.test.ts` |
| Both maker screens by keyboard alone, focus visible, nothing sideways, nine projects | **partly** | Taken off: covered. The question: see R2 |
| lint, typecheck, unit, pg, browser, build in CI's full run | not yet | runs when the pull request is marked ready |

## Red findings

**R1.** UNIT: `src/routes/make/parts/TakenOffScreen.svelte`. VERDICT: red. REQUIREMENT: Task 31, "laid out as `StateScreen` is, so on a wide window it starts at the top left where Live and Waiting start"; `visual-check` step 1, layout. REASON: "Back to your games" starts 20px to the right of every other line on the screen, on every device. EVIDENCE: measured on `ef29275`: the link's box starts at x 40 while the heading starts at x 20 on `phone` and `tablet`, and at x 60 against 40 on `computer`. The link is an `a.foot` inside `main[data-state]`, which only the general `a.foot` rule reaches (`look.css`: `margin: 1.5rem 0 1rem 1.25rem`); Live's link is inside `.halves`/`.live` and `StateScreen`'s way back is a button in `acts`, so neither is indented. EXPECTED: the link starts at the same left edge as the name, heading and lines above it. FIX: in `TakenOffScreen.svelte` only, lay the link out with a rule that already exists (for example as a direct child of `.screen`, where `.screen > a.foot` sets it in the column), with no new class or rule in `look.css` (the plan's limit: if nothing existing fits, stop and report). Add one assertion to `tests/browser/take-off.test.ts`: the link's x equals the heading's x within 1px. Files: those two.

**R2.** UNIT: `tests/browser/take-off.test.ts`, "the screen works by keyboard alone, with focus showing". VERDICT: red. REQUIREMENT: unit S acceptance criterion "Both maker screens work by keyboard alone with focus visible"; Task 31 Step 3, whose journey ends "Enter on the question keeps the game". REASON: the journey checks only the Taken off screen; nothing checks the question by keyboard. EVIDENCE: the file has no `keyboard.press("Enter")`, and the only keyboard check of the question anywhere is that "Keep it on Ruken" starts focused (`make-walk.test.ts:327`). By hand, the behaviour is right: Tab from "Keep it on Ruken" lands on "Take it off Ruken" with a visible ring (small-phone screenshot). EXPECTED: a journey proves it. FIX: in that one test (or one new test in the same file), on `/make/<slug>/take-off`: Enter with the starting focus leads to `/make/<slug>` with the heading "Live" and `stateOf` still `live`; and Tab reaches "Take it off Ruken" with an outline style that is not `none`. File: `tests/browser/take-off.test.ts`.

## Notes (recorded, not fixed here)

1. On the computer, the note "Copies the newest version…" touches the files-left card with no gap (the `sheet fix` card sits straight under the form). Polish for the slice-end design rounds.
2. A refused put-back for a lost GitHub link reads "Ruken can't see that game on GitHub. Choose it on GitHub, then try again." A maker who reinstalled the GitHub app gets a new installation id, and the only way to refresh Ruken's copy of it is a files question, which a taken-off game does not have. Live's "Send a new version" has the same path today (from M). Worth a look in the slice-end walk; outside this change.
3. If `pullLatest` passes and `sendForReview` then refuses, the new copy's files stay in the bucket and the screen shows "Some of its files are still on Ruken." Pressing Delete them deletes that copy, which is harmless. Hard to reach today (a taken-off game keeps its videos and answers, and `toFix` is cleared).
4. A put-back game can now be sent back and then thrown away; before, only a game that was never live could be. `throwAway` keeps the row, so records still point at it. For the slice 2 audit to confirm.
5. `kind` ("game" or "update") is worked out twice: in `waitingGames` and again in the route. One place would be simpler.
6. The builder's stated deviation, `reviewJob(request, order, browser)`, is needed (making the first staff account takes a browser context) and accepted. Unit F's plan text calls `reviewJob(request, …)`; F passes the browser too. `addGame(browser, request, …)` matches the plan.
7. The pull request's own criteria leave out "on all nine projects" and the CI full-run line. The plan's criteria govern; put both back in the body.
8. `GET /jobs/review` answers 405, which tells anyone the address exists; the plan allows 404 or 405, and `/jobs/first-owner` does the same.
9. A part named twice in a send-back answers "Pick a reason for each part you ticked.", which speaks of ticks to a command. The plan names these words; a line of its own would read better later.

## Checked and found right

`firstGameStaff` (oldest by `createdAt`, then `id`, only game-staff roles); `readReviewOrder`'s four refusals word for word; every status and sentence in the route's table; `reviewLook` writes a pass for the pending pull and no play session; `hasAny` checks the folder prefix and asks R2 for one key; `takeOff` writes the database before deleting, and the action sends a maker whose delete stopped to the screen that offers to finish it; `putBack` and `deleteLeftFiles` refuse any state but `taken_off`, and both actions 404 for one; `filesLeft` asks the bucket only for a taken-off game; the new words in `review.ts` and the question; nothing under `src/routes/` has a style, colour or `<style>`; no new package, table, migration or `look.css` rule; commit identity (`commit-authors` green); the live-state file is gone in `ef29275`; the pull request body starts with the attribution and ends "Requested by **McThayDT**". Words: every line on both screens is plain; each screen has one blue button in view; red only on "Take it off Ruken" and "Delete them", both of which delete.

## Fix check, at `33c67bb`

Checked by this audit session, not by the fixer. The diff from `8f83b72` touches only `TakenOffScreen.svelte` and `tests/browser/take-off.test.ts`, the two files the findings allowed. No rule was added to `look.css`.

- **R1: closed.** "Back to your games" is now a direct child of `.screen`, so it gets `.screen > a.foot`. Measured: its x equals the heading's x on `phone`, the 320 by 568 small phone, `tablet` (all 20) and `computer` (40). On every device it sits above the pinned bar (small phone: the link ends at y 440, the bar starts at 488). The new assertion fails on the old screen: putting `ef29275`'s `TakenOffScreen.svelte` back makes it fail on `phone` and `computer`, and it passes on `33c67bb`.
- **R2: closed.** The new journey checks that focus starts on "Keep it on Ruken", that Tab reaches "Take it off Ruken" with an outline that is not `none`, and that Enter on the safe choice leads to Live with the game still `live`. The behaviour was already right, so this closes a missing check, not a defect.
- Ran: `take-off`, `make-walk` and `make-second-look` on `phone`, `tablet` and `computer`: 200 passed, 67 skipped (the files' own layout conditions), 0 failed.
- Note 10 (new, not blocking): `.screen > a.foot` puts the link at the foot of the window. On a computer it now sits near the window's bottom edge, well below the button, as it does on Check and send. Its pressable box is also the column's full width. Both follow the existing pattern; the slice-end design rounds can weigh them.

Nothing is red. The unit can be marked ready once CI's full run is green.
