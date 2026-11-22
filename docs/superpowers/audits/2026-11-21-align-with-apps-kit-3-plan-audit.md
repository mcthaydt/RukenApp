cf8844a FAIL: 2 red

# Plan audit 3: align Ruken with the apps kit

- Examined: mcthaydt/RukenApp branch `claude/project-thread-5bt3uy` at `cf8844a`, file `docs/superpowers/specs/2026-11-21-align-with-apps-kit-design.md`.
- Compared against: the kit at https://mcthaydt.com/prompts/claude-md-apps/, mcthaydt-website #99's three rules, PR-R head `a9b633e` (the progress.md the build edits), main `fe5f5ee`, the project chat, and the PR-R and slice 2 threads.
- Lane 3, plan audit, cycle 3. Reviewer: Opus 5.5, medium. Read only. No hook refused anything.
- Measured state at 20:40 UTC: #279 open (head a9b633e), #280 closed (head ba4bf65), #209 open (head c343326), main fe5f5ee. The diff from fe5f5ee to cf8844a touches only the spec. Every commit is authored by McThayDT.
- Finished: 2026-11-21 20:43:22 UTC (from `date`).

## Round 2 findings

- **R3 (owner instructions missing): fixed.** Appendix B lists every project chat item that round 2 named (09:21, 09:22, 14:22, 15:33, 15:50, 16:54, 19:16, 19:32, 19:35, 20:09). F4 records the 16:54 and 19:16 Mac approvals as dated records that the 20:19 UTC order supersedes, because no session runs on the owner's computer for a public repo.
- **R4 (hook trigger and breach record): fixed, with a remaining note (N1).** F7 adds the Known issues line and the Lessons line about the edit that a hook refused and that was then redone with the Edit tool.

## Red findings

### R5

- UNIT: spec F4, "Kept as is" bullet (line 62), and Appendices A and B.
- VERDICT: red.
- REQUIREMENT: The owner's goal is to remove anything that contradicts the kit. The 19:59 UTC instruction says "merge without asking" must not stay. A made decision is not reopened (CLAUDE.md, Keep to the request).
- REASON: The spec keeps the 2026-11-20 Standing permissions line, which quotes "Merge PRs yourself once CI, reviews and audits pass, without asking the owner". It treats that line as a dated record. The owner already rejected that reading:
  - 19:59:14, project chat: "Remove the merge without asking and double check if that's mentioned in mcthaydt apps, because that shouldn't be there".
  - 19:59:37: the coordinator said the permission stays as a dated history.md entry.
  - 19:59:55, PR-R thread: the builder reported that history.md line 19 and one older spec still had the wording, and asked whether the owner wanted them gone.
  - 20:01:45, project chat: "Why wasn't that deleted when I told you to wipe my workflow?"
  - 20:02:14, PR-R thread: "Delete the hisory.md".
  
  PR-R then moved the same line into progress.md, where it is still the first Standing permissions entry. Keeping it reopens a decision the owner made.
- EVIDENCE: spec line 62 at cf8844a; progress.md line 79 at a9b633e; the project chat and the PR-R thread at the times above.
- EXPECTED: The 2026-11-20 "without asking the owner" line is gone from progress.md. The 19:16 UTC standing permission, which the owner approved again at 19:58:53, stays as the record that merges rely on.
- FIX (spec only): Replace the "Kept as is" bullet with a step that removes the 2026-11-20 line from progress.md History. Add a criterion that `grep -rn "without asking the owner" docs/ CLAUDE.md .claude/` is empty. Add the 20:01:45 and 20:02:14 messages to the appendices.

### R6

- UNIT: The spec's scope (criteria 5 and 6) and the active slice 3 spec, `docs/superpowers/specs/2026-11-21-feed-and-makers-page-design.md`.
- VERDICT: red.
- REQUIREMENT: Remove anything in Ruken that contradicts the kit or points at removed rules. history.md has been deleted (owner, 20:02).
- REASON: Line 71 of the slice 3 spec says unit K, which is lane 3, merges "under the standing permission of 2026-11-20 in `history.md` ('Merge PRs yourself once CI, reviews and audits pass, without asking the owner')". Line 201 cites "Lessons carried (`history.md`)". Slice 3 is resuming, so a build session will read these as live instructions. Criterion 5 limits the diff to CLAUDE.md, progress.md and the this-repo SKILL.md. Criterion 6 greps only CLAUDE.md and .claude/, so neither one catches these lines. `docs/superpowers/specs/2026-11-21-sessions-merge-reviewed-prs-design.md:10` quotes the same wording. That spec is the "one older spec" the builder named at 19:59:55.
- EVIDENCE: the two spec files at main fe5f5ee, at the lines above; spec criteria 5 and 6 at cf8844a.
- EXPECTED: No live spec points at history.md or quotes the removed wording.
- FIX (spec only):
  - Add F8. It repoints slice 3 spec line 71 to the 2026-11-21 19:16 UTC standing permission in progress.md History, without the quote, and repoints line 201 to progress.md.
  - Say what happens to the quote in the sessions-merge spec. The recommendation is to drop the wording and keep a dated pointer.
  - Widen criterion 5 to allow those spec files.
  - Widen criterion 6 to `grep -rn "history.md" CLAUDE.md .claude/ docs/superpowers/specs/`, with any line that is only history named as an allowed exception.

## Notes (not blocking)

- **N1:** F7 says the third hook condition is "a backtick", but that is only part of it. At `.claude/hooks/rules.mjs:1126`, the condition fires when the script text holds an interpreter program plus a launcher word. Launcher words include system, exec, spawn, fetch, popen, subprocess, curl or a backtick. It fires either when "gh" and a gh subcommand word appear, or when api.github.com appears. Name both branches and give the line number, so the follow-up hook fix targets the right test.
- **N2:** Appendix B reads only the top-level project chat. The owner also gave instructions as replies inside threads:
  - 19:58:53 (PR-R): the 19:16 permission covers every PR, lane 3 and Cloudflare included.
  - 20:00:27 (PR-R): "check if it's in the mcthaydt-website for apps".
  - 20:02:14 (PR-R): "Delete the hisory.md".
  - 13:45:10 and 13:50:39 (slice 2 thread): the menu tab, and "roll in the phone sign in".
  
  F4 should say that thread replies are covered too.
- **N3:** The 09:22 "yes" answered "Want me to merge lane 3 changes tonight once they pass audit". Quote the question exactly instead of paraphrasing it as "lane 3 merges?".
- **N4:** The 15:00 card "Count pull requests from outsiders toward your limit of 3?" is not quoted. It is the source for the decision that forks are never counted, which the owner chose deliberately.
- Owner-chosen differences checked and kept correctly: history.md is deleted; same-repo PR counting includes docs-only PRs; forks are never counted; commit-authors ignores only the exact proxy footer.
- CRUD: not applicable (rules and docs only). Graphify: not used (Markdown only).
