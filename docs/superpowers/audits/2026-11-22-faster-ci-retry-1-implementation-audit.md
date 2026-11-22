# Implementation audit 1: lookup retry (spec 3.4 item 2), PR #312

- Examined: 700db9a (head of `claude/project-thread-g0gcfn`), diff against `main` cb3b3dc: `.github/workflows/ci.yml` only, +23 / -5, the `get()` helper in "Choose main's test times".
- Against: `docs/superpowers/specs/2026-11-22-faster-ci-design.md` 3.4 item 2 (plan audit 6 PASS at 2bd2307).
- Auditor: Opus 5.5, medium. Started 2026-11-22 07:43 UTC.
- Verdict: **PASS**, 0 red, 3 notes.

## Spec item by item

| Spec 3.4 item 2 says | Code at 700db9a | Result |
| --- | --- | --- |
| Each of the two calls tried up to 3 times | `for (tried = 1; ; tried++)`, throws at `tried === 3` | PASS, bounded at 3 |
| 2 s then 5 s apart | `waits = [2000, 5000]`, `waits[tried - 1]` only for tries 1 and 2 | PASS |
| 10 s per try, `AbortSignal.timeout(10000)` | `signal: AbortSignal.timeout(10_000)`; the body read is inside the same try, so it is covered too | PASS |
| Retry when `fetch` throws (connect, reset, time-out) | every throw except the `final` one is retried | PASS |
| Retry on 429 and 5xx; any other answer splits at once | `status !== 429 && status < 500` throws `final` | PASS |
| Log number and reason, e.g. "try 2 of 3: answered 503" | `${path}: try N of 3: <reason>` | PASS |
| Worst case 37 s per call | measured 37.0 s (run call) and 37.1 s (list call), see below | PASS |
| Third failure splits by count | outer `catch` logs, `key=` stays empty, step exits 0 | PASS |

## Checks run

The step's script was cut from ci.yml at 700db9a with `awk` and run under Node 22.23.5 against a local stand-in API, one mode at a time (harness in the session scratchpad; not committed, as it is a one-off). Each line: mode, exit code, seconds, `GITHUB_OUTPUT`.

| Mode | Exit | Seconds | Output | Log |
| --- | --- | --- | --- | --- |
| answers | 0 | 0.1 | `key=ci-test-times-a` | Chose it |
| headers sent, body never ends (first try) | 0 | 12.1 | `key=ci-test-times-a` | "try 1 of 3: no answer in 10 s" |
| 200 with HTML body (first try) | 0 | 2.1 | `key=ci-test-times-a` | "try 1 of 3: Unexpected token '<' ..." |
| 429 once | 0 | 2.1 | `key=ci-test-times-a` | "try 1 of 3: answered 429" |
| 401 | 0 | 0.1 | `key=` | one try, no retry |
| 503 always | 0 | 7.1 | `key=` | 3 tries, "failed 3 tries" |
| run call never answers | 0 | 37.0 | `key=` | 3 × "no answer in 10 s" |
| list call never answers | 0 | 37.1 | `key=` | 3 × "no answer in 10 s" |

- The process exited on its own in every mode (no lingering socket kept Node alive), and the step never exits non-zero, so it fails open to Playwright's own split as before.
- The worst case for the step is both calls using every try: 2 × 37 s = 74 s, inside the job's `timeout-minutes: 45`. CI cannot hang on this step.
- Draft run on 700db9a (run 44998791098): all six browser pieces, verify, postgres and the gate green. Pieces 1 and 5 logged `Chose ci-test-times-06a0b094…, saved 2026-11-22T07:22:55Z` and "Times read" the same key, so the code runs under the container's Node 24.

## Red findings

None.

## Notes (not blocking, not fixed here)

- N1. UNIT: `get()` in ci.yml. VERDICT: note. REASON: a 200 whose body is not JSON is retried, which the spec does not list (it names thrown `fetch`, 429 and 5xx). EVIDENCE: "200 with HTML body" mode above retried once. EXPECTED: either is fine; a broken body from a proxy is a network fault, so retrying is the safer reading. FIX: none, or one line in the spec if the builder wants them to match.
- N2. UNIT: the chooser after `get()`. VERDICT: note, pre-existing. REASON: a 200 answer to the list call with no `actions_caches` field throws a TypeError in `.filter`, caught by the outer `catch`, so that piece splits by count with no retry. It fails open and the key check names the piece, as the spec intends for a failed lookup.
- N3. The full-run criteria (every piece logs the same key, key check and A9 pass on the integration commit) are still open in the PR body, as they need the full run before merge.

## Hook refusal to report

A local timing command using `$(date +%s)` in Bash was refused by the PR-route hook ("the program word $(date +%s)-s is a variable or a substitution"). It wrote nothing to GitHub, so the refusal looks like a false positive of the same kind as the known `time` one. The timings were then taken inside a Node harness script instead, which measures in-process rather than in the shell.
