# End-of-slice Notion step, plan audit 1

Examined: the brief of PR #303 (the owner's request plus the acceptance criteria in the PR body), at 5c4d34a, main e172f2a. Short path, so the brief is the plan. Session: lane 3 audit, fresh, Opus 5.5 medium.

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## Verdict

5c4d34a FAIL: 2 red, 4 notes.

## What was checked

- Authority: the owner, 2026-11-22 04:53 UTC, "update our notion at the end of our slice" (project memory, same time). The brief quotes it and asks for nothing beyond it. Inside the standing "keep the Notion page current" yes (progress.md line 24, 2026-11-21 08:56 UTC).
- Scope: one bullet in `.claude/skills/this-repo/SKILL.md`. Criteria 1 and 3 are commands or a diff read a program or person can judge.
- Page parts named in the brief exist on the live page (Notion fetch of the Ruken page, last edited 2026-11-22 04:55 UTC): the gray "Last updated" line, "Where things stand", "Waiting on you", "Open right now", "Known issues, not fixed yet", and the Decisions and Roadmap databases.
- Fit with the slice end in `staged-path` (lines 27 and 29): see R1.
- Who does it: see R2.
- CRUD: no user-made thing is added or touched; not applicable.

## Red

**R1.** UNIT: the brief's trigger ("once a slice's retrospective has merged ... before the next slice starts"). VERDICT: red. REQUIREMENT: consistency with the codebase rules, `staged-path` line 29: "The next slice can start once the retrospective's pull request is open, or once the retrospective reports nothing to learn." REASON: the brief waits for the retrospective to merge and puts the Notion step before the next slice, so the next slice can no longer start when the retrospective's pull request is open. EVIDENCE: the retrospective's pull request is a rule-change pull request "for the owner to approve" (`staged-path` line 29), so a merge can wait on the owner; slice 2's retrospective (#298) was a separate merge. The new step silently moves the start of every next slice behind that approval, which the owner did not ask for. EXPECTED: the step follows the slice end as `staged-path` defines it and does not change when the next slice may start. FIX: trigger on "once the slice's retrospective pull request is open, or it reported nothing to learn" (the moment `staged-path` already calls the slice's end); files: `.claude/skills/this-repo/SKILL.md` and the PR body's description of it.

**R2.** UNIT: criterion 2 ("who does it (the session that closes the slice)"). VERDICT: red. REQUIREMENT: the brief's own criterion 2, and CLAUDE.md "Fresh session per big job" (the coordinator does no jobs). REASON: no rule defines "the session that closes the slice", so the step has no owner and can be skipped by every session. EVIDENCE: `grep -rn "closes the slice" CLAUDE.md .claude/skills` finds only the new line; `staged-path` line 27 lists the slice end's stages and none is a Notion step; the last stage is the retrospective, a fresh thread. EXPECTED: the brief names a role the rules already start. FIX: name the retrospective thread, as its last step after its pull request is open or it reports nothing to learn (or a thread the coordinator starts right then, if the retrospective must stay narrow); file: `.claude/skills/this-repo/SKILL.md` and the PR body.

## Notes (not blocking)

- **N1. Lane mismatch, between the hooks themselves.** The PR body says "the rule hook classes this path as lane 3". The pull request hook does not: `laneOfNames([".claude/skills/this-repo/SKILL.md"], ...)` with `rules.json` `prFlow.lanePaths` and `lanePathsExcept["3"]` returns 1 (run at 5c4d34a), matching CLAUDE.md Risk line 62 (this-repo edited alone is lane 1). The lane 3 message comes from the edit-time `laneNotice` hook, whose paths (`rules.json` lines 213-219, `.claude/**`) have no `this-repo`/`verify` exception. Follow-up for the hooks thread: give `laneNotice` the same lane 3 exception as `prFlow`. Running lane 3 audits here is stricter, not wrong; the body's sentence should say the edit-time notice, not "the rule hook".
- **N2.** The earlier bullet says "Leave the dashboard, Roadmap ... to the thread that keeps the page up to date"; the new bullet calls it "the session that closes the slice". Once R2 names the role, use the same name in both bullets.
- **N3.** Roadmap: "each row's Status and Notes" does not cover a roadmap item that has no row yet. Consider "add a row for each roadmap item that has none".
- **N4.** The owner's 04:53 instruction is not yet in `progress.md` History (the body says it is kept apart). The coordinator's records step; follow-up, not this PR.
