# Plan audit 2: faster CI

**b6d9bce PASS**

- Spec: `docs/superpowers/specs/2026-11-22-faster-ci-design.md` at b6d9bce (branch `claude/project-thread-g0gcfn`), against round 1 (`2026-11-22-faster-ci-1-plan-audit.md`, 636c072 FAIL, 3 red).
- Audited 2026-11-22 01:40 UTC by the round 1 session (Opus 5.5, medium), against `release` "Fast CI", "Making CI fast" and "Docs only", `build`, and CLAUDE.md. Read the whole diff 636c072..b6d9bce (the spec and the round 1 audit file only).
- Prompt: Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## Round 1 reds

- **R1, fixed.** 3.1 item 1: `gate` checks out with full history, runs `docs-only.sh` itself, and only its answer counts. On "yes" it passes when no needed job failed or was cancelled; on "no" it needs all three to succeed and, on a full run, the union check, which catches a piece that skipped its work. `gate` logs its answer. A3 now checks both answers in the gate log. This is one deciding authority read by the gate, as `release` Docs only asks, and no required check waits on another.
- **R2, fixed.** Pieces pick their journeys first and do the screens builds only when `run=true`; A4 checks that a piece with no journeys logs no build. A10 checks draft p50 and p95 against the 150-run baseline (3.1 / 16.0 min).
- **R3, fixed.** The appendix holds the program, with its rules for full and draft runs, start and end, wait, setup and run, and nearest-rank percentiles. W commits it as `.github/scripts/ci-times.mjs`, and A8 and A10 use it. **Checked by running it:** I took the program from the spec as written, fetched the 150 newest success or failure runs created up to 01:22 UTC with plain `gh api`, and got exactly the spec's numbers: 150 runs 2026-11-21T01:23:59Z to 2026-11-22T01:21:41Z, full 84, draft 66, full 11.0 / 26.6 min, draft 3.1 / 16.0, and every row of both job tables. With count 60: full 49, draft 11, full 14.1 / 30.5, draft 5.7 / 31.3, as the spec says.

## Round 1 notes

N1 (container fallback now covers any journey that behaves differently, and nothing is changed to fit the container; A5 checks it), N2 (`--reporter=list,html,json`), N3 (pairs from the JSON report; no `--shard` with `RUKEN_SHARD`), N4 (sorted listing of `testDir`, crossed with the three profiles), N5 (the Call now says the base build is on the path, and why it is still a gain), N6 (12 jobs to 8, 9 on `main`) and N7 (`test-times` without `always()`) are all taken in.

## Still holds from round 1

No test, device or engine dropped (A9); no retries, sleeps or wider timeouts; `gate` and `gate (quick, draft)` keep their names; image digest `sha256:eff16c30…a4a27` correct; W is CI files only (lane 3, `.github/` only), T is lane 2; CRUD not applicable.

## Red

None.

## Notes (not blocking)

- **N8. Waiting is the biggest bucket at p95 and in the recent window, not at the 150-run median.** By the program, full-run job waits at p50 over 150 runs are 2 to 27 s per hop (under a minute along the chain), while the slowest piece's setup and run (66 + 242 s at p50, more for the slowest of six) is the biggest median bucket. At p95 the waits sum to well over 15 minutes. The plan fixes all three buckets, so nothing changes, but W1's "the biggest bucket" should say "at p95, and at p50 in the last 60 runs".
- **N9. A8 and A10 pick "the first 10 runs after a merge", but the program takes the newest N runs.** Give `ci-times.mjs` a start time (runs created after the merge commit's time) and a per-kind count, or say the fetch is limited to those runs, so the check reads the same runs whenever it is run.
- **N10. Drafts and the image.** A job's container image is pulled before any step, so a draft piece with no journeys pulls the image too, where today it installs no browser. The 3.1 item 2 fallback compares only with today's install time. If A10 misses because of that pull, say that the same fallback applies (keep the install), rather than leaving A10 failing with no next step.
- **N11. The p95 target moved from 12 to 15 min** with the new 150-run baseline (26.6). That is the spec's Call and is stated; the owner can overrule it.

## Verdict

b6d9bce PASS. 0 red, 4 notes (N8 to N11), none blocking W.
