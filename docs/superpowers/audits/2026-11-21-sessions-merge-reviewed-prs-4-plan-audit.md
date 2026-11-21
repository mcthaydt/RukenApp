# Plan audit 4: sessions mark ready and merge reviewed pull requests

Examined: spec `docs/superpowers/specs/2026-11-21-sessions-merge-reviewed-prs-design.md` at **7d4052f** (PR #257), against `.claude/hooks/rules.mjs`, `.claude/hooks/rules.json` and `.claude/settings.json` on that commit, CLAUDE.md's Risk section, the GitHub MCP tool schemas this session loads (`merge_pull_request`, `update_pull_request`, `disable_pr_auto_merge`), and `main`'s branch protection. Lane 3 plan audit, round 4, Opus 5.5, medium.

Prompt: Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

**Verdict: FAIL, 1 red, 6 notes.** Round 3's two red are fixed, and I found no new way for a merge to skip review. The one red is in a test, not in the rule: criterion 2 h, as written, fails on the first run against today's CLAUDE.md, because the Lane 2 and Lane 3 bullets carry two backticked words that are not paths. The fix is one named skip list in the test.

## Round 3's red, checked

| Round 3 | Spec at 7d4052f | Holds? |
|---|---|---|
| R1 push between the PASS check and the merge | §3.6: refuse `merge_pull_request` unless `expectedHeadSha` is the full head the hook read, on every lane; §3.1 table row; §4 i (missing, other commit, full head) | Yes. The tool schema has `expectedHeadSha` ("The expected SHA of the pull request's HEAD ref"), and GitHub's merge `sha` answers 409 when the head moved, so a merge can only land on the head the hook judged. Holding it on lane 1 too closes the same race for a lane-from-files change (a lane 1 body, docs at head A, a push of `src/lib/` at B: the merge pinned to A gets 409). See N1 on which read. |
| R2 `lanePaths` drift from CLAUDE.md | §3.4: `lanePathsSource` key, "edits both, and the test says when they differ"; §4 h: CLAUDE.md paths must be matched by `lanePaths`, extra entries must be on a named list, and a copy with an added lane 2 path must fail | The design holds. The test as written does not pass today: see R1 below. |

## Round 3's notes, checked

| Note | Spec at 7d4052f | Holds? |
|---|---|---|
| N1 `process.exitCode = 0` (rules.mjs line 1459) | §3.5: `process.exit(1)` or remove the line | Yes |
| N2 no negation in `matchesAny` | §3.4: separate `prFlow.lanePathsExcept.3` (`verify`, `this-repo` skills) | Yes. Fails safe: an excepted file is only not lane 3 by its path; body and other files still decide. |
| N3 `after-compaction.md`, nested CLAUDE.md | lane 3: `.claude/**`, `**/CLAUDE.md` | Nested files and `after-compaction.md`, yes. The root `CLAUDE.md`, no: `globToRegExp('**/CLAUDE.md')` is `^.*/CLAUDE\.md$`, which needs a `/` before the name (checked with node: `CLAUDE.md` false, `a/CLAUDE.md` true), and no other lane 3 glob matches it. Part of R1. |
| N4 no JSON comment | `"lanePathsSource": "CLAUDE.md, Risk"` key | Yes |
| N5 green is GitHub's job | §3.1 table row | Yes. Checked now: `gh api repos/mcthaydt/RukenApp/branches/main/protection` gives contexts `gate`, `commit-authors`, `enforce_admins` true, no required reviews. |
| N6 cut file list | §3.4: count read vs `changed_files` gives lane 3; timeout blocks | Yes |
| N7 `draft` "present and not true" | §3.1 table | Yes for this repo; §3.2 and §4 j still say `draft: false` (N3 below) |
| N8 where the rule loads | left to criterion 5 | Accepted |

## Red findings

**R1.** UNIT: spec §4 h, `tests/rules-merge-permission.test.ts`; spec §3.4 lane 3 list. VERDICT: red. REQUIREMENT: criterion 4 "`pnpm test` passes"; CLAUDE.md "A check is a test that fails by itself" and "A change does not quietly edit its own check". REASON: criterion 2 h says "take every backticked path in the **Lane 2** and **Lane 3** bullets … assert each is matched by that lane's `lanePaths`", but those bullets also backtick two words that are not paths, so the test fails on its first run and the implementer has to change the check on the way. Separately, the root `CLAUDE.md` is matched by no lane 3 glob. EVIDENCE: `awk '/^## Risk/,/^## The staged/' CLAUDE.md`, backticked tokens of the Lane 2 bullet: `src/lib/` … `tests/fixtures/` **`release`** ("Merges after `release`'s extra checks"); of the Lane 3 bullet: `tests/golden/` … `src/features/membership/` **`.md`** ("even though they are `.md` files") `.claude/settings.json`. Neither `release` nor `.md` is matched by any glob in §3.4. The obvious quick filter ("keep tokens with a `/`") would also drop `package.json`, `pnpm-lock.yaml`, `vite.config.ts`, `playwright.config.ts` and `wrangler.jsonc`, the root-file half of lane 2, which is the drift the test exists to catch. And `**/CLAUDE.md` compiles to `^.*/CLAUDE\.md$`, which needs a `/` before the name, so a pull request changing only the root `CLAUDE.md` with a body saying "Lane 1" is read as lane 1 by its files (CLAUDE.md says it is lane 3; the gap is the R4 hole of round 2 for the most important rules file). EXPECTED: 2 h passes on today's CLAUDE.md with no change at build time, still fails when a path is added, and the root `CLAUDE.md` is lane 3 by its path. FIX (spec §3.4 and §4 h only; at build, `rules.json` and the test only): (a) in §4 h, name the tokens that are not paths in the test, exactly `release` and `.md`, and have the test fail on any other backticked token the lanes do not match, so a new non-path word is a decision, not a silent skip; (b) in §3.4's lane 3 list add `CLAUDE.md` beside `**/CLAUDE.md`, add it to 2 h's named list, and add a §4 d case: body "Lane 1", files `["CLAUDE.md"]`: review deny.

## Notes (recorded, not blocking)

- **N1. Pin to the same read.** §3.6 says "the full `pr.head.sha` the hook read", and the hook reads the pull request several times (`prBranch` in `checkLiveState`, `checkReviewed`, `checkMergeGreen`). The pin is only sound if it compares against the very object `checkReviewed` used for the verdicts and the file list; a second read after a concurrent push could match a head no review named, if the caller passes that new head. Say "the head `checkReviewed` read, with no second read", and put the pin outside `checkReviewed`'s early return (`!f || f.enabled === false || f.requireReview === false || !repo`) or say it reads the pull request itself when that return fires, so turning `prFlow` off does not turn the pin off. Compare without case (`expectedHeadSha` is free text).
- **N2. Compare 3.2 against the root config.** `preToolUse` hands `checkMcp` a scoped config: for a slug on `alsoGuards` it is `agnostic(config)`, whose `repo` is `null`. `alsoGuards` is `[]` today, so nothing breaks, but "compare to `rules.json` `repo`" should name the loaded root config, and the check should refuse when that value is missing, not skip.
- **N3. "draft present and not true" in one place, `draft: false` in two.** §3.1's table uses the looser test; §3.2 and §4 j still say `draft: false`. Use one wording in all three. The schema makes `draft` a boolean, so this is consistency, not a hole.
- **N4. The second entry's timeout.** §3.5 says "the same command"; criterion 1 checks only the matcher and `onFailure`. Name `"timeout": 30`, as the first entry has, so a slow run blocks on the same clock.
- **N5. Two hook runs per call.** Both `PreToolUse` entries match these three tools, so each call runs the hook twice, with its `gh` reads twice. Harmless (both deny or both allow; the same reason twice), noted so a doubled message in criterion 3's record is not mistaken for a bug.
- **N6. `onFailure` evidence.** The doc citation (v2.1.295; this container `claude --version` 2.1.330) was not re-read here; criterion 3's live blocked-call record and §3.5's "stop and report" stand in for it.

Still out of scope, as the spec says: `liveFileOnBranch` failing open on a non-404 error, verdict lines any session can post, local `rules.json` edits.

## Bypass sweep

Looked for any way the three allowed tools reach a merge without the review: other repos (refused, §3.2, compared without case); squash or rebase (refused); missing `merge_method` on `merge_pull_request` (GitHub's API default is a merge commit); base change (refused on this repo); body rewrite to lane 1 (files raise the lane, except the root `CLAUDE.md`, R1); a cut or unreadable file list (lane 3); a push during the check (pinned, N1); auto-merge (not allowed; `disable` cannot merge); `state` close or reopen (merges nothing); hook broken, missing config or bad input (exit 1 under `onFailure: "block"`). Only the root `CLAUDE.md` gap is open.

## What a passing round 5 needs

R1 fixed in §3.4 and §4 (named non-path tokens in 2 h; root `CLAUDE.md` in lane 3 with its §4 d case).
