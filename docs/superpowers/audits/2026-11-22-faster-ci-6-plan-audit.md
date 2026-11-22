# Faster CI spec, section 3.4 item 2 (lookup retry): plan audit 6

- Examined: 2bd2307 (draft PR #311 head). The change since audit 5 (485f150) is commit 9a2c489, one bullet of spec 3.4 item 2 in `docs/superpowers/specs/2026-11-22-faster-ci-design.md`.
- Lane 3 plan audit, recheck of `2026-11-22-faster-ci-5-plan-audit.md`. Reviewer: Opus 5.5, medium. Written 2026-11-22 07:10 UTC.
- Verdict: **PASS, 0 red.**

## R1: fixed

- Every try has a 10 s limit (`AbortSignal.timeout(10000)`). Audit 5's local run showed that this limit ends a call to a server that never answers with a `TimeoutError` (after 2 s at a 2000 ms limit).
- A try is retried when `fetch` throws for any reason (no connection, a reset, or the time-out) and when it answers 429 or 5xx. Each failed try logs "try N of 3: <reason>", which also covers audit 5's N11.
- The worst case is stated: 3 × 10 s + 2 s + 5 s = 37 s per call, two calls a piece, inside the piece's 45-minute limit.

## The correction to audit 5

Audit 5 said "No journey is lost" for a run where one piece split by count while the others used times. The spec's new wording is more exact, and right. With two splits mixed, some journeys may run twice and others not at all. The run is red (the key check fails, naming the piece), and a red run cannot merge, so no journey is skipped unseen. I accept the correction.

## Checked and fine

- Any other answer (for example 403 or 404) splits that piece by count at once, and the key check names it. That is consistent with the rest of item 2. Leaving out audit 5's N10 (a 403 with `retry-after`) is acceptable at 12 calls a run.
- A retry cannot change the answer, because the set is fixed by the run's `created_at` minus 2 minutes, and 37 s of tries is far inside that margin.
- It is docs only, within the budget: no new action, tool or secret.
