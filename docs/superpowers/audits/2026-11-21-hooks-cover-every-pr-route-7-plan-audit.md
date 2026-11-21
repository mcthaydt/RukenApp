# Plan audit 7: hooks cover every pull request route

Spec: `docs/superpowers/specs/2026-11-21-hooks-cover-every-pr-route-design.md` at **dee915f** (branch `claude/project-thread-j2umsk`; dee915f answers audit 6). Read with it: plan audits 1 to 6, `.claude/hooks/rules.mjs`, `.claude/hooks/rules.json`, `.claude/settings.json`, `.github/workflows/`, `tests/rules-merge-permission.test.ts`, CLAUDE.md, and this session's own `~/.claude/settings.json` (written by the owner's cloud setup script). Lane 3, plan audit, Opus 5.5 medium. Graphify was not used: the targets are one hook file, its settings and one test, all read directly, and the scripts the spec adds do not exist yet.

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## Verdict

**dee915f FAIL: 1 red, 5 notes.**

Both reds of audit 6 are answered and hold. One new gap, of the same kind as audit 6 R1 and found the same way (reading criterion 17 against the existing test): criterion 14 and 3.3 widen the fail-closed matcher to `create_pull_request`, which breaks two assertions in `tests/rules-merge-permission.test.ts` that criterion 17 says stay unchanged, and the spec misses that cloud sessions take that matcher from the owner's environment setup script, not from the repo.

## How I checked

- `git diff 619628e dee915f`: only the spec changed (and the live-state file).
- `rules.mjs` 887 to 923 (`verdicts`, `onlyCleanMerges`: git-only, uses `origin/<default>`), 982 to 1013 (`checkReviewed`), 1404 to 1480 (the installer and `--print-setup`, `MERGE_TOOLS_MATCHER` at 1413, the cloud blocking entry built from it at 1452 to 1460), 1482 (`GUARDED`).
- `tests/rules-merge-permission.test.ts` 33 to 44 (stub: paths matched by regex, so paged reads still hit it), 51 (`cpSync` of `.claude/hooks`), 232 to 242 (settings matcher asserted exactly), 306 (`MATCHER` constant), 336 to 358 (cloud setup script output asserted against `MATCHER`).
- `.claude/hooks/rules.json`: `lanePaths["3"]` holds `.claude/**` (line 79); `ruleMix.rulePaths` does not hold `.claude/hooks/**`, so PR-H (hooks plus tests) passes `ruleMix`, and PR-R (workflows plus CLAUDE.md) is rules only.
- `~/.claude/settings.json` in this cloud session: the blocking entry's matcher is the three-tool string (line 31); `/mnt/project-files/owner-steps/cloud-setup-script.sh` line 36 hard-codes the same `BM`.
- `actions/checkout` with `fetch-depth: 0` fetches every branch to `refs/remotes/origin/*`, so `origin/main`, which `onlyCleanMerges` names, exists in the `pr-rules` checkout; the repo is public, so the anonymous fetch of `refs/pull/<n>/head` works with `persist-credentials: false`.
- No test or install was run (no `node_modules` here, and the finding is a literal string comparison); nothing was pushed to GitHub but this file.

## Audit 6 reds, rechecked

| Audit 6 | Answer in dee915f | Holds? |
|---|---|---|
| R1 library outside the test's scratch copy | Both scripts under `.claude/hooks/`; 3.1, section 5, criteria 6b and 7 updated | Yes: line 51 copies the whole folder, and a relative `./pr-rules-lib.mjs` import resolves from the module's own path, in the scratch, the cloud launcher (`*/.claude/hooks/rules.mjs`) and Actions alike. Lane 3 by `.claude/**`. |
| R2 clean merge in `pr-rules` | 3.1: `fetch-depth: 0`, the script fetches `refs/pull/<n>/head` as data, shared `onlyCleanMerges`; criterion 5 gains the clean-merge-keeps case with a real git fixture | Yes in design (`origin/main` and both commits are present; a failed fetch is a `failure` status). See N2 for making the test prove the fetch. |

Audit 6 notes N1 to N4 are taken in.

## Red findings

### R1. Widening the fail-closed matcher breaks the existing test that criterion 17 freezes, and misses the cloud sessions' copy

