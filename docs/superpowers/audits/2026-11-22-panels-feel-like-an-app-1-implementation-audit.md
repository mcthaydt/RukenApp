# Panels feel like an app: implementation audit 1

- Pull request: #323, lane 2 (`src/lib/look.css`). Reviewed commit: `29d57a1`.
- Reviewer: fresh session, Opus 5.5, medium. Written 2026-11-22 14:23 UTC.
- Brief: the owner's words quoted in the pull request body, and its acceptance criteria 1 to 5.
- Verdict: **FAIL: 1 red**, 5 notes.

## What was checked

- The diff against `main` at the merge base `b1ba62a`: `src/lib/look.css` (+46), `tests/browser/panels-feel-like-an-app.test.ts` (new), `docs/superpowers/progress.md` (+3).
- The owner's own messages (2026-11-22 13:41, 13:42, 13:43, 13:46 UTC) against the rules added.
- The feed markup and its scoped styles (`src/features/feed/Feed.svelte`): `main.feed` is `position: fixed; inset: 0; overflow-y: auto; overscroll-behavior: contain`.
- A Chromium probe (Playwright's Chromium in this container) of what `getComputedStyle` returns for each non-standard property the journey reads, with and without the rule set. WebKit is not installed in this container, so WebKit was not probed.
- Trial merges of `29d57a1` with `main` (`5cfe939`), #319 (`ac156ff`), #320 (`fddc3aa`) and #321 (`77c71cd`).
- Check runs on `29d57a1`: only `pr-rules-run` (success). CI has not run, see note 1.

## Red

### R1. The held-menu checks can never fail

- UNIT: `tests/browser/panels-feel-like-an-app.test.ts`, `touchRules` (`holdMenu`, `pressFlash`) and the `/help` journey (`linkHoldMenu`, `pressFlash`, `pictureDrag`).
- VERDICT: red.
- REQUIREMENT: acceptance criterion 4 ("Criteria 1 to 3 are checked by" the journey) and the rule "A check is a test that fails by itself".
- REASON: each non-standard property is read with a fallback equal to the expected answer (`|| "none"`, `|| "rgba(0, 0, 0, 0)"`), so when the browser does not report the property the assertion passes whatever the CSS says.
- EVIDENCE: in Chromium, `getComputedStyle(el).getPropertyValue("-webkit-touch-callout")` is `""` both on an element with `-webkit-touch-callout: none` and on one without it, so `holdMenu` and `linkHoldMenu` are `"none"` on tablet and computer even if every `-webkit-touch-callout` line is deleted. In WebKit `-webkit-touch-callout` is an iOS-only property, so it is very likely `""` on the phone profile too (not probed here: no WebKit in this container). "All 4 journeys fail on `main`" does not show this, because each of the 4 fails on another assertion first. By contrast `-webkit-tap-highlight-color` (default `rgba(0, 0, 0, 0.18)`) and `-webkit-user-drag` (default `auto`) are reported by Chromium, so those two are real there; their fallbacks still hide the answer on any engine that does not report them.
- EXPECTED: every assertion the journey makes goes red when the one CSS line it covers is removed, on at least one of the three devices.
- FIX: drop the fallbacks. For a property the engine reports, assert the computed value. For `-webkit-touch-callout`, which no test engine reports, check the declared rule instead: either walk `document.styleSheets` for a rule that matches the element and declares `-webkit-touch-callout: none`, or add a check in `tests/lib/look.test.ts` that reads `src/lib/look.css` and asserts the panel rule and the `:is(a, button, …)` rule each declare it. Prove it by deleting each covered line once and seeing the check fail; name the run in the pull request. Files: `tests/browser/panels-feel-like-an-app.test.ts`, and `tests/lib/look.test.ts` only if that route is chosen.

## Notes (not blocking, recorded for the owner and later work)

1. **The branch conflicts with `main` and CI has not run.** GitHub shows the pull request as `dirty`. A trial merge with `main` (`5cfe939`) conflicts only in `docs/superpowers/progress.md`; trial merges with #319, #320 and #321 conflict in the same file and nowhere else. No CSS or markup conflicts: #319 changes `Bar.svelte`, #320 `app.html` and icons, #321 the glass tokens and backgrounds in `look.css` and `Feed.svelte`, none of the lines this change adds. The builder resolves `progress.md` and CI runs before the merge, as `release` says.
2. **The feed itself can still bounce at its first and last game on an iPhone.** The change sets `overscroll-behavior: none` on the page root; the feed is its own scroller and keeps `overscroll-behavior: contain` from `Feed.svelte`, which stops the page behind from moving but lets the feed rubber-band in Safari. Native apps bounce too, so this does not break the "it's an app" feel and is not red; but the first journey's title says the feed "never ... bounces" while it reads only the page root. If the owner wants no bounce at all, `Feed.svelte`'s `overscroll-behavior` becomes `none` and the journey reads `main.feed` as well. The owner's walk on a phone settles it.
3. **Links can no longer be selected anywhere, also inside a paragraph.** `:is(a, button, summary, label, img, video, svg) { user-select: none }` is global, so selecting a sentence on `/help` that contains a link copies it without the link's words (in Chromium and Safari a `user-select: none` inline is left out of the copied text). The owner asked that only the game panel not highlight and that the rest still select. A narrower rule (links and buttons in the bar, the feed and the play screen, plus `a.button`) would keep reading text whole. Not red: the owner also asked for an app feel "at all times", and links as tap targets fit that.
4. **Zoom: pinch is kept on reading screens and removed on the panels.** That matches "not be able to zoom in to the panel" and keeps WCAG 1.4.4 resize for reading. Whether iOS Safari honours `touch-action: pan-y` against a pinch cannot be shown in emulation (the pull request says so); the owner's phone walk is the only check. Before iOS 16 Safari also ignored `overflow: hidden` on the root, so on those phones the page behind can still move; 16 and later are fine.
5. **Coordinator's sweep items that this change does not cover, and where they are.** `theme-color` is in #320 (`<meta name="theme-color" content="#112f2c">`). `viewport-fit=cover` is not set anywhere, so `env(safe-area-inset-*)` stays 0 and the page keeps clear of the notch, which is correct as is. Focus rings already use `:focus-visible`, which does not show on a tap. No action needed here.

## Verdict

`29d57a1` FAIL: 1 red. R1 is the only change asked for; the CSS itself meets criteria 1 to 3 as written.
