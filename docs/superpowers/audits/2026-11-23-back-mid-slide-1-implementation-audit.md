# Back pressed mid-slide: implementation audit, round 1

- Pull request: #354, head 1d466c547f657f409b795439bddaf5556032b57e (1d466c5), base `main` 2ce8fe7. Lane 2.
- Reviewer: fresh session, Opus 5.5, medium. Started 2026-11-23 02:02 UTC.
- Verdict: **PASS**. No red findings; three notes.

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## What was checked

1. **The cause is real.** SvelteKit's `navigate` (`node_modules/@sveltejs/kit/src/runtime/client/client.js`, about line 2146) awaits `run_on_navigate_callbacks` and then calls `apply_navigation_result` with no check of `navigation_token`; the token is checked only afterwards in `finish_navigation`. So a move held in `onNavigate` puts its page in even after a later move put its own in. The PR body's account matches the code.
2. **Ordering of the pages.** Every later move returns the same held promise. The earlier move's `Promise.all` subscribed to it first, and both chains are the same depth (`Promise.all` → async `run_on_navigate_callbacks` → `navigate`), so the earlier page goes in first and the latest move last. The one path that could add ticks to the earlier move, `await load_cache_fork`, is off: `kit.experimental.forkPreloads` is not set (`vite.config.ts:25`), so `__SVELTEKIT_FORK_PRELOADS__` is false and `load_cache.fork` stays null.
3. **No stuck move.** The held promise always settles: on the update callback, on `ready` rejecting, or by the 1 s timer. `held` is cleared in its own `.then`, guarded by identity. Only `slideWhile` sets it, and both layouts read `heldMove()` before calling it, so a held move is never overwritten while one is pending.
4. **Errors.** `arrived.catch(() => undefined)` stops the overtaken move's `navigation.complete` rejection ("navigation aborted") from rejecting the slide's update. No page errors were seen in the probes.
5. **Both layouts in one move.** For a move inside the maker's area the root layout's `moveBetween` is null and only the make layout slides; for a move in or out of the area the make layout returns early. If both callbacks ever saw the held move, they return the same promise, which is harmless.
6. **Swipe tabs.** All of `tests/browser/page-moves.test.ts` passes on computer and tablet, including the bar's sideways slides and the reduced-motion and skipped-slide journeys.
7. **The test is honest.** The new journey, with `src/` taken from `main` 2ce8fe7 and the test kept, failed 3 of 3 on computer (`Expected: "Sign in"`, `Received: "Join Ruken"`). With the fix it passed every run. It checks the page 1.5 s after the 600 ms hold ends, so the late page would have shown.
8. **PR body.** Has `## Lane` (lane 2, matches `src/lib/`), ends `Requested by **McThayDT**`, no footer.

## Runs (this container, Chromium; WebKit is not installed here, so the phone profile did not run)

- `page-moves.test.ts` at 1d466c5, computer and phone requested: computer 6 of 6 passed; phone could not launch (no WebKit).
- New journey with `main`'s `src/`: 3 of 3 failed, as it should.
- `page-moves.test.ts` plus three probes, computer and tablet, `--repeat-each 3`, no retries: 54 of 54 passed.
- Probes (not committed; kept at `/mnt/project-files/audits/2026-11-23-back-mid-slide-1-probe.test.ts.txt`):
  - Back, Forward, Back all inside a 600 ms hold: ends on Sign in, stays there, the next link still slides to Join Ruken, no full page load, no page errors.
  - A slide that never runs its update and whose `ready` rejects: every move still goes through.
  - A slide that never runs its update and never settles `ready`: the 1 s timer lets the move go, Back inside it wins, the next move works.
- Not run here: `feed-controls.test.ts:262` on phone (needs WebKit). The PR reports 20 of 20 there; CI's phone pieces are the check.

## Notes (not blocking, not for this PR)

- UNIT: `src/routes/+layout.svelte` onNavigate. VERDICT: note. REASON: a move that waits on a held one skips setting `data-move` / `data-step`, so the mark from the held move stays until the next move. EVIDENCE: early `return earlier` before `html.dataset.move = move`. EXPECTED: nothing visible today (the mark only stills the maker area's rising lines). FIX: none needed now.
- UNIT: `src/lib/page-moves.ts` slideWhile. VERDICT: note. REASON: if the later move's page goes in after the held slide has pictured its new state, the slide still plays to the overtaken page and the right page shows when it ends (a flash of the wrong page, about one slide long). EVIDENCE: reading of the code; not seen in runs. FIX: could call `skipTransition()` on the held slide when a later move starts; only if the owner sees it.
- UNIT: PR body. VERDICT: note. REASON: "More runs … in progress and will be added here" was still open at 1d466c5. FIX: update or drop that line before merge.
