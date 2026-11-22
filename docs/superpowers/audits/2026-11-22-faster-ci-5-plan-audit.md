# Faster CI spec, section 3.4 item 2 (lookup retry): plan audit 5

- Examined: 127d16b (draft PR #311 head). Its only change from `main` (06cf793) is two bullets of spec 3.4 item 2 in `docs/superpowers/specs/2026-11-22-faster-ci-design.md` (commit cbe211e; the live-state file was added and removed).
- Lane 3 plan audit, for the follow-up N7 in `2026-11-22-faster-ci-f-1-implementation-audit.md`. Reviewer: Opus 5.5, medium. Written 2026-11-22 07:08 UTC.
- Verdict: **FAIL, 1 red, 2 notes.** The red is spec text.

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## The question asked: does one piece failing three times still turn the run red?

Yes, and the amended spec now says so. A piece whose lookup still fails after three tries splits by count and writes "none: split by count", while the other five read times. The gate's key check sees two different keys and fails the run, naming the piece. No journey is lost, and the run is recorded under "Flaky tests". That outcome is what the spec intends. The retry only makes it rarer.

The retry cannot cause a new mismatch. The set a piece picks from is fixed by the run's `created_at` minus 2 minutes, so a try that succeeds 2 s or 5 s later returns the same answer as one that succeeded at once. The 2-minute margin is much longer than the 7 s of waits, and an answer arriving late cannot add an entry the cut-off already excluded.

The old bullet, that every failure path hits all six alike, is now correctly limited to an empty set and a restore miss.

## Red

**R1.** UNIT: spec 3.4 item 2, the new retry bullet. VERDICT: red. REQUIREMENT: the follow-up it implements (implementation audit F-1, N7: "three tries with a short wait … plus a timeout on each `fetch`"), and the plan's own claim that a failed lookup is retried. REASON: the spec retries only a call that "fails to connect or answers 429 or 5xx". It sets no time limit on a try, and it does not say whether a call that connects and then hangs, or is cut off mid-answer, counts as a failure. EVIDENCE: Node's `fetch` has no default time limit that would end such a call soon. Run locally against a server that accepts the connection and never answers, `fetch` was "still waiting after 20 s". undici's default header time-out is 300 s, so one hung try waits about 5 minutes, and three tries about 15, inside the piece's 45-minute limit. With `{ signal: AbortSignal.timeout(2000) }` the same call "threw TimeoutError after 2 s". A builder following the text literally would also not retry a reset connection, because it did connect. EXPECTED: the spec says that every try has a time limit (for example `AbortSignal.timeout(10000)`), and that any thrown `fetch` error counts as a failure to retry: a failed connection, a reset, or that time-out. It also names the worst-case added wait, 3 × 10 s + 2 s + 5 s = 37 s per call. FIX: spec text in that one bullet. File: `docs/superpowers/specs/2026-11-22-faster-ci-design.md`.

## Notes (not blocking)

- **N10. 403 with `retry-after`.** GitHub's secondary rate limit can answer 403, not 429, with a `retry-after` header. The spec does not retry it, so that piece splits by count and the key check names it. Six pieces make 12 calls per run, far below any limit, so this is unlikely. If it ever shows under "Flaky tests", a 403 carrying `retry-after` can join the retry list.
- **N11. The log line.** Each try that fails should log its reason and the try number ("try 2 of 3: answered 503"). Then a key-check failure points straight at the cause in that piece's log. This is in the spirit of "the key check names the piece".

## Checked and fine

- It is docs only, and the change stays inside the budget: no new action, tool or secret.
- "This retries the network, not a test" holds. The tries are API calls before any journey runs, and the Flaky-tests rule still applies to the key check's failure.
