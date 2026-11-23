# Plan audit 2: faster CI unit R, back to six pieces (spec 3.6)

Examined: `da38b3e` on `claude/project-thread-g0gcfn` (after audit 1 at `b166e8c`, commit `e91ad97`). Auditor: Opus 5.5, medium. Lane 3.

**Verdict: PASS, 0 red, 1 new note.**

## Audit 1's red

- R1 (reason overstates): **fixed.** `git diff e91ad97 da38b3e` touches only the spec. 3.6 "Why" now says load raised every wait and gives the same-window numbers: `verify` p50 wait 1 s to 90 s, `postgres` 1 s to 100 s, six draft pieces 2 s to 87 s, and twelve full pieces p50 271 s against 87 s for six draft pieces beside them. "Over the same day" is gone. Each number matches `node .github/scripts/ci-times.js <dir> 10 2026-11-22T16:41:19Z` and `... 2026-11-22T08:05:00Z` on the runs fetched for audit 1 (`full: verify` 1 / 90, `full: postgres` 1 / 100, `draft: browser shard n` 2 / 87, `full: browser shard n` 271).
- Audit 1's N3 is taken up as R3 (A8 and A10 over the first 10 full and 10 draft runs after R merges), and the unit table says "R3 after merge".

Everything else audit 1 checked is unchanged at `da38b3e` (the revert to `5bbea3e`'s `ci.yml`, Settings "6", `this-repo` line 33, `ci-times.js` kept, P1 to P4, the R row).

## Notes

- N5 (new). R3 asks for "the `verify` and `postgres` waits beside" each run's longest piece wait. `ci-times.js` lists per-run waits only for the pieces; for `verify` and `postgres` it gives p50/p95 per window. Those per-window numbers are enough to tell load from piece count, so R3 holds if read that way; say "the `verify` and `postgres` wait p50/p95" to remove the doubt.
- Audit 1's N1 (A7 recount 1.17 to 1.31, median 1.22 over 9 runs), N2 (two docs-only runs in the six-piece column) and N4 (the `shard-plan.ts` follow-up becomes moot) are still open as notes.
