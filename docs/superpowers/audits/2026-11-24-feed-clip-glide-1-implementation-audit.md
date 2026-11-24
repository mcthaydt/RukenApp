# Feed clip glide, implementation audit 1

Pull request #396 ("Feed clip move: quick start, slow settle, and back with the arrow"), head `4fcacc6`. Lane 2 (`src/lib/page-moves.ts`, `src/lib/look.css` are shared). Reviewer: fresh session, Opus 5.5, medium. Written 2026-11-24 17:42 UTC.

**Verdict: 4fcacc6 PASS.** No red findings. Three notes, none blocking.

## What the change must do (the owner, 2026-11-24 16:52 UTC)

"Speed up fast then slow down at the end and make it go into the panel smoothly", and the move must also play from the game page back to the feed.

## Checked

| Criterion | How | Result |
|---|---|---|
| Ease-out curve, settles into the box | Read `look.css`: clip group, old and new root all 450 ms on `cubic-bezier(0.22, 1, 0.36, 1)` (a quick-start, slow-end curve). The root pair keeps `mix-blend-mode: normal` from the shared `html[data-move]` rule, so the old page fading over the whole new one never brightens or dims the screen. The flying clip stays on top until 55% of the time (about 95% of the distance on this curve), then melts into the arriving clip. | PASS |
| Back arrow plays the shrink when the page came from the feed | `feed-to-game-grow.test.ts` new journey, all three profiles, phone in WebKit | PASS |
| Arrow on a game page opened directly is the plain link with a slide | Same file, all three profiles | PASS |
| `backToFeed` history cases | `tests/lib/page-moves.test.ts`: 22 passed | PASS |
| Earlier #393 criteria and neighbouring journeys | `feed-to-game-grow`, `page-moves`, `feed`, `feed-controls`, `game-page`, `bar`, `play`, `report-a-game` | PASS |
| Lint | `pnpm lint`: clean on the PR's files (the only error was the reviewer's own untracked local Playwright config) | PASS |
| Merges with current `main` (`8de4a3c`, #394 and #395) | `git merge-tree`: no conflicts | PASS |

## Exploratory probes (`/mnt/project-files/audits/2026-11-24-feed-clip-glide-1-probe.test.ts.txt`, not committed)

- **A. Arrow pressed while the grow is still playing:** lands on `/`, feed on the tapped clip, no clip left named, Forward reopens the game (so it was Back, not a new page). PASS on phone (WebKit), tablet, computer.
- **B. Feed, game, Play, browser Back, then the arrow:** still the browser's Back, plays "grow", feed on the tapped clip, Forward reopens the game. PASS on all three.
- **C. Feed, game, reload, then the arrow:** plain link with the "back" slide, as intended once the page's memory is fresh. PASS on all three.

## Runs (all on head `4fcacc6`, phone in WebKit through the Playwright v1.63.0 image)

- Run 1: `feed-to-game-grow` plus probes, 27 tests: 24 passed, 3 failed. The 3 failures were probe B's first version looking for a maker link that the test game does not have (the reviewer's probe, not the product). Rewritten to use Play.
- Run 2: probes plus `page-moves`, `feed`, `feed-controls`, `game-page`, `bar`, `play`, `report-a-game` on all three profiles: **339 passed, 0 failed, 0 flaky**, 8.2 minutes.
- Not run: the full browser suite, typecheck (the PR reports svelte-check clean in `src` and `tests`), a real iPhone.

## Read-through of the history counting (`noteMove`, `backToFeed`, layout `onNavigate`)

- Every client move that reaches `onNavigate` now calls `noteMove` with its step count, including the held-move and maker-area early returns, so the depth stays in step with the browser's history for links, Back and Forward (delta from SvelteKit).
- The only way the count can drift is upward: a move that replaces the history entry instead of adding one is counted as one page on. Drifting upward only makes `backToFeed` false, so the arrow falls back to the plain link it was before this change. It never sends a person Back to somewhere other than the feed. Nothing on the game page adds history entries without a navigation (no shallow routing, no `#` links), which is the case that could drift the other way.
- A full reload or a fresh visit clears the module's memory, so the arrow is the plain link (probe C).
- Modified clicks (middle, Cmd, Ctrl, Shift, Alt) keep the link's own behaviour.

## CRUD

The change adds nothing a person can make, change or delete. Not applicable.

## Notes (not blocking, not fixed here)

1. **After a form answer on the game page, the arrow goes back to the plain link.** `src/lib/stay-in-app.ts:54` sends a form's redirect with `goto(..., { replace: true })`, and `WishlistButton.svelte:45` uses `goto`; `onNavigate` counts each as one page on. If a person answers something on the game page that redirects back to it, the arrow then slides to the top of the feed instead of shrinking into the clip. Safe fallback, same as before this change. A bounded fix, if wanted later: pass `steps = 0` when the navigation replaced its entry.
2. **Leave game on the play screen is a link to the game page**, so after Feed, game, Play, Leave game the arrow is the plain link (no shrink). Browser Back from the play screen keeps the shrink (probe B). Unchanged from before.
3. **The feed's bar of places** has its own view transition name and fades on the browser's default timing while the page takes 450 ms. Not visible as a problem in the journeys; mentioned only because the page timing changed.
