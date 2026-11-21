# Plan audit 8: sessions merge reviewed PRs, amendment 3.7 (cloud user settings)

Examined: spec `docs/superpowers/specs/2026-11-21-sessions-merge-reviewed-prs-design.md` at **5d8af83** (PR #258), against audit 7 (e8393c5) and the code on that branch. The only change since e8393c5 is the spec (3 lines: status, the 3.7 blocking-entry bullet, criterion 6). Lane 3, plan audit, Opus 5.5 medium. Graphify: not used (only the spec changed; the code read was `INSTALL_JS`, `LAUNCH_*` and `main` in `.claude/hooks/rules.mjs`, read directly).

**Verdict: 5d8af83 PASS: 0 red, 3 notes.**

Audit prompt: Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## Audit 7's red is fixed

3.7 now says the installer matches the blocking entry by its own matcher and command, separately from the four launcher entries, names the `ours` overlap, and requires the four launcher entries "exactly as `--install-user` writes them". Criterion 6 now requires, from no file, the three allow names, the four launcher entries (same matchers and commands as `--install-user`) and the blocking entry, each exactly once, with PreToolUse holding both; a re-run that changes nothing; and `--install-user` after `--print-setup` keeping the blocking entry and the allow names. Audit 7's notes: N1 (two commands in one bullet) is fixed, the bullet states the command once; N2 is now a criterion 6 case; N3 is unchanged and still applies.

## Reproduction (scratch `HOME`, nothing committed)

I wrote a scratch prototype of the fix (a copy of `rules.mjs` whose `INSTALL_JS`, only in the `--print-setup` script, adds the allow names and the blocking entry, with `ours` narrowed to skip a command ending `done; exit 1`) and ran criterion 6's installer cases:

| Case | Result |
|---|---|
| `--print-setup` script, no file | allow = the 3 names; SessionStart, PreToolUse launcher, PostToolUse, Stop launcher entries once each; PreToolUse also holds the blocking entry (`onFailure: "block"`, `timeout` 30, ends `exit 1`) |
| Run again | file byte for byte the same |
| `--install-user` after it, same `HOME` | blocking entry and allow names stay; launcher entries once each |
| File with the user's own allow, deny and PreToolUse hook, run twice | user entries kept, the 3 names added once, nothing duplicated |
| `{ broken` | file left as is, script exits 0; `--install-user` exits 1 |

The two wrong builds are caught by the new criterion 6:

- Audit 7's build (blocking entry as a fifth `E` item): from no file PreToolUse has no launcher entry (shown in audit 7), which fails "four launcher entries … each exactly once, with the PreToolUse list holding both".
- An "ordered only" build (blocking entry added after the launcher loop, `ours` unchanged): the prototype's output followed by today's `--install-user` left PreToolUse with only the launcher entry, the blocking entry gone. That fails the new `--install-user`-after case. So "narrowed or ordered" in 3.7 can only be met by narrowing (or something equivalent), and the criterion enforces it.

The blocking command, run as a shell command with today's `rules.mjs` and a `merge_pull_request` input:

| `CLAUDE_PROJECT_DIR` | Result |
|---|---|
| `/home/user` (repo one below) | deny JSON (judged), exit 0 |
| empty scratch folder | exit 1 (blocked) |
| `/home/user/RukenApp` (repo itself) | nothing, exit 0: today's early return, which the spec's "No early return for these tools" bullet and criterion 6's repo-itself case already require the build to remove |

No test runs `--print-setup` or `--install-user` today (`grep -rn "print-setup\|install-user" tests/` is empty), so criterion 6's test is new work for the build, as the spec says.

## Red

None.

## Notes (not blocking)

- **N1. The quoted pattern is not quite the code.** 3.7 quotes the `ours` pattern as `rules.mjs"? do `; the code is `/\/\.claude\/hooks\/rules\.mjs"?;? do /`. The point stands (both match the blocking command); quote it exactly or describe it, if the spec is touched again.
- **N2. `timeout` 30 is not in criterion 6.** 3.7 sets it; criterion 6 checks matcher, `onFailure` and the `exit 1` ending only. The builder should still write it; the implementation audit should check it.
- **N3. Criterion 7 method** stays as audits 6 and 7 say (`--mcp-config` stand-in server with `--strict-mcp-config`, `< /dev/null`).

## What ran

- The scratch prototype's `--print-setup` script and `--install-user` with `HOME` set to five scratch folders (table above); today's `--install-user` after the prototype's output (the "ordered only" case).
- The blocking command under bash in three folders with today's `rules.mjs`.
- Not run: a nested `claude -p` (audit 6 proved user-level allow is read and user-level `onFailure: "block"` + `exit 1` blocks; nothing since changes that). No lint, typecheck or test run: only the spec changed.
