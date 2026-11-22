3911187 FAIL: 1 red

# Plan audit 4: align Ruken with the apps kit

- Examined: mcthaydt/RukenApp branch `claude/project-thread-5bt3uy` at `3911187`, file `docs/superpowers/specs/2026-11-21-align-with-apps-kit-design.md`. The diff from `cf8844a` to `3911187` touches only that spec.
- Compared against: round 3's audit, `main` at `fe5f5ee`, PR-R (#279) head `a9b633e` (the base the build will start from), and `.claude/hooks/rules.mjs` at `fe5f5ee`.
- Lane 3, plan audit, cycle 4. Reviewer: Opus 5.5, medium. Read only. No hook refused anything.
- Finished: 2026-11-21 20:46:31 UTC (from `date`).

## Round 3 findings

- **R5 (the 2026-11-20 "without asking the owner" line): fixed.** F4 now deletes the line from `progress.md` History outright, citing the owner at 19:59, 20:01 and 20:02 UTC, and keeps the 19:16 UTC standing permission (with its 19:58 UTC scope) as the record merges rely on. Criterion 10 greps for the wording. Measured at `a9b633e`: the wording appears in only three files, `progress.md:79`, the slice 3 spec line 71 and the sessions-merge spec line 10. F4 and F8 remove all three, so criterion 10 can pass.
- **R6 (live specs point at history.md): fixed in part.** F8 repoints slice 3 spec lines 71 and 201 and the sessions-merge spec line 10; criteria 5 and 6 now cover `docs/superpowers/specs/`. One line was missed; see R7.
- **N1:** fixed. F7 names both branches of the test and the right lines (1107, 1108, 1126 at `fe5f5ee`, checked).
- **N2:** fixed. F4 covers replies inside threads, and Appendix B lists them.
- **N3:** fixed. The 09:22 question is quoted exactly.
- **N4:** fixed. The 15:00 card's question is quoted, with the decision it gave.

## Red findings

### R7

- UNIT: spec F8 and criterion 6; `docs/superpowers/specs/2026-11-21-sessions-merge-reviewed-prs-design.md` line 101.
- VERDICT: red.
- REQUIREMENT: Criterion 6: the grep "finds none in ... the sessions-merge spec". Criterion 1: F1 to F8 fixed as written. Owner goal: no live pointer to the deleted history.md.
- REASON: F8 changes only line 10 of the sessions-merge spec, but line 101 also names history.md ("Recorded under "Standing permissions" in `history.md` with that scope."). Built exactly as written, the spec fails its own criterion 6, and the builder has to guess which one wins. F8's claim that these are "all the spec files that name history.md" is true per file but not per line.
- EVIDENCE: `git grep -n "history\.md" a9b633e -- docs/superpowers/specs` lists `2026-11-21-sessions-merge-reviewed-prs-design.md:10` and `:101`. F8 at `3911187` names only line 10.
- EXPECTED: F8 names every history.md line in the two specs it changes, so criteria 1 and 6 agree.
- FIX (spec only): add to F8: "Sessions-merge spec line 101: `history.md` becomes `progress.md` History; the rest of the line stays." Also check F8's new line 10 text: it points at a 2026-11-20 record "in `progress.md` History", which F4 deletes. Point it at the 2026-11-21 19:16 UTC record only, for example: "**Standing permission:** the owner's merge permission of 2026-11-21 19:16 UTC, recorded in `progress.md` History."

## Checked and fine

- Owner-chosen differences kept: history.md stays deleted; every same-repo PR counts toward the limit, docs-only included; fork PRs never counted or closed; commit-authors ignores only the exact proxy footer; the 19:16 UTC standing permission stays as a dated record, scope from 19:58 UTC.
- The two Mac session approvals are recorded as superseded by the 20:19 UTC order, and progress.md will state that no session runs on the owner's computer for Ruken.
- Criteria 5, 7 and 10 are consistent with F1 to F8. Criterion numbering runs 1 to 6, 10, 7 to 9 (the new one was inserted); harmless.
- CRUD: not applicable (rules and docs only). Graphify: not used (Markdown only).
