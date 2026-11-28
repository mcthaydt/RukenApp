# Drop the old stops: plan audit 2

- Examined: `docs/superpowers/specs/2026-11-28-drop-send-stops-design.md` at `707cc1a33ab9dbffc47530a7b79544bd9836ab3e` (draft #471, branch `claude/project-thread-9jsisq`).
- Reviewer: fresh session, Opus 5.5, medium. Lane 3 plan audit, round 2.
- Round 1: `5409dd8 FAIL: 1 red` (`docs/superpowers/audits/2026-11-28-drop-send-stops-1-plan-audit.md` on `claude/project-thread-p9i3y9`, commit `929986c`).
- Verdict: **707cc1a PASS**

## What changed since round 1

`git diff 5409dd8 707cc1a --stat` shows one file, the brief, with 4 lines added and none removed: a new "Gone for good" section between "What changes" and "The deploy window". Nothing else in the brief, and no other file on the branch, changed. So every row round 1 marked "Yes" still holds as written.

## R1 (round 1 red): closed

Round 1 asked the brief to say that the rows are gone for good once the migration runs, that no copy is kept, that a code rollback does not bring them back, and that the owner's yes accepts that. The new section says each:

| Round 1 expected | New text |
|---|---|
| Gone for good once the migration runs | "Once the migration runs, the stops are gone for good." |
| No copy kept | "No copy of the table or its rows is kept anywhere" |
| A code rollback does not bring them back | "reverting this pull request's code does not bring them back: a revert would bring back a schema that names a table the database no longer has." |
| The owner's yes accepts it | "The owner's yes (14:52 UTC) is for exactly this." |

The revert sentence agrees with "The deploy window" (a rollback after the drop leaves the purge failing until rolled forward), so the two sections do not contradict each other.

## Regressions

None. The added section touches no criterion, plan row, file list or lane line.

## Notes (not blocking)

- **N1.** Round 1's expected text also named the database host's own restore as the only way back, if it has one. The brief leaves that out, and "kept anywhere" reads as if no host backup exists, which the repo does not record either way. "No copy is taken by this change" would be the exact claim. Optional; it changes nothing the build does.
- **N2.** Round 1's notes N1 (widen criterion 3's grep to the whole repo minus `docs/`), N2 (#459 must merge `main` after #471), N3 (earlier-stamped migrations in #460 and #465 are independent) and N4 (add `docs/superpowers/progress.md` to the plan's files) are still open as notes. None blocks.

## Not checked

- No command was run against a database; this is a plan audit. Criterion 2's claim about how postgres test files start stays with the implementation audit.
