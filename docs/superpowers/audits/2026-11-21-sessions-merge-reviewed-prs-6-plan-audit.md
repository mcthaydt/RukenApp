# Plan audit 6: sessions mark ready and merge reviewed pull requests (amendment 3.7)

Examined: **6afbad7** on `claude/project-thread-1qu41r` (PR #258), the amendment to `docs/superpowers/specs/2026-11-21-sessions-merge-reviewed-prs-design.md` after implementation audit 1 (540936a FAIL, R1): new section 3.7, criteria 6 and 7, the plan row and the follow-up line. Only the spec changed since 03fb74f. Lane 3 plan re-audit, Opus 5.5, medium, 2026-11-21 07:56 UTC. Read against the hook at 6afbad7 (`.claude/hooks/rules.mjs`: `INSTALL_JS`, `main`, `rootForCall`, `checkMcp`). Graphify: not used (one spec and one script, read directly).

Prompt: Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

**Verdict: FAIL, 1 red, 3 notes.** The amendment fixes implementation audit 1's R1 for cloud sessions, and I proved its core in this container with a nested session: a user-level allow is read with trust off, and a user-level `onFailure: "block"` entry ending `exit 1` blocks the call. Criterion 7 is runnable. The red: the blocking command looks for the repo only one folder below the session's folder, so a session opened in the repo folder itself, on any machine where the installer runs, has all three tools blocked, which contradicts 3.7's own "a trusted local session uses them".

## What was asked, answered

| Question | Answer | Evidence |
|---|---|---|
| Can the user-level allow reach another repo? | Not today. The blocking entry runs the repo's hook, and `checkMcp` refuses another repo (3.2). | Command fed a `disable_pr_auto_merge` call on `mcthaydt/RukenPrivate` with `CLAUDE_PROJECT_DIR=/home/user`: exit 0 with deny "This permission covers mcthaydt/RukenApp only". It holds because only RukenApp has a `rules.json` below (N1). |
| Can it skip the review check? | No. Allow rules resolve the permission; the PreToolUse hook still runs first and its deny wins (spec §2). The user-level entry runs the same `rules.mjs`, so 3.2 to 3.6 all apply. | Same run; `checkMcp` path unchanged. |
| Does `exit 1` on a missing repo break unrelated sessions? | Only for the three matched tools, which is fail-closed by design; every other tool keeps today's entries. But see R1: the repo-folder session is caught too, and sessions with no Ruken repo on such a machine lose `update_pull_request` entirely. | Table below. |
| Is criterion 7 runnable? | Yes, here. | Nested run below. |

## The command, run as a shell command (at 6afbad7)

`for f in "$CLAUDE_PROJECT_DIR"/*/.claude/hooks/rules.mjs; do [ -f "$f" ] && exec node "$f" --find-repo; done; exit 1`, fed a `disable_pr_auto_merge` PreToolUse input:

| `CLAUDE_PROJECT_DIR` | repo in call | exit | answer |
|---|---|---|---|
| `/home/user` (cloud) | RukenApp | 0 | allowed (no deny printed) |
| `/home/user` (cloud) | RukenPrivate | 0 | deny, "RukenApp only" |
| `/home/user/RukenApp` (session in the repo) | RukenApp | **1** | **blocked** |
| `/home/user/RukenApp` | RukenPrivate | 1 | blocked |
| `/tmp` (no repo) | either | 1 | blocked |

## Criterion 7 feasibility, run in this audit

Claude Code 2.1.330, `claude -p --model haiku`, `HOME` = a scratch folder, `CLAUDE_CODE_IGNORE_PERSISTED_TRUST=1`, working directory a scratch folder, a stdio stand-in server named `github` (one tool, `disable_pr_auto_merge`, writes a marker) passed with `--mcp-config … --strict-mcp-config`. Auth works with a scratch `HOME` here (the proxy's base URL comes from the environment).

| Run | `~/.claude/settings.json` | Tool reached | Answer |
|---|---|---|---|
| control | `{}` | no | "Claude requested permissions to use mcp__github__disable_pr_auto_merge, but you haven't granted it yet." |
| allow | `permissions.allow` = the tool | **yes** | "auto-merge disabled" |
| allow + blocking entry | the allow plus the 3.7 entry (3.5 matcher, `onFailure: "block"`, command above), no repo below | **no** | "The PreToolUse hook failed, so the call … was not made." |

So a user-level allow is read with trust off, and a user-level `onFailure: "block"` blocks: the two assumptions 3.7 rests on hold. Implementation audit 1 had shown `onFailure` only through `--settings`.

## Red

**R1. The blocking entry blocks the three tools in a session opened in the repo folder itself.**

- UNIT: spec 3.7, "The blocking hook entry" (and criterion 6).
- VERDICT: red.
- REQUIREMENT: spec 3.7: "The repo entries stay (a trusted local session uses them)"; spec §1 outcome (a session in this repo can mark ready and merge). `release` tells a computer whose sessions start one folder above to run `--install-user`, and 3.7 makes `--install-user` write the same entries (criterion 6 tests both).
- REASON: the loop only looks at `"$CLAUDE_PROJECT_DIR"/*/`, one folder below. When the session's folder is the repo, nothing matches, the command reaches `exit 1`, and the user-level entry blocks the call even though the repo's own settings would allow and judge it. The "no early return" bullet only matters when the repo hook is reached, which this loop never does from the repo folder.
- EVIDENCE: the table above, `CLAUDE_PROJECT_DIR=/home/user/RukenApp`: exit 1 for a call on RukenApp. On the same machine, sessions in any unrelated project (`/tmp` row) also lose `update_pull_request`, `merge_pull_request` and `disable_pr_auto_merge` outright; 3.7 does not say so.
- EXPECTED: a session opened in the repo folder is judged by the repo's hook (deny or allow), not blocked; and the spec states plainly which sessions lose the three tools.
- FIX: in 3.7, make the command try the folder itself first: `for f in "$CLAUDE_PROJECT_DIR"/.claude/hooks/rules.mjs "$CLAUDE_PROJECT_DIR"/*/.claude/hooks/rules.mjs; do [ -f "$f" ] && exec node "$f" --find-repo; done; exit 1` (the "no early return" bullet then makes it judge the call; `rootForCall` finds the repo from `cwd`). Add to criterion 6: with `CLAUDE_PROJECT_DIR` set to the scratch repo itself, the written command does not exit 1 for a `merge_pull_request` call (a deny comes back). Add one sentence to 3.7 naming the cost: on a machine where the installer ran, a session with no Ruken repo in or one folder below its folder cannot use these three tools. Recommended: write the allow and the blocking entry only in the `--print-setup` output (the cloud environment), and leave `--install-user` writing the launcher as today, so the owner's own computer is unchanged; if the author keeps both, say why. Files: the spec only.

## Notes (recorded, not blocking)

- **N1. "This repo" follows the call when another checkout below has a `rules.json`.** `preToolUse` passes `thisRepo: config.repo`, where `config` is the root `rootForCall` picked by matching the call's own `owner/repo` against each `rules.json` below. Today only RukenApp has one (`/home/user/RukenPrivate/.claude/hooks/` does not exist), so a RukenPrivate call falls to the single root and is refused. If RukenPrivate ever gains its own `rules.json`, the user-level allow would cover merges there, judged by that repo's config. 3.7 could say so in one line, or the blocking command could pin the repo (for example an argument naming `mcthaydt/RukenApp` that `checkMcp` uses as `thisRepo`). A follow-up, not this change.
- **N2. The owner step is outside the repo, so it needs the owner's go by name.** 3.7 says "the coordinator can do it with the environment update tool once this merges … Recorded under Standing permissions". CLAUDE.md: permission to act outside the repo (an environment) "is asked for by name". The merge does not give it; the coordinator asks the owner (a card, recommended: let the coordinator replace the setup script) and records the answer before changing the environment.
- **N3. Criterion 7 method details.** Pass the stand-in server with `--mcp-config <file> --strict-mcp-config` and redirect stdin (`< /dev/null`); both worked here. Without the allow the run answers "you haven't granted it yet", which is a clear control for (a).

## What comes next

R1 goes back to the spec author (spec only), then a plan audit 7 of that change. Implementation audit 1's R1 is otherwise answered by 3.7 as written.
