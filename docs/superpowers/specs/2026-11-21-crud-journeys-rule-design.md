# The journeys create, read, update and delete everything a user can make

Date: 2026-11-21. Status: **spec, waiting on plan audit 1.** Lane 3 (it changes `CLAUDE.md` and the shared skills `build` and `review`, which decide what reviews fail).

Lines marked **Owner** are the owner's words. Lines marked **Call** are this spec's choices; the owner can overrule any of them.

## 0. The owner's direction

- **Owner, 2026-11-21 14:20 UTC:** "At a minimum, our e2e tests should cover the CRUD operations; we didn't have a way to update." Said after Floor Fifty's live screen could not send a new version and no journey covered that update.
- **Owner, 2026-11-21 14:29 UTC:** nothing in Ruken is permanent; everything must be editable, like any professional app.
- **Owner, 2026-11-21 14:32 UTC:** "the e2e covers all CRUD should be a rule, and added to the mcthaydt claude.md for apps".

## 1. The outcome

Every session building Ruken knows, from `CLAUDE.md` and the skills, that the browser journeys must create, read, update and delete everything a user can make; every lane 2 and 3 review and audit checks it and fails a change that leaves one of the four out. The same rule goes into the owner's CLAUDE.md for apps, the rules template in the project's files (`rules/message.md`), so the next app starts with it.

## 2. The change (this is the plan: three text edits, one pull request)

### 2.1 `CLAUDE.md`, Verification

Add one sentence after "The test hardest to fool comes first.":

> The journeys create, read, update and delete everything a user can make, and a review or audit fails a change that leaves one of the four out (CRUD in `build`).

### 2.2 `.claude/skills/build/SKILL.md`, Quality bar

Add after "Every core journey works end to end, …":

> - **CRUD in the journeys.** For everything a user can make (an account, a game, a page, a video, anything they save), the browser journeys create it, read it back where people see it, update it, and delete it or take it off, each checked in the running product. A change that adds or changes something a user can make brings the missing ones in the same pull request. A thing the product keeps on purpose, such as a payment record, is named in the brief with the reason, and its journey checks what the person is told instead.

### 2.3 `.claude/skills/review/SKILL.md`, Checks and reviews

Add after "Review against the acceptance criteria in the brief, …":

> - **CRUD.** For each thing a user can make that the change adds or touches, find the journey in the browser tests that creates it, reads it back, updates it and deletes it. Each one missing is red, unless the brief names that thing as kept on purpose.

### 2.4 Not changed

- **Call:** no new check program. Finding "everything a user can make" needs judgment, which is a review's job (CLAUDE.md, Findings carry evidence: "a review finds what no check encodes").
- **Call:** existing gaps are not this change's. The CRUD audit (#267, `docs/superpowers/audits/2026-11-21-e2e-crud-1-audit.md`) lists them, and the "Fill e2e CRUD test gaps" thread fills them.
- **Call:** the "kept on purpose" exception exists because some records must stay (a payment, a refund). It is narrow: named in the brief, with a reason, and the owner sees it in the brief. The owner's "everything is editable" still holds for everything else.
- `progress.md` gains today's three owner rules (CRUD in the journeys; nothing permanent, everything editable; Opus 5.5 medium when no plan or spec exists) in the spec's pull request, since it is a doc.

## 3. Acceptance criteria

1. `CLAUDE.md`, `build` and `review` on the implementation branch hold the text in 2.1 to 2.3 word for word (`grep -F` on each sentence finds it).
2. The diff of the implementation pull request touches only those three files (and the live-state file, gone before the audit).
3. `pnpm lint`, `pnpm typecheck` and `pnpm test` pass in CI (the rule hooks' own tests are in `pnpm test`).
4. `rules/message.md` in the project's files holds the same three edits in its CLAUDE.md, build and review sections, with a copy of the file from before the edit beside it.
5. The implementation audit (lane 3) passes on the head commit, and the owner approves the merge.

## 4. Boundaries

No dependency, tool, environment or spend. Expected duration: an hour of work, plus the audits and the owner's approval.

## 5. Open product decisions

None. The owner asked for the rule; the wording above is the agent's, open to the owner's edits.
