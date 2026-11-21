# Implementation audit 2: sessions merge reviewed PRs (amendment 3.7, cloud user settings)

Examined: **a71fab7** on `claude/project-thread-1qu41r` (PR #258), the 3.7 build (5487586, then a71fab7 removing the live-state file), against spec `docs/superpowers/specs/2026-11-21-sessions-merge-reviewed-prs-design.md` sections 3.5 and 3.7 and criteria 4, 6 and 7, implementation audit 1 (03fb74f) and plan audits 6 to 8 (5b8b384, e8393c5, 9e0fb7f). Lane 3 implementation audit, Opus 5.5 medium, 2026-11-21 08:13 UTC. Graphify: not used (one script and one test file changed, read directly).

Audit prompt: Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

**Verdict: a71fab7 FAIL: 1 red, 3 notes.** Criterion 7 passes (run here, below), and every criterion 6 case the test names passes. The red: the cloud setup script deletes a user's own fail-closed `PreToolUse` hook, because it recognises "the blocking entry" by any hook with `onFailure: "block"` whose command ends `exit 1`, not by its own matcher and command as 3.7 says.

## Checks run at a71fab7

| Check | Result |
|---|---|
| `pnpm install --frozen-lockfile` | exit 0 |
| `pnpm lint` | exit 0 |
| `pnpm typecheck` | exit 0 |
| `pnpm test` | exit 0, 116 files, 1663 tests passed |
| `node .claude/hooks/rules.mjs --check` | exit 0, config valid |
| Files changed since 03fb74f (criterion 4) | `.claude/hooks/rules.mjs`, `tests/rules-merge-permission.test.ts`, the spec and plan audits 6 to 8; the live-state file added and removed. `.claude/settings.json` and `rules.json` unchanged since audit 1. |

## Criterion 7: the cloud-shaped run, done in this audit

Claude Code 2.1.330, `claude -p --model haiku`, `CLAUDE_CODE_IGNORE_PERSISTED_TRUST=1`, `HOME` = a scratch folder holding only the output of `bash <(node .claude/hooks/rules.mjs --print-setup)` at a71fab7, working directory a scratch folder with a worktree of a71fab7 one level below it, a stdio stand-in `github` server (three tools, each writes a marker) passed with `--mcp-config … --strict-mcp-config`, stdin from `/dev/null`. Nothing reaches the real merge tools.

| Run | User settings | Call | Tool reached | Answer (the nested session's words) |
|---|---|---|---|---|
| control | `{}` | `disable_pr_auto_merge` RukenApp #999 | no | "Claude requested permissions to use mcp__github__disable_pr_auto_merge, but you haven't granted it yet" |
| **7a** | installer output | same | **yes** | "stand-in: disable_pr_auto_merge done" |
| 7a, auto mode | installer output, `--permission-mode auto` | same | **yes** | "stand-in: disable_pr_auto_merge done" |
| hook judges | installer output | `disable_pr_auto_merge` RukenPrivate #999 | no | refused: "the permission covers mcthaydt/RukenApp only" |
| **7b** | installer output, scratch `rules.json` = `{ broken` | `disable_pr_auto_merge` RukenApp #999 | **no** | "rules hook: …/rules.json is not valid JSON …; no rule check ran; the call is blocked because this check did not run." |
| 7b control | same, blocking entry removed (launcher only) | same | yes | "stand-in: disable_pr_auto_merge done" (so the user-level blocking entry is what blocked 7b) |
| real reads | installer output, auto mode | `merge_pull_request` #258, `merge`, `expectedHeadSha` = full a71fab7 | no | "lane 3 pull request #258 has no passing review that names its head a71fab7" |

So in a cloud-shaped session the allow entry is read (the classifier is not asked), the repo's hook still judges every call, and the user-level `onFailure: "block"` entry blocks when the hook cannot run. The PR body does not record this run yet; criterion 7 asks for it there, and these rows can be copied in.

## Criterion 6, checked by hand as well as by the test

`--print-setup` output into scratch `HOME`s: from no file, three allow names, the four launcher entries and the blocking entry (`onFailure: "block"`, `timeout` 30, command ending `exit 1`, the spec's loop verbatim) each once; byte-identical on a re-run; `--install-user` after it keeps the allow names and the blocking entry; `{ broken` left as is with exit 0 (`--install-user` exit 1). The `--find-repo` early return is skipped for the three tools only (`GUARDED` test added to the return at `main`), and the test shows a Bash call from the repo folder still returns quietly. Plan audit 8's N2 (`timeout` 30) is written and tested.

## Red

**R1. The cloud setup script deletes the user's own fail-closed `PreToolUse` hooks.**

- UNIT: A, spec 3.7 "The blocking hook entry"; criterion 6.
- VERDICT: red.
- REQUIREMENT: 3.7: "The installer matches the blocking entry by its own matcher and command … A re-run replaces each kind once and leaves the user's own hooks alone." Criterion 6: "a file with the user's own allow entries and hooks keeps them".
- REASON: `isBlocking` in the installer is `h.onFailure === 'block' && command.trim().endsWith('exit 1')`. It ignores the matcher and the command body, and the cloud pass drops every such hook from every `PreToolUse` entry. A user's own fail-closed guard is exactly that shape. The test's "user's own hooks" case uses a plain `echo mine` hook, so it does not see this.
- EVIDENCE: scratch `HOME` with `{"hooks":{"PreToolUse":[{"matcher":"Bash","hooks":[{"type":"command","command":"/usr/local/bin/my-guard || exit 1","onFailure":"block"}]}]}}`, then the `--print-setup` script at a71fab7: `PreToolUse` afterwards holds only the launcher entry and the 3.7 blocking entry; the user's `Bash` guard is gone, and with it a safety check the user set to fail closed. The same file through `--install-user` keeps it.
- EXPECTED: the user's `Bash` guard is still there after `--print-setup`, once, and a re-run still changes nothing.
- FIX: in `installJs`, recognise the blocking entry by its own matcher and command: for example only in entries whose matcher is `BM`, and only a hook whose command contains `/.claude/hooks/rules.mjs` and ends `--find-repo; done; exit 1` (or exactly `B`, if older blocking commands never need replacing), keeping `ours` from matching it. Add the case above to the criterion 6 test ("a user's own `onFailure: block` hook ending `exit 1` is kept"). Files: `.claude/hooks/rules.mjs`, `tests/rules-merge-permission.test.ts`.

## Notes (not blocking)

- **N1. Record criterion 7 in the PR body.** The builder said it was not run; it is run above. The body needs the commands and answers at the head that merges (rerun after the R1 fix, or copy these rows noting the head they ran on, since R1's fix does not touch the blocking command or the allow list).
- **N2. Guarded tools are now judged twice where both settings load.** On a trusted local checkout with the owner's `--install-user` launcher, the repo entry and the user launcher both run `checkMcp` for the three tools (two `gh` reads each). Harmless, as 3.7 says; noted for timing only.
- **N3. Older blocking entries.** Once R1 narrows the match, a later change to the blocking command must still find and replace the previous version; matching on the matcher plus the `rules.mjs` path and `--find-repo; done; exit 1` ending (not the exact string) keeps that working.

## What ran

All checks in the first table at a71fab7; the seven nested `claude -p` runs above in `/tmp/claude-0/c7` (scratch, not committed); the R1 reproduction with both installers. Nothing merged or marked ready.
