# Plan audit 1: sessions mark ready and merge reviewed pull requests

Examined: spec `docs/superpowers/specs/2026-11-21-sessions-merge-reviewed-prs-design.md` at **8ce7b7a** (PR #257), against `.claude/hooks/rules.mjs` and `.claude/hooks/rules.json` on that commit, branch protection on `main`, and the Claude Code docs the spec cites. Lane 3 plan audit, Opus 5.5, medium.

Prompt: Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

**Verdict: FAIL, 5 red, 4 notes.** The direction is sound (an allow rule is the right lever, and the hook checks the main routes), but as written three of the five rules approve far more than ready and merge, one approved form skips the review check entirely, and the spec's reason for leaving out the GitHub MCP tools is wrong.

## How it was checked

- The hook was fed PreToolUse input for each command (`{"hook_event_name":"PreToolUse","tool_name":"Bash","tool_input":{"command":...}}` piped to `node .claude/hooks/rules.mjs`) in a clone at 8ce7b7a, against PR #257 itself (lane 3, no PASS on its head). Results:

| Command | Hook |
|---|---|
| `gh api -X PUT repos/mcthaydt/RukenApp/pulls/257/merge -f merge_method=merge` | deny (no review) |
| `gh api -X POST repos/mcthaydt/RukenApp/pulls/257/ccr/ready_for_review` | deny (no review) |
| `gh api -X PUT repos/mcthaydt/RukenApp/pulls/257/ccr/auto_merge -f merge_method=merge` | deny (no review) |
| `gh api -X PUT repos/mcthaydt/RukenApp/pulls/257/merge -f merge_method=squash` | deny (squash) |
| `gh pr merge 257 --merge`, `gh pr ready 257` | deny (no review) |
| `gh pr merge 257 --squash` | deny (squash) |
| `gh api -X PUT 'repos/mcthaydt/RukenApp/pulls/257/merge?x=1' -f merge_method=squash` | **no deny** |
| `gh api -X POST 'repos/mcthaydt/RukenApp/pulls/257/ccr/ready_for_review?x=1'` | **no deny** |
| `gh api -X PUT repos/mcthaydt/RukenApp/pulls/257/merge/ -f merge_method=merge` | **no deny** |
| `gh pr merge 5 --merge -R mcthaydt/RukenPrivate` | **no deny** |
| `gh api -X DELETE repos/mcthaydt/RukenApp/branches/main/protection -H 'X-A: repos/mcthaydt/RukenApp/pulls/1/merge'` | **no deny** |
| MCP `merge_pull_request`, `enable_pr_auto_merge`, `update_pull_request` (draft false) on #257 | deny (no review) |

- `gh api 'repos/mcthaydt/RukenApp/pulls/257?x=1'` answers 200 with #257, and `gh api 'repos/mcthaydt/RukenApp/pulls/257/merge?x=1'` reaches GitHub's "check if merged" endpoint (404 = not merged): the query string is passed through and ignored. A trailing `/` is refused by the cloud proxy (400 "could not be canonicalized"); on a machine without the proxy it was not tested.
- `gh api repos/mcthaydt/RukenApp/branches/main/protection`: required checks `gate`, `commit-authors`; `required_pull_request_reviews: null`; admins enforced. GitHub does not require a review, so the hook is the only thing that holds a lane 2 or 3 merge until its PASS.
- Docs (https://code.claude.com/docs/en/permissions): "A `*` in a Bash rule matches any text, including spaces"; "A `*` can go anywhere in the rule: at the start, in the middle, or at the end"; "Bash rules match the whole command text, with `*` standing in for any text"; "A rule must match each subcommand independently" (separators `&&`, `||`, `;`, `|`, `|&`, `&`, newlines). https://code.claude.com/docs/en/auto-mode-config: "narrow Bash and PowerShell allow rules such as `Bash(npm test)` stay in effect in auto mode"; only broad rules such as `Bash(*)` are suspended. https://code.claude.com/docs/en/hooks: "On `PreToolUse`, a timed-out `command` … hook doesn't block the tool call … don't count on a stalled hook to act as a gate."

## Red findings

**R1.** UNIT: §3, the three `gh api` rules. VERDICT: red. REQUIREMENT: the brief ("rules are narrow enough, no broader gh/REST access leaks"; spec §3 "exactly these five rules, and nothing else"). REASON: the leading and middle `*` match any text, so each rule approves any `gh api` call that carries the route string anywhere in its arguments. EVIDENCE: docs quotes above; `gh api -X DELETE repos/mcthaydt/RukenApp/branches/main/protection -H 'X-A: repos/mcthaydt/RukenApp/pulls/1/merge'` matches `Bash(gh api *repos/mcthaydt/RukenApp/pulls/*/merge*)` (the first `*` takes `-X DELETE repos/…/protection -H 'X-A: `) and the hook does not refuse it. The same works with `-f`, `--jq`, `-H` or `graphql` calls. EXPECTED: an allowed form approves only a ready, auto-merge or merge call on one pull request of this repo. FIX: in the spec, replace these three rules with a form that cannot carry other calls (see "Fix direction"); add a criterion that the smuggled command above is not approved. Files: the spec only.

**R2.** UNIT: §3 rule `…/pulls/*/merge*` and `…/ccr/ready_for_review*`, with `checkPrFlowBash` / `checkMergeMethod` in `.claude/hooks/rules.mjs` (lines 603, 1057). VERDICT: red. REQUIREMENT: §1 "Every check the rule hook makes today still runs first"; the brief "nothing lets a merge skip review". REASON: the hook matches the route with a `$`-anchored regex on the raw path, so a query string (or trailing `/`) makes it skip the review, live-state and merge-method checks, while the trailing `*` in the allow rule still approves it. EVIDENCE: the `?x=1` rows above: no deny, even with `merge_method=squash`; GitHub ignores the query (the GET test); branch protection does not require reviews. Today the classifier is the only thing that would stop it; the spec removes that. EXPECTED: any path that resolves to one of the routes is checked, or is not approved. FIX: either drop the trailing `*` path forms from the allow list (R1's fix may do this), or add to the spec a hook change that strips `?…`, `#…` and trailing `/` from `api.path` before matching in `checkPrFlowBash` and `checkMergeMethod`, with tests. Files: the spec now; `.claude/hooks/rules.mjs` in the build if that route is chosen.

**R3.** UNIT: §3 rules `Bash(gh pr ready *)`, `Bash(gh pr merge *)`. VERDICT: red. REQUIREMENT: the brief ("repo-scoped"). REASON: these two rules are not repo-scoped: `-R`/`--repo`/`GH_REPO` or a pull request URL points them at another repository, where `scopeFor` returns null and the hook checks nothing. EVIDENCE: `gh pr merge 5 --merge -R mcthaydt/RukenPrivate` gets no deny. On the owner's computer, gh's token reaches every repo the owner has. EXPECTED: approval only for this repo's pull requests, or the spec says plainly that it accepts the cross-repo reach and why. FIX: in the spec, either drop them for a route that is scoped (a `*` rule cannot exclude `-R`, so see the fix direction below), or record the accepted reach as a decision. Files: the spec only.

**R4.** UNIT: §3, "Not allowed, on purpose". VERDICT: red. REQUIREMENT: Report honestly / Findings carry evidence (a spec's stated reason must be true). REASON: the spec says the rule hook does not check the GitHub MCP tools `merge_pull_request`, `update_pull_request` (draft) and `enable_pr_auto_merge`; it does. EVIDENCE: `checkMcp` in `.claude/hooks/rules.mjs` lines 1113 to 1124 runs merge method, live state, review and (for merge) green checks on all three, configured by `rules.json` `mcp.mergeTools` / `autoMergeTools` / `updatePrTools`, and the PreToolUse matcher includes `mcp__.*`; all three were refused on #257 for "no passing review that names its head". EXPECTED: the spec states the hook's real coverage, and decides on the MCP tools on true facts. FIX: rewrite that bullet; reconsider the MCP tools as the merge route (see fix direction). Files: the spec only.

**R5.** UNIT: §4 acceptance criteria. VERDICT: red. REQUIREMENT: CLAUDE.md "Acceptance criteria come first … criteria a program can observe"; the brief "the hook really covers each allowed route". REASON: criterion 3 only checks squash refusal on two forms; nothing checks that each allowed form is refused without a PASS, that escape forms (R2) are refused or not approved, or that the allow list approves nothing outside the five calls (R1, R3). EXPECTED: a check a program runs. FIX: add criteria: (a) for each allowed form, the hook refuses it on a lane 3 PR with no PASS on its head, and refuses `merge_method=squash`; (b) the R1, R2 and R3 commands are either refused by the hook or not matched by any allow rule (matching can be shown by a small script that applies the docs' `*` semantics to the rule list); (c) these run as a test the build commits. Files: the spec only.

## Notes (recorded, not blocking)

- **N1. Hook timeout fails open.** The PreToolUse hook has a 30 s timeout; `checkReviewed` makes up to three `gh api` calls at 8 s each plus git work, and `liveFileOnBranch` calls `gh` with no timeout. Per the hooks docs a timed-out hook does not block. Today the classifier backs that up; after this change nothing does. Worth a follow-up (the docs name `"onFailure": "block"`, from Claude Code v2.1.295); pre-existing, outside this change.
- **N2. `liveFileOnBranch` fails open** on a `gh` error other than 404 when the branch is not checked out (returns null). Pre-existing.
- **N3. The `ccr/` routes were not exercised** by this audit (calling them changes a PR's state). The spec's claim that they are the working routes in cloud containers stands on the spec author's word; criterion 4 covers it.
- **N4. Docs claim, §2.** Verified for allow rules resolving before the classifier and narrow rules staying in auto mode. That a PreToolUse `deny` beats an allow rule is shown in practice (this session's hook refused calls) but the fetched hooks page did not state the ordering verbatim. Criterion 4's first real use stays the final check.

## Fix direction (for the spec author; not prescriptive)

1. **MCP tools for merge and auto-merge.** `mcp__github__merge_pull_request` and `mcp__github__enable_pr_auto_merge` as exact tool-name rules. Inputs are structured (owner, repo, number, method), so nothing can be smuggled, the hook checks them fully (R4), and the session's GitHub access already limits the repos. Check that the auto-mode docs' "MCP tools that need user interaction" exception does not apply.
2. **Ready.** Either `mcp__github__update_pull_request` (hook checks `draft: false`, but the rule also approves title, body and base edits, which the spec must accept explicitly), or one exact `gh api` form with no `*` before the number and the hook's path fix from R2.
3. If any `gh api` form stays, the hook's route match is made exact (R2) and the spec's criteria prove each form (R5).

Any of these keeps to the owner's ask ("add a permission rule") and the standing merge permission; none adds a dependency or spend.
