# Apps kit practice audit, cycle 1

Examined: `main` at `f0ccc09` (2026-11-22 01:25 UTC, from `date`), the open and recently merged pull requests (#265 to #288, read with `gh api`), the project's shared files, and the apps kit at https://mcthaydt.com/prompts/claude-md-apps/ (read the same minute).

The owner asked on 2026-11-22 01:21 UTC: "get us aligned with our workflow; all of our issues is you not following the workflow". #284 already made the rule text match the kit; this audit asks whether the repo and its sessions do what the text says. Owner overrides that win over the kit: `history.md` is gone (its records live in `progress.md`, History), the open pull request limit is moving to 6 (its own thread), and the owner's standing permission to merge.

Out of scope here: CI speed and test pruning (the "Speed up CI" thread, which also owns the owner's 01:20 UTC "primarily e2e" rule), and the open pull request limit (its own thread).

## What already matches the kit

- CLAUDE.md and the eight skills match the kit word for word, apart from the filled blanks, the owner's own rules (Hooks, when to ask, CRUD) and `history.md` folded into `progress.md` (diffed against the kit page).
- Code layout: features under `src/features/<feature>/`, each with its `<feature>.ts` entry; `src/lib/` imports no feature; no test in `src/`; `tests/` mirrors `src/`; `tests/architecture.test.ts` holds one ordered feature list and fails on an upward import (read 2026-11-22). Ruken has no `src/index.ts` or `scripts/`: it is a SvelteKit site whose surface is `src/routes/`, so neither has a user.
- Settings: six browser pieces (`.github/workflows/ci.yml:313`); three device profiles, phone, tablet and computer (`playwright.config.ts:146-148`).
- CI: draft quick run, full run on ready, `gate` and `commit-authors` required, merge queue reported as not available and run by hand (`this-repo`, CI).
- Verdict lines: every merged lane 2 or 3 pull request read has a `<commit> PASS` comment on the commit it merged (#265, #266, #271, #274, #276, #282, #283, #286, #287).
- Hooks: `.claude/hooks/rules.mjs` and `rules.json` hold everything the kit's copy holds, plus the PR-route checks (#275, #279).

## Gaps

Each gap: what is wrong, the evidence, what the kit expects, and the bounded fix. "This pull request" is the one that carries this file.

### P1. Audits were kept outside the repo (red)

- Evidence: 42 audit files exist only in the project's shared folder (`audits/`), none in `docs/superpowers/audits/`: every implementation audit for units A, B and D, the 18+ gate, unit I (`edit-page-1`, `edit-page-2`), the maker's page, the feed screen, phone sign-in, the hooks routes and the apps-kit alignment itself. #286's body cites `audits/2026-11-21-edit-page-2-implementation-audit.md`, a path not in the repo.
- Expected: the reviewer commits its audit file on the branch it reviewed, at `docs/superpowers/audits/<date>-<topic>-<cycle>-...-audit.md` (`review`, Audits; `staged-path`, Writing).
- Fix: this pull request commits the 42 files as they are. From now on each reviewer commits its own file on the branch (P8).

### P2. `progress.md` is out of date (red)

- Evidence: "Last updated: 2026-11-21 21:43 UTC". Since then #284 (21:58), #283 (22:53), #286 (00:30) and #287 (01:09) merged, #285 and #288 opened, and the owner gave two instructions (00:36 UTC "lets bump to 6", 01:20 UTC "We should have primarily e2e tests") that are not in it. Its Stages table still lists the apps-kit alignment and #283 as open.
- Expected: the record's writer keeps it current with each substantive update, writes each owner instruction in the turn it is given, and marks each merge complete (`owner-updates`, Keep a visible record; `release`, Lanes and merging, last bullet).
- Fix: this pull request brings it up to date. Keeping it current is the coordinator's job (P8).

### P3. Stage rows carry no percentage, and plans are not ticked (red)

- Evidence: every row in `progress.md`, Stages, says "not measured". The feed spec's plan has 5 of 32 steps ticked, though units F (#247), H (#249) and I (#286) merged: 20 of its 31 live steps are done (one is struck). The everything-editable, purge, CRUD, hooks and apps-kit specs have no checklist at all.
- Expected: "the coordinator keeps each stage's row in `progress.md` up to date, with a percentage from the plan's ticked steps" (Settings); the implementer updates "the markdown tracking document and overall progress percentage dynamically" (`staged-path`, execution prompt).
- Fix: this pull request ticks the feed spec's merged steps and gives slice 3 its percentage. From now on every plan is a checklist that the implementer ticks on its branch, and the coordinator copies the percentage into its row (P8).

### P4. No session keeps a live-state file (red)

- Evidence: `git log --all -- docs/superpowers/live/` is empty: no session has ever committed one.
- Expected: every session that writes keeps `docs/superpowers/live/<branch>.md` (task, last commit, next step, open decisions), commits it at each milestone and deletes it in its last commit before the audit or merge (CLAUDE.md, Live state in a file). The `liveState` hook only checks the deletion, so nothing caught the missing file.
- Fix: this pull request's branch keeps one and deletes it before ready. Every thread prompt says so from now on (P8).

### P5. Slice 2 closed without its retrospective or blind judge (red)

- Evidence: no retrospective file, rule-change pull request or "nothing to learn" report for slice 2 anywhere in the repo or the project's files; no blind judge pick in `progress.md` (`grep -ri retrospective`, `grep -i "blind judge"`, 2026-11-22). Slice 3 started anyway.
- Expected: every slice ends with the walk, the design rounds, the blind judge (step 4, once per slice), the two screens pages, the owner's walk and last the retrospective; the next slice starts once the retrospective's pull request is open or it reports nothing to learn (`staged-path`, Slice end and Retrospective; `visual-check`, step 4).
- Fix: a fresh retrospective thread for slice 2 (Opus 5.5, medium), which also reviews this audit's gaps as lessons. The blind judge for slice 2 is not run after the fact: the owner approved those screens; slice 3's end runs it.

### P6. Pull requests leave out kit records (red)

- Evidence: only #283 records the three commits of the hand-run merge queue ("Commits: reviewed 9c0ed5f / ff18424"); #265, #266, #271, #276, #282, #286 and #287 do not. #286 (new screens for unit I) records no words-and-design check (`visual-check` step 1) and no run through `verify`, only test runs.
- Expected: "The pull request records three commits: the one reviewed, the integration commit tested ... and the `main` commit it was tested with" (`release`, Lanes and merging). A pull request that touches what people see is not green until its visual check is done (`release`, `visual-check`). A behavior change is run like a person through `verify` before it is called done (`build`, Verification).
- Fix: each implementer's body carries a "Commits" line, a "Visual check" line when screens change, and a "Run like a person" line. Told to every thread (P8).

### P7. `verify` lists two journeys (red)

- Evidence: `.claude/skills/verify/SKILL.md`, The journeys, has Home and Sign up only, and points at `tests/browser/` for the rest.
- Expected: "One line each, from a person's side: where it starts, the steps, and what they see at the end" (kit's `verify`), for the journeys a builder walks.
- Fix: this pull request adds one line for each journey a person can take today, from the journey tests' own steps.

### P8. Coordinator and thread practice (red, not a file)

The rules are right; the sessions skipped them. From now on every thread prompt the coordinator writes names, beside the model, effort and Graphify:

1. Keep `docs/superpowers/live/<branch>.md`; delete it before the audit or merge (P4).
2. A reviewer commits its audit file on the branch it reviewed, never only in the shared folder (P1).
3. A plan is a checklist; the implementer ticks it as it goes (P3).
4. The body records the three commits, the visual check when screens change, and the `verify` run when behavior changes (P6).
5. The coordinator updates `progress.md` (row, percentage, owner instructions) at each merge and each owner instruction, or asks the implementer to (P2, P3).

Sent to the coordinator with this audit.

### P9. Flaky tests with no thread for their root cause (red)

- Evidence: `progress.md`, Flaky tests: `tests/browser/play.test.ts:41` and `tests/browser/pay.test.ts:41` say "Root cause not found yet", and no open pull request or thread works on them.
- Expected: a flaky test's root cause is fixed in its own thread (`build`, Quick and steady).
- Fix: one thread for both (Opus 5.5, medium); after the tries in Settings, `build`'s delete-and-replace rule applies.

### P10. Screenshots kept after the owner looked (note)

- Evidence: the project's shared folder keeps `screens/everything-editable-unit-a/`, `-round2/` and `-round3/` (over 100 pictures) after unit A merged (#276, 2026-11-21 20:00 UTC).
- Expected: once the owner has looked, "nothing keeps a copy of them" (`visual-check`, Screens page).
- Fix: delete those folders. Not done here: a bulk delete waits for the owner's word.

### P11. `this-repo` misses the feed feature (note)

- Evidence: `.claude/skills/this-repo/SKILL.md`, Layout, lists eight features; `src/features/feed/` is the ninth.
- Fix: this pull request adds it.

## Not gaps

- The kit's default stack (bun for tests and checks, Workers Builds deploying `main`) is for new apps; Ruken is its reference and keeps Vitest and the owner's manual deploy. CI tools are the "Speed up CI" thread's.
- `FEATURE_ORDER` in `tests/architecture.test.ts` lists `moderation` and `admin` before they exist, as its comment says a feature is added "in its place, before it is built".
