# Align Ruken's rules and records with the apps kit

Lane 3 (it changes a standing-permission record, which decides what needs the owner). Staged path: this spec, its plan audit, one implementation pull request, its implementation audit.

## Outcome

Nothing in RukenApp's rules or process records contradicts the owner's apps workflow kit.

The owner, 2026-11-21 20:19 UTC: "Remove ANYTHING that contradicts from the workflow that we established in mcthaydt-website apps".

## Source of truth

- The kit as published at https://mcthaydt.com/prompts/claude-md-apps/, read on 2026-11-21 with `curl` (HTTP 200, 990,351 bytes): its CLAUDE.md, the shared skills, `verify`, `.claude/settings.json`, `.claude/after-compaction.md`, `.claude/hooks/rules.mjs`, `.claude/hooks/rules.json` and the Project instructions block.
- Plus the three owner rules that mcthaydt-website draft pull request #99 adds to the kit: ask the owner only about product choices, new access or money, and scope changes; every session follows the hooks; the browser journeys cover all CRUD.
- Plus the owner's later word on Ruken: `docs/superpowers/history.md` is deleted and its records live in the History section of `progress.md` (owner, 2026-11-21 20:02 UTC). That is a choice the owner made for Ruken, so it is not reopened here; it is the one known place Ruken differs from the kit on purpose.

The base is `main` after pull request #279 (PR-R) merges.

## What was compared, and what already matches

Measured against PR-R's head (`cdc520b`) and `main` (`fe5f5ee`), sentence by sentence:

- `CLAUDE.md`: the kit's text with Ruken's blanks filled, plus the three #99 rules (hooks and owner questions from PR-R, CRUD from #278), plus the `history.md` → `progress.md` repointing. Lane 3's line reads "plan audit and implementation audit, and green CI" where the kit says "checks and reviews"; that is the same requirement (Settings, Audits by lane). No contradiction.
- Shared skills (`review`, `release`, `visual-check`, `build`, `staged-path`, `owner-updates`): the kit's text plus the CRUD lines and the `history.md` repointing. No contradiction.
- `.claude/after-compaction.md`: word for word.
- `.claude/settings.json`: the kit's hooks plus extra blocking hooks on the GitHub merge, update and create tools and the owner's merge-tool permission rule (2026-11-21 06:54 UTC). Stricter, not weaker. Left alone.
- `.claude/hooks/rules.mjs`, `pr-rules.mjs`, `pr-rules-lib.mjs`, `rules.json`: the kit's checks plus PR-H's route checks. Stricter. Left alone (the brief says never weaken a hook).
- `verify`: the kit's template filled in for Ruken. No contradiction.
- Old dated specs and audits: records, not rules. Left alone.

## Findings

**F1. A standing permission that removes required checks.**
- Where: `docs/superpowers/progress.md`, History, Standing permissions: "2026-11-20, the owner: "Small reviewed fixes can merge on the quick checks alone." (restart handoff)".
- Evidence: CLAUDE.md, Risk: "Standing permission removes a repeated approval request; it never lowers the lane or removes required checks and reviews." `release`, Lanes and merging: "On a public repo the full run after ready for review is the one that counts", and lane 2 needs "the full run, not the quick one".
- Expected: no recorded permission lets a merge skip the full run.
- Fix: keep the line as a record and mark it not in force, citing the owner's 20:19 UTC instruction and the two rules above.

**F2. The active milestone says setup is not merged.**
- Where: `progress.md`, "Active milestone: setup and "Finish Ruken"": "Current work: the setup check ...", "Completed: None merged yet.", "Remaining: Merge the setup pull request; ... a one-line pull request that turns `ruleMix.firstTimeSetup` off".
- Evidence: #240 merged 2026-11-20 23:02 UTC and #241 (first-time setup off) 23:42 UTC; `rules.json` has `"firstTimeSetup": false`; `main`'s branch protection requires `gate` and `commit-authors` (`gh api repos/mcthaydt/RukenApp/branches/main/protection`). The kit's `owner-updates`: progress.md holds "current work, completed outcomes within the active milestone, remaining work".
- Expected: the milestone states what is true now.
- Fix: setup goes to History as done, with its pull requests; the active milestone keeps only "Finish Ruken" with the merges measured from GitHub.

**F3. The Everything editable section is behind.**
- Where: `progress.md`, "Everything editable": Unit D "waiting for a pull request slot and its lane 3 audit"; the purge row "(#268 ...)" as if open.
- Evidence: #274 (Unit D) merged 2026-11-21 19:16 UTC; #268 merged 16:00 UTC; #276 (Unit A) merged 20:00 UTC; #277 (18+ gate) merged 20:07 UTC.
- Expected and fix: as F2.

**F4. Owner instructions missing from the record.**
- Where: `progress.md`, "The owner's instructions".
- Evidence: the Project instructions and `owner-updates` say each owner instruction goes into `progress.md` in the turn it is given. These are in project memory but not in the file: 14:32 UTC (work slice by slice: per slice fix broken things and must-haves, save polish for an end pass; slice 3 unparks once the editing work lands), 19:30 UTC (ask the owner only about product choices, new access or money, and scope), 19:59 UTC (take "merge without asking" out of the written rules), 20:02 UTC (delete history.md), and 20:19 UTC (this work).
- Expected: every owner instruction is in the record, with its date.
- Fix: add them, quoting the owner's words where the memory quotes them and marking a paraphrase as one.

**F5. `this-repo` says branch protection is missing, and leaves out a workflow.**
- Where: `.claude/skills/this-repo/SKILL.md`, CI: "As of the 2026-11-20 setup check it requires neither: missing until the owner runs step 1"; the CI list names `ci.yml` and `commit-authors.yml` only.
- Evidence: protection now requires `gate` and `commit-authors` (measured above); PR-R adds `.github/workflows/pr-rules.yml`. The kit: "A repo's own layout, CI and rules go in its `this-repo` skill".
- Expected: `this-repo` names the required checks as they are and every workflow.
- Fix: replace the stale sentence with the measured required checks; add one line for `pr-rules.yml` saying what it checks.

## Not changed here, reported instead

- Lines in the Ruken project's instructions that differ from the kit (the session cannot edit them) go to the coordinator in the report.
- Project memory lines that differ from CLAUDE.md go to the coordinator in the report.

## Acceptance criteria

1. F1 to F5 are fixed as written, and no other file changes except this spec and the audit files.
2. `git diff main --stat` on the implementation branch lists only `docs/superpowers/progress.md` and `.claude/skills/this-repo/SKILL.md` (plus the live-state file, deleted before the audit).
3. `grep -rn "history.md" CLAUDE.md .claude/` finds nothing.
4. No hook file, `settings.json` or workflow changes: `git diff main -- .claude/hooks .claude/settings.json .github` is empty.
5. Every fact added is measured: each merge time comes from `gh api`, each time from `date`.
6. The pull request's checks are green on its head, and the implementation audit names that commit with PASS.

## Plan

| Unit | Waits on | Files | Output | Check |
|---|---|---|---|---|
| 1. Fix F1 to F5 | #279 merged; this spec merged | `docs/superpowers/progress.md`, `.claude/skills/this-repo/SKILL.md` | one pull request, lane 3 | criteria 1 to 6 |

Expected duration: 1 hour of work after #279 merges, plus the audits and CI.

Boundaries: no new dependency, tool, environment or spend. Open product decisions: none; the owner's 20:19 UTC instruction covers the change.
