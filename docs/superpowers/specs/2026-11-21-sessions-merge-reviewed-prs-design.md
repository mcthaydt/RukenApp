# Sessions mark ready and merge reviewed pull requests

Date: 2026-11-21. Status: **spec, revised after plan audit 1 (5 red at 8ce7b7a); waiting on plan audit 2.** Lane 3 (it changes `.claude/settings.json`, `.claude/hooks/rules.mjs` and what needs the owner).

Lines marked **Owner** are the owner's words. Lines marked **Call** are this spec's choices; the owner can overrule any of them.

## 0. The owner's direction

- **Owner, 2026-11-21 06:54 UTC:** "add a permission rule", after the auto-mode classifier refused `gh pr ready` and `gh pr merge` in every session, so the owner had to run the ready and merge for #256 by hand.
- **Standing permission** (`history.md`, 2026-11-20): "Merge PRs yourself once CI, reviews and audits pass, without asking the owner. Live Cloudflare and console switches still need the owner." This spec adds no new permission; it lets sessions act on that one, in `mcthaydt/RukenApp` only.

## 1. The outcome

A session in this repo, in auto mode, can mark one of this repo's pull requests ready, merge it (merge commit), queue that merge with auto-merge, and take a queued merge off again, without the classifier refusing and without the owner running a command. Nothing approved this way skips a check the rule hook makes today: a lane 2 or 3 pull request is refused without a passing review that names its head commit, the live-state file must be gone, and any method but a merge commit is refused. The same tools aimed at any other repository are refused by the hook, so the owner keeps those.

## 2. Why an allow rule works

