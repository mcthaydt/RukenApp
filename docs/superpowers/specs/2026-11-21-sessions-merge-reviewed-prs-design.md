# Sessions mark ready and merge reviewed pull requests

Date: 2026-11-21. Status: **spec, revised after plan audits 1 to 4 and passed by plan audit 5 (7133053); amended 2026-11-21 after implementation audit 1 (540936a FAIL, 1 red: section 3.7 and criteria 6 and 7 are new) and waiting on a plan re-audit of that amendment.** Lane 3 (it changes `.claude/settings.json`, `.claude/hooks/rules.mjs`, `.claude/hooks/rules.json` and what needs the owner).

Lines marked **Owner** are the owner's words. Lines marked **Call** are this spec's choices; the owner can overrule any of them.

## 0. The owner's direction

- **Owner, 2026-11-21 06:54 UTC:** "add a permission rule", after the auto-mode classifier refused `gh pr ready` and `gh pr merge` in every session, so the owner had to run the ready and merge for #256 by hand.
- **Standing permission** (`history.md`, 2026-11-20): "Merge PRs yourself once CI, reviews and audits pass, without asking the owner. Live Cloudflare and console switches still need the owner." This spec adds no new permission; it lets sessions act on that one, in `mcthaydt/RukenApp` only.

## 1. The outcome

A session in this repo, in auto mode, can mark one of this repo's pull requests ready, merge it with a merge commit, and take a queued auto-merge off again, without the classifier refusing and without the owner running a command. Nothing approved this way skips a check the rule hook makes today, and the hook closes four ways a merge could slip past it once the classifier no longer stands behind it:

- a lane 2 or 3 pull request is refused without a passing review that names its head commit, and its lane comes from the files it changes as well as from its body;
- the live-state file must be gone, and any method but a merge commit is refused;
- these tools aimed at any other repository are refused, as is changing a pull request's base;
- if the hook cannot run its checks for one of these tools, the call is blocked.

Turning auto-merge on stays with the classifier and the owner, as today.

## 2. Why an allow rule works

