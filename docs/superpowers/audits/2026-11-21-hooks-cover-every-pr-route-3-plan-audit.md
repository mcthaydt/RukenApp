# Plan audit 3: hooks cover every pull request route

Spec: `docs/superpowers/specs/2026-11-21-hooks-cover-every-pr-route-design.md` at **30ed0ef** (branch `claude/project-thread-j2umsk`). Read with it: plan audits 1 and 2, `.claude/hooks/rules.mjs`, `.claude/hooks/rules.json`, `.claude/settings.json`, `.github/workflows/ci.yml`, `.github/workflows/commit-authors.yml`, `tests/rules-merge-permission.test.ts`, CLAUDE.md, the `release` skill, and `main`'s live branch protection. Lane 3, plan audit, Opus 5.5 medium. Graphify was not needed: the spec changes workflows, a hook and a new script, all read directly.

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## Verdict

**30ed0ef FAIL: 7 red, 7 notes.**

Moving the guard to GitHub is the right turn: it answers every route plan audits 1 and 2 listed, because each of them ends in a pull request event. The two owner decisions (exact proxy footer, docs count) are carried through 3.1, 3.2, 3.3 and 3.5 consistently. But the new guard has holes of its own. Two of its three triggers do not do what the spec needs: a `pull_request_review` run uses the pull request's own copy of the workflow, and an `issue_comment` run reports on `main`'s commit, not the pull request's. PR-R cannot meet its own criterion 19. The guard's code lands under `scripts/`, which is not lane 3. Sessions hold admin on the repo, so the spec's premise that only the owner can change branch protection is false, and nothing guards those writes. Criterion 6 does not check the one `pull_request_target` mistake that would run pull request text with a write token. And section 5 does not name the one bypass no check can see: a session posting its own PASS.

## How I checked

