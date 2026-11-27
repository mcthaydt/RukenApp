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
counts as passed, so CI goes green and the deploy runs; it is listed as flaky in the run's summary, with a line ready
to paste under "Flaky tests" in `progress.md`. A journey that fails all 3 tries fails CI as today, and nothing deploys.
Pull request runs (draft and full) and sessions keep the strict rule: no retries.

Lint, typecheck, unit tests, the Postgres tests, the pieces-ran-every-journey check and `pr-rules` stay as they are.
`deploy.yml` does not change: it deploys only a green CI run on `main`, then runs the live check (which `/healthz/feed`
joins when #411 merges, with no change here).

## 3. Lane

Lane 3: `.github/workflows/ci.yml`, the rule hooks (`.claude/hooks/`), and the shared `build` and `release` skills and
`CLAUDE.md` Settings, which decide what passes. Plan audit and implementation audit, green CI, and the owner's approval
to merge (the card above approves the direction; the merge still needs the owner's word or a standing permission).

## 4. Design

1. **The setting lives in Settings.** `CLAUDE.md` Settings gains: "Retries on main: 2, for the browser journeys on a
   push to `main` only." `ci.yml` uses that number; a unit test fails when the two differ.
2. **ci.yml.** "Run the journeys" passes `--retries=${{ github.event_name == 'push' && 2 || 0 }}`. Nothing else in the
   pieces changes: Playwright's run passes when every test passed or was flaky (Playwright 1.63
   `lib/runner/index.js`, `result()`: failed only on failed tests, worker errors, max failures, or `failOnFlakyTests`,
   which stays off). Drafts' `--max-failures=1` is a draft-only argument, so it never meets a retry.
3. **The report.** A new script, `.github/scripts/flaky-tests.js <report.json>...`, reads Playwright JSON reports and
   prints a Markdown section listing each test whose status is `flaky`: device, `file:line`, title, and the try it
   passed on. With none it prints that no test needed a retry. It never fails for flakes; it fails only on an
   unreadable report. On a push run the `gate` job downloads the pieces' `ran-*` artifacts (they already hold each
   piece's `report.json`), runs the script into `$GITHUB_STEP_SUMMARY`, and prints one `::warning::` per flaky test, so
   it shows on the run's page. The step runs with `always()` and reports; it never decides the gate. Sessions copy the
   lines into `progress.md` "Flaky tests"; CI cannot write to `main`.
4. **The hook.** `bypassFlags` keeps refusing retries on the command line and in config files, with one exception named
   in `rules.json`: `bypassFlags.allowedLines`, a list of `{ file, line }` pairs whose exact added line may pass. Its one
   entry is the ci.yml line above. The hook also closes a gap found here: a `--retries=` value that is not a plain
   number (an expression such as `${{ ... }}`) was not caught; now any non-`0` value is refused unless allowed.
5. **The rules text.** `build` (Quick and steady) and `release` (Never hide a failure) say: main's browser journeys
   retry a failed test up to the number in Settings so a flake does not hold the deploy; a pass on a retry is still a
   defect, recorded under "Flaky tests" and fixed at its cause in its own thread; pull request runs and sessions never
   retry.
6. **progress.md.** The owner's two instructions above go under "The owner's instructions".

Test times: `TEST_TIMES` sums every result, so a flaky test's retries add to its file's time on that run. That only
nudges the next split; left as it is.

## 5. Acceptance criteria

- C1. `ci.yml` "Run the journeys" carries exactly `--retries=${{ github.event_name == 'push' && N || 0 }}` with N the
  Settings number, and no other job or step passes a retry (unit test reading `ci.yml` and `CLAUDE.md`).
- C2. A pull request run passes 0 retries: the expression gives 0 for `pull_request` events (same test).
- C3. `flaky-tests.js` lists every `flaky` test in one or more reports with device, `file:line`, title and passing try;
  lists no `expected`, `unexpected` or `skipped` test; says so when there are none; exits 0 for flakes and non-zero on
  an unreadable report (unit tests with built reports).
- C4. The `gate` job, on push runs only, runs the script with `always()`, writes to the job summary and a warning per
  flaky test, and the gate's pass/fail still comes from "Every check passed" alone (unit test reading `ci.yml`).
- C5. `deploy.yml` is unchanged (`git diff` shows nothing; the existing `deploy-workflow.test.ts` passes).
- C6. The hook: refuses `playwright test --retries=2` on the command line; refuses a write adding `retries: 2` to
  `playwright.config.ts`; refuses a write adding `--retries=${{ x }}` or `--retries=3` to a workflow; allows the write
  adding exactly the C1 line to `ci.yml`, and only to `ci.yml` (unit tests running the real hook on a scratch copy).
- C7. `build` and `release` carry the new rule text; `CLAUDE.md` Settings has the number.
- C8. Lint, typecheck, unit tests and the full CI run are green on the pull request.
- C9. After merge, the first push run on `main` shows the summary section (with "no test needed a retry" or a list).
  This can only be checked after the merge; it is reported then.

## 6. Plan

| Unit | Files | Check |
|---|---|---|
| 1. Hook allowance and gap | `.claude/hooks/rules.mjs`, `.claude/hooks/rules.json`, `tests/rules-bypass-flags.test.ts` | C6 |
| 2. Report script | `.github/scripts/flaky-tests.js`, `tests/flaky-tests.test.ts` | C3 |
| 3. CI | `.github/workflows/ci.yml`, `tests/ci-retries.test.ts` | C1, C2, C4, C5 |
| 4. Rules text | `CLAUDE.md`, `.claude/skills/build/SKILL.md`, `.claude/skills/release/SKILL.md` | C7 |
| 5. Records | `docs/superpowers/progress.md` | owner's words recorded |

In order, one branch, one pull request. Unit 1 comes first, since the hook refuses unit 3's line until it is allowed.

Boundaries: no new dependency, tool, environment or spend. Expected duration: about 2 hours of work, plus the audits.

## 7. Open decisions

None. A literal percentage pass mark is not built; the owner chose retries.
