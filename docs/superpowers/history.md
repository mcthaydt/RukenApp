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

## Standing permissions

- The setup check (the owner's start prompt, 2026-11-17). Scope: the rules files, the CI workflows and the settings in this repo, as first-time setup.

## Approved screens

None recorded since the restart.

## Flaky tests

- 2026-11-17, main at 78008fc (run 44024056397, browser shard 6): `[tablet-landscape-webkit] make-second-look.test.ts:397` "on a wide window the screen after taking a game off starts at the top left, where Waiting starts, not in the middle" failed with "there is nothing on the page to measure" (`tests/browser/support/look.ts:151`, called at line 415); the next main run, 98e30ed, passed with no change to that screen. Root cause handed to S (#194), which changes that screen.

## Lessons

None recorded since the restart.
