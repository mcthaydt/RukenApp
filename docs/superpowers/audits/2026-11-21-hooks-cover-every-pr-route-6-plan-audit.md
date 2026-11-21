# Plan audit 6: hooks cover every pull request route

Spec: `docs/superpowers/specs/2026-11-21-hooks-cover-every-pr-route-design.md` at **adfe21f** (branch `claude/project-thread-j2umsk`; adfe21f answers audit 5). Read with it: plan audits 1 to 5, `.claude/hooks/rules.mjs`, `.claude/hooks/rules.json`, `.claude/settings.json`, `.github/workflows/ci.yml`, `.github/workflows/commit-authors.yml`, `tests/rules-merge-permission.test.ts`, CLAUDE.md. Lane 3, plan audit, Opus 5.5 medium. Graphify was not used: the targets are one hook file, two workflows and one test, all read directly, and the scripts the spec adds do not exist yet.

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## Verdict

**adfe21f FAIL: 2 red, 4 notes.**

Both reds of audit 5 are answered and hold. Two new gaps, both in the spec only and both found by reading the spec against the existing test and the workflow's checkout: criterion 17 ("nothing else in it changes") cannot pass once the hook imports a library that lives outside `.claude/hooks/`, because the test copies only that folder; and rule 5's promise that a clean merge of `main` keeps a verdict cannot hold in `pr-rules`, whose checkout has none of the pull request's commits, and no criterion tests that case.

## How I checked

- `git diff 3a0575a adfe21f`: only the spec and the live-state file changed.
- `rules.mjs` 21 to 25: the hook imports only `node:` modules today; 887 to 906 `verdicts(items, f)` takes `f = config.prFlow`, so `prFlow.verdictAuthor` is in reach; 909 to 923 `onlyCleanMerges` runs `git merge-base`, `rev-list` and `merge-tree` in the working folder; 1001 to 1009: the one call site of `verdicts` (merge and ready checks both go through `checkReviewed`).
- `tests/rules-merge-permission.test.ts` 41 (stub comments `{ body, created_at }`), 51 and 475 (`cpSync` of `.claude/hooks` only into the scratch repo), 482 (copy of that scratch).
- `ls scripts`: no such folder on this branch; nothing imports from it yet.
- `.claude/settings.json` 18, 24, 28: the hook runs as `node "$CLAUDE_PROJECT_DIR/.claude/hooks/rules.mjs"`.
- The job condition `github.event.pull_request || github.event.issue.pull_request` read against both triggers: truthy for every `pull_request_target` run, and for `issue_comment` only on a pull request.
- Nothing was pushed or run on GitHub; this audit changes only this file.

## Audit 5 reds, rechecked

| Audit 5 | Answer in adfe21f | Holds? |
|---|---|---|
| R1 where the owner-only filter lives | Rule 5: in the shared `verdicts`, login from `rules.json` `prFlow.verdictAuthor`; criterion 17 allows one stub change; 17a outsider case on the hook's merge check | The design, yes (`verdicts` already receives `prFlow`). Criterion 17's "nothing else" is R1 below |
| R2 job condition | 3.1 and criterion 6 give `if: github.event.pull_request \|\| github.event.issue.pull_request` exactly | Yes |

Audit 5 notes: N1 in rule 1 and criterion 17b (open list only; see N1 below), N2 in criterion 20, N3 refreshed.

## Red findings

### R1. Criterion 17 cannot pass: the test's scratch copy has no `scripts/`, so the hook's new import fails

- UNIT: spec 3.1 ("The lane, criteria and verdict functions move out of `rules.mjs` into `scripts/pr-rules-lib.mjs`, imported by both the hook and `scripts/pr-rules.mjs`"), criterion 17, section 5 files.
- VERDICT: red.
- REQUIREMENT: CLAUDE.md "A check is a test that fails by itself" (criteria must be passable together); review skill "A pull request that changes ... an existing test ... names each one and why".
- REASON: after PR-H, `rules.mjs` imports `scripts/pr-rules-lib.mjs`. `tests/rules-merge-permission.test.ts` runs the hook from a scratch folder that holds only `.claude/hooks/` and `CLAUDE.md`, with `CLAUDE_PROJECT_DIR` set to that scratch, so neither a relative import nor one resolved from the project folder finds the library. The hook dies on load (`ERR_MODULE_NOT_FOUND`), every case that expects a judged answer fails, and making it pass needs a second change to the test (copy the library), which criterion 17 forbids ("Nothing else in it changes").
- EVIDENCE: test lines 51 and 475 copy only `join(ROOT, ".claude", "hooks")`; line 482 copies that scratch; `rules.mjs` 21 to 25 import only `node:` modules today; spec criterion 17.
- EXPECTED: the spec places the library where every existing scratch copy already carries it, or names the second test change. Recommended: put the shared library at `.claude/hooks/pr-rules-lib.mjs` (already lane 3 through `.claude/**`, so the `lanePaths` addition shrinks to `scripts/pr-rules.mjs`), imported by the hook as `./pr-rules-lib.mjs` and by `scripts/pr-rules.mjs` from `main`'s checkout. The other choice: criterion 17 names two changes (the stub's `user` and copying the library into the scratch at lines 51 and 475), each named in PR-H's body.
- FIX: edit 3.1's library sentence, section 5's file list and `lanePaths` note, criteria 6b, 7 and 17, and the U1 row of section 6. Files: the spec only.

