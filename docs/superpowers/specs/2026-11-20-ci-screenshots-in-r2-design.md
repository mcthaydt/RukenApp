# CI screenshots in R2, not in GitHub's artifacts

Date: 2026-11-20. Status: superseded and not built. The owner, 2026-11-20 07:50 UTC: "that R2 rule should only be on private repos, I forgot that we don't have an artifact limit for public repos". RukenApp is public.

Lines marked **Owner** are the Owner's words or choices. Lines marked **Call** are this spec's choices; the Owner can overrule any of them.

## 0. The Owner's direction

- **Owner, 2026-11-20:** "We may have to move our screenshots that we take to Cloudflare R2 because that fills up too quickly", then "Yeah let's do that here". GitHub's artifact storage is what fills up.
- **Owner, 2026-11-20 (relayed):** the same pattern as the Owner's other game: CI uploads the screenshots to an R2 bucket, they are deleted 3 hours after upload, a 1-day bucket lifecycle rule backs that up, and nothing goes to GitHub's artifacts.
- **Owner, 2026-11-20:** "The screenshots are so we can see them here, but once we see them here, we don't really need them anymore". The screens page holds its pictures only until the Owner has looked, and is then deleted; it does not keep them until the slice ends. The apps guide's pull request McThayDT-Website#95 says the same.
- The general rule for apps is being written into the Owner's apps guide at the same time (release skill and the Default stack). This spec follows it: no screenshot, no report carrying them and no diff image goes to GitHub's artifacts; they go to a private bucket with a key for that bucket only; the run summary links them and the links run out with them; a scheduled job deletes each one 3 hours after upload, hourly, with a 1-day lifecycle rule behind it; a run with no key skips the upload and says so, never falling back to GitHub's artifacts; and a test reads the workflows and fails on a step that sends screenshots, or a report carrying them, to GitHub's artifacts.

## 1. The outcome

