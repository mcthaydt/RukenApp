# Align Ruken's rules and records with the apps kit

Lane 3 (it changes a standing-permission record, which decides what needs the owner). Staged path: this spec, its plan audit, one implementation pull request, its implementation audit.

## Outcome

Nothing in RukenApp's rules or process records contradicts the owner's apps workflow kit.

The owner, 2026-11-21 20:19 UTC: "Remove ANYTHING that contradicts from the workflow that we established in mcthaydt-website apps".

## Source of truth

- The kit as published at https://mcthaydt.com/prompts/claude-md-apps/, read on 2026-11-21 with `curl` (HTTP 200, 990,351 bytes): its CLAUDE.md, the shared skills, `verify`, `.claude/settings.json`, `.claude/after-compaction.md`, `.claude/hooks/rules.mjs`, `.claude/hooks/rules.json` and the Project instructions block.
- Plus the three owner rules that mcthaydt-website draft pull request #99 adds to the kit: ask the owner only about product choices, new access or money, and scope changes; every session follows the hooks; the browser journeys cover all CRUD.
- Plus the owner's later word on Ruken: `docs/superpowers/history.md` is deleted and its records live in the History section of `progress.md` (owner, 2026-11-21 20:02 UTC). That is a choice the owner made for Ruken, so it is not reopened here.
- Ruken also differs from the kit on purpose, by the owner's own choices, in ways stricter than the kit. None of these is to be "aligned" away: every same-repo pull request counts toward the limit of 3, docs-only ones included (the kit's `onlyRulesAndDocs` exempts rules-and-docs branches), and fork pull requests are never counted or closed (owner cards, PR-H); `commit-authors` ignores only the exact proxy footer (`footerStrippedByCi` and `proxyFooter` in `rules.json`; owner card, PR-H); and `settings.json` allows the GitHub merge, disable-auto-merge and update tools behind blocking hooks (owner, 2026-11-21 06:54 UTC, "add a permission rule").

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

**F3. Other sections above History are behind.**
- Where and evidence, each measured from GitHub or `date`:
  - "Everything editable": Unit D "waiting for a pull request slot and its lane 3 audit", and the purge row "(#268 ...)" as if open. #274 (Unit D) merged 2026-11-21 19:16 UTC, #268 16:00 UTC, #276 (Unit A) 20:00 UTC, #277 (18+ gate) 20:07 UTC.
  - "Slice 2": the slice end is "in progress, branch `claude/project-thread-7wmhqn`". That branch no longer exists, and its pull request #266 merged 2026-11-21 14:26 UTC.
  - "Slice 3 parked": "Units D and I are paused". The owner's 14:32 UTC word (F4) is that slice 3 unparks once the editing work lands; #274 and #276 have merged.
  - "Last updated: 2026-11-21 16:00 UTC".
  - No stage rows. CLAUDE.md Settings: "the coordinator keeps each stage's row in `progress.md` up to date, with a percentage from the plan's ticked steps"; `staged-path`, Splitting: each unit's "status is in `progress.md`".
- Expected: every section above History states what is true now, and each open stage or unit has a row.
- Fix: bring each of those sections current from GitHub; mark slice 3 as resuming under the owner's 14:32 UTC word, naming the merges that met its condition; set "Last updated" from `date`; add a "Stages" table with one row per open stage or unit: its pull request or thread, its status, and a percentage from its plan's ticked steps, or "short path, no plan", or "not measured" where it cannot be measured.

**F4. Owner instructions missing from the record.**
- Where: `progress.md`, "The owner's instructions".
- Evidence: the Project instructions and the kit's `owner-updates` say each owner instruction goes into `progress.md` in the turn it is given. Project memory (its index and the `owner-*`, `notion-ruken-page` and `private-notes-notion` files) holds the entries in Appendix A, none of which `progress.md` has.
- Expected: every owner instruction in project memory is in the record with its date. One already carried out is marked done, with where.
- Fix: the implementer checks every owner entry in project memory against `progress.md` again at build time (memory may have grown since this spec) and adds each missing one, quoting the owner's words where memory quotes them and writing "(paraphrase)" where it does not. Appendix A is the list as of this spec, a floor and not a limit.
- Kept as is: the Standing permissions line of 2026-11-20 quotes "without asking the owner". It is a dated quote, a record and not a rule, so the 19:59 UTC instruction does not remove it.

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
2. Every owner entry in project memory at build time is in `progress.md` with its date (Appendix A as a floor).
3. No section above History names a branch that does not exist or a merged pull request as open, and "Last updated" comes from `date`.
4. `progress.md` has a "Stages" table with a row, a status and a percentage (or "short path, no plan", or "not measured") for each open stage or unit.
5. `git diff main --stat` on the implementation branch lists only `docs/superpowers/progress.md` and `.claude/skills/this-repo/SKILL.md` (plus the live-state file, deleted before the audit).
6. `grep -rn "history.md" CLAUDE.md .claude/` finds nothing.
7. No hook file, `settings.json` or workflow changes: `git diff main -- .claude/hooks .claude/settings.json .github` is empty.
8. Every fact added is measured: each merge time comes from `gh api`, each time from `date`.
9. The pull request's checks are green on its head, and the implementation audit names that commit with PASS.

