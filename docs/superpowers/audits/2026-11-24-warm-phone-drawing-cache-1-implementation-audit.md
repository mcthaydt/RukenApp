**7bfb122 PASS**

# Warm Safari's drawing cache before the journeys: lane 2 review, round 1

- Commit examined: `7bfb122` on `claude/project-thread-5s8ts7` (PR #377, base `f3af84d`, main). The diff against main is 3 files: `playwright.config.ts` (+3), `tests/browser/support/warm-webkit.ts` (new, 37 lines), `docs/superpowers/progress.md` (+1 under Flaky tests).
- Reviewer: a fresh session, Opus 5.5, medium. Lane 2 (`playwright.config.ts`, shared test support).
- Brief: the PR body's four acceptance criteria, plus the coordinator's three asks: verify the cause independently, check the fix cannot hide real app slowness, check it adds no meaningful CI time.

## Verdict

PASS, no red findings. The cause is real and I reproduced it myself; the warm-up removes it; it cannot hide app slowness that a real phone would see; it costs about 3 to 4.5 s per CI piece, once, before the workers start.

## What ran, at 7bfb122

All runs in Playwright's own image `mcr.microsoft.com/playwright:v1.63.0-noble` (the one `ci.yml` pins), against the real site (`pnpm test:browser`, all web servers, Postgres 16), with a new empty `$HOME` per run, so Mesa's shader cache started empty each time.

| Check | Result |
| --- | --- |
| `eslint` and `prettier --check` on the 3 changed files | exit 0 |
| CI quick run on the PR head (run 45299571821) | all 6 browser pieces, verify, postgres and gate green |
| First frame of the real `/sign-up`, two cold WebKit browsers at once, 1.5 CPUs (my own global setup, probe below) | 2406 ms and 2492 ms; a third browser afterwards: 101 ms |
| `attach-phone.test.ts:15` + `look-layout.test.ts:45`, `:56`, phone, 2 workers, warm-up removed, 1.5 CPUs | 4 of 4 passed (the stall did not reach 5 s on this machine) |
| Same, warm-up removed, 1 CPU | 4 of 4 failed, at `support/account.ts:116`, "waiting for element to be visible, enabled and stable", the same call log as CI |
| Same, with the PR's warm-up, 1 CPU | 6 of 6 passed (a seventh run is not counted: my own overlapping container edited the shared config under it) |
| Same, with the warm-up, 1.5 CPUs | 3 of 3 passed |
| Time the PR's `warmWebKit` took, cold | 1.5 CPUs: 3193, 3177, 3138 ms. 1 CPU: 3718, 4391, 3731, 3499, 3451, 4554 ms |

## The three asks

### 1. The cause, checked independently

- The mechanism: after a cold run, `$HOME/.cache/mesa_shader_cache` exists; it did not before. A fresh WebKit process started after it drew `/sign-up` in 101 ms against about 2.4 s cold, so the cache is on disk and shared by every browser process on the machine, which is what a global setup needs.
- The numbers match the PR body (2448 and 2540 ms there, 2406 and 2492 ms here).
- The failure itself: the PR reproduced it on 1.5 CPUs; on this host it needed 1 CPU, then came back every time (4 of 4) with CI's exact error, and the warm-up made it pass every time (6 of 6). That is the "fails without, passes with" pair, on a second machine.
- CI evidence fits: on main's failing job 138115961152 the failed press was `help-guide.test.ts:36`, the second journey to start on a fresh piece, while the other worker drew its first sign-up page at the same moment. Its call log never got to "element is not stable", so Playwright saw no frame at all in 5 s.
- Order of setup, read in Playwright 1.63's runner (`lib/runner/index.js`, `createGlobalSetupTasks`): web servers (plugin setup) start before `globalSetup`, so `/sign-up` is up when the warm-up opens it.

### 2. Can it hide real app slowness? No

- It warms one thing: the CI machine's software-renderer shader cache on disk. A real phone draws with its own GPU and keeps its own caches, so this cold cost exists only on CI's CPU renderer.
- It shares no browser state with the journeys: its own browser, closed before any worker starts.
- Its one request to `/sign-up` reaches a server the web server check has already called; it warms no app data a journey relies on.
- Every journey still loads its own pages under the same 5 s action and 15 s expect limits, so a slow page, a slow answer or a slow script still fails as before.
- If the site cannot draw at all, the setup fails the whole run loudly after 60 s with "warm-webkit: no frame drawn", instead of passing quietly.

### 3. CI time

- About 3.1 to 3.2 s per piece on 1.5 CPUs, 3.5 to 4.6 s on 1 CPU, measured above. Pieces run side by side, so the wall time of the whole run grows by that once, against 9 to 12 min per piece in run 45299571821: under 1%.
- The first phone journeys of each piece no longer pay about 2.4 s each themselves, so the net cost is smaller still.
- `playwright test --list` (the pick step in `ci.yml`) does not run global setups, so the listing step costs nothing extra.

## Acceptance criteria

1. Fails without the change, empty cache, 2 workers: met (PR: 3 of 3 at 1.5 CPUs; here: 4 of 4 at 1 CPU).
2. Passes with it: met (PR: 5 of 5; here: 6 of 6 at 1 CPU, 3 of 3 at 1.5 CPUs).
3. Lint and typecheck: met (lint here; CI verify green at `7bfb122`).
4. Full CI green: not yet. Only the quick draft run has run. It runs when the PR is marked ready, which follows this PASS. Not a finding on the code.

## CRUD

The change adds nothing a user can make. Not applicable.

## Notes (not blocking, not fixed here)

- UNIT: `tests/browser/support/warm-webkit.ts`. VERDICT: note. REASON: the setup launches WebKit on every run, even one that runs only `--project=tablet` or `--project=computer`. EVIDENCE: no project check before `webkit.launch()`. EXPECTED: harmless in CI (the image has every browser); a machine without WebKit installed could not run even a Chrome-only run. FIX if ever wanted: skip when no selected project uses WebKit. Nobody runs the journeys outside the CI image today, so nothing to do now.
- UNIT: same file. VERDICT: note. REASON: it warms the shaders `/sign-up` needs. Another page with different effects (feed glass, video) may still compile some shaders on first draw. EVIDENCE: the PR measured 56 to 80 ms on `/` and `/about` after warming `/sign-up`; I did not measure the feed. EXPECTED: fine today. If a cold first press stalls again on a different first page, warm that page here too.
- UNIT: same file. VERDICT: note. REASON: the 60 s `setTimeout` in the page is never cleared. Harmless: the browser is closed right after.

## Probes

The probe runner and the global setups used for the timings are in the project files, `audits/2026-11-24-warm-phone-drawing-cache-1-probe-*.txt`. They change nothing in the repo; they swap `globalSetup` in a scratch worktree and put it back.
