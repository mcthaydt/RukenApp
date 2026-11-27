# Retry flaky browser tests on main, so a flake does not hold the deploy

## 1. The owner's words

- 2026-11-27 06:29 UTC: "Can we make it where main only needs 97% of green to pass"
- 2026-11-27 07:18 UTC, on a card, "Yes, retry on main (recommended)" to "Change the 'no passing on a retry' rule so main
  can deploy past a flaky test?". The option read: "Main's browser tests get up to 2 more tries. A pass on a retry
  deploys and is listed as flaky. Pull requests keep the strict rule." The other options were a 97% pass mark (2,496
  browser tests, so up to 74 real failures could ship) and keeping the rule.

The night before, three flakes each held a deploy and each passed on a rerun: `real-buttons.test.ts:201` [phone], a
help-page scrollbar test [phone] and a cookie test [tablet].

## 2. Outcome

On a push to `main`, a browser journey that fails is tried up to 2 more times. A journey that passes on a later try
counts as passed, so CI goes green and the deploy runs; it is listed as flaky in the run's summary. A journey that
fails all 3 tries fails CI as today, and nothing deploys. Pull request runs (draft and full) and sessions keep the
strict rule: no retries.

Lint, typecheck, unit tests, the Postgres tests, the pieces-ran-every-journey check and `pr-rules` stay as they are.
`deploy.yml` does not change: it deploys only a green CI run on `main`, then runs the live check (which `/healthz/feed`
joins when #411 merges, with no change here).

## 3. Lane

Lane 3: the rule hooks (`.claude/hooks/`), `.github/workflows/ci.yml`, `CLAUDE.md` and the shared `build` and
`release` skills, which decide what passes. Each lane 3 pull request below gets this plan audit, an implementation
audit, green CI, and the owner's word to merge (the 07:18 UTC card approves the direction, not the merges).

## 4. Design

1. **The number lives in Settings.** `CLAUDE.md` Settings gains: "Retries on main: 2, for the browser journeys on a
   push to `main` only. Pull request runs and sessions: 0." `ci.yml` and the hook's allowed line carry the same number;
   the sync test (pull request C) reads all three and fails when they differ.
2. **ci.yml.** "Run the journeys" passes
   `--retries=${{ github.event_name == 'push' && github.ref == 'refs/heads/main' && 2 || 0 }}`. Its `run:` line, as
   written in `ci.yml` (8 spaces of indent), is byte for byte:

   ```
           run: pnpm test:browser ${{ steps.pick.outputs.args }} --reporter=list,html,json --retries=${{ github.event_name == 'push' && github.ref == 'refs/heads/main' && 2 || 0 }}
   ```

   (The block sits inside this list item, so it shows 3 more spaces; `ci.yml` line 480 today starts with exactly 8.)
   Trimmed (the form `allowedLines` holds, 4.4), it is that line with no leading or trailing spaces. The `github.ref` term
   keeps it to `main` even if `on.push.branches` is widened later. Nothing else in the pieces changes: Playwright's run
   passes when every test passed or was flaky (Playwright 1.63 `lib/runner/index.js:6287-6290`, `result()`: failed
   only on a failed test, worker errors, max failures, or `failOnFlakyTests`, which stays off). Drafts'
   `--max-failures=1` is added only when `CHANGED_ONLY` is true, which a push never is.
3. **The report.** A new script, `.github/scripts/flaky-tests.js <folder> <pieces>`, reads the Playwright JSON
   reports at `<folder>/ran-<n>/playwright-json/report.json` for every n from 1 to `<pieces>`, and prints a Markdown section listing each test whose status is `flaky`: device, `file:line`, title, and the try it
   passed on (the count of its results), and one `::warning::` line per flaky test. With none it prints "No test
   needed a retry." It exits 0 whatever the tests did. It exits 1, naming each piece by number, when any of the
   `<pieces>` reports is missing, unreadable, or not a Playwright JSON report (no `suites` array); and when
   `<pieces>` is not a whole number of 1 or more. It counts the reports itself, so no wildcard decides how many were
   read.
   In `gate`, a new last step "List the tests that passed only on a retry" runs with
   `if: always() && github.event_name == 'push'`. It downloads on its own (the `ran-*` artifacts into its own folder,
   `flaky-reports`), since the existing download sits in a step that is skipped once an earlier step fails. It runs
   `node .github/scripts/flaky-tests.js flaky-reports 6`, appends the Markdown to `$GITHUB_STEP_SUMMARY`, and prints
   the warnings. **The rule:** a flaky test never fails the gate; a missing or unreadable report from any of the 6
   pieces on a push run does, naming the piece, since otherwise a flaky pass could deploy unlisted. The other gate steps ("Every check passed", "The pieces ran every journey exactly once") are unchanged.
4. **The hook.** Two changes in `checkBypassFlags` and `checkFileWrite` (`.claude/hooks/rules.mjs`):
   - Command line: for a test runner, any `--retries`/`--retry` value other than a plain `0` is refused, so
     `--retries=$N`, `--retries ${R}` and `--retries=2` are all refused and `--retries=0` passes. Today only numbers
     over 0 are refused.
   - File writes: any added `--retries`/`--retry` value other than a plain `0` is refused in a config file (today an
     expression such as `${{ ... }}` passes), with one exception: `rules.json` `bypassFlags.allowedLines`, a list of
     `{ "file", "line" }`. An added line is let through only when its repo-relative path equals `file` exactly and the
     whole line, trimmed, equals `line` exactly. The exception lifts only the retries refusal (a `passWithNoTests` on
     the same line is still refused). The list holds exactly one entry: `.github/workflows/ci.yml` and the trimmed
     `run:` line of 4.2, character for character (it starts `run: pnpm test:browser` and ends `&& 2 || 0 }}`).
5. **The rules text.** `CLAUDE.md` Verification, `build` (Quick and steady) and `release` (Never hide a failure) say
   the same thing, and each keeps "one rerun to diagnose" and "a pass on retry is a defect": main's browser journeys
   retry a failed test up to the number in Settings, so a flake does not hold the deploy; a pass on a retry is still a
   defect, recorded under "Flaky tests" and fixed at its cause in its own thread; pull request runs and sessions never
   retry. `release` also names who logs them: **the session that merges** reads the gate summary of `main`'s run after
   its merge (it already watches that run), records each flaky line under "Flaky tests" in `progress.md` in its next
   pull request, and reports them to the coordinator.
6. **progress.md.** The owner's two instructions above go under "The owner's instructions".

Test times: `TEST_TIMES` sums every result, so a flaky test's retries add to its file's time on that run. That only
nudges the next split; left as it is.

## 5. Acceptance criteria

Pull request A (hook and script):

- A1. `flaky-tests.js` lists every `flaky` test across the pieces' reports with device, `file:line`, title and passing
  try, with one `::warning::` each; lists no `expected`, `unexpected` or `skipped` test; prints "No test needed a
  retry." when there are none; exits 0 with flaky and failed tests in 6 of 6 reports. It exits 1 and names the piece
  when, of 6, piece 4's report is missing, piece 2's is bad JSON, or piece 5's has no `suites`; it exits 1 when the
  pieces argument is missing, `0` or not a number (`tests/flaky-tests.test.ts`, built reports in a scratch folder).
- A5. `allowedLines`' one entry is, character for character, the trimmed line written out in 4.2 (the same test reads
  this spec's fenced line and compares).
- A2. The hook on the command line refuses `pnpm exec playwright test --retries=2`, `pnpm test:browser --retries=$N`
  and `pnpm exec playwright test --retries ${R}`, and allows `pnpm exec playwright test --retries=0`
  (`tests/rules-bypass-flags.test.ts`, the real hook on a scratch copy).
- A3. The hook on file writes refuses: `retries: 2` added to `playwright.config.ts`; `--retries=3` and
  `--retries=${{ vars.R }}` added to a workflow; the allowed line with extra text after it; the allowed line in its
  space form (`--retries ${{ ... }}`); the allowed line in `.github/workflows/deploy.yml`. It allows the allowed line,
  indented, added to `.github/workflows/ci.yml` (same test).
- A4. `rules.json` `bypassFlags.allowedLines` has exactly one entry, with that file and that line (same test).

Pull request B (the rule, after A merges):

- B1. `ci.yml` "Run the journeys" carries the 4.2 line byte for byte (A's hook refuses any other form); the gate's new step is as 4.3 says; no other step passes a
  retry. `deploy.yml` is unchanged (`git diff main -- .github/workflows/deploy.yml` is empty; `deploy-workflow.test.ts`
  passes).
- B2. `CLAUDE.md` Settings and Verification, `build` and `release` carry the 4.1 and 4.5 text; `progress.md` has the
  owner's words.
- B3. The full CI run is green on the pull request (pull request runs give 0 retries, so this also shows the strict
  path is unchanged). Its implementation audit checks B1 and B2 by reading, since pull request C's test lands after it.

Pull request C (the sync test, after B merges):

- C1. `tests/ci-retries.test.ts`: the `ci.yml` line equals the `allowedLines` entry; its number equals the Settings
  number; the expression holds both `github.event_name == 'push'` and `github.ref == 'refs/heads/main'` and ends in
  `|| 0`; `on` has only `pull_request` and `push`, and `on.push.branches` is exactly `[main]`; no other step in any
  workflow passes `--retries` or `--retry`.
- C2. The gate step runs with `always()` and `github.event_name == 'push'`, downloads into its own folder, runs
  `flaky-tests.js flaky-reports 6` with the pieces number equal to the `browser-shard` matrix's count, and appends to
  `$GITHUB_STEP_SUMMARY` (same test).
- C3. After B merges, the first push run on `main` shows the summary section ("No test needed a retry." or a list).
  Reported by the session that merges B.

Every pull request: lint, typecheck and unit tests green, and the full CI run green.

## 6. Plan

The `ruleMix` hook refuses a branch that mixes rules files (`ci.yml`, `CLAUDE.md`, the shared skills) with tests or
scripts, so the work is three pull requests, in order. Each starts from a `main` that holds the one before it.

| PR | Files | Lane | Checks | Waits on |
|---|---|---|---|---|
| A. Hook and report script | this spec, `.claude/hooks/rules.mjs`, `.claude/hooks/rules.json`, `.github/scripts/flaky-tests.js`, `tests/rules-bypass-flags.test.ts`, `tests/flaky-tests.test.ts` | 3 (hooks) | A1 to A5; implementation audit; owner's word | this plan audit |
| B. The rule | `.github/workflows/ci.yml`, `CLAUDE.md`, `.claude/skills/build/SKILL.md`, `.claude/skills/release/SKILL.md`, `docs/superpowers/progress.md` | 3 (CI, rules) | B1 to B3; implementation audit; owner's word | A on `main` (its hook lets the `ci.yml` line through; its script is what the step runs) |
| C. The sync test | `tests/ci-retries.test.ts` | 1 (a test) | C1, C2 green; C3 after | B on `main` (the test reads B's files) |

PR A is this pull request (#415); the spec rides with it. Between A and B, `main` has a hook that allows a line no
workflow carries yet and a script nothing runs; both are harmless.

Boundaries: no new dependency, tool, environment or spend. Expected duration: about 3 hours of work in all (A about
1.5, B about 1, C about 0.5), plus two implementation audits and the owner's two merge words.

## 7. Open decisions

None. A literal percentage pass mark is not built; the owner chose retries.