### R2. Rule 5's "a clean merge of `main` keeps the verdict" cannot hold in `pr-rules`, and no criterion tests it

- UNIT: spec 3.1 rule 5 ("A clean merge of `main` after the verdict keeps it, as `onlyCleanMerges` does in the hook") and the checkout sentence ("checks out `main` only ... `ref: main`"); criterion 5.
- VERDICT: red.
- REQUIREMENT: spec 3.1 rule 5 and "the client and GitHub judge by one piece of code"; `release` (a clean merge of current `main` keeps the review); CLAUDE.md "A check is a test that fails by itself".
- REASON: `onlyCleanMerges` judges by git in the working folder (`merge-base --is-ancestor`, `rev-list`, `merge-tree`). The `pr-rules` job checks out `main` only, at `actions/checkout`'s default depth of one, so the reviewed commit and the pull request's head (a fork's especially) are not in the folder; `merge-base` fails and the verdict is dropped. After the usual "merge `main` into the branch" following a PASS, the required `pr-rules` status goes red while the hook's merge check, which runs in a full clone, allows the merge: the two disagree, and the pull request needs a fresh review GitHub-side that the rule says it does not. Criterion 5 tests only the not-clean case (fails), so an implementation that never keeps a verdict passes every criterion.
- EVIDENCE: `rules.mjs` 909 to 923 (`onlyCleanMerges` is git-only); spec 3.1 checkout sentence; criterion 5's list of cases (no "clean merge keeps it" case); criterion 6 pins `ref: main` and says nothing on fetch depth or the pull request's commits.
- EXPECTED: the spec says how `pr-rules` sees the commits, and a criterion proves it. Recommended: the script fetches `main`'s history and `refs/pull/<n>/head` into the checkout as data (`git fetch --no-tags origin main refs/pull/<n>/head`, the number from `env:`, never from `${{ }}` in `run:`; the repo is public, so no credential is needed and nothing fetched is run), then calls the shared `onlyCleanMerges`; criterion 5 gains "passes with `<X> PASS` where the head is a clean merge of `main` onto X", in the `pr-rules` test, and criterion 6 allows that fetch. The other choice, if the owner prefers it: `pr-rules` counts only a verdict on the exact head, rule 5 says so, and `release` tells reviewers to re-post after a merge of `main` (a rule change, so the owner's).
- FIX: edit 3.1 rule 5 and the checkout sentence, criteria 5 and 6. Files: the spec only.

## Notes (not blocking)

- N1. Pages beyond the open list. Rule 1 now says every list `pr-rules` reads is read to its last page, and 17b tests the open count, but the hook's comment and review reads (`rules.mjs` 1001, 1002) are still one page, no criterion tests a verdict on page 2, and nothing says what `pr-rules` does when a read fails (audit 5 N1 asked for "fails closed"). Say that the hook's comment and review reads go through the same paging, and that a failed read in `pr-rules` is a `failure` status, never a skip.
- N2. Where the event's action comes from. Closing happens only on `opened` and `reopened`, but 3.1 passes "only the pull request number" through `env:`. The script can read `GITHUB_EVENT_NAME` and the payload at `GITHUB_EVENT_PATH` (runner defaults, read as data); say so, so the builder does not add a second `env:` expression that criterion 6's grep refuses.
- N3. Unit order. U1's criteria 5 and 6b need `prFlow.verdictAuthor` and the new `lanePaths` entries in `rules.json`, but `rules.json` is in U2's files. Both land on the PR-H branch, so nothing breaks; move the `rules.json` edits to U1's row (or let the library take them as arguments in its tests).
- N4. The live-state file names `3a0575a` while the head is `adfe21f`; a commit cannot name itself, so it trails by one. Fine; noted so the next commit refreshes it.

## What holds

- The owner-only filter now sits in the one function both judges call, with the login in `rules.json`; 17a puts an outsider PASS in front of the hook's merge check.
- The exact job condition runs every `pull_request_target` event and only pull request comments, and criterion 6 checks that exact line.
- Every route from audits 1 and 2 still ends in an event 3.1 judges, both triggers use `main`'s copy, status and settings writes are refused at the client, and section 5 says plainly what only 3.7 guards.
- The PR-H / PR-R split, order and units still match `ruleMix`.

## Owner decisions this audit depends on

None new. R2's recommended fix keeps the existing `release` rule; only its "other choice" would need the owner.
