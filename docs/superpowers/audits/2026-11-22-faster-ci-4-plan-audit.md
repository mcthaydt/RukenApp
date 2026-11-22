# Faster CI spec, section 3.4 (unit F): plan audit 4

- Examined: 5ec193c (draft PR #307 head). The change since audit 3 (11d08d5) is the spec fix 0a03a40 in `docs/superpowers/specs/2026-11-22-faster-ci-design.md`; the live-state file it added is removed again.
- Lane 3 plan audit, recheck of audit 3 (`2026-11-22-faster-ci-3-plan-audit.md`). Reviewer: Opus 5.5, medium. Written 2026-11-22 06:06 UTC.
- Verdict: **PASS, 0 red, 3 new notes.** Audit 3's notes are now in the spec (N1) or still hold (N2, N3).

## R1: fixed

- Each piece saves exactly `path: piece-times-${{ matrix.shard }}.json` under `ci-piece-times-${{ github.sha }}-${{ matrix.shard }}`. `test-times` has six restore steps with the literal `path: piece-times-<n>.json`, so the path string at save and restore is the same text once the matrix value is filled in. Both run in the pinned image, so both use gzip.
- Every restore in `test-times` has `fail-on-cache-miss: true`, so a missing piece fails that job and partial times are never saved. The joined file is `path: ci-test-times.json` at both save and every piece's restore.
- F1 now requires the log line "joined 6 of 6 pieces, 159 file and device pairs" (or that run's count) on the first push to `main`.

## R2: fixed

- The set each piece picks from is the `ci-test-times-` entries on `refs/heads/main` created at least 2 minutes before the run's `created_at`. That time is fixed when the run is made and is the same for all six pieces and for re-runs, so a save landing while the pieces start cannot change the choice. The real save took about 1 s (job 137108942395: tar started at 05:36:13.60, and "Cache saved" at 05:36:14.65), so a 2-minute margin is ample for an entry that is reserved but not yet visible.
- Every failure of the lookup (empty set, failed listing, restore miss) sends all six to `--shard` alike, because they share the set. That includes the old host (zstd) entries: their keys are in the listing, but an exact restore from the image misses on version, and it misses for all six.
- The one remaining way for pieces to differ (the chosen entry evicted between restores) fails the gate's new key check with the keys named, before the union check, and is recorded under "Flaky tests". It is no longer mistaken for a lost journey.
- Budget: Node's `fetch` and the job token, with `actions: read` added to the job, on top of the workflow's `contents: read` (ci.yml line 55). This is read-only, and `test-times` and `gate` already hold `actions: read`. No new action, tool or secret is added.

## Notes (not blocking)

- **N4. Paging.** The cache listing returns 30 entries a page by default. Sorted newest first, the first page is enough unless more than 30 `ci-test-times-` saves land between the run's creation and its pieces' lookups. The build can ask for `per_page=100` and filter on `created_at` itself, which costs nothing.
- **N5. Re-running failed jobs after an eviction.** If the chosen entry is evicted (7 days unused, or the 10 GB limit) and only a failed piece is re-run, that piece falls back to `--shard` while the others used the planner. The key check fails, naming the keys, which is the right result. Re-running all jobs then deals alike.
- **N6. Docs-only runs.** Pieces skip on a docs-only change and write no `times-key.txt`. The gate's key check must be skipped there, as the union check already is. This is worth one line in the build.

## Checked and fine

- A run made for a pull request can restore caches saved on the default branch, and its token can list the repository's caches for `ref=refs/heads/main`. The listing's `key` parameter is a prefix match.
- `test-times` runs after every piece passed (`needs: browser-shard`), and the pieces save their times inside "Run the journeys"' job before then, so `fail-on-cache-miss` fails only on a real loss.
- F1 and F2 now check the two halves separately: `main` writes 6 of 6, and a pull request reads the same key in all six pieces, with the key check and A9.
