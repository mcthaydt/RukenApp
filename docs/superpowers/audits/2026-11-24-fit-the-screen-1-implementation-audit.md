# Fit the screen (PR #379): implementation audit, cycle 1

Reviewed commit: `bb0d71b420bc14905f558cd70c930b404827bb78` (branch `claude/project-thread-q2xy7t`, base `715b88a`).
Reviewer: a fresh session, Opus 5.5, medium. Lane 2 (`src/lib/`, `src/app.html`, `src/routes/+layout.svelte`, `tests/browser/support/`).
Written 2026-11-24 02:25 UTC.

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## Verdict

**FAIL: 2 red.** The layout itself does what the owner asked on every screen checked, and the new journeys fail on `main` as they should. Two things block it: keys no longer scroll a long screen until the person clicks it, and the phone run in CI is red.

## Brief

The owner, 2026-11-24 00:18 and 01:23 UTC (quoted in the PR body and `progress.md`): inside the app every screen fits the window and the page never scrolls, and anything that must scroll does so inside its own view with no bar; the bottom bar never covers content (it covered Delete my account on `/me`); `/about` keeps page scrolling; a phone held sideways in a browser tab shows a frosted card asking for upright or Add to Home Screen, while the installed app works sideways with the bar on the right; the Home Screen launch is full screen. The PR's acceptance criteria are judged against that.

## What ran

- `bb0d71b`, locally (cloud container, Chromium only, no WebKit installed): the PR's touched journeys `fits-the-screen`, `scrollbar`, `browser-tab`, `bar`, `me` on tablet and computer: 58 passed, 4 skipped (phone-only). 
- The PR's `fits-the-screen.test.ts` (with `support/installed.ts`) copied onto `main` `e2a9d8f`, tablet and computer: 8 failed, 4 skipped. The new checks fail by themselves on `main`.
- Reviewer's probes (not committed; text below): a keys probe and a sweep of 14 signed-out and 11 signed-in screens at the project size plus 1280x420, 900x500 and 360x640, on tablet and computer.
- Screenshots with a touch phone emulated in Chromium (375x667, 320x568, 667x375 in a tab and installed, 1280x420).
- `pnpm lint` locally: 25 errors, all in files this PR does not touch (`playwright.config.ts`, `prisma.config.ts`, `tests/*check.test.ts` and others; local generated types differ from CI). Not counted against the PR; CI `verify (quick, draft)` on `bb0d71b` passed (lint, typecheck, unit tests, build), as did `postgres (quick, draft)`.
- CI on `bb0d71b`: `browser shard 2 of 6 (quick, draft)` failed, the other five were cancelled after it, `gate (quick, draft)` failed (run 45311043112). See red 2.
- Not run: the phone project (WebKit) locally; a real iPhone Add to Home Screen (no device).

## Red findings

### R1. Keys do not scroll a long screen until it is clicked

- UNIT: `src/routes/+layout.svelte` (or `src/app.html`), with `tests/browser/scrollbar.test.ts` and `tests/browser/fits-the-screen.test.ts`.
- VERDICT: red.
- REQUIREMENT: the PR's own criterion "A long screen scrolls inside its view by keys and wheel", the owner's 2026-11-23 rule that every screen "still scrolls by touch, wheel and keys" (`scrollbar.test.ts` header), and `CLAUDE.md` Verification: "A change does not quietly edit its own check."
- REASON: the scroller moved from the page to `body`. With nothing focused, Chromium sends End, PageDown, Space and the arrows to the page, which can no longer scroll, so a person who opens `/privacy` and presses PageDown sees nothing move. The PR made its checks pass by adding `page.locator("main h1").click()` before End in `scrollbar.test.ts` and `fits-the-screen.test.ts`, which hides the regression.
- EVIDENCE: reviewer's keys probe, `/privacy`, no click first, `body.scrollTop`/`scrollY` after the key: on `bb0d71b` End, PageDown, Space and ArrowDown all stay 0 on tablet and computer (8 of 8 fail; also after a second page load). The same probe on `main` `e2a9d8f`: 10 of 10 pass. Tabbing to the last link on `/privacy` does bring it into view clear of the bar on both (that part is fine).
- EXPECTED: on opening a screen and after every move between screens, End, PageDown, Space and the arrows scroll the view with no click first; `scrollY` stays 0.
- FIX: give the keyboard the view, for example `body` with `tabindex="-1"` focused with `{ preventScroll: true }` when the app starts and after each navigation when nothing else has focus (a bare Chromium page with the same `html`/`body` layout: PageDown left `body.scrollTop` at 0 unfocused, 577 with `body` focused this way), or another way that holds in WebKit too. Remove the added `click()` before End in `scrollbar.test.ts` and in `fits-the-screen.test.ts`, so both press keys straight after the page has settled. Files: `src/routes/+layout.svelte` or `src/app.html`, and those two tests.

### R2. The phone run is red: Join's title drops below the size its check requires

