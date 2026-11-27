# Implementation audit: sessions merge in RukenPrivate (#408), cycle 1

- Pull request: mcthaydt/RukenApp #408, "Let sessions merge in RukenPrivate under the same rules as here"
- Commit examined: `18bb86a18209087cba43c9ea4692f92ae468484b`
- Lane: 3 (`.claude/**`, the rules that decide what needs the owner)
- Reviewer: fresh session, Opus 5.5, medium, read-only (this file is its only change)
- Brief: the owner's 2026-11-27 02:40 UTC message "I'm not going to keep doing the merging", plus the acceptance criteria R1 to R4 in the pull request body.

**Verdict: FAIL, 2 red.**

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## What was checked, and how

| Check | Result |
|---|---|
| Diff touches only `.claude/hooks/rules.json`, `.claude/hooks/rules.mjs`, `docs/superpowers/progress.md`, `tests/rules-merge-permission.test.ts` (rules-only, no product code) | PASS (`git diff --stat origin/main...18bb86a`) |
| `pnpm exec vitest run tests/rules-merge-permission.test.ts tests/rules-pr-routes.test.ts tests/pr-rules.test.ts` | PASS, 3 files, 96 tests |
| Prettier on the changed files; eslint (rules.mjs is eslint-ignored on `main` too) | PASS |
| Standing permission recorded in `progress.md` with the owner's words and scope | PASS, but its scope sentence is not what the hook enforces (red 2) |
| Widening limited to `mcthaydt/RukenPrivate`: merge on `mcthaydt/Other` refused | PASS from cwd `RukenApp` ("covers mcthaydt/RukenApp only") and `RukenPrivate`; from cwd `/home/user` it fails closed ("no repo with rules.json was found") |
| Merge method: squash on RukenPrivate refused | PASS from all three working folders |
| Full head SHA: merge with no `expectedHeadSha` refused | PASS from all three working folders |
| Force-push | Unchanged: `forcePush` hook is on in both repos' configs |
| Green checks before a RukenPrivate merge | **FAIL** (red 1) |
| A passing review on the head, whatever lane the body names (R1) | **FAIL** from cwd `RukenPrivate` or `/home/user` (red 2) |

The live probes ran the real hook (`CLAUDE_PROJECT_DIR=/home/user node .claude/hooks/rules.mjs --find-repo`, the launcher the cloud settings run) with a PreToolUse payload for `mcp__github__merge_pull_request` on real RukenPrivate pull requests, from three working folders: `/home/user/RukenApp`, `/home/user/RukenPrivate` and `/home/user` (where cloud sessions start). The same probes on `origin/main`'s hook show what the pull request changed: from cwd `RukenApp`, `main` refuses with "covers mcthaydt/RukenApp only" and `18bb86a` allows; from the other two folders, `main` already allowed.

## Findings

### Red 1: nothing checks green before a RukenPrivate merge

- UNIT: `.claude/hooks/rules.mjs`, `checkMcp` and `preToolUse` (the fallback config), with `checkMergeGreen`.
- VERDICT: red.
- REQUIREMENT: CLAUDE.md, "Three different yeses": merge permission is "green and its required reviews and audits". The progress.md line this pull request adds names "green" as part of the scope. The coordinator's audit brief lists "green checks".
- REASON: on RukenApp, green is enforced by GitHub branch protection (required checks `gate`, `commit-authors`). RukenPrivate has no branch protection (the API answers 403, "Upgrade to GitHub Pro or make this repository public"), and the hook does not check green for it on any path, so a session can merge a RukenPrivate pull request whose `check` failed or is still running.
- EVIDENCE:
  - `gh api repos/mcthaydt/RukenPrivate/branches/main/protection` and `.../rulesets`: HTTP 403, not available on this plan. `gh api repos/mcthaydt/RukenApp/branches/main/protection`: `checks: ["gate","commit-authors"]`.
  - Judged under RukenApp's config (cwd `RukenApp`), the fallback config sets `mergeGreen: { enabled: false }` (`rules.mjs`, `preToolUse`, the `cfg` line), so `checkMergeGreen` returns at once.
  - Judged under RukenPrivate's own config (cwd `RukenPrivate` or `/home/user`), `mergeGreen` is `{ enabled: true, statuses: [] }`, and `checkMergeGreen` returns when `statuses` is empty. It reads commit statuses only; RukenPrivate's `check` is a check run, which nothing reads.
  - The pull request's own test shows it: `merge({}, "RukenPrivate")` with a PASS is allowed (`toBeNull()`) while the `gh` stub answers no status or check-run path at all ("stub: unknown path"), so no green check was attempted.
  - RukenPrivate #23's head `397395d` has `check: failure`; nothing in the hook would stop its merge once its review passed.
