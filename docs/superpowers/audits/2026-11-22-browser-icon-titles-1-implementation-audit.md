# Browser icon and titles: implementation audit, cycle 1

- Pull request: #320, branch `claude/project-thread-vffi7e`
- Reviewed commit: `0008924`
- Lane 2, one fresh review after the build. Reviewer: Opus 5.5, medium.
- Brief: the owner's request (2026-11-22 13:45 UTC) and the acceptance criteria in the pull request body.

## Verdict

FAIL: 2 red, 3 notes.

## What ran here, on `0008924`

- `pnpm lint`, `pnpm typecheck`: exit 0. `pnpm test`: 1882 passed.
- `pnpm test:browser browser-tab error-page game-page play.test feed.test maker-page players-see-updates --project computer --project tablet`: 112 passed. The phone profile cannot run here (no WebKit in this container).
- A throwaway journey (not committed): from a game's page, "← Back to the feed" (a client-side link) gives the base title, browser Back gives the game's title again, `/g/<game>/nope-not-here` and `/g/no-such-game-xyz` give the base title, and the server's HTML for a game's page holds exactly one `<title>`.
- Svelte's server output for `<title>Ruken - {n}</title>` is `` `<title>Ruken - ${$.escape(n)}</title>` ``, and on the client the title is set as text, so a game name with `<` or `&` cannot break the page. Names are capped at 60 characters (`src/features/games/fields.ts:40`); a long title is cut by the browser tab, which is fine.
- Icons, measured from the files: `favicon-32.png` 32x32, `apple-touch-icon.png` 180x180, `icon-192.png` 192x192, `icon-512.png` 512x512, `icon-maskable-512.png` 512x512; `favicon.ico` holds 16, 32 and 48px PNGs. Looked at each: white "RKN" in the display serif on the felt green. The maskable icon's farthest letter corner is about 186px from the centre, inside Android's 204.8px safe circle.
- `icons` and `manifest` are reserved maker addresses; the static-names unit test passes.
- CI on `0008924`: run 45030412892 failed (red 1 below).

## Red

### R1. The new title journey fails on the phone in CI

- UNIT: `tests/browser/browser-tab.test.ts`, the test "a game's page and its play screen name the game, and the tab goes back to Ruken after" (lines 60 to 84).
- VERDICT: red.
- REQUIREMENT: criterion 5, "CI's full run is green"; CLAUDE.md, a test that fails is a defect.
- REASON: after `page.goBack()` the test goes straight to `/help`, but on WebKit the back navigation to the game's page has not finished, so the `goto` is cut off. The two checks before it pass without proving anything: the play screen and the game's page have the same title, and the address changes before the page does.
- EVIDENCE: https://github.com/mcthaydt/RukenApp/actions/runs/45030412892/job/137232563152, `[phone] › tests/browser/browser-tab.test.ts:60:1` failed with `page.goto: Navigation to "http://localhost:4173/help" is interrupted by another navigation to "http://localhost:4173/g/tiny-game-0f430f18"` at line 82.
- EXPECTED: the journey waits until the game's page is really back before checking its title and leaving, and passes on phone, tablet and computer.
- FIX: after `page.goBack()`, wait for something only the game's page shows (for example `await expect(page.getByRole("link", { name: "Play" })).toBeVisible()` then `await pageHasSettled(page)`) before the title check and the `goto("/help")`. Only `tests/browser/browser-tab.test.ts` changes. Checked by CI's phone run going green.

### R2. The manifest makes Ruken open as a separate app from the home screen, which was not asked for

- UNIT: `static/manifest.webmanifest`, `"display": "standalone"`.
- VERDICT: red.
- REQUIREMENT: CLAUDE.md "Keep to the request"; the owner asked for an icon for the browser, and "it should feel like we're using a real app inside the browser" (2026-11-22 13:42 UTC).
- REASON: `standalone` changes what Ruken does when a player adds it to a phone's home screen: it opens without the browser's address bar or Back button, and on iPhone a home-screen app keeps its own cookies, so a player signed in in Safari opens it signed out. The pull request body does not mention it, and no journey covers it.
- EVIDENCE: `static/manifest.webmanifest` line 5. Leaving `display` out means `browser`, which keeps the icon and name on the home screen and opens Ruken in the browser as today.
- EXPECTED: adding the icon changes only the icon and the name, nothing about how Ruken opens.
- FIX: remove the `display` line (or set it to `"browser"`) in `static/manifest.webmanifest`. If the builder thinks the owner wants an app-like home-screen launch, that is the owner's product choice to ask, not this pull request's. Only `static/manifest.webmanifest` changes. Checked by reading the file.

## Notes (not blocking, not fixed here)

- N1. `src/app.html` labels `/favicon.ico` `sizes="48x48"`, but the file holds 16, 32 and 48px images; `sizes="any"` or `"16x16 32x32 48x48"` says what it is. Browsers pick a size either way.
- N2. No committed journey follows a link (rather than `goto`) from a game's page to another screen. The throwaway journey above shows it works; the "Back to the feed" step could join `browser-tab.test.ts` cheaply.
- N3. Every screen other than a game's now has the same tab title ("Sign in · Ruken" and "Night Owl · Ruken" are gone). That is the builder's stated reading of "base title" and is in the pull request body for the owner. One title for every screen makes many open tabs and screen readers less able to tell screens apart.
