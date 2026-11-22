0761ffe PASS

# Plan audit 5: align Ruken with the apps kit (R7 re-check)

- Examined: mcthaydt/RukenApp branch `claude/project-thread-5bt3uy` at `0761ffe`. The only commit after `3911187` is `0761ffe` (author McThayDT). It changes only `docs/superpowers/specs/2026-11-21-align-with-apps-kit-design.md`, with 3 lines added and 1 removed, all in F8.
- Lane 3, plan audit, cycle 5. Reviewer: Opus 5.5, medium. Read only. No hook refused anything.
- Finished: 2026-11-21 20:47:30 UTC (from `date`).

## R7: fixed

- F8 now lists sessions-merge spec line 101 and repoints it to `progress.md` History, leaving the rest of the line alone.
- F8's new line 10 points only at the 2026-11-21 19:16 UTC record, which F4 keeps. It no longer points at the 2026-11-20 entry that F4 deletes.
- At `a9b633e` (PR-R head), `git grep -n "history\.md" -- docs/superpowers/specs` finds hits in four spec files. The slice 3 spec (lines 71 and 201) and the sessions-merge spec (lines 10 and 101) are all covered by F8. The other two specs, everything-editable and crud-journeys, are criterion 6's allowed exceptions. Criteria 1 and 6 now agree.

## Everything else

- Unchanged since audit 4 (`3911187`), where R5, R6 (apart from R7) and N1 to N4 were confirmed fixed, and the owner's deliberate differences were confirmed kept.
- No red findings remain.
