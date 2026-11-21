# Implementation audit 1: CI shoots changed screens, unit W

- Pull request: #259, branch `claude/project-thread-08wjn5`, head **659290b** (a merge of 648aa66 with `main` 583661f).
- Spec: `docs/superpowers/specs/2026-11-21-ci-shoots-changed-screens-design.md`, sections 2 ("Where it runs", "The base", "Shoot every screen when") and 4 (unit W); plan audits 1 to 4, note N16.
- Lane 3 (`.github/workflows/ci.yml`). Reviewer: Opus 5.5, medium, fresh thread. Audit date 2026-11-21 09:22 UTC.
- Diff: `.github/workflows/ci.yml` only (+118 / -20). No product code, no tests, no `look.ts`.

**Verdict: PASS, 0 red, 6 notes.** A8 and A10 on a full run are still to be measured by the builder once the pull request is marked ready (they cannot be measured on a draft); the draft run's numbers below point the same way.

## What was checked

| Check | Result | Evidence |
|---|---|---|
| `SHOOT_EVERYTHING_WHEN` beside `RUN_EVERYTHING_WHEN`, which is unchanged | PASS | `RUN_EVERYTHING_WHEN` line identical to `main`; new pattern holds every `RUN_EVERYTHING_WHEN` path plus `tests/browser/support/`, `tests/support/`, `wrangler.jsonc`, `.github/workflows/ci.yml`, as the spec lists. |
| No picker: answers `all` ("no picker yet") right after checkout, before install or build (N4) | PASS | `decide` step tests `$PICKER` first; setup, install and build steps are gated on `build == 'true'`. Draft run 44888424263, job "which screens changed": log `Every screen is shot: no picker yet`, 12 s from start to end, no install step ran. |
| Label `screenshots` shoots all, on every run | PASS | `case " $PULL_REQUEST_LABELS "` before any build; labels passed through `env`, not inlined into the script. |
| A changed `SHOOT_EVERYTHING_WHEN` path shoots all, naming the file | PASS | `grep -Eq "$SHOOT_EVERYTHING_WHEN"` on `git diff --name-only --no-renames base head`; this PR's own `ci.yml` change matches (criterion 3). |
| Base: PR uses merge base with `main`; push to `main` uses `HEAD^1`; prints "Comparing <head> with <base>" (A7, code read) | PASS | `decide` step. On a pull request `HEAD` is GitHub's merge commit, so the merge base is `main`'s tip at that commit and the diff is exactly the PR's change. The browser pieces check out the same default ref, so the `screens` change build and the pieces build one commit, as the spec's guard assumes. |
| Any failure answers `all` with a reason: install, either build, base checkout, picker exit, empty answer, over 100 KB, unparseable JSON | PASS | `compare` step: each has its own `shoot_all` reason; install is `continue-on-error` and its outcome read; `shoot_all` returns the checkout to the change. Runs under `bash -e -o pipefail`, so a picker that exits non-zero inside `| head -n 1` is caught. |
| Same packages for both builds; no second install, no worktree (R7) | PASS | One install, then `git checkout --detach "$BASE_SHA"` and `pnpm build`; lockfile and `package.json` are in `SHOOT_EVERYTHING_WHEN`. |
| Picker contract and N16 written in the job comment | PASS | Comment above `screens` gives the command line and the missing-in-both / present-in-one rule. |
| Pieces `needs: [changes, screens]`, read `LOOK_CHANGED`; old "Decide whether to take the screenshots" step and `LOOK_SHOTS` gone | PASS | Diff. `grep LOOK_SHOTS .github` finds nothing; `look.ts` (untouched) shoots when `LOOK_SHOTS` is not `off`, so every run shoots every screen until P, as the spec says. Draft run: each piece logs `LOOK_CHANGED: {"all":true,"reason":"no picker yet"}`. |
| A failed `screens` job does not stop or weaken the journeys (N8) | PASS | Pieces keep `if: ${{ !cancelled() && ... }}`, so they run after a failed `screens` with an empty `LOOK_CHANGED`. `browser` still needs only `[changes, browser-shard]`; `gate` still needs `[verify, postgres, browser]`; neither reads `screens`. |
| Docs-only PR skips `screens` as it skips the pieces | PASS | Same `docs_only != 'true'` condition as the pieces; `browser` still accepts all-skipped pieces only when docs-only. |
| A10 from the diff: check names, `RUN_EVERYTHING_WHEN`, draft's choice of tests, `.md` skip, report upload | PASS (from the diff) | `verify`, `postgres`, `browser`, `gate` and the draft names unchanged; "Pick the journeys" and the upload step unchanged. `gate` on a full run: **not yet measured** (draft). |
| A8 timing | PASS on the draft run; **full run not yet measured** | Draft run 44888424263: `what changed` ended 09:12:02, pieces started 09:12:16-17 (14-15 s). `main` run 44888339798: `what changed` ended 09:11:01, pieces started 09:11:03 (2 s). About 13 s added, inside A8's one minute. The job is the same on a full run. |
| Security | PASS | `permissions: contents: read`, `persist-credentials: false`, no secrets; labels and step outputs reach scripts through `env`; only `github.event_name` is inlined. |
| Top-of-file comments updated | PASS, with note N-W3 | New "Screenshots" paragraph; the draft's old picture rule removed from the two-speeds paragraph. |

