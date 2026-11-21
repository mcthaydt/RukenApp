# Plan audit 5: hooks cover every pull request route

Spec: `docs/superpowers/specs/2026-11-21-hooks-cover-every-pr-route-design.md` at **7435b19** (branch `claude/project-thread-j2umsk`; 7435b19 answers audit 4). Read with it: plan audits 1 to 4, `.claude/hooks/rules.mjs`, `.claude/hooks/rules.json`, `.claude/settings.json`, `.github/workflows/ci.yml`, `.github/workflows/commit-authors.yml`, `tests/rules-merge-permission.test.ts`, CLAUDE.md. Lane 3, plan audit, Opus 5.5 medium. Graphify was not needed: the targets are a hook, a workflow and new scripts, all read directly.

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## Verdict

**7435b19 FAIL: 2 red, 3 notes.**

All four reds of audit 4 are answered in the text and three hold fully. Two gaps are left, both small and both in the spec only: the owner-only verdict rule (audit 4 R2) lands in a function the spec says the hook shares, and the existing merge-permission test, which must pass unchanged, feeds that function comments with no author; and the job condition that filters plain-issue comments is not written out, so criterion 6's grep can pass a workflow that skips every pull request event, or fail a correct one.

## How I checked

- `gh api repos/mcthaydt/RukenApp --jq .visibility` at 2026-11-21T15:05Z: `public`.
- `rules.mjs` 887 to 906 (`verdicts`): reads only `body` and the time; 1001 to 1009: the merge and ready checks call `verdicts` on the issue comments and reviews.
- `tests/rules-merge-permission.test.ts` line 41: the stub serves comments as `{ body, created_at }`, with no `user`; lines 154 to 168 expect a merge allowed on `${SHORT} PASS` from such a comment.
- `rules.mjs` 950 to 952: the open count reads one page, `per_page=100`; 1001 to 1002: comments and reviews one page each.
- Spec 3.1, 3.4, criteria 5, 6, 6a, 7, 13, 15a, 17, 20, section 5, read against each other.
- Nothing was pushed or run on GitHub; this audit changes only this file.

## Audit 4 reds, rechecked

| Audit 4 | Answer in 7435b19 | Holds? |
|---|---|---|
| R1 status written directly | 3.4 refuses non-GET `statuses/*` and `check-runs*`; criterion 15a; section 5 names unreadable routes; criterion 20 records creator and app | Yes (see N2 on how 20 measures it) |
| R2 outsiders' verdicts | Rule 5 counts only `mcthaydt`'s comments and reviews; criterion 5 | For `pr-rules`, yes; where the filter lives is R1 below |
| R3 criterion 6 too strict | 3.1 names the concurrency group and the `issue.pull_request` condition; criterion 6 allows them; 6a | Partly: R2 below |
| R4 fork count in the hook | 3.3 bullet; criteria 7 and 13 | Yes |

Audit 4 notes: N1 in rule 1 (`head.repo` null is a fork), N3 in criterion 20. N2 (live state) is refreshed: see N3 below.

## Red findings

### R1. The owner-only verdict filter collides with "one shared function" and with criterion 17

- UNIT: spec 3.1 rule 5 and the "lane, criteria and verdict functions move ... into `scripts/pr-rules-lib.mjs`" paragraph; criteria 5, 7, 17.
- VERDICT: red.
- REQUIREMENT: CLAUDE.md "A check is a test that fails by itself" (criteria must be passable together); spec 3.1 "the client and GitHub judge by one piece of code".
- REASON: the spec does not say whether the author filter is inside the shared `verdicts` or only in `pr-rules`' rule 5. If it is inside the shared function (as audit 4 R2 expected, "so the hook and `pr-rules` agree"), the hook's merge and ready checks stop counting the stub's author-less comments and `tests/rules-merge-permission.test.ts` "a review still holds (e)" fails, against criterion 17 "passes unchanged". If it is only in rule 5, the hook's merge check still counts an outsider's `<head> PASS` on this public repo, and the hook and `pr-rules` disagree.
- EVIDENCE: `tests/rules-merge-permission.test.ts` line 41 (`{ body, created_at }`, no `user`) and lines 154 to 168 (merge allowed on that PASS); `rules.mjs` 1001 to 1009 (merge check uses `verdicts`); spec criterion 17; spec 3.1 rule 5 names the filter only for `pr-rules`.
- EXPECTED: the spec says where the filter lives and keeps every criterion passable: either (a) the shared `verdicts` takes the allowed author (from `rules.json`, for example `prFlow.verdictAuthors: ["mcthaydt"]`) and criterion 17 is reworded to allow exactly one change to that test, its stub adding `user: { login: "mcthaydt" }`, named in PR-H's body as the `review` skill asks for a changed test; or (b) the filter applies only when the comment carries a `user` field — weaker, not recommended. Recommended: (a), plus a hook criterion that an outsider's `<head> PASS` does not allow a merge.
- FIX: edit 3.1 (one sentence on where the filter lives and where the login comes from), criterion 17, and add the outsider case to the hook criteria. Files: the spec only.

