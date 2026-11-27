# Keep reviews through clean merges, implementation audit 2 (release wording, PR #439)

Examined: `588ecd0e6233eb27075a4284df34e0a567ecf720` (PR #439 head), against `main` at `7ede27c` (the #437 hooks merge, also the PR's merge base). Reviewer: fresh session, Opus 5.5, medium. Written 2026-11-27 23:20 UTC.

Verdict: **588ecd0 FAIL: 1 red**

## What was checked

- Diff `7ede27c..588ecd0`: two files only, `.claude/skills/release/SKILL.md` (2 lines) and `docs/superpowers/progress.md` (2 lines added under Known issues). No live-state file left in the tree. Both commits authored by McThayDT, with no Claude trailers.
- Spec section 4.4 (`docs/superpowers/specs/2026-11-27-keep-reviews-through-clean-merges-design.md`): the release PASS line and merge-queue line must say a PASS carries through a merge of `main` whose only conflict or hand edit is in `progress.md` and through commits that touch only `progress.md`; any other conflict or change makes it stale. Both lines now say so.
- Merged hooks at `7ede27c`: `rules.json` `prFlow.notesPaths: ["docs/superpowers/progress.md"]` exists, as the new wording cites; `pr-rules-lib.mjs` `onlyCleanMerges` diffs with `--no-renames` and `merge-tree --write-tree`, so "the hooks check this by diffing" is true; both callers (`rules.mjs:1007`, `pr-rules.mjs:120`) pass the list.
- `this-repo` `pr-rules.yml` line already changed in #437 ("carries to it through clean merges of `main` and `progress.md`-only commits"); consistent with the new release wording.
- Owner approval cited (2026-11-27 22:23 UTC) matches project memory.
- progress.md entries: the three hook gaps and the "Done" line are factual and match #437 (`7ede27c`).
- CI on `588ecd0`: run 46081828150 (quick, draft) success on every job, gate success; `pr-rules` status success; `commit-authors` success. The full run after ready for review has not run yet.

## Findings

UNIT: `.claude/skills/release/SKILL.md`, Lanes and merging, the PASS line ("a notes-only commit touches that file and nothing else, a move onto or off it included").
VERDICT: red.
REQUIREMENT: spec 4.4 and criterion 6b (a rename onto or off `progress.md` does not carry); the wording must match the merged hooks.
REASON: the trailing clause "a move onto or off it included" can be read as "a move onto or off `progress.md` also counts as notes-only", which is the opposite of what the hook does.
EVIDENCE: `pr-rules-lib.mjs:100-106` diffs with `--no-renames` so a move lists both paths and the non-notes path refuses the carry; spec 6b says it does not carry. The sentence's only clause about moves is ambiguous between "nothing else, moves included" and "that file, moves included".
EXPECTED: words that read one way only: a move onto or off `progress.md` is not notes-only and makes the review stale.
FIX: in that one sentence, replace ", a move onto or off it included." with "; moving a file onto or off it counts as touching another file, so it does not carry." Only `.claude/skills/release/SKILL.md`.

## Notes (not blocking)

- Merge-queue line: "so does any other commit that changes more than `progress.md`" relies on "other" meaning non-merge commits (a clean merge of `main` changes many files yet keeps the review). It reads correctly in context; left as is.
