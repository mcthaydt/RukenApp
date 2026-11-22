# Plan audit 2: Deploy from a green main

- Spec: `docs/superpowers/specs/2026-11-22-deploy-from-green-main-design.md`
- Branch: `claude/project-thread-mqcz6h`. Examined commit: `30827c7` (the fix of plan audit 1, `cf795b0`, FAIL 4 red at `a2438b5`).
- Also read: `.github/workflows/ci.yml` on `origin/main` (`5bbea3e`), `package.json` scripts, `prisma.config.ts`, `wrangler.jsonc`, the owner steps at `/mnt/project-files/owner-steps/2026-11-22-deploy-from-green-main.md`, and `git diff 5bbea3e 30827c7`.
- Lane 3. Model: Opus 5.5, medium.

**Verdict: FAIL: 1 red, 4 notes.** R1, R2 and R4 are fixed. R3 is fixed for the database name but not for the Neon branch and role, which its own fix named; that is the one red (R5). Everything else holds.

## The four earlier reds

- **R1 (newer green commit left undeployed): fixed.** Spec 3.1 "Deploy the newest green commit" puts the choice in `.github/scripts/deploy-target.sh`: tip = run's commit, deploy it; tip newer and its newest `CI` push run `success`, deploy the tip; failed, running or missing, end green without deploying and say which. `actions: read` is added (3.1 "Who can reach the key", criterion 2). Criterion 3 tests all five cases with the printed reason. Walked the order cases: whichever job runs last reads the tip at run time, and a tip still running always gets its own later `workflow_run` job, so no green tip is stranded and no older commit is deployed over a newer one.
- **R2 (secrets job-wide): fixed.** 3.1 "Secrets only where they are used": no workflow- or job-level `env`; `DIRECT_DATABASE_URL` in the deploy step only; `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in the deploy and live-check steps only; `GH_TOKEN: ${{ github.token }}` on the target step only. Criterion 2 fails the test if `secrets.` appears outside those two steps or `DIRECT_DATABASE_URL` outside the deploy step.
- **R3 (wrong database): partly fixed.** Section 4 step 2 now reads the Hyperdrive origin first (`wrangler hyperdrive get eb64483c638e4f5eab2ce9dd1b7ea081`), passes `--project-id` and `--database-name`, and has a host check; criterion 6 checks the migrate log names the origin host. Missing: the branch and role. See R5.
- **R4 (live-state file): fixed.** `git diff --name-only 5bbea3e 30827c7 -- docs/superpowers/live` is empty; plan step 1 says to delete it before each hand-off.

## The seven notes of audit 1

- N1 repository lock: in the `if` and in criterion 2; the environment rule's wording now says what it covers. Done.
- N2 least-privilege key: custom token, Workers Scripts Edit and Hyperdrive Read, one account, no zone. Done.
- N3 step 3 is a click path: now said plainly. Done.
- N4 both deploys on at once: said in step 3, with "promptly". Done.
- N5 `test-times` can block: accepted as a Call; the message links the CI run. Done.
- N6 first account: `wrangler whoami` shown to the owner. Done.
- N7 re-run to recover: in 3.1 and 3.3. Done.

## Red finding

### R5. The owner's database command still lets neonctl pick the branch and role
- UNIT: spec section 4 step 2, and the owner steps file (same text).
- VERDICT: red.
- REQUIREMENT: audit 1 R3's EXPECTED ("the secret is the direct address of the exact database behind that Hyperdrive") and its FIX, which named `connection-string <branch> --project-id <id> --database-name <db>`; any migration is lane 3.
- REASON: `npx -y neonctl connection-string --project-id <id> --database-name <db>` has no branch and no `--role-name`, so neonctl uses the project's default branch and its own choice of role. The Hyperdrive origin `wrangler hyperdrive get` prints names a host (one Neon branch's endpoint) and a user.
- EVIDENCE: lines 72 and 83 of the spec (and the same two lines in the owner steps file). If the live database is on a non-default branch, the printed host differs from the origin: the eye check on line 73 catches it, but the steps give no command to get the right one, so the owner is stuck. If the role differs from the origin's user, `prisma migrate deploy` runs as a role that does not own the existing tables, so the first `ALTER TABLE` fails ("must be owner"), or new tables end up owned by a different role than the one the site uses. The check is by eye only, and criterion 6 only looks after migrations have already run.
- EXPECTED: the command names the branch and role that match the Hyperdrive origin, and the host comparison is a command that fails loudly, before any secret is set.
- FIX: in section 4 step 2 and the owner steps file: add `npx -y neonctl branches list --project-id <project id>` (note the branch whose endpoint is the origin host); use `npx -y neonctl connection-string <branch> --project-id <project id> --database-name <database> --role-name <user from hyperdrive get>` on both lines 72 and 83; replace the comment on line 73 with a one-line shell check that compares the host of that string with the origin host (with `-pooler` removed) and prints "same database" or "STOP: different database". Files: the spec and the owner steps file only.

## Notes (recorded, not blocking)

- N8. When the target step decides not to deploy, the later steps must skip (an `if` on the target's output). Criterion 2 lists the step order but not that guard; add it to the test so "ends green without deploying" cannot fall through to a checkout of an empty sha.
- N9. A pending deploy job cancelled by a newer one shows as a grey "cancelled" Deploy run. Harmless after R1's fix; `this-repo` could say "a cancelled Deploy run is normal" in one line so nobody chases it.
- N10. `neonctl` asks the owner to sign in through the browser on first use. Say so in one line before step 2's first `neonctl` command so it is not a surprise.
- N11. The 12-shard change (#326) had not merged at `5bbea3e`; it does not change this design (the deploy keys on the whole run's conclusion and the workflow name `CI`), but the implementer reads `ci.yml` on `main` again at build time, as 3.1 already says.

## Owner steps: complete and in order?

Order is right (key, environment, secrets, variable, then disconnect after the first green deploy). The steps file matches section 4 word for word. Hold it until R5 is fixed and re-checked.
