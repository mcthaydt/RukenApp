# Implementation audit: cookie consent, round 1

**5c065fd FAIL: 6 red**

- Examined: pull request #344, head `5c065fd7622c2abeed2dca06021fe900272f83c9` on `claude/project-thread-rnuc8p` (merge base with `main`: `dfd81d9`, which is `main` today).
- Against: the spec `docs/superpowers/specs/2026-11-22-cookie-consent-design.md` and its three plan audits (last `1402d27 PASS`, audit commit `7b8e933`), `CLAUDE.md`, the `this-repo` skill, and the owner's rule (2026-11-22 16:41 UTC): nothing collected before "I agree".
- Lane 3. Implementation audit by a fresh session (Opus 5.5, medium). Audit only: nothing but this file changed. Written 2026-11-22 19:39 UTC.

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## Verdict in short

The core works and is well built. Before a yes, the walk the journey makes leaves no cookie, no localStorage, no real sessionStorage (SvelteKit's `sveltekit:` keys included, after a real hide and reload), no IndexedDB, no POST, no counted view or tap and no play session. Take it back removes every cookie and the session row (measured below). The write guard, cookie guard, device store and framework-storage guard are all in place and tested.

It fails on six things. The one that matters most: **the privacy policy and the terms can't be opened from a link before a yes.** `/privacy` and `/terms` are missing from the open list, so a direct visit is sent to the cookie notice. The privacy page's "Logs" part also no longer matches the code, three checks the spec asks for are missing, and the new journey failed once in CI because it presses Not now before the page's script has started.

## What ran (on `5c065fd`, this container, Node 24.22.1, Postgres 16)

| Check | Result |
|---|---|
| `pnpm lint` | exit 0 |
| `pnpm typecheck` | exit 0, 0 errors, 0 warnings |
| `pnpm test` | 139 files, 2015 tests passed |
| `pnpm test:pg` | 51 files, 766 tests passed |
| `tests/browser/cookie-consent.test.ts`, tablet and computer | 14 of 14 passed |
| The 22 journey files this change edits, tablet and computer, 3 workers | 517 passed, 1 failed: `feed-controls.test.ts:262` on computer (the speaker press). It passed 4 of 4 when run again alone, so it is a flake under load (N8). |
| Probe 1 (below): `/privacy`, `/terms`, `/help`, `/goodbye` with no `rk_consent` | `/privacy` and `/terms` answer 303 to the notice (R1) |
| Probe 2 (below): sign up, Take it back, count `Session` rows | 1 row before, 0 after; no cookie left; real sessionStorage empty after the tab goes hidden |
| Phone (WebKit) | not run here: CI only, as the brief says. CI on `5c065fd` (quick, draft): verify, postgres and commit-authors passed; browser shard 4 failed on `cookie-consent.test.ts:109` on computer (R6), so `gate` failed and shards 1, 3 and 5 were cancelled. |

The full journey suite (1282 tests on tablet and computer) was started and stopped after a few minutes: at two workers in this container it would have taken about two hours. The 22 journey files the pull request edits were run instead. CI runs the rest.

## Red findings

### R1. The privacy policy and the terms are behind the notice

- UNIT: `src/features/consent/routes.ts` (the open list), `tests/features/consent/routes.test.ts`, `tests/browser/cookie-consent.test.ts`.
- VERDICT: red.
- REQUIREMENT: spec 3.7 names `/privacy` and `/terms` (and `/about`) as open; spec 2.1 says "the legal pages" open before a yes; criterion 1's walk opens `/privacy` and `/terms`.
- REASON: neither is in `OPEN`, and `routeKind` gates any route it doesn't know, so the gate redirects both to `/cookies?for=account`.
- EVIDENCE: probe 1, with no cookie: `GET /privacy -> 303 /cookies?for=account&next=%2Fprivacy` and `GET /terms -> 303 /cookies?for=account&next=%2Fterms` (`/help` and `/goodbye` answer 200). So a shared link to ruken.io/privacy, or a reload of it, shows "To go on, Ruken needs to keep a few small things in your browser" instead of the policy that says what is kept. (Clicking "What we keep" inside the app gets through only because the client-side move asks the server nothing.) The route test can't see this because it lists only folders with `+server.ts`, `+page.server.ts` or `+page.ts`, and `/privacy`, `/terms` and `/help` have only `+page.svelte`. The landing page `/about` will be the same when it lands. The journey's walk leaves out `/privacy` and `/terms`, so it can't see it either.
- EXPECTED: with no `rk_consent`, `/privacy` and `/terms` answer 200 with no `set-cookie`, and the route test fails for any route folder (any `+page.svelte` included) that is in no list or in two.
- FIX: add `/privacy` and `/terms` to `OPEN` (and `/about`, which the spec names, or let the fixed test force it when the landing page lands). Make `routeIds()` in the route test also collect folders holding `+page.svelte`. Add `/privacy` and `/terms` to criterion 1's walk in the journey. Files: `src/features/consent/routes.ts`, `tests/features/consent/routes.test.ts`, `tests/browser/cookie-consent.test.ts`.

### R2. The privacy page still says Cloudflare logs every visit

- UNIT: `src/routes/privacy/+page.svelte` ("Who helps us" and "Logs").
- VERDICT: red.
- REQUIREMENT: `this-repo`, "The privacy and terms pages keep up": the pages say only what the code does today. The coordinator's brief: /privacy must match the code.
- REASON: this change turns Workers Logs fully off on both Workers (`wrangler.jsonc`, `cloudflare/games/wrangler.jsonc`: `"observability": { "enabled": false }`), but the page still says what the logs used to keep.
- EVIDENCE: `src/routes/privacy/+page.svelte:174` "Cloudflare runs the website, … and keeps our logs."; `:186-191` "Cloudflare keeps a short record of each visit: the page, the time, your internet address and your browser.", "When something goes wrong, the website adds a note about it", "When a maker connects GitHub, we note which GitHub accounts it showed." (that note is `console.info` in `src/routes/make/github/callback/+server.ts:36`, which now goes nowhere). Spec section 1 also says the page should say that Cloudflare's network sees the address in transit and Ruken keeps nothing of it before a yes.
- EXPECTED: the "Logs" part says what is true now. Cloudflare's network sees your internet address to deliver each page, and Ruken keeps no record of visits. Error notes and the GitHub note are not kept. "keeps our logs" is gone from Cloudflare's line. The "Last updated" date stays correct.
- FIX: reword those lines only. Files: `src/routes/privacy/+page.svelte`.

### R3. No check that every gated pattern really gates

- UNIT: `tests/features/consent/` (route or gate test).
- VERDICT: red.
- REQUIREMENT: spec 3.7: "A second test checks each gated pattern really is gated: a request to one route per pattern with no `rk_consent` gets the notice, a refusal, or a redirect whose target shows the notice … and writes nothing". Plan audit round 2 R10 and round 3 N14 asked for it.
- REASON: the route test checks only how routes are sorted (`routeKind(id) === "gated"`), and the gate test runs one made-up route. Nothing runs one route per pattern through the gate. The journey covers `/sign-in`, `/sign-up`, `/join`, `/g/[game]/play` and `/me` only. `/sign-out`, `/forgot-password`, `/reset-password`, `/api/auth`, `/make` (the GitHub callback included) and `/g/[game]/play/beat` have no check.
- EVIDENCE: `tests/features/consent/routes.test.ts:29-44`, `tests/features/consent/gate.test.ts:80-99`. `grep` finds no test that runs `consentGate` per gated pattern.
- EXPECTED: one case per entry of `GATED`, each with a real route id: with no `rk_consent`, the gate answers 303 to `/cookies?for=…` (a page or form) or 403 (`/api/*`, `/beat`), resolve is never called, and writes are off.
- FIX: add a table-driven case to `tests/features/consent/gate.test.ts` (or `routes.test.ts`) that reads `GATED` (export it, or a list of one route id per pattern). Files: those tests and, if needed, a one-line export in `src/features/consent/routes.ts`.

### R4. The `/api/v1` cases of criterion 6 are missing

- UNIT: tests for the machine kind.
- VERDICT: red.
- REQUIREMENT: criterion 6: "one `/api/v1` write with a valid key and no cookie succeeds, and one with no valid key writes nothing (once #331 is on `main`)". #331 is on `main` (`src/routes/api/v1/*` exists at `5c065fd`).
- REASON: `/api/v1` is a machine route, so writes are allowed for every request, with or without a key. The spec allows writes only after the key checks out (except `sign-in/start` and `finish`). Today's code writes nothing for a bad key: `computerKey` returns null before its `updateMany` (`src/features/accounts/computer-keys.ts:357-369`), and the per-person rate limit comes after the caller is known. But nothing checks that, so a later `/api/v1` route could write before the key check and nothing would fail.
- EVIDENCE: `grep -rn "api/v1" tests/features/consent tests/lib/server/db.test.ts` finds nothing, and no other test in the diff covers it.
- EXPECTED: two checks. With a valid key and no cookies, one `/api/v1` write (for example `PATCH /api/v1/games/<game>` or `POST /api/v1/me/key`) succeeds. With a made-up key, the same call answers 401 and writes no row (no `RateLimit`, no `ComputerKey` change).
- FIX: add them where the `/api/v1` tests already live (pg or browser, whichever already holds a computer key), with the gate in the chain. Test files only.

### R5. The pull request body doesn't end with "Requested by"

- UNIT: #344's body.
- VERDICT: red.
- REQUIREMENT: `CLAUDE.md`, Identity: "no 'Generated with Claude Code' line in … pull request bodies", and "Pull requests end with 'Requested by **McThayDT**': check the body's last line after every create or edit".
- EVIDENCE: the body (read through `gh api repos/mcthaydt/RukenApp/pulls/344`) ends `Requested by **McThayDT**`, then `---`, then `_Generated by [Claude Code](https://claude.ai/code)_`.
- EXPECTED: the last line is `Requested by **McThayDT**`, with no footer.
- FIX: edit the body through the hooked route. While editing, update the body's "Checks run" for the fixes. No code.

### R6. The consent journey presses Not now before the page's script runs, and failed in CI

- UNIT: `tests/browser/cookie-consent.test.ts`.
- VERDICT: red.
- REQUIREMENT: `CLAUDE.md`, Verification: "A test that fails once and passes on retry is a defect"; green CI for lane 3.
- REASON: the card's Not now is a `<button type="button">` that works only once the page's script has started (`Notice.svelte:83`). The journey presses it straight after `page.goto` (`:113-114`, and again `:169-170`), so on a busy runner the press can land on the server-drawn button before hydration and do nothing.
- EVIDENCE: CI on `5c065fd`, "browser shard 4 of 6 (quick, draft)", computer: `cookie-consent.test.ts:115` `expect(getByRole('heading', { name: 'Cookies?' })).toHaveCount(0)` received 1 for 15 s ("34 × locator resolved to 1 element"). The same test passed here on tablet and computer.
- EXPECTED: the journey passes every time. It waits until the page has settled before each press that needs the script, as the other journeys do with `pageHasSettled` (`tests/browser/support/account.ts:84`).
- FIX: call `pageHasSettled(page)` (or an equal wait) after each `goto` that is followed by a press on Not now or I agree in the card. Record the failure under "Flaky tests" in `progress.md`. Files: `tests/browser/cookie-consent.test.ts`, `docs/superpowers/progress.md`.

## Notes (not blocking; recorded, not fixed here)

- N1. **Wishlist (#338) and the gate.** The gate covers `rk_wish_pressed`: `/g/[game]/wishlist` is gated, so a signed-out press never reaches the route that sets the cookie, and the cookie guard would strip it anyway. Two things for whichever lands second. (a) #338's button posts by script with `Accept: application/json` and expects `{ go }`, but the gate answers that with a 303 to the HTML notice, so the script needs a JSON answer from the gate (`{ go: "/cookies?for=save&next=…" }`) or the button must open the notice itself. (b) `rk_wish_pressed` must join `RUKEN_COOKIES` in `src/features/consent/cookies.ts` so Take it back deletes it. `tests/features/consent/cookies.test.ts` ("knows every cookie the code sets") should force that.
- N2. **Not now on the notice screen** (`Notice.svelte` `leave`) calls `history.back()` whenever `history.length > 1`. Someone who reaches `/sign-in` from another site, a search result say, is sent back to that site. Spec 3.4 says "back to the screen before it in this app, or the feed when there is none". A same-origin `document.referrer` check, or a flag set on in-app moves, would keep them on Ruken.
- N3. **The gated sheet is a screen.** A gated press opens `/cookies?for=…` (a redirect) rather than a sheet over the screen as 3.4 describes. It names what was pressed and "I agree" goes on, so the criteria hold. The design review may want the sheet.
- N4. **Criterion 3's Join-from-a-game check** is made through Play (`cookie-consent.test.ts:162-177`), and it checks that `rk_arrival` is present, not that it names the maker. Join and Play take the same path (`rememberArrival` from `from`), so this is recorded, not red.
- N5. **Criterion 5's "no Session row is updated"** is proven by the unit test (`tests/features/accounts/handle.test.ts:93`: `getSession` is not called without `rk_consent`), not by the journey.
- N6. **Underlined links.** The owner's rule against underlined text links (18:04 UTC, being written into `this-repo` by another thread, not on `main` yet) will catch the notice's "What we keep" and `/privacy`'s new "cookies page" link, which take `look.css`'s default `a { text-decoration: underline }`. Whichever lands second fixes it.
- N7. `takeBack`'s sort (`cookies.ts:67`) looks only at its first argument. It still puts `rk_consent` last in V8, but `(a, b) => Number(a.name === CONSENT_COOKIE) - Number(b.name === CONSENT_COOKIE)` says what it means.

- N8. **A flake seen here.** `tests/browser/feed-controls.test.ts:262` ("pressing the speaker flips sound for every clip…") failed once on computer with 3 workers (`aria-pressed` stayed "false" for 15 s after the press) and passed 4 of 4 alone. This change only adds `...consented` to that file's `beforeAll`, so it is likely the same press-before-hydration race on a busy machine, not this change. For the coordinator to record under "Flaky tests".

## Criterion by criterion

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | No collection before a yes | Partly. The walk is clean, but it skips `/privacy` and `/terms`, which are gated (R1). | `cookie-consent.test.ts:63`; probe 1 |
| 2 | Not now | Met in code; the journey is flaky (R6; N2 on leaving the app) | `cookie-consent.test.ts:109` |
| 3 | I agree and each gated button | Met for Sign in, Sign up, Join and Play. Wishlist isn't on `main` (N1). | `:134`, `:162` |
| 4 | Take it back, CRUD | Met; probe 2 also shows the session row deleted | `:179`; probe 2 |
| 5 | Signed in before this ships | Met (N5) | `:205`; `handle.test.ts:93` |
| 6 | The guards | Partly. Cookie, write, device and storage guards are tested; the per-pattern gate check (R3) and the `/api/v1` cases (R4) are missing. | `tests/features/consent/*`, `tests/lib/server/db.test.ts:253` |
| 7 | Equal buttons | Met on the card; glass tokens checked by `tests/lib/glass.test.ts` | `:221` |
| 8 | Logs | Met in `tests/wrangler.test.ts` and the body, but the privacy page contradicts it (R2) | `tests/wrangler.test.ts:47` |
| 9 | Live, after merge | Not yet (needs the merge) | — |
| 10 | Words | The notice's words pass the drunk-grandma test. The notice shown in place of the privacy policy doesn't (R1). | `Notice.svelte` |

## Probes (kept out of the repo; their source is below)

Probe 1, run on tablet and computer with `storageState` empty:

```ts
for (const address of ["/privacy", "/terms", "/help", "/goodbye"]) {
  const answer = await request.get(address, { maxRedirects: 0 });
  console.log(`PROBE ${address} -> ${answer.status()} ${answer.headers()["location"] ?? ""}`);
}
// PROBE /privacy -> 303 /cookies?for=account&next=%2Fprivacy
// PROBE /terms -> 303 /cookies?for=account&next=%2Fterms
// PROBE /help -> 200
// PROBE /goodbye -> 200
```

Probe 2, on computer, consented: sign up, count `Session` rows for the user, press Take it back, count again, hide the tab, read the real sessionStorage from a same-origin frame. Result: 1 row before, 0 after, `[]` real sessionStorage, `[]` cookies.
