# Plan audit 2: keep a review through clean merges

- Pull request: #434. Commit examined: 67eac2f52132960a6fe01989503e3f9f7c9c8cd8.
- Previous audit: cycle 1 at 26f9547, FAIL with 1 red (a rename onto `progress.md` passed as notes-only).
- Auditor: fresh session, Opus 5.5, medium. Lane 3 plan re-audit, scoped to the fix.
- Verdict: **PASS**.

## What changed since 26f9547

`git diff --name-only --no-renames 26f9547 67eac2f` lists one file:
`docs/superpowers/specs/2026-11-27-keep-reviews-through-clean-merges-design.md`. The diff (+8 −3) only:

1. adds `--no-renames` to the one-parent diff in section 4.1;
2. adds `--no-renames` to the merge hand-edit diff (`<that tree> <commit>`) in section 4.1;
3. adds the sentence explaining both paths are listed, so the non-notes path refuses the carry;
4. adds criterion 6b: no carry when a code file is renamed onto `progress.md`, or `progress.md` onto a code path, in a
   plain commit or a merge's hand edit, even where git counts it as a rename.

Nothing else in the spec moved; the rest was passed at 26f9547.

## Does the fix close the hole

Reproduced with git 2.43.0 in a scratch repo:

| Case | `git diff --name-only` | `git diff --no-renames --name-only` |
|---|---|---|
| Pure rename `src/code.ts` → `docs/superpowers/progress.md` (the cycle 1 red: delete progress.md, then move) | `docs/superpowers/progress.md` only (hole) | `docs/superpowers/progress.md`, `src/code.ts` (refused) |
| Same with `-B` break detection | — | both paths |
| Code file replaces an existing `progress.md`, plain commit | both paths | both paths |
| Same as a merge commit's hand edit, diffed against the `merge-tree --write-tree` result | both paths | both paths |
| Same with `diff.renames=copies` in config | — | both paths (`--no-renames` overrides config) |
| Reverse: `progress.md` moved onto `src/code.ts` | both paths | both paths |

In every case the non-notes path appears in the list, so "every name must match `notes`" fails and the carry is
refused, as criterion 6b requires. The delete-only first commit of the cycle 1 scenario lists only `progress.md` and
carries, which is right: removing notes changes nothing a review covered.

The `merge-tree --name-only` conflict list is not a diff, so rename detection does not affect it; it lists conflicted
paths, and each must match `notes`.

Callers: Graphify (index at c1012a2) and `git grep` at 67eac2f both show exactly two callers of `onlyCleanMerges`:
`.claude/hooks/pr-rules.mjs:120` and `.claude/hooks/rules.mjs:1007`, matching section 4.2.

## Findings

No red.

- Note (follow-up, not blocking): the implementer may add `-z` to both diffs so a path with a newline cannot split
  into two names. Cycle 1 already raised it as optional; the risk is low because a split name would fail `notes` and
  refuse, not carry.
