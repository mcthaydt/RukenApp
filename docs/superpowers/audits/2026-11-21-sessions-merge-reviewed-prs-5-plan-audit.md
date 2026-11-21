# Plan audit 5: sessions mark ready and merge reviewed pull requests

Examined: spec `docs/superpowers/specs/2026-11-21-sessions-merge-reviewed-prs-design.md` at **7133053** (PR #257), against `.claude/hooks/rules.mjs` (its `globToRegExp` and `matchesAny`, line 42 and 43) and CLAUDE.md's Risk section on that commit, and plan audit 4 (`0e54421`). Lane 3 plan audit, round 5, Opus 5.5, medium.

Prompt: Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

**Verdict: PASS, 0 red, 4 notes.** Round 4's one red is fixed, and I found no new way for a merge to skip review. The fix commit (7133053) changes only the spec: its status line, the lane 3 list in §3.4, one case in §4 d and the wording of §4 h.

## Round 4's red, checked

| Round 4 R1 part | Spec at 7133053 | Evidence | Holds? |
|---|---|---|---|
| (a) 2 h fails on today's CLAUDE.md because of `release` and `.md` | §4 h names exactly `release` and `.md` as skipped, fails on any other backticked token its lane does not match, and rules out a `/` filter | Every backticked token of the Lane 2 and Lane 3 bullets under `## Risk` (`awk '/^## Risk/,/^## The staged/' CLAUDE.md`, then `grep -o`): 11 in Lane 2, 9 in Lane 3. The only two no glob matches are `release` and `.md`. With trailing `/` read as `/**`, every other token is matched by its lane's §3.4 globs (run in node with the hook's own `globToRegExp`), and every §3.4 entry is either one of those tokens or on the named list (`CLAUDE.md`, `**/CLAUDE.md`, `.claude/**`). So 2 h passes on today's file and still fails when a path is added. | Yes |
| (b) root `CLAUDE.md` matched by no lane 3 glob | §3.4 lane 3 adds `CLAUDE.md` beside `**/CLAUDE.md`; 2 h's named list has it | `globToRegExp('CLAUDE.md')` is `/^CLAUDE\.md$/`: `CLAUDE.md` true, `a/CLAUDE.md` true (by `**/CLAUDE.md`), `xCLAUDE.md` false, `docs/CLAUDE.md.bak` false. `git ls-files` lists one `CLAUDE.md`, at the root. | Yes |
| (b) §4 d case | body "Lane 1", files `["CLAUDE.md"]`: review deny | Present in §4 d | Yes |

## Bypass sweep

Same sweep as round 4, rerun against 7133053: other repos (refused by 3.2, without case); squash or rebase (refused); missing `merge_method` (GitHub defaults to a merge commit); base change (refused, 3.3); body rewritten to lane 1 (files raise the lane, now including the root `CLAUDE.md`); cut or unreadable file list (lane 3); push during the check (pinned by `expectedHeadSha`, 3.6, see N1); auto-merge (not allowed; `disable` merges nothing); `state` close or reopen (merges nothing); broken hook, config or input (exit 1 under `onFailure: "block"`). The fix adds a glob and a skip list in a test; neither can lower a lane: the skip list is in the test, not in `rules.json`, and the new glob only raises files to lane 3. Nothing open.

## Notes (recorded, not blocking)

- **N1. Pin to the same read (round 4 N1, still open).** §3.6 still says "the full `pr.head.sha` the hook read". If the implementation reads the pull request again for the pin, after `checkReviewed`'s read, a session that pushed head B after a PASS on A and passes `expectedHeadSha: B` would match the second read. The implementation audit should check that the pin compares against the same object `checkReviewed` judged, and that it still runs when `checkReviewed` returns early (`prFlow` off). Compare without case. Recommended wording for the builder; not a spec blocker, since one read is the natural build.
- **N2. Case of `CLAUDE.md`.** The globs match case-sensitively, so a file named `claude.md` is not lane 3 by path. Git and GitHub treat it as a different file from the rules file, so this is no bypass of the root rules; recorded only.
- **N3. 2 h does not check `lanePathsExcept`.** The two exception globs (`verify`, `this-repo` skills) are not tied to CLAUDE.md's "A repo's own skills" bullet by any test. They only lower a lane by path for those two folders, and the body and other files still decide (round 3 N2). Recorded.
- **N4. Status line punctuation.** "2 (4 red at e16e6e6) 3 (2 red at cd5d64c)" lacks a comma. Cosmetic.

Round 4's N2 to N6 (root config for 3.2, one `draft` wording, the second entry's `timeout`, two hook runs per call, `onFailure` evidence) are unchanged in the spec and stay notes for the build and its implementation audit.

## What comes next

The spec can merge. Then unit A builds in a fresh session against it, followed by the implementation audit (lane 3).
