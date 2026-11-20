# Plan audit: CI screenshots in R2, cycle 1

Examined: spec `docs/superpowers/specs/2026-11-20-ci-screenshots-in-r2-design.md` at commit `8bf3e49` (branch `claude/project-thread-277u1i`, draft pull request #211), against `main` at `36e87c0`, the Owner's commands file `owner-steps/2026-11-20-ci-screenshots-r2-commands.md` in the project's files, and open pull requests #206 and #209 (#208 merged while this audit ran). Lane 3 plan audit (`review`, `staged-path`).

Prompt: Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## Verdict

**3 red, 12 notes.** The design is sound: the variables-not-secrets call is safe, the 3-hour links and the hourly sweep line up, forks skip cleanly, and nothing in flight conflicts. The three reds are bounded edits to Task 2 of the plan; none needs the Owner. Unit C can start once they are in the spec.

## Red

### R1. The "no secrets" comment in `ci.yml` becomes false

- UNIT: Task 2, Step 1 (`.github/workflows/ci.yml`).
- VERDICT: red.
- REQUIREMENT: completeness against the codebase; a comment that says why a security setting is safe must stay true (`build`: comments say why).
- REASON: the plan adds the first secret to `ci.yml` but does not touch the comment above `permissions`.
- EVIDENCE: `ci.yml` on `main`, above `permissions: contents: read`: "Read-only, and no secrets are used, so a forked pull request gets nothing it should not have." After Step 1, `browser-shard` reads `secrets.R2_SECRET_ACCESS_KEY`.
- EXPECTED: the comment says one secret is used, only in the upload step's own `env`, that a fork's pull request gets none (so the step skips, A5), and that the token reaches one bucket only (A9).
- FIX: add to Step 1 "rewrite the comment above `permissions` to say so". Spec only.

### R2. The commit, not only the comment and the body, must quote the Owner

- UNIT: Task 2, Steps 1, 2 and 4.
- VERDICT: red.
- REQUIREMENT: `ci.yml`'s header: "This file changes only on the Owner's words, quoted in the commit (CLAUDE.md)."
- REASON: the plan quotes the Owner in the file's comment and in the pull request body, but never says the commit that changes `ci.yml` quotes them, and the new `screenshots-sweep.yml` gets no header saying where its words come from.
- EVIDENCE: spec, Step 1: "Its comment keeps the Owner's 2026-11-13 ... and adds this spec's Owner line"; Step 4: "The pull request body quotes the Owner's words". Neither names the commit message.
- EXPECTED: each commit touching `.github/workflows/` quotes the Owner's 2026-11-20 words; `screenshots-sweep.yml` opens with a header comment like `ci.yml`'s: what it does, the Owner's words, and that it changes only on the Owner's words.
- FIX: one line in Step 4 for the commits, one in Step 2 for the header. Spec only.

### R3. The sweep merges with no check that it picks the right files

- UNIT: Task 2, Step 2 (`screenshots-sweep.yml`) and Step 5.
- VERDICT: red.
- REQUIREMENT: "Acceptance criteria come first" and "A check is a test that fails by itself" (CLAUDE.md); lane 3 merges after its checks.
- REASON: A6, the only check of the sweep, runs after the merge ("A6 and A9 run after the merge"), and the sweep cannot be run by hand before then (`gh workflow run` needs the file on the default branch). Its one fragile part, picking keys older than 3 hours with `jq`, is unchecked before a lane 3 merge.
- EVIDENCE: the AWS command line prints `LastModified` as `2026-11-20T01:00:00+00:00`. `jq`'s `fromdateiso8601` accepts only `...Z` and stops with an error on `+00:00`. An empty bucket has no `Contents` key at all, so `.Contents[]` errors where the spec says "An empty bucket passes". Either mistake gives a sweep that fails every hour, or deletes nothing, after merge.
- EXPECTED: before the hand-off to the implementation audit, a program shows the selection picks exactly the old keys from a listing with `+00:00` times, mixed ages and no `Contents`.
- FIX: in Step 2, put the selection in the workflow as one `jq` filter that compares strings (`.Contents // [] | .[] | select(.LastModified[0:19] < $cutoff) | .Key`, with `cutoff=$(date -u -d '3 hours ago' +%Y-%m-%dT%H:%M:%S)`), and add to Step 4: the build session runs that same filter in its container on three saved sample listings (old and new mixed, all new, empty) and pastes the output in the pull request. Files: `screenshots-sweep.yml` only; the samples stay out of the repo. A6 still runs after the merge as planned.

## Notes

### N1. Variables, not secrets: safe, keep it

- The question asked: is it safe to make `R2_ACCOUNT_ID` and `R2_ACCESS_KEY_ID` Actions variables? **Yes.** A presigned link carries both in plain text (the host `<account>.r2.cloudflarestorage.com`, and `X-Amz-Credential=<access key id>/...`), so as secrets GitHub would mask them and every link would read `***`. Neither signs a request; only the secret access key does, and the link's `X-Amz-Signature` is derived from it, not it. Cloudflare treats the account id as public (it is in every Workers address), and the access key id is the token's id, which authenticates nothing alone.
- Keep what the spec already says: the three keys go in the upload **step's** `env`, never the job's, so `pnpm install`, the app and the journeys never see the secret.
- What is left: a poisoned dependency installed earlier in the same job could plant a fake `aws` on the runner and catch the secret when the upload step runs. The token reaches only this bucket (A9), so the worst case is someone writing to or reading a bucket of throwaway reports. No change asked; recorded so the implementation audit checks the `env` placement.

### N2. Links and sweep line up

- Upload at T, link signed seconds later for 10800 seconds, so it ends at T + 3 h + a few seconds. The sweep deletes objects older than 3 hours at its first hourly run after that: between T + 3 h and T + 4 h (more if GitHub delays the scheduled run). A link never outlives its object by more than those seconds, and an object never outlives its link for long. That fits.
- The spec reads "deleted 3 hours after upload" as "by the first hourly sweep after 3 hours", up to 4. It says so as a Call, which the Owner can overrule; no change asked.
- Add to section 6: R2's lifecycle rules act within about a day of an object's expiry, so the 1-day backup can mean up to about 2 days if the sweep stops. Spec only.

### N3. Fork pull requests skip cleanly; one line of copy is wrong

- On a fork's pull request GitHub withholds `secrets.*`; variables may still be present. The step's test "any of the three is empty" catches both cases, so the step passes, uploads nothing, and nothing goes to GitHub's artifacts (A5). A fork cannot read the secret by editing `ci.yml`, because `pull_request` (not `pull_request_target`) runs a fork's workflow without secrets. Scheduled workflows are off in forks, so the sweep never runs there.
- The notice text "No R2 key here (a fork's pull request), so the browser report is not kept" also shows on the Owner's own pull requests before O4, where it is wrong. FIX: "No R2 key here, so the browser report is not kept. (A fork's pull request never has one.)" Spec, A5 and Step 1.

