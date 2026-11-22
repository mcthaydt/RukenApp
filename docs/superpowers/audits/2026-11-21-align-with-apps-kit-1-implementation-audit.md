# Align with apps kit: implementation audit 1

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

- PR: #284 (mcthaydt/RukenApp), branch claude/project-thread-69gq97
- Commit examined: 8e95ca7 (commits f40be17, a6a54f8, 8e95ca7, all authored by McThayDT with the noreply address)
- Spec: docs/superpowers/specs/2026-11-21-align-with-apps-kit-design.md (merged in #280)
- Lane: 3. Auditor: fresh session, Opus 5.5 medium, read only.

## Verdict

8e95ca7 FAIL: 2 red

## Red findings

### R1

- UNIT: docs/superpowers/progress.md (owner instructions entry for the Change email card, and the "Everything editable" section)
- VERDICT: red
- REQUIREMENT: CLAUDE.md "Report honestly": timestamps are measured, never written by hand. The coordinator's brief also names this card at 20:39 UTC.
- REASON: the card answer "Keep password, drop Change email" is recorded at 20:38 UTC, but it was answered at 20:39 UTC.
- EVIDENCE: the card in the #209 thread was answered at 20:39:00 UTC. progress.md at 8e95ca7 says 20:38 in both places.
- EXPECTED: both places say 20:39 UTC.
- FIX: change 20:38 to 20:39 in those two lines of docs/superpowers/progress.md. The PR body can be corrected the same way. Touch no other file.

### R2

- UNIT: docs/superpowers/progress.md (Stages table and the Remaining list)
- VERDICT: red
- REQUIREMENT: spec F4 and criterion 3 require a Stages row for each stage of work under way. CLAUDE.md Settings also says the coordinator keeps each stage's row in progress.md up to date.
- REASON: the open lane 3 unit "video addresses need a pass" has no Stages row. The Remaining list still shows it as a follow-up that has not started.
- EVIDENCE: its spec is at a83679f on claude/project-thread-8400fx. Its plan audit passed. Its build thread has been running since 21:16 UTC. The Stages table at 8e95ca7 does not mention it.
- EXPECTED: a Stages row for this unit, with its stage (build) and progress, and the Remaining entry marked in progress.
- FIX: add the row and update the Remaining entry in docs/superpowers/progress.md only.

## Notes (not blocking)

- N1: roadmap.md is outside criteria 1 and 5. The coordinator asked for it and the PR body names it. In slice 3, items 2 and 3 still say "Later", although units C, F and H have merged.
- N2: the hook follow-ups Stages row says "not started", but its spec session was starting at 21:32 UTC.
- N3: the slice 3 Stages row leaves out unit D (the feed screen).
- N4: the 19:30 UTC entry could quote the owner's full words ("Follow my rules").
- N5: the PR body's Limits says the project chat was not re-read in full. This audit re-read all of it and found no other owner instruction missing.

## Checks run

1. Criterion 1 and 5 (files changed): `gh api` lists six files: CLAUDE.md, .claude/skills/this-repo/SKILL.md, docs/superpowers/progress.md, docs/superpowers/roadmap.md, docs/superpowers/specs/2026-11-21-feed-and-makers-page-design.md and the sessions-merge spec. The five in the spec are all there. roadmap.md is the one extra, which the coordinator asked for (see N1).
2. F6, CLAUDE.md: one sentence was changed, to "If something outside this list is brought to the owner, the owner will call it out." This matches the spec.
3. F5, the this-repo skill: it adds pr-rules.yml and says branch protection requires gate and commit-authors and does not require branches to be up to date. This matches .github/workflows and `gh api` branch protection (strict false).
4. F8 and criterion 6: the feed-and-makers spec (lines 71 and 201) and the sessions-merge spec (lines 10 and 101) now point to "progress.md History" with no quote. grep for history.md finds only the allowed exceptions: the align spec, everything-editable line 154, and crud-journeys lines 29 and 41.
5. Criterion 10: grep for "without asking the owner" finds only the align spec. The 2026-11-20 Standing permissions line is gone.
6. Criterion 7: the diff of .claude/settings.json, the hooks, .github/workflows and after-compaction is empty.
7. Owner instructions, Appendices A and B plus memory: every one is recorded in progress.md. The public-repo rule is in bold, the Mac-session records are marked superseded, and "Quick checks alone" is marked Not in force. The whole project chat and every thread active after 20:15 UTC were re-read. The only owner input after 20:19 UTC is the Change email card (see R1).
8. Merge times: every #2xx time in progress.md matches `gh api`, including #240 at 23:02, #241 at 23:42, #279 at 21:32, #282 at 21:31, and #251 closed at 15:33.
9. Open PRs and branches: #209 (audit PASS at 628803f), #283 (ff18424 PASS posted at 21:34) and #284 are open. claude/project-thread-7wmhqn has been deleted, as recorded.
10. Identity: all three commits are authored by McThayDT with the noreply address. a6a54f8 only deletes the live-state file.
11. Kit contradictions: nothing new in the diff contradicts the apps kit. The rules.mjs:1126 false positive and the Lesson line are recorded under Known issues and Lessons.
12. Criterion 9 (CI): at 21:41 UTC on 8e95ca7, commit-authors had passed, and "what changed" and pr-rules-run were still queued. **This criterion was not checked yet.** The fix commit gets a new run anyway.
