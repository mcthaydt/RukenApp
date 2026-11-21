# History

## Setup

- 2026-11-20 setup check, on `main` at `c8c21e5`. Superpowers 7.0.2. CLAUDE.md, the shared skills, the rule hooks and `.claude/settings.json` come word for word from the owner's rules text, with the blanks filled for Ruken. `this-repo`, `verify` and the CI workflows (`ci.yml`, `commit-authors.yml`) are restored from `2f1bde5^`, the last commit before the cleanup.
  - Stack checks on `main` (`c8c21e5`), in a cloud container on Node 24: install, lint, typecheck, unit tests (111 files, 1,596 tests) and build passed. `test:pg` and `test:browser` run in CI.
  - CI gate: present (restored): `ready_for_review` trigger, the `changes` job and the `gate` job; `commit-authors` stays its own workflow so a text edit does not rerun every test.
  - Branch protection: missing. `main` requires no checks since the cleanup; owner step 1 adds `gate` and `commit-authors`. It does not require branches to be up to date.
  - Merge queue: not available (the repo is owned by a person), so the session that merges runs it by hand.
  - Graphify: found; RukenApp is indexed.
  - Auto-merge: allowed. Merged branches are deleted by GitHub.
  - Session tools: threads start through the coordinator; this thread cannot start, choose a model for or archive sessions itself.
  - Compaction and rule hooks: present in `.claude/settings.json`; `--check` reports no blanks. Cloud sessions start one folder above the repo, so the hooks load there only once the owner pastes `owner-steps/cloud-setup-script.sh` into the environment's setup script. `firstTimeSetup` is still on until the follow-up pull request.
  - `verify`: present (restored); its start times are from older commits and are measured again on its next run.
  - Not in the owner's text: `.claude/hooks/` is left out of ESLint and Prettier so the owner's files stay word for word.

## Standing permissions

- 2026-11-20, the owner: "Merge PRs yourself once CI, reviews and audits pass, without asking the owner. Live Cloudflare and console switches still need the owner." (restart handoff)
- 2026-11-20, the owner: "Small reviewed fixes can merge on the quick checks alone." (restart handoff)
- First-time setup: the owner's request is the standing permission for the setup check (CLAUDE.md, Risk).

## Flaky tests

Each failed once and passed on its one rerun. Root causes and fixes are in pull request #242.

- `tests/browser/make-design-pass.test.ts:284` "a 56-letter name in a question's heading › on an iPhone SE held sideways › the box is above the bar" [phone-landscape], run 44829777713 at `af7ec29`: "there is nothing on the page to measure" for `.acts`. Cause: `addDraft` waited only for the address to become `/line`, which changes a moment before the screen does, so the journey measured the name question's bar while it was being taken away. Fix: `addDraft` waits for question 2's box.
- `tests/browser/look.test.ts:85` "a missing page: one paper card ..." [tablet-landscape], run 44793990472 at `3c907cf`: "Protocol error (Page.captureScreenshot): Unable to capture screenshot" in `showTheOwner`, after the screen's checks had passed. Cause: Chromium could not draw a full-page frame on a busy runner. Fix: that picture, which checks nothing, is replaced by a note saying it could not be taken; the journey's checks stand. Gap: the Owner's screens page can miss that one picture on such a run.
- `tests/browser/connect-github.test.ts:23` and `:131` [tablet-landscape], run 44835171025 attempt 1 at `a8a4e08`: a 5-second click timeout on "Create account" (the sign-up had worked: the page was home, signed in), and an answer still "Saving…" after 5 seconds. Cause: the site in a journey is one `wrangler dev` process on a four-core runner; while the other worker's journey kept it busy, one answer took over 5 seconds. Fix: waits for the site's answer get 15 seconds (`expect` in `playwright.config.ts`, and every press of "Create account" or "Sign in" that waits for the next page); finding a button still fails in 5.

## Lessons

None yet.
