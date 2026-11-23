# Panels feel like an app: implementation audit 2

- Pull request: #323, lane 2 (`src/lib/look.css`, `src/features/feed/Feed.svelte`). Reviewed commits: the fix `1bfff9c`, and the head `7c6b49a` (a merge of `main` at `5bbea3e` onto `1bfff9c`).
- Reviewer: fresh session, Opus 5.5, medium. Written 2026-11-22 15:20 UTC.
- Brief: the owner's words and acceptance criteria 1 to 5 in the pull request body; round 1's finding R1 and notes 2 and 3 (`2026-11-22-panels-feel-like-an-app-1-implementation-audit.md`).
- Verdict: **PASS: 0 red**, 3 notes.

## What was checked

- R1 (checks that could not fail). The fallbacks are gone: `pressFlash` is read with no fallback, and the held-menu and picture-drag checks go through `declares`, which fetches the site's own style sheets and looks for a rule that matches the element and declares the value. So the checks no longer depend on whether the engine reports Safari's own properties.
- Each style line removed in turn, run by this session (not the builder's log): `tests/browser/panels-feel-like-an-app.test.ts` on the computer profile (Chromium) at `1bfff9c`, after a clean run of all 8 tablet and computer tests. Every removal failed the journey:

  | Line removed | Result |
  | --- | --- |
  | `overflow: hidden` behind a panel | 2 failed |
  | panel `-webkit-user-select` and `user-select` together | 2 failed |
  | panel `-webkit-touch-callout` | 2 failed |
  | feed `touch-action: pan-y` | 1 failed |
  | play `touch-action: pan-x pan-y` | 1 failed |
  | `-webkit-tap-highlight-color` | 3 failed |
  | `touch-action: manipulation` | 1 failed |
  | page `overscroll-behavior: none` | 3 failed |
  | link and picture `-webkit-touch-callout` | 1 failed |
  | button `-webkit-user-select` and `user-select` together | 1 failed |
  | `-webkit-user-drag` | 1 failed |
  | feed `overscroll-behavior: none` (`Feed.svelte`) | 1 failed |

  The held-menu and drag rows fail on Chromium, which drops those properties from computed style, so they are caught by the sheet reading itself and not only by WebKit. The phone (WebKit) profile was not run here: WebKit is not in this container. The builder's phone log (`handoff/panels/each-line-removed.log`) agrees row for row.
- Round 1's notes: note 2 is taken (the feed's own `overscroll-behavior` is `none` and the journey reads it); note 3 is taken (the global no-select rule is now `button, a.button, summary, label, svg`, and the journey checks a link in a paragraph still selects).
- The merge `7c6b49a`: its parents are `1bfff9c` and `5bbea3e`. Its diff against `main` touches the same 5 files as `1bfff9c` against its base `5cfe939`, and the source, test and audit hunks are identical apart from line offsets; `progress.md` adds this change's 3 lines and has no conflict markers. `main`'s new `look.css` lines (#322, #324) do not touch any property this change sets.
- At `7c6b49a`: `pnpm lint` exit 0, `pnpm typecheck` 0 errors, `pnpm test` 1886 passed; the new journey with `feed`, `look-layout` and `play` on tablet and computer, 114 passed. CI's quick draft run on `7c6b49a` is green (verify, postgres, 6 browser pieces, gate).
- CRUD: the change adds nothing a person makes; no journey is owed.

## Red

None.

## Notes (not blocking)

1. Removing only one of a `-webkit-user-select` / `user-select` pair passes on Chromium, which treats them as one property. Removing both fails, as above. Each pair is one rule for two engines, so this is expected; WebKit's phone run is where the prefixed one alone would show.
2. `declares` answers yes when any rule that matches the element declares the value, even if a later rule overrides it. No rule in `look.css` at `7c6b49a` sets `-webkit-touch-callout` or `-webkit-user-drag` to anything else, so today it reads true. If one is ever added, the check would not see it.
3. The real feel (swipe the first and last game, pinch, double tap, hold on a game's name) can only be tried on a phone after deploy, as the pull request says.

## Verdict

`7c6b49a` PASS: 0 red.
