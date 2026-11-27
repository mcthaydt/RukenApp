# Keep reviews through clean merges: implementation audit 1

- Pull request: #437, head `88006723742a762964eaac84a061a7eaf57ef901` (`8800672`), against `main` at `ddbcff6`.
- Spec: `docs/superpowers/specs/2026-11-27-keep-reviews-through-clean-merges-design.md` (merged #434).
- Lane 3 implementation audit. Auditor: Opus 5.5, medium, fresh session.
- Prompt: Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## Verdict

**8800672 PASS.** No red findings. Three notes and one follow-up below.

## What ran (all at `8800672`, 2026-11-27, in a cloud container)

| Check | Result |
|---|---|
| `pnpm install --frozen-lockfile` | exit 0 |
| `pnpm lint` | exit 0 |
| `pnpm typecheck` | exit 0 |
| `pnpm test` | exit 0, 169 files, 2428 tests |
| `pnpm vitest run tests/pr-rules.test.ts tests/rules-merge-permission.test.ts` | 88 passed |
| Same run with `.claude/hooks/` put back to `main`'s copy (tests kept) | **6 failed**, 82 passed: the carry tests for notesConflict, notesOnly, mix, the `rules.json` list, the `pr-rules` check carry, and the client hook carry. The refuse tests pass on both, as they should (today's rule refuses those heads too). |
| Same run with `--no-renames` taken out of the `changed` helper | **2 failed**: `renameOnto` in the library and in the `pr-rules` check. So 6b's plain-commit case is pinned by a test that fails by itself. |
| Probe: one commit that runs `git mv docs/superpowers/progress.md src.ts` after R | `onlyCleanMerges(..., ['docs/superpowers/progress.md'])` returns `false` (6b's "progress.md onto a code path"). |

## Criteria

| # | Result | Evidence |
|---|---|---|
| 1 | met | `a PASS carries to the notesConflict head`; `pr-rules` check `passes(judged("notesConflict"))`. Fails on `main`'s hooks. |
| 2 | met | `notesOnly` in both. Fails on `main`'s hooks. |
| 3 | met | `mix` (note commit, clean merge of M0, progress conflict merge of M1). Fails on `main`'s hooks. |
| 4 | met | `otherConflict`: r.txt conflicts and is resolved to the pull request's own side; refused in the library, the `pr-rules` check and the client hook. Refused through two guards: the conflicted list from `merge-tree --name-only`, and the diff of git's tree against the commit. |
| 5 | met | `handEdit`: clean merge of M0 with `code.ts` edited by hand; refused. |
| 6 | met | `notesAndCode`; refused. |
| 6b | met | `renameOnto` (plain commit, git sees a 100% rename) and `renameInMerge` refused; the reverse move refused by the probe above. See note N1. |
| 7 | met | `sideMerge` refused; the older clean-merge and code-commit tests still pass. Octopus merges and root commits return false (`more.length`, `!p1`). |
| 8 | met | `with no notes list, only a clean merge carries, as before`: clean true, notesConflict and notesOnly false. Read of the code: with `notes` empty, a clean merge now passes when `git diff --no-renames --name-only <merge-tree> <commit>` is empty, which is the same as today's tree-id compare. |
| 9 | met (merge) | `rules-merge-permission.test.ts`: merging allowed on notesConflict and notesOnly, refused with the no-review reason on otherConflict. Marking ready goes through the same `checkReviewed` call (`rules.mjs:1283`, `readyCall ? 'marking it ready' : name`), so it is covered by the same code; see note N2. |
| 10 | met | lint, typecheck, test exit 0. The diff touches only files on the spec's list (no `release/SKILL.md` and no live-state file at this head). |

Design 4 words: `this-repo` says what the spec asks. The `release` wording is not in this pull request. It was moved out at `8800672` because `release/SKILL.md` is in `ruleMix.rulePaths` and the hooks refuse a branch that mixes rules files with tests; the coordinator's brief says it goes in its own pull request. That is the hook winning over the spec's one-pull-request plan, not a gap in this change. It is follow-up F1 and the spec's section 4.4 is not done until it merges.

Design 5: the `pr-rules` check runs from `main`'s copy, so this pull request is judged by today's rule. Nothing in the diff changes that.

## Code read

- `onlyCleanMerges` keeps the `from` is-ancestor-of `head` check first and returns false on every failed git call (`changed` returns null; `merge-tree` exit other than 0 or 1, or a spawn error, returns false; a first line that is not a hash returns false).
- `merge-tree` is called with `spawnSync` directly because `gitRun` treats exit 1 as a failure; it uses the same timeout and buffer as `gitRun`. Fine.
- Only two callers exist (`rules.mjs` `checkReviewed`, `pr-rules.mjs` `judge`), both pass `config.prFlow?.notesPaths ?? []`. `grep -rn onlyCleanMerges .claude` shows no other.
- `matchesAny` is the file's own glob matcher; `docs/superpowers/progress.md` has no glob characters, so it matches only itself.
- Graphify: not used. The repo's hook files are `.mjs` under `.claude/`, and `grep` over the two callers settled the impact; no product code is touched.

## Notes (not blocking)

- **N1.** UNIT: `tests/pr-rules.test.ts`, `renameInMerge`. VERDICT: note. REASON: the merge-side rename case is refused with or without `--no-renames`, because `progress.md` already exists in git's merge tree so git reports a modify plus a delete, not a rename. EVIDENCE: taking `--no-renames` out leaves `renameInMerge` green. The merge side uses the same `changed` helper that `renameOnto` pins, so the behaviour is covered; the test just does not prove it alone. FIX (optional, follow-up): a merge fixture where `main` has dropped `progress.md`, so git's tree has no `progress.md` and the hand edit is a true rename.
- **N2.** UNIT: `tests/rules-merge-permission.test.ts`. VERDICT: note. REASON: criterion 9 says "marking ready or merging"; only merging is tested. The ready path shares the call (`rules.mjs:1283`). FIX (optional): one `update_pull_request` `draft: false` case at the notesOnly head.
- **N3.** UNIT: `pr-rules-lib.mjs`, conflicted list. VERDICT: note. REASON: if `merge-tree` exits 1 with no blank line, `rest.indexOf('')` is -1 and the conflicted list is empty. Git always prints the blank line before its messages, and the later tree diff would still list the conflicted file (git's tree holds the conflict markers), so this does not open a hole.

## Follow-ups

- **F1.** The `release` skill wording (spec 4.4) in its own lane 3 pull request.
- **F2. The builder's report that the rule-mix hook missed `git push -q -u origin <branch>`.** The form itself is not the cause. With `origin/main` present, the hook at this head refuses all of `git push -q -u origin b`, `git push -u origin b`, `git push origin b`, `git push -q origin b` and `git push -u -q origin b` for a branch that changes `release/SKILL.md` and tests (`pushWords` skips `-q` and `-u`, which take no value). It was real that `16f3cd1` (release skill plus tests) was pushed. A reproduced cause: in a clone that has no `origin/main` (for example `git clone --single-branch --branch <pr>`), `checkRuleMix`'s `git diff --name-only origin/main...<src>` fails and the check lets the push through (`rules.mjs:856-859`, `if (r.ok)`). Measured: that clone, same branch with a `release/SKILL.md` edit, `git push -q -u origin probe-mix` → hook output empty, exit 0 (allowed). UNIT: `.claude/hooks/rules.mjs` `checkRuleMix`. REQUIREMENT: CLAUDE.md, "A change does not quietly edit its own check". EXPECTED: when the diff against the default branch cannot be read, the push is refused with a reason (or diffed against `git merge-base` after a fetch), never let through. FIX: lane 3 hook pull request; touches `rules.mjs` and its test only. Whether the builder's push hit exactly this cause is not known from here.
- Process note: while probing, the default-branch-push hook refused `git push origin main` inside a throwaway repository under `/tmp` that has nothing to do with GitHub. It was not routed around for a push; the probe used a local `git update-ref refs/remotes/origin/main` instead, which sends nothing anywhere. Reported in case the hook should only judge repositories it guards.
