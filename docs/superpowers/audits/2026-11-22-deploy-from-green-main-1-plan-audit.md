# Plan audit 1: Deploy from a green main

- Spec: `docs/superpowers/specs/2026-11-22-deploy-from-green-main-design.md`
- Branch: `claude/project-thread-mqcz6h`. Examined commit: `a2438b5` (the coordinator named `c826b5a`; `a2438b5` only adds `GH_PAGER=cat` to two owner commands and updates the live-state file, so this audit covers both).
- Also read: `.github/workflows/ci.yml` on that head, `package.json` scripts, `prisma.config.ts`, `wrangler.jsonc`, `vite.config.ts`, the owner steps at `/mnt/project-files/owner-steps/2026-11-22-deploy-from-green-main.md`, and the last six CI runs on `main` (`gh api repos/mcthaydt/RukenApp/actions/runs?branch=main&event=push`).
- Lane 3. Model: Opus 5.5, medium.

**Verdict: FAIL: 4 red, 7 notes.** The design is sound (separate `workflow_run` workflow, `push` + `success` guard, environment, no rollback, tip check). The reds are bounded spec edits.

## What holds

- **Fork and pull request safety.** `workflow_run` runs the default branch's `deploy.yml`, and the `event == 'push'` guard is what keeps pull request runs out: a fork pull request whose head branch is named `main` passes the `branches: [main]` filter (it matches `head_branch`), but its event is `pull_request`. Criterion 2 tests the guard. Good.
- **Every main push runs the full CI.** `ci.yml` has no `paths` filter on `push`, and "A push to main always does" run everything, so a docs-only tip never leaves an older green commit stranded by the tip check.
- **Main CI runs are never cancelled** (`cancel-in-progress` is true only for `pull_request`), so each main commit gets a `completed` event.
- **Workflow name** `CI` matches `ci.yml`'s `name: CI`.
- **Build needs no secrets.** `pnpm build` is `pnpm generate && vite build`; no `$env/static` import in `src`, and `vite.config.ts` reads only `VITEST`. Prisma's config reads `DIRECT_DATABASE_URL` first, matching the secret name.
- **The docs fix (3.4)** in `this-repo` and `progress.md` says what is true today and matches the measured Workers Builds checks.
- **The 12-shard change (#326)** does not touch this design: the deploy keys on the whole CI run's conclusion, not on shard names or counts (see note N5).

## Red findings

### R1. A newer green commit can be left undeployed
- UNIT: spec 3.1, "One at a time" and "Never go back in time".
- VERDICT: red.
- REQUIREMENT: section 2, "Every push to `main` whose CI run passes is deployed"; the coordinator's ask "a newer green commit must still deploy".
- REASON: a GitHub concurrency group keeps only one *pending* job; a newly queued job cancels the pending one even with `cancel-in-progress: false`. CI runs on `main` overlap routinely (2659138 ran 14:27 to 14:52 while 5cfe939 ran 14:19 to 14:36 and bb33e0b started 14:51) and take 10 to 25 minutes, so they can finish out of order.
- EVIDENCE: sequence: deploy of A running; C (newer, green) finishes and queues; B (older than C) finishes and queues, cancelling C's pending job; B runs, sees C is the tip, skips. C, the newest green commit, is never deployed until another push.
- EXPECTED: whenever a deploy job runs and its commit is not the tip, the tip is still deployed if its CI passed.
- FIX: in 3.1, the first step decides the target: if `head_sha` is the tip, deploy it; otherwise read the tip's latest `CI` push run (`gh api "repos/$REPO/actions/runs?head_sha=$TIP&event=push"`, newest attempt of the `CI` workflow) and deploy the tip when it concluded `success`, else end green without deploying ("the newer commit's own run decides"). Checkout uses that target sha. Add `actions: read` to the job's permissions. Put the decision in `.github/scripts/deploy-target.sh`, tested like `live-check.sh` with stubbed answers (tip = head; tip newer and green; tip newer and red; tip newer and still running). Files: the spec only (3.1, 5 criteria 2 and 3, 7 steps 3 to 5).

### R2. Where the secrets live in the job is not stated or tested
- UNIT: spec 3.1 steps 3 and 4; criterion 2.
- VERDICT: red.
- REQUIREMENT: the coordinator's "secret exposure, least-privilege"; the repo's own practice in `ci.yml` (no secrets near untrusted code).
- REASON: "with `DIRECT_DATABASE_URL`, `CLOUDFLARE_API_TOKEN` (secrets) ... from the environment" can be read as job-level `env`, which hands the production database password and the Cloudflare key to `pnpm install` (every dependency's install scripts) and to `vite build` (every plugin). The live check (3.2 item 1, `wrangler deployments status`) also needs the key and account id, which the spec does not say.
- EXPECTED: `DIRECT_DATABASE_URL` is in the `env` of the deploy step only; `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` only in the deploy and live-check steps; no job-level or workflow-level `env` holds a secret; `GH_TOKEN: ${{ github.token }}` only on the tip step.
- FIX: say so in 3.1 and add it to criterion 2's list (the test fails if `secrets.` appears outside those two steps). Files: the spec only.

### R3. The owner's database command can point migrations at the wrong database
- UNIT: spec section 4 step 2 (and the owner steps file).
- VERDICT: red.
- REQUIREMENT: migration safety (any migration is lane 3); "a tool or asset is checked to exist before anything is built on it".
- REASON: `npx -y neonctl connection-string` with no `--project-id`, `--branch` or `--database-name` uses whatever neonctl picks (it errors with more than one project, and otherwise uses the default branch, role and database). If that is not the database the live site reads through Hyperdrive, `prisma migrate deploy` migrates one database and the live Worker runs new code against the old schema.
- EVIDENCE: the live site's database is Hyperdrive `eb64483c638e4f5eab2ce9dd1b7ea081` (`wrangler.jsonc`); nothing in the steps ties the secret to it.
- EXPECTED: the secret is the direct (non-pooled) address of the exact database behind that Hyperdrive, and the owner can see that it is.
- FIX: in section 4 step 2, first `npx -y wrangler hyperdrive get eb64483c638e4f5eab2ce9dd1b7ea081` (shows the origin host and database), then `npx -y neonctl connection-string <branch> --project-id <id> --database-name <db>` with those values (with `npx -y neonctl projects list` to find the id), and a one-line check that the two hosts are the same endpoint (the pooled host differs from the direct host only by `-pooler`). Criterion 5 adds: the first Deploy run's migrate log names that host. Files: the spec and the owner steps file.

### R4. The live-state file is on the reviewed head
- UNIT: `docs/superpowers/live/claude-project-thread-mqcz6h.md`; spec 7 step 1.
- VERDICT: red.
- REQUIREMENT: CLAUDE.md "Live state in a file": the session deletes the file in its last commit before it hands the branch to the audit, so the audited commit is the one that merges.
- EVIDENCE: `git show a2438b5 --stat` adds to it; it is in `git diff origin/main...a2438b5 --stat`.
- EXPECTED: the spec pull request merges without the file; plan step 1 says so as step 6 already does for the build.
- FIX: delete the file in the fix commit, and add "delete the live-state file" to step 1. Check: `git diff --name-only <fix> -- docs/superpowers/live` is empty against `main`.

## Notes (recorded, not blocking)

- N1. The environment's `main`-only branch rule does not stop a `workflow_run` job: such jobs always run with `github.ref` = `refs/heads/main`. It does stop a workflow on another branch from naming `environment: production`, which is worth having. The real guard against pull request runs is the `if`. Consider adding `github.event.workflow_run.head_repository.full_name == github.repository` to it as a second lock, and reword "so no other branch's run can read it" to say which runs it covers.
- N2. The "Edit Cloudflare Workers" template also grants account-wide R2 and KV edit. Least privilege is a custom token with Account: Workers Scripts Edit (plus Hyperdrive Read if the first deploy asks for it; `wrangler.jsonc` binds Hyperdrive and R2), and no zone permission unless `wrangler deploy` reports it needs routes (there are none in `wrangler.jsonc`). If the implementer keeps the template, say why.
- N3. Step 3 (disconnect Workers Builds) is a click path while the step 2 heading says "everything is a command except creating the key". Either give the Cloudflare API call, or say plainly there is no CLI for it.
- N4. While both deploys are on (until owner step 3), a GitHub deploy of an older green commit can land seconds after Workers Builds shipped a newer push (the tip check passed before the push), putting old code on a newer schema. The window is small; keep step 3 prompt, and say so in section 4.
- N5. "The whole CI run must succeed" means `test-times` (`fail-on-cache-miss: true` on six caches, being changed by #326 to twelve) can block a deploy for a reason that is not a test. Accepted by the Call; the implementer reads `ci.yml` on `main` after #326 merges, and the failure message should name the failed job.
- N6. `wrangler whoami | grep -oE '[0-9a-f]{32}' | head -1` takes the first account if the owner belongs to several. Prefer `npx -y wrangler whoami` shown to the owner, or `CLOUDFLARE_ACCOUNT_ID` from the account named Ruken.
- N7. Re-running a failed CI run on `main` that then passes will deploy it if it is still the tip (and, after R1's fix, a newer green tip). That is the intended way to recover from a flaky red `main`; `this-repo` could say it in one line.

## Owner steps: complete and in order?

Order is right (key, environment, secrets, variable before the first green Deploy; disconnect last). Missing: the database check in R3. Otherwise complete. Hold them until R1 to R4 are fixed and re-checked.