### R2. The job condition is not written out, so criterion 6 can pass a workflow that never runs on pull request events

- UNIT: spec 3.1 ("The job runs on `issue_comment` only when `github.event.issue.pull_request` is set"), criteria 6 and 6a.
- VERDICT: red.
- REQUIREMENT: CLAUDE.md "A check is a test that fails by itself"; section 2 (the check runs on every pull request event).
- REASON: one job serves both triggers. Under `pull_request_target`, `github.event.issue` is unset, so the literal condition `if: github.event.issue.pull_request` skips the job on every pull request event: no status is ever written on open, edit or push. Criterion 6 allows `github.event` only in "the `issue.pull_request` job condition", so that broken form passes it, while a correct form needs a second term: `github.event.pull_request || github.event.issue.pull_request` (a `github.event` use the criterion does not list) or `github.event_name != 'issue_comment' || ...` (`github.event_name` matches a plain `github.event` grep). Criterion 6a tests the script, not the workflow, so nothing in PR-R catches the skip; only criterion 20 does, after merge.
- EVIDENCE: spec 3.1 sentence above; criterion 6 "`github.event` used only in the concurrency group, the `issue.pull_request` job condition and the number under `env:`"; criterion 6a "Given a plain issue's number, it writes no status" (script-level).
- EXPECTED: 3.1 and criterion 6 give the exact job condition, `if: github.event.pull_request || github.event.issue.pull_request`, and criterion 6 checks that exact line (and that no other `github.event` use exists, `github.event_name` not used).
- FIX: write the condition into 3.1 and criterion 6. Files: the spec only.

## Notes (not blocking)

- N1. One page only. The hook reads the open list, comments and reviews as one page of 100 (`rules.mjs` 951, 1001, 1002). Now that fork pull requests are skipped and outsiders' comments ignored, an outsider who opens more than 100 fork pull requests hides ours from the count, and one who posts more than 100 comments can push a newer owner `FAIL` off the first page while an older `PASS` stays. Say in 3.1 that the shared library reads every page (as `laneOfFiles` already does) and fails closed on a read error.
- N2. Criterion 20 asks to record "whether a status a session's token writes would also satisfy a pinned requirement". After PR-H, 3.4 refuses that write, so measuring it by writing one would itself route around the hook. Say how it is measured without a session write: the `creator` and app of the real `pr-rules` status, plus the owner running one test write from their own machine if they want the answer, or record it as unknown.
- N3. The live-state file names `f70a638` as the last commit while the head is `7435b19`; a commit cannot name itself, so the file trails by one. Fine as it is; noted so the next commit refreshes it.

## What holds

- Every route from audits 1 and 2 ends in an event 3.1 judges, and both triggers use `main`'s copy only.
- Status and check-run writes are refused at the client, and section 5 says plainly what only 3.7 guards.
- The fork answer is now in rule 1, the hook (3.3) and criteria 1 and 13, through one counting function (criterion 7).
- The PR-H / PR-R split, order and units still match `ruleMix`.

## Owner decisions this audit depends on

None new. R1's fix (where the owner-only filter lives and one named test change) follows from audit 4 R2 and rule 5; it is not a product choice.
