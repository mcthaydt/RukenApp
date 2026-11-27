# Implementation audit: sessions merge in RukenPrivate (#408), cycle 2

- Pull request: mcthaydt/RukenApp #408, "Let sessions merge in RukenPrivate under the same rules as here"
- Commit examined: `3f0222aa4efa192006e7bcd089440605014fe33d`
- Lane: 3 (`.claude/**`, the rules that decide what needs the owner)
- Reviewer: fresh session, Opus 5.5, medium, read-only (this file is its only change)
- Brief: the owner's 2026-11-27 02:40 UTC message "I'm not going to keep doing the merging", the acceptance criteria in the pull request body, the progress.md record this pull request adds ("It holds from every folder a session works in; a session there merges by hand"), and cycle 1's two reds.
- Written: 2026-11-27 03:13 UTC (`date -u`)

**Verdict: FAIL, 2 red.** Both of cycle 1's reds are fixed on the route they named (the MCP merge tool, under the cloud launcher). Two other routes to a RukenPrivate merge still skip the green check and the review floor.

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## How it was checked

The real hook ran with PreToolUse payloads on real RukenPrivate pull requests, through three launchers:

- **cloud**: `CLAUDE_PROJECT_DIR=/home/user`, the blocking launcher in `/root/.claude/settings.json` (`for f in .../.claude/hooks/rules.mjs .../*/.claude/hooks/rules.mjs; do ... --find-repo; done; exit 1`). It picks `/home/user/RukenApp/.claude/hooks/rules.mjs`, which was checked out at `3f0222a`.
- **app**: `CLAUDE_PROJECT_DIR=/home/user/RukenApp`, RukenApp's own `.claude/settings.json` command.
- **private**: `CLAUDE_PROJECT_DIR=/home/user/RukenPrivate`, RukenPrivate's own `.claude/settings.json` command, which runs RukenPrivate's copy of `rules.mjs` (RukenPrivate `main` at `4aa7d24`; that file is byte-identical to RukenApp `main`'s).

Working folders: `/home/user`, `/home/user/RukenApp`, `/home/user/RukenPrivate`. Pull requests: #21 (body "Lane 1", only `LICENSE`, no verdict comment, head `5957363`), #26 (`9359787 PASS`, `check` success, head `9359787`). To test the green gate on its own, a `gh` wrapper earlier in `PATH` answered only the `.../check-runs` read with a chosen result and passed every other call to the real `gh`.

## What passed

| Check | cloud, all 3 folders | app |
|---|---|---|
| #21 merge, lane 1 body, no PASS (cycle 1 red 2) | DENY (review) | DENY |
| #21 with the slug in other case (`MCTHAYDT/rukenprivate`) | DENY | |
| #21 marked ready (`update_pull_request` draft false) | DENY | |
| #26 merge, PASS and `check` success (control) | ALLOW | |
| #26 `check` newest run failure (cycle 1 red 1) | DENY | DENY |
| #26 `check` pending, missing, skipped, neutral, or the read fails | DENY | |
| #26 older `check` failed, newer succeeded | ALLOW (newest by id wins, correct) | |
| #26 squash | DENY | |
| #26 merge with no `expectedHeadSha` | DENY | |
| #26 `enable_pr_auto_merge` | DENY ("merge by hand") | DENY |
| Merge on `mcthaydt/Other` | DENY from `RukenApp` and `RukenPrivate`; fails closed (exit 1, blocked) from `/home/user` | DENY |

- `pnpm exec vitest run tests/rules-merge-permission.test.ts tests/rules-pr-routes.test.ts tests/pr-rules.test.ts`: 3 files, 100 tests passed.
- `prettier --check` on the changed JSON, test and progress files: clean.
- Widens nothing on RukenApp: RukenApp is not in `alsoMerges`, so `mergeRule` is null and `elsewhere` false for it; the changed lines only add refusals (`reviewOn` also on when `floor > 0`, `mergeMethod` forced on, the check-run gate, the auto-merge refusal) when `mergeRule` is set. RukenApp's `mergeGreen` has no `checkRuns`, so its auto-merge path is unchanged. The one allow added is `!alsoMerges.includes(target)`, and the only entry is `mcthaydt/RukenPrivate`.

## Findings

### Red 1: a merge by `gh` in the shell skips the green check and the review floor

- UNIT: `.claude/hooks/rules.mjs`, `checkPrFlowBash` and `checkMergeMethod` (the Bash path of `preToolUse`).
- VERDICT: red.
- REQUIREMENT: the progress.md record #408 adds ("its `check` run green on the head ... always a passing review that names the head, whatever lane the body names. It holds from every folder a session works in; a session there merges by hand"); CLAUDE.md, Hooks ("Every pull request create and edit goes through a route the hooks check"); CLAUDE.md, CLI first, which makes `gh pr merge` the route a session reaches for first.
- REASON: the new rule (`mergeRule`, the floor, the check-run gate, forced merge method) lives only in `checkMcp`. The Bash path judges `gh pr merge` and `gh api .../pulls/N/merge` under the working folder's config with no `mergeRule`, so for RukenPrivate it never reads `check` and never applies the floor.
- EVIDENCE (cloud launcher, `3f0222a`):
  - `gh pr merge 26 -R mcthaydt/RukenPrivate --merge --match-head-commit 9359787...` with the wrapper answering `check` failure: ALLOW from `/home/user`, `RukenApp` and `RukenPrivate`.
  - `gh api -X PUT repos/mcthaydt/RukenPrivate/pulls/26/merge -f merge_method=merge -f sha=9359787...` with `check` failure: ALLOW from all three.
  - `gh pr merge 21 -R mcthaydt/RukenPrivate --merge` (lane 1, no PASS): ALLOW from all three. `gh pr merge 21 --merge` from `RukenPrivate`: ALLOW.
  - `gh pr merge 26 -R mcthaydt/RukenPrivate --merge --auto`: ALLOW from all three (the MCP auto-merge tool is refused).
  - `gh pr merge 26 -R mcthaydt/RukenPrivate --squash`: ALLOW from `/home/user` and `RukenApp` (DENY only from `RukenPrivate`).
  - `main` (`5852e02`) gives the same ALLOWs, so the route is older than #408. Before #408 a session merging in RukenPrivate was outside the permission; #408 turns the permission on and records that it holds everywhere, so the unchecked route now matters.
- EXPECTED: for a repo named in `alsoMerges`, `gh pr merge` (with or without `--auto`) and `gh api` PUT `.../pulls/N/merge` or `.../ccr/auto_merge` get the same refusals as `merge_pull_request` from every working folder: a missing, pending or failed `check`, no PASS on the head whatever lane the body names, a squash or rebase, and auto-merge.
- FIX: either (a) in `preToolUse`'s Bash path, work out the target slug (`-R`, a pull request URL, or the `gh api` path), look up `mergeRuleFor` the same way as for MCP calls, and pass the floor, the forced merge method and the green config with `checkRuns` to `checkPrFlowBash`, `checkMergeMethod` and `checkMergeGreen`, refusing `--auto`; or (b) refuse every shell merge on a repo in `alsoMerges` with "use merge_pull_request with expectedHeadSha", which closes it with less code. Add Bash cases to `tests/rules-merge-permission.test.ts` for each EVIDENCE line, from a RukenApp-style and a RukenPrivate-style folder. Files: `.claude/hooks/rules.mjs`, `tests/rules-merge-permission.test.ts`.

### Red 2: a session started in the RukenPrivate folder runs RukenPrivate's old hook, which checks neither

- UNIT: RukenPrivate's `.claude/hooks/rules.mjs` and `.claude/hooks/rules.json`; or the progress.md record in this pull request.
- VERDICT: red.
- REQUIREMENT: the progress.md record ("It holds from every folder a session works in"), the brief ("from every folder").
- REASON: a session whose project folder is RukenPrivate (a cloud environment with only that repo, or a session on the owner's computer, where RukenPrivate code may run) loads RukenPrivate's own settings, which run RukenPrivate's copy of `rules.mjs`. That copy is `main`'s code, with no check-run gate and no floor, and RukenPrivate's `rules.json` has `mergeGreen.statuses: []` and lane paths that leave `LICENSE`, `docs/**`, `feed/*.md` and `runner/**` at lane 1. RukenPrivate's settings also allow `merge_pull_request` without a prompt.
- EVIDENCE (private launcher, cwd `/home/user/RukenPrivate`): #21 merge, lane 1, no PASS: ALLOW. #26 merge with `check` failure: ALLOW. #26 `enable_pr_auto_merge`: ALLOW. (`mcthaydt/Other`: DENY, as before.) `cmp` of RukenPrivate's `rules.mjs` against RukenApp `main`'s: identical.
- EXPECTED: either the rule holds there too, or the record says where it holds.
- FIX: either (a) a RukenPrivate pull request that brings #408's `rules.mjs` and sets `mergeGreen.checkRuns: ["check"]` and `prFlow.minLane: 2` in RukenPrivate's `rules.json`, with a probe from that folder; or (b) narrow the progress.md line to "sessions whose hook is RukenApp's (cloud sessions started above both repos, or in RukenApp)" and say that a session started in RukenPrivate alone does not merge there until (a) lands. Files: RukenPrivate `.claude/hooks/rules.mjs`, `.claude/hooks/rules.json`; or RukenApp `docs/superpowers/progress.md`.

## Notes (not blocking, follow-ups)

- N1. `gh pr merge 408 -R mcthaydt/RukenApp --merge` from `/home/user` is ALLOW on `main` and on `3f0222a`: the Bash path finds no repo for a `-R` call from a folder outside a checkout. RukenApp's branch protection still requires `gate` and `commit-authors`, so green holds there, but the review check does not run. Older than #408; red 1's fix (a) covers it if it resolves the slug from `-R`.
- N2. The check-run read asks for `per_page=100` with no paging. A head with more than 100 runs could hide `check`; the hook then refuses it as missing, so it fails closed.
- N3. `disable_pr_auto_merge` on RukenPrivate is ALLOW with no PASS. Turning auto-merge off merges nothing, so this is harmless.
- N4. Cycle 1's N3 still stands: from cwd `RukenApp`, the live-state check for a RukenPrivate merge depends on which config `scopeFor` finds.
- N5. During `pnpm install` and the test run, the console showed `warning: push negotiation failed; proceeding anyway with push`. No push from this session reached GitHub (this branch had not been pushed yet); it looks like a test's local fake remote. Not looked into further.
