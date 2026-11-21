# Plan audit 8: hooks cover every pull request route

Spec: `docs/superpowers/specs/2026-11-21-hooks-cover-every-pr-route-design.md` at **39c3e62** (branch `claude/project-thread-j2umsk`; 39c3e62 answers audit 7). Read with it: plan audits 1 to 7, `.claude/hooks/rules.mjs`, `.claude/settings.json`, `.github/workflows/`, `tests/rules-merge-permission.test.ts`, and the owner's `owner-steps/cloud-setup-script.sh` in project files. Lane 3, plan audit, Opus 5.5 medium. Graphify was not used: the targets are one hook file, its settings and one test, read directly; the scripts the spec adds do not exist yet.

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## Verdict

**39c3e62 FAIL: 1 red, 3 notes.**

Audit 7's R1 is answered in substance: `MERGE_TOOLS_MATCHER` and the merge-tools entry stay, and `create_pull_request` gets its own blocking entry, with the cloud gap named as an owner step. But the answer took the recommended route without the one test edit that route needs, which audit 7's EXPECTED named: the existing test asserts the repo settings have exactly two PreToolUse entries, so a third entry fails it while criterion 17 still says nothing else in that test changes. Small and spec-only.

## How I checked

- `git diff ca66874 39c3e62`: only the spec and the live-state file changed.
- `tests/rules-merge-permission.test.ts` 232 to 242 (repo settings: `toHaveLength(2)` at 234, then the two entries' matchers), 192 to 221 (fail-closed cases), 306 and 336 to 358 (user settings from `--print-setup`: `toHaveLength(2)` at 346 and `MATCHER` at 350).
- `rules.mjs` 1413 (`MERGE_TOOLS_MATCHER`), 1451 to 1460 (the cloud block, keyed on `BM`), 1482 (`GUARDED`), 1507 (the launcher's early return, skipped for `GUARDED` tools), 1517, 1531, 1539 (`failClosed` for `GUARDED`).
- `.claude/settings.json`: two PreToolUse entries today.
- `owner-steps/cloud-setup-script.sh` 30 to 40: line 36 is `const BM = ...` and the block below it handles that one matcher.
- No test or install was run (no `node_modules`; the finding is a literal assertion). Nothing was pushed but this file.

## Audit 7 red, rechecked

| Audit 7 | Answer in 39c3e62 | Holds? |
|---|---|---|
| R1 widening the matcher breaks the pinned test and misses cloud | 3.3: separate `^mcp__github__create_pull_request$` entry, `MERGE_TOOLS_MATCHER` unchanged, cloud gap named; criterion 14 rewritten; criterion 17 says the pinned matcher stays valid; section 5 lists two owner steps | Partly. The matcher strings at 238 to 240, 306 and 350 do stay valid, and `--print-setup` output is unchanged, so 346 and 350 hold. The length assertion at 234 does not (R1 below). |

Audit 7 notes N1 to N5 are taken in and read correctly (two `env:` entries, pinned `setup-node`, the fetch-proving fixture, `onlyCleanMerges` in criterion 7, the broken sentence fixed).

## Red findings

### R1. A third PreToolUse entry fails the existing test that criterion 17 freezes

- UNIT: spec criterion 17 (and the U2 row, which holds criterion 17).
- VERDICT: red.
- REQUIREMENT: CLAUDE.md "A check is a test that fails by itself" (criteria 14 and 17 must pass together); `review` skill "A pull request that changes ... an existing test ... names each one and why"; audit 7 R1 EXPECTED ("criterion 17 then names a second test change (line 234 `toHaveLength(2)` becomes 3)").
- REASON: criterion 14 requires a third PreToolUse entry in `.claude/settings.json`; `tests/rules-merge-permission.test.ts` line 234 asserts that list has length 2, and criterion 17 says the test's only change is the stub's `user.login` and "Nothing else in it changes". Both cannot pass; the builder must either break criterion 17 or skip criterion 14.
- EVIDENCE: test 232 to 234: `test("a second PreToolUse entry blocks on failure and today's entry is unchanged", () => { const entries = settings.hooks.PreToolUse; expect(entries).toHaveLength(2);`. Spec 3.3 "gets its own, third PreToolUse entry"; criterion 17 "with one named change ... Nothing else in it changes".
- EXPECTED: criterion 17 names a second change: line 234's `toHaveLength(2)` becomes `toHaveLength(3)` (the first two entries still asserted as today, and the test's title may say "a second and a third"), and the reason (the separate create entry, audit 7 R1). Line 346 (user settings from `--print-setup`) stays at 2, since the installer is unchanged; the spec may say so, so the builder does not "fix" it too.
- FIX: edit criterion 17 (and, if wanted, the U2 row's check list). Files: the spec only.

## Notes (not blocking)

- N1. The second owner step is not "one line". `cloud-setup-script.sh` handles one blocking matcher (`BM`, line 36, and the filter block under it); adding a create entry means a second constant plus a second push into `hooks.PreToolUse`, or a matcher widened in that copy only. And a hand-edited script drifts from `--print-setup`, so the next regenerated script silently drops it. Say what the owner pastes: either the exact added lines, given as a ready file in project files, or (cleaner, in a later change) have `--print-setup` emit the create entry, which would then name the test edits at 346 and 350. Until then `pr-rules` covers create after the fact, as the spec says.
- N2. `GUARDED` gaining `create_pull_request` also turns off the launcher's early return at 1507 for create, so in a session that has both the user launcher and the repo's own settings, the create checks run twice (two read-only `gh` calls). Harmless; worth one line so the build does not treat the double run as a bug.
- N3. Live state again trails by one (names ca66874 while the head is 39c3e62). The rule reads the commit from `git rev-parse`; a file can't name the commit that contains it, so "last commit" here means the parent. Fine as is if that is the intended reading.

## What holds

- The guard on GitHub answers every route from audits 1 and 2; both triggers use `main`'s copy; the job condition, `env:` entries and permissions are exact; status and settings writes are refused at the client; section 5 says what only 3.7 guards.
- The separate create entry keeps every matcher string the existing test pins, and keeps `--print-setup` output unchanged, so the cloud setup tests at 336 to 440 hold as written.
- The PR-H / PR-R split still matches `ruleMix`, and PR-H merges first.
- Reds by round: 9, 8, 7, 4, 2, 2, 1, 1. This one is a one-line criterion edit; nothing in the design is open.

## Owner decisions this audit depends on

None new.
