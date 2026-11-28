# Feed keys (PR #441), implementation audit 1

Reviewed head: `cae4d56` (cae4d56bbfd5c2de3fbeb73f3ed1502ae50d5432), base `main` 2a1ec22. Lane 2 (reviewed as lane 2 at the coordinator's ask: the hook reads lane 2; the builder wrote lane 1). Reviewer: fresh session, Opus 5.5, medium. Written 2026-11-28 02:19 UTC.

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## Verdict

**FAIL: 2 red.** The keys work on all three devices and the journey is honest (it fails without the change). Two gaps: the before-launch state (what the live site shows today, until 30 Nov) has no check, and a held key keeps pressing.

## What ran

| Check | Result |
| --- | --- |
| `pnpm lint` | green (0) |
| `pnpm typecheck` | green, 0 errors |
| `pnpm test` | 2437 of 2437 passed, 169 files |
| `feed-shortcuts.test.ts`, phone (WebKit), tablet, computer, Playwright 1.63 image, retries 0 | 18 of 18 passed |
| same journey with `Feed.svelte` from `main`, computer | 4 failed (Enter, I, M, R), 2 passed (Space, Share): the journey fails by itself |
| `feed-controls.test.ts`, three devices | green (117 passed in the run together with the journey and the probe) |
| Probe `2026-11-28-feed-keys-1-probe.test.ts.txt` (project files, audits/) | see R1 and R2 |
| Merge of #435 and of #440 onto `cae4d56` | both clean; neither touches `onKey`, `.band .play`, `.gamelink`, the Repost button or `button.sound` |

Not run: `gamepad.test.ts` (the pad presses with `click()` and offers only arrow keys and Escape as key events, `src/lib/pad-focus.ts:169-205,312`, so it never sends Enter, I, M or R to this handler); the full browser suite.

## Criteria

1. Enter presses Play (Wishlist before launch): Play checked by the journey; Wishlist works (probe, 3 of 3 devices: answer 200, button turns to "On your wishlist") but no journey checks it. **R1.**
2. I opens the game's page: met, journey.
3. M on and off: met, journey. A held M flips many times. **R2.**
4. R reposts and takes back: met, journey (signed in). A held R repeats the same way, as far as the busy guard lets it (R2).
5. Space moves on: met, journey.
6. A field keeps its letters, a focused link or button keeps Enter, nothing while a sheet is open: met by reading (`Feed.svelte` onKey: the `dialog[open]` return stays first, then the field and Enter guards); the Share case is in the journey.

CRUD: the change adds nothing a user makes; Repost's create and delete by key are in the journey.

## Findings

R1. UNIT: `tests/browser/feed-shortcuts.test.ts`. VERDICT: red. REQUIREMENT: criterion 1 ("before launch, the Wishlist button in Play's place"), and the standing rule that each criterion has a check; the live site is before launch until 30 Nov 11:00 CT, so this is the state people meet now. REASON: no journey presses Enter before launch. EVIDENCE: the journey only waits for a `/g/<slug>/play` request (line 37-44); `tests/browser/support/launch.ts` `beforeLaunch` is not used. The probe's first test passes on phone, tablet and computer, so the code is right and only the check is missing. EXPECTED: a journey that, before launch and signed in, presses Enter on the feed and sees the clip's Wishlist turn to "On your wishlist" (and fails on `main`). FIX: add that test to `tests/browser/feed-shortcuts.test.ts` (the probe's first test is a starting point). Only that file.

R2. UNIT: `src/features/feed/Feed.svelte`, `onKey` shortcut branch. VERDICT: red. REQUIREMENT: criteria 3 and 4 ("the same as pressing" the control) and the drunk-grandma rule: a key held a little long must not do the thing over and over. REASON: the branch ignores `event.repeat`, so every auto-repeat of a held key clicks the control again. EVIDENCE: probe "holding M" (one press and four repeats, as a key held about half a second sends) on phone, tablet and computer: sound was off before and on after, flipped five times; a person holding M sees the speaker flicker and ends on whichever way the count falls. A held R reposts, takes it back, reposts again as each answer comes back. EXPECTED: a held key presses its control once, as a tap does. FIX: in the shortcut branch, after the field and Enter guards, `if (event.repeat) { event.preventDefault(); return; }` before `control.click()`, plus a journey step in `tests/browser/feed-shortcuts.test.ts` that holds M (keyboard.down twice, then up) and sees it flip once. Only those two files.

## Notes (not blocking)

- N1. The PR body says lane 1; by the paths it is lane 1 (`src/features/feed/` is not on the lane 2 list), but the hook reads lane 2, so the body's Lane line could say lane 2 to match the review it got.
- N2. M, I and R also fire while the focus is on a button or link elsewhere on the page (the bottom bar, Search). That matches "a key on the feed" and is harmless; only Enter is held back, as criterion 6 says.
- N3. `sections[current] ?? undefined` turns `null` into `undefined` for `pick`; `pick` already handles both, so `sections[current]` alone would do.
