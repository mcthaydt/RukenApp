# Plan audit 1: hooks cover every pull request route

Spec: `docs/superpowers/specs/2026-11-21-hooks-cover-every-pr-route-design.md` at **40631f9** (branch `claude/project-thread-j2umsk`). Read with it: `.claude/hooks/rules.mjs`, `.claude/hooks/rules.json`, `.claude/settings.json`, `.github/workflows/commit-authors.yml`, `tests/rules-merge-permission.test.ts`, CLAUDE.md. Lane 3, plan audit, Opus 5.5 medium.

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## Verdict

**40631f9 FAIL: 9 red, 7 notes.**

The diagnosis (F1 to F7) is right and each finding I re-ran holds. The fix is not yet closed: several ways to open or edit a pull request still pass the hook after the change as written, two of them through the very `gh api` route 3.1 sets out to cover. The spec's claim in section 2, "whichever tool a session uses, opening a pull request meets the same checks", is not met by the plan.

## How I checked

A scratch copy of `.claude/` and CLAUDE.md at 40631f9, a stub `gh` that answers 3 open pull requests and `private: false`, and the real hook fed PreToolUse inputs (same method as `tests/rules-merge-permission.test.ts`). "Allowed" below means the hook printed nothing and exited 0. Probes, with what they showed today:

| Probe | Command or tool | Today |
|---|---|---|
| A | `gh api repos/mcthaydt/RukenApp/pulls -f title=x -f head=b -f base=main -F draft=true -f body=<good>` | allowed with 3 open (confirms F1) |
| A2 | `gh pr create --draft --title x --body <good>` | refused: 3 open (confirms F2) |
| A-bad | `gh api .../pulls -f title=x -f body=nolastline` | refused: body rule |
| B-bad | `gh api .../pulls --raw-field=body=nolastline` | **allowed** |
| H-bad | `gh api .../pulls -fbody=nolastline` | **allowed** |
| C | `gh api graphql -f query='mutation { createPullRequest(...) }'` | allowed |
| C2 | `gh api graphql -f query='mutation { mergePullRequest(...) }'` | allowed |
| D, D2, E | `gh pr reopen 5`; `gh api -X PATCH .../pulls/5 -f state=open`; `mcp__github__update_pull_request` with `state: "open"` | allowed with 3 open |
| F | `curl -X POST ... https://api.github.com/repos/mcthaydt/RukenApp/pulls -d @b.json` | allowed |
| G | `gh pr edit 5 --base other` | allowed (the MCP route refuses a base change) |
| I | `gh api .../pulls -f body="$(cat b.md)"` | allowed, no lane or criteria check |
| J | `gh alias set pc 'pr create' && gh pc --title x --body nolast` | allowed |
| K | `cat b.json \| gh api .../pulls --input -` | allowed, no body seen |
| OC | `ownerCommands.tools` set as 3.6 says; `request_decision` with a fenced `git push` inside `options` | allowed; the same text in `post_message` is refused |

## Red findings

### R1. The `=` and joined forms of `gh api` fields skip the create check

- UNIT: `rules.mjs` `ghApi` (line 388, line 406); spec 3.1.
- VERDICT: red.
- REQUIREMENT: spec section 2 and 3.1, every create route meets the same checks.
- REASON: `ghApi` reads a field only as `-f k=v` with a space. `--raw-field=k=v`, `--field=k=v`, `-fk=v` and `-Fk=v` (all valid for gh) are not read, so no fields are seen and the method is inferred as GET. 3.1 runs only for a non-GET call, so these creates skip it entirely, and today they already skip the body check.
- EVIDENCE: probes B-bad and H-bad allowed while A-bad is refused.
- EXPECTED: the four spellings give the same answer as `-f k=v`; a call with any field and no `-X` is a POST, as gh treats it.
- FIX: in `ghApi`, read `--field=`, `--raw-field=` and joined `-f`/`-F` forms; add them to criterion 1 and to criterion 4's body case. Files: `rules.mjs`, `tests/rules-pr-routes.test.ts`, the spec's 3.1 and section 4.

### R2. GraphQL mutations are not a covered route

- UNIT: spec 3.1 and section 4; `rules.mjs` `checkPrFlowBash`, `checkPrBodyBash`.
- VERDICT: red.
- REQUIREMENT: section 2; 3.7 ("Every pull request create and edit goes through a route the hooks check").
- REASON: `gh api graphql` with `createPullRequest`, `updatePullRequest` (body), `reopenPullRequest`, `markPullRequestReadyForReview` or `mergePullRequest` reaches none of the create, body, ready or merge checks. The spec does not mention GraphQL.
- EVIDENCE: probes C and C2 allowed with 3 open and a body without the last line.
- EXPECTED: refused, with the REST or `gh pr` command to use instead.
- FIX: refuse a `gh api graphql` call whose query (from `-f query=`, `-F query=@file`, or `--input`) names any of those mutations; add a criterion per mutation family (create, body, ready, merge). Files: `rules.mjs`, the test file, the spec.

