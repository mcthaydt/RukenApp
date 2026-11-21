# Implementation audit 3: sessions merge reviewed PRs (amendment 3.7, fix of audit 2's R1)

Examined: **59b77f2** on `claude/project-thread-1qu41r` (PR #258), against spec `docs/superpowers/specs/2026-11-21-sessions-merge-reviewed-prs-design.md` 3.7 and criteria 6 and 7, and implementation audit 2 (2d41786). Lane 3 implementation audit, Opus 5.5 medium, 2026-11-21 08:21 UTC. Graphify: not used (one function in one script and one test changed, read directly).

Audit prompt: Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

**Verdict: 59b77f2 PASS: 0 red, 2 notes.** Audit 2's R1 is fixed and its new test fails on the old code. The PR body's claim that the fix leaves the blocking command and the allow list alone is true, so audit 2's criterion 7 run at a71fab7 still holds for 59b77f2.

## Checks run at 59b77f2

| Check | Result |
|---|---|
| `pnpm install --frozen-lockfile` | exit 0 |
| `pnpm lint` | exit 0 |
| `pnpm typecheck` | exit 0 |
| `pnpm test` | exit 0, 116 files, 1664 tests passed |
| `node .claude/hooks/rules.mjs --check` | exit 0, config valid |
| New test against a71fab7's `rules.mjs` | fails (1 failed, 32 passed): the test catches R1 by itself |
| Diff a71fab7..59b77f2 | `rules.mjs` (2 lines: `isBlocking`, and the blocking pass filters only entries whose matcher is `BM`), the test file (one case), audit 2. `BLOCK_RUN`, `MERGE_TOOLS_ALLOW`, `MERGE_TOOLS_MATCHER`, the launcher entries and `.claude/settings.json` unchanged |

## The criterion 7 claim

- `--print-setup` output at a71fab7 and at 59b77f2 differ only in the two lines above (and a comment).
- Both scripts run into an empty scratch `HOME`: the written `settings.json` files are byte-identical. So the cloud-shaped session audit 2 ran (allow read in default and auto mode, RukenPrivate refused, broken `rules.json` blocked by the user-level entry, real merge of #258 denied) sees the same settings at 59b77f2. Not rerun; not needed.
- A `HOME` set up by a71fab7's script, then run through 59b77f2's: "Rule hooks already in …", file unchanged.

## R1 rechecked

- Audit 2's reproduction (user `Bash` guard `/usr/local/bin/my-guard || exit 1`, `onFailure: "block"`): kept, once, after `--print-setup`; a re-run says "already in" and changes nothing.
- The same guard placed under the rule's own matcher: kept too (the narrowed `isBlocking` needs `rules.mjs` and `--find-repo`), with the rule's blocking entry added once beside it.
- The new test covers the user guard, an older blocking command (the launcher loop ending `exit 1`) being replaced, and `--install-user` keeping the guard.

## Notes (not blocking)

- **N1. An older blocking entry under a different matcher is not replaced.** The blocking pass looks only in entries whose matcher is exactly today's `BM`. If a later change edits the matcher, the old entry stays beside the new one (both fail closed, so safe, but doubled). Nothing has shipped yet, so no such entry exists today; a later matcher change should match the old one too.
- **N2. A user hook under the rule's matcher gives two entries with that matcher** (the user's and the rule's). Harmless; criterion 6's "each once" is about the rule's own entries.

## What ran

All checks in the first table at 59b77f2; the scratch installer runs in `/tmp/claude-0/a3` (not committed). Nothing merged or marked ready.