- UNIT: `src/lib/look.css`, the new `@media (max-width: 499px) and (max-height: 700px)` block for `.card.bold`.
- VERDICT: red.
- REQUIREMENT: green CI (lane 2 merge rule), and the existing check `tests/browser/join-and-help-look.test.ts:42` ("the paywall card is bold: a big title", at least 44px), which the PR body does not list among existing tests changed.
- REASON: on the small phone (iPhone SE, 375x667, the device matrix's phone) the block sets the title to `2.25rem` (36px). The PR only ran tablet and computer locally, so this was not seen.
- EVIDENCE: run 45311043112, job 138166545958, `[phone] join-and-help-look.test.ts:36`: "Expected: >= 44, Received: 36". The shard stopped after that failure ("433 did not run"), and the other five shards were cancelled, so the rest of the phone journeys on this commit have no result yet.
- EXPECTED: the paywall title stays at least 44px on the phone and Join still fits as well as it can, and every phone journey has a green result on the fixed commit.
- FIX: keep the title at or above 44px on the phone and find the height from the card's padding, gaps or band instead (the bold card was approved with a big title); changing the 44px check instead would be a design change and would have to be named in the PR body with its reason. Then get a full green phone run. Files: `src/lib/look.css` only (plus the PR body if a check changes).

## Checked and sound

- Page never scrolls: the sweep found `documentElement.scrollHeight - innerHeight == 0` and no sideways overflow on `html` or `body` on all 25 screens at all four sizes, on tablet and computer. `/about` keeps its own scrolling and scrollbar (`scrollbar.test.ts`, passed).
- The bar covers nothing: `body` ends above the bar wherever `--foot` is set; at 375x667 `/me` fits whole with Sign out and Delete my account side by side above the bar (screenshot). The sweep flagged `/make` once ("Here's how, step by step"); rechecked at rest at 360x640 and 1280x420 the link ends at y 399 with the bar at 568, and clear of the side rail, so it was a reading taken mid-slide. The feed, a game's page and a maker's page run under the glass on purpose (their own end room, unchanged).
- Long screens scroll inside the view with no bar showing; the wheel works on computer; Back restores the view's place and a new screen opens at its top (`fits-the-screen.test.ts`, passed on tablet and computer).
- Sideways card: frosted glass from the tokens (`--dim-bg`/`--dim-filter` behind, `--glass-bg`, `--glass-filter`, `--glass-edge`, `--glass-ink`, `--glass-icon`), plain words, no underline, no button needed. Hidden once installed (`display-mode: standalone`/`fullscreen` or `navigator.standalone`), and then the bar runs down the right edge (screenshot of `/me` installed, sideways). Not on `/about`.
- Home Screen: manifest has `display: standalone`, `start_url`, `scope` and `id` `/`; `app.html` has `apple-mobile-web-app-capable`, `mobile-web-app-capable`, status-bar style `black`, title, and the existing `apple-touch-icon`; Chrome reports no installability errors (`browser-tab.test.ts`, passed on computer).
- Owner rules: no new loader (nothing new waits); no underline; everything custom (own card and drawn icon); glass on the floating card. CRUD: the change adds nothing a person makes; the account journeys that create and delete stay in `me.test.ts` and `delete-account.test.ts`.
- Existing tests changed: each is named in the PR body with its reason, except that the added clicks hide R1.

## Notes (not blocking; for the owner or a later change)

- N1. On a 320x568 phone (older, smaller than the device matrix's iPhone SE) `/me` scrolls a little inside its view (What is Ruken? and the two buttons are below the fold). Within the brief's matrix it fits.
- N2. Sign in, Join and Forgot password still scroll inside their view on a small phone; the PR names this as open for the owner (it would need step-by-step screens).
- N3. The card also covers the play screen, so a game cannot be played sideways in a browser tab, only from the Home Screen. That follows the owner's "block horizontal", but the owner may want to know it covers games too.
- N4. A touch-screen laptop with a window under 450px tall also matches `(pointer: coarse)` and gets the card (seen in emulation at 1280x420). Rare.
- N5. The card says `aria-modal="true"` but does not hold focus, so a phone with a keyboard or a screen reader can still reach what is behind it.
- N6. `main` has moved to `e2a9d8f` (#377, WebKit warm-up) since this branch's base; the fixed commit should merge `main` in so the phone run includes it.

## Probe text (reviewer's, not committed as tests)

Keys probe (`tests/browser/keys-probe.test.ts`, run then deleted): for each of End, PageDown, Space, ArrowDown, open `/privacy` with consent given, wait for `pageHasSettled`, press the key, and poll `max(body.scrollTop, documentElement.scrollTop, scrollY) > 0` for 3 s; plus the same after a second `goto`; plus Tab until the last `main a, main button` is focused and check it ends above the bar.

Sweep probe (`tests/browser/sweep-probe.test.ts`, run then deleted): signed out `/`, `/help` and its four guides, `/terms`, `/privacy`, `/legal/maker-agreement`, `/cookies`, `/sign-in`, `/sign-up`, `/forgot-password`, `/goodbye`; signed in `/me`, `/me/password`, `/me/computers`, `/me/delete`, `/me/link`, `/make`, `/make/new`, `/make/page`, `/make/page/links`, `/make/page/links/add`, `/join`; at the project size, 1280x420, 900x500 and 360x640; records page and body overflow and any `main` element drawn within the view under the bar or a pinned step row.
