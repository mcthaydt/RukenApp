# #447 implementation audit 4: instant slide done carefully

- Pull request: #447, head `dbff9bf461da6da229b2f62fc9c0b59e18607ff1` (base `3efa80e`).
- Reviewer: fresh session, Opus 5.5, medium. Lane 2.
- Run: 2026-11-28, Playwright 1.63 image (`mcr.microsoft.com/playwright:v1.63.0-noble`), phone (WebKit), tablet and computer (Chromium), fresh Postgres 16 database.

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## Verdict

FAIL: 1 red.

## What ran

- The PR's own journeys and review 3's probes: `tabs-show-now`, `follow-a-maker`, `trackpad-swipe` and `2026-11-28-trackpad-swipe-rework-3-probe-nudge`, on 3 profiles: all passed.
- Review 4 probes (`/mnt/project-files/audits/2026-11-28-trackpad-swipe-rework-4-probe.test.ts.txt`):
  - P1, the quiet refresh fails (network cut, or a 500). The tab stays on screen with its clip, and no error page shows. 6 of 6 passed (2 to 3 failed asks were counted in each).
  - P2, the person moves down two clips while a slow (2.5 s) quiet refresh is still coming. The clip they reached keeps its place and its element. 3 of 3 passed.
  - P3, a send that comes in by the quiet refresh is marked seen. **Failed 3 of 3 at `dbff9bf`, passed 3 of 3 with `src/` from main `3efa80e`.**
  - P4, computer only: hover over Your turn, then a friend sends, then press Your turn. Failed on the PR and failed the same way on main `3efa80e`. It was there before the PR (note N1).
- Overlap: `controls-overlap.test.ts`, at 320×568, 375×667 and 667×375 (sideways), before launch and after, signed out and with a friend's face. Ran with `sent-to-you`, `feed-top` and `feed-marks`: 94 passed, 5 skipped, 0 failed. No overlap was found. The PR changes no CSS.
- Not run: the rest of the browser suite (the implementer reports 378 passed at `80c64ab`), lint, typecheck and unit tests (the implementer reports them green at `dbff9bf`).

## Red

### R1. A send that arrives by the quiet refresh is never marked seen, so the dot stays lit

- UNIT: `src/features/sends/YourTurn.svelte` with `src/routes/your-turn/+page.svelte`.
- VERDICT: red.
- REQUIREMENT: the owner's choice (06:33 UTC) says "Your turn sends appear". The standing journey `sent-to-you.test.ts` says "Seen: the dot goes". Main does this today.
- REASON: `YourTurn` posts `/your-turn/seen` only in `onMount`, and only if `news` is true then. Now the page can mount from a page asked for ahead while `news` is false. The quiet refresh then brings the new send and `news` turns true. But this PR keeps Your turn mounted across the refresh ("Your turn's list simply updates"), so nothing posts seen.
- EVIDENCE: in probe P3, the person is on Followed for 3 s, a friend sends, and the person presses Your turn. The game shows in the list, but after 2 s the tab is still `aria-label="Your turn, new games"`: 34 checks over 15 s all read that, on phone, tablet and computer. The send also stays `seen: false` in the database, so the dot follows the person back to Fresh and Followed. With main's `src/`, P3 passes 3 of 3.
- EXPECTED: the dot goes and the send is marked seen once the list on screen shows the new game, as on main.
- FIX: post seen whenever `news` turns true while the list is on screen. For example, use an `$effect` on `signedIn && news` in `YourTurn.svelte` in place of the `onMount` check, guarded so it posts at most once per change. Add P3 as a journey in `tests/browser/tabs-show-now.test.ts`. Files: `src/features/sends/YourTurn.svelte` (or `src/routes/your-turn/+page.svelte`) and `tests/browser/tabs-show-now.test.ts`.

## Notes (not blocking)

- N1, there before this PR: on a computer, SvelteKit's hover preload (`data-sveltekit-preload-data="hover"` in `src/app.html`) keeps a page with no age limit. If you hover over a tab, a friend then sends, and you press the tab, you see the old page (P4). That fails on main `3efa80e` too. In `kept.svelte.ts`, `arrival()` treats a page it did not ask for as new (`since = setOff`, no refresh), so the PR doesn't add a refresh here either. The bottom bar's links reach this too. Follow-up: treat a page that came in at once with no `askedAt` entry as possibly old, or turn hover preload off on the tab links.
- N2, theoretical, not reproduced: say a like is pressed, and the quiet refresh is asked for before the server stores that like. The refresh's merge sets `since` to the refresh time, so the like can show as undone until the like's answer comes back (a flicker of about one round trip).
- N3, process: GitHub reports the PR as `dirty` (it conflicts with main `a1473fe`), but only in `docs/superpowers/progress.md`. A clean merge of main that touches only that file carries a PASS forward. It needs doing before the merge.
- Checked and fine: the follow, like and send staleness from reviews 1 to 3 (journeys and the nudge probes pass). The merge in `Feed.svelte` keeps the clips up to the current one, and keyed sections keep their elements (P2 and the "without moving" journey). A failed refresh leaves the tab as it was (P1). A move during a quiet refresh doesn't start a second refresh, since `quietRefresh` clears `askedAt` and `ready()` waits while `kept.quiet`.
