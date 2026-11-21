# Test cleanup (PR #252), lane 2 review, round 1

Commit examined: d8ff7e3 (branch claude/project-thread-3mnlhl). Verdict: **FAIL, 4 red.**

What ran: read the PR body and the full diff against main; grep of every journey that depends on the project name or the window's layout; read of each one that now skips; check that the Playwright presets "iPhone SE (3rd gen)" (webkit, 375x667) and "iPad (gen 7)" (810x1080) exist; grep for old-workflow comments. Not run: the journeys themselves (CI was still running at review time; WebKit is not in this container).

What holds: the nine-to-three project change matches the owner's 2026-11-21 pick; the three `onlyIn("phone-landscape")` journeys now run in `phone` with their own 568x320 window; the comment edits change no behaviour.

## Red

### R1. Three journeys now skip in every project
- UNIT: tests/browser/make-screen-review.test.ts:199, tests/browser/make-second-look.test.ts:260 and :657
- REQUIREMENT: PR criterion 2 ("none is skipped everywhere"); review skill (a removed test is named with its reason)
- REASON: they skip unless the window is a sideways phone or a sideways tablet, set no window of their own, and no project is sideways any more.
- EVIDENCE: make-screen-review:202 `test.skip(layoutOf(page) !== "phone-sideways", ...)` ("on a sideways phone the answer box is in view above the bar, under a two-line heading"); make-second-look:263 `test.skip(layoutOf(page) !== "tablet-sideways", ...)` ("on a tablet held sideways, as on a computer, 'Add a game' is on the heading's line"); make-second-look:658 `test.skip(layoutOf(page) !== "phone-sideways", "... in the projects that have one")` ("on a phone held sideways the upright video's frame is whole above the bar"). Projects are 375x667, 810x1080, 1280x720: none is phone-sideways or tablet-sideways under layoutOf (tests/browser/support/look.ts:292). None is named in the PR body.
- EXPECTED: each still runs somewhere, or is named in "Tests and checks changed" with its reason.
- FIX: wrap each in a `test.describe` with `test.use({ viewport })` (915x412 for the sideways phone, the old Pixel 7 landscape; 1080x810 for the sideways iPad) and run it in one project, as the PR already does for the iPhone SE ones. Files: those two test files.

### R2. No journey reaches the sideways-tablet layout
- UNIT: tests/browser/make-look.test.ts, tests/browser/make-second-look.test.ts
- REQUIREMENT: no real coverage lost; the owner's 2026-11-14 "tablet is first class supported, and mobile landscape" (quoted in playwright.config.ts)
- REASON: `tablet-sideways` (landscape, 500 to 1199 wide, 450 or more tall) was reached only by the removed `tablet-landscape` projects. No `test.use` sets such a window (the widest sideways override, 915x412, is phone-sideways).
- EVIDENCE: branches now never taken: make-look.test.ts:441 (the preview card is 260 wide on a sideways tablet), make-look.test.ts:327, make-second-look.test.ts:241, :334, :383, :754 (these now run on the computer only), plus :263 in R1. The PR's gap line says no project is sideways by default but does not say this layout has no journey at all.
- EXPECTED: the sideways-tablet layout keeps the checks it had, or the loss is named and put to the owner.
- FIX: one `test.describe` at 1080x810, run in the `tablet` project, holding the sideways-tablet journeys (or a project-independent repeat of those tests). If the builder thinks it should be dropped, name it in the body and ask the owner with a decision card. Files: those two test files.

### R3. Two places still describe the removed projects
- UNIT: playwright.config.ts:139-143; .claude/skills/verify/SKILL.md:53
- REQUIREMENT: consistency within the change
- REASON: the config keeps the old comment ("The Chromium projects keep the Android phone's ... The '-webkit' projects run the same journeys ...") right above the new one that contradicts it; verify says its window is "412 by 915, the Pixel 7 size in `playwright.config.ts`", which the config no longer has.
- EXPECTED: both describe the three projects that exist.
- FIX: delete the stale comment lines in playwright.config.ts (the owner quotes may stay); in verify, say 375 by 667, the iPhone SE size, and name the verify edit in the PR body (it takes this PR's lane). Files: those two.

### R4. Old-workflow plan references remain (criterion 3)
- UNIT: tests/ (46 files)
- REQUIREMENT: PR criterion 3 ("No test comment cites a plan's task number, 'the plan' ..."); the owner's ask
- REASON: plan references the PR set out to remove are still there.
- EVIDENCE: tests/browser/support/fake-github-server.ts:166 "(task 8)". 100 "Review Focus N" labels across 46 test files (`grep -rn "Review Focus" tests/`), which point at the plans deleted in 2f1bde5. The PR removed one of them ("Review Focus 6 of the plan", purge.pg.test.ts) but left three in the same file (:194, :239, :273).
- EXPECTED: `grep -rnEi "task [0-9]+|Review Focus" tests/` finds nothing.
- FIX: drop the "(task 8)" and "Review Focus N" labels, keeping the rest of each comment. Comments only. Files: those under tests/.

## Notes (not blocking)
- src/routes/make/[game]/[question=question]/+page.server.ts has one "Review Focus" too; outside tests, a follow-up.
- make-look.test.ts:240 reasons from "an iPhone 15 in Safari is 393 by 659": still true as an example, though no project is that phone now.
- Losing Android Chrome on a phone window is named in the PR; it follows the owner's pick.
