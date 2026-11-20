# Ruken history

## Setup

- 2026-11-18: superpowers **7.0.2**'s `test-driven-development`, `verification-before-completion`, `executing-plans` and
  `subagent-driven-development` read against the new verification rules (AutomataFramework
  `docs/superpowers/specs/2026-11-18-verification-design.md`, section 7). Where they differ, these rules win, and the
  differences are listed in `build` under "Superpowers' testing skills". `subagent-driven-development` is not used here
  (writers are threads); if it ever is, its task reviewer does not replace the implementation audit.
- 2026-11-18, copied from the other four repos' 2026-11-16 entry, which this repo's setup did not record. Where
  superpowers 7.0.2's skills differ from these rules, these rules win:
  - `writing-plans` saves a separate plan in `docs/superpowers/plans/`; here the plan is part of the spec.
  - `writing-plans` and `executing-plans` offer subagent-driven development and a subagent final review; here there
    are no subagents unless the Owner says so, and the implementation audit is a fresh session (`review`).
  - `executing-plans` defers minor final-review findings; here the fix round fixes every in-scope finding.
  - `executing-plans` sets up a worktree and ledger; here a thread works on its own branch.
- 2026-11-17 04:02 UTC, setup check by the coordinator thread. Superpowers 7.0.2. Restarted from the copies at `eda037a` (the restart handoff): CI restored with the kit's gate; AGENTS.md's product rules moved into `.claude/skills/this-repo`; `.claude/settings.json` restored with the kit's compaction hook. AGENTS.md's "Anything not in section 2 of the design needs the Owner's words before it starts" is replaced by CLAUDE.md's "What it is for, and anything new, is the owner's call". Graphify has RukenApp indexed (repo id `02c3c5f7-833c-4fa5-9303-be15daecca2b`). Session tools: this thread cannot start threads itself; the project coordinator starts them with a named model and archives them. Branch protection at the check required no checks and one approving review; the owner's batch sets `gate` and `commit-authors` and drops the review rule.
- Before this: slice 0, slice 1 (accounts and membership) and the start of slice 2 up to game submission (#63) are on `main`. The rest of the first slice 2 attempt was rolled back by #186 on 2026-11-17 and is kept only as the tags `slice2-attempt-1`, `slice2-attempt-1-pr-185`, `-pr-147`, `-pr-144` and `-walk-fixes`, for looking back.

## Rule changes

- 2026-11-18, the Owner: verification. `CLAUDE.md` gets a short Verification section in place of the Tests and Lessons
  bullets, and `build` gets the full rules: run the change like a person through a new per-repo `verify` skill; journeys
  first, then property tests, then old-versus-new tests; test first, from the outside in, with superpowers' testing
  skills read under these rules; a flaky test fixed at its root in its own thread, or deleted with the reason written
  down; a change does not quietly edit its own check; lessons carry a trigger read from the diff; each retrospective
  prunes. A repo's own `verify` and `this-repo` skills take the lane of the code they describe. One edited alone is lane
  1, unless it changes what needs the owner. Asked for in the project thread ("Let's rethink how we do tests", with the
  Claude Code team's article on verification, and "We also need to evaluate how superpowers comes into the picture
  because that's tdd") and approved on decision cards on 2026-11-18 at 00:30 UTC ("Core rewrite" only; a property-test
  library and a commit verification stamp or gate declined) and at about 00:52 UTC ("Kits + 5 repos"; "Same lane as the
  code") and at about 01:52 UTC ("Lane 1, with a guard"). Scope: this change only, made the same in the two kits in
  McThayDT-Website and in RukenApp, AutomataFramework, AutomataFrameworkEditors, AutomataFrameworkExamples and
  AutomataFrameworkSite, as AutomataFramework `docs/superpowers/specs/2026-11-18-verification-design.md` describes.
  Later rule changes are lane 3 as usual.
- 2026-11-18, the Owner: the shared Verification text says the full suite runs in CI where `release` sets the gate, so a games kit gate that runs the smoke set is a stated case. Chosen on a decision card ("Merge now, reword later").
- 2026-11-18, the Owner: a plan's order is a claim that one unit waits on another, not a queue; independent units run side by side up to the writer limit (`staged-path`). Asked for in the coordinator thread.

## Standing permissions

- The setup check (the owner's start prompt, 2026-11-17). Scope: the rules files, the CI workflows and the settings in this repo, as first-time setup.
- Merging, from the owner at 2026-11-20 09:24 UTC: "yes, do not ask me to merge anything". Scope: every pull request in this repo, lane 3 included, once its checks, its lane's reviews or audits and (for screens) the design check are clear. It does not cover live Cloudflare or domain console changes, which still need the owner.

## Approved screens

None recorded since the restart.

## Flaky tests

- 2026-11-17, main at 78008fc (run 44024056397, browser shard 6): `[tablet-landscape-webkit] make-second-look.test.ts:397` "on a wide window the screen after taking a game off starts at the top left, where Waiting starts, not in the middle" failed with "there is nothing on the page to measure" (`tests/browser/support/look.ts:151`, called at line 415); the next main run, 98e30ed, passed with no change to that screen. Root cause handed to S (#194), which changes that screen.
- 2026-11-18, main at 9972343 (run 44283213654, attempt 1, browser shard 6, job 134729167004): the same test failed the same way, after a change that touched only `.md` files. Log: `✘ 38 [tablet-landscape-webkit] › tests/browser/make-second-look.test.ts:397:1 › on a wide window the screen after taking a game off starts at the top left, where Waiting starts, not in the middle (5.0s)`, then `Error: there is nothing on the page to measure` at `tests/browser/support/look.ts:151`, from `make-second-look.test.ts:415:27`. Root cause, found and shown: the test takes the new address as the sign that the new screen is there, and in the maker's area it is not. SvelteKit 3 calls `history.pushState` before it runs the `onNavigate` callbacks (`@sveltejs/kit/src/runtime/client/client.js`, `navigate`: the `pushState` call, then `await run_on_navigate_callbacks`), and `src/routes/make/+layout.svelte`'s `onNavigate` holds the page swap until the browser's view transition calls back. So `toHaveURL` passes while the take-off card is still on the page, `main :is(.count, h1)` first finds the card's heading, and the card is swapped out before or while it is measured: no box. A probe on main (the `computer` project, Chromium, `document.startViewTransition` held until released; not committed) showed it: with the address already `/make/<slug>`, the first match was "Take Tiny game … off Ruken?" at x 292, y 211; after the release it was the game's name at x 40, y 132. The fix is to wait for the new screen itself, not the address. #194 already does that for this test (it waits for the heading "Taken off Ruken" before measuring), so it is not repeated on main; the flake stays possible on main until #194 merges. No other journey measures straight after `toHaveURL` (searched `tests/browser/*.test.ts`).
- 2026-11-18, main at b045221 (run 44311646240, browser shard 6, job 134827077264): the same test failed a third time, the same way: `✘ 38 [tablet-landscape-webkit] › tests/browser/make-second-look.test.ts:397:1 › … (5.2s)`, then `Error: there is nothing on the page to measure` from `make-second-look.test.ts:415:27`. Two main runs in a row, with #194 still open, so the fix went to main in its own pull request instead of waiting: before it measures, the test now waits for the new screen's heading, "Off Ruken. You took it off." (main's words; #194 changes them to "Taken off Ruken" and waits for those). Shown before the fix, with the maker area's view transition held (the `tablet-landscape` project, Chromium; the probe is not committed): the address wait measured the card, "Take … off Ruken?" at x 192, y 268, which fails the test; the heading wait did not pass while the card was there, and once the swap was let go it measured the game's name at x 20, y 100. After the fix the test passed 40 of 40 times (`--repeat-each=20` on `tablet-landscape` and `computer`, Chromium). Not run here: WebKit, which this container does not have; CI runs it.
- 2026-11-20, #206 (Unit R) at 15bb2da: `make-design-pass.test.ts:284` (the 56-letter name on an iPhone SE held sideways) failed once in CI on browser shard 1 with "there is nothing on the page to measure" (`tests/browser/support/look.ts:151`) and passed on re-run; locally it failed 1 of 5. Root cause not found yet.
- 2026-11-20, draft #220 (decision day, on #219 at f44ff05; run 44680976104, job 136104142367, browser shard 2): `[phone-landscape] play.test.ts:138` "the Menu tab moves, and stays where it was left" failed at line 149: after a mouse drag to 80% of the width, `details.menu` kept `data-side="left"` for 5 s. Neither #219 nor #220 touches the play screen (unit F, #218); the same test passed on #218's full run on 34e947c and on main's run on bb16ec1 (44678455232). Root cause not found yet. A lead: F's review noted the `dragged` flag in the play screen's drag handling (optional note 3), so the drag may end before a side is chosen.
- 2026-11-20, main at 56de029 (run 44682011892) and later runs: causes found, fix in the main-green pull request. (1) `game-page.test.ts:160` (tablet-webkit, "focus showing"): WebKit puts a bare `<video>` in the Tab order, and a video has no focus ring, so `outline` read "none". Reproduced in 2 of 6 local WebKit runs; fixed with `tabindex="-1"` on the page's clip and tile videos. (2) `game-page.test.ts:49/77/195`, `play.test.ts:35/201`, `pay.test.ts:87` (phone-landscape-webkit and tablet-webkit, `page.goto` timing out): WebKit holds the page's `load` event until each `<video preload="metadata">` has its metadata, and under load one request to the game gate's media address never answered (reproduced 3 of 8 times with 4 workers; the pending request was the wide clip). Fixed by the journeys waiting for `domcontentloaded` on game addresses; they check the clip themselves where it matters. The stalled gate request is not explained and is left open. (3) `play.test.ts:138` (the Menu tab drag, `data-side` never "right"): the journey waited for the game inside the frame but not for the page's script, so a mouse press made before the page came alive was not seen. The `dragged` flag is not the cause. Fixed by `loaded()` also waiting for `pageHasSettled`. The same wait protects every other Menu tab journey.
- 2026-11-20, #230 at 20aa482 (full run, browser shard 4): `[phone-landscape-webkit] make-walk.test.ts:326` "Keep it on Ruken changes nothing" failed once: the click on "Keep it on Ruken" did not navigate, and the address stayed `/make/tiny-game-21f5798d/take-off` where `/make/tiny-game-21f5798d` was expected. It passed on the one re-run of that job. #230 does not touch the take-off page or any rule it uses (`.card`, `.button.safe`, `.danger`, `.problem`). Locally in WebKit phone-landscape it passed 12 of 12 alone, and `make-walk` plus `make-after` passed twice at 4 workers. Root cause not found.

- 2026-11-20, #228 (unit A): `make-screen-review.test.ts:215` failed once on WebKit and passed on the one rerun.
- 2026-11-20, #217 (unit W) at 4e47ce5 (CI run 44753512820, attempt 1, browser shard 6): `[tablet-landscape-webkit] make-screen-review.test.ts:32, 41, 47` and `make-second-look.test.ts:48, 96` failed once: the "Create account" click timed out, or the page did not reach `/make/<game>/line`. All passed on attempt 2. No root-cause work, because slice 2 is the last work in this project (owner, 15:17 UTC).
- 2026-11-20, CI infrastructure: `playwright install --with-deps` stalled for 40 minutes or more on some runs, so the job reached its time limit (main's run on d7e95ba was cancelled this way). The one rerun passed.

## Lessons

None recorded since the restart.
