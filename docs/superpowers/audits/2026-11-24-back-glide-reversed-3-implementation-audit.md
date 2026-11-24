# Back to the feed is the clip move reversed: implementation audit, round 3

- Pull request: #399, head `dcbcba3` (branch `claude/project-thread-vlnx67`), with `main` at `67ba234` (#398) merged in by `96b9e9a`.
- Lane 2 (`src/lib/look.css`, `src/routes/+layout.svelte`). Reviewer: fresh session, Opus 5.5, medium.
- Brief: the owner, 2026-11-24 19:02 UTC: "The transition between in game page to feed doesn't look like the reverse transition". Round 2 (`7373f86`) failed on one red: phone WebKit never draws the arriving bar. The coordinator then scoped that WebKit gap out of #399 (it is on `main` too) and set the pass criteria for this round: Chrome's engine page, clip and bar an exact mirror; phone keeps `main`'s bar behaviour; the move out unchanged; **a held-frame pixel check that passes on tablet and computer and genuinely fails on phone without its fixme**; the known issue and roadmap notes present.
- Graphify: not used (no source change since round 2; read directly).

## Verdict: FAIL, 1 red

The product code is the code round 2 passed in Chrome's engine, and the notes are in place. The new pixel check does not do its job: it passes on phone with its fixme taken off, so it cannot see the WebKit gap, and it also passes in Chrome's engine on `main`'s CSS, so it would not catch round 1's bug coming back either.

## What ran (at `dcbcba3`, local Postgres 16, fresh database; phone through the `mcr.microsoft.com/playwright:v1.63.0-noble` run-server, with the WebKit warm-up left out)

- `feed-to-game-grow.test.ts` on tablet and computer (Chromium): **16 passed**. On phone (WebKit): **7 passed, 1 skipped** (the new check, by its fixme).
- `pnpm lint`: passed. `pnpm typecheck`: 0 errors.
- `git diff 7373f86 dcbcba3 -- src/lib/look.css src/routes/+layout.svelte` is empty: the move's code is exactly what round 2 measured (Chrome's engine an exact mirror, largest difference 0 over 21 paused frames; the move out's rules untouched). The only other source change since then is `src/lib/page-loading.svelte`, which came from `main` (#398).
- `progress.md` Known issues has the WebKit entry and `roadmap.md` has it under "Not yet placed"; both are accurate to round 2's findings.
- Mutation runs of the new check (each restored afterwards):
  1. Phone with the fixme turned off: **passed 6 of 6 runs** (on the 5 that logged it, gap to the settled picture 0.08 to 0.43, to the bare clip 10 to 84; the check needs the first below half the second).
  2. Tablet and computer with `look.css` from `main` (no Back rules at all, round 1's bug): **passed 2 of 2**.
  3. Tablet and computer with only the PR's `tabs` Back rules removed: **passed 2 of 2**.

## Findings

### 1. red: the bar check cannot fail on phone, and does not catch round 1's bug in Chrome's engine

- UNIT: `tests/browser/feed-to-game-grow.test.ts`, "the bar is drawn at the end of Back, as it is once the feed has settled" (line 231).
- REQUIREMENT: the coordinator's pass criterion for this round (the pixel check genuinely fails on phone without fixme); CLAUDE.md "A check is a test that fails by itself"; round 2's finding 1 (a check the journey can fail on).
- REASON: on phone, the "settled" picture it compares against has no bar either, so held and settled match; and holding at the move's last millisecond is too late to see a bar that only pops in at the end.
- EVIDENCE:
  - Phone, fixme off, run 1: held, settled, then the same place 2 s later, then after a reload (`audits/2026-11-24-back-glide-reversed-3/phone-held-settled-later-reloaded.png` in the project files). Held and settled are both bare clip; the bar shows only 2 s later and after the reload. At the "settled" screenshot `document.activeViewTransition` was `null` and only the spinner animation was left, so the move had ended; WebKit just had not drawn the bar yet. The check passed (gap to settled 0.43, to the bare clip 13.3).
  - Chromium with `main`'s `look.css` (the bar missing for the whole of Back, round 1): passes on tablet and computer, because at `end - 1` ms every fade has finished and both pictures are the settled bar.
- EXPECTED: with the fixme off, the check fails on phone at this head; with `main`'s `look.css`, it fails on tablet and computer; with this head's CSS it passes on tablet and computer.
- FIX: hold the move where the bar is in the middle of arriving rather than at its end (for example Back t = 0.8, where `new(tabs)` is mostly in on the reversed curve and still absent on `main`), and compare against the bar's own reference picture rather than a "settled" picture taken straight after the move (in WebKit wait for the bar to be painted, for example a second animation frame plus a short wait, or take the reference before Back, on the feed, with the clip paused at the same frame). Show the mutation results in the pull request: fixme off fails on phone; `main`'s `look.css` fails on tablet and computer. Files: `tests/browser/feed-to-game-grow.test.ts` only. Check: the three mutation runs above, by a program or a second session.

## Notes (not blocking)

- The WebKit held picture of Back is a plain clip over the whole screen (no feed info card, Play button or bar at all), which matches the known-issue entry: only `root` and `clip` draw in WebKit.

## CRUD

The change adds nothing a person makes; no CRUD journey applies.