- Read the spec end to end against both earlier audits; each of their 17 red findings now reduces to "a pull request event happens", which 3.1 judges.
- `gh api repos/mcthaydt/RukenApp/branches/main/protection` at 2026-11-21T14:58Z, from this session's token: it **succeeded** and shows required checks `gate` and `commit-authors` (both `app_id` 15368, GitHub Actions), `strict: false`, `enforce_admins: true`, no required reviews, no rulesets (`gh api .../rulesets` returned `[]`). Reading branch protection needs admin on the repo.
- `gh api 'repos/mcthaydt/RukenApp/pulls?state=all&per_page=5'`: every recent pull request (#266 to #270) is opened by `mcthaydt`. Sessions act as the owner's account.
- GitHub's "Events that trigger workflows" page (docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows), read 2026-11-21: `pull_request_target`: GITHUB_SHA "Last commit on default branch", runs "in the context of the default branch of the base repository". `pull_request_review`: GITHUB_SHA "Last merge commit on the GITHUB_REF branch", GITHUB_REF "refs/pull/PULL_REQUEST_NUMBER/merge". `issue_comment`: GITHUB_SHA "Last commit on default branch", and it "will only trigger a workflow run if the workflow file exists on the default branch". The same rule holds for `pull_request_target`.
- `grep` of `rules.mjs` for `protection|rulesets|workflow disable`: no match. `rules.json` `lanePaths` has no `scripts/` entry; `ruleMix.docPaths` includes `.claude/**`.
- Nothing was pushed to GitHub to test a workflow: that would be a lane 3 change outside this audit. Findings R1 and R2 rest on the documented event contexts above, and the fix for each names the measurement the builder runs.

## Red findings

### R1. A `pull_request_review` run uses the pull request's own workflow, so the pull request can make `pr-rules` pass

- UNIT: spec 3.1 (triggers), section 2 ("where no tool or shell trick reaches"), section 5.
- VERDICT: red.
- REQUIREMENT: section 2, the guard holds whatever route made the pull request; the coordinator's brief (never run pull request code with write rights).
- REASON: `pull_request_review` runs the workflow as it stands on the pull request's merge commit, not on `main`, so a branch that edits `.github/workflows/pr-rules.yml` (to `exit 0`) and then gets any review submitted produces a passing check named `pr-rules` on its head. The same class: any workflow on the branch with `on: pull_request` and a job named `pr-rules` publishes a check of that name from the same app (15368) the requirement is pinned to. `commit-authors` (on `pull_request`) already has this weakness today.
- EVIDENCE: the GitHub events page, `pull_request_review` row (GITHUB_SHA = merge commit, GITHUB_REF = `refs/pull/N/merge`), against `pull_request_target`'s "context of the default branch". Branch protection pins checks by name and app only (`"checks":[{"context":"gate","app_id":15368},…]`).
- EXPECTED: every run that decides `pr-rules` uses `main`'s workflow and script, and the spec names what a branch that edits workflows can still forge.
- FIX: in 3.1, drop the `pull_request_review` trigger; pick up review verdicts with a `workflow_run` (runs from the default branch) on a tiny review-listener workflow, or have reviewers post their verdict as a comment only (the `review` skill already allows a comment). Add a rule 5 to 3.1: a pull request that changes `.github/workflows/**` fails `pr-rules` unless its body names lane 3 (it already is lane 3, so the owner sees it). Add to section 5 that a branch which adds a workflow can publish a check of any name, and that the lane 3 owner approval and 3.7 are the guard there. Add a criterion: `pr-rules.yml` has no `pull_request_review` or `pull_request` trigger (grep). Files: the spec only.

### R2. An `issue_comment` run reports on `main`'s commit, so a verdict comment never turns the pull request's check green

- UNIT: spec 3.1 (triggers, rule 4), criterion 5.
- VERDICT: red.
- REQUIREMENT: 3.1 rule 4 (a lane 2 or 3 ready pull request passes once "<head> PASS" is posted); the `review` skill (verdicts are comments).
- REASON: a workflow run started by `issue_comment` has GITHUB_SHA = the last commit on `main`, so the `pr-rules` job's check is attached to `main`'s commit, not the pull request's head. The pull request keeps its last `pull_request_target` result (a fail) after the PASS lands. The only ways to clear it are an empty edit or push, which teaches sessions to poke the pull request, the habit 3.7 forbids.
- EVIDENCE: the GitHub events page, `issue_comment` row: GITHUB_SHA "Last commit on default branch". The spec's criterion 5 is written against the script's exit code, so it would pass while the real check on the pull request stays red.
- EXPECTED: whatever event starts it, the result lands on the pull request's head commit under the required name.
- FIX: in 3.1, the script publishes its answer itself as a commit status (or check run) named `pr-rules` on `pull_request.head.sha`, through the API, and the job gets another name (`pr-rules-run`) so it never collides with the required one. Permissions in 3.1 and criterion 6 gain `statuses: write` (or `checks: write`). Add a criterion that the script's status call names the head sha it read for that pull request, and a PR-R criterion that a comment verdict on a scratch pull request flips the required context, measured with `gh api repos/…/commits/<head>/status`. Confirm in that measurement that a status written with `GITHUB_TOKEN` matches the required check's `app_id` 15368; if it does not, the owner step in 3.1 sets the requirement without an app pin. Files: the spec only.

### R3. PR-R cannot meet criterion 19: its own `pr-rules` run never happens

- UNIT: criterion 19, section 6 U4.
- VERDICT: red.
- REQUIREMENT: CLAUDE.md, "A change does not quietly edit its own check"; 3.7 (a criterion that can only be met by working around a check is the R7 pattern of plan audit 2).
- REASON: `pull_request_target` and `issue_comment` run only from a workflow file that exists on `main`. PR-R is the pull request that adds `pr-rules.yml`, so no `pr-rules` run exists for it. The builder would have to invent one (a temporary trigger, a hand-run script presented as the run) to tick the box.
- EVIDENCE: the events page, `issue_comment`: "will only trigger a workflow run if the workflow file exists on the default branch"; `pull_request_target` runs in "the context of the default branch".
- EXPECTED: PR-R's criteria are things PR-R can show; the first real `pr-rules` run is checked on the first pull request after PR-R merges.
- FIX: rewrite criterion 19 to cover only `commit-authors` for PR-R, and move "a real `pr-rules` run passes and one fails" to criterion 20, checked by the coordinator on the next pull request after merge (with R2's status check). Files: the spec only.

### R4. The guard's code lives in `scripts/`, which is not lane 3

- UNIT: spec 3.1 (shared library), section 5 (files), `rules.json` `prFlow.lanePaths`, CLAUDE.md Risk.
- VERDICT: red.
- REQUIREMENT: CLAUDE.md Risk, lane 3 covers "a change to the rules that decide what needs the owner, or to the hooks sessions run".
- REASON: after this change, `scripts/pr-rules-lib.mjs` decides the lane, the criteria and the verdict for both the hook and `pr-rules`, and `scripts/pr-rules.mjs` decides the open limit. Neither path is in `lanePaths` 3 (only `.claude/**`, `.github/**` and the others listed), so a lane 1 pull request can change what the guard enforces. The hook imports the library from the working tree, so a branch that edits it changes the hook for its own session at once.
- EVIDENCE: `rules.json` lines 69 to 92: no `scripts/` entry in lane 2 or 3. CLAUDE.md Risk's lane 3 list has no `scripts/` either.
- EXPECTED: both files are lane 3 in `rules.json` and in CLAUDE.md Risk, so `pr-rules` itself judges a change to them as lane 3.
- FIX: add `scripts/pr-rules.mjs` and `scripts/pr-rules-lib.mjs` (or move them under `.github/pr-rules/`, already lane 3) to `lanePaths` 3 in PR-H, and to CLAUDE.md Risk in PR-R; add a criterion that `pr-rules` judges a pull request touching either as lane 3. Files: the spec, then `rules.json` and CLAUDE.md in their pull requests.

### R5. Sessions hold admin; the spec says only the owner can change branch protection, and nothing guards those writes

- UNIT: spec 3.1 ("Only the owner's account can change branch protection"), 3.4 (allowlist), section 5, U5.
- VERDICT: red.
- REQUIREMENT: section 2 (the guard holds against every route); CLAUDE.md "Never bypass an access restriction"; 3.7.
- REASON: sessions act as `mcthaydt` with admin. One `gh api -X DELETE …/branches/main/protection/enforce_admins`, a PATCH of `required_status_checks` dropping `pr-rules`, `gh workflow disable pr-rules`, or a ruleset write removes the whole server-side guard, and neither the hook (3.4 does not list them) nor `pr-rules` (it cannot see settings) stops it. `enforce_admins: true` is the setting that makes API merges by this admin account wait for required checks at all, so it is the linchpin.
- EVIDENCE: this session's `GET …/branches/main/protection` succeeded (admin is needed to read it) and shows `enforce_admins: true`; recent pull requests are all `user.login = mcthaydt`; `grep -n 'protection\|rulesets\|workflow disable' .claude/hooks/rules.mjs` finds nothing.
- EXPECTED: the spec says sessions can change these settings, the hook refuses them, and section 5 names what remains.
- FIX: in 3.4, refuse any non-GET `gh api` on `branches/*/protection*`, `rulesets*`, `actions/workflows/*/(disable|enable)`, `actions/permissions*`, and a repository PATCH, plus `gh workflow disable|enable` and `gh ruleset` writes, and the same `mcp__github__*` tools if any reach them; add a criterion for each shape. Correct 3.1's sentence: the owner step is the owner's by rule (a product choice: what is required), not by access, and stays an owner command. Name in section 5 that a session using a route the hook cannot read could still change settings, guarded only by 3.7. Files: the spec only.

### R6. Criterion 6 does not check the `pull_request_target` mistake that runs pull request text with a write token

- UNIT: spec 3.1 (workflow), criterion 6.
- VERDICT: red.
- REQUIREMENT: the coordinator's brief (`pull_request_target` security: never run pull request content with secrets or write rights); section 2.
- REASON: checking out the base ref is only half of it. A `run:` step that interpolates `${{ github.event.pull_request.title }}`, `.body`, `.head.ref` or `github.event.comment.body` executes text anyone can write, with `pull-requests: write` and `issues: write`. On a public repo that includes forks: any GitHub user can open a pull request. Criterion 6 greps only for `pull_request.head` in the checkout.
- EVIDENCE: criterion 6's text; 3.1 lists the permissions but says nothing about how pull request text reaches the script. The events page warns: "Running untrusted code on the `pull_request_target` trigger may lead to security vulnerabilities."
- EXPECTED: the workflow passes only the number (and, after R2, nothing else) through `env:`; the script reads everything else through the API as data; checkout uses `persist-credentials: false` and a pinned action sha, as `ci.yml` does.
- FIX: extend criterion 6: no `${{ github.event.* }}` other than `…pull_request.number` / `…issue.number` anywhere in `pr-rules.yml`, no `run:` line with `${{`, `actions/checkout` pinned by sha with `persist-credentials: false` and `ref: main` (or the base sha), no `npm`/`pnpm install`, so the script has no dependencies. Files: the spec only.

### R7. Section 5 does not name the bypass no check sees: a session posting its own PASS

- UNIT: spec section 2, section 5 ("What still is not seen before a call"), 3.1 rule 4.
- VERDICT: red.
- REQUIREMENT: CLAUDE.md "Report honestly … Never round up"; section 2's claim that a pull request breaking a rule fails `pr-rules`.
- REASON: every session, builder and reviewer alike, comments as `mcthaydt`, so `pr-rules` (and the hook today) cannot tell a reviewer's "<head> PASS" from the builder's own. A builder that posts one gets a ready lane 2 or 3 pull request through rule 4. Lane 3 still needs the owner's approval, but lane 2 merges on green plus its review, so this is the whole guard for lane 2.
- EVIDENCE: `verdicts()` in `rules.mjs` (lines 885 to 903) reads only the text of a comment or review, never who posted it; recent pull requests and their comments are all `mcthaydt`.
- EXPECTED: the spec names it in section 5 as seen by neither the hook nor `pr-rules`, guarded by 3.7 alone, and 3.7's text names "posting a verdict you did not earn" among the routes around a hook.
- FIX: add that line to section 5 and the words to 3.7. A real guard (verdicts carry a reviewer's session link that the coordinator records) is a later, separate change and is not asked for here. Files: the spec only.

## Notes (not blocking)

- N1. Events not covered leave a stale result. `issue_comment: edited|deleted` and review `dismissed|edited` do not rerun, so a reviewer who edits "<head> PASS" to FAIL leaves the check green until the next event. Add `edited` and `deleted` to `issue_comment` (from the default branch, harmless), or say verdicts are never edited, only followed by a new one.
- N2. A `closed` event on another pull request does not rerun an over-limit one left open (the pre-existing case in criterion 2), so it stays red until something touches it. Fail-safe; worth one line in 3.1.
- N3. Concurrency is not specified. Runs that read live state can finish out of order; give `pr-rules.yml` a per-pull-request concurrency group without `cancel-in-progress` (a cancelled required check blocks the merge), or let R2's status write carry the sha and time it judged.
- N4. On a public repo, outsiders' pull requests from forks count toward the limit; three spam pull requests opened first would get every session's pull request closed on open. Consider counting only pull requests whose head repo is this repo. That changes what the limit means, so it is an owner card if taken.
- N5. `ruleMix.docPaths` includes `.claude/**`, so rule 3 (acceptance criteria) never fires for a pull request that changes only the hook (`rules.mjs`), PR-H's main file. Use a docs list without `.claude/**` for rule 3, or say this is intended.
- N6. No merge queue exists (no rulesets; classic protection). If one is added later, `pr-rules` has no `merge_group` trigger, so the queue would wait forever. Fail-safe; one line in section 5.
- N7. The live-state file for this branch still says "Last commit: b3598e9"; the spec's head is 30ed0ef. Update it at the next commit.

## What holds

- Base-only checkout on `pull_request_target`, the API-read design, and the closing of over-limit pull requests on `opened` and `reopened` are sound, and the closing is undone by reopening as the Call says.
- API merges respect required checks for this admin account because `enforce_admins` is on (measured), and `strict: false` does not weaken `pr-rules`, which judges live state.
- Every route from audits 1 and 2 ends in an event 3.1 covers (opened, reopened, edited, synchronize, ready_for_review, converted_to_draft), once R1 and R2 are fixed.
- The PR-H / PR-R split, order (PR-H first), and the units in section 6 are consistent with `ruleMix` and with each other.

## Owner decisions this audit depends on

None new. N4 would need one if the builder takes it.