- https://code.claude.com/docs/en/permission-modes (auto mode): "Actions matching your allow, ask, or deny rules resolve immediately"; only what matches no rule goes to the classifier. The listed exceptions are protected-path writes, critical-path `rm`, MCP tools that need user interaction, commands with per-command allowed domains, and ask rules on command content.
- On entering auto mode only broad rules are dropped (`Bash(*)`, wildcard interpreters, package-manager run commands, `Agent`, `Monitor`); "narrow Bash and PowerShell allow rules such as `Bash(npm test)` stay in effect" (https://code.claude.com/docs/en/auto-mode-config). Project `permissions.allow` is read from `.claude/settings.json`; the separate `autoMode` block is not read from project settings, so this spec does not use it.
- A PreToolUse hook answering `"deny"` prevents the tool call (hooks docs, output table; plan audit 2), so an allow rule does not skip the rule hook.
- `onFailure: "block"` on a hook entry blocks the call when the hook cannot start, exits with a code other than 0 or 2, times out or prints invalid output (https://code.claude.com/docs/en/hooks, "Block the action when a hook fails", from v2.1.295; this container runs 2.1.330). Exit 0 with a `systemMessage` is not a failure (plan audit 2, R1).

## 3. The change

### 3.1 The allow list (**Call**)

Exact GitHub MCP tool names only, and no Bash rule:

```json
"permissions": {
  "allow": [
    "mcp__github__merge_pull_request",
    "mcp__github__disable_pr_auto_merge",
    "mcp__github__update_pull_request"
  ]
}
```

- **No Bash rules** (plan audit 1, R1 to R3): a `*` in a Bash rule matches any text, spaces included, so a rule naming the merge address also approves any `gh api` call that carries that address in a header or field; a query string (`.../merge?x=1`) slips past the hook's `$`-anchored route match; `gh pr ... -R other/repo` reaches repos the hook does not judge. MCP tool inputs are structured (owner, repo, number, method), so nothing can ride along.
- **No `enable_pr_auto_merge`** (plan audit 2, R2): GitHub keeps auto-merge on when someone with write access pushes, so after a session queues a merge, its next push (a CI fix, say) would merge unreviewed once the required checks pass. The hook checks the review only when auto-merge is turned on. Left to the classifier and the owner as today; `release`'s "queue the merge with `--auto`" step keeps working where the classifier allows it and otherwise the session merges directly once green.
- **`disable_pr_auto_merge`** only takes a queued merge off, which `release` asks for when `main` moves first. It cannot merge anything.

What the hook checks (`checkMcp`, `.claude/hooks/rules.mjs`, configured by `rules.json` `mcp.*`):

| Tool | Hook checks |
|---|---|
| `merge_pull_request` | this repo only (3.2); method is `merge`; `expectedHeadSha` is the head the hook checked (3.6); live state gone; passing review on the head when the lane is 2 or 3 (3.4). Required checks green is GitHub's job: `main`'s branch protection requires `gate` and `commit-authors` with admins enforced (the hook's `mergeGreen.statuses` is empty) |
| `update_pull_request` with `draft` present and not `true` | this repo only; live state; review (3.4) |
| `update_pull_request` with `base` | refused on this repo (3.3); on other repos, refused by 3.2 only when it also has `draft: false` |
| `disable_pr_auto_merge` | this repo only |

**Accepted reach, said plainly:** `update_pull_request` is one tool, so the rule also approves its other fields on pull requests the session can reach: title, body, reviewers, `maintainer_can_modify` and `state` (close or reopen). Sessions already edit bodies with it (the footer fix in `release`'s quirks), and the hook keeps checking bodies (`prBody`). A close is undone by a reopen. A body edit can no longer lower a lane enough to skip a review (3.4). None of these merges anything.

### 3.2 Only this repo (plan audit 1, R3)

In `checkMcp`, before any network call, the hook refuses `merge_pull_request`, `disable_pr_auto_merge`, and `update_pull_request` with `draft: false`, when the target `owner/repo` is not this repo's `rules.json` `repo` (compared without case), with the reason "This permission covers mcthaydt/RukenApp only; the owner merges pull requests elsewhere." `update_pull_request` without `draft: false` on other repos is not refused, so the footer fix keeps working there.

### 3.3 No base changes (plan audit 2, R3)

A passing review names the head commit, and a base change keeps the head, so the review would still count while the diff that merges is different work. In `checkMcp`, `update_pull_request` with a `base` field on this repo is refused: "A pull request's base is changed by the owner: a review covers the diff against its base." Nothing in `release` changes a base.

### 3.4 The lane comes from the files too (plan audit 2, R4)

Today `checkReviewed` takes the lane only from the body (`laneOf(pr.body)`), and the allowed `update_pull_request` can rewrite the body. CLAUDE.md, Risk: "Classify it from the paths its diff touches … The highest lane wins."

- `rules.json` gains `prFlow.lanePaths`: `{ "2": [...], "3": [...] }`, globs in the hook's existing `matchesAny` form, copied from CLAUDE.md's Risk lists:
  - **3:** `tests/golden/**`, `prisma/migrations/**`, `cloudflare/**`, `.github/**`, `src/features/money/**`, `src/features/membership/**`, `CLAUDE.md` (the root one: `**/CLAUDE.md` compiles to `^.*/CLAUDE\.md$` and needs a `/`), `**/CLAUDE.md`, and `.claude/**` (settings, hooks, `after-compaction.md`, the shared skills).
  - **Not lane 3 by path:** `prFlow.lanePathsExcept.3`: `.claude/skills/verify/**` and `.claude/skills/this-repo/**`. A file matching one of these is not counted as lane 3 by its path (it still counts for lane 2 if a lane 2 glob matches, which none does); a repo's own skills take the lane of the change they describe, so the body's lane and the other files decide. `matchesAny` has no negation, so the exception is its own list (plan audit 3, N2); both lists fail safe.
  - **2:** `src/lib/**`, `src/hooks.server.ts`, `src/app.html`, `prisma/schema/**`, `package.json`, `pnpm-lock.yaml`, `vite.config.ts`, `playwright.config.ts`, `wrangler.jsonc`, `tests/support/**`, `tests/fixtures/**`.
- `checkReviewed` reads every page of `repos/<repo>/pulls/<n>/files` (100 per page, with the same timeout its other reads use). The lane is the highest of the body's lane and every changed file's lane (`filename`, and `previous_filename` for a rename). If the read fails, or the count read differs from the pull request's `changed_files` (GitHub stops at 3000 files), the lane is 3. A very long list can take past the hook's 30 s timeout; with `onFailure: "block"` that is a refusal, which also fails safe.
- The lists live in `rules.json`, beside a key `"lanePathsSource": "CLAUDE.md, Risk"` (JSON takes no comments). CLAUDE.md stays the rule; a later rule change edits both, and criterion 2 h fails `pnpm test` when they differ (plan audit 3, R2). Lane 3 rule paths in CLAUDE.md that are not file paths (credentials, real data, device actions) stay with the body and the reviewer.

This applies to every route `checkReviewed` guards (`gh pr ready`, `gh pr merge`, the REST routes and the MCP tools), so all of them get stricter, none looser.

### 3.5 The hook never passes these tools unchecked (plan audit 1, N1; plan audit 2, R1)

- **A second `PreToolUse` entry** in `.claude/settings.json`, matcher `^mcp__github__(merge_pull_request|disable_pr_auto_merge|update_pull_request)$`, running the same command with `"onFailure": "block"`. The first entry stays as it is, so every other tool keeps today's non-blocking behaviour.
- **Every "did not run" path exits non-zero on these tools.** In `main()`, on PreToolUse: when the input does not parse (the tool name is then unknown), exit 1; when the tool name matches the second entry's matcher and no root is found or `loadConfig` returns an error, exit 1 with the reason on stderr; and when the hook throws after the tool name is known and it matches, exit 1. Exit with `process.exit(1)`, or remove today's trailing `process.exitCode = 0`, which would otherwise turn a set `exitCode` back to 0 (plan audit 3, N1). Every other case keeps today's exit 0 with its `systemMessage`. With the second entry's `onFailure: "block"`, each of these blocks the call. (The first entry also runs and fails the same way; without `onFailure` that is only a notice.)
- The implementer reads https://code.claude.com/docs/en/hooks before writing this and uses `onFailure` exactly as documented; if it does not behave as described, stop and report, and do not ship 3.1 without it.

### 3.6 The merge lands only on the head that was checked (plan audit 3, R1)

The hook reads the head, finds a PASS on it, and allows; a push in the seconds before the merge call lands would merge a head no review named. `merge_pull_request` takes `expectedHeadSha` (GitHub's merge `sha`, which answers 409 when the head moved). On this repo the hook refuses a `merge_pull_request` whose `expectedHeadSha` is missing or is not the full `pr.head.sha` the hook read: "Pass expectedHeadSha: the full head commit the review names." This holds on every lane, since it costs nothing and lane 1's green checks are tied to a head too.

### 3.7 Cloud sessions read user settings, so the setup script writes them too (implementation audit 1, R1)

Cloud sessions for this project start in `/home/user` with `CLAUDE_CODE_IGNORE_PERSISTED_TRUST=1`. They never load the repo's `.claude/settings.json`: Claude Code prints "Ignoring 3 permissions.allow entries from .claude/settings.json … Put them in user or managed settings instead." The hooks that do run there come from `~/.claude/settings.json`, written by the cloud setup script (`node .claude/hooks/rules.mjs --print-setup`, installer `INSTALL_JS`), and that entry has no `onFailure`. So 3.1 and 3.5 as built only work in a trusted checkout; in a cloud session the classifier would still refuse. The repo entries stay (a trusted local session uses them). The installer also writes, into `~/.claude/settings.json`:

- **The allow list.** `permissions.allow` gains the three names of 3.1, added only if missing; every other entry, allow or not, stays. Nothing else is added to `permissions`.
- **The blocking hook entry.** One `PreToolUse` entry, matcher the 3.5 regex, one command hook with `"onFailure": "block"`, `timeout` 30, whose command is the launcher's loop (`for f in "$CLAUDE_PROJECT_DIR"/*/.claude/hooks/rules.mjs; do [ -f "$f" ] && exec node "$f" --find-repo; done`) followed by `exit 1`, not `true`: if no repo hook is found, the call is blocked. The installer recognises its own entries by that command and the matcher, replaces them on a re-run, and leaves the user's own hooks alone, as it does for the launcher entries today.
- **No early return for these tools.** Today `--find-repo` returns without checking when `$CLAUDE_PROJECT_DIR` has its own `rules.mjs` ("the repo's own settings run it"). With trust off those repo settings do not run, so for the three tools in 3.5 that return is skipped and the hook judges the call. Running a check twice is harmless.
- **Quiet failure stays quiet.** As today, an unreadable, non-JSON or oddly shaped `~/.claude/settings.json` changes nothing and the script still exits 0 (`--install-user` exits 1).

**Owner step (named, outside the repo):** the cloud environment's setup script has to be replaced with the new output of `node .claude/hooks/rules.mjs --print-setup` (the coordinator can do it with the environment update tool once this merges, or the owner runs `node .claude/hooks/rules.mjs --print-setup` and pastes it in the environment's setup script). It runs when a container starts, so only sessions started afterwards get it. Recorded under "Standing permissions" in `history.md` with that scope.

## 4. Acceptance criteria

1. `.claude/settings.json` parses as JSON; `permissions.allow` is exactly the three names in 3.1, with no `Bash(` entry and no `enable_pr_auto_merge`; `hooks.PreToolUse` holds today's entry unchanged plus one entry whose matcher is the 3.5 regex and whose hook has `"onFailure": "block"`. Nothing else in the file changes.
2. A committed Vitest test, `tests/rules-merge-permission.test.ts`, run by `pnpm test` with no network, runs `node .claude/hooks/rules.mjs` against a scratch copy of `.claude/` with a stub `gh` on `PATH` that serves a pull request 999 (head `abc1234`, no reviews or comments) whose body and file list each case sets, and checks the answer and exit code:
   a. **Other repo (3.2):** `merge_pull_request`, `disable_pr_auto_merge`, and `update_pull_request` with `draft: false`, on `mcthaydt/RukenPrivate`: deny with the 3.2 reason. `update_pull_request` with only a body on RukenPrivate: no 3.2 deny.
   b. **Method:** `merge_pull_request` with `merge_method: "squash"` on RukenApp: deny (merge method).
   c. **Base (3.3):** `update_pull_request` with `base: "some-branch"` on RukenApp: deny with the 3.3 reason.
   d. **Lane from files (3.4):** body says "Lane 1", files `[".claude/settings.json"]`: `merge_pull_request` and `update_pull_request` `draft: false` are denied for no passing review on `abc1234`. Body "Lane 1", files `["docs/x.md"]`: no review deny. Body "Lane 1", files `["CLAUDE.md"]`: review deny. Body "Lane 1", files `["src/lib/a.ts"]`: review deny. Body "Lane 1", the files read fails (stub exits 1): review deny. The same lane-1 body with files `[".claude/skills/this-repo/SKILL.md"]`: no review deny.
   e. **Review still holds:** body "Lane 3", files `["docs/x.md"]`, no PASS: deny; then the stub adds a comment "abc1234 PASS": no review deny.
   f. **Fail closed (3.5):** with `rules.json` holding `{ broken`, with `rules.json` removed, and with input `not json`, a `merge_pull_request` PreToolUse exits non-zero. With `rules.json` broken, a `Read` PreToolUse still exits 0.
   g. **Settings:** criterion 1, checked by reading the file.
   h. **Lane lists match CLAUDE.md (3.4):** read `CLAUDE.md`, take every backticked path in the "**Lane 2**" and "**Lane 3**" bullets under `## Risk` (a trailing `/` read as `/**`), and assert each is matched by that lane's `lanePaths`; and assert every `lanePaths` entry is either one of those paths or in a short named list in the test (`CLAUDE.md`, `**/CLAUDE.md`, `.claude/**`). Two backticked tokens in those bullets are not paths: `release` (Lane 2: "after `release`'s extra checks") and `.md` (Lane 3: "even though they are `.md` files"). The test names exactly these two as skipped, and fails on any other backticked token no glob of its lane matches, so a new non-path word is a decision, not a silent skip. No filter on `/` (it would drop `package.json` and the other root files). The test passes on today's CLAUDE.md with no change at build time (plan audit 4, R1). Then edit a copy of CLAUDE.md to add a lane 2 path and show the check fails on it (once, in the test, against the copy).
   i. **Head pinned (3.6):** lane 3 body, files `["docs/x.md"]`, a PASS on `abc1234`, stub head `abc1234` followed by 33 more hex digits: `merge_pull_request` with no `expectedHeadSha`: deny; with another commit's SHA: deny; with the stub's full head: no deny.
   j. **Draft field:** `update_pull_request` with `draft: false` on RukenPrivate is denied by 3.2; with only `title`, not.
3. A recorded run in the implementation pull request's body (commands and answers, at its head commit, against the real GitHub): on an open lane 3 pull request with no PASS on its head, `merge_pull_request` (method `merge`) and `update_pull_request` `draft: false` are each denied for "no passing review that names its head"; and a check that `onFailure: "block"` really blocks: with the second entry pointing at a command that exits 1 (in a scratch copy of the repo, not committed), a `disable_pr_auto_merge` call is blocked.
4. No file changes outside `.claude/settings.json`, `.claude/hooks/rules.mjs`, `.claude/hooks/rules.json`, the new test, this spec, its audits and the implementer's live-state file (deleted before the implementation audit). `pnpm lint`, `pnpm typecheck` and `pnpm test` pass, and `node .claude/hooks/rules.mjs --check` reports the config valid.
5. After the merge, the first session that marks a reviewed pull request ready or merges it with these tools reports whether the classifier stayed out. If it refused, the coordinator tells the owner plainly, and the fallback stays: the owner runs the command.
6. **The installer (3.7).** A Vitest test in `tests/rules-merge-permission.test.ts` runs the `--print-setup` script (and `--install-user`) with `HOME` set to a scratch folder and checks: from no file it writes exactly the three allow names and the blocking entry (matcher, `onFailure: "block"`, command ending `exit 1`); run twice it changes nothing the second time; a file with the user's own allow entries and hooks keeps them; a file that is not JSON is left byte for byte and the script exits 0 (`--install-user` exits 1). With a scratch repo that has `rules.mjs` and no `rules.json`, the written command run as a shell command exits 1 for a `merge_pull_request` call, and with the scratch folder holding no repo at all it also exits 1. With `CLAUDE_PROJECT_DIR` holding its own `rules.mjs`, `--find-repo` still judges a `merge_pull_request` call (a deny comes back) and still returns quietly for a `Bash` call.
7. **A cloud-shaped run, recorded in the pull request body:** with `HOME` set to a scratch folder holding the installer's output, `CLAUDE_CODE_IGNORE_PERSISTED_TRUST=1`, and a scratch folder one level above the repo as the working directory, a nested `claude -p` session with a stand-in `github` MCP server (the implementation audit's method) (a) is not asked or refused for `disable_pr_auto_merge` (the allow entry is read), and (b) with the scratch repo's `rules.json` broken is blocked by the user-level entry. If a nested `claude -p` cannot be started here, the implementer says so and the implementation audit runs it.

## 5. Plan

| Unit | Waits on | Files | Output | Check |
|---|---|---|---|---|
| A. Allow list and hook | this spec merged | `.claude/settings.json`, `.claude/hooks/rules.mjs`, `.claude/hooks/rules.json`, `tests/rules-merge-permission.test.ts` | 3.1 to 3.7 (3.1 to 3.6 built at 540936a; 3.7 is the rebuild after the plan re-audit) | criteria 1 to 4, 6 and 7 |

One unit, one pull request, lane 3: plan audit on this spec, then execution, then an implementation audit, then merge under the standing permission. Expected duration: about two hours of session time. No new dependency, tool, environment or spend.

Not in scope (reported, not fixed): opening a pull request with `gh api repos/<o>/<r>/pulls` (POST) skips the open-PR limit, the draft rule and the lane check, which is how #258 opened while three others were open (implementation audit 1, N1; a follow-up for its own pull request); `liveFileOnBranch` fails open on a non-404 `gh` error (audit 1 N2, audit 2 N6); the `gh api` route match skips query strings and trailing `/` (audit 1, R2), which matters only once something approves those commands without the classifier, which this spec no longer does; a verdict line can be posted by any session (audit 2, N4); a local edit of `rules.json` turns checks off for that session (audit 2, N5).
