# Plan audit 4: hooks cover every pull request route

Spec: `docs/superpowers/specs/2026-11-21-hooks-cover-every-pr-route-design.md` at **ba75a9e** (branch `claude/project-thread-j2umsk`; 6f23686 answers audit 3, ba75a9e records the owner's 15:00 UTC fork answer). Read with it: plan audits 1 to 3, `.claude/hooks/rules.mjs`, `.claude/hooks/rules.json`, `.claude/settings.json`, `.github/workflows/ci.yml`, `.github/workflows/commit-authors.yml`, `tests/rules-merge-permission.test.ts`, CLAUDE.md. Lane 3, plan audit, Opus 5.5 medium. Graphify was not needed: the spec's targets are a hook, a workflow and new scripts, all read directly.

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## Verdict

**ba75a9e FAIL: 4 red, 3 notes.**

All 7 reds of audit 3 are answered in the text (table below), and the design now holds together: `main`'s workflow only, a status the script writes on the head commit, lane 3 scripts, refused settings writes, a hardened `pull_request_target`. What is left are four smaller gaps the revision opened or did not reach: the new required status can be written directly by any session with one `gh api` call; on this public repo any GitHub user can post the `<head> PASS` comment that rule 5 trusts; criterion 6 forbids the expression the per-pull-request concurrency group needs; and the owner's fork answer reaches `pr-rules` but not the hook.

## How I checked

- `gh api repos/mcthaydt/RukenApp` at 2026-11-21T15:02Z: `"visibility":"public"`.
- `rules.mjs` lines 887 to 903 (`verdicts`): reads only a comment's text, never its author. Lines 950 to 952: the hook's open count is `pulls?state=open`, every pull request, forks included.
- `grep -n statuses rules.mjs`: only the `mergeGreen` read (line 1051 on); no refusal of a status write. Spec 3.4's refused list has no `statuses` path.
- `commit-authors.yml` line 18 uses `${{ github.ref }}` for its group; under `pull_request_target` and `issue_comment`, `github.ref` is `main` for every pull request (GitHub events page, as cited in audit 3), so a per-pull-request group needs `github.event.pull_request.number || github.event.issue.number`.
- Nothing was pushed or run on GitHub; this audit changes only this file.

## Audit 3 reds, rechecked

| Audit 3 | Answer in ba75a9e | Holds? |
|---|---|---|
| R1 own workflow copy | 3.1: only `pull_request_target` and `issue_comment`; rule 4; section 5 names a branch workflow publishing `pr-rules`; criterion 6 greps the triggers | Yes |
| R2 comment runs report on `main` | 3.1: script writes status `pr-rules` on the head sha it read; job named `pr-rules-run`; criterion 6a | Yes, but see R1 below (who else can write that status) |
| R3 criterion 19 impossible | 19 covers `commit-authors` only; 20 checks the first real run after merge | Yes |
| R4 scripts not lane 3 | Section 5: both scripts to `lanePaths` 3 and CLAUDE.md Risk; criterion 6b | Yes |
| R5 admin can switch the guard off | 3.4 refuses protection, rulesets, workflow enable/disable, actions permissions, repo PATCH; criterion 15a; 3.1 sentence corrected | Yes, except the status write (R1 below) |
| R6 injection | Criterion 6: number only, only under `env:`, no `${{` in `run:`, pinned checkout, no install | Yes, but too strict (R3 below) |
| R7 self-posted PASS | 3.7 text and section 5 | Yes for sessions; outsiders are R2 below |

Notes N1 to N6 of audit 3 are taken in (N4 became decision 3, now answered).

## Red findings

### R1. Any session can write the required `pr-rules` status directly, and nothing refuses or names it

- UNIT: spec 3.1 (owner step, "no app pin unless..."), 3.4 (refused writes), section 5.
- VERDICT: red.
- REQUIREMENT: section 2 (the guard holds whatever the route); 3.4's purpose after audit 3 R5 (writes that switch the guard off are refused).
- REASON: the required result is now a commit status any token with repo write can create. `gh api -X POST repos/mcthaydt/RukenApp/statuses/<head> -f state=success -f context=pr-rules` makes the check green in one call, as `mcthaydt`. 3.4 does not refuse it, and section 5 does not name it. With no app pin (the spec's default), branch protection accepts it from any creator.
- EVIDENCE: spec 3.4's list (protection, rulesets, workflows, actions permissions, repo PATCH) has no `statuses`; `rules.mjs` has no status-write refusal; 3.1 "with no app pin unless criterion 20's measurement shows a `GITHUB_TOKEN` status carries the pinned app id".
- EXPECTED: a non-GET on `repos/<o>/<r>/statuses/*` (and `check-runs`, the other way to publish a required result) is refused by the hook, criterion 15a covers it, and section 5 says that a status written by a route the hook cannot read is guarded by 3.7 alone, unless criterion 20 shows the app pin holds (then GitHub refuses a status from the session's token itself).
- FIX: add `statuses/*` and `check-runs` non-GET writes to 3.4 and to criterion 15a (refused; the GETs allowed); add one line to section 5; in criterion 20, record whether a status written with a session's token satisfies the requirement when it is pinned. Files: the spec only.

### R2. On this public repo any GitHub user can post the verdict rule 5 trusts

- UNIT: spec 3.1 rule 5, section 5, criterion 5.
- VERDICT: red.
- REQUIREMENT: section 2 (a pull request that breaks a rule fails `pr-rules`); the `review` skill (a verdict is a reviewer's).
- REASON: rule 5 reuses `verdicts()`, which reads only the text of a comment or review. The repo is public, so an outsider can comment `<head> PASS` on a ready lane 2 pull request and turn `pr-rules` green, or `<head> FAIL` to hold one red. And since `issue_comment` now reruns `pr-rules`, their comment takes effect at once. 3.7 binds sessions, not outsiders, so section 5's "the 3.7 rule alone guards these" does not cover it.
- EVIDENCE: `rules.mjs` 887 to 903 (no author check); `gh api repos/mcthaydt/RukenApp` → `public`; spec 3.1 triggers include `issue_comment: created|edited|deleted`.
- EXPECTED: only verdicts written by the owner's account (`user.login` = the repo owner, or `author_association` `OWNER`) count, in the shared library, so the hook and `pr-rules` agree.
- FIX: in 3.1 rule 5 (and the shared `verdicts` in `scripts/pr-rules-lib.mjs`), ignore comments and reviews not written by the owner's account; add to criterion 5: an outsider's `<head> PASS` does not pass and an outsider's `<head> FAIL` does not fail. Files: the spec only.

### R3. Criterion 6 forbids what the per-pull-request concurrency group and the comment filter need

- UNIT: spec 3.1 (concurrency, `issue_comment` "on pull requests"), criterion 6.
- VERDICT: red.
- REQUIREMENT: CLAUDE.md "A check is a test that fails by itself" (a criterion that cannot pass beside its own requirement is the audit 3 R3 pattern).
- REASON: criterion 6 allows `${{ github.event.* }}` only for the two numbers and "only under `env:`". A per-pull-request group (3.1, criterion 6's own last item) must be written in `concurrency.group` with the event's number, since `github.ref` is `main` for every run of both triggers. Limiting `issue_comment` to pull requests needs `github.event.issue.pull_request` in an `if:`, or the script must do it. As written, a correct `pr-rules.yml` fails criterion 6, or one that passes shares one group for every pull request.
- EVIDENCE: criterion 6's text; `commit-authors.yml` line 18 shows the `github.ref` group, which under `pull_request_target`/`issue_comment` is `refs/heads/main` for all.
- EXPECTED: criterion 6 allows exactly `github.event.pull_request.number || github.event.issue.number` in `concurrency.group`, and either an `if: github.event.issue.pull_request || github.event.pull_request` on the job or the script exiting 0 on a plain issue (say which); still no `${{` in any `run:` line.
- FIX: reword criterion 6 and the concurrency line in 3.1 to name those allowed places; add to criterion 6a that a comment on a plain issue writes no status and closes nothing. Files: the spec only.

### R4. The owner's fork answer reaches `pr-rules` but not the hook

- UNIT: spec section 7 decision 3, 3.3, criteria 10 and 13.
- VERDICT: red.
- REQUIREMENT: Owner, 2026-11-21 15:00 UTC: "only ours count", recorded in section 7 as applying "in `pr-rules` and in the hook".
- REASON: the hook counts every open pull request (`pulls?state=open`), forks included, and 3.3 does not say to change that, and no hook criterion checks it. With 2 of ours and 1 outsider's open, the hook refuses a session's create that `pr-rules` would pass: the client and GitHub disagree, which 3.1's "one piece of code" aims to prevent.
- EVIDENCE: `rules.mjs` lines 950 to 952; spec 3.3 has no fork line; criterion 1 covers forks only for `pr-rules`.
- EXPECTED: one counting function in `scripts/pr-rules-lib.mjs` (head repo = base repo) used by both; a hook criterion like criterion 1's fork cases.
- FIX: add a 3.3 bullet ("the open count uses the library's own-branch count") and a criterion under the hook: with 2 of ours and 3 forks open, a create is allowed; with 3 of ours, refused. Add the count function to criterion 7's import list. Files: the spec only.

## Notes (not blocking)

- N1. A pull request whose fork was deleted has `head.repo: null`. Say it counts as a fork (not ours), so the count never throws on it.
- N2. The live-state file says "Last commit: 6f23686"; the head is ba75a9e. Update it at the next commit.
- N3. Criterion 20 has the coordinator post `<head> PASS` to watch the status flip. Say the comment must be the real reviewer's verdict for that pull request (or post it on a throwaway draft and close it), so the measurement is not itself an unearned verdict under 3.7.

## What holds

- Every route from audits 1 and 2 still ends in an event 3.1 judges, and both triggers now run `main`'s copy only.
- The status-on-head design fixes the comment-run problem; job and status names never collide.
- The fork answer is carried into rule 1 and criterion 1 consistently.
- PR-H / PR-R split, order and units match `ruleMix` (`.github/workflows/**` and CLAUDE.md in `rulePaths`; the hook, scripts and tests together in PR-H).

## Owner decisions this audit depends on

None new. R2's fix (count only the owner account's verdicts) follows from rule 5's purpose; it is not a new product choice.
