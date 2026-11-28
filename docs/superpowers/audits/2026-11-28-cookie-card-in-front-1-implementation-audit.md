# Cookie card in front (#467), review 1: implementation audit (lane 2)

Commit examined: `12db736` (12db73611e9585179ff4633b59ca4b410c828a33), branch `claude/project-thread-j4f71j`. Started on `d2cf9c0`; `12db736` adds only `tests/browser/cookie-what-we-keep.test.ts` and a progress.md line, no app code. Reviewer: Opus 5.5, medium, a fresh session.

**Verdict: FAIL, 2 red.**

## What ran

- `pnpm lint`, `pnpm typecheck`, `pnpm test`: typecheck 0 errors; 2453 of 2453 unit tests passed; lint clean for every tracked file (it flagged only my own untracked probe).
- Journeys here, at `d2cf9c0`: controls-overlap, sideways-phone, cookie-consent, plain-pages, report-a-game and the review probe, on phone, tablet and computer: 152 passed, 28 skipped (sideways on a computer), 3 failed. All 3 were one probe step that assumed Play re-asks on the card (it opens the Cookies screen). I rewrote it to re-ask with Like, and it passed 3 of 3. WebKit is not installed here, so the phone profile ran in Chromium with the iPhone SE window and touch (`playwright.probe.config.ts`, not committed). CI runs real WebKit.
- At `12db736`: `cookie-what-we-keep.test.ts` with `--repeat-each 2`: phone 4/4 and tablet 4/4 passed, **computer 0/4** (R2). Mutation: I took `/privacy` off `READ_IN_PEACE` and the journey failed on phone and tablet at `card(page).toHaveCount(0)`. So it does catch a card that blocks What we keep.
- Probe: `2026-11-28-cookie-card-in-front-1-probe.test.ts.txt`.

## Checked and fine

