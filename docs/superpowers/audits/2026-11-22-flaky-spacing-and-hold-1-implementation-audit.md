# Flaky spacing and hold fix: implementation audit, round 1

- Pull request: #351 (`claude/project-thread-sgryob`)
- Commit examined: `4190797ecd967c77f02f0b68c43060e86cf0a866`
- Lane: 2 (`tests/browser/support/hold.ts` is shared journey support). One fresh review.
- Verdict: **PASS**, 0 red.

## What was checked

The diff against `main` (`85916ae`): `tests/browser/make-second-look.test.ts`, `tests/browser/support/hold.ts`, `docs/superpowers/progress.md`. No product code.

### 1. `make-second-look.test.ts:302` [phone]

- Cause confirmed in code: `src/lib/look.css:1972` defines `rise` (28px, 460 ms, each line later than the one before), and the old journey measured what is above the link and the link's words in two separate `evaluate` calls, so the two could be caught at different points of the rise.
- Fix: `wordsHaveSettled` (`tests/browser/support/look.ts:132`) awaits every finite animation's `finished` and `document.fonts.ready`. It waits on events, not on a time. Both measurements then come from one `evaluate`.
- The 16px floor is unchanged. The link lookup is stricter than before: it must be inside `main.games > .note`, and the journey throws if it is not. `src/routes/make/+page.svelte` puts it there.
- `textContent.trim()` without `?.` matches other journeys (`look.ts:243`, `take-off.test.ts:109`).

### 2. `support/hold.ts` (edit-page `:451`, `:482` [tablet])

- New order in `release`: wait for `__letItStart`, wait for the held page's `load`, `unrouteAll({ behavior: "wait" })`, then let the screen start.
- The held start script awaits a promise inside a `.then`, which does not delay `load`, so the wait cannot hang on the hold itself.
- After `load`, nothing the held page asked for is in flight, and the starting screen's first new request (`nodes/1`) is sent with no route installed. That removes the window the PR describes.
- The hold still holds: the screen cannot start until `__letItStart` runs, so journeys still act on it first.
- No timeout raised, no retry, no skip, no sleep. `unrouteAll` already removed every route before this change.

### Kit practice

- PR body has `## Lane` and ends with "Requested by **McThayDT**".

## Notes (not blocking)

- The tablet race never reproduced locally (126 probe runs passed). The fix rests on Playwright 1.63's source and the two CI recordings; the full CI run is the real check, and it is the PR's one open criterion.
- If it recurs, the trace should show whether any request was still paused when the route was removed.
