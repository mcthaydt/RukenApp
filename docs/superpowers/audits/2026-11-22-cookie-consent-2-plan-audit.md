# Plan audit: cookie consent, round 2

**547a975 FAIL: 3 red**

- Examined: `docs/superpowers/specs/2026-11-22-cookie-consent-design.md` at `547a975` on `claude/project-thread-rnuc8p` (round 1's audit `9ba94c8` plus the spec's fixes).
- Against: round 1 (`docs/superpowers/audits/2026-11-22-cookie-consent-1-plan-audit.md`), `main` at `c3c4d68`, #331 (`ps17ej` at `682c872`), the landing page branches (`src/routes/about/`), the privacy branch (`xa97zr`), and `@sveltejs/kit@3.0.0` from npm (`src/runtime/client/client.js`).
- Lane 3, staged path. Plan audit by a fresh session (Opus 5.5, medium). Audit only: nothing but this file changed. Written 2026-11-22 16:57 UTC.
- The owner's strict rule stands and is not reopened: nothing collected before "I agree".

## Round 1, finding by finding

| # | Round 1 finding | Now | Where |
|---|---|---|---|
| R1 | SvelteKit writes `sessionStorage` before a yes | **Partly fixed, still red (R1 below)** | 1, 3.3 guard 4, 3.10, criterion 1 |
| R2 | `/api/v1/*` missing from the machine list | Fixed: reason given, writes only after the key checks out, `sign-in/start`/`finish` explained, criterion 6 case | 3.7, criterion 6 |
| R3 | Route test needs a third kind | Fixed in words (open, machine, gated), but the test it describes cannot fail: new red R10 | 3.7 |
| R4 | A yes from Join/Play/Sign in loses the maker's credit | Fixed in design (`from` → `arrival.remember`), criterion 3 case; but guard 1 strips the cookie it sets: new red R9 | 3.4, criterion 3 |
| R5 | `/privacy` in the same pull request | Fixed | unit C, section 5 |
| R6 | Three legal calls unflagged | Fixed: all three in 3.10, with the strict reading recorded as the choice | 3.10 |
| R7 | Kept log lines unmeasured | Fixed: games Worker off; site Worker keeps lines only if the two checks (schema key, stored fields) pass, else off; stop if the key is missing | 3.8, criterion 8 |
| R8 | "Not now" on a gated screen leaves an empty screen | Fixed: leaves the screen; criterion 2 case | 3.4, criterion 2 |
| N1 | Write guard on Prisma's query extension, not the adapter | Taken | unit B |
| N2 | `RateLimit` rows shared across CI workers | Taken (rows read by keys the run owns) | criterion 1 |
| N3 | GitHub callback is gated, not machine | Taken | 3.7 |
| N4 | Journeys' default `rk_consent` in unit B | Taken | unit B, section 6 |
| N5 | Escape, focus in and back | Taken | 3.4 |
| N6 | Re-check the inventory at build start | Taken | section 6 |

## Red findings

### R1 (carried). Guard 4 is undone on every reload or leave, and its check cannot see it

