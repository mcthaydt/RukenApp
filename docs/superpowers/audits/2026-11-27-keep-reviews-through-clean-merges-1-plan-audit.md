# Plan audit 1: keep a review through clean merges and notes-only commits

- Pull request: #434, head `26f9547` (`26f9547dd229b3f16cf9715397b2648a45755fc1`).
- Spec: `docs/superpowers/specs/2026-11-27-keep-reviews-through-clean-merges-design.md`.
- Lane 3 plan audit. Session: Opus 5.5, medium. Written 2026-11-27 22:28 UTC.
- Read: the spec, `.claude/hooks/pr-rules-lib.mjs` (`onlyCleanMerges`, `reviewPasses`, `matchesAny`), `.claude/hooks/pr-rules.mjs` (`judge`, `fetchHead`), `.claude/hooks/rules.mjs` (`checkReviewed`), `tests/pr-rules.test.ts` (the clean-merge git fixture), `.github/workflows/pr-rules.yml`, `release` lines 89 to 94, `this-repo` line 36, `progress.md` Standing permissions.

## Verdict: FAIL, 1 red

The design is mechanical and almost entirely safe. One concrete bypass: `git diff --name-only` folds a rename into its new name, so a code file can be deleted unreviewed by moving it onto `progress.md`. One flag closes it.

## Findings

### 1. Red: a rename onto the notes path hides a deleted code file

- UNIT: spec section 4, design step 1 (both `git diff --name-only` calls), and section 5 (criteria).
- VERDICT: red.
- REQUIREMENT: spec section 2, "Anything else (a code change ...) still needs a fresh review"; the coordinator's brief: a merge or commit that sneaks in a code change can't carry a PASS.
- REASON: `git diff` detects renames by default (`diff.renames`), and `--name-only` then prints only the destination path. A deleted source file vanishes from the list.
- EVIDENCE: reproduced with git 2.43.0 in a scratch repo. Commit 1 deletes `docs/superpowers/progress.md` (diff lists only `docs/superpowers/progress.md`, so it is "notes-only" under the spec). Commit 2 moves `src/a.ts` to `docs/superpowers/progress.md`:
  - `git diff --name-only HEAD~1 HEAD` prints `docs/superpowers/progress.md` only, so under the spec it carries the PASS while `src/a.ts` is gone;
  - `git diff --no-renames --name-only HEAD~1 HEAD` prints `docs/superpowers/progress.md` and `src/a.ts`, and the carry is refused.
  The same applies to step 1's `git diff --name-only <tree> <commit>` for a merge whose hand edit is the same move.
- EXPECTED: every file a commit adds, changes or deletes is in the list the notes check reads, so the move above needs a fresh review.
- FIX: in spec section 4, step 1, both diffs run as `git diff --no-renames --name-only` (optionally `-z` too, so odd file names are never quoted); add a criterion: "It does not carry when a later commit deletes `progress.md` and then moves another file onto it, or when a merge's hand edit does the same." Files: the spec only (the implementation follows it).

### 2. Note: notes-only carry also covers the Standing permissions ledger

- UNIT: spec section 2 (the notes list), `progress.md` "Standing permissions".
- VERDICT: note (not blocking).
- REASON: sessions read Standing permissions in `progress.md` as the record that lets lane 3 work merge. After this change, a line added there after a PASS reaches `main` without a reviewer seeing it.
- EVIDENCE: no hook parses `progress.md` (`grep -n progress .claude/hooks/rules.mjs .claude/hooks/pr-rules.mjs` finds only messages). A `progress.md`-only pull request is already lane 1 (CLAUDE.md, Risk: "progress notes included") and merges on green with no review, so this rule adds no exposure the repo does not already accept.
- EXPECTED / FIX: none needed for this change. If the owner ever wants the ledger guarded, that is its own rule.

### 3. Note: the words already promise more than the hooks carry

- UNIT: `release` line 93: "A later commit that changes only the audit file, a live-state file or docs the audit did not cover keeps it."
- VERDICT: note, outside this change's scope.
- REASON: the hooks, before and after this spec, carry a PASS only through `progress.md`, not audit or live-state files. Section 4.4's word changes touch lines 89 and 94, so line 93 stays wider than the program. Recorded as a follow-up, not fixed here.

### 4. Note: seven-character verdict commits (pre-existing)

- `reviewPasses` compares and resolves the verdict's seven-character commit. Someone with push access could craft a commit sharing those seven characters. This exists today (`at === head7`) and the spec does not widen it. Follow-up only.

## What I checked and found sound

- **Force-push:** the existing `merge-base --is-ancestor from head` check stays first (section 4.1). If R is gone from the head's history, the carry is refused.
- **Every unreviewed commit is checked:** `rev-list --parents from..head --not origin/main` lists every commit reachable from the head that is neither reviewed (under R) nor on `main`. A root commit (no parents), an octopus merge, or a merge whose second parent is off `main` (including a reversed `main`-into-PR merge, where the second parent is the PR side) all give false.
- **A conflict in a non-notes file:** `git merge-tree --write-tree --name-only` lists it in the conflicted section, so the carry is refused even when it is resolved to the PR's version (criterion 4). Checked: with a conflict only in `progress.md`, the output is the tree, `docs/superpowers/progress.md`, a blank line, then the `Auto-merging` / `CONFLICT` messages, exit 1. A fully clean merge prints the tree alone, exit 0. The spec's parse rule (lines after the tree up to the first blank line) matches both.
- **Hand edits in a merge:** diffing git's own merge tree against the merge commit catches any change outside the notes (criterion 5), once finding 1's flag is added.
- **Mixed commits:** a commit touching `progress.md` and any other file is refused (criterion 6).
- **No list means no change:** `notes = []` keeps today's behaviour (criterion 8), so a caller that passes nothing is unaffected.
- **Callers:** Graphify (index at `c1012a2`) lists exactly two callers of `onlyCleanMerges`: `judge()` in `pr-rules.mjs` and `checkReviewed()` in `rules.mjs`, matching section 4.2.
- **Where it runs:** `pr-rules.yml` runs on `pull_request_target`, checks out `ref: main` with `fetch-depth: 0`, and `fetchHead` pins the pull request's head, so section 4.5 holds: the new rule judges pull requests from its merge on.
- **Exit codes:** the spec says merge-tree's exit 1 must count as success for parsing; today's `gitRun` treats any non-zero as failure, so the build must read the status itself. The spec states this; the implementation audit should check it.
- **CRUD:** no user-made thing is touched.
- **Lane and approval:** lane 3 is right (hooks and `release`). The owner's 22:23 UTC "yes" plus the 2026-11-21 standing permission cover the merge.
- **Plan:** tests first, one unit, the file list in criterion 10 matches section 4. Duration and session models follow CLAUDE.md Settings.

## To pass

Add `--no-renames` to both diffs in section 4.1 and the rename criterion in section 5. A re-audit reads only that change.
