# Plan audit: cookie consent, round 3

**1402d27 PASS**

- Examined: `docs/superpowers/specs/2026-11-22-cookie-consent-design.md` at `1402d27` on `claude/project-thread-rnuc8p` (round 2's audit `7c43348` plus the spec's fixes; the diff `7c43348..1402d27` touches only the spec).
- Against: round 2 (`docs/superpowers/audits/2026-11-22-cookie-consent-2-plan-audit.md`), `main` at `c3c4d68`, #331 (`ps17ej` at `682c872`), the landing page branches, and `@sveltejs/kit@3.0.0` from npm (`src/runtime/client/client.js`, `session-storage.js`).
- Lane 3, staged path. Plan audit by a fresh session (Opus 5.5, medium). Audit only: nothing but this file changed. Written 2026-11-22 16:59 UTC.
- The owner's strict rule stands: nothing collected before "I agree".

## Round 2, finding by finding

| # | Round 2 finding | Now | Where |
|---|---|---|---|
| R1 | Guard 4 undone on unload; check could not see it | Fixed. The writes never reach the real storage: an inline script at the top of `<head>` in `src/app.html` swaps `window.sessionStorage` for an in-memory stand-in before any module runs, so the order of SvelteKit's listeners (`client.js:566`, `:3086`, `:3113`) no longer matters. `session-storage.js` reads the global on every `get`/`set` (`:9`, `:24`), so the stand-in catches all three writes, including those during unload. The criterion makes the tab really hidden, reloads, and reads the real storage from `addInitScript` before any page script; the fallback (stop and report) is stated. | 1, 3.3 guard 4, criterion 1 |
| R9 | Cookie guard strips `rk_arrival` set by the agree answer | Fixed: an answer that sets `rk_consent=v1` counts as consented, and the write flag follows the same rule; unit case in criterion 6, journey case in criterion 3. | 3.3 guard 1, criteria 3, 6 |
| R10 | Route test could not fail; `/about` not named | Fixed: gated is a written list of path patterns; the test fails for a route file in no list or two; a second test checks one route per gated pattern really gates; `/about` is open and in the ordering list. Every `+server.ts` and `+page.server.ts` on `main` at `c3c4d68` and on #331 matches exactly one pattern (checked by hand against `git ls-tree`). | 3.7, section 6 |
| N7 | Terminal key must still be read without `rk_consent` | Taken | 3.6 |
| N8 | `sveltekit:` row outside its table | Taken | 1 |
| N9 | One name for the route list | Taken (`consent/routes.ts`, "route kinds") | 3.2, unit A |
| N10 | `updated.check()` is a `GET` | Recorded; no change needed | — |

No new red finding. The site sets no Content-Security-Policy on its pages (only the games gate does, `src/features/play/gate.ts:66`, `:125`, `:165`), so an inline script in `app.html` is not blocked, and no route is prerendered, so the flag written through `transformPageChunk` is per request.

## Notes (not blocking; for the builder)

- N11. Unit B's Owns does not name `src/app.html`, which guard 4 now edits and which CLAUDE.md lists as lane 2. Add it to unit B's Owns so "the diff touches only files in the plan" holds, and name it in the pull request body.
- N12. Make guard 4 fail closed: the inline script swaps in the stand-in unless the page says this browser agreed, so a page rendered without the flag (an error path, a missed transform) keeps nothing.
- N13. 3.7 says `/cookies`' actions "write only consent's own cookies", but 3.9's Take it back also deletes the session cookie and the session row. Both happen with consent, so the write guard allows them; reword 3.7 so the two sections agree.
- N14. For the gated-pattern test (3.7), decide whether a redirect to a screen that shows the notice (for example `/me` sending a signed-out browser to `/sign-in`) counts as "the notice"; say so in the test.

## Checks the plan can be judged by (for the implementation audit)

1. Criterion 1 on phone (WebKit), tablet and computer: tab really hidden, reload, real `sessionStorage` read by `addInitScript` at the start of the reloaded page, and again at the end: no key. If WebKit refuses the swap, the builder has stopped and reported (3.3 guard 4).
2. Unit: an answer that sets `rk_consent` keeps `rk_arrival`. Journey: agree from Join on a game page leaves `rk_arrival` naming that maker.
3. The route test fails when a route file is in no list or two; the gated-pattern test passes; `/about` is open.
4. Round 1's checks 2, 4 and 5 still stand: three route kinds, `/privacy` lists `rk_consent`, `tests/wrangler.test.ts` asserts both Workers' log settings.
