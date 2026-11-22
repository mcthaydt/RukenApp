# Nothing kept before "I agree"

Date: 2026-11-22. Status: **spec, waiting on its plan audit.** Lane 3: it changes `src/features/membership/` (the arrival cookie), the database layer every route uses, `src/hooks.server.ts`, both `wrangler.jsonc` files and what Ruken writes about every visitor. **Not legal advice.**

Lines marked **Owner** are the owner's words. Lines marked **Call** are this spec's choices; the owner can overrule any of them. Checked against `main` at `23d178f` and the live site on 2026-11-22 16:45 UTC.

Started from the near-ready spec of closed RukenApp #104 (kept privately), refreshed for today's `main` and the branches in flight.

## 0. The owner's direction

- **Owner, 2026-11-22 16:41 UTC:** "Create the privacy policy, terms page, and cookies notice; do NOT collect ANY data until the cookies is accepted so we don't get sued".
- Read strictly (the coordinator's brief, same time): before "I agree", Ruken sets no cookie, keeps nothing in the browser, writes nothing about the visitor to its database and sends no event. "Not now" stores nothing, not even the "no". Consent can be taken back from a link. Cloudflare's invocation logs are off.
- The standing owner rules apply: everything custom, no browser-default look (2026-11-22 15:51); see-through surfaces are the frosted glass in `src/lib/look.css` (13:46); app feel; spinners for every wait (05:52); the drunk-grandma test.
- The privacy and terms pages are a separate thread ("Add privacy policy and terms pages", branch `claude/project-thread-xa97zr`): `/privacy` and `/terms`. This spec links to `/privacy` and adds one cookie (`rk_consent`) that page must list.

## 1. What Ruken keeps or sends today, before anyone agrees

Found by reading every `cookies.set`, `setCookie`, `localStorage`, `sessionStorage`, `sendBeacon`, `increment` and database write reachable from a page a stranger can open, on `main` at `23d178f` and on the open branches.

### Cookies (Ruken's own address)

| Name | Set by | When, today | Needs a yes under this spec |
|---|---|---|---|
| `rk_arrival` | `membership/services.ts` `remember`, called from `src/routes/g/[game]/+page.server.ts:37` and `src/routes/[handle=handle]/+page.server.ts:18` | **Opening any game page or maker page, signed out.** Measured live: `curl -sI https://ruken.io/g/floor-fifty` answers `set-cookie: rk_arrival=…; Max-Age=34560000` (400 days). | Yes |
| `__Host-rk_session` | better-auth (`accounts/auth.ts`, `cookies.ts`, `handle.ts` renews it daily) | Signing up or in (email or phone) | Yes: sign-in waits for it |
| `ruken_sign_up` | `accounts/forms.ts` `browserOf` | The sign-up form | Yes (sign-up waits) |
| `rk_welcome_back` | `accounts/auth.ts` | Signing in undoes a waiting deletion | Yes (sign-in waits) |
| `thrown-away`, `page-saved` | `src/routes/make/…` | Maker area, signed in | Already behind sign-in |
| `rk_wish_pressed` | branch `claude/project-thread-mqxj7b` (Wishlist, not merged) | Signed out pressing Wishlist, before the short sign-up | Yes: Wishlist opens the notice first |
| `rk_test_launch` | `launch/now.ts` | Journeys only; the real site never reads it | Not on the real site |

### The browser's own storage

| Key | Where | When | Needs a yes |
|---|---|---|---|
| `rk_seen_hints` (localStorage) | `src/features/feed/Feed.svelte:136` | First open of the feed, signed out included | Yes. Without it the hints show each visit and nothing is written. |
| `rk_menu_tab` (localStorage) | `src/routes/g/[game]/play/+page.svelte:52` | Moving the play menu | Yes (play waits) |
| `sveltekit:history-info`, `sveltekit:snapshot`, `sveltekit:navigation-snapshot` (sessionStorage) | SvelteKit 3.0.0 itself, not `src/`: `client.js` `persist_state()` (`:686-694`) on `beforeunload` and on the tab going hidden (`:3086`, `:3113`), including during unload | Every visitor who switches tabs or leaves | Yes: never reach the real storage without one (3.3, guard 4) |

No other `sessionStorage`, no IndexedDB, `document.cookie` or service worker in `src/`. Fonts are Ruken's own. No analytics, ads or outside scripts.

### Database writes a stranger causes

| What | Where | When | Needs a yes |
|---|---|---|---|
| `MakerPage.views + 1` | `pages/service.ts` `countView`, from `[handle=handle]/+page.server.ts:16` | Opening a maker's page | Yes: not counted without it |
| `PageLink.taps + 1` | `pages/service.ts` `tapLink`, from `[handle=handle]/out/[link]/+server.ts` | Tapping a link on a maker's page | Yes: the link still opens, the tap is not counted |
| `RateLimit` row keyed by IP, `PlayPass`, `PlaySession`, beats | `play/sessions.ts` `startPlay` (`api:play-start:<ip>`), `play/beat` | Pressing Play on a free game, signed out | Yes: Play opens the notice first |
| `Session` (IP, browser), `RateLimit`, `SignInGuard`, `Verification`, texts and mail sent | better-auth through `/api/auth` and the sign-in, sign-up, forgot-password and phone forms | Signing up or in | Yes |
| Session renewal (row extended, cookie re-sent) | `accounts/handle.ts` | Every page for a signed-in browser | Yes (see 3.6) |
| Wishlist rows | branch `mqxj7b` | Signed in only | Already behind sign-in |
| `ComputerSignIn`, `ComputerKey` rows and the terminal's game and video writes | #331 (`claude/project-thread-ps17ej`): `/api/v1/*` | A terminal holding a key, or asking to sign in | See 3.7 (machine kind) |

In flight and covered by the rule, not by this table: the endless feed (#329) only reads; the learned feed (thread "Spec the learned feed") will record watch signals and More/Less like this, which are writes and wait for a yes.

### Logs and other companies

- **Cloudflare Workers Logs.** `"observability": { "enabled": true }` in `wrangler.jsonc:18` and `cloudflare/games/wrangler.jsonc:14` keeps one invocation entry per request (request details) for days. Turned off (3.8).
- **Cloudflare's network** sees every request's IP address in transit before Ruken's code runs. Ruken cannot answer a page without it and does not keep it before a yes. The privacy page says so. No Cloudflare cookie is set today (the curl above: none on `/`, `/help`, `/sign-in`, `/g/floor-fifty` besides `rk_arrival`); bot protection must stay off for public pages.
- **Stripe, Resend, the text sender, GitHub, Neon**: reached only from joining, signing in or the maker area, all of which wait for a yes. Webhooks and the cron jobs are servers talking to Ruken, not a visitor.

## 2. The outcome

1. Before "I agree" a visitor can open and read every public screen (the feed, games' pages, makers' pages, help, the legal pages) and Ruken sets no cookie, writes no browser storage, writes no database row and sends no event about them. The browser sends only page and media loads (`GET`/`HEAD`), never a form, a beacon or a `POST`.
2. Sign up, Sign in, Join, Play, Wishlist and Add a game open the notice first. "I agree" carries on to what was pressed.
3. "Not now" closes the notice and stores nothing. It stays closed while the person moves around the app; a reload or a new visit shows it again.
4. "I agree" sets one cookie, `rk_consent`, and from then on everything in section 1 works as it does today.
5. `/cookies` shows what this browser agreed to and has **Take it back**, which deletes every Ruken cookie and storage key on this browser and signs it out here. It does not delete the account.
6. Cloudflare keeps no invocation log for either Worker.

## 3. The design

### 3.1 The consent cookie

- `rk_consent=v1`, `Path=/`, `Secure`, `SameSite=Lax`, `HttpOnly`, `Max-Age` 180 days. **Call:** HttpOnly and read only on the server; the layout tells the page whether this browser agreed (3.4).
- `v1` names the notice's wording. A change to what Ruken keeps bumps it, and everyone is asked again.
- **Call:** one yes covers everything (sign-in, play, the arrival thank-you, counts). No second question, no toggles: Ruken has nothing optional like ads or analytics, and one question passes the drunk-grandma test.

### 3.2 A new feature, `consent`, lowest in the layer list

`src/features/consent/` holds: the cookie's name and value, `hasConsent(cookies)`, `agree(cookies)`, `takeBack(cookies)` (deletes every Ruken cookie by name), the route kinds (`consent/routes.ts`, 3.7), and the browser-side `deviceStore` (3.5). It goes first in `FEATURE_ORDER` in `tests/architecture.test.ts`, below `accounts`, because `accounts` and every feature above read it.

### 3.3 Four guards, so a missed spot fails loudly instead of collecting quietly

The rule is enforced at the narrowest points every request passes, not route by route, so a later feature (the learned feed, say) cannot forget it.

1. **Cookie guard** (a `Handle` in `hooks.server.ts`, right after `httpsOnly`). An answer counts as consented when the request carries `rk_consent=v1` **or** the answer itself sets `rk_consent=v1` (the agree action), so the `rk_arrival` the agree action sets in the same answer (3.4) is kept; the request's write flag follows the same rule. Without either, any `Set-Cookie` on the answer other than `rk_consent` itself, or a deletion (`Max-Age=0`), is removed, and one log line names the cookie (never its value). A unit test proves the removal; the journeys prove none is sent, so in practice the guard never fires.
2. **Write guard** (in `src/lib/server/db.ts`, the per-request database store). The request's store carries `writesAllowed`, set from consent or a machine route. When false, every Prisma write (`create*`, `update*`, `upsert`, `delete*`, `$executeRaw*`, and writes inside `$transaction`) throws `NoConsentWrite` naming the model. **Call:** throw, not skip: a write that slipped through is a bug the journeys must see as a failed page, never a silent record. Reads are untouched.
3. **Device-store guard** (browser). `deviceStore.get/set` writes `localStorage` only when the layout says this browser agreed; otherwise it keeps the value in memory for this visit. A test fails if `localStorage` or `sessionStorage` appears anywhere in `src/` outside `deviceStore` and guard 4.
4. **Framework-storage guard** (browser). SvelteKit writes three `sveltekit:` keys to `sessionStorage` when the tab goes hidden and again during unload (`beforeunload`, then `visibilitychange` to hidden after `pagehide`), whatever the visitor chose, and its listeners are added last in `start()` (`client.js:566`), after any hook. Clearing after it cannot be ordered reliably, so **Call:** the writes never reach the real storage. A small inline script at the top of `<head>` in `src/app.html`, which runs before any module (SvelteKit's included), replaces `window.sessionStorage` with an in-memory object of the same shape **unless** the server says this browser agreed (the server writes the flag into the page through `transformPageChunk` in the consent `Handle`, since `rk_consent` is HttpOnly). It fails closed: a page rendered without the flag (an error page, a missed transform) gets the stand-in and keeps nothing. SvelteKit's `session-storage.js` looks the global up on each `get`/`set`, so all three writes land in memory and vanish with the page. On "I agree" without a reload the script's `restore()` removes the stand-in; on Take it back it puts it back and the real storage is cleared. The builder proves the order in the journey (criterion 1), not by reading. The cost: a tab without a yes does not get its scroll place back after a reload. With a yes nothing changes. If a supported browser refuses the replacement, the 3.10 question is the fallback and the builder stops and reports.

### 3.4 The notice

- **Where.** A frosted-glass card at the bottom of every screen for a browser without `rk_consent` until it chooses, above the bottom bar on the feed. In front of the screen (a sheet over a dim, `--dim-bg`/`--dim-filter`) when someone presses a button that needs it. Drawn from `look.css` tokens only (`--glass-bg`, `--glass-filter`, the button sizes): no browser-default controls, no `<style>` block in a screen.
- **Words** (v1):

  > **Cookies?**
  >
  > To sign you in, let you play and thank the maker who sent you, Ruken keeps a few small things in your browser. We keep nothing until you say yes.
  >
  > No ads. We never sell your data.
  >
  > [ I agree ]  [ Not now ]
  >
  > [What we keep](/privacy)

  The sheet's first line, when a button opened it, says what was pressed: "To sign in, Ruken needs to keep a few small things in your browser." (and "To play", "To join", "To save this game").
- **The two buttons** are the same size, shape, weight and colour family, side by side (stacked on the small phone, same width), and both reachable by keyboard with visible focus. No pre-ticked box; no "by using this site". A browser check compares their boxes and computed styles.
- **I agree** is a plain form (`POST /cookies?/agree` with `next`), so it works before scripts load; with scripts it does not reload the screen (app feel) and shows the busy spinner while it sends. It also carries `from`, the same-site page it was opened on; when that is a game page or a maker's page, the action calls `arrival.remember` for that page's maker before going on, so a yes given from Join, Play or Sign in on `/g/x` still thanks the maker who brought them. It sets `rk_consent` and goes to `next`: the screen behind, or what was pressed (`/sign-in?next=…`, the game's play screen, the Join screen). Coming back to the game or maker page that was open means its load now sets `rk_arrival` and counts the view, so the maker who brought them is still thanked.
- **Not now** is a button with no request. It hides the card in memory only. On a screen whose form waits for a yes (sign-in, sign-up, the password pages, `/join`), Not now leaves that screen: back to the screen before it in this app, or the feed when there is none, so nobody is left on an empty screen. Escape is Not now; focus goes into the sheet when it opens and back to the pressed button when it closes.
- **Without scripts**, Not now is a link to the same address with `#` and the card stays; acceptable.

### 3.5 Every collector, wired

| # | Collector | Change |
|---|---|---|
| 1 | `rk_arrival` (`membership/services.ts` `remember`) | Sets only with consent. Without it the page opens and nothing is remembered. `takeBack` deletes it. |
| 2 | `countView`, `tapLink` (`pages/service.ts`) | Counted only with consent. `out/[link]` still redirects. |
| 3 | Sign up, Sign in, Forgot password, Reset password, phone code pages and their form actions | Without consent the page shows the notice card in place of the form (server-rendered), and the action refuses with the notice. |
| 4 | `/api/auth/*` (`accounts/forward.ts`) | Refuses every path without consent (403, plain words), so nothing reaches better-auth. |
| 5 | `/join` and its actions | The notice first. |
| 6 | `/g/[game]/play` load and `play/beat` | Without consent the load redirects to the game page with the sheet open; no `startPlay`, no rate-limit row. |
| 7 | Wishlist (when it lands) | The Wishlist button opens the sheet first; `rk_wish_pressed` only with consent. Whichever of the two lands second wires it. |
| 8 | `rk_seen_hints`, `rk_menu_tab` | Through `deviceStore`. |
| 9 | Add a game (`/make`) | Already needs sign-in, which needs consent. |
| 10 | The layout | `+layout.server.ts` returns `consented`; the layout shows the card when false. `rk_welcome_back` read and cleared only with consent. |

### 3.6 People already signed in

**Call:** without `rk_consent`, `createHandle` does not read the browser's sign-in cookie:  the caller is `none`, no renewal is written and no cookie is re-sent. The sign-in cookie already on the device is left as it is. When they press "I agree", the next request reads it and they are signed in again, with nothing lost. So on the day this ships, the owner and testers see the notice once and carry on after "I agree". On the machine kind it still reads what those routes use: #331's terminal key on `/api/v1/*` (`accounts/handle.ts`) is read with or without `rk_consent`, so a terminal is not turned into `none`.

### 3.7 Routes no visitor's browser calls

Every route is exactly one of three kinds, named in `consent/routes.ts`:

- **Open**: answers without a yes and writes nothing (the write guard stays on): `/`, `/about` (the landing page, on branches now), `/g/[game]`, `/[handle=handle]`, `/[handle=handle]/out/[link]`, `/help/*`, `/legal/*`, `/privacy`, `/terms`, `/goodbye`, `/cookies` (agree writes only `rk_consent` and, from a game or maker page, `rk_arrival`; Take it back runs only with a yes and deletes the cookies, storage keys and session row listed in 3.9), the missing page, and #329's `GET /api/feed` when it lands.
- **Machine**: called by a server or a terminal, never a visitor's browser, so writes are allowed without `rk_consent`, each with its reason: `/webhooks/stripe` (Stripe, signed), `/jobs/*` (the crons, secret-signed), `/healthz` (writes nothing), and #331's `/api/v1/*` ("called by a terminal holding a key that a signed-in person made on `/me/link`, which needed a yes; a request with no valid key writes nothing"). On `/api/v1/*` writes are allowed only after the key checks out, except `sign-in/start` and `sign-in/finish`, whose row names no one until a person presses Yes in a browser that agreed.
- **Gated**: shows the notice or refuses without a yes, listed by path pattern too: `/sign-in/*`, `/sign-up/*`, `/forgot-password/*`, `/reset-password/*`, `/sign-out`, `/join/*`, `/g/[game]/play/*` (`play/beat` included), `/g/[game]/wishlist` (when it lands), `/api/auth/*`, `/me/*`, `/make/*` (the GitHub callback included).

A test lists every `+server.ts`, `+page.server.ts` and `+page.ts` under `src/routes` and fails for any route file in no list or in two, so a new route must be named before CI passes. A second test checks each gated pattern really is gated: a request to one route per pattern with no `rk_consent` gets the notice, a refusal, or a redirect whose target shows the notice (for example `/me` sending a signed-out browser to `/sign-in`, which shows it), and writes nothing; the test follows a redirect once and checks the notice is on the screen it lands on.

Whichever of #331 and this lands second wires `/api/v1/*` into the machine kind.

### 3.8 Logs off

- **Games Worker** (`cloudflare/games/wrangler.jsonc`): it writes no `console` line (`cloudflare/games/worker.ts`, `src/features/play/gate.ts`), so `"observability": { "enabled": false }`.
- **Site Worker** (`wrangler.jsonc`): `"observability": { "enabled": true, "logs": { "invocation_logs": false } }`, keeping Ruken's own `console` lines (errors, the guards' lines) and dropping Cloudflare's per-request entries. Before building on it the implementer checks two things and writes the answers, with their sources, into the pull request body: (1) the key exists in the installed Wrangler's `config-schema.json`; (2) from Cloudflare's Workers Logs documentation, which fields Cloudflare stores beside each kept `console` line. If any of them is a detail about the visitor (IP address, headers, full address with query, browser), the site Worker also goes to `"enabled": false`, and Ruken's error lines are given up until that is solved in its own thread. If the key does not exist, stop and report.
- `tests/wrangler.test.ts` asserts the chosen setting for each file. The site Worker deploys on merge; the games Worker is deployed separately today, so the coordinator schedules its deploy (never the owner).

### 3.9 Taking it back

`/cookies`: with consent, "You said yes on this browser on <date>." and one button, **Take it back**. It deletes `rk_consent`, `rk_arrival`, `rk_wish_pressed`, `ruken_sign_up`, `rk_welcome_back`, the session cookie (and the session row, as sign-out does), clears every `rk_` key in `localStorage`, and says "Done. Ruken keeps nothing on this browser now." Without consent it shows the notice. Linked from: the notice ("What we keep" sits on `/privacy`, which links here), the You page, the sign-in page's foot, and `/privacy`. **Call:** not a link on every screen: the feed and game screens are full-screen; the You page and the notice cover everyone, signed in or not.

### 3.10 Open legal questions (not built; for a lawyer)

- **Asked again every visit.** "Not now" stores nothing (the owner's strict reading, kept), so a visitor who refuses sees the card on every visit, while a yes lasts 180 days. Does asking again every visit make refusing harder than agreeing?
- **One yes for everything.** One yes covers what the person asked for (sign-in, play) and what they did not (the maker's thank-you cookie `rk_arrival`, page view and link-tap counts). May sign-in wait on a yes that also covers referral tracking, or must those be a separate choice?
- **"We never sell your data."** "Sell" has a legal meaning in some US states (for example, sharing with a partner for value). Is the sentence true as written for Stripe, the text sender and the makers' thank-you?
- **Framework storage.** If clearing SvelteKit's `sveltekit:` keys (guard 4) proves unreliable on some browser, is a tab-only scroll place kept in that tab allowed before a yes?
- Global Privacy Control: nothing optional is kept separately, so there is nothing to switch off by it; confirm.
- Whether a 180-day `rk_consent` is right for every state and country Ruken serves.
- What the notice must say about a game's own saves on its own address (a game runs only after a yes).

## 4. Acceptance criteria

Each is observed by a program unless marked "person".

1. **No collection before a yes, three devices.** A new journey, `tests/browser/cookie-consent.test.ts`, runs on `phone` (WebKit), `tablet` and `computer`. With a fresh browser it opens `/`, scrolls the feed past the hints, opens a game page, a maker's page, taps a maker's link, opens `/help`, `/legal/maker-agreement`, `/privacy`, `/terms` (when merged), `/sign-in`, `/sign-up`, `/join`, `/g/<game>/play` and a missing page. Before measuring it makes the tab really hidden (overrides `document.visibilityState` to `'hidden'` and dispatches `visibilitychange`, so SvelteKit's own listener writes) and then reloads, so SvelteKit's unload writes happen too. A `page.addInitScript` reads the real `sessionStorage` at the start of the reloaded page, before any page script (guard 4's included) runs, and records its keys; those must be none, as must the storage read at the end. Afterwards: `context.cookies()` is empty; `localStorage` and `sessionStorage` have no keys at all, `sveltekit:` included, and IndexedDB has no databases on Ruken's origin; every request the page sent was a `GET` or `HEAD` (no `POST`, no beacon); the maker page's `views` and the link's `taps` are unchanged; and no `Session`, `PlayPass`, `PlaySession` or `Verification` row was made for the run's own unique game, maker and test account (rows read only by keys the run owns, since parallel workers share an IP). The write guard (3.3) makes any other write fail the page, which fails the journey.
2. **Not now.** The same walk after pressing Not now: the same empty results; the card stays hidden while moving around the app; after a reload it is back. Not now on `/sign-in` lands on the screen before it, or the feed.
3. **I agree, and each gated button.** Pressing Sign in, Sign up, Join, Play and (when merged) Wishlist with no consent opens the sheet naming the action; "I agree" lands on what was pressed; `rk_consent` is the only new cookie before that screen acts; playing then works and the maker page then counts a view and sets `rk_arrival`. Landing on a game page from a maker's link, pressing Join and agreeing leaves `rk_arrival` naming that game's maker.
4. **Take it back (CRUD of the one thing a visitor makes here).** Create: agree. Read: `/cookies` says yes and the date. Update: agree again after taking back. Delete: Take it back leaves no Ruken cookie and no `rk_` storage key, the browser is signed out, and the next page shows the notice. Signing in again needs a new yes.
5. **Signed in before this ships.** A browser with a valid session cookie and no `rk_consent` is treated as signed out, no `Session` row is updated, and after "I agree" it is signed in again.
6. **The guards.** Unit tests: the cookie guard removes a stray cookie and keeps `rk_consent` and deletions; an answer that sets `rk_consent` keeps its other cookies (`rk_arrival`); the write guard throws on each write kind and allows reads; `deviceStore` writes only when agreed; no `localStorage`/`sessionStorage` outside it; every route is exactly one of open, machine or gated (3.7); `/api/auth/*` refuses without consent; one `/api/v1` write with a valid key and no cookie succeeds, and one with no valid key writes nothing (once #331 is on `main`).
7. **Equal buttons.** On all three devices, I agree and Not now have the same height, width (within 1px), font size, font weight and border radius; both are reachable by Tab with visible focus; the card uses the glass tokens.
8. **Logs.** `tests/wrangler.test.ts` asserts the games Worker's observability is off and the site Worker's setting chosen under 3.8; the pull request body carries the two checks of 3.8 with their sources.
9. **Live (person, after merge).** `curl -sI` on `/`, a game page and a maker page of ruken.io answers with no `set-cookie`. The verify run walks the notice on the deployed site.
10. **Words** pass the drunk-grandma test (person: the audit and the design review read them).

## 5. Boundaries

- **No new dependency, tool, environment or spend.** Only code in this repo and two settings in the `wrangler.jsonc` files.
- **The legal pages:** `/privacy` and `/terms` are their own thread. This build adds its own part to `/privacy` in the same pull request: `rk_consent` in the "Cookies and your browser" list, the sentence that nothing is kept before a yes, and the `/cookies` link (`tests/routes/privacy/cookies.test.ts` fails otherwise). If `/privacy` has not reached `main` when the build starts, the builder coordinates with the "Add privacy policy and terms pages" thread.
- **Out of scope:** Cloudflare zone settings (only checked, item 9); a cookie preference centre with toggles.
- **Expected duration:** execution about one working day; the overrun in Settings applies at two.
- **Supported browsers:** the three device profiles in `playwright.config.ts`.

## 6. Plan (one implementation pull request, lane 3)

Units run in this order on one branch, because each reads the one before. Each step is test first.

| Unit | Waits on | Owns | Output | Check |
|---|---|---|---|---|
| A. Consent core | — | `src/features/consent/*`, `tests/architecture.test.ts` (one line), `tests/features/consent/*` | cookie, `hasConsent`, `agree`, `takeBack`, route kinds | unit tests (criterion 6) |
| B. Guards | A | `src/lib/server/db.ts` (a Prisma query extension reading the request's store, not the adapter, which cannot tell `INSERT … RETURNING` from a read), `src/hooks.server.ts`, `src/features/consent/cookie-guard.ts`, `deviceStore`, the framework-storage guard, `src/app.html` (guard 4's inline script; lane 2, named in the pull request body), the journeys' default `rk_consent` helper in `tests/browser/support/*` (so the branch stays green once the write guard is on), their tests | the four guards | criterion 6 |
| C. Notice and `/cookies` | A | `src/features/consent/Notice.svelte`, `src/routes/cookies/*`, `src/routes/+layout.*`, `src/routes/privacy/+page.svelte` (its part only, section 5) | the card, the sheet, agree, take back | criterion 7; unit tests on the action |
| D. Wire every collector | B, C | the files in 3.5 and 3.6 | each row of 3.5 | criteria 1–5 |
| E. Logs off | — | `wrangler.jsonc`, `cloudflare/games/wrangler.jsonc`, `tests/wrangler.test.ts` | 3.8 | criterion 8 |
| F. Journeys | D | `tests/browser/cookie-consent.test.ts` | criteria 1–5, 7 on three devices | CI green |

- [ ] A. Consent core
- [ ] B. Guards
- [ ] C. Notice and `/cookies`
- [ ] D. Wire every collector
- [ ] E. Logs off
- [ ] F. Journeys (and the existing journeys' agree step)
- [ ] `verify` run on the three devices; screens shot for the notice, the sheet and `/cookies`
- [ ] Implementation audit (fresh session), fixes

**Existing journeys.** Nearly every journey signs in or plays, so each needs consent first. The helper that opens a fresh browser sets `rk_consent=v1` by default (the one change to shared test support, lane 2, in unit B), and the new journey opts out. This is named in the pull request body as a change to existing tests, with the reason.

**Ordering with branches in flight.** Wishlist (`mqxj7b`), the endless feed (#329), the terminal sign-in (#331), the landing page (`/about`, on `2vpwcj`, `7n8oys`, `mrv5mc`, `p8v82x`, `r9qwvl`), the learned feed and the privacy pages (`xa97zr`) touch the same screens; the builder re-checks section 1 against `main` when it starts. Whichever merges second wires the rule for the other; the route test in 3.7 and the write guard make a miss fail CI.

## 7. Lane and reviews

Lane 3: plan audit on this spec's pull request, then execution (Sonnet 5.5, medium, a fresh session, using the execution prompt in `staged-path`), then a fresh implementation audit (Opus 5.5, medium), fixes by the implementer, and green CI. Merge under the standing permission recorded in `progress.md`.