### N4. Runner load: small, measured

- Measured at 02:04 UTC: 149 workflow runs in the last 24 hours (of the first 100 listed, 45 were CI and 55 `commit-authors`); a CI run is 11 jobs; 4 runs were queued at the time. The sweep adds 24 jobs a day of about half a minute each, a few percent of today's jobs. The upload adds seconds to each browser piece that ran journeys.
- The spec already gives the sweep its own `concurrency` with no cancel (at most one running, one waiting) and a minute other than `:00`, which GitHub's scheduler is busiest at. Nothing more asked. If runners stay scarce, every 2 hours (deletion within 5 hours) halves it; that is the Owner's call, not this change's.

### N5. The quick run won't reach the new test

- Unit T's test reads workflow files as text, so `vitest --changed` cannot tell when a change reaches it. `ci.yml`'s draft run lists the two tests that do this (`tests/architecture.test.ts tests/wrangler.test.ts`) and always runs them; T's test is not on that list, so a draft that edits a workflow runs it only once marked ready. The full run and `gate` still catch it, so A2 holds.
- Adding it to that line is a `ci.yml` change, which cannot ride in T (`build`: a workflow change lands in its own pull request) and cannot land in C before the file exists. Follow-up: name it in the next rule or workflow pull request after T. Not fixed here.

### N6. The AWS command line and R2's checksums

- Recent AWS CLI v2 sends extra checksum headers by default; Cloudflare's R2 notes for the AWS command line suggest `AWS_REQUEST_CHECKSUM_CALCULATION=when_required` and `AWS_RESPONSE_CHECKSUM_VALIDATION=when_required`. Unverified against today's runner image. Setting both in the step's and the sweep's `env` costs nothing; A3 fails loudly if it is needed and missing. Optional.

### N7. The Owner's commands file: correct

- Checked `npx wrangler@4 r2 bucket lifecycle add --help`: `<bucket> [name] [prefix]`, `--expire-days`, `--force` all exist, and an empty prefix means every object. `gh variable set --help`: reads the value from standard input when `--body` is left out, as the file says. Order O1 to O4 matches the spec. Runs in iTerm2, per the Owner's rule.
- The optional last command deletes **every** artifact in the repository, not only browser reports. Today there are 1,848 (measured with `gh api .../actions/artifacts`). Suggest narrowing it to reports: `-q '.artifacts[] | select(.name | startswith("playwright-report-")) | .id'`. The project's files only; not part of C.

### N8. Cloud sessions can probably reach R2

- From this cloud container, the proxy allowed a connection to `<made-up>.r2.cloudflarestorage.com:443` (Cloudflare then refused the handshake for an account that does not exist, as expected). Not proven with a real link; A3's `curl` in the build session proves it. Screens-page sessions download from there from now on.

### N9. "Shoot only what the change touches": consistent

- The change moves where the report goes, not what is shot: `LOOK_SHOTS` and "Decide whether to take the screenshots" stay as they are. A quick run with screenshots off still uploads its report (pass/fail and errors, no pictures), as the artifact did. Suggest one line in section 1 saying so, so the implementer does not touch the decide step. Spec only.
- Pre-existing, outside this change: `release` says screenshots are taken "with no label needed", while `ci.yml` still uses the `screenshots` label and `this-repo` says no program picks screens yet. Reported for the retrospective, not fixed here.

### N10. No conflict with open work

- The coordinator's brief said #206, #208 and #209 touch `ci.yml`. They do not: listing every file of each (`gh api --paginate .../pulls/<n>/files`) shows no `.github/` file in any of them and no `this-repo` edit; the spec's "no open pull request edits `.github/workflows/`" is right. #209 changes `playwright.config.ts` (stand-in Twilio settings only) and `tests/browser/support/look.ts` (screen list), neither of which moves the report out of `playwright-report/`. #208 merged at 02:00 UTC. C merges `main` before it is marked ready, as planned.

### N11. Spec claims checked

- `ci.yml` has exactly one `upload-artifact` step, so A2's `grep` is a fair check. `commit-authors.yml` uploads nothing.
- No test in `tests/` reads `.github/workflows/` today (searched, and Graphify at `36e87c0`), so T's file is new and owns nothing shared.
- Unit split, order and lanes match `staged-path` and `build` (workflow change first, no tests in it; `this-repo` may ride with C and is named in its body).

### N12. Plan for the implementation audit

- Check the three keys sit in the step's `env` only (N1), the `permissions` comment (R1), the commit messages (R2), the sweep's filter output (R3), and A3 to A5 and A8 on C's last commit.
