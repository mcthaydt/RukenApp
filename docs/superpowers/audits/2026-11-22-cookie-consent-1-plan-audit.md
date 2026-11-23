# Plan audit: cookie consent, round 1

**d2846f2 FAIL: 8 red, 6 notes**

- Examined: `docs/superpowers/specs/2026-11-22-cookie-consent-design.md` at `d2846f2` on `claude/project-thread-rnuc8p` (the spec is unchanged from `fd04a9d`; `d2846f2` only deletes the live-state file).
- Against: `main` at `2381058`, the work in flight (#329 `7fe1cy`, #331 `ps17ej` at `682c872`, Wishlist `mqxj7b`, privacy pages `xa97zr`), and `@sveltejs/kit@3.0.0` from npm (the version in `package.json`).
- Lane 3, staged path. Plan audit by a fresh session (Opus 5.5, medium). Audit only: nothing but this file changed.
- The spec checked against `main` at `23d178f`. The commits since (`23d178f..2381058`) touch only test helpers and `showTheOwner`; none adds a collector.

## What holds

- The inventory in section 1 matches `main` for Ruken's own code. Every `cookies.set`, `localStorage`, `sendBeacon` in `src/` is in a table: `membership/services.ts:156` (`rk_arrival`), `accounts/auth.ts:302` (`rk_welcome_back`), `accounts/forms.ts:285` (`ruken_sign_up`), `accounts/handle.ts:53` (session renewal), `make/…` (two maker cookies), `Feed.svelte:136` (`rk_seen_hints`), `play/+page.svelte:27,52` (`rk_menu_tab`), `play/+page.svelte:134` (the beat beacon, behind Play). Database writes reachable signed out: `countView`, `tapLink`, `startPlay`, better-auth. Nothing else in `features/feed`, `games`, `pages` writes from a public page.
- The games Worker (`cloudflare/games/worker.ts`, `src/features/play/gate.ts:13`) never sets or reads a cookie. A game runs only behind Play, which waits for a yes.
- Crons reach `/jobs/*` through the site's own `fetch` (`cloudflare/crons.js`), so the machine list covers them.
- The glass tokens the notice uses exist: `--glass-bg`, `--glass-filter`, `--dim-bg`, `--dim-filter` (`src/lib/look.css:108-111`), with the solid fallbacks. The `phone` profile is `iPhone SE (3rd gen)`, WebKit (`playwright.config.ts:169`).
- Accept and reject are equal on the screen: same size, shape, weight, colour family, both keyboard-reachable, no pre-ticked box, checked by a program (criterion 7). The notice is custom and has no browser-default control.
- CRUD of the one thing a visitor makes here (their yes) is criterion 4: agree, read on `/cookies`, agree again, take back.
- Unit order A, B, C, D, F with E free is right: each reads the one before. Lane 3 for the one pull request is right (`src/features/membership/`, `cloudflare/`).
- The words pass the drunk-grandma test on my reading. The design review reads them again.

## Red findings

### R1. SvelteKit itself writes `sessionStorage` before any yes

- UNIT: section 1 ("No `sessionStorage` … in `src/`"), 3.3 guard 3, criteria 1, 2, 4.
- VERDICT: red.
- REQUIREMENT: Owner, 16:41: "do NOT collect ANY data until the cookies is accepted"; outcome 1 ("writes no browser storage").
- REASON: the framework, not `src/`, writes `sveltekit:history-info`, `sveltekit:snapshot` and `sveltekit:navigation-snapshot` to `sessionStorage` on every page, whatever the visitor chose.
- EVIDENCE: `@sveltejs/kit@3.0.0` `src/runtime/client/client.js:686-694` `persist_state()` calls `storage.set(HISTORY_INFO_KEY…)`, `storage.set(SNAPSHOT_KEY…)`; it runs on `beforeunload` (`:3086-3089`) and on `visibilitychange` to hidden (`:3113-3115`). `session-storage.js:24` writes `sessionStorage[key]`. Criterion 1 reads storage at the end of a walk with no tab switch or unload, so it would pass while every real visitor who switches tabs gets three keys.
- EXPECTED: the spec names this write, decides what Ruken does about it, and the test triggers it before measuring.
- FIX: in the spec only. Add the three keys to section 1's browser table. In 3.3 choose and state one answer the implementer can build and test, for example: (a) a client hook that, without a yes, clears every `sveltekit:` key on `pagehide` and `visibilitychange` after SvelteKit's own listener (registered later, so it runs after), checked by the journey; or (b) list it under 3.10 as "the framework keeps the scroll place for this tab only, in the tab; is that allowed before a yes?" and keep it until a lawyer answers. Criteria 1, 2 and 4: before measuring, dispatch `visibilitychange` to hidden (and reload once), then assert no key at all, `sveltekit:` included. The guard-3 test ("no `localStorage`/`sessionStorage` outside `deviceStore`") stays as it is, since it covers only `src/`. Files: the spec.

### R2. The terminal's whole API (#331) is missing from the machine list

- UNIT: 3.7.
- VERDICT: red.
- REQUIREMENT: the brief's "CLI keys"; 3.3 guard 2 (every write throws without consent or a machine route).
- REASON: 3.7 lists only #331's sign-in routes. #331 adds key-signed routes that write: `src/routes/api/v1/games/+server.ts`, `games/[game]/+server.ts`, `games/[game]/videos/[shape]/+server.ts`, `games/[game]/waiting/[part]/+server.ts`, `me/+server.ts`, `me/key/+server.ts`, `sign-in/start`, `sign-in/finish` (all at `682c872`), and `computerKey.create`, `computerSignIn.create`. A terminal never carries `rk_consent`, so once both land every write from the terminal throws `NoConsentWrite`, or the builder opens a hole to get past it.
- EXPECTED: 3.7 says which `/api/v1/*` routes run without `rk_consent` and why, and what allows their writes.
- FIX: in 3.7, name `/api/v1/*` as machine routes with the reason "called by a terminal holding a key that a signed-in person made on `/me/link`, which needed a yes; a request with no valid key writes nothing", and state that writes are allowed on them only after the key checks out (or for `sign-in/start` and `finish`, the row that names no one). Add a unit test case to criterion 6 for one `/api/v1` write with a key and no cookie. Keep "whichever lands second wires it". Files: the spec.

### R3. The route test cannot classify the public pages

- UNIT: 3.7's test ("fails unless each is either gated by consent or named in that list").
- VERDICT: red.
- REQUIREMENT: outcome 1 (public screens open before a yes) and 3.7.
- REASON: `/`, `/g/[game]`, `/[handle=handle]`, `/[handle=handle]/out/[link]`, `/help/*`, `/legal/maker-agreement`, `/goodbye` and #329's `src/routes/api/feed/+server.ts` (a public `GET`) must answer without a yes. They are neither gated nor machine routes, so the test as written either fails on them or forces a wrong label.
- EXPECTED: three kinds, each route in exactly one: gated (shows the notice or refuses), open (answers without a yes; the write guard stays on, so it writes nothing), machine (writes allowed without a yes, with its reason).
- FIX: in 3.2 and 3.7, make the list in `consent/machine-routes.ts` (or a sibling) say open or machine for each named route; anything unnamed must be gated. Criterion 6 names the three kinds. Files: the spec.

### R4. A yes given from a gated button loses the maker's thank-you

- UNIT: 3.4 ("goes to `next` … Coming back to the game or maker page … sets `rk_arrival`"), criterion 3.
- VERDICT: red.
- REQUIREMENT: design 6 (the last maker link a visitor arrived through is who brought them); 3.4's own promise "the maker who brought them is still thanked".
- REASON: `rk_arrival` is set by the game page's and maker page's loads (`src/routes/g/[game]/+page.server.ts:37`, `src/routes/[handle=handle]/+page.server.ts:18`). Someone who lands on `/g/x` from a maker's link and presses Join, Play or Sign in agrees from the sheet and goes to `next` (`/join`, the play screen, `/sign-in`), never back through that load. Nothing sets `rk_arrival`, so the maker is not credited.
- EXPECTED: agreeing from a game or maker page remembers that maker's arrival, whatever `next` is.
- FIX: the agree action (3.4) takes the page it was opened on (`from`, a same-site path) and, when it is `/g/<game>` or `/<handle>`, calls `arrival.remember` for that page's maker before going to `next`. Criterion 3 adds: land on a game page, press Join, agree, and `rk_arrival` names that game's maker. Files: the spec.

### R5. `/privacy` must change in the same pull request

- UNIT: unit C's file list, section 5.
- VERDICT: red.
- REQUIREMENT: `tests/routes/privacy/cookies.test.ts` on `xa97zr` fails when any `rk_` name in `src/` is missing from `/privacy`; the standing rule that the privacy page says only what the code does (memory, "legal pages").
- REASON: this spec adds `rk_consent` and `/cookies` and changes what is kept before a yes, but neither unit C nor section 5 includes `src/routes/privacy/+page.svelte`, and section 5 calls the pages out of scope. (Raised by the privacy thread; confirmed by the test's existence on `xa97zr`.)
- EXPECTED: the build adds `rk_consent` to the page's cookie list, the "nothing kept before you say yes" sentence and the `/cookies` link, in the same pull request, or coordinates with the privacy thread if `/privacy` has not reached `main` by then.
- FIX: add `src/routes/privacy/+page.svelte` to unit C's Owns, and change section 5 to "the pages themselves are their own thread; this build adds its own cookie, sentence and link to `/privacy`". Files: the spec.

### R6. Three legal calls are made without being flagged

- UNIT: 3.1, 3.4, 3.10.
- VERDICT: red.
- REQUIREMENT: the brief: "no legal guesses"; the spec's own "Not legal advice".
- REASON: the spec decides, as a Call, three things a lawyer should answer:
  1. A yes lasts 180 days, while "Not now" lasts until the next reload, so a visitor who refuses is asked again on every visit and the card sits on the feed each time. Whether asking again every visit makes refusing harder than agreeing is a legal question, not only a design one.
  2. One yes covers sign-in and play (needed for what the person asked) and the maker's referral cookie and view counts (not needed for it). Whether sign-in may wait on a yes that also covers referral tracking is a legal question.
  3. The notice promises "We never sell your data." "Sell" has a legal meaning in some states.
- EXPECTED: each is listed in 3.10 as an open question with the fact behind it. The owner's strict reading ("Not now stores nothing") is not reopened; it is recorded as the choice made, with the question beside it.
- FIX: add the three to 3.10. Files: the spec.

### R7. What a kept log line carries is assumed, not measured

- UNIT: 3.8, criterion 8.
- VERDICT: red.
- REQUIREMENT: the brief's "Cloudflare logs"; outcome 6; "a tool is checked before it is built on".
- REASON: 3.8 turns off invocation logs and keeps Ruken's own `console` lines, but does not say what Cloudflare stores with each kept line (for example the request's address, method or any visitor detail). Several kept lines fire before a yes: the cookie guard's own line, `NoConsentWrite`, and SvelteKit's unexpected-error lines. Criterion 8 only checks that a key is in a file.
- EXPECTED: the spec states, from Cloudflare's documentation for the installed Wrangler checked at build time, which fields a kept `console` line stores; if it stores any request detail about the visitor, the kept lines are turned off too. The games Worker writes no `console` line (`cloudflare/games/worker.ts`, `src/features/play/gate.ts`), so it can turn observability off entirely.
- FIX: in 3.8 add that check and its two outcomes; set the games Worker to `"observability": { "enabled": false }` unless the check shows that is not needed; criterion 8 asserts whichever is chosen. Files: the spec.

### R8. "Not now" on a gated screen goes nowhere

- UNIT: 3.4, 3.5 row 3, criterion 2.
- VERDICT: red.
- REQUIREMENT: the drunk-grandma test (one main action, nothing that needs explaining).
- REASON: on `/sign-in`, `/sign-up`, `/join` and the password pages the notice replaces the form. "Not now" hides the card in memory, which leaves an empty screen with no form and no way on.
- EXPECTED: on a screen whose form waits for a yes, "Not now" leaves that screen (back to where the person came from, or the feed).
- FIX: say so in 3.4; criterion 2 adds "Not now on `/sign-in` lands on the screen before it, or the feed". Files: the spec.

## Notes (not blocking; for the builder)

- N1. Put the write guard on Prisma's model operations (a query extension that reads the request's `AsyncLocalStorage` store), not on the adapter in `db.ts`: the adapter's `queryRaw` also carries `INSERT … RETURNING`, so it cannot tell a read from a write. `$queryRaw` is not on the guard's list; today it only reads (`money/statements.ts:27`, `money/journal.ts:150`, `play/sessions.ts:219`). `$executeRaw` is used for advisory locks (`membership/sync.ts:88`, `money/journal.ts:164`), all on consented or machine routes.
- N2. Criterion 1's "no `RateLimit` row for this run": `RateLimit` is keyed by IP, which every parallel CI worker shares. The write guard is the real proof; count rows only by keys the run owns.
- N3. 3.7 lists `/make/github/callback` on the machine list but says it checks consent like any page. Under R3's three kinds it is simply gated; drop it from the list.
- N4. Move the journeys' default `rk_consent` (unit F's helper change) into unit B, so the branch's commits stay green once the write guard is on.
- N5. The sheet: Escape is "Not now", focus goes into the sheet and back to the pressed button.
- N6. Re-check the inventory against `main` at the build's start: #329, #331, Wishlist and the learned feed may have landed.

## Checks the plan can be judged by (for the implementation audit)

1. The criterion 1 and 2 journeys on phone, tablet, computer, with the visibility and reload step from R1, show no cookie and no storage key of any kind.
2. The route test classifies every `+server.ts` and `+page.server.ts` into exactly one of three kinds (R3).
3. Land on a game page from a maker link, press Join, agree: `rk_arrival` names that maker (R4).
4. `tests/routes/privacy/cookies.test.ts` passes with `rk_consent` (R5), once `/privacy` is on `main`.
5. `tests/wrangler.test.ts` asserts the logging setting chosen under R7 for both Workers.
