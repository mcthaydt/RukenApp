# Implementation audit: sessions merge in RukenPrivate (#408, RukenPrivate #27 and #28), cycle 3

- Pull requests, audited as one change:
  - mcthaydt/RukenApp #408 at `1435ba6dc0b33cc192da77f0383b9da3d4f5a0cc`
  - mcthaydt/RukenPrivate #27 at `eea35dfb1a71f91e5e34837d2e6b027b20eaf621` (the hook copy, and RukenPrivate's `rules.json` naming itself in `alsoMerges`)
  - mcthaydt/RukenPrivate #28 at `1ec51bd1aee460ddd3ae3a0f7016a463d1d9992b` (the `check` job runs on every pull request)
- Lane: 3 (`.claude/**`, the rules that decide what needs the owner; `.github/` for #28)
- Reviewer: fresh session, Opus 5.5, medium, read-only (this file is its only change)
- Brief: the owner's 2026-11-27 02:40 UTC message "I'm not going to keep doing the merging", the acceptance criteria in the three bodies (R1 to R6, P1 to P3, W1 to W3), the progress.md record #408 adds, and cycle 2's two reds (audit `52beb21`).
- Written: 2026-11-27 03:39 UTC (`date -u`)

**Verdict: PASS, 0 red, 4 notes.** Cycle 2's two reds are fixed: no shell route to a RukenPrivate merge gets past the hook from any working folder, and RukenPrivate's own copy of the hook now holds its merges to a PASS and a green `check`. Nothing outside RukenPrivate merges is loosened.

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## How it was checked

Two trees were built from git worktrees, each holding `RukenApp/` and `RukenPrivate/` side by side like `/home/user`:

- **head**: RukenApp `1435ba6`, RukenPrivate `eea35df`.
- **base**: RukenApp `main` `5852e02`, RukenPrivate `main` `4aa7d24`, to tell new behaviour from old.

The real hook ran with PreToolUse payloads in two ways:

- **launcher**: the cloud commands from `/root/.claude/settings.json`, copied word for word, with `CLAUDE_PROJECT_DIR` set to the tree's top folder: the blocking one for `merge_pull_request|disable_pr_auto_merge|update_pull_request` and the general one for everything else. Both pick `RukenApp/.claude/hooks/rules.mjs --find-repo`, as in this container.
- **repo-own**: RukenPrivate's own `.claude/settings.json` command, `CLAUDE_PROJECT_DIR` = the RukenPrivate folder, so its own copy of the hook runs.

Working folders: the top folder, `RukenApp/`, `RukenPrivate/`, `RukenPrivate/worker/` and `/tmp`. Commands that `cd` elsewhere were run too.

Two kinds of data:

- **live**: real `gh api` reads of RukenPrivate #27 (draft, no verdict, no `check` run on its head) and RukenApp #408.
- **stub**: a `gh` stub earlier in `PATH` that answers every `gh api` read from a fixture, so the review and green rules can be tested one at a time on a non-draft RukenPrivate #27. The fixture's pull request has a "Lane 1" body, one changed file (`README.md`), and a chosen verdict comment and `check` run.

## What passed

### The merge tools on RukenPrivate (R1, R5; P2)

Stub data. Every row is the same from the top folder, `RukenApp/` and `RukenPrivate/` under the launcher, and from `RukenPrivate/` and `RukenPrivate/worker/` under RukenPrivate's own hook.

| Fixture | `merge_pull_request` (merge, full SHA) | `enable_pr_auto_merge` | `update_pull_request` draft false |
|---|---|---|---|
| Lane 1 body, no PASS, `check` success | DENY | DENY | DENY |
| `eea35df PASS` by mcthaydt, no `check` run | DENY | DENY | ALLOW |
| PASS, `check` success | **ALLOW** | DENY | ALLOW |
| PASS, `check` failure | DENY | DENY | ALLOW |
| PASS, `check` in progress | DENY | DENY | ALLOW |
| PASS, older success and newer failure | DENY | DENY | ALLOW |
| PASS, run named `build`, not `check` | DENY | DENY | ALLOW |
| PASS from another account, `check` success | DENY | DENY | DENY |

At base, all 24 cells are ALLOW from the top folder and from `RukenPrivate/`, under both launchers. That is cycle 1 and cycle 2's finding, now closed. Marking ready needs a PASS but not a green check, as in RukenApp.

Also on live data, from every folder: squash is refused, a merge with no `expectedHeadSha` is refused, a lowercase slug (`mcthaydt/rukenprivate`) is refused like the real one, and a base change is refused.

### Shell routes (R6; P2)

Stub data with PASS and `check` failing, so a route that gets through the hook would merge red. The columns are:

1. `gh pr merge 27 -R mcthaydt/RukenPrivate --merge`
2. `GH_REPO=mcthaydt/RukenPrivate gh pr merge 27 --merge`
3. `gh pr merge 27 --merge`
4. `gh pr ready 27`
5. `gh api -X PUT repos/mcthaydt/RukenPrivate/pulls/27/merge`
6. `gh api -X PUT repos/{owner}/{repo}/pulls/27/merge`
7. `cd RukenPrivate && gh pr merge 27 --merge`

| Tree, launcher, folder | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|---|---|---|---|---|---|---|---|
| base, launcher, any of the three | A | A | A | A | A | A | A |
| base, repo-own, `RukenPrivate/` | A | A | A | A | A | A | A |
| head, launcher, top folder | D | D | a | a | D | a | D |
| head, launcher, `RukenApp/` | D | D | a | a | D | a | D |
| head, launcher, `RukenPrivate/` | D | D | D | D | D | D | D |
| head, repo-own, `RukenPrivate/` | D | D | D | D | D | D | D |

A lowercase "a" means correctly allowed: the command names no repo, so `gh` acts on the folder's own repo. That is RukenApp, or nothing in the top folder, and never RukenPrivate.

Live data, every folder, head: these are refused too.

- `gh pr merge … --repo=…`
- `env GH_REPO=… gh pr merge`
- `gh pr merge https://github.com/mcthaydt/RukenPrivate/pull/27`
- `gh pr merge --auto`
- `gh -R … pr ready`
- `gh api --method PUT /repos/…/merge` and `-XPUT`
- `gh api` with no method but `-f` fields (a POST)
- `…/merge?x=1` and `…/merge/`
- an upper-case slug
- GraphQL `mergePullRequest`, `enablePullRequestAutoMerge` and `markPullRequestReadyForReview`
- `cd /tmp && gh pr merge 27 -R mcthaydt/RukenPrivate --merge`, `cd / && GH_REPO=… gh pr merge` and `cd /tmp && gh api -X PUT …/merge`, started from the top folder or `RukenApp/`

At base, the three `cd` lines and the GraphQL mutations were allowed from the top folder. `gh pr merge 27 -R … --disable-auto`, `gh pr view` and `ls` stay allowed.

### Other repos are not loosened (R2, R3; P3)

- 144 shell cases (the merge routes above, plus `ls`, `git status`, `gh pr create/edit/close/comment`, `git push` to main, force push, `gh api` DELETE of a branch, and RukenApp and `mcthaydt/Other` merges) were run in all four folders against base and head on live data. Diffing the decisions, the only changes are ALLOW to DENY (the GraphQL mutations from the top folder). No case went from DENY to ALLOW.
- MCP calls on `mcthaydt/Other` (merge, ready, `disable_pr_auto_merge`) are refused at head from every folder with "This permission covers … only". From the top folder, base failed closed with "no repo with rules.json" (exit 1, blocked) and head refuses with the message. `disable_pr_auto_merge` on RukenPrivate is newly allowed, as R1 intends.
- `push_files` and `create_or_update_file` to `main` stay refused (identity) in both repos.
- In the cloud top folder, the hook now judges a call that names no repo under RukenApp's config, as a detached call (`main()`, the `mine` fallback). That only adds checks: none of the 144 cases was loosened.

### The copy and the rest (P1, P3, R3, R4)

- `rules.mjs`: sha256 `23343bcd…09b1b7` at RukenApp `1435ba6` and at RukenPrivate `eea35df`, so the copy is byte-identical. Both mains share an older sha256 (`2b8df8bf…`). `pr-rules-lib.mjs` is identical too.
- #27 changes only `rules.mjs` and one line of `rules.json` (`"alsoMerges": [{ "repo": "mcthaydt/RukenPrivate", "checkRuns": ["check"] }]`), which is the same line #408 adds to RukenApp's `rules.json`.
- `pnpm exec vitest run tests/rules-merge-permission.test.ts tests/rules-pr-routes.test.ts tests/pr-rules.test.ts`: 3 files, 105 tests passed.
- `pnpm test`: 155 files, 2254 tests passed.
- `pnpm lint` (ESLint and Prettier): clean.
- The diff against `main` touches `.claude/hooks/rules.json`, `.claude/hooks/rules.mjs`, `docs/superpowers/progress.md` and `tests/rules-merge-permission.test.ts` only.

### RukenPrivate #28 (W1 to W3)

- Diff: one line removed from the workflow (the `pull_request` `paths` filter) and the top comment reworded. Nothing else changes (W3).
- The deploy job is unchanged:
  - `push` keeps `branches: [main]` and its `paths` filter.
  - The deploy keeps `if: github.event_name == 'push' && github.ref == 'refs/heads/main' && needs.check.outputs.worker == 'true'`.
  - So a pull request never deploys, and a push to main that touches no `worker/**` and not the workflow runs nothing (W2).
- The token is still given to the deploy step only, `permissions: contents: read` is unchanged, and the concurrency groups are unchanged.
- The runner sees one more kind of job: the `check` job on pull requests that touch no Worker file. The job runs no secrets and checks out with `persist-credentials: false`. RukenPrivate is private, so only collaborators open pull requests there.
- On #28's own head, `check` completed with success and `deploy ruken-private` was skipped (run 45934020073).
- W1 itself (a non-Worker pull request gets a green `check`) can only be shown after #28 merges, on #27, as its body says.
- The job name `check` matches the `checkRuns` name the hook reads.

## Notes (not blocking, recorded here)

- **N1, an unchecked route, pre-existing, for the owner.** The hook allows these from every folder, at base and at head:
  - `gh api -X POST repos/mcthaydt/RukenPrivate/merges` (merge a branch into `main` with no pull request)
  - `gh api -X PATCH repos/mcthaydt/RukenPrivate/git/refs/heads/main`
  - `gh api -X PUT repos/mcthaydt/RukenPrivate/contents/<path>` with `branch=main`

  The same calls on RukenApp are allowed too, but GitHub's branch protection there (`gate`, `commit-authors`, enforce admins on) stops them on the server. RukenPrivate's plan has no branch protection (the API answers 403 "Upgrade to GitHub Pro"), so on RukenPrivate they would land code on `main` with no PASS and no `check`. This change does not widen it: it was open before and no session needs it. By CLAUDE.md, Hooks, it is reported to the owner and not used until a hook covers it. A fix would refuse these `gh api` paths on the default branch, in `checkShellMerges` or `checkPrRoutes`, as a lane 3 hooks change.
- **N2, R1's wording.** R1 says a `disable_pr_auto_merge` call passes "only with a merge commit, the full head SHA and a passing review". The hook allows `disable_pr_auto_merge` on RukenPrivate with no PASS, from every folder, as it does for RukenApp. That is harmless, since turning auto-merge off lands nothing, and R2's scope refusal holds. Only the criterion's wording over-claims.
- **N3, #28's body.** The body says the job "skips its steps when there is no Worker". `worker/` is already on RukenPrivate `main` (#26), so every pull request now runs the full install, typecheck and test on the RunPod runner, a few minutes each. Also, merging #28 itself touches the workflow file, so its push to `main` runs the deploy once, putting the same Worker code live again. Both are expected and fine. They are noted so nobody is surprised.
- **N4, the order of the merges.** Until #27 merges, a session whose own folder is RukenPrivate, run by RukenPrivate's own hook (not the cloud launcher), still has the old copy. That copy allows every merge route there (the base rows above). The planned order (#408, #28, main into #27, then #27) keeps that window short. Nobody should merge in RukenPrivate from such a session before #27 lands.

## Follow-ups

- N1 goes to the retrospective's list of hook fixes, and to the owner as an unchecked route.
