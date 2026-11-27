# Bar through moves (#427), implementation audit 2

- Pull request: #427, branch `claude/project-thread-pej2xk`
- Commit examined: `cb9baf54b24c334a134edb3403b30648a0dc925a`
- Lane: 2 (`src/lib/look.css`, `src/lib/page-moves.ts`). Reviewer: fresh session, Opus 5.5, medium.
- Written: 2026-11-27 16:15 UTC
- Verdict: **PASS** (0 red)

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## What changed since audit 1 (`9f034cb`)

Tests only: `tests/browser/support/moves.ts` (+14) and `tests/browser/bar-through-moves.test.ts` (+58 −22). The source fix (`look.css`, `page-moves.ts`) is unchanged since audit 1, so audit 1's reading of the cause and the fix stands; it was re-run here, not re-read.

## What ran

All in this cloud container, in `mcr.microsoft.com/playwright:v1.63.0-noble` (Node 24.20.0, host network, Postgres 16 in `postgres:16`, the config's own stand-ins), on all three profiles: phone = WebKit (iPhone SE), tablet and computer = Chromium. Emulation only, no physical phone.

| Run | Code | Result |
| --- | --- | --- |
| `bar-through-moves` | PR head | 3 of 3 passed |
| `bar-through-moves` | PR head + `.bar a:focus:not(:focus-visible), nav[aria-label="Feeds"] a:focus:not(:focus-visible) { outline: 3px solid red !important; box-shadow: 0 0 0 3px red !important }` | **3 of 3 failed**, all at "2 press Fresh, as the slide started": `Fresh: outline`, `Fresh: ring rgb(255, 0, 0) 0px 0px 0px 3px` |
| `bar-through-moves` | PR head + `.bar a:focus:not(:focus-visible) { box-shadow: 0 0 0 3px red !important }` only (the bar alone) | **3 of 3 failed**, all at "7 press You on the bar, as the slide started": `You: ring rgb(255, 0, 0) 0px 0px 0px 3px` |
| `bar-through-moves` | PR head with `src/lib/look.css` and `src/lib/page-moves.ts` put back to `origin/main` (306ddc7) | tablet and computer **failed** at "1 swipe to Followed, 0ms: the bar's top left corner", 46 and 27 against 16; phone passed (WebKit never showed the patch, as audit 1 found) |
| `feed-leave-and-return` (shares the changed `moves.ts`) | PR head | 6 of 6 passed |

The injected rules and the source revert were undone after each run (`git status` clean before the audit commit).

CI on `cb9baf5`: gate, verify, postgres, all six browser pieces (quick, draft), commit-authors and pr-rules all succeeded.

## Audit 1's red is fixed

Audit 1 asked that a ring left by the press fail the journey on tablet and computer. It now fails on all three profiles, phone included, for a ring on the tabs and for a ring on the bar alone, at the slide's start, which is when the browser takes the bar's picture. Removing the rule passes on all three.

## The test hook cannot change the product

- `window.beforeSlide` and `window.ringsNow` exist only through `page.addInitScript` in `tests/browser/bar-through-moves.test.ts`; the `startViewTransition` wrapper exists only through `watchMoves` in `tests/browser/support/moves.ts`. No file under `src/` or `cloudflare/` names either (grep).
- The hook only reads: `querySelectorAll`, `matches(":focus-visible")`, `getComputedStyle`. It sets nothing on the page. Its one side effect is a style flush just before `startViewTransition`, which the browser does itself before taking the old picture anyway.
- A journey that sets no `beforeSlide` (`feed-leave-and-return`) gets `atStart = []` and is unaffected (6 of 6 passed).

## Against the owner's ask

The owner's picture (Galaxy, Chromium) shows the dark square round the bar mid-slide. The standing journey now covers both bar artifacts the owner has hit: the square patch (corner check, every frame of 8 moves) and the press ring (at slide start, every frame, and after each move), on phone, tablet and computer, and it fails without the fix.

## Findings

None red.

## Notes (not blocking, follow-ups)

- The ring check sees an `outline`, a spread-only `box-shadow` and a tap highlight on the link itself. A ring drawn another way (a `border` change on focus, or a `::before`/`::after` on the link) would not be seen. Nothing in the bar does that today. If the bar's buttons ever get a pseudo-element or a focus border, widen `ringsNow` in the same change.
- The owner's phone is Chromium, but the phone profile is WebKit; Chromium is checked at tablet and computer widths only. The patch is width-independent (a snapshot of the bar's blur), so this is enough today. Phone-width Chromium is not in the device matrix; adding it is a matrix change, not this pull request's.
- Carried from audit 1: in the test WebKit the bar fades to about a fifth mid-slide, before and after this change.
