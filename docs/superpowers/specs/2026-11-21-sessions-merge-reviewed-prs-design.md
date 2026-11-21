# Sessions mark ready and merge reviewed pull requests

Date: 2026-11-21. Status: **spec, waiting on its plan audit.** Lane 3 (it changes `.claude/settings.json` and what needs the owner).

Lines marked **Owner** are the owner's words. Lines marked **Call** are this spec's choices; the owner can overrule any of them.

## 0. The owner's direction

- **Owner, 2026-11-21 06:54 UTC:** "add a permission rule", after the auto-mode classifier refused `gh pr ready` and `gh pr merge` in every session, so the owner had to run the ready and merge for #256 by hand.
- **Standing permission** (`history.md`, 2026-11-20): "Merge PRs yourself once CI, reviews and audits pass, without asking the owner. Live Cloudflare and console switches still need the owner." This spec adds no new permission; it lets sessions act on that one.

## 1. The outcome

A session in this repo, in auto mode, can mark one of its pull requests ready and merge it (merge commit), or queue that merge with auto-merge, without the classifier refusing and without the owner running a command. Every check the rule hook makes today still runs first: a lane 2 or 3 pull request is still refused without a passing review that names its head commit, the live-state file must be gone, and a squash, rebase or `--admin` merge is still refused.

## 2. Why an allow rule works

The Claude Code docs (https://code.claude.com/docs/en/permission-modes, auto mode) say: "Actions matching your allow, ask, or deny rules resolve immediately", and only what matches no rule goes to the classifier. The exceptions listed there (protected-path writes, critical-path `rm`, MCP tools that need user interaction, commands with per-command allowed domains, ask rules on command content) do not cover these commands. On entering auto mode, only broad rules are dropped (`Bash(*)`, wildcard interpreters, package-manager run commands, `Agent`, `Monitor`); "Narrow rules like `Bash(npm test)` stay in effect." Project `permissions.allow` is read from `.claude/settings.json`; the separate `autoMode` block is not read from project settings (https://code.claude.com/docs/en/auto-mode-config), so this spec does not use it.

PreToolUse hooks run before the permission decision, so the rule hook still refuses a merge it would refuse today. An allow rule does not skip it.

## 3. The change

**Call:** add a `permissions.allow` list to `.claude/settings.json` with exactly these five rules, and nothing else:

```json
"permissions": {
  "allow": [
    "Bash(gh pr ready *)",
    "Bash(gh pr merge *)",
    "Bash(gh api *repos/mcthaydt/RukenApp/pulls/*/ccr/ready_for_review*)",
    "Bash(gh api *repos/mcthaydt/RukenApp/pulls/*/ccr/auto_merge*)",
    "Bash(gh api *repos/mcthaydt/RukenApp/pulls/*/merge*)"
  ]
}
```

- The `gh pr` forms are what `release` names. Cloud containers cannot use them (GraphQL is blocked: `gh api graphql` answers 403 with "use the REST API"), so the three `gh api` forms are the routes that work there: `POST .../pulls/{n}/ccr/ready_for_review`, `PUT` or `DELETE .../pulls/{n}/ccr/auto_merge`, and `PUT .../pulls/{n}/merge`. The leading `*` lets `-X PUT` or `--method POST` come before the path.
- The rule hook already checks every one of these routes (`checkPrFlowBash` and `checkMergeMethod` in `.claude/hooks/rules.mjs`), and GitHub's branch protection still holds the merge until the gate is green.
- **Not allowed, on purpose:** the GitHub MCP tools `merge_pull_request`, `update_pull_request` (its `draft` field) and `enable_pr_auto_merge`. The rule hook does not check them, so allowing them would skip the review check. Reported here, not fixed (Keep to the request).
- Lane 3 merges keep needing the owner's approval or a recorded standing permission (CLAUDE.md, Three different yeses). The allow rule changes who runs the command, not who decides.

## 4. Acceptance criteria

1. `.claude/settings.json` parses as JSON, and its diff adds only the `permissions.allow` list above (`git diff main -- .claude/settings.json`).
2. No other file changes except this spec, its audits and the implementer's live-state file (which is deleted before the audit).
3. `node .claude/hooks/rules.mjs` still refuses, with the new settings in place: `gh pr merge <n> --squash`, and `gh api -X PUT repos/mcthaydt/RukenApp/pulls/<n>/merge -f merge_method=squash` (fed to the hook as PreToolUse input; the hook's own tests, if any, pass).
4. After the merge, a fresh session in auto mode runs `gh api -X POST repos/mcthaydt/RukenApp/pulls/<n>/ccr/ready_for_review` on a pull request with a passing review on its head, and it is not refused by the classifier. The first real use is the check; the session that does it records the result in its report. If it is refused, the coordinator tells the owner plainly and the fallback stays: the owner runs the command.

## 5. Plan

| Unit | Waits on | Files | Output | Check |
|---|---|---|---|---|
| A. Allow rule | this spec merged | `.claude/settings.json` | the five rules | criteria 1 to 3 |

One unit, one pull request, lane 3: plan audit on this spec, then execution, then an implementation audit, then merge under the standing permission. Expected duration: under an hour of session time. No new dependency, tool, environment or spend.