- https://code.claude.com/docs/en/permission-modes (auto mode): "Actions matching your allow, ask, or deny rules resolve immediately"; only what matches no rule goes to the classifier. The listed exceptions are protected-path writes, critical-path `rm`, MCP tools that need user interaction, commands with per-command allowed domains, and ask rules on command content.
- On entering auto mode only broad rules are dropped (`Bash(*)`, wildcard interpreters, package-manager run commands, `Agent`, `Monitor`); "narrow Bash and PowerShell allow rules such as `Bash(npm test)` stay in effect" (https://code.claude.com/docs/en/auto-mode-config). Project `permissions.allow` is read from `.claude/settings.json`; the separate `autoMode` block is not read from project settings, so this spec does not use it.
- The rule hook runs on PreToolUse; its `deny` refused calls in practice in plan audit 1 (every row marked "deny" in its table). An allow rule does not skip it. The docs' ordering was not found stated word for word (audit 1, N4), so criterion 6 is the final check.

## 3. The change

### 3.1 Which route (**Call**, from audit 1's fix direction)

The allow list holds **exact GitHub MCP tool names only, and no Bash rule**:

```json
"permissions": {
  "allow": [
    "mcp__github__merge_pull_request",
    "mcp__github__enable_pr_auto_merge",
    "mcp__github__disable_pr_auto_merge",
    "mcp__github__update_pull_request"
  ]
}
```

Why not `gh pr` or `gh api` rules (audit 1, R1 to R3): a `*` in a Bash rule matches any text, spaces included, so a rule naming the merge address also approves any `gh api` call that carries that address in a header or field (for example a `DELETE` of `main`'s branch protection). A query string (`.../merge?x=1`) slips past the hook's `$`-anchored route match while the rule still approves it, and GitHub's branch protection requires no review, so nothing would hold a lane 3 merge. `gh pr ... -R other/repo` reaches repos the hook does not judge. MCP tool inputs are structured (owner, repo, number, method), so nothing can ride along.

What the hook already checks (`checkMcp`, `.claude/hooks/rules.mjs`, configured by `rules.json` `mcp.*`; audit 1, R4 corrects this spec's first version, which said it did not):

| Tool | Hook checks today |
|---|---|
| `merge_pull_request` | merge method is `merge`, live state gone, passing review on the head (lane 2 and 3) |
| `enable_pr_auto_merge` | merge method given and `merge`, live state, review |
| `update_pull_request` with `draft: false` | live state, review |
| `disable_pr_auto_merge` | nothing; it only takes a queued merge off, which `release` asks for when `main` moves first |

**Accepted reach, said plainly:** `update_pull_request` is one tool, so the rule also approves its other fields on this repo's pull requests: title, body, base, reviewers and `state` (close or reopen). Sessions already edit bodies with it (the footer fix in `release`'s quirks). A close is undone by a reopen and a base change by another update; none merges or deletes anything. The hook keeps checking bodies (`prBody`).

### 3.2 Only this repo (audit 1, R3)

The session's GitHub access also reaches `mcthaydt/RukenPrivate`, where the hook judges no pull request flow (`scopeFor` gives null or the `alsoGuards` config, which leaves out `prFlow`). **Call:** in `checkMcp`, before any network call, the hook refuses `merge_pull_request`, `enable_pr_auto_merge`, `disable_pr_auto_merge`, and `update_pull_request` with `draft: false`, when the target `owner/repo` is not this repo's own `rules.json` `repo` (compared without case), with the reason "This permission covers mcthaydt/RukenApp only; the owner merges pull requests elsewhere." Other `update_pull_request` edits (body, title) on other repos are not refused, so the footer fix keeps working there; on those the classifier no longer decides, which is the accepted reach above.

### 3.3 The hook must not fail open on these tools (audit 1, N1)

Until now the classifier stood behind the hook. After this change, if the hook times out or crashes on one of these tools, the allow rule approves the call. Today the hook says "A crash never blocks", and the hooks docs say a timed-out PreToolUse hook does not block.

- **Call:** add a second `PreToolUse` entry in `.claude/settings.json` whose matcher is exactly `mcp__github__(merge_pull_request|enable_pr_auto_merge|update_pull_request)`, running the same command with `"onFailure": "block"` (audit 1 cites the hooks docs for this key from Claude Code v2.1.295; this container runs 2.1.330). The implementer reads https://code.claude.com/docs/en/hooks first and uses the key exactly as documented; if it does not exist as described, stop and report, do not ship 3.1 without 3.3.
- **Call:** in the hook's crash handler, a crash on one of those three tools answers `deny` ("The rule hook failed, so this merge is not checked; try again or ask the owner") instead of the warning. Every other tool keeps today's warning.

## 4. Acceptance criteria

1. `.claude/settings.json` parses as JSON; its `permissions.allow` is exactly the four names in 3.1 and holds no `Bash(` rule; the only other change in it is the 3.3 hook entry.
2. A committed Vitest test, `tests/rules-merge-permission.test.ts`, run by `pnpm test` with no network, pipes PreToolUse input to `node .claude/hooks/rules.mjs` and passes on:
   a. each of `merge_pull_request`, `enable_pr_auto_merge`, `disable_pr_auto_merge`, and `update_pull_request` with `draft: false`, on `owner: mcthaydt, repo: RukenPrivate`: **deny**, with the 3.2 reason;
   b. `merge_pull_request` with `merge_method: "squash"` and `enable_pr_auto_merge` with `mergeMethod: "SQUASH"` on RukenApp: **deny** (merge method);
   c. `update_pull_request` on RukenPrivate with only a body: no 3.2 deny;
   d. the settings file: the allow list equals the four names, and no allow entry starts with `Bash`.
   If a case needs GitHub to answer (b may reach the review check), the test stubs `gh` with a script on `PATH` that fails, and asserts the deny still names the merge method.
3. A recorded run in the pull request body (the commands and the hook's answers, at the implementation's head commit): on an open lane 3 pull request with no PASS on its head, `merge_pull_request` (method `merge`), `enable_pr_auto_merge` (method `MERGE`) and `update_pull_request` `draft: false` are each **denied** for "no passing review that names its head".
4. The crash rule (3.3): with `node` given a hook input that makes the script throw (the test may set an environment variable the script reads only for this, or feed malformed input, whichever the code already supports), a merge tool answers deny and a `Read`-type call answers no deny. If neither is possible without new test-only code, the implementer adds the smallest seam and names it in the pull request.
5. No file changes outside `.claude/settings.json`, `.claude/hooks/rules.mjs`, the new test, this spec, its audits and the implementer's live-state file (deleted before the implementation audit). `pnpm lint`, `pnpm typecheck` and `pnpm test` pass.
6. After the merge, the first session that marks a reviewed pull request ready or merges it with these tools reports whether the classifier stayed out. If it refused, the coordinator tells the owner plainly, and the fallback stays: the owner runs the command.

## 5. Plan

| Unit | Waits on | Files | Output | Check |
|---|---|---|---|---|
| A. Allow list and fail-closed hook | this spec merged | `.claude/settings.json`, `.claude/hooks/rules.mjs`, `tests/rules-merge-permission.test.ts` | 3.1 to 3.3 | criteria 1 to 5 |

One unit, one pull request, lane 3: plan audit on this spec, then execution, then an implementation audit, then merge under the standing permission. Expected duration: about an hour of session time. No new dependency, tool, environment or spend.

Not in scope (reported, not fixed): `liveFileOnBranch` fails open on a non-404 `gh` error (audit 1, N2); the `gh api` route match in `checkPrFlowBash` and `checkMergeMethod` skips query strings and trailing `/` (audit 1, R2). The second matters only once something approves those commands without the classifier, which this spec no longer does.
