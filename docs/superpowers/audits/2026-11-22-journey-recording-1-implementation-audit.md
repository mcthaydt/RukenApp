# Journey recording (#315), implementation audit 1

Reviewed commit: `ebb549c` (branch `claude/project-thread-8e4lco`; the coordinator named `2a7b22f`, and two commits came after it: `f4649ce` edits `tests/browser/loading.test.ts`, `ebb549c` removes the live state). Base: `main` at `6410353`.
Lane 2 (`playwright.config.ts`). Reviewer: Opus 5.5, medium, a fresh session. Brief: the pull request body's five acceptance criteria.

**Verdict: FAIL, 2 red.** The setting is right and does what the body says; the pull request is not finished: its body no longer matches its diff, and the cost criterion is not yet measured.

## What was checked

| Check | Result | Evidence |
|---|---|---|
| Criterion 1: `tests/journey-recording.test.ts` fails on `6410353`'s config, passes on the branch | PASS | `vitest run tests/journey-recording.test.ts` with `playwright.config.ts` from `6410353`: 1 failed; at `ebb549c`: 1 passed. |
| Criterion 2: Playwright records the network only with page snapshots | PASS | Playwright 1.63.0 source: `coreBundle.js` starts the HAR tracer only `if (options.snapshotDom)`, and `Tracing.start` maps `snapshots` to `snapshotDom`. A throwaway run here (a server that never answers a POST): with the PR's settings each `trace.zip` held the POST with status -1 (sent, no answer); with `snapshots: false` the network files were 0 bytes. |
| A sign-up made in `beforeAll` on its own `browser.newContext()` (as `adults-only.test.ts:30`, one of the three stalls) is recorded | PASS | Same throwaway run: a `beforeAll` that posts from its own context and fails left a `trace.zip` on the first test, with the unanswered POST in its network. A context made inside the test body, and the `page` fixture, were recorded too. |
| CI keeps the recording | PASS | `.github/workflows/ci.yml:526-532`: `playwright-report/` is uploaded `if: always()`; the html reporter carries each failed test's trace. |
| Criterion 4: lint and typecheck | PASS | `pnpm typecheck` exit 0 (0 errors); `eslint` on the three changed code files exit 0. |
| Criterion 3: full run passes, shard times close to #314's | NOT MET at `ebb549c` | Only the quick draft run has run (run 45009125642, in progress at 09:53 UTC). See red 2. |
| Criterion 5: only three files change | FAIL | The diff now has four: `tests/browser/loading.test.ts` too. See red 1. |

## Red findings

### 1. The body does not name the edited journey, and criterion 5 is stale

UNIT: pull request #315 body. VERDICT: red. REQUIREMENT: `review` skill: "A pull request that changes or deletes an existing test ... names each one and why in its body"; criterion 5 of the brief. REASON: `f4649ce` changes `tests/browser/loading.test.ts:64` (a read of the held post's count becomes `expect.poll`), and the body neither names it nor lists the file; criterion 5 still says three files. EVIDENCE: `git diff 6410353 ebb549c --stat` lists 4 files; the body at 09:53 UTC lists 3 and does not mention `loading.test.ts`. EXPECTED: the body names `loading.test.ts:27`'s change and why (the page's console words and the held route's count arrive as separate messages; the recording slowed the browser enough to show it), and criterion 5 lists the four files. FIX: edit the PR body only.

### 2. The cost of recording every journey is not yet measured

UNIT: `playwright.config.ts` (`use.trace`). VERDICT: red. REQUIREMENT: criterion 3; the coordinator's brief asked to weigh the CPU and time cost. REASON: `retain-on-failure` records every journey and throws passing ones away, so every journey pays for DOM snapshots and network capture, and there are signs the cost is not small. EVIDENCE: (a) a throwaway run here, 40 passing tests of 5 page loads and form posts each, 2 workers on 4 cores, Chromium: trace off 29.2 s, 30.5 s, 31.3 s; the PR's setting 41.1 s, 41.8 s, 42.9 s, about 37% longer. This page is DOM-heavy and has no server work, so it is a worst case, not a forecast for the journeys, which spend much of their time waiting on `wrangler dev`. (b) The PR's own first run turned up a new race in `loading.test.ts` because the recording slowed the browser. The three stalls being chased happen on the same busy runner, so more load there could also make them likelier or change their shape. EXPECTED: the full browser run passes in CI at the final head, and the body records each shard's time beside #314's last full run, with the per-shard difference. FIX: run the full CI (mark ready, or however the release skill runs the full run) and record the times in the body; files: the PR body only. If the shards are materially slower (the builder's call against the 15-second waits), the cheaper choice to weigh is turning the recording on only for the reruns that already happen by hand, not dropping snapshots, since without them there is no network.

## Notes (not blocking)

- `loading.test.ts:64`'s `expect.poll(...).toBe(1)` passes the moment the count reaches 1, so a late second post would not be caught; the line before it, which it replaced, would not have caught one either, and "second press stopped=true" already shows the second press was prevented. No change asked.
- The comment in `tests/journey-recording.test.ts` and `playwright.config.ts` repeats the same paragraph; fine as is.
