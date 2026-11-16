# History

Written by the rules setup session on the coordinator's behalf, because the coordinator cannot write to the repo
(CLAUDE.md, "Writing"). Earlier process records were removed in #159; an earlier rules attempt (#160) was reverted in
#161 on the owner's word. Git history keeps both.

## Setup

Setup check from `release`, run 2026-11-16 18:07 UTC on `main` at `8dca316`. Each item as `release` lists it:

- **Owner-only steps as one batch of CLI commands:** present. The batch is under "Owner steps" in `progress.md`.
- **The commands in Stack and checks run and pass on `main`:** present for the unit checks. In a cloud container on
  `8dca316` plus only these `.md` files: install, `pnpm lint`, `pnpm typecheck` (0 errors, 0 warnings), `pnpm test`
  (108 files, 1536 tests) and `pnpm build` all exited 0. That container has Node 22.23.4, not the Node 24 the repo
  asks for. `pnpm test:pg` and `pnpm test:browser` were not run there (no database, and the owner runs browser tests
  in CI); the last CI push run on `main` (`3da364c`, #112, 2026-11-15) passed them.
- **CI triggers, with `ready_for_review`:** present (`ci.yml`, `pull_request` types include it; push to `main`).
- **The job that decides which checks apply:** present (`changes`, "what changed": docs-only or not).
- **The final aggregate gate job:** added in #162 (`gate` in `ci.yml`), on the owner's words of 2026-11-16: "yes to
  1–3, keep 12".
- **The gate is required by branch protection on `main`:** missing until the owner runs the command under "Owner
  steps" in `progress.md`. Required today: `verify`, `browser`, `postgres`, strict (up to date with `main`),
  force-push off.
- **Session tools for the staged path:** messaging present (`send_message`, thread messages); archiving present
  (`archive_session`); model choice present (`switch_model`); starting sessions belongs to the coordinator and was not
  checked from this thread.
- **Superpowers version:** 7.0.2 (the plugin's `plugin.json`; no commit hash is exposed in this runtime).

Where Superpowers 7.0.2 disagrees with these rules (these rules win):

- `brainstorming`'s builder check and `writing-plans`' recommended execution use subagents. No subagents unless the
  owner says so; execution runs `executing-plans` in one session.
- `writing-plans` saves the plan as its own file in `docs/superpowers/plans/` and asks the owner to review it. Here the
  plan lives in the spec, and the spec merges on green without the owner.
- `executing-plans` ends with its own whole-branch review. Here that is the implementation audit by a fresh session,
  only when the lane calls for one.
- `finishing-a-development-branch` offers merging locally into `main`. Here every merge is a pull request with a merge
  commit, on green.

Other gaps found by the check, and what the owner decided ("yes to 1–3, keep 12", 2026-11-16):

- **No CI run on `main` since #112 (2026-11-15).** `auto-merge.yml` merges with the workflow's own token, which starts
  no workflow on the push to `main`. Fixed in #162: `ci.yml` takes `workflow_dispatch`, and `auto-merge.yml`'s
  `test-main` job starts it on `main` when `main`'s newest commit has no run (on every event there, and hourly).
- **`--passWithNoTests` in the draft quick run** conflicted with CLAUDE.md "Tests". Removed in #162: a draft whose
  change reaches no tests now runs the whole suite.
- **Rules changes merge by themselves.** `auto-merge.yml` merges any ready pull request on green, and `changes` treats
  CLAUDE.md and the skills as docs-only. Rules changes are lane 3, so a rules pull request must stay a draft until the
  owner says yes.
- **Browser pieces:** the kit said 6; `ci.yml` runs 12. The owner kept 12 ("keep 12"), so CLAUDE.md Settings says
  12.

## Standing permissions

- Setup check: the owner's request of 2026-11-16 ("These rules govern you and every session you start from the first
  message"), with the kit as the rules. Covers the setup check and adding the rules files as given (lane 2).

## Approved screens

None recorded yet.

## Lessons

None yet.