### R3. Reopening a pull request goes past the limit

- UNIT: spec 3.1; `rules.mjs`.
- VERDICT: red.
- REQUIREMENT: CLAUDE.md Settings, "Pull requests open: 3"; section 2.
- REASON: reopening adds an open pull request exactly as a create does, and none of `gh pr reopen`, `PATCH .../pulls/<n>` with `state=open`, or `mcp__github__update_pull_request` with `state: "open"` is counted.
- EVIDENCE: probes D, D2, E allowed with 3 open.
- EXPECTED: refused with the open-limit reason when 3 are open.
- FIX: run the open-limit part of `checkPrCreate` for those three calls (and the GraphQL `reopenPullRequest` of R2); a criterion for each. Files: `rules.mjs`, the test file, the spec.

### R4. A create whose body cannot be read skips the lane and criteria checks

- UNIT: `rules.mjs` line 942 (`known`); spec 3.2.
- VERDICT: red.
- REQUIREMENT: section 2 (lane and acceptance criteria on every create).
- REASON: 3.2 refuses only an unreadable body *file*. A body from `$(cat f)` on `gh api`, a `$VAR`, backticks, `--input -` or `@-` fed by a pipe instead of a heredoc is still "unknown", and `checkPrCreate` then skips lane and criteria. The PostToolUse check only re-judges the last line, never lane or criteria, so nothing catches it later.
- EVIDENCE: probes I and K allowed.
- EXPECTED: a create (any route) whose body the hook cannot resolve is refused: "write the body to a file in its own call, then pass it with --body-file / -F body=@file".
- FIX: in `checkPrCreate`, `!known` on a create is a refusal; extend 3.2 and criterion 4 to these forms. Edits keep today's after-the-fact check. Files: `rules.mjs`, the test file, the spec.

### R5. The create check judges the local branch, not the pull request's head

- UNIT: `rules.mjs` `changesBeyondDocs` and `onlyRulesAndDocs` (lines 924 to 937), the MCP create at line 1170; spec 3.1, 3.5.
- VERDICT: red.
- REQUIREMENT: section 2 (criteria check) and 3.5 (the limit, if the exemption stays).
- REASON: both read `git diff origin/main...HEAD` in the folder the hook runs from. The `head` in the call (`-f head=`, MCP `head`) can name any other branch. A session sitting on a docs-only branch can open a code branch's pull request with no acceptance criteria, and, while the exemption exists, past the limit.
- EVIDENCE: the functions take only `cwd`; `checkPrCreate` is never given `head`.
- EXPECTED: the files judged are those of the branch the call names; when it cannot be read, the branch counts as changing more than docs and as not exempt.
- FIX: pass `head` from each route to `checkPrCreate` and diff `origin/main...origin/<head>` (fetching it if needed); a criterion with HEAD on a docs-only branch and `head` naming a code branch. Files: `rules.mjs`, the test file, the spec.

### R6. The open limit lets the call through when the count cannot be read

- UNIT: `rules.mjs` line 952.
- VERDICT: red.
- REQUIREMENT: section 2; the owner's rule that the hooks are followed (a hook that silently passes is not a check).
- REASON: when `gh api repos/<r>/pulls?state=open` fails or times out (8 s), `open` is null and the create is allowed.
- EVIDENCE: `if (Array.isArray(open) && open.length >= f.maxOpenPrs)`.
- EXPECTED: an unreadable count refuses the create, saying the count could not be read, as `checkReviewed` already does for an unreadable pull request.
- FIX: refuse when `open` is not an array; one criterion with the stub failing that path. Files: `rules.mjs`, the test file, the spec.

### R7. The hook's footer tolerance does not match CI's, and criterion 6 cannot pass as written

