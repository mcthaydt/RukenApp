# Flaky browser journeys (#242): implementation audit, cycle 1

**f81b138 FAIL: 1 red, 2 notes**

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

- Pull request: https://github.com/mcthaydt/RukenApp/pull/242, branch `claude/project-thread-3mnlhl`, base `977e7a5`.
- Commit examined: `f81b138` (head at 2026-11-20T23:50Z, from `date`). Lane 2. Brief: the pull request's acceptance criteria and its "Tests and checks changed" section.
- This file belongs at `docs/superpowers/audits/` on the PR branch; the reviewer wrote it to the project files and the implementer commits it in the fix round, as with #240.

## What was checked

- The whole diff (5 files, +37 −7) against each acceptance criterion.
- Criterion 1 (`addDraft` waits for question 2): met. `game.ts` waits for `getByLabel(/about, in one line\?$/)`, the same label `answerLine` fills.
- Criterion 2 (site answer gets 15 s, finding a button 5 s): met in the config (`expect.timeout` 15 s, `actionTimeout` 5 s) and in `signUp`/`signInAs`; **not met** at four other presses with the same cause (red 1).
- Criterion 3 (missing picture noted, not failed): met. Only errors containing "Unable to capture screenshot" are caught; anything else rethrows. Graphify: `showTheOwner` has 13 callers, all journeys; nothing reads the `look: ` attachment names, so the `(no picture)` text attachment breaks no consumer.
- Criterion 4 (history.md): met, each entry has run, cause and fix (see note 2).
- Criterion 5 (full CI green, no rerun): not yet shown. At review time the quick draft run on `f81b138` was queued (6 browser shards, postgres, verify); `commit-authors` and `what changed` passed. No full run exists while the PR is a draft.

## Findings

### Red 1: four sign-up and sign-in presses keep the 5-second wait that caused the flake

UNIT: `tests/browser/join.test.ts:114`, `tests/browser/play.test.ts:84`, `tests/browser/pay.test.ts:27`, `tests/browser/delete-account.test.ts:45`.
VERDICT: red.
REQUIREMENT: criterion 2, "A wait for the site's answer gets 15 seconds", and the PR's aim to fix the flake at its cause.
REASON: the cause recorded for `connect-github.test.ts:23` is a "Create account" press timing out at 5 s while the busy `wrangler dev` answers; the fix raised that press's timeout only inside `signUp`/`signInAs`. These four journeys make the same successful sign-up or sign-in press directly, with `.click()` and the 5 s `actionTimeout`, so they can fail the same way.
EVIDENCE: `join.test.ts:114`, `play.test.ts:84`, `pay.test.ts:27`: `getByRole("button", { name: "Create account" }).click()` then a navigation. `delete-account.test.ts:45`: `getByRole("button", { name: "Sign in" }).click()` then `toHaveURL("/me")`.
EXPECTED: every press that waits for the site's sign-up or sign-in answer gets the 15 s answer timeout.
FIX: export `SITE_ANSWER_TIMEOUT` from `tests/browser/support/account.ts` and pass `{ timeout: SITE_ANSWER_TIMEOUT }` at those four presses. Files: those four tests and `account.ts`. (`purged-account.test.ts:42,67` and `look.test.ts:137` are refusals with no navigation; leaving them is fine.)

### Note 1: the config's older comment now overstates the 5-second rule

`playwright.config.ts:21` still says "A missing page or field fails in 5 seconds"; with `expect.timeout` at 15 s, a field checked by `expect(...).toBeVisible()` now fails in 15 s and only actions fail in 5. One-line comment fix if the implementer is in the file anyway.

### Note 2: history.md points at a branch that will be deleted

"Root causes and fixes are on branch `claude/project-thread-3mnlhl`": the repo deletes branches on merge. Point at PR #242 instead.

