# Cookie card in front: implementation audit, round 2

Pull request #467, head `fc0c0446ada6106f1cb3859ee58e415b7b50dd4e` (branch `claude/project-thread-j4f71j`). Lane 2, review round 2, by a fresh session (Opus 5.5, medium). Round 1: `12db736 FAIL: 2 red` (R1 card in front of "Turn your phone upright"; R2 What we keep test aimed at a fixed spot).

Brief: the owner's pick (2026-11-28 14:00 UTC): before an answer the cookie card asks in front of a dimmed screen on every page; nothing is covered. And (14:08 UTC): it never blocks the What we keep page; its link opens that page fully usable and the question waits until they return.

**Verdict: FAIL, 1 red.** The app does what the brief asks. The new journey that checks What we keep breaks on the phone profile in CI, which is Safari's engine (WebKit). Because a draft run stops at its first failure, CI never ran the round 1 sideways fix, the overlap journey or anything else on WebKit at this head.

## What ran

- CI quick run 46154965267 at fc0c044: verify, postgres, commit-authors and pr-rules passed. Browser shard 3 failed (below), shards 1, 2, 4, 5 and 6 were cancelled by fail-fast, and `gate (quick, draft)` failed.
- Here, Chromium only (this container has no WebKit), against the app at fc0c044 with the repo's own `playwright.config.ts`. The only change was a local config, not committed, that drops the WebKit warm-up and runs the phone profile in Chromium:
  - tablet and computer: `cookie-what-we-keep`, `fits-the-screen`, `controls-overlap`, `sideways-phone`, `cookie-consent`: **62 passed, 32 skipped (phone-only), 0 failed**.
  - phone profile in Chromium: `fits-the-screen`, `controls-overlap`, `sideways-phone`: **35 passed, 0 failed**. That covers the new tab-mode sideways test and the unanswered overlap journey at 320×568, 375×667 and 667×375, before and after launch.
- By hand in Chromium, using the verify skill's start (probes kept in the scratchpad):
  - Sideways browser tab at 667×375 on `/`: the card is `:modal` but `display: none`, and "Turn your phone upright" shows alone with nothing over it. The upright notice has no controls, and Tab and Enter do nothing (no cookie, no move). When turned upright to 375×667, the card shows in front. **R1 fixed.**
  - `/help` → What we keep (tap): `/privacy` with no dialog, no `:modal` and nothing `inert`. Back to `/help` brings the card back in front. Escape is Not now. Not now stays through in-app moves (Search, then Back) and asks again on the next visit. Add a game and You, after Not now, open the Cookies page. A click on the dim does nothing. Tab goes I agree → Not now → What we keep and then out to the browser, never to the page behind.

## Findings

### R1 (red): the What we keep journey uses a mouse wheel that the phone profile cannot send

- UNIT: `tests/browser/cookie-what-we-keep.test.ts`
- VERDICT: red
- REQUIREMENT: green CI (lane 2 merge rule), and the round 1 R2 fix ("aim at main's own box") working on every profile
- REASON: `page.mouse.wheel` throws on the phone profile (iPhone SE in WebKit, `isMobile`), so both journeys fail there before they check anything.
- EVIDENCE: CI job 141009502649, `[phone] › cookie-what-we-keep.test.ts:26:3`: `Error: mouse.wheel: Mouse wheel is not supported in mobile WebKit` at line 57. Round 1's "phone 8 of 8" was run in Chromium, which allows it.
- EXPECTED: the journey passes on phone, tablet and computer. On the phone it scrolls the page the way a phone does.
- FIX: in that file only, scroll by wheel where the profile has a mouse and by a touch swipe (or `locator.scrollIntoViewIfNeeded` after a swipe) on the phone. For example, branch on `test.info().project.use.isMobile` or on `hasTouch`. Keep the check that "Read the terms" ends up in view. Then push and let the draft run reach every shard on WebKit: the sideways fix (`fits-the-screen.test.ts:356`, phone only), `controls-overlap` unanswered, and `sideways-phone`.

## Notes (not blocking)

- N1. Before scripts load (or with scripts off), the card is open but not modal. There is no dim and the page behind still takes presses. On `/help` at 375×667 it sits over "Get your game on Ruken". The settled screen is fine, and the foot card before this change had the same window. A bounded follow-up: give `dialog.consent[open]:not(:modal)` a CSS dim behind it, as a fixed sibling or a box-shadow spread.
- N2. In Chrome, a close request with no recent user activation can close a modal dialog without firing `cancel`. The card would then close without `onNotNow`. It comes back on the next press that needs the yes, because the effect reopens it, so nothing gets stuck. An `onclose` that calls `onNotNow` would make it exact.
- N3. Conflict with #462 (`+layout.svelte`, `controls-overlap.test.ts`), unchanged from round 1. Whichever merges second keeps `!ASKED_NEXT` and adds `/make` to `NO_CARD`.

## Fine at this head (Chromium; WebKit still to run in CI)

Overlap with the card unanswered and answered at 320×568, 375×667 and 667×375, before and after launch. The sideways tab: the card waits under the upright notice. What we keep: free to read and use by tap, wheel and pad, and the question waits for the way back. Keyboard, touch and mouse reach the card's three controls and nothing behind it. CRUD: the only thing made is the yes, created, read and taken back in `cookie-consent.test.ts` (passed here on tablet and computer).