- UNIT: spec 3.3 "Fail closed" (`create_pull_request` joins `GUARDED` and `MERGE_TOOLS_MATCHER` ... and the fail-closed entry in `.claude/settings.json`), criteria 14 and 17, section 5 "One owner step".
- VERDICT: red.
- REQUIREMENT: CLAUDE.md "A check is a test that fails by itself" (the criteria must be passable together); review skill "A pull request that changes ... an existing test ... names each one and why"; CLAUDE.md "Report honestly" (the spec's one owner step must be the whole list).
- REASON: two assertions in the existing test pin today's three-tool matcher, so criterion 14 cannot pass alongside criterion 17's "Nothing else in it changes". And `MERGE_TOOLS_MATCHER` is also what `--print-setup` writes into user settings, which is the only place a cloud session (every session in this project) reads its blocking entry; the owner's environment setup script holds a copy, so the new fail-closed entry never reaches cloud sessions until the owner pastes a new script, a second owner step the spec does not name. A rerun of the new script over the old user settings also keeps the old entry (it removes a blocking hook only from an entry whose matcher equals the new `BM`), leaving two blocking entries.
- EVIDENCE: test 238 to 240 `expect(second.matcher).toBe("^mcp__github__(merge_pull_request|disable_pr_auto_merge|update_pull_request)$")`; test 306 `MATCHER` with the same string, asserted at 350 (`block?.matcher`); `rules.mjs` 1413 and 1452 to 1460 (the cloud entry is built from `MERGE_TOOLS_MATCHER`, and old entries are filtered only where `e.matcher === BM`); this session's `~/.claude/settings.json` line 31 and `owner-steps/cloud-setup-script.sh` line 36 (three-tool matcher).
- EXPECTED: the spec chooses one and says it. Recommended: leave `MERGE_TOOLS_MATCHER` and the cloud entry alone, and give `create_pull_request` its own entry: `GUARDED` gains it, and `.claude/settings.json` gets a third PreToolUse entry `^mcp__github__create_pull_request$` with `onFailure: "block"`; criterion 17 then names a second test change (line 234 `toHaveLength(2)` becomes 3, the first two entries asserted as today), and section 5 says plainly that cloud sessions are not fail-closed on create until the setup script carries it, which `pr-rules` covers after the fact. The other choice: widen `MERGE_TOOLS_MATCHER` as written, criterion 17 names the edits at 238 to 240 and 306 (used at 350), the installer also drops a blocking entry whose matcher is the old string, and section 5 adds a second owner step (paste the new `node .claude/hooks/rules.mjs --print-setup` output into the environment's setup script) with a criterion that the printed script carries `create_pull_request`.
- FIX: edit 3.3's "Fail closed" item, criteria 14 and 17, section 5 (owner steps), and the U2 row of section 6. Files: the spec only.

## Notes (not blocking)

- N1. Token for the script. 3.1 says the script gets "only the pull request number passed in through `env:`", but writing a status, a comment and a close needs a token (`gh` reads `GH_TOKEN`). Say that `GH_TOKEN: ${{ github.token }}` is the one other `env:` entry, so the build is not read as a deviation; criterion 6's grep already allows it (it is not `github.event` and not in `run:`).
- N2. Make criterion 5 prove the fetch. As written, the clean-merge case passes if the fixture's commits are already in the script's working folder, so a build that never fetches passes too and breaks on GitHub. Say the fixture is the script's `origin`, with the branch reachable only at `refs/pull/<n>/head`, and that a fetch failure gives a `failure` status (a second case).
- N3. Criterion 7 lists lane, criteria, verdict and own-branch count, but 3.1 now also moves `onlyCleanMerges` into the library; add it to the imports the test checks.
- N4. Runner Node. The workflow installs nothing, so the script runs on the runner image's own Node, not `.nvmrc`'s 24, while `ci.yml` uses `actions/setup-node`. Today's `rules.mjs` uses nothing newer than Node 20, so it works; either add the pinned `setup-node` step (it installs no package, so criterion 6 allows it) or say the library stays Node 20-safe.
- N5. Wording: 3.1 has a broken sentence ("never `success` (audit 6 N1). and runs `node .claude/hooks/pr-rules.mjs`"); the live-state file names 619628e while the head is dee915f (it trails by one, as before).

## What holds

- The guard on GitHub still answers every route from audits 1 and 2; both triggers use `main`'s copy; the job condition and `env:` number are exact; status and settings writes are refused at the client; section 5 says what only 3.7 guards.
- Both scripts now sit where the hook's tests, the cloud launcher and the lane rules already reach, and the hook and `pr-rules` share one `verdicts` (owner-only) and one `onlyCleanMerges`, judged on the same commits.
- The PR-H / PR-R split still matches `ruleMix`, and PR-H merges first.

## Owner decisions this audit depends on

None new. R1's other choice would add an owner step (pasting a new setup script); the recommended fix avoids it.
