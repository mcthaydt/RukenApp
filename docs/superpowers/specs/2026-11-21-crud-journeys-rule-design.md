# The journeys create, read, update and delete everything a user can make

Date: 2026-11-21. Status: **spec, revised after plan audit 1 (ea12c3a FAIL, 3 red); waiting on plan audit 2.** Lane 3 (it changes `CLAUDE.md` and the shared skills `build` and `review`, which decide what reviews fail).

Lines marked **Owner** are the owner's words. Lines marked **Call** are this spec's choices; the owner can overrule any of them.

## 0. The owner's direction

- **Owner, 2026-11-21 14:20 UTC:** "At a minimum, our e2e tests should cover the CRUD operations; we didn't have a way to update." Said after Floor Fifty's live screen could not send a new version and no journey covered that update.
- **Owner, 2026-11-21 14:29 UTC:** nothing in Ruken is permanent; everything must be editable, like any professional app.
- **Owner, 2026-11-21 14:32 UTC:** "the e2e covers all CRUD should be a rule, and added to the mcthaydt claude.md for apps".

## 1. The outcome

Every session building Ruken knows, from `CLAUDE.md` and the skills, that the browser journeys must create, read, update and delete everything a user can make; every lane 2 and 3 review and audit checks it and fails a change that leaves one of the four out. The same rule goes into the owner's CLAUDE.md for apps, so the next app starts with it (which file that is: see the **Call** in 2.4).

## 2. The change (this is the plan: three text edits, one pull request)

### 2.1 `CLAUDE.md`, Verification

Add one sentence after "The test hardest to fool comes first.":

> The journeys create, read, update and delete everything a user can make, and a review or audit fails a change that leaves one of the four out (CRUD in `build`).

### 2.2 `.claude/skills/build/SKILL.md`, Quality bar

Add after "Every core journey works end to end, …":

> - **CRUD in the journeys.** For everything anyone can make in the product, staff included (an account, a game, a page, a video, anything they save), the browser journeys create it, read it back where people see it, update it, and delete it or take it off, each checked in the running product. A change that adds or changes something a user can make brings the missing ones in the same pull request. Only the owner can keep a thing from being updated or deleted (a payment record, say): asked as a decision card and recorded with its scope under "Kept on purpose" in `docs/superpowers/history.md`; its journey then checks what the person is told instead.

### 2.3 `.claude/skills/review/SKILL.md`, Checks and reviews

Add after "Review against the acceptance criteria in the brief, …":

> - **CRUD.** For each thing a user can make that the change adds or touches, find the journey in the browser tests that creates it, reads it back, updates it and deletes it; in a plan audit, find the plan step that writes it. Each one missing is red, unless the owner's recorded choice keeps that thing (CRUD in `build`).

### 2.4 Not changed

- **Call:** no new check program. Finding "everything a user can make" needs judgment, which is a review's job (CLAUDE.md, Findings carry evidence: "a review finds what no check encodes").
- **Call:** existing gaps are not this change's. The CRUD audit (#267, `docs/superpowers/audits/2026-11-21-e2e-crud-1-audit.md`) lists them, and the "Fill e2e CRUD test gaps" thread fills them.
- **Call:** the exception exists because some records may have to stay (a payment, a refund). Only the owner grants it, on a decision card, recorded with its scope under a new "Kept on purpose" heading in `history.md`, which the first such choice creates; a brief or a reviewer cannot. The owner's "everything is editable" holds for everything else.
- **Call:** "the mcthaydt claude.md for apps" is read as the rules template in the project's files, `rules/message.md`: it is the owner's own CLAUDE.md and skills text with `[PROJECT]` blanks, which every new app starts from, and the owner's GitHub repos (`mcthaydt/mcthaydt`, `claude-skills`) hold no CLAUDE.md. The coordinator is asking the owner to confirm; if they name another file, the same three edits go there instead. In the template, the examples are general ("an account, a post, a file, anything they save"; "a payment record"), not Ruken's.
- **Call:** "anyone who can make something" includes staff (a send-back reason, an accepted version), not only players and makers.
- `progress.md` gains today's three owner rules (CRUD in the journeys; nothing permanent, everything editable; Opus 5.5 medium when no plan or spec exists) in the spec's pull request, since it is a doc.

## 3. Acceptance criteria

1. `CLAUDE.md`, `build` and `review` on the implementation branch hold the text in 2.1 to 2.3 word for word (`grep -F` on each sentence finds it).
2. The diff of the implementation pull request touches only those three files (and the live-state file, gone before the audit).
3. `pnpm lint`, `pnpm typecheck` and `pnpm test` pass in CI (the rule hooks' own tests are in `pnpm test`).
4. The owner's CLAUDE.md for apps (`rules/message.md` unless the owner names another file) holds the same three edits in its CLAUDE.md, build and review sections, with general examples, and a copy of the file from before the edit beside it.
5. The implementation audit (lane 3) passes on the head commit, and the owner approves the merge.

## 4. Boundaries

No dependency, tool, environment or spend. Expected duration: an hour of work, plus the audits and the owner's approval.

## 5. Open product decisions

None that blocks the build. Which file is "the mcthaydt claude.md for apps" is being confirmed with the owner; it changes only where criterion 4's edits land. The wording above is the agent's, open to the owner's edits.