Every browser piece in CI that ran journeys zips its Playwright report (which carries the look's screenshots) and puts it in a private R2 bucket, `ruken-ci-screenshots`. The run's summary, and the piece's log, give one link per piece that works for 3 hours. An hourly scheduled workflow deletes every object older than 3 hours, and a lifecycle rule on the bucket deletes anything older than 1 day in case the job stops. No workflow uploads anything to GitHub's artifacts. What is shot does not change: `LOOK_SHOTS` and the "Decide whether to take the screenshots" step stay as they are, and a quick run with screenshots off still uploads its report (pass or fail and the errors, no pictures), as the artifact did.

What a session does differently: where it ran `gh run download` for `playwright-report-<n>`, it opens the run's summary (or `gh run view <run id> --log`), copies the piece's link, and downloads it with `curl -o report.zip "<link>"` within 3 hours of the run. The pictures are for viewing in the project chat, where the screens page shows them to the Owner. No copy goes to GitHub, into this repository or into the project's files, and the R2 copy goes with the sweep. The screens page holds its pictures only until the Owner has looked, and is then deleted.

## 2. What changes, and where

| Where | Today | After | Who |
|---|---|---|---|
| R2 bucket `ruken-ci-screenshots` | none | private, no public address, lifecycle rule "delete after 1 day" | the Owner, CLI |
| R2 API token | none | "Object Read & Write", this bucket only | the Owner, one website step (section 6) |
| GitHub, Actions variables | none | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID` | the Owner, `gh variable set` |
| GitHub, Actions secret | none | `R2_SECRET_ACCESS_KEY` | the Owner, `gh secret set` |
| `.github/workflows/ci.yml`, `browser-shard` | `actions/upload-artifact`, `playwright-report-<n>`, 7 days | a step that zips `playwright-report/`, uploads it to R2 and writes the 3-hour link to the log and the run summary; skips with a notice when there is no key | the build (C) |
| `.github/workflows/screenshots-sweep.yml` | none | hourly, and by hand: deletes every object older than 3 hours | the build (C) |
| `.claude/skills/this-repo/SKILL.md`, CI | says CI takes the screenshots | also says where they go, how to fetch them and when they disappear | the build (C) |
| `tests/workflows.test.ts` | none | reads every workflow and fails on any `upload-artifact` step whose path holds the report or a screenshot (`playwright-report`, `test-results`, `.png`) | the build (T) |

- **Call: one zip per piece, not one object per picture.** The report's pictures are named by hash inside it, and the report's own page needs its whole folder; a zip keeps it whole, makes one link per piece, and is what the `gh run download` artifact was before.
- **Call: the account id and the access key id are Actions variables, not secrets.** GitHub hides every secret's value wherever it appears in a log or a run summary, and a presigned link carries both in plain text, so as secrets they would turn every link into `***`. Neither lets anyone in alone: only the secret access key signs a request, and it stays a secret. The account id is already shown in every Cloudflare address of the Owner's Workers.
- **Call: the links are in a public log.** RukenApp is public, so anyone who opens the run within its 3 hours can download that piece's report. Today the same reports sit in public artifacts for 7 days. The journeys use only made-up people and stand-in services, so a report holds no real data.
- **Call: the upload uses the AWS command line already installed on GitHub's Ubuntu runners**, through R2's S3 address (`https://<account>.r2.cloudflarestorage.com`, region `auto`). No action, package or dependency is added. The first run proves it is there (A3).
- **Call: an hourly sweep, not a sweep inside each CI run.** A run that is cancelled, or a quiet day with no runs, would leave objects longer than 3 hours. Each hourly run is about half a minute of runner time. "Deleted 3 hours after upload" means "by the first hourly sweep after it turns 3 hours old", so at most 4 hours.
- **No new dependency or environment.** **Spend:** R2's free allowance is 10 GB stored and a million writes a month; at most a day of reports is ever stored. Expected cost $0.

## 3. Acceptance criteria

Each is observable by a program or a person, and names who checks it.

1. **A1, the test fails first.** On today's `ci.yml`, `pnpm exec vitest run tests/workflows.test.ts` fails, naming `ci.yml` and its `upload-artifact` step. With C merged it passes. (The build session of T, shown in its report.)
2. **A2, no workflow sends a screenshot to GitHub.** `grep -rn "upload-artifact" .github/workflows/` prints nothing, and A1's test passes in CI. (CI, and the audit.)
3. **A3, a piece's report lands in R2.** On C's pull request, after the Owner's steps, each browser piece that ran journeys prints a line starting `Browser report, piece <n>:` with a link, and the run summary lists the same links. `curl -s -o r.zip "<link>" && unzip -l r.zip | grep -c index.html` prints `1`. (The build session.)
4. **A4, the link runs out.** The link's `X-Amz-Expires` is `10800`. (The build session, from the printed link.)
5. **A5, no key, no upload, and it says so.** With the variables or the secret missing, the step passes, prints a notice "No R2 key here, so the browser report is not kept. (A fork's pull request never has one.)", writes the same line to the run summary, and nothing is sent to GitHub's artifacts. (The build session: its first quick run, pushed before the Owner's steps are done if they are not done yet, or one run of the step's script with the key unset in a cloud container. The audit reads the step.)
6. **A6, the sweep deletes what is over 3 hours old.** Run by hand (`gh workflow run screenshots-sweep.yml`) at least 3 hours after A3's run, it prints each key it deleted, A3's keys among them, and A3's `curl` then gets `404` or `403`. A second run straight after deletes nothing and passes. (The build session or a later cloud session.)
7. **A7, the backup rule is on the bucket.** `npx wrangler r2 bucket lifecycle list ruken-ci-screenshots` shows a rule that expires all objects after 1 day. (The Owner, printed after O2; nothing secret in it.)
8. **A8, nothing else in CI changes.** `gate` passes on C's full run; the step names, the draft rules and the `browser` and `gate` checks are as before. (CI.)
9. **A9, the token reaches this bucket only.** With the CI keys, `aws s3 ls --endpoint-url …` lists only `ruken-ci-screenshots` or is refused, and `aws s3 ls s3://<any other bucket of the account>` is refused. (A cloud session given the keys for this check only, or the Owner.)

## 4. The plan

Two units, each its own pull request, and the Owner's steps. Lane 3: C touches `.github/` and Cloudflare. T is a test (lane 1), and lands after C because `build` says a workflow change lands first, in a pull request with no product code and no tests.

| Unit | Waits on | Files it owns | Output | Check |
|---|---|---|---|---|
| C, the reports go to R2 | this spec merged; the Owner's steps O1 to O4 before A3 | `.github/workflows/ci.yml`, `.github/workflows/screenshots-sweep.yml`, `.claude/skills/this-repo/SKILL.md` | one pull request, lane 3 | A2 to A9 |
| T, the workflow test | C merged | `tests/workflows.test.ts` | one pull request, lane 1 | A1 |

**Other open work, checked for shared files (2026-11-20):** no open pull request edits `.github/workflows/`. `this-repo` is edited by other units now and then; C changes only its CI list, and merges `main` before it is marked ready. Screens pages built from runs before C merged use the old artifacts, which expire on their own after 7 days.

### Task 1: the Owner's steps (any time; before A3)

The commands are in the project's files for the Owner (`owner-steps/2026-11-20-ci-screenshots-r2-commands.md`), beside the Owner's other command files. In order:

- [ ] **O1:** `npx wrangler r2 bucket create ruken-ci-screenshots`.
- [ ] **O2:** `npx wrangler r2 bucket lifecycle add ruken-ci-screenshots delete-after-1-day --expire-days 1 --force`, then `npx wrangler r2 bucket lifecycle list ruken-ci-screenshots` (A7).
- [ ] **O3:** the website step: R2 → Manage API tokens → Create Account API token: permission "Object Read & Write", applied to `ruken-ci-screenshots` only, no expiry. Wrangler cannot make R2 tokens. Keep the page open for O4.
- [ ] **O4:** `gh variable set R2_ACCOUNT_ID`, `gh variable set R2_ACCESS_KEY_ID` and `gh secret set R2_SECRET_ACCESS_KEY`, each on `mcthaydt/RukenApp`, each asking for its value, which is pasted, never typed into a chat.

### Task 2: C, the reports go to R2 (the build session)

- [ ] **Step 1:** in `ci.yml`'s `browser-shard`, replace "Keep the browser report, with the look's screenshots" with "Send the browser report to R2": `if: always() && steps.pick.outputs.run == 'true'`; env `AWS_ACCESS_KEY_ID` from `vars.R2_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` from `secrets.R2_SECRET_ACCESS_KEY`, `R2_ACCOUNT_ID` from `vars.R2_ACCOUNT_ID`, `AWS_DEFAULT_REGION: auto`, `PIECE: ${{ matrix.shard }}`, and `AWS_REQUEST_CHECKSUM_CALCULATION` and `AWS_RESPONSE_CHECKSUM_VALIDATION` both `when_required` (Cloudflare's advice for the AWS command line on R2). The keys go in this step's `env` only, never the job's, so the install, the app and the journeys never see the secret. The script: if any of the three is empty, print A5's notice with `::notice::`, append it to `$GITHUB_STEP_SUMMARY` and exit 0; if `playwright-report/` is missing, say so and exit 0; else zip it, upload it to `s3://ruken-ci-screenshots/runs/$GITHUB_RUN_ID/$GITHUB_RUN_ATTEMPT/piece-$PIECE.zip`, presign it for 10800 seconds, and print and append `Browser report, piece <n>: <link> (works for 3 hours)`. A failed upload fails the step: a report that vanishes silently is worse than a red piece. Its comment keeps the Owner's 2026-11-13 "Screenshots on the board" and adds this spec's Owner line, quoted, as the file's header asks. Rewrite the comment above `permissions`, which says no secrets are used: one secret is used, only in this step's `env`; a fork's pull request gets none, so the step skips (A5); and the token reaches this one bucket only (A9).
- [ ] **Step 2:** add `.github/workflows/screenshots-sweep.yml`, opening with a header comment like `ci.yml`'s: what it does, the Owner's 2026-11-20 words, and that it changes only on the Owner's words, quoted in the commit. Then: `on: schedule` (hourly, at a minute other than :00) and `workflow_dispatch`; `permissions: {}`; `concurrency` with no cancel; one job, 5 minutes, the same three keys and two checksum settings in the step's `env`. It lists the bucket with `aws s3api list-objects-v2 --output json` and picks the keys with one `jq` filter that compares strings, `.Contents // [] | .[] | select(.LastModified[0:19] < $cutoff) | .Key`, where `cutoff=$(date -u -d '3 hours ago' +%Y-%m-%dT%H:%M:%S)`. (The AWS command line prints `LastModified` as `…+00:00`, which `jq`'s date functions reject, and an empty bucket's listing has no `Contents`.) It deletes them with `aws s3 rm`, and prints each key and the count. No key: it fails, since on `main` a missing key means the upload has stopped too. An empty bucket passes.
- [ ] **Step 3:** `this-repo`, CI: one bullet saying the browser pieces send their report to R2, where the link is, that it lasts 3 hours, how to download it, that no copy goes to GitHub, this repository or the project's files, that the screens page holds its pictures only until the Owner has looked and is then deleted, and that a session whose link has run out reshoots.
- [ ] **Step 4:** push as a draft (the first quick run); check A5 if the Owner's steps are not done, then A3, A4 and A8 once they are. Every commit that touches `.github/workflows/` quotes the Owner's 2026-11-20 words in its message. Before the hand-off to the audit, run the sweep's `jq` filter in the container on three saved sample listings (old and new mixed with `+00:00` times, all new, and an empty listing with no `Contents`) and paste the output in the pull request: it prints exactly the old keys, nothing, and nothing. The samples stay out of the repo. The pull request body quotes the Owner's words, names the removed step and why, and lists its commits (`release`).
- [ ] **Step 5:** hand the branch to the implementation audit by its commit; fix its findings; the Owner's OK; merge. A6 and A9 run after the merge, recorded in `progress.md`.

### Task 3: T, the workflow test (after C merges)

- [ ] **Step 1:** write `tests/workflows.test.ts`: read every `.github/workflows/*.yml` as text (the repo has no YAML parser, and adding one is a new dependency), find each step that `uses: actions/upload-artifact`, and fail when its `path` names `playwright-report`, `test-results` or `.png`, naming the file and the step. Run it against `ci.yml` from before C (`git show <C's parent>:.github/workflows/ci.yml` into a temporary folder the test can be pointed at); it fails (A1). On `main` it passes.
- [ ] **Step 2:** `pnpm lint`, `pnpm typecheck`, `pnpm test`. Push; it merges on green.

## 5. Undoing it

Revert C's pull request: the old artifact step returns and nothing else changes. The bucket, its rule and the keys can stay or go: `npx wrangler r2 bucket delete ruken-ci-screenshots` after emptying it, and delete the token on the same page as O3. With C reverted, T fails until it is reverted too, which is the point.

## 6. Risks, and what is not checked

- **Old artifacts stay until they expire** (7 days). Deleting them sooner can't be undone, so it is the Owner's own optional command in the Owner's file, not part of C.
- **A link runs out during a long review.** A session that needs a report after its link has run out reruns the piece's journeys; nothing keeps an older copy, by the Owner's rule.
- **The backup is slow.** R2's lifecycle rules act within about a day of an object's expiry, so if the sweep stops, an object can stay up to about 2 days.
- **GitHub turns off scheduled workflows** in a public repository after 60 days with no commits. The 1-day rule still empties the bucket.
- **Follow-up, not in this change: the `screenshots` label.** `release` says screenshots are taken "with no label needed", while `ci.yml` still reads the label on a draft (plan audit N9, R4). The label is also the only way to add screenshots to a draft whose changed files do not match the visual pattern, such as a `src/features/` change to a screen's words. Reported to the coordinator for its own change.
- **The quick run does not reach T's test.** It reads files as text, so `vitest --changed` cannot see a workflow edit reach it; a draft runs it only once marked ready, and the full run and `gate` still do. Adding it to the quick run's always-run line is a `ci.yml` change, so it waits for the next workflow pull request after T.
- **Not checked, and said so:** that the AWS command line stays on GitHub's Ubuntu image (A3 fails loudly if it goes); R2's free allowance at the date of reading (the Owner's Cloudflare bill shows it).
- **Duration:** the Owner's steps about ten minutes; C under an hour plus CI and the audit; A6 needs a 3-hour wait after A3; T under half an hour.

