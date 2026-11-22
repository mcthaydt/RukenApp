# Tap to open feed video: implementation audit 2

- Branch: `claude/project-thread-74qnu2`. Commit examined: `34daa2e` (fixes since audit 1 at `bde6f45`: `2503291`, `356dd88`; merges cleanly with `main` at `c556cc0`).
- Lane 2 re-audit, fresh session, Opus 5.5, medium. Audited 2026-11-22 16:37 UTC (from `date`).
- Brief: the owner's ask (2026-11-22 15:50 UTC) "tapping a feed video should open the page, not mute", the feed spec's changed D7 and design lines, and audit 1's R1 and its FIX.

**Verdict: PASS, 0 red, 4 notes.**

## What ran

| Check | Result |
| --- | --- |
| `pnpm lint` | exit 0 |
| `pnpm typecheck` | exit 0, 0 errors, 0 warnings |
| `pnpm test` | 128 files, 1,886 tests, all passed |
| `pnpm test:browser tests/browser/feed-controls.test.ts tests/browser/feed.test.ts --project tablet --project computer` | 42 passed |
| The three new or extended journeys, `--repeat-each=5`, tablet and computer | 30 passed, none flaky |
| WebKit (`phone` profile) | not run: no WebKit in this container; CI runs it |

Mutations (each put back with `git checkout` after its run; nothing committed):

| Change made to `Feed.svelte` | Journey | Result |
| --- | --- | --- |
| `a.open` preload back to `"tap"` | "a swipe or a pointer resting on a clip or its name asks the server for nothing…" | failed on tablet and computer: cookies `["rk_arrival"]` |
| `data-sveltekit-preload-data="off"` removed from `a.gamelink` (inherits the body's `"hover"`) | same | failed on tablet and computer: cookies `["rk_arrival"]` |
| snapshot `restore` returns before `returnTo` | "Back from a game's page comes back to the clip it was opened from" | failed on tablet and computer: expected the second clip, got the first |
| a press on the speaker no longer starts a held clip (`started.includes(slug)` disabled) | "with reduced motion the next clip is simply there…" (extended) | failed on tablet and computer: `paused` stayed `true` |

## Audit 1 findings

- **R1: fixed.** `a.open` (`src/features/feed/Feed.svelte:256-262`) and `a.gamelink` (`:315`) carry `data-sveltekit-preload-data="off"`; the maker link already did (`:304`). The new journey (`tests/browser/feed-controls.test.ts:197`) rests a pointer on the clip and the name, sends `touchstart`, `touchend` and `mousedown` on both, moves one clip, and checks there is no `rk_arrival` cookie and no request for the first game's page; a press then opens the second game. SvelteKit's tap preload listens for `touchstart` on the container, so the dispatched events reach the same handler a finger does, and the mutations above show the journey fails without each attribute.
- **N1 (Back loses the place): done.** `snapshot()` from `$app/navigation` keeps the current clip's slug and scrolls back to it on return (`Feed.svelte:151-168`); a slug no longer in the feed leaves the first clip on screen. Its journey fails without the restore (above).
- **N5 (speaker starts a held clip): done.** The reduced-motion journey now checks the clip waits paused, the speaker starts it, and the page stays on `/`; it fails without that behaviour (above).
- **N2, N3, N4:** still open, unchanged; see notes below.

## Red

None.

## Notes (not fixed here)

- **N1. #321 (glass) still conflicts.** `git merge-tree` of `34daa2e` with #321's head `062e20c` conflicts in `src/features/feed/Feed.svelte`: #321 puts `background: var(--glass-bg)` and both `backdrop-filter` lines on `.sound svg`, which this branch folds into `.sound`. Whoever merges second moves those three lines onto `.sound`, drops `opacity: 0.8`, and adds the speaker to the glass check, since no test sees the speaker's glass.
- **N2. #323 (`39fb97e`) still leaves the clip link draggable on a computer.** It merges cleanly with `34daa2e`. Its `:is(a, img, video) { -webkit-touch-callout: none }` covers a long press on `a.open`, but `-webkit-user-drag: none` covers only `img, video`, so a press-and-drag on the clip drags its address. Follow-up for #323 or the custom-controls work: `a` in the drag rule, or `draggable="false"` on `a.open`.
- **N3. Play loads ahead too, and its load starts a play (on `main` already, not this change).** `a.button.play` (`Feed.svelte:319`) inherits the body's `data-sveltekit-preload-data="hover"` (`src/app.html:8`), so a pointer resting on it or a finger landing on it runs `/g/<slug>/play`'s load, which for someone who may play hits the play rate limit and writes a `playSession` row (`src/features/play/sessions.ts:53-90`). From reading the code; not probed here (it needs a member account). Same fix shape as R1: preload `"off"` on links whose load writes, with a journey. Reported, not part of this change.
- **N4. WebKit not run here.** The phone profile runs only in CI; the pull request's CI run is the evidence for it. The Back-to-clip journey depends on `scrollIntoView` inside `main.feed`, which is worth watching there.
- The spec's D7 does not mention Back keeping the clip; a line there would let a later change see it is meant.

## Checked and fine

- The diff since `bde6f45` touches only `Feed.svelte`, `tests/browser/feed-controls.test.ts` and audit 1's file; the live-state file was removed before this re-check (`34daa2e`).
- Comments on the two links say why they never load ahead, in plain words.
- CRUD: the change adds nothing a person makes.
- Merges cleanly with `main` (`c556cc0`) and with #323.