## Notes (not blocking, not fixed here)

- **N-W1.** UNIT: `ci.yml`, `screens` job comment ("It never fails the run"). VERDICT: note. REASON: a failure in checkout, `pnpm/action-setup`, `setup-node`, or the `decide` step's own `git rev-parse` / `git diff` (under `bash -e`) fails the `screens` job. EVIDENCE: only `Install` has `continue-on-error`. EXPECTED: the comment says what happens. The behaviour is already safe: the pieces still run with an empty `LOOK_CHANGED` (every screen once P lands, N3) and `gate` does not read `screens`; only a red, non-required job shows. FIX (optional, P or later): reword to "a failure never stops the journeys or `gate`".
- **N-W2.** UNIT: `ci.yml`, `on.pull_request.types`. VERDICT: note. REASON: adding the `screenshots` label starts no run (no `labeled` type), so it takes effect on the next push or on marking ready. The old comment said "(read on the next push)"; the new one drops it. FIX (optional): say so again in the Screenshots paragraph. Adding `labeled` would rerun everything on any label and is not asked for.
- **N-W3.** UNIT: `ci.yml` top comment. VERDICT: note. REASON: the Screenshots paragraph describes the finished behaviour in the present tense; until P merges every run shoots every screen. It does name "built in the next pull request" and "no picker yet". Also, the two-speeds paragraph still quotes the Owner's earlier "Skip the slow picture checks on drafts" as history, and W stops doing that on drafts until P (the spec's "Until P lands, every run shoots every screen"). Drafts that run journeys will take every picture meanwhile.
- **N-W4 (for P).** UNIT: `.claude/skills/this-repo/SKILL.md` line 26 and `tests/browser/support/look.ts` line 259. VERDICT: note. REASON: both still describe the draft `LOOK_SHOTS` rule that W removes, so they are wrong between W's merge and P's. Both are P's files (A11); P must replace them.
- **N-W5.** UNIT: `screens` job, `node "$PICKER" ... | head -n 1`. VERDICT: note. REASON: under `pipefail`, a picker that prints a very long multi-line output can be killed by SIGPIPE and the run answers `all` ("the picker failed"). Safe side; P's picker prints one line.
- **N-W6.** UNIT: `screens` job, base on a pull request. VERDICT: note. REASON: `git merge-base origin/main HEAD` relies on the base branch being `main`. Every pull request here targets `main`; a pull request into another branch would compare with `main` and could pick too much or too little. `HEAD^1` of GitHub's merge commit is the exact base for any target. Not required by the spec.

## Still open before merge

- Builder: on the full run after marking ready, record A8 (pieces start within a minute of `main`) and A10 (`gate` passes) with the run link, as the PR body says.
- Owner's approval (lane 3).
