# Panels slide away, and Reposted: implementation audit 3

- Pull request: #425, lane 2. Reviewed head: `2b39d03d21f30eceab07e4b10600db9f627590a3` (2b39d03).
- Reviewer: a fresh session, Opus 5.5, medium. Changed nothing but this file.
- Written: 2026-11-27 16:40 UTC (from `date`).

**Verdict: FAIL, 1 red.**

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## What ran

Site per `verify` on this machine (Postgres 16, the four stand-ins, `wrangler dev` app and game gate). The Playwright runner and browsers ran inside `mcr.microsoft.com/playwright:v1.63.0-noble` with host networking, from a throwaway config that is the repo's config minus `webServer` (the site was already up; `warm-webkit` global setup kept). So phone is WebKit (iPhone SE), tablet and computer Chromium, as in CI.

| Check | Result |
|---|---|
| `pnpm lint`, `pnpm typecheck` | exit 0 (run in a clean environment; with `CLOUDFLARE_INCLUDE_PROCESS_ENV` exported, `wrangler types` writes this container's own variables into the types and both fail on that, not on the change) |
| `pnpm test` | 2,360 of 2,360 passed |
| CI on 2b39d03 | every check green (six browser shards, verify, postgres, gate, rules) |
| PR journeys `sheets-slide`, `feed-marks`, `feed-controls`, `report-a-game`, all three profiles, once | 174 of 174 passed |
| The three journeys added for review 2's reds, tablet and computer, `--repeat-each 5` | 30 of 30 passed |
| The same three, phone (WebKit), `--repeat-each 5` | 14 of 15: **"a late first frame does not cut the slide away short" failed once** (red 1) |
| "a late first frame…", phone, `--repeat-each 12` | 11 of 12: **failed once more** (red 1). In all, 2 of 17 phone runs fail |
| Probe J: close 60 ms into the slide in, read the panel at each step | the slide away plays and ends before `close` in all three profiles. In Chromium the panel jumps back to fully shown for a frame or two first (note N1) |
| Probe K: Share, Escape straight after the click (signed out) | tablet and computer 6 of 6 slide to the end, then close, focus back on Share. Phone 2 of 3; the third was closed by the 1 s safety before its slide ended (same cause as red 1) |
| Probe L: slide away frozen (`animation-play-state: paused`), then Cancel | closes (phone about 1.95 s from the click, including Playwright's own wait), `inert` and `closing` cleared, and the panel opens again |
| Probe M: frame pace, and what each frame shows during a slide away | Chromium: a new frame each 17 ms, and 4 to 5 steps of the fade inside 310 to 420 ms. Phone WebKit: 16 ms between frames when idle, but **no frame drawn for 680 to 830 ms** once the slide away starts; it closed at 689 and 830 ms after the press. Closed mid slide in: no frame at all before it closed at 484 to 518 ms |

Probe source: `/mnt/project-files/audits/2026-11-27-panels-slide-away-and-reposted-3-probe.test.ts.txt` (not committed).

## Review 2's reds, checked one by one

- **Red 1 (tell the slide away apart by name): fixed.** `sheet.ts` `slideAwayOf` takes only `sheet-out` / `sheet-down` on the dialog itself, and the start-of-close check reads `CSSAnimation.animationName` the same way. Probe J's WebKit log shows `start sheet-undim pe=""` arriving and being ignored; the panel closes only after `end sheet-down`. The late-frame journey's filter uses the same names. (It still flakes on phone, for a different reason: red 1 below.)
- **Red 2 (closed mid slide in): fixed.** The cut-off `sheet-in` / `sheet-up` no longer ends it: probe J logs `cancel sheet-up`, `start sheet-down`, `end sheet-down`, `closed` in that order on all three profiles, 3 of 3 runs each. The new journey passed 5 of 5 on each profile.
- **Red 3 (a slide away that never starts): fixed.** The timer is armed at the press (`let timer = setTimeout(finish, 1000)`), cleared and re-armed by the slide's own `animationstart`. The new journey passed 5 of 5 on each profile, and probe L (a paused slide) closes too. `finish` also clears `closing` and `inert` when the dialog is closed some other way (the `close` listener), which answers review 2's N1.
- **Every close path slides away:** ••• (Cancel, Escape, dimmed screen, B, a choice), Report (cross, Escape, B, and Done goes through the same `close`), Share (cross, Escape, dimmed screen, after a phone share). Reduced motion closes at once. Checked in code and by the journeys above.
- **Repost:** "Reposted" plus the green check on the disc's corner, Like does not move, taking it back clears both: `feed-marks` passed on all three profiles. Review 2's 320-wide measurement (probe D) still applies; `Feed.svelte` is unchanged since 90d8c65.

## Red findings

### Red 1

- UNIT: `tests/browser/sheets-slide.test.ts` "a late first frame does not cut the slide away short", against `src/lib/sheet.ts` `LONGEST_WAIT_MS`.
- VERDICT: red.
- REQUIREMENT: CLAUDE.md Verification ("A test that fails once and passes on retry is a defect"; pull request runs never retry) and the PR's own criterion that this journey passes.
- REASON: in WebKit the slide away's end can land more than 1 s after its `animationstart`, so the safety close wins the race and the journey sees `closed` before (or instead of) `end sheet-down`.
- EVIDENCE: phone (WebKit), 2 of 17 runs failed: once `["closed", "cut sheet-down"]`, once `["closed"]`, against the expected `["end sheet-down", "closed"]`. Probe M shows why: in this WebKit no frame is drawn for 680 to 830 ms once a slide away starts, and the journey adds a 200 ms stall on top. Probe K hit the same race on Share (closed at 1,009 ms after `start sheet-down`, before its end). CI passed once on this head, on the same kind of WebKit, so it can go red on any later run there.
- EXPECTED: the journey passes every time on all three profiles (`--repeat-each 12` on phone WebKit as the check), and still fails on the old `sheet.ts` from 8982b37 (a close timed from the press).
- FIX: either give the safety close more room than a slow WebKit needs (for example `LONGEST_WAIT_MS` 2000, from the slide's start; the press timer can stay at 1 s), or have the journey check the property without racing the safety close (for example: the slide away started, and `close` came no sooner than 260 ms after it, with `end sheet-down` before `closed` whenever an end came). Files: `src/lib/sheet.ts` and/or `tests/browser/sheets-slide.test.ts`. Record the flake under "Flaky tests" in `docs/superpowers/progress.md` in the same push.

## Notes (not blocking)

- N1: closed while it slides in, the panel jumps back to fully shown before it slides away, because `sheet-out` / `sheet-down` start from the resting state. Chromium probe J: opacity 0.80 just before the close, 1.00 on the next frame, then the fade (computer: 0.94, 0.85 at +30 ms). One or two frames, only for a close within 320 ms of opening. A Web Animations reverse of the running slide in would avoid it; not asked for.
- N2: the branch starts before #409 (gamepad) merged. It merges with today's `main` with no conflicts (`git merge-tree`). `main`'s `back()` in `src/lib/pad-focus.ts` sends exactly the cancelable `cancel` the journey's `pressB` sends, so B is covered in effect, but the real gamepad layer only meets `slideAwayOnCancel` after the merge: the merging session should see `gamepad.test.ts` pass on the merged head.
- N3: Report has no close on a press of the dimmed screen, unlike Share and •••. Same as on `main`; outside this change.
- N4: in Chromium a second Escape during a slide away is not cancelable (Escape gives no user activation), so the panel closes at once. A person pressed twice; acceptable.
- N5: phone WebKit in a container draws almost no frames during the slide, so the look of the slide on an iPhone is not judged here; order and timing of the events are.

## Acceptance against the owner's ask

- Every pull-up panel slides away: yes for every close path on all three panels, including a close during the slide in and a slide that never starts. Only the phone journey's timing is flaky (red 1).
- Repost shows "Reposted" plus a small corner check, and the column does not move: yes, on all three profiles.
