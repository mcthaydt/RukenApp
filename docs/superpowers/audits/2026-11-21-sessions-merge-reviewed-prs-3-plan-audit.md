# Plan audit 3: sessions mark ready and merge reviewed pull requests

Examined: spec `docs/superpowers/specs/2026-11-21-sessions-merge-reviewed-prs-design.md` at **cd5d64c** (PR #257), against `.claude/hooks/rules.mjs`, `.claude/hooks/rules.json` and `.claude/settings.json` on that commit, CLAUDE.md's Risk section, the `release` skill, the GitHub MCP tool schemas this session loads, and `main`'s branch protection. Lane 3 plan audit, round 3, Opus 5.5, medium.

Prompt: Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

**Verdict: FAIL, 2 red, 8 notes.** All four of round 2's red are fixed in the spec, each with a test case in §4. Two smaller gaps are left: the merge does not pin the head the hook just checked, and nothing keeps the copied lane lists in step with CLAUDE.md. Both fixes are a few lines and one test case each.

## Round 2's red, checked

| Round 2 | Spec at cd5d64c | Holds? |
|---|---|---|
| R1 fail open (bad `rules.json`, no root, bad input, crash) | §3.5: second `PreToolUse` entry with `onFailure: "block"`, matcher anchored; every "did not run" path exits 1 for these tools; §4 f tests broken, missing and `not json`, and a `Read` control | Yes. `main()` lines 1442–1444 (`if (error) { emit(...); return; }`) and 1456–1458 (crash handler) are the paths to change; `roots` is never empty without `--find-repo`, so "no root" cannot happen under the project entry, and node failing to start already exits non-zero. See N1 on line 1459. |
| R2 auto-merge survives a push | §3.1: `enable_pr_auto_merge` dropped; stays with the classifier and the owner | Yes. `disable_pr_auto_merge` cannot merge. |
| R3 base change keeps the PASS | §3.3: `base` on this repo refused; §4 c | Yes. `grep -n base .claude/skills/release/SKILL.md`: no step changes a base. |
| R4 lane from a rewritable body | §3.4: lane = max(body, every changed file incl. `previous_filename`); read failure or a cut list = lane 3; §4 d | Yes for the files listed today (they match CLAUDE.md Risk word for word, checked line by line). See R2 below for later drift. |

`update_pull_request` other fields, as asked: `draft: false` runs live state and review (rules.mjs 1120–1122); `draft: true` and `state` (open, closed) merge nothing (a closed pull request cannot merge); `state: "open"` with `draft: false` in one call still meets the ready checks. `scopeFor` lowercases both slugs (rules.mjs 486–491), so `MCTHAYDT/rukenapp` gets the full config, not the weaker fallback.

## Red findings

**R1.** UNIT: spec §3.1 table and §4, `checkMcp` for `merge_pull_request`. VERDICT: red. REQUIREMENT: §1 "a lane 2 or 3 pull request is refused without a passing review that names its head commit"; CLAUDE.md "a push that changes what it covered makes it stale". REASON: the hook reads the head, finds a PASS on it, and allows; GitHub then merges whatever the head is when the call lands, so a push between the two (the hook makes several `gh api` reads, seconds apart) merges a head no review named. EVIDENCE: the `merge_pull_request` schema has `expectedHeadSha` ("The expected SHA of the pull request's HEAD ref", GitHub's merge `sha`, which answers 409 when the head moved); `checkMcp` never reads it (`grep -n expectedHeadSha .claude/hooks/rules.mjs`: nothing), and the spec does not mention it. EXPECTED: the merge only goes through on the exact head the hook checked. FIX (spec §3.1 and §4, then `rules.mjs` only): for `merge_pull_request` on this repo, refuse when `expectedHeadSha` is missing or is not the full `pr.head.sha` that `checkReviewed` read ("pass expectedHeadSha: the head the review names"). Add a §4 case: lane 3, PASS on `abc1234`, no `expectedHeadSha`: deny; `expectedHeadSha` of another commit: deny; the stub's full head: no deny.

**R2.** UNIT: spec §3.4, `rules.json` `prFlow.lanePaths`. VERDICT: red. REQUIREMENT: §3.4's own claim "the lists stay in `rules.json` so a later rule change edits one place"; CLAUDE.md "A check is a test that fails by itself". REASON: the lists are a copy of CLAUDE.md's Risk lists, so there are two places, and nothing fails when they part. A later rules pull request that adds a lane 2 or 3 path to CLAUDE.md and not to `rules.json` silently lets a body saying "Lane 1" merge that path with no review, which is the R4 hole of round 2 coming back. EVIDENCE: §4 has no case comparing the two; `rules.json` is otherwise not tied to CLAUDE.md except `withNames` (rules.mjs 72–77), which reads the author and last line from CLAUDE.md. EXPECTED: a change to either list that leaves them apart fails `pnpm test`. FIX (spec §3.4 and §4 only; test file only at build): add case h to `tests/rules-merge-permission.test.ts`: read CLAUDE.md, take every backticked path in the "**Lane 2**" and "**Lane 3**" bullets of `## Risk`, and assert each (a trailing `/` read as `/**`) is matched by that lane's `lanePaths`, and that every `lanePaths` entry beyond them is in a short named list in the test (`.claude/hooks/**`, `CLAUDE.md`, `.claude/skills/**`). Reword "edits one place" to "edits both, and the test says when they differ".

## Notes (recorded, not blocking)

- **N1. `process.exitCode = 0` on line 1459** runs after `main()` and the crash handler, so an implementer who sets `process.exitCode = 1` instead of calling `process.exit(1)` gets exit 0 and no block. §4 f catches it; worth one line in §3.5 ("call `process.exit(1)`, or remove line 1459").
- **N2. `.claude/skills/**` except two skills** cannot be written in `matchesAny`, which has no negation (`globToRegExp`, rules.mjs 42). Name the form in §3.4: for example `lanePathsExcept`, or listing `.claude/skills/**` as lane 3 and treating `verify` and `this-repo` as lane 1 paths that do not lower anything. Either is fail-safe.
- **N3. Paths the lists leave out:** `.claude/after-compaction.md` (the text a SessionStart hook injects, so arguably "the hooks sessions run") and any nested `CLAUDE.md` (the glob `CLAUDE.md` matches the root only). Using `.claude/**` and `**/CLAUDE.md` for lane 3 (with N2's exception) covers both.
- **N4. "A comment there names CLAUDE.md Risk"**: `rules.json` is parsed with `JSON.parse`, which refuses comments, and after §3.5 a broken `rules.json` blocks every merge. Use a key such as `"lanePathsSource"`; criterion 4's `--check` would catch a real comment.
- **N5. The table's "required statuses green"** is not checked by the hook today: `rules.json` `mergeGreen.statuses` is `[]`, so `checkMergeGreen` returns at once. `main`'s branch protection does the job (`gate`, `commit-authors`, `enforce_admins: true`, checked with `gh api repos/mcthaydt/RukenApp/branches/main/protection`). Reword the row to say GitHub enforces it.
- **N6. A cut file list** should be detected by comparing the count read with the pull request's `changed_files`, and the 30-page worst case (8 s per read) is far past the 30 s hook timeout, which `onFailure: "block"` turns into a refusal. Both fail safe; say so in §3.4.
- **N7. `draft: false` is tested with `=== false`.** The tool schema makes it a boolean, so this holds; testing "present and not `true`" costs nothing and survives a looser server.
- **N8. Where the rule loads.** The allow list and the second entry live in the repo's `.claude/settings.json`, so they only load when a session's project folder is the repo. A cloud session started one folder up runs the hook through the user-level launcher and gets neither, so the classifier decides as today. Nothing leaks; criterion 5 will show it.

Still out of scope, as the spec says: `liveFileOnBranch` failing open on a non-404 error, verdict lines any session can post, local `rules.json` edits.

## What a passing round 4 needs

R1 and R2 fixed in the spec, each with its §4 case.
