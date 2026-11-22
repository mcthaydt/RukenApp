# Plan audit: "Every wait shows it" rule (PR #313), cycle 1

- Examined: `56eb0f0` (PR #313 head), against `main` at `f5296bd`. The plan on the short path is the PR body's acceptance criteria.
- Reviewer: fresh session, Opus 5.5, medium. Lane 3 (the hooks class `.claude/skills/this-repo/` as lane 3).

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## Verdict: PASS (0 red, 2 notes)

## What was checked

- The criteria cover the whole request: the owner's three messages (05:52, 05:53, 06:36 UTC, sourced from #309's body, `pr-drafts/loading-signs-pr-body.md` lines 6 and 8), the standing rule, and the flaky runs #309's full runs hit. Each criterion is observable: AC1 by `ls` of five paths, AC2 by reading `progress.md` against the CI jobs, AC3 by `git diff --stat`.
- Scope: one rule line and records only. It adds no new kind of loader and no new check, so nothing is built ahead of its user.
- Lane: the PR body states lane 3 from the hook and names the mismatch with CLAUDE.md's "A repo's own skills" (lane 1 when edited alone). The line does not change what needs the owner. Running lane 3 is the stricter reading; fine.
- CRUD: no user-made thing is added or touched; not applicable.

## Notes (not blocking)

- N1. UNIT: PR body, AC1. VERDICT: note. REQUIREMENT: none broken. REASON: AC1 checks that the named files exist, not that the rule's description of them is accurate. EVIDENCE: AC1 text. EXPECTED: the implementation audit reads each named piece against the line's words (done there). FIX: none here.
- N2. UNIT: PR body, Commits. VERDICT: note. REQUIREMENT: `release` (three commits). REASON: "Integration" and "`main` it was tested with" are still placeholders. EVIDENCE: PR body at `56eb0f0`. EXPECTED: filled before ready, as the body says. FIX: the merging session fills them.