- UNIT: 3.3 guard 4, criterion 1.
- VERDICT: red.
- REQUIREMENT: Owner, 16:41: "do NOT collect ANY data until the cookies is accepted"; outcome 1 ("writes no browser storage"); "a check is a test that fails by itself".
- REASON: the listener order guard 4 relies on is not reachable as written, the clear on `pagehide` is followed by another SvelteKit write, and the criterion's trigger does not make SvelteKit write at all.
- EVIDENCE (`@sveltejs/kit@3.0.0`, `src/runtime/client/client.js`):
  1. SvelteKit adds its `beforeunload` and `visibilitychange` listeners in `_start_router()` (`:3083`, `:3086`, `:3113`), which `start()` calls last (`:566`), after `await _app.hooks.init?.()` (`:485`) and after `await _hydrate(...)` (`:553`). A listener added in `hooks.client.ts` `init` is added before SvelteKit's, so it runs first and SvelteKit writes after it. A layout `onMount` runs inside or just after hydration; the spec names no place that is provably after `:566`.
  2. On a reload or a full-page leave the browser fires `beforeunload`, then `pagehide`, then `visibilitychange` to hidden, then `unload` (HTML standard, "unload a document"). SvelteKit's `visibilitychange` listener (`:3113-3115`) calls `persist_state()` again after guard 4's `pagehide` clear, so the three keys are in the tab's `sessionStorage` when the next page loads, and SvelteKit reads them back (`:108`, `:115`, `snapshots.js:15`).
  3. SvelteKit writes on `visibilitychange` only when `document.visibilityState === 'hidden'` (`:3114`). Dispatching the event in a visible Playwright tab (criterion 1's "sends the tab to hidden (`visibilitychange`)") writes nothing, and a guard that also clears at start-up would hide point 2, so criterion 1 can pass while every real visitor keeps the keys between pages.
- EXPECTED: guard 4 names a mechanism that runs after every SvelteKit write, including the one during unload, and criterion 1 sees the storage before any app code can clear it.
- FIX: in the spec only. In 3.3 guard 4, state one mechanism and why its order holds against the lines above, for example: replace `window.sessionStorage` for a browser without a yes with an in-memory object before SvelteKit's first write (`session-storage.js` looks up the global on each `get`/`set`), or clear synchronously in listeners added after `_start_router()` has run and also on `visibilitychange` during unload; the builder proves the choice in the journey, not by reading. In criterion 1: make the tab really hidden (override `document.visibilityState` to `'hidden'` before dispatching, or open and focus a second page), then reload, and read `sessionStorage` from a `page.addInitScript` on the reloaded page (before any app script runs) as well as at the end; both must have no key. Keep the 3.10 question as the fallback. Files: the spec.

### R9 (new). The cookie guard strips the arrival cookie that the agree action sets

- UNIT: 3.3 guard 1, 3.4 (`from` → `arrival.remember`), criterion 3.
- VERDICT: red.
- REQUIREMENT: 3.4's own promise that a yes given from Join, Play or Sign in "still thanks the maker who brought them" (round 1 R4); criterion 3's last sentence.
- REASON: the agree request (`POST /cookies?/agree`) arrives without `rk_consent`. Guard 1 removes "without `rk_consent`, any `Set-Cookie` on the answer other than `rk_consent` itself", so the `rk_arrival` that `arrival.remember` sets in the same answer (`src/features/membership/services.ts:150-162`, `cookies.set(ARRIVAL_COOKIE, …)`) is removed. The spec does not say whether "without `rk_consent`" means the request's cookie or the answer's, and the obvious build (read the request) breaks R4's fix. The journeys then see the next page set nothing, because Join, Play and Sign in never pass back through the game page's load (`src/routes/g/[game]/+page.server.ts:37`).
- EXPECTED: an answer that itself sets `rk_consent=v1` counts as consented for guard 1 (and for the request's write flag, if the action ever writes), so `rk_arrival` survives the agree answer.
- FIX: in 3.3 guard 1, say consent is read from the request's cookie or from `rk_consent` being set on this answer; criterion 6 adds the unit case "an answer that sets `rk_consent` keeps its other cookies". Criterion 3's existing check (agree from Join on a game page leaves `rk_arrival`) then proves it end to end. Files: the spec.

### R10 (new). The route test cannot fail, and the landing page is not named

- UNIT: 3.7 ("Gated: everything not named above" and "A test … fails unless each is in exactly one kind").
- VERDICT: red.
- REQUIREMENT: 3.7's own purpose, "so a new route must decide"; "a check is a test that fails by itself".
- REASON: gated is defined as "everything not named", so every route file is always in exactly one kind and the test passes whatever a new route does. Gating is wired route by route (3.5 rows 3–6), so an unnamed route is labelled gated without being gated, and nobody decided anything.
- EVIDENCE: the landing page `src/routes/about/+page.server.ts` and `+page.svelte` are on five open branches (`2vpwcj`, `7n8oys`, `mrv5mc`, `p8v82x`, `r9qwvl`); it is a public page linked from the paywall, sign-in and You page (owner, 14:40), and the spec names it in neither the open list nor "Ordering with branches in flight". Under 3.7 it is "gated" by default and the test is green.
- EXPECTED: each of the three kinds is a written list (gated included, by path pattern), the test fails for any route file in none or two of them, and `/about` is in the open list.
- FIX: in 3.7, list the gated routes too (the patterns already given: sign-in, sign-up, forgot and reset password, `/join/*`, `/g/[game]/play/*`, `/api/auth/*`, `/me/*`, `/make/*`, `/sign-out`), add `/about` to open and to "Ordering with branches in flight", and say the test fails for a route file in no list. Criterion 6 already names the test. Files: the spec.

## Notes (not blocking; for the builder)

- N7. 3.6 says that without `rk_consent`, `createHandle` "does not read the session". On #331 the same function reads the terminal's key (`src/features/accounts/handle.ts:54-55` at `682c872`). Keep reading the key on `/api/v1/*` with no `rk_consent`, or every terminal is `none` and gets a 401; criterion 6's `/api/v1` case would catch it.
- N8. Section 1's `sveltekit:` row (line 39) sits after a blank line, so it renders outside the table above it. Join it to the table.
- N9. 3.2 and unit A say "machine routes" and "machine-route list"; 3.7 says the file is `consent/routes.ts` with three kinds. Use one name.
- N10. After agreeing, SvelteKit's `visibilitychange` to visible calls `updated.check()` (`client.js:3117`), a `GET` for the version file. It is a `GET` and fine under outcome 1; noted so the "only `GET`/`HEAD`" check is not surprised.

## Checks the plan can be judged by (for the implementation audit)

1. Criterion 1 on phone, tablet and computer, with the tab really hidden, a reload, and `sessionStorage` read at document start of the reloaded page: no key (R1).
2. Unit test: an answer that sets `rk_consent` keeps `rk_arrival`; journey: agree from Join on a game page leaves `rk_arrival` naming that maker (R9).
3. The route test fails when a new route file is added to no list (R10), and `/about` is open.
4. Round 1's checks 2–5 still stand.