## Plan

| Unit | Waits on | Files | Output | Check |
|---|---|---|---|---|
| 1. Fix F1 to F5 | #279 merged; this spec merged; the comparison rerun on that `main` ("What was compared" was measured on PR-R's head) | `docs/superpowers/progress.md`, `.claude/skills/this-repo/SKILL.md` | one pull request, lane 3 | criteria 1 to 9 |

Expected duration: 1 hour of work after #279 merges, plus the audits and CI.

Boundaries: no new dependency, tool, environment or spend. Open product decisions: none; the owner's 20:19 UTC instruction covers the change.

## Appendix A: owner instructions in project memory that `progress.md` lacks

As read from project memory on 2026-11-21. Words in quotes are the owner's as memory quotes them; the rest is memory's paraphrase.

- 2026-11-20 22:32 UTC: "connect to my computer and run it", the one-time run of the setup command batch on the owner's Mac. Done (setup steps 1 to 4 ran). Project memory now records the kit rule that no session runs on the owner's computer for Ruken, a public repo.
- 2026-11-20 22:33 UTC: "Create a new Finish Ruken thread once we're fully set up". Done.
- 2026-11-20 23:38 UTC: "What's the holdup, this is taking too long" (how to apply, a paraphrase: run independent units side by side, up to the Settings limits).
- 2026-11-21 00:05 UTC: "We need to approve floor fifty again". Done.
- 2026-11-21 00:09 UTC: "get me a new jobs secret". Done; the secret lives in the owner's Keychain, never in the repo.
- 2026-11-21 03:12 UTC: "We need to clean up our tests for our new paradigm for starters".
- 2026-11-21 03:26 UTC, card: browser tests run on three devices, "iPhone, iPad, computer".
- 2026-11-21 06:05 UTC, card: "Yes, start it" to "Should CI take screenshots only of the screens a change touches?"
- 2026-11-21 06:54 UTC: "add a permission rule" (let sessions mark ready and merge audited pull requests with a merge commit).
- 2026-11-21 08:56 UTC: "Yes" to keeping the Notion Ruken page current.
- 2026-11-21 08:57 UTC: "this should be my second brain for Ruken; it effectively replaces Ruken Private".
- 2026-11-21 09:17 UTC: yes to private notes going to the Notion Ruken page, not RukenPrivate (paraphrase).
- 2026-11-21 14:26 UTC: the Floor Fifty fix must "just edit the submission; no need for new button".
- 2026-11-21 14:28 UTC, card: "Everything, reviewed first".
- 2026-11-21 14:31 UTC, cards: "Keep them instant" (name and line) and "Ask Ruken for help" (a wrong birthday). Already in `progress.md` as a paraphrase; add the card words.
- 2026-11-21 14:32 UTC: work slice by slice; per slice fix broken things and must-haves (editability, CRUD in the journeys) and save polish for an end pass; unpark slice 3 once the editing work lands (paraphrase).
- 2026-11-21 14:41 UTC, card: "Keep the address" (a live game's address stays frozen when renamed).
- 2026-11-21 15:07 to 15:08 UTC: on a card, add the owner's phone to their existing email account; "I need to change my email anyway"; "I did the real codes stuff already"; "Lane 3 is permitted" (for #209).
- 2026-11-21 19:16 UTC: "Yes do the fix, these are things that I should not need to intervene for, I created a workflow that should not need my intervention."
- 2026-11-21 19:30 UTC: check CLAUDE.md before any card or question; ask only about product choices, new access or money, and scope changes (paraphrase; CLAUDE.md carries the rule).
- 2026-11-21 19:59 UTC: "merge without asking" must not appear as a written rule anywhere (paraphrase).
- 2026-11-21 20:02 UTC: "Delete the history.md". Done in #279.
- 2026-11-21 20:19 UTC: "Remove ANYTHING that contradicts from the workflow that we established in mcthaydt-website apps". This work.
- PR-H cards (2026-11-21): `commit-authors` ignores only the exact proxy footer; docs-only pull requests count toward the limit; only same-repo pull requests count, and fork ones are never counted or closed.
