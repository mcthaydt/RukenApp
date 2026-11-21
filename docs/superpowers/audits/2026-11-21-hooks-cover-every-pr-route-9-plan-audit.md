# Plan audit 9: hooks cover every pull request route

Spec: `docs/superpowers/specs/2026-11-21-hooks-cover-every-pr-route-design.md` at **b7191cd** (branch `claude/project-thread-j2umsk`; b7191cd answers audit 8). Read with it: plan audits 1 to 8, `.claude/hooks/rules.mjs`, `.claude/hooks/rules.json`, `.claude/settings.json`, `.github/workflows/`, `tests/rules-merge-permission.test.ts`, and the owner's `owner-steps/cloud-setup-script.sh` in project files. Lane 3, plan audit, Opus 5.5 medium. Graphify was not used: the targets are one hook file, its settings, one test and one owner script, read directly; the scripts the spec adds do not exist yet.

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## Verdict

**b7191cd FAIL: 1 red, 3 notes.**

Audit 8's R1 is answered and holds. The new red is in the text that took in audit 8's N1: the second owner step now depends on `--print-setup` emitting the create entry, but criterion 17 freezes `--print-setup`'s output at today's two PreToolUse entries and no unit makes it emit a third. As written, the builder cannot produce the owner's file in this change, and section 5 lists an owner step nothing delivers. Spec-only, one paragraph.

## How I checked

