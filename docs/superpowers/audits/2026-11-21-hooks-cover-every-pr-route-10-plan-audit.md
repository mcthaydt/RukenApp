# Plan audit 10: hooks cover every pull request route

Spec: `docs/superpowers/specs/2026-11-21-hooks-cover-every-pr-route-design.md` at **0e3d05b** (branch `claude/project-thread-j2umsk`; 0e3d05b answers audit 9). Read with it: plan audits 1 to 9, `.claude/hooks/rules.mjs` (wrapper peeling 233 to 275, `ghApi` path handling 350 and 391), `.claude/settings.json`, `.github/workflows/` (`ci.yml`, `commit-authors.yml`), `tests/rules-merge-permission.test.ts` (228 to 242). Lane 3, plan audit, Opus 5.5 medium. Graphify indexes RukenApp, but its graph is of `main` and the audited text is a spec on a branch plus one hook file read directly, so it was not queried.

## Verdict

**0e3d05b PASS: 0 red, 3 notes.**

Audit 9's red is answered by option (a), and the answer is consistent everywhere it has to be. The narrowed tripwire in 3.4 removes audit 9 N1's false refusals and opens no new route that `pr-rules` does not already catch. Nothing below blocks the build.

## How I checked

- `git diff 0c6c72b 0e3d05b`: only the spec (status line, 3.3, 3.4, 3.6, criterion 15, section 5, history) and the live-state file changed.
- Searched the whole spec for `owner step`, `second owner`, `replacement`, `--print-setup` and `cloud-setup`: 3.1 (one owner step), 3.3 (the Call), criterion 17 (346 stays 2), section 5 (one owner step), U5 (branch protection only) and the audit 7 history line all agree. No text still promises the cloud script file.
- Criterion 17 against the test: line 234 is the repo-settings `toHaveLength(2)`, 235 to 241 destructure and pin the first two entries, so a third appended entry passes once 234 says 3. Line 346 (`--print-setup`) stays 2 because neither the installer nor `MERGE_TOOLS_MATCHER` changes. Holds.
- 3.4 against the parser: `simpleCommands` already peels `sudo`, `nohup`, `time`, `command`, `exec`, `stdbuf`, `setsid`, `timeout`, `nice`, `env`, `xargs`, `npx` and others, and re-reads `bash -c`, `flock -c`, `script -c` and `eval`. So `gh` behind a peeled wrapper reaches the normal `gh` checks as a program; the narrowing does not create a blind spot the old "anywhere" wording covered, except the cases in N2.
- Bash checks match `gh` by parsed program word, not by raw text (only the MCP owner-commands check at 1187 matches text), so criterion 15's new allowed cases (`grep -n "gh pr create" CLAUDE.md`, `git commit -m "Refuse gh pr create through xargs"`) are achievable.
- No test or install was run (plan audit; the scripts the spec adds do not exist yet). Nothing was pushed but this file.

## Audit 9 findings, rechecked

| Audit 9 | Answer in 0e3d05b | Holds? |
|---|---|---|
| R1 owner step depends on a `--print-setup` change nothing builds | Option (a): 3.3 Call says the spec changes neither the cloud script nor `--print-setup`, cloud sessions stay not fail-closed on create, `pr-rules` judges after the fact, the `--print-setup` change is reported to the coordinator; section 5 lists one owner step | Yes. Stated plainly in 3.3; criterion 17, U2 and U5 need no change. |
| N1 "gh anywhere" refuses grep and commit messages | 3.4 names the contexts; criterion 15 adds two allowed cases | Yes, with N1 and N2 below. |
| N2 do not widen 3.6 to `branches/*` | One line in 3.6 | Yes. |
| N3 live state | Refreshed | Yes (names 0c6c72b, the parent, same reading as before). |

## Red findings

None.

## Notes (not blocking)

- **N1. The `api.github.com` text match has the same false-refusal shape audit 9 N1 found for `gh`.** 3.4 refuses a command whose text contains `api.github.com` with any program but `gh`. Read literally, that refuses `grep -n "api.github.com" .claude/hooks/rules.mjs` (lines 350 and 391 hold it) and `git commit -m "Refuse curl to api.github.com"`, which the builder of U3 will likely run; under 3.7 a session meeting a false refusal stops. Suggest: refuse it only when the program is a network client (`curl`, `wget`, `http`, `httpie`, `node`/`python`/etc. inline scripts already covered), or add to criterion 15 that `grep -n "api.github.com" x` and a commit message holding it are allowed. Builder can settle it inside U3.
- **N2. The context list in 3.4 reads as closed.** "`gh` run from another program's arguments (an `xargs`, `find -exec`, `parallel` or `env` argument, ...)" lists examples in brackets; a builder may implement exactly those. Programs that run their arguments and are neither peeled nor listed (for example `watch gh pr create ...`, `nohup`-style wrappers not in `simpleCommands`, `make`-free shells such as `zsh -c`/`dash -c`) would then pass the client unchecked. `pr-rules` still catches every pull request they create or change, and section 5 already accepts the client is not complete, so this is not a red. Suggest the builder treats the list as a floor, and adds `zsh`/`dash`/`fish` to the `-c` shells.
- **N3. `env` in the refused list is stricter than needed.** `simpleCommands` already peels `env` and judges the `gh` after it with all its arguments visible, so refusing `env GH_PAGER=cat gh pr view 5` refuses an honest read. The prefix form `GH_PAGER=cat gh ...` stays allowed, so the cost is small; dropping `env` from the list (keeping `xargs`, whose arguments come from stdin the hook cannot see) would avoid the false refusal.

## What holds

- The guard on GitHub (3.1) is unchanged since audit 9 and still answers every route from audits 1 and 2.
- The fail-closed gap for cloud sessions is now stated, not hidden: the hook still checks every create when `rules.json` reads, and `pr-rules` judges any create a crashed hook let through.
- One owner step, branch protection, in 3.1, section 5 and U5, and 3.6 lets it through.
- Reds by round: 9, 8, 7, 4, 2, 2, 1, 1, 1, 0.

## Owner decisions this audit depends on

None new. Section 7's three decisions are settled; 3.1's "close over-limit pull requests" stays a Call the owner can overrule.