- **Overlap, unanswered and answered**, at 320×568, 375×667 and 667×375 (Home Screen sideways), before and after launch: the new before-an-answer run and the existing consented runs pass on all three profiles. The card is `:modal`, so nothing behind it takes a press: a tap or click on the dim over the bar left the URL and the card as they were.
- **Keyboard**: on open the card itself holds the focus and draws no ring (outline none, no shadow). The first Tab goes to I agree, then Not now, then What we keep, with the ring. Tab stays in the card (the browser's own stop, then back to I agree). Escape is Not now, even as the first key with no click first (card gone, `notNow` set). Afterwards Tab reaches the page.
- **Gamepad**: the first move lands on I agree, the pad walks I agree, What we keep and Not now, and B is Not now with the URL unchanged. A on I agree keeps the yes. Afterwards the pad moves on the page ("Back to Ruken").
- **Touch and mouse**: a tap on Not now frees the page with no ring left (focus on body), and the bar then works. When Like re-asks, the focus is on I agree with no `:focus-visible` after a tap, and the card is `:modal`.
- **Feed behind the card**: ArrowDown, M, the pad's Down, RB and the mouse wheel moved nothing behind it (same clip, still muted, still on Fresh). The feed's `dialog[open]` guard covers it.
- **Glass**: over the feed the card is the panel glass (`rgba(17,19,20,0.35)`) with the dim behind it (`rgba(17,19,20,0.62)`). On /help (no `data-glass`) it is solid `rgb(17,19,20)` with no backdrop filter. That matches "glass only over moving content".
- **What we keep**: no card on /privacy or /cookies, and none after returning from it with Back; the question waits on the page they came from.
- CRUD: the change makes nothing new. The yes is still created, read and taken back in `cookie-consent.test.ts`, which passed.

## Red findings

### R1. On a sideways phone in a browser tab, the cookie card now sits in front of "Turn your phone upright"

- UNIT: `src/features/consent/Notice.svelte` (`showModal`) with `src/lib/turn-upright.svelte` and `src/lib/look.css` (`.upright`, z-index 100).
- VERDICT: red.
- REQUIREMENT: the owner's rule that a sideways phone in a browser is blocked by the upright notice (memory: "block landscape on sideways phone in browser"), and the brief's "the card never covers anything". Before this change the card (`aside`, z-index 30) sat under the upright notice (z-index 100).
- REASON: a modal `<dialog>` is drawn in the browser's top layer, above every z-index. So the cookie card now covers the notice that tells the person to turn the phone, and it takes presses on a screen that should be blocked.
- EVIDENCE: probe "sideways phone in a browser tab" (phone profile, 667×375, not installed, NOT_CONSENTED, /help): `.upright` visible, `{"cardModal":true,"hitInCard":true,"hitInUpright":false}`. The screenshot shows the cookie card in the middle with the upright notice blurred out behind it. `controls-overlap` cannot see this: it counts only what is inside the modal, and it runs sideways in Home Screen mode.
- EXPECTED: in a browser tab held sideways, "Turn your phone upright" is the only thing on screen. The cookie question asks once the phone is upright.
- FIX: while the upright notice shows, the card is not shown. One way is not to render or open `Notice` while the upright notice applies. Another is a rule under the `.upright` media query, with the layout knowing it is in a tab, that keeps `dialog.consent` from drawing. Add a journey in `tests/browser/fits-the-screen.test.ts` (which holds the tab case): before a yes, sideways in a tab, the element at the middle of the screen is inside `.upright` and no `dialog.consent` is visible. It must fail at `12db736`. Files: `src/routes/+layout.svelte` or `src/features/consent/Notice.svelte`, `src/lib/look.css`, that journey.

### R2. The new What we keep journey fails on the computer profile every time

- UNIT: `tests/browser/cookie-what-we-keep.test.ts:46`.
- VERDICT: red.
- REQUIREMENT: green CI, and criterion 7 ("its link opens that page fully usable") proven on every profile.
- REASON: `waitForFunction(() => document.elementFromPoint(100, 200)?.closest("main") != null)` assumes `main` is at x=100. On a 1280-wide computer, What we keep's `main` is a centred reading column, so the point is outside it and the wait never ends.
- EVIDENCE: computer project, both starts (`/` and `/help`), `--repeat-each 2`: 4 of 4 `TimeoutError: page.waitForFunction: Timeout 5000ms exceeded` at line 46. Phone and tablet: 8 of 8 passed.
- EXPECTED: the journey passes on phone, tablet and computer.
- FIX: aim at the middle of `main`'s own box (for example, read `page.locator("main").boundingBox()` and wait for and wheel at its centre) instead of a fixed point. File: `tests/browser/cookie-what-we-keep.test.ts` only.

## Notes (not blocking)

- N1. **Conflict with #462** (head `b99d2ca`): a trial merge conflicts in `src/routes/+layout.svelte` (the card's `{#if}`; #462 adds `&& !ASKED_NEXT.includes(...)`) and `tests/browser/controls-overlap.test.ts` (imports and the before-a-yes describe). Whichever merges second must keep `!ASKED_NEXT` in the `{#if}` and add `/make` to `NO_CARD` in controls-overlap.test.ts. Otherwise this PR's new "the cookie card, in front" check fails on `/make` once #462's `SIGNED_OUT` holds it. #462's `cookie-card-pad.test.ts` header still says the card sits "at the foot of every screen". Its walks should still pass, because the pad's scope is the modal, but run it after the merge.
- N2. With the card `:modal`, `pad-focus.ts` `scope()` takes the last `dialog[open]` in document order, not the top-layer order. If a sheet (Share, Report) were ever open when a press re-asks, B could reach the wrong one. No path does that today.
- N3. `::backdrop` reads `--dim-bg` and `--dim-filter`. Browsers before ::backdrop inherited (Safari < 17.4, Chrome < 122) draw no dim; the card is still in front and modal.
- N4. In the probe, Like followed by I agree read as liked on 1 or 2 of 3 profiles straight after the card closed (the press goes on asynchronously). The path is unchanged by this PR, and `cookie-consent.test.ts` covers it.

## CI

At `12db736` the quick draft run was still in progress when this was written: postgres, commit-authors and pr-rules passed; verify and the browser shards were running. A quick draft run does not include every journey, so R2 may not show there.