- `git diff e3ef34a b7191cd`: only the spec (3.3, criterion 17, section 5, history) and the live-state file changed.
- `tests/rules-merge-permission.test.ts` 232 to 242 (repo settings: `toHaveLength(2)` at 234, matchers at 236 to 241), 306 (`MATCHER`), 336 to 358 (user settings from `--print-setup`: `toHaveLength(2)` at 346, `PreToolUse[1]` matcher `MATCHER` at 349 to 350).
- `.claude/settings.json`: two PreToolUse entries today, the second the three-tool blocking entry, as the test pins.
- `rules.mjs` 1407 to 1460 (installer and `--print-setup`; the blocking entry built from `MERGE_TOOLS_MATCHER` at 1452), 1482 (`GUARDED`), 1507, 1517, 1531, 1539.
- `owner-steps/cloud-setup-script.sh`: line 36 is `const BM = ...` (the spec's line reference is right); lines 37 to 44 filter and push only that one matcher. No replacement file exists in `owner-steps/` yet (the commit message says "ready setup file for the owner"; the spec defers it to the builder, which is fine on its own).
- `rules.json` 175 to 178: `ownerCommands.tools` is `[]` (F6 still accurate).
- No test or install was run (no `node_modules`; the finding is a reading of the spec against literal assertions). Nothing was pushed but this file.

## Audit 8 red, rechecked

| Audit 8 | Answer in b7191cd | Holds? |
|---|---|---|
| R1 third PreToolUse entry fails line 234 | Criterion 17 names line 234 `toHaveLength(2)` becoming 3, and says line 346 stays 2 | Yes. Line 234 is the repo-settings length; the destructured `[first, second]` at 235 and the matcher checks at 236 to 241 still pass with a third entry appended. Line 346 is the `--print-setup` length, unchanged while the installer is unchanged. |

Audit 8 N2 (double create check) and N3 (live state) are taken in. N1 is taken in, but see R1.

## Red findings

### R1. The second owner step depends on a `--print-setup` change that criterion 17 rules out and no unit builds

- UNIT: spec 3.3 "Fail closed", section 5 "Two owner steps", criterion 17, section 6 (no unit for the second owner step).
- VERDICT: red.
- REQUIREMENT: CLAUDE.md "A check is a test that fails by itself" (criteria and deliverables must be achievable together); CLAUDE.md "Report honestly" (section 5's owner steps must be ones this change delivers); `build` skill (every deliverable has a criterion).
- REASON: 3.3 says the builder gives the owner a replacement setup script "regenerated from the hook's `--print-setup` once it emits the create entry". Nothing in the spec makes `--print-setup` emit it: `MERGE_TOOLS_MATCHER` "stay[s] as [it is]", criterion 17 says line 346 (`--print-setup` output) "stays at 2", and no unit or criterion covers an installer change. So the condition never comes true in this change, the owner's file is never made, and cloud sessions (every session in this project) stay not fail-closed on create while section 5 counts the fix as a delivered owner step. A builder reading it either skips the file (spec says it is delivered) or changes the installer (breaking criterion 17's 346 and the `PreToolUse[1]` pin at 349 to 350).
- EVIDENCE: spec 3.3 "regenerated from the hook's `--print-setup` once it emits the create entry"; criterion 17 "line 346 (the `--print-setup` output) stays at 2"; test 346 `expect(s.hooks.PreToolUse).toHaveLength(2)`; `rules.mjs` 1452 and `cloud-setup-script.sh` 36 to 44 (one blocking matcher, `BM`, and the filter keyed on it); section 6 has no unit and section 4 no criterion for the owner file.
- EXPECTED: one of two, stated plainly.
  - (a, smallest, recommended) Defer it: 3.3 says cloud sessions stay not fail-closed on create after this change (`pr-rules` judges every create after the fact, and the hook still checks create when `rules.json` reads), and that making `--print-setup` emit the create entry is a later change; section 5 lists one owner step, plus a follow-up line.
  - (b) Build it in PR-H: U2 makes `--print-setup` emit a second blocking entry (its own constant, its own filter so a re-run neither duplicates nor leaves a stale entry), criterion 14 or a new one checks it on a fresh run and a re-run, criterion 17 names the further edits (346 becomes 3, the block lookup at 349 to 350 by matcher rather than index, the re-run cases), and the builder writes the replacement file from the new `--print-setup` with its install command.
- FIX: edit 3.3, section 5 and, for (b), criteria 14 and 17 and the U2 row. Files: the spec only.

## Notes (not blocking)

- N1. 3.4 refuses a command with "`gh` anywhere but a program position". Read literally, that refuses `grep -n "gh pr create" .claude/hooks/rules.mjs`, `git commit -m "hook: check gh api creates"` and `rg 'gh api' tests/`, which the builder of this very change will run; under the 3.7 rule a session that meets a false refusal stops. Audit 2's FIX named the narrower contexts (an `xargs`/`find -exec`/`parallel` argument, a `-c`/`-e` inline script of `python`/`node`/`perl`/`ruby`, a function body). Suggest 3.4 names those contexts instead of "anywhere", and criterion 15 adds allowed cases: `grep -n "gh pr create" x`, `git commit -m "gh api fix"`.
- N2. 3.6 refuses pull request writes in fenced blocks sent to the owner. The second owner step (whichever form R1 takes) and the branch protection command are not pull request writes, so they pass; worth one line in 3.6 so the builder does not widen the pattern to `gh api` on `branches/*`.
- N3. Live state names e3ef34a as last commit while the head is b7191cd; same reading as audit 8 N3 (the parent), fine.

## What holds

- The guard on GitHub (3.1) still answers every route from audits 1 and 2; triggers, job condition, `env:`, permissions, checkout pin and status writing are exact and checked by criteria 6 and 6a.
- The separate create entry keeps every matcher string the existing test pins; with criterion 17's edit, line 234 passes and 346 and 350 are untouched.
- Status and settings writes are refused at the client (3.4, 15a); section 5 names what only the 3.7 rule guards.
- The PR-H / PR-R split matches `ruleMix`; PR-H merges first.
- Reds by round: 9, 8, 7, 4, 2, 2, 1, 1, 1. This one is a paragraph; nothing in the design itself is open.

## Owner decisions this audit depends on

None new. Option (a) or (b) in R1 is the spec author's call inside the brief; (a) needs no owner step at all.
