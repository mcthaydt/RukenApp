# Plan audit 2: the journeys create, read, update and delete everything a user can make

- Examined: PR #270, commit `5cc2ca8` (branch `claude/project-thread-hw0gcq`): `docs/superpowers/specs/2026-11-21-crud-journeys-rule-design.md` and the three new owner lines in `docs/superpowers/progress.md`. Compared against `main` at `ef720a9` (unchanged since audit 1) and the project's `rules/message.md`.
- Lane: the plan is lane 3 (CLAUDE.md, shared skills `build` and `review`); this is the second plan audit.
- Reviewer: fresh session, Opus 5.5, medium. Graphify not used: the change is rules text, no code.
- Scope note from the coordinator: R3 of audit 1 (the PR body's Claude footer) is a cloud-proxy problem the owner has a command for and another thread is fixing in the hooks; it is not counted against the spec. It is still there at this commit (see "Still open").

**Verdict: PASS, 0 red, 4 notes.**

## Round 1 findings

- **R1, fixed.** 2.2 now says "Only the owner can keep a thing from being updated or deleted (a payment record, say): asked as a decision card and recorded with its scope in `docs/superpowers/history.md`". 2.3 now says "unless the owner's recorded choice keeps that thing". 2.4 now says "Only the owner grants it, on a decision card, recorded in `history.md` with its scope; a brief or a reviewer cannot." The old "named in the brief" and "the owner sees it in the brief" are gone (`git diff ea12c3a 5cc2ca8`). This matches CLAUDE.md's product-choice rule and "Each approval is recorded with its scope".
- **R2, fixed.** 2.4 has a **Call** line naming `rules/message.md` as the chosen reading, with the reason (the owner's template with `[PROJECT]` blanks; `mcthaydt/mcthaydt` and `claude-skills` hold no CLAUDE.md) and what happens if the owner names another file. Section 1 now points to that Call, and criterion 4 says "`rules/message.md` unless the owner names another file". Section 5 says the owner is being asked.
- **R3, not counted** (see scope note).
- **Audit 1 notes:** N1 done (the commit `5cc2ca8` says it writes `progress.md` for the coordinator; "Last updated" now 2026-11-21 14:39 UTC). N3 done (2.4 asks for general examples in the template). N4 done (2.3: "in a plan audit, find the plan step that writes it"). N5 done (2.2 "staff included", 2.4 Call on staff). N2 still open, carried below.

## What was checked again

- The three anchors are still on `main` word for word: CLAUDE.md:51 "The test hardest to fool comes first."; `build` SKILL.md:12 "Every core journey works end to end, …"; `review` SKILL.md:15 "Review against the acceptance criteria in the brief, …". In `rules/message.md`: line 53 (CLAUDE.md text), line 320 (build), line 102 (review). Criteria 1 and 4 are doable.
- No other open branch edits CLAUDE.md or the `build`/`review` skills (checked every remote branch's diff against `main`), so the implementation will not collide. The "everything editable" branch (`claude/project-thread-kjfg1t`) still changes only its spec.
- The only hook config that names the two skills is `ruleMix`'s path list (`.claude/hooks/rules.json:115-118`); the plan touches only rules files, so it passes. No test copies the Quality bar or the review bullets, so criterion 3 should hold.
- The 2.1, 2.2 and 2.3 texts agree with each other: CLAUDE.md points to "CRUD in `build`"; `build` sets the rule and the owner-only exception; `review` makes each missing journey red unless the owner's recorded choice keeps the thing.
- No live-state file is on the branch (`docs/superpowers/live/` absent), as the spec stage's handoff needs.
- Section 5 lists no blocking product decision; the file question changes only where criterion 4's edits land, and the spec says so.

## Notes (not blocking, recorded)

- N1. "Recorded with its scope in `docs/superpowers/history.md`" names no section. `history.md` has Setup, Standing permissions, Flaky tests, Known issues and Lessons; an owner's "keep this" is a product decision, not a standing permission. The implementer can name a heading (for example "Kept on purpose") in the build text so reviewers know where to look. Files: the spec, then the three rules texts.
- N2. Once merged, the `build` line "A change that adds or changes something a user can make brings the missing ones in the same pull request" applies to every pull request that touches a game, a page or a video while the gaps listed in #267 are still open. Until the "Fill e2e CRUD test gaps" thread lands, such pull requests will be sent back for journeys that thread is already writing. That is the owner's rule working as asked; the coordinator may want to sequence the gap thread first. No spec change needed.
- N3. Criterion 4 edits `rules/message.md` in the project's shared files, outside the pull request, and does not say when. Editing the owner's template is a rules change (lane 3); doing it only after the owner approves the merge (criterion 5), with the before-copy beside it, keeps it in step with the repo.
- N4. Carried from audit 1 N2: today's owner decisions at 14:26 (a deleted maker's games come off with the account) and 14:31 (name and one line stay instant; a wrong birthday is fixed by asking Ruken) are not in `progress.md`. Coordinator's record, outside this spec.

## Still open (outside the spec)

- PR #270's body still ends "_Generated by [Claude Code](https://claude.ai/code)_" at this commit (`gh api repos/mcthaydt/RukenApp/pulls/270 --jq .body`; the `prBody` hook flagged it again). It needs the owner's command from their computer before merge.

## Re-audit

None needed for the plan. The implementation audit (lane 3) runs on the implementation pull request's head commit.
