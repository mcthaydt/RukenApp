# Panels slide away, and Reposted: implementation audit 4

- Pull request: #425, lane 2. Reviewed head: `7b2adfeec18c54d08c890a9fe812234cd663567e` (7b2adfe). The code was read at 3cd96a4; 7b2adfe adds one notes line to `docs/superpowers/progress.md` (a money-job flake under "Flaky tests") and nothing else (`git diff --stat 3cd96a4 7b2adfe`: 1 file, 1 insertion).
- Reviewer: a fresh session, Opus 5.5, medium. Changed nothing but this file.
- Written: 2026-11-27 17:44 UTC (from `date`).

**Verdict: FAIL, 1 red.** The code passes every check below; the one red is that the head conflicts with `main`, so CI has not run on it and it cannot merge.

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## What ran

Site and runner as in the repo's own `playwright.config.ts` (its `webServer` list, Postgres 16 on this machine), run inside `mcr.microsoft.com/playwright:v1.63.0-noble` with host networking, since this container's own browsers are not 1.63's. Phone is WebKit (iPhone SE), tablet and computer Chromium, as in CI. No retries.

| Check | Result |
|---|---|
| `pnpm lint` | exit 0 |
| `pnpm typecheck` | exit 0 (a first run failed only on `.svelte-kit/cloudflare/_worker.js`, a build the journeys made at the same moment; re-run on a clean `.svelte-kit`: 0 errors) |
| `pnpm test` | 2,391 of 2,391 passed |
| Journeys `sheets-slide`, `feed-controls`, `feed-marks`, `report-a-game`, `gamepad`, `bar-through-moves`, all three profiles, once | 249 of 249 passed (11.1 min) |
| Review 3's red: "a late first frame…", with "closed while it is still sliding in…" and "a slide away that never starts…", phone WebKit, `--repeat-each 12` | 36 of 36 passed |
| CI on 7b2adfe (or 3cd96a4) | **not run**: only `pr-rules` ran. GitHub reports the PR `mergeable: false`, `mergeable_state: dirty` (red 1) |
| Probe (below): slide away frozen half way; closed 100 ms into the slide in; Reposted | pictures taken on all three profiles; numbers below |

Probe source: `/mnt/project-files/audits/2026-11-27-panels-slide-away-and-reposted-4-probe.test.ts.txt` (not committed). Pictures: `/mnt/project-files/audits/2026-11-27-panels-slide-away-and-reposted-4/`.

## Review 3's red, and what changed since

- **Red 1 (late-frame journey flaky on phone WebKit): fixed.** `LONGEST_WAIT_MS` is 2000 (`src/lib/sheet.ts`), armed at the press and re-armed at the slide away's own `animationstart`, so a WebKit that draws nothing for 700 to 830 ms still has over a second to spare. 12 of 12 on phone here (review 3 saw 2 of 17 fail). The "never starts" journey's bound moved with it (hidden within 4 s, closed under 2.5 s after the press); with a 2 s timer from the press that bound still catches a timer that never fires. The flake is logged under "Flaky tests" in `progress.md`.
- **Closed during the slide in (review 3's N1): fixed and correct.** When a `sheet-in` / `sheet-up` is running, `slideAway` copies the panel's current computed `transform` and `opacity` into its inline style before adding `closing`. `sheet-out` / `sheet-down` have only a `to` frame, so they start from that inline value: no jump. `finish` removes both inline values before the close, so the next opening is clean. Probe: tablet `before 0.899`, then 0.607 at 130 ms into the slide away (the probe's half-way freeze was still attached); computer 0.926 then 0.625. Both are the eased halfway point from the panel's own opacity, not from 1. The PR's journey checks the same (no rise of more than 0.05 at the close) and passed 12 of 12 on phone and once on tablet and computer.
- **Merge of `main` up to #427 (`91c2b0c`): clean.** No conflict in the merge (`git show --remerge-diff` empty). `gamepad.test.ts` (B on a panel goes through the real layer now) and `bar-through-moves.test.ts` (#427) passed on all three profiles in the 249.
- **Repost:** "Reposted" and the green check on the disc's corner, Like and Save not moved (`phone-3-reposted.png`); `feed-marks` passed on all three profiles.
- Nothing else in `src/` changed since 2b39d03 (`git diff 2b39d03 b82a2d9 --stat`: `sheet.ts` and the journey file only).

## Red findings

### Red 1

- UNIT: the branch as a whole (`docs/superpowers/progress.md`).
- VERDICT: red.
- REQUIREMENT: CLAUDE.md lane 2 merge rule (green CI) and `release`'s integration with `main` before a merge.
- REASON: `main` moved to `de5eca6` (#428) after the branch merged #427, and #428 edits the same rows of `progress.md`, so the PR conflicts and CI never ran on this head.
- EVIDENCE: `git merge-tree --write-tree --name-only 7b2adfe origin/main` exits 1 with `CONFLICT (content): Merge conflict in docs/superpowers/progress.md`; `GET /repos/mcthaydt/RukenApp/pulls/425` gives `mergeable: false`, `mergeable_state: dirty`; the only runs on 7b2adfe and 3cd96a4 are `pr-rules`.
- EXPECTED: the head merges with `main` cleanly and its CI is green.
- FIX: merge `origin/main` into the branch, keep both sides' lines in `progress.md` (the #427 row as merged plus the flake lines from both), and push. Files: `docs/superpowers/progress.md` only. The next review then needs only the merge and CI: the code is unchanged.

## Notes (not blocking)

- N1: on phone WebKit in this container the panel's opacity was still 0 at 100 ms into the slide in (no frame drawn yet, as review 3's N5), so a close that early looks like no panel at all. Order and timing are right; the look on a real iPhone is not judged here.
- N2: review 3's N3 (Report has no close on the dimmed screen) and N4 (a second Escape in Chromium closes at once) still stand; both outside this change.

## Acceptance against the owner's ask

- Every pull-up panel slides away the way it came, by every close, including a close during the slide in (now with no jump) and a slide that never starts: yes, on all three profiles, and the phone journey is steady.
- Repost shows "Reposted" and a small corner check, and the column does not move: yes.
- Mergeable and green: no (red 1).
