# Plan audit 2: hooks cover every pull request route

Spec: `docs/superpowers/specs/2026-11-21-hooks-cover-every-pr-route-design.md` at **ae8bfa9** (branch `claude/project-thread-j2umsk`; the coordinator moved the audit from 3afa214 to ae8bfa9, which only records the owner's 3.5 answer). Read with it: plan audit 1 (`2026-11-21-hooks-cover-every-pr-route-1-plan-audit.md`), `.claude/hooks/rules.mjs`, `.claude/hooks/rules.json`, `.claude/settings.json`, `.github/workflows/commit-authors.yml`, `tests/rules-merge-permission.test.ts`, CLAUDE.md. Lane 3, plan audit, Opus 5.5 medium.

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## Verdict

**ae8bfa9 FAIL: 8 red, 5 notes.**

Every round 1 finding is answered in the text: R1 and R3 to R6 in 3.1 and 3.2, R7 in 3.3, R8 in 3.6, R2 and R9 in 3.8 and section 5, N5 by the owner's 14:48 UTC answer. Both owner decisions are settled, and the plan's units, files and pull request split hold together. But the spec still claims more than it delivers: section 2 says every route the hook can read meets the same checks and every route it cannot read is "refused where that is cheap" or "named in section 5". The probes below found readable routes that 3.1 to 3.8 do not cover (the Issues API, query strings on `pulls/<n>`, `--input=`, `gh pr revert`, two GraphQL mutations), unreadable routes that section 5 does not name (shell functions, a variable as the program, `xargs`, `find -exec`, an interpreter's inline script), a body file the hook judges before the same command rewrites it, a fail-closed claim the change does not make true, and an acceptance criterion that can only be met by routing around a hook.

## How I checked

A scratch copy of `.claude/` and CLAUDE.md at ae8bfa9 in a scratch git repo, a stub `gh` (a fake GitHub) that answers 3 open pull requests (2 where stated), `private: false`, and pull request 999 as lane 3 with no review. The real hook was fed PreToolUse Bash inputs, as `tests/rules-merge-permission.test.ts` does. "Allowed" means the hook printed no deny. Each probe is what the hook does **today**; the finding says whether the spec as written changes the answer.

| Probe | Command | Today | After the spec |
|---|---|---|---|
| B1 | `gh pr create --draft --title x --body-file good.md` (3 open) | refused: open limit | refused |
| B2 | `gh pr create --draft --title x --body bad` | refused: body rule | refused |
| S1 | `f(){ gh "$@"; }; f pr create --draft --title x --body bad` | **allowed** | not covered, not named |
| S2 | `G=gh; $G pr create --draft --title x --body bad` | **allowed** | not covered, not named |
| S3 | `echo pr create --draft --title x --body bad \| xargs gh` | **allowed** | not covered, not named |
| S4 | `python3 -c 'import subprocess;subprocess.run(["gh","pr","create",...,"--body","bad"])'` | **allowed** | not covered, not named |
| S5 | `find . -maxdepth 0 -exec gh pr create --draft --title x --body bad \;` | **allowed** | not covered, not named |
| U1 | `U=https://api.github.com; curl -X POST $U/repos/mcthaydt/RukenApp/pulls -d @bad.json` | **allowed** | 3.8's URL match does not see a URL built from a variable |
| I1 | `gh api -X PATCH repos/mcthaydt/RukenApp/issues/5 -f body=bad` | **allowed** | not covered |
| I1b | the same on `pulls/5` | refused: body rule | refused |
| I2 | `gh api -X PATCH repos/mcthaydt/RukenApp/issues/5 -f state=open` (3 open) | **allowed** | not covered |
| Q1 | `gh api -X PATCH 'repos/mcthaydt/RukenApp/pulls/5?x=1' -f body=bad` | **allowed** | 3.1 normalises only the list path |
| Q2 | `gh api -X PATCH repos/mcthaydt/RukenApp/pulls/5/ -f body=bad` | **allowed** | same |
| Q3 | `gh api -X PUT repos/mcthaydt/RukenApp/pulls/999/merge -f merge_method=merge` | refused: no passing review | refused |
| Q4 | the same on `pulls/999/merge?x=1` | **allowed** | not covered |
| N1 | `gh api -X PATCH .../pulls/5 --input bad.json` | refused: body rule | refused |
| N2 | `gh api -X PATCH .../pulls/5 --input=bad.json` | **allowed** | 3.1 lists field spellings, not `--input=` |
| T0 | `printf '...' > c.md && gh pr create --draft --body-file c.md` (c.md new, 2 open) | allowed | refused by 3.2 (file does not exist yet) |
| T1 | `printf 'no lane\n...' > b.md && gh pr create --draft --body-file b.md` (b.md already holds a good body, 2 open) | **allowed** | not covered: the old b.md is judged |
| T2 | `printf 'no lane, no last line\n' > b.md && gh api .../pulls -F draft=true ... -F body=@b.md` (same) | **allowed** | not covered |
| V1 | `gh pr revert 5` (gh 2.89.0 has it; it opens a new pull request) | **allowed** | not covered |
| V2 | `gh api graphql -f query='mutation{revertPullRequest(...)}'` | **allowed** | not in 3.8's list |
| V3 | `gh api graphql -f query='mutation{enqueuePullRequest(...)}'` | **allowed** | not in 3.8's list |
| C20 | `gh pr edit 5 --body-file f` where f has a `🤖 Generated with` line | refused: body rule | refused (and must stay refused) |

Not run against real GitHub (no writes outside the repo): that GitHub accepts a trailing slash on `pulls/<n>/` (Q2), and whether `gh issue edit` accepts a pull request number. The Issues API editing a pull request's body and state (I1, I2) is GitHub's documented behaviour: every pull request is an issue. A query string is ignored by the REST API.

## Red findings

### R1. Shell indirection reaches `gh` and `curl` with no check, and section 5 does not name it

- UNIT: spec section 2, 3.8 (outside gh), section 5 ("Routes the hook does not see"); `rules.mjs` `simpleCommands` (line 235).
- VERDICT: red.
- REQUIREMENT: section 2, "Routes it cannot read are refused where that is cheap, and the rest are named in section 5"; plan audit 1 R9.
- REASON: the hook judges a command only when its program word is `gh`. A shell function, a variable as the program, `xargs gh`, `find -exec gh` and an interpreter's inline script all run `gh pr create` with no check; 3.8's `api.github.com` match misses a URL built from a variable. Section 5 names only scripts in files, extensions and old aliases.
- EVIDENCE: probes S1 to S5 and U1, all allowed with 3 open and a body without the last line.
- EXPECTED: the cheap ones refused; the rest named in section 5 so 3.7 governs them by name.
- FIX: in 3.8, refuse a Bash command in which the word `gh` appears anywhere but a program position (an `xargs`/`find -exec`/`parallel` argument, inside a `-c`/`-e` inline script of `python`/`node`/`perl`/`ruby`), a function definition whose body runs `gh`, and a command whose program word is a variable expansion; widen the outside-gh rule to any word naming `api.github.com` together with `pulls` or `graphql` anywhere in the same command. Name in section 5 what is still unseen (a URL assembled from several variables, a script file). One criterion per refusal. Files: the spec (3.8, section 5, section 4), later `rules.mjs` and the test file.

### R2. The Issues API edits a pull request's body and state

- UNIT: spec 3.1 (reopen), 3.2, 3.4; `rules.mjs` `checkPrBodyBash` (line 860), `checkPrFlowBash`.
- VERDICT: red.
- REQUIREMENT: section 2, every route the hook can read that "reopens or edits a pull request meets the same checks".
- REASON: `PATCH repos/<o>/<r>/issues/<n>` with `body` or `state=open` changes a pull request (a pull request is an issue). The hook matches only `pulls` paths, and the spec does not mention issues paths, so a body without the last line and a reopen past the limit both pass, and the PostToolUse body check never runs.
- EVIDENCE: probes I1 (allowed) against I1b (refused); I2 allowed with 3 open.
- EXPECTED: an issues-path write of `body` or `state` on a pull request number is judged as the `pulls/<n>` write is.
- FIX: in 3.1 and 3.2, a non-GET `gh api` on `repos/<o>/<r>/issues/<n>` with `body`, `title` or `state` reads `pulls/<n>`; when it is a pull request (or the read fails), it is judged as a pull request edit or reopen. Same for `gh issue edit|reopen|close` with a number. A criterion for the body case and the reopen case. Files: the spec, later `rules.mjs` and the test file.

### R3. Path and flag forms still skip the checks on `pulls/<n>` and `--input=`

- UNIT: spec 3.1 (Path, Field forms); `rules.mjs` `ghApi` (line 377), `checkPrBodyBash` (`/pulls(\/\d+)?$/`), `checkPrFlowBash` (the merge regex anchored with `$`).
- VERDICT: red.
- REQUIREMENT: section 2; plan audit 1 N3 ("make sure `pulls/` and `pulls?...` are treated the same, or a trailing slash is a way past it").
- REASON: 3.1 normalises only the list path `pulls`. A query string or trailing slash on `pulls/<n>` skips the body check and, on `pulls/<n>/merge`, skips the review and green checks. `--input=<file>` (with `=`) is not read, so its body and fields are never seen.
- EVIDENCE: probes Q1, Q2, Q4, N2 allowed; Q3 and N1, the same calls without the extra characters, refused.
- EXPECTED: one path normaliser (strip `?…` and trailing `/`) used by every pulls match in the hook, and `--input=` read like `--input`.
- FIX: 3.1 says every pulls path the hook matches (list, `pulls/<n>`, `/merge`, `/ccr/...`) is normalised first, and `--input=` joins the forms list; criteria 1, 7 and a merge case gain the query and slash variants and `--input=`. Files: the spec, later `rules.mjs` and the test file.

### R4. A body file rewritten in the same command is judged by its old contents

- UNIT: spec 3.2; `rules.mjs` `ghBody` (line 1066), `ghApi` `@file` read.
- VERDICT: red.
- REQUIREMENT: section 2 (lane and criteria on every create); 3.2's own instruction, "write it in its own call first".
- REASON: the hook reads the file before the command runs. When the file already exists, a command that rewrites it and then creates the pull request is judged on the old text. 3.2 refuses only a file that does not exist yet. The PostToolUse check judges only the last line and attribution, never lane or criteria.
- EVIDENCE: probes T1 and T2 allowed (2 open, b.md holding a good body, the command writing one with no lane); T0 (new file) is the only case 3.2 covers.
- EXPECTED: a create or edit whose body file (or `--input` file) is written earlier in the same Bash command is refused with 3.2's message, whether the file exists or not.
- FIX: in 3.2, refuse when any earlier simple command in the same call writes that path (a `>`/`>>` redirect, `tee`, `cp`/`mv`/`install` to it, `sed -i` on it); criterion 7 gains the existing-file case. Files: the spec, later `rules.mjs` and the test file.

### R5. `gh pr revert` and two GraphQL mutations are missing

- UNIT: spec 3.1 (Create), 3.8 (GraphQL).
- VERDICT: red.
- REQUIREMENT: section 2; CLAUDE.md Settings, "Pull requests open: 3".
- REASON: `gh pr revert` (present in gh 2.89.0 here) opens a new pull request with a body of its own, and GraphQL `revertPullRequest` does the same; `enqueuePullRequest` merges through a merge queue. None is in the spec. A list of names to refuse will keep missing new ones.
- EVIDENCE: probes V1, V2, V3 allowed with 3 open.
- EXPECTED: refused, with the `gh pr create` or `gh pr merge` command to use instead.
- FIX: refuse `gh pr revert`; in 3.8, refuse any GraphQL mutation whose text names `PullRequest` (case-insensitive) or `mergeQueue`, instead of a fixed list; criterion 12 gains `revertPullRequest`, `enqueuePullRequest` and `gh pr revert`. Files: the spec, later `rules.mjs` and the test file.

### R6. Adding `create_pull_request` to `settings.json` does not make it fail closed

- UNIT: spec 3.8 (Fail closed) and criterion 17; `rules.mjs` `GUARDED` (line 1482), `MERGE_TOOLS_MATCHER` used by `installJs` (line 1415).
- VERDICT: red.
- REQUIREMENT: 3.8, "so a create through the MCP tool is blocked if the hook cannot run"; plan audit 1 N4 (the case named was the hook crashing).
- REASON: `onFailure: block` acts only when the hook process fails. When the hook crashes or finds no config, `main` exits 0 with a system message unless the tool matches `GUARDED` (lines 1517, 1531, 1539), so the create goes through. The user-level hooks written by the setup script take their matcher from `MERGE_TOOLS_MATCHER` in `rules.mjs` itself, which PR-H may change, not only from the owner's script.
- EVIDENCE: lines 1482 and 1537 to 1540 (crash path emits a system message and exits 0 for any tool not in `GUARDED`); criterion 17 reads only `settings.json`.
- EXPECTED: a hook crash or missing config on `create_pull_request` blocks the call.
- FIX: 3.8 adds `create_pull_request` to `GUARDED` and to `MERGE_TOOLS_MATCHER`/the allow list `installJs` writes (or says why not); criterion 17 adds a case that makes the hook crash (an unreadable `rules.json`) and expects exit 1 for `mcp__github__create_pull_request`. Files: the spec, later `rules.mjs`, `settings.json` and the test file.

### R7. Criterion 20 can only be met by routing around a hook

- UNIT: spec criterion 20.
- VERDICT: red.
- REQUIREMENT: 3.7 (never route around a hook); the owner's 14:41 UTC rule.
- REASON: criterion 20 asks for "a one-time edit adding a `🤖 Generated with` line" to PR-R's body. Every checked body route refuses that edit, before and after this change, so the only ways to make it are the unchecked routes this spec exists to close.
- EVIDENCE: probe C20 refused; the MCP route runs the same `judgeBody(..., false)` (line 1173).
- EXPECTED: no criterion requires a write a hook refuses.
- FIX: criterion 20 keeps only the passing run on PR-R's real body (the proxy footer present) and its link; the failing cases stay in criterion 11 (the workflow step against a stub). Files: the spec.

### R8. Commands handed over in an attached file are never read

- UNIT: spec 3.6, section 2 ("A session no longer hands the owner a pull request write it could run itself").
- VERDICT: red.
- REQUIREMENT: section 2.
- REASON: 3.6 reads strings inside the call's input. Commands for the owner are often written to a file under `/mnt/project-files/owner-steps/` and attached through `attached_outputs`; the file's text is never read, and the Write check skips paths outside the repo (`checkFileWrite`, `rel.startsWith('..')`).
- EVIDENCE: `rules.mjs` line 1121; the project's own `owner-steps/` folder holds handed-over commands.
- EXPECTED: a pull request write is refused whichever way it reaches the owner, or the spec names the gap.
- FIX: 3.6 also reads the text of each `attached_outputs` entry of kind `file` (a local path, size-bounded) with the same checks; one criterion with a fenced `gh pr edit` in an attached `.md`. If not, section 5 names attached files as unseen. Files: the spec, later `rules.mjs` and the test file.

## Notes (not blocking)

- N1. `head` may be `owner:branch` (`-f head=mcthaydt:claude/x`). 3.1 diffs `origin/<head>`, which then fails and counts as code: safe, but a docs-only branch would be asked for acceptance criteria. Strip an `owner:` prefix that names this repo's owner.
- N2. Deny-lists of routes keep growing (round 1 found 9, round 2 found 8 more). Consider a detective check beside them: after any Bash or MCP call whose text names `gh`, `github` or `pulls`, PostToolUse reads the open count and blocks with "the open pull request limit is now exceeded: close the one you just opened" when it is over 3. It catches every route, read or not, after the fact.
- N3. 3.6 reads fenced blocks and inline code only; a command written as plain prose is not read. Fine as a call, but say so in 3.6.
- N4. 3.2 leaves an unresolvable body on an edit to the PostToolUse check, which judges the last line and attribution only. Lane and criteria are judged at create and ready, so this is consistent; worth one sentence in 3.2 so the builder does not add lane checks to edits.
- N5. The live-state file on the branch names 3afa214 as the last commit while the head is ae8bfa9; the next writer should refresh it.

## Owner decisions this audit depends on

None open. 3.3 (exact proxy footer, 14:43 UTC) and 3.5 (every pull request counts, 14:48 UTC) are decided and the spec reflects both.
