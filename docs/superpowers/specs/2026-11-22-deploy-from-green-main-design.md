# Deploy from a green main

Date: 2026-11-22. Status: **spec, waiting on its plan audit.** Lane 3 (a new workflow under `.github/workflows/`, a deploy credential, and the switch that decides what reaches production).

Lines marked **Owner** are the owner's words. Lines marked **Call** are this spec's choices; the owner can overrule any of them.

## 0. The owner's direction

- **Owner, 2026-11-22 15:23 UTC:** "why aren't deploys automatic and just coming from main?"
- **Owner, 2026-11-22 15:26 UTC:** "A", choosing: deploy from GitHub Actions only after the tests pass on `main`, then check the live site; the owner adds a scoped Cloudflare key and turns off Cloudflare's own build.

## 1. What happens today (measured 2026-11-22 15:25 UTC)

- `main` already deploys. Cloudflare Workers Builds is connected to the `ruken` Worker and deploys every push to `main`: each of the last 8 merge commits on `main` (`6410353` to `5bbea3e`) carries a "Workers Builds: ruken" check from the `cloudflare-workers-and-pages` app with a production Version ID (`gh api repos/mcthaydt/RukenApp/commits/<sha>/check-runs`). Its deploy command is `pnpm run deploy` written out, migrations first (design 2026-11-13, section 7, "One build, one Worker", Owner 2026-11-14).
- It does not wait for the tests. On `bb33e0b` the Workers Builds check completed at 14:52:41 UTC with a production version, and `gate` failed at 15:00:47 UTC (browser shard 4). A red `main` was live.
- Nothing checks the live site after a deploy. The http to https redirect bug (#310) reached people because no check ran against ruken.io (audit `2026-11-22-https-only-1`, note N2).
- The notes are wrong: `.claude/skills/this-repo/SKILL.md` and `progress.md` say "a merge to `main` does not deploy", so owner steps kept asking for `pnpm run deploy` by hand. The 2026-11-20 setup handoff already flagged the sentence.
- The games Worker (`pnpm run deploy:games --route …`) is not on Workers Builds and is deployed by hand. Unchanged here (section 6).

## 2. The outcome

Every push to `main` whose CI run passes is deployed to ruken.io by GitHub Actions, migrations first, then checked live. Nothing deploys from a pull request, a fork, a red run or an older commit. A failed deploy or a failed live check turns the run red with a one-line reason. Cloudflare's own build no longer deploys.

## 3. The change (one implementation pull request, lane 3)

### 3.1 Unit D: `.github/workflows/deploy.yml` (new file)

- **Trigger.** `on: workflow_run` with `workflows: [CI]`, `types: [completed]`, `branches: [main]`. The one job runs only when `github.event.workflow_run.event == 'push'` and `github.event.workflow_run.conclusion == 'success'`.
  - **Call:** a separate workflow, not a job in `ci.yml`. `ci.yml` stays read-only with no secrets (its header says so, and forks run it), and #326 is changing `ci.yml` now. `workflow_run` always runs the default branch's copy of `deploy.yml`, so a pull request cannot change what deploys.
  - **Call:** the whole CI run must succeed, not only `gate`. Stricter, and it needs no extra code; if `test-times` fails, nothing deploys and the run says why.
- **Who can reach the key.** The job uses `environment: production`. The owner creates that environment with a branch rule that allows only `main`, and the key lives there, so no other branch's run can read it. Top-level `permissions: contents: read`, nothing else.
- **One at a time.** `concurrency: { group: deploy-production, cancel-in-progress: false }`. A deploy is never stopped halfway.
- **Never go back in time.** First step: if `workflow_run.head_sha` is not the current tip of `main` (`gh api repos/${{ github.repository }}/commits/main --jq .sha`), the job says "a newer commit is on main; its own run deploys it" and ends green without deploying. A newer red `main` then deploys nothing, which is right: the live site stays at the last green.
- **Steps**, on `head_sha`, with `persist-credentials: false`, the same pinned `actions/checkout`, `pnpm/action-setup` and `actions/setup-node` (Node 24, `cache: pnpm`) that `ci.yml` uses:
  1. `pnpm install --frozen-lockfile`
  2. `pnpm build`
  3. `pnpm run deploy`, with `DIRECT_DATABASE_URL`, `CLOUDFLARE_API_TOKEN` (secrets) and `CLOUDFLARE_ACCOUNT_ID` (variable) from the environment. That is `prisma migrate deploy`, then `wrangler deploy cloudflare/worker.js`, unchanged. Its output's version id is kept for step 4.
  4. The live check (3.2).
- **Call:** no automatic rollback. A migration may already have run, and old code on a new schema can be worse than a red light. The failure says how to roll back by hand (`pnpm exec wrangler rollback`), and `this-repo` says it too.

### 3.2 The live check (inside unit D)

`.github/scripts/live-check.sh`, run as the last step, failing with `::error::` and the exact reason on the first miss:

1. `wrangler deployments status` shows the version id from step 3 at 100%.
2. `https://ruken.io/` answers 200 and its body holds `<title>Ruken`.
3. `http://ruken.io/sign-in` answers 308 with `location: https://ruken.io/sign-in` (the #310 bug).

Each address is tried every 5 seconds for at most 60 seconds, because a new version takes a few seconds to reach every Cloudflare location; the first answer that passes ends the wait. **Call:** this wait is for the deploy to arrive, not a retry of a failed check: a wrong answer that persists for 60 seconds fails.

### 3.3 Docs in the same pull request

- `.claude/skills/this-repo/SKILL.md`, "Outside the repo": a green `main` deploys itself through `deploy.yml` (migrations, the site, the live check); the owner no longer runs `pnpm run deploy` for the site; rolling back is `pnpm exec wrangler rollback`; the games Worker is still by hand. Named in the pull request body.
- `docs/superpowers/progress.md`: "Preview" line.

### 3.4 Before the build: the docs fix now (in this spec's pull request, lane 1)

`this-repo` and `progress.md` say today what is true today: a merge to `main` deploys through Cloudflare's own build, before the tests finish; the owner does not need to run `pnpm run deploy` for the site. The games Worker stays by hand.

## 4. The owner's steps (once, after the plan audit passes)

Everything is a command except creating the key: Cloudflare can only create a first API token in its dashboard.

1. Create the key at https://dash.cloudflare.com/profile/api-tokens with the "Edit Cloudflare Workers" template, Account Resources set to the one Ruken account, Zone Resources set to ruken.io only, no expiry beyond what you like. Copy it once.
2. In the RukenApp folder:

```sh
gh api -X PUT repos/mcthaydt/RukenApp/environments/production \
  -F 'deployment_branch_policy[protected_branches]=false' -F 'deployment_branch_policy[custom_branch_policies]=true'
gh api -X POST repos/mcthaydt/RukenApp/environments/production/deployment-branch-policies -f name=main -f type=branch
gh secret set CLOUDFLARE_API_TOKEN --env production --repo mcthaydt/RukenApp   # paste the key when asked
npx -y neonctl connection-string | gh secret set DIRECT_DATABASE_URL --env production --repo mcthaydt/RukenApp
gh variable set CLOUDFLARE_ACCOUNT_ID --env production --repo mcthaydt/RukenApp --body "$(npx -y wrangler whoami 2>/dev/null | grep -oE '[0-9a-f]{32}' | head -1)"
```

3. After the first green deploy from GitHub (the implementer reports it), turn off Cloudflare's own build: Workers & Pages, ruken, Settings, Build, Disconnect. **Call:** this comes last so `main` is never without an automatic deploy; until then both deploy the same commit, which is harmless (migrations do nothing the second time).

## 5. Acceptance criteria

1. `deploy.yml` passes `actionlint` (run in the implementer's container) and `pnpm lint`.
2. A test (`tests/deploy-workflow.test.ts`) reads `deploy.yml` and fails unless: the trigger is `workflow_run` on `CI`, `completed`, `main`; the job's `if` requires `event == 'push'` and `conclusion == 'success'`; it uses `environment: production`; concurrency is `deploy-production` with `cancel-in-progress: false`; no `pull_request` or `pull_request_target` trigger exists; checkout uses `head_sha` with `persist-credentials: false`; the deploy step comes after the "newer commit" step and before the live check. It fails by itself on `main` (no file yet).
3. `live-check.sh` is tested against a local stand-in server (`tests/live-check.test.ts`): passes on 200 with the title and a correct 308; fails with its reason on a 200 for http, a 308 to the wrong place, a 500, a page without the title, and a server that never answers (within the 60-second cap, with the wait injected so the test is fast).
4. CI green on the pull request; plan audit PASS on this spec; implementation audit PASS on the pull request's head.
5. After merge, with the owner's steps 1 and 2 done: the first push to `main` with a green CI run shows a green "Deploy" run whose log has the version id, all three live checks passing, and `wrangler deployments status` (or the Cloudflare dashboard) showing that version. Measured and reported with the run link. Until the owner's steps are done the Deploy run fails at the deploy step saying the key is missing, which is reported as not done, never as met.
6. After the owner's step 3, the next `main` merge carries no "Workers Builds: ruken" check.

## 6. Boundaries and open items

- New: one GitHub environment, two secrets and one variable in it (owner's step 2), one Cloudflare API token. No new package or spend; the job runs on the free public runners, about 3 minutes per merge (install, build, deploy, check; estimated, measured on the first run).
- Not changed: `ci.yml`, the deploy script in `package.json`, the games Worker (still `pnpm run deploy:games --route …` by hand; making it automatic is the owner's call, not this spec's), Worker secrets (still `wrangler secret put` by the owner).
- Expected duration: the build and its audits about 2 hours, most of it audits and CI.

## 7. Plan

Tick each step as it lands; the coordinator copies the percentage into `progress.md`.

- [ ] 1. Spec pull request (this file, the docs fix in 3.4, the owner's instruction in `progress.md`), plan audit, merge.
- [ ] 2. Owner's steps 1 and 2 (section 4), relayed by the coordinator; can run in parallel with steps 3 to 6.
- [ ] 3. Write `tests/deploy-workflow.test.ts` and `tests/live-check.test.ts`; both fail on `main`.
- [ ] 4. Write `.github/scripts/live-check.sh` until `tests/live-check.test.ts` passes.
- [ ] 5. Write `.github/workflows/deploy.yml` until `tests/deploy-workflow.test.ts` and `actionlint` pass.
- [ ] 6. Update `this-repo` and `progress.md` (3.3). Full CI green; delete the live-state file; implementation audit; fixes.
- [ ] 7. Merge on the owner's word (lane 3); watch the first Deploy run and report it (criterion 5).
- [ ] 8. Owner's step 3; confirm criterion 6 on the next merge.

## 8. Open product decisions

None. The owner chose A on 2026-11-22 15:26 UTC. Whether the games Worker also deploys itself is a later choice for the owner, not part of this work.
