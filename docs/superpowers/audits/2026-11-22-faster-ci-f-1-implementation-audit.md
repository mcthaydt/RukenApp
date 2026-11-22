# Faster CI unit F (PR #308): implementation audit 1

- Examined: 705d291 (PR #308 head). Against `main` at ed3a1dd it changes only `.github/workflows/ci.yml` (commit 7bad5fd; the live-state file was added and removed). Checked against spec 3.4 as passed in plan audit 4 (`2026-11-22-faster-ci-4-plan-audit.md`, 0e2d443).
- Lane 3 implementation audit. Reviewer: Opus 5.5, medium. Written 2026-11-22 06:30 UTC.
- Verdict: **PASS, 0 red, 3 notes.** F1 and F2 can only show after the merge, as the spec says.

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## Against the spec, item by item

| Spec 3.4 | ci.yml at 705d291 | Result |
| --- | --- | --- |
| Piece saves `piece-times-${{ matrix.shard }}.json` under `ci-piece-times-${{ github.sha }}-${{ matrix.shard }}`, on push, after the journeys pass, from inside the image | "Sum this piece's times" and "Keep this piece's times", `if: github.event_name == 'push' && steps.journeys.outcome == 'success'`, in the `browser-shard` container | matches |
| `test-times` in the same image by digest, six restores with literal `path: piece-times-<n>.json`, `key: ci-piece-times-${{ github.sha }}-<n>`, `fail-on-cache-miss: true` | `container.image` is the same digest (eff16c30…a4a27); six restore steps, each path and key as named | matches |
| Joins, logs "joined 6 of 6 pieces, P file and device pairs", saves `path: ci-test-times.json` as `ci-test-times-${{ github.sha }}` | "Join the six pieces' times" prints that line; the save is unchanged | matches |
| `gh run download` leaves `test-times` | gone; the job no longer checks out the code or holds `actions: read` | matches |
| Pick from `ci-test-times-` entries on `refs/heads/main` created at least 2 minutes before the run's `created_at`; Node `fetch` with the job token; `actions: read` added | "Choose main's test times": `GET actions/runs/{run_id}`, then `GET actions/caches?ref=refs/heads/main&key=ci-test-times-&sort=created_at&direction=desc&per_page=100`, filtered `created_at <= created_at(run) − 120 s`, newest first, ties by key; job `permissions: contents: read, actions: read` | matches; N4 handled (`per_page=100`, filtered in code) |
| Restore exactly that key with `path: ci-test-times.json`; else `--shard` | "Fetch main's test times" with `key:` only, no `restore-keys`, skipped when no key; "Pick the journeys" uses the planner only when the file exists | matches |
| Each piece writes its key to `ran/times-key.txt`; the gate checks all six are equal before the union check, naming the keys | written in "Pick the journeys" (the key, or "none: split by count"), uploaded with `ran/`; the gate prints each piece's key and fails with `::error::` when they differ, before the union program | matches; N6 handled (the whole step is skipped on docs-only and drafts) |

## What was run

- **The draft run 44992944267 on 7bad5fd** (705d291 differs only by the live-state file). Piece 1 at 06:19:11 and piece 3 at 06:25:59, almost 7 minutes apart, both logged "Chose ci-test-times-92eed6d…, saved 2026-11-22T06:07:21.548227Z." That is one fixed set across a long start spread. Both then logged "Cache not found" (an old host zstd entry, as designed), "Times read: none: split by count" and "Split by Playwright". The API calls worked from inside the container with the job token. Every piece listed "Total: 0 tests in 0 files" (only ci.yml changed), so the journeys, the piece saves, `test-times` and the gate's checks did not run there.
- **`TEST_TIMES`, pulled from ci.yml and run locally** on made-up reports: `reports r1 r2` and `times` over the two per-piece outputs give the same file. It sums several results, specs nested in describes, and a pair split across two reports. A wrong mode exits 1.
- **The gate's key check, pulled from ci.yml and run locally** under `bash -eo pipefail` with six piece folders. All six the same key: exit 0. All six "none: split by count": exit 0. One differing: exit 1. No key files: exit 1.

## Notes (not blocking)

- **N7. A failed listing is per piece, not shared.** Spec 3.4 item 2 says a failed listing sends "all six to `--shard` alike". That holds for an empty set and a restore miss, but a listing that fails for one piece (a timeout or a 5xx) leaves that piece at "none: split by count" while the others use the planner. The gate's key check then fails, naming the keys, so no journey is lost; it is a named red, recorded under "Flaky tests". Plan audit 4 missed this. A cheap follow-up is three tries with a short wait in "Choose main's test times", plus a timeout on each `fetch` (today a hung call waits for the job's 45-minute limit).
- **N8. The ready run checks the gate's new step before the merge.** The draft run skipped the key check. When #308 is marked ready, its full run should show the gate printing six "none: split by count" lines and passing (`main`'s newest eligible entry is still a host zstd save). The merging session should read that log. Then F1 (the first push to `main`) and F2 (the first full pull request run after it) follow, as the spec says.
- **N9. A missing key file passes the key check.** If one piece uploaded no `times-key.txt`, the check compares only the files present. That cannot happen on a full run that reaches the step (every piece ran journeys, and "Every check passed" needs all six pieces green), and the union check would catch it anyway. It is recorded so nobody relies on the key check alone.

## Checked and fine

- Permissions: the workflow stays `contents: read`. Only `browser-shard` adds `actions: read`, which is read-only. `test-times` drops its old `actions: read`. The cache actions use the runner's own cache token, not `GITHUB_TOKEN`.
- No new action, tool or secret. `actions/cache/save` and `actions/cache/restore` are still pinned at 55cc834, and Node's `fetch` is built in.
- On a re-run of failed jobs on `main`, pieces that passed earlier keep their saves under the same `github.sha` keys, so `test-times` finds six of six.
- On `main` itself, pieces choose their times the same way (by the run's `created_at`), so a push run cannot race either.
