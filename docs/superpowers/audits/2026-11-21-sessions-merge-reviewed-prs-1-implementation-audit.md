# Implementation audit 1: sessions mark ready and merge reviewed pull requests

Examined: PR #258 at **540936a** (branch `claude/project-thread-1qu41r`), unit A of `docs/superpowers/specs/2026-11-21-sessions-merge-reviewed-prs-design.md` (merged in #257 after plan audit 5 PASS at 7133053). Diff: `.claude/settings.json`, `.claude/hooks/rules.mjs`, `.claude/hooks/rules.json`, `tests/rules-merge-permission.test.ts`. Lane 3 implementation audit, round 1, Opus 5.5, medium. Graphify: not used (the change is a single hook script and its config; read directly).

Prompt: Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

**Verdict: FAIL, 1 red, 5 notes.** The code does what the spec's sections 3.1 to 3.6 say, every check passes, and I proved in the harness that `onFailure: "block"` blocks. But in the cloud sessions this project runs in, Claude Code never reads the repo's `.claude/settings.json`: the new allow list and the fail-closed entry are not loaded there, so the spec's outcome is not reached where it is needed. Merging as it stands loosens nothing (the hook changes only add refusals), but it would not stop the classifier refusing.

## Checks run (at 540936a, in this container)

| Check | Result |
|---|---|
| `pnpm install --frozen-lockfile` | exit 0 |
| `pnpm lint` | exit 0 |
| `pnpm typecheck` | exit 0 |
| `pnpm test` | 116 files, 1653 tests pass (22 in `tests/rules-merge-permission.test.ts`) |
| `node .claude/hooks/rules.mjs --check` | exit 0, config valid |
| Diff touches only the files criterion 4 names | yes (4 files; the live-state file was added and removed in the branch's two commits) |

## Criteria against the code

| Criterion | Evidence | Holds? |
|---|---|---|
| 1. Allow list exact; today's entry unchanged; second entry with the 3.5 matcher and `onFailure: "block"`; nothing else | `git diff origin/main...HEAD -- .claude/settings.json`: only the `permissions` block and the second entry added; test (g) asserts both | Yes |
| 2 a, j. Other repo refused before any read (3.2) | `checkMcp` compares the call's `owner/repo` with root `rules.json` `repo`, lowercased, before `checkLiveState`/`checkReviewed`; `scopeFor` makes no `gh` call. Tests pass for merge, disable, ready on RukenPrivate; title/body edits there pass | Yes |
| 2 b. Squash refused | existing `mergeMethod` check; test passes | Yes |
| 2 c. Base change refused (3.3) | `input.base !== undefined` on `update_pull_request`, this repo, returns after deny; test passes | Yes |
| 2 d. Lane from files (3.4) | `laneOfFiles`: every page (100 each, up to 30), `filename` and `previous_filename`, read failure or count ≠ `changed_files` gives 3, `lanePathsExcept.3` only lowers lane 3 by path. All six spec cases are in the test and pass | Yes |
| 2 e. Review still holds | test passes; `checkReviewed` unchanged below the lane line | Yes |
| 2 f. Fail closed (3.5) | `failClosed` exits 1 for unparsable input, missing root, `loadConfig` error and a crash once the tool name is known; trailing `process.exitCode = 0` removed; a `Read` call keeps exit 0. Tests pass | Yes |
| 2 h. Lane lists match CLAUDE.md | test reads the Lane 2/3 bullets, skips exactly `release` and `.md`, fails on a new lane 2 path in a copy. The test's `globToRegExp` is a copy of the hook's (line 42), character for character | Yes |
| 2 i. Head pinned (3.6) | pin compares `expectedHeadSha` (lowercased) to `pr.head.sha` from the **same** read `checkReviewed` judges, and runs when `requireReview` or `prFlow.enabled` is off (plan audit 5 N1 answered). Tests cover missing, other, short, full, and both switches | Yes |
| 3. Recorded run against real GitHub | in the PR body: both calls on #258 denied for "no passing review that names its head 540936a" | Yes |
| 3. `onFailure: "block"` really blocks | **Not run by the builder.** Run here, see next section | Yes (this audit) |
| 4. Only spec files; checks pass | above | Yes |

## The `onFailure: "block"` check (criterion 3), run in this audit

Nested `claude -p` sessions, Claude Code 2.1.330, model Haiku, in a scratch folder. A tiny stdio MCP server named `github` stood in for GitHub with one tool, `disable_pr_auto_merge`, which writes a marker file when called. Settings were passed with `--settings` (see R1 for why project settings did not load).

| Run | Settings | Hook ran | Tool reached | Answer |
|---|---|---|---|---|
| control | the PR's matcher, command `exit 1`, no `onFailure` | 1 | yes | "auto-merge disabled" |
| block | the PR's matcher, command `exit 1`, `"onFailure": "block"` | 1 | **no** | "hook error … failed; blocking because onFailure is "block"" |
| both entries | the PR's two `PreToolUse` entries, the **same** command in both (exits 1), only the second with `onFailure` | 1 (deduplicated) | **no** | blocked |
| real hook, broken config | a worktree at 540936a with `rules.json` = `{ broken`, the PR's own `settings.json` | yes | **no** | "rules hook: … rules.json is not valid JSON …; the call is blocked because this check did not run." |
| real hook, other repo | same worktree, healthy config, repo `RukenPrivate` | yes | **no** | "This permission covers mcthaydt/RukenApp only; …" |
| real hook, this repo | same, repo `RukenApp` | yes | yes (the stand-in server then failed on a bad marker path, my mistake; the hook let the call through as 3.1 intends) | — |

So `onFailure: "block"` works as documented, with the PR's exact matcher, and survives Claude Code merging the two identical commands into one run. One correction to spec 3.5's aside: "The first entry also runs" is not what happens; identical commands run once. That changes nothing.

## Red

**R1. In this project's cloud sessions the allow list and the fail-closed entry are never loaded.**

- UNIT: `.claude/settings.json` (where the rule lives), and spec §2's assumption.
- VERDICT: red.
- REQUIREMENT: spec §1, the outcome: "A session in this repo, in auto mode, can mark one of this repo's pull requests ready, merge it … without the classifier refusing", and "if the hook cannot run its checks for one of these tools, the call is blocked". Spec §2: "Project `permissions.allow` is read from `.claude/settings.json`." Spec §3.5: "if it does not behave as described, stop and report".
- REASON: cloud sessions here start in `/home/user`, one folder above the repo, with `CLAUDE_CODE_IGNORE_PERSISTED_TRUST=1`, so `RukenApp/.claude/settings.json` is not their project settings and project allow rules are ignored even where it is.
- EVIDENCE:
  1. This session's Claude Code process (pid 192) runs with cwd `/home/user` and `CLAUDE_CODE_IGNORE_PERSISTED_TRUST=1` in its environment (`/proc/192/environ`). `/home/user/.claude/` does not exist.
  2. The rule hooks that run in cloud sessions come from **user** settings, `~/.claude/settings.json`, written by the setup script: `for f in "$CLAUDE_PROJECT_DIR"/*/.claude/hooks/rules.mjs; do … exec node "$f" --find-repo; done; true`. That entry has no `onFailure`, so the new exit 1 is only a notice there, and there is no allow list in user settings.
  3. A nested `claude -p` 2.1.330 in a worktree at 540936a printed, verbatim: "Ignoring 3 permissions.allow entries from .claude/settings.json: no workspace trust record counts in this process, because CLAUDE_CODE_IGNORE_PERSISTED_TRUST is set … Put them in user or managed settings instead."
  4. In the same container, a project `.claude/settings.json` with a `PreToolUse` hook on `Bash` (in a scratch git repo, without `--settings`) did not run at all (hook log empty in all 7 runs); passed with `--settings`, it ran.
- EXPECTED: in a cloud session of this project, the three tools resolve by an allow rule (no classifier), and the hook entry that guards them has `onFailure: "block"`.
- FIX: needs a spec revision and the owner, so it goes back to the staged path rather than a fix in this PR. The likely shape: the cloud setup script (owner's environment, `owner-steps/cloud-setup-script.sh` and the `--install-user` / `--print-setup` text in `rules.mjs`) also writes the three `permissions.allow` names and a second `PreToolUse` entry with the 3.5 matcher and `"onFailure": "block"` into `~/.claude/settings.json`, and the owner updates the environment's setup script. Keep the repo's project entries for local sessions opened in the repo folder. Files: the spec, `.claude/hooks/rules.mjs` (install text), the setup script; a new test that the install text holds the allow list and the blocking entry. Changing the owner's environment is the owner's call.

Merging #258 as it is would be safe (it only adds refusals to every merge and ready route, and the project settings take effect in a local session opened in the repo folder), but criterion 5 would then report the classifier still refusing in cloud sessions. Whether to merge it now as a first step or hold it for the revision is a choice for the coordinator and the owner.

## Notes (recorded, not blocking)

- **N1. The open pull request limit is skipped when a pull request is opened with `gh api`.** The coordinator asked why #258 opened while 3 were open (#255, #251, #209). `checkPrFlowBash` checks only `gh pr create` and the MCP `create_pull_request`; `gh api repos/<o>/<r>/pulls` (POST), which these cloud sessions are told to use because `gh pr create` hits GraphQL and gets 403, is not checked for the limit, the draft rule or the lane. Fed to the hook at 540936a: `gh pr create --draft …` → deny "Pull requests open: 3 at most … 4 are open now (#258, #255, #251, #209)"; MCP `create_pull_request` → the same deny; `gh api repos/mcthaydt/RukenApp/pulls -f title=t -f head=claude/x -f base=main -F draft=true …` → no answer (allowed). That is a bug in the existing hook, not in this PR. Bounded fix for a later lane 3 change: in `checkPrFlowBash`, route a non-GET `gh api` to `repos/<o>/<r>/pulls` (with no further path) to `checkPrCreate`, reading `title`/`body`/`draft` from its fields. Also note #209 (opened 2026-11-20) still holds one of the three places.
- **N2. `draft` is matched only when it is exactly `false`.** Spec §3.1's table says "with `draft` present and not `true`". The MCP schema types `draft` as boolean, so a string `"false"` should be rejected before the call; recorded only.
- **N3. Spec §3.5 aside.** "The first entry also runs and fails the same way": Claude Code runs identical commands once (run "both entries" above). Harmless; the spec could say so when it is next revised.
- **N4. `merge_pull_request` with no `merge_method`.** Not refused; GitHub's REST default is a merge commit, as plan audit 5 already recorded.
- **N5. Accepted reach still applies.** `update_pull_request` can close or reopen and edit title, body and reviewers on reachable repos (spec §3.1, accepted). Nothing new.

## What comes next

R1 goes back to the spec author: revise the spec so the rule lands in user settings through the setup script (owner's environment), with the owner's go, then a plan audit of that revision. Whether #258 merges first as a safe step is the coordinator's and owner's call. N1 is a separate small lane 3 fix to the hook, reported to the coordinator.
