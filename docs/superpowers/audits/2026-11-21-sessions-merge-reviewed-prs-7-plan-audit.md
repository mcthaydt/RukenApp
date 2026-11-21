# Plan audit 7: sessions merge reviewed PRs, amendment 3.7 (cloud user settings)

Examined: spec `docs/superpowers/specs/2026-11-21-sessions-merge-reviewed-prs-design.md` at **e5f12e7** (PR #258), against audit 6 (5b8b384) and the code on that branch. Lane 3, plan audit, Opus 5.5 medium. Graphify: not used (only the spec changed; the code read was `rules.mjs` main, `rootForCall` and `INSTALL_JS`, read directly).

**Verdict: e5f12e7 FAIL: 1 red, 3 notes.**

Audit prompt: Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## Audit 6's red is fixed

The new command tries `$CLAUDE_PROJECT_DIR/.claude/hooks/rules.mjs` first, then one folder below, then `exit 1`. Run as a shell command here with today's `rules.mjs` and a `merge_pull_request` input:

| `CLAUDE_PROJECT_DIR` | Result |
|---|---|
| `/home/user` (repo one below) | deny JSON (judged), exit 0 |
| `/home/user/RukenApp` (repo itself) | nothing, exit 0: today's early return; the spec's "No early return for these tools" bullet and criterion 6's repo-itself case require a deny here |
| empty scratch folder | exit 1 (blocked) |

So the command shape is right, and the one gap left in today's code is already named by the spec and checked by criterion 6. `rootForCall` with `cwd` = the repo finds the repo through `findRoot(cwd)`, so the judged path works once the early return is skipped. The cost line, the `--print-setup`-only scope, the owner card and N1 as a follow-up are all stated. `RukenApp` sorts before `RukenPrivate` and RukenPrivate has no `rules.mjs`, so `/home/user` picks RukenApp.

## Red

**R1.** UNIT: section 3.7 and criterion 6. VERDICT: red. REQUIREMENT: 3.7 "leaves the user's own hooks alone, as it does for the launcher entries today", and the rule hooks staying on in cloud (every other tool "unchanged"). REASON: criterion 6 never checks that `--print-setup` still writes the four launcher entries, and the natural way to add the blocking entry silently deletes the `PreToolUse` launcher, turning off every Bash/Write/Edit/Agent rule check in cloud sessions. EVIDENCE: today's installer loops over `E` per event and, for each item, drops every hook matching `ours` (`/\/\.claude\/hooks\/rules\.mjs"?;? do /`), which also matches the new blocking command. Adding the blocking entry as a fifth `E` item (`["PreToolUse", <3.5 regex>, <blocking command>]`) and running the printed setup script with a scratch `HOME` gave `PreToolUse: [ '^mcp__github__(merge_pull_request|disable_pr_auto_merge|update_pull_request)$ :: done; exit 1' ]`: the `Bash|Write|Edit|MultiEdit|Agent|Workflow|mcp__.*` launcher entry is gone. Criterion 6 for `--print-setup` checks only "the three allow names and the blocking entry", so this passes it; no existing test runs `--print-setup` or `--install-user` (`grep -rn print-setup tests/` is empty). EXPECTED: after the `--print-setup` script runs, from no file and on a re-run, `~/.claude/settings.json` holds all four launcher entries exactly as `--install-user` writes them, plus the blocking entry, each once. FIX: spec only: add to criterion 6 "the `--print-setup` script, from no file and run twice, writes the four launcher entries (same matchers and commands as `--install-user`) and the blocking entry, each exactly once", and to 3.7 that the installer matches its blocking entry by matcher and command separately from the launcher, so replacing one never removes the other. Files: the spec.

## Notes (not blocking)

- **N1. Two commands in one bullet.** 3.7's blocking-entry bullet still says "whose command is the launcher's loop (`for f in "$CLAUDE_PROJECT_DIR"/*/…; done`) followed by `exit 1`" and then gives the new loop. Criterion 6's repo-itself case would catch the old one, but the installer "recognises its own entries by that command", so state the command once. Fix: delete the old parenthesis.
- **N2. `--install-user` after `--print-setup` on one `HOME`.** Today's `ours` regex also matches the blocking command, so an `--install-user` run on a cloud `HOME` would remove the blocking entry and leave the allow list: allowed with no fail-closed entry. Unlikely (nobody runs `--install-user` in cloud), and R1's separate matching fixes it too; worth one test case.
- **N3. Criterion 7 method** stays as audit 6 N3 says (`--mcp-config` stand-in server with `--strict-mcp-config`, `< /dev/null`).

## What ran

- `node .claude/hooks/rules.mjs --print-setup`, edited in a scratch copy to add the blocking entry as an `E` item, run with `HOME` set to scratch: launcher `PreToolUse` entry lost (R1).
- The spec's blocking command under bash in three folders, with today's `rules.mjs` (table above).
- Not run: a nested `claude -p` (audit 6 already proved user-level allow is read and user-level `onFailure: "block"` + `exit 1` blocks; nothing in this amendment changes that).