- EXPECTED: a merge (and enabling auto-merge) on a repo in `alsoMerges` is refused unless the head's required check runs are completed with success (skipped allowed only for the deploy job, which skips on pull requests), and a missing, pending or unreadable check refuses, from every working folder.
- FIX: in `.claude/hooks/rules.mjs`, let `mergeGreen` name required check runs (for example `mergeGreen.checkRuns: ["check"]`) and read `repos/<repo>/commits/<head>/check-runs`; keep it on for a repo in `alsoMerges` (as `mergeMethod` already is) with the check names that `alsoMerges` entry gives in `.claude/hooks/rules.json`; add allow and deny cases (failure, pending, missing, success) to `tests/rules-merge-permission.test.ts`. The path judged under RukenPrivate's own config also needs `mergeGreen.checkRuns: ["check"]` in RukenPrivate's `.claude/hooks/rules.json` (a RukenPrivate pull request), or red 2's fix routing every RukenPrivate merge through this rule. Files: those three in RukenApp, plus RukenPrivate's `rules.json` if that route is chosen.

### Red 2: the lane-2 floor holds only when the session is in the RukenApp folder

- UNIT: `.claude/hooks/rules.mjs`, `checkMcp` (`elsewhere`) and `rootForCall`; `docs/superpowers/progress.md`, the new Standing permissions line.
- VERDICT: red.
- REQUIREMENT: the pull request's R1, "A lane 1 body does not lower that", and the progress.md record, "always a passing review that names the head, whatever lane the body names".
- REASON: `rootForCall` picks the config from the session's working folder first. From cwd `RukenApp`, RukenApp's config judges the call, `elsewhere` is true and the floor is 2. From cwd `RukenPrivate` or `/home/user` (where cloud sessions start), RukenPrivate's own `rules.json` judges it, `thisRepo` is RukenPrivate, `elsewhere` is false and there is no floor. RukenPrivate's lane paths do not list `LICENSE`, `docs/**`, `feed/*.md` or `runner/**`, so a lane 1 body on those merges with no review.
- EVIDENCE: RukenPrivate #21 (body "Lane 1", one file `LICENSE`, no verdict comment), merge with `merge_method: "merge"` and its full head SHA: cwd `RukenApp` refuses ("a lane 2 or 3 pull request is marked ready or merged only after a passing review"); cwd `RukenPrivate` gives ALLOW; cwd `/home/user` gives ALLOW. `main`'s hook also gives ALLOW from the last two, so this route predates #408, but #408's criterion and its progress.md record claim it is closed.
- EXPECTED: either every RukenPrivate merge, ready and disable-auto-merge call needs a PASS on its head from every working folder, or the record and R1 say plainly that RukenPrivate's own lane paths decide (lane 1 there merges on green, as on RukenApp). The second matches "the same rules as here"; the first matches what #408 says. The implementer picks one and makes the record, the criterion and the hook agree.
- FIX: either (a) in `.claude/hooks/rules.mjs`, apply the floor whenever the target repo is in this config's `alsoMerges` or is judged by a config other than RukenApp's, with a test that runs the hook from a RukenPrivate-style folder (its own `rules.json`) and expects a lane 1 body with no PASS to be refused; or (b) reword the progress.md line and R1 to say RukenPrivate's own lane paths apply when the session works in that folder, and add a test that pins that behaviour. Files: `.claude/hooks/rules.mjs`, `tests/rules-merge-permission.test.ts`, `docs/superpowers/progress.md`, the pull request body.

## Notes (not blocking, follow-ups)

- N1. `enable_pr_auto_merge` is not in `guardedNow`, so on a repo outside `alsoMerges` it is not refused as "elsewhere"; from cwd `/home/user` it gives ALLOW on `mcthaydt/Other` (from cwd `RukenApp` the review check still refuses it). Predates #408; GitHub access is scoped to the two Ruken repos, so the exposure is small. Fix later: add the auto-merge tool to `guardedNow`.
- N2. The executing hook is whichever `rules.mjs` the launcher finds first (`/home/user/RukenApp/...`, by the glob's order), with the config of the repo the call acts in, so RukenPrivate's own copy of `rules.mjs` never runs in a cloud session. Worth knowing when the fix touches RukenPrivate's `rules.json`.
- N3. On the RukenApp-config path, `checkLiveState` is off for RukenPrivate (fallback `liveState: { enabled: false }`), while RukenPrivate's own config turns it on. Another place where the working folder changes the rule.
- N4. CI on `18bb86a` was still running when this audit was written (`pr-rules-run` success, `commit-authors` success, browser shards and `verify` queued or in progress). Green is the merge's own check, not this audit's.