- UNIT: spec 3.3 and criterion 6; `rules.mjs` `stripFooter` (line 847).
- VERDICT: red.
- REQUIREMENT: 3.3 ("so the hook's own after-the-fact check ... agrees with CI"), criterion 6.
- REASON: 3.3 says `verifyBody` "already has `stripFooter`", implying reuse. `stripFooter` removes any run of "Generated by/with" lines and `https://claude.ai/code/session_` lines after a `---`, so it also strips `🤖 Generated with [Claude Code](https://claude.com/claude-code)` plus a session link, and a footer one character off. CI (3.3) strips only the exact block. Criterion 6's "reports when the footer differs by one character" fails with today's `stripFooter`.
- EXPECTED: hook and CI strip the same exact two-line block and nothing else.
- FIX: the spec says `stripFooter` is narrowed (or replaced) to the exact `---` + `_Generated by [Claude Code](https://claude.ai/code)_` trailing block, the string kept in `rules.json` so U0 and U2 quote one source; criterion 6 adds the `🤖 Generated with` + session-link case as must-report. Files: `rules.mjs`, `rules.json`, the test file, the spec.

### R8. Commands inside a decision card's options are never read

- UNIT: spec 3.6; `rules.mjs` line 1180.
- VERDICT: red.
- REQUIREMENT: 3.6 (lists `request_decision` fields `question`, `options`).
- REASON: `options` is an array of objects; the hook joins `String(input[f])`, which is `[object Object]`, so nothing in an option's `label` or `consequence` is checked.
- EVIDENCE: probe OC: a fenced `git push` in `options` allowed, the same text in `post_message` refused.
- EXPECTED: every string inside a listed field is checked.
- FIX: flatten non-string fields (walk arrays and objects, collect strings) before the fenced-block scan; a criterion with a command in an option's `consequence`. Files: `rules.mjs`, the test file, the spec.

### R9. The spec does not say which routes stay outside the hook

- UNIT: spec 3.7 and section 5.
- VERDICT: red.
- REQUIREMENT: 3.7 ("A route found unchecked is reported to the owner and not used until a hook covers it"); the coordinator's brief ("check the fix can't be bypassed").
- REASON: some routes can never be fully parsed by a shell-reading hook: `curl`/`wget`/`node -e fetch(...)` to `api.github.com`, and `gh` aliases or extensions (`gh alias set pc 'pr create'`, then `gh pc`). The spec neither covers them nor names them, so after the merge sessions and the owner will read "every route" as true.
- EVIDENCE: probes F and J allowed.
- EXPECTED: the cheap ones are refused, and the rest are named as covered only by the 3.7 rule.
- FIX: refuse a Bash command whose words include an `api.github.com` URL with `/pulls` or `/graphql` outside `gh`, and refuse `gh alias set` / `gh alias import` (an alias that opens a pull request would hide it); add a "Routes the hook does not see" paragraph to section 5 (scripts in other languages) that 3.7 governs; one criterion each for the two refusals. Files: `rules.mjs`, the test file, the spec.

## Notes (not blocking)

- N1. `gh pr edit --base` and `PATCH .../pulls/<n>` with `base` change the base with no check, while the MCP route refuses it (probe G). Outside this spec's request; a follow-up.
- N2. 3.6 lists two tools. Commands also reach the owner through `mcp__hearthbot__edit_message`, `post_widget`, and through the coordinator's relay of a thread's text. Consider a regex such as `^mcp__hearthbot__(post_message|edit_message|request_decision|post_widget)$`, and say whether inline code (single backticks) is in scope; today only fenced blocks are read.
- N3. 3.1 says the path is `repos/<o>/<r>/pulls` "exactly". Make sure `pulls/` and `pulls?...` are treated the same, or a trailing slash is a way past it. Fold into R1's tests.
- N4. Only the three merge tools fail closed when the hook crashes or finds no config (`GUARDED`, `onFailure: block`). `mcp__github__create_pull_request` and `update_pull_request` body writes pass when the hook crashes. Consider adding `create_pull_request` to the guarded set; it would need `.claude/settings.json` and the cloud setup script.
- N5. Open owner decision 3.5 (docs-only exemption) is still open at 40631f9. It decides criterion 9 and the 3.5 part of U4. If the owner keeps the exemption, CLAUDE.md must change too, but CLAUDE.md is in PR-R, which merges first: the plan then needs a third rules pull request or PR-R must wait for the answer. Say which. R5 applies whichever way it goes.
- N6. PR-R (the workflow change) merges with criterion 7 "run by hand", so a lane 3 CI change lands before any program checks it. Attach the run's output to PR-R and name the commit, or have PR-R's own `commit-authors` run on a test body as its check.
- N7. 3.3's decision is recorded (owner card, 14:43 UTC) and section 6 now has no owner wait for U0. 3.6's refusal text ("with 3.3 the footer no longer needs the owner") depends on it; that dependency is now satisfied.

## Owner decisions this audit depends on

- 3.3 footer route: decided, nothing waits.
- 3.5 docs-only exemption: open. Blocks criterion 9 and part of U4; see N5 for its effect on the pull request split.
