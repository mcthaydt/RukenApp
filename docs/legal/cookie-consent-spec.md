# Cookie notice: what Ruken keeps, and when it asks

**Not legal advice.** A spec for a later build, checked against the code on `main` at `f77ef2d` (14 November 2026). Nothing here is built yet. Sources are in `research.md`, section 5.

The Owner, 2026-11-14: "we need a cookie notice if we're collecting any data and we can't collect any data AT ALL until that's approved", and, asked whether necessary data could run without a yes: "Yes, no data at all until approval". So: before she agrees, nothing is stored or set, not even a sign-in. She can look at public pages. Signing up, signing in, paying and playing start only after she agrees.

## 1. Everything the site keeps or sends today

Found by reading every `cookies.set`, `cookies.delete`, `setCookie`, `localStorage`, `sessionStorage`, `console.*`, `fetch` and outside address in `src/`, `cloudflare/` and `wrangler.jsonc` on `main`.

### Cookies on Ruken's own address

| Name | Set by | When | Lasts | What it holds | Needed for the site to work? |
|---|---|---|---|---|---|
| `__Host-rk_session` (`rk_session` on localhost) | better-auth, `src/features/accounts/auth.ts`, `cookies.ts` | Signing up or in | 30 days, renewed once a day while used; gone on sign-out | A random sign-in token. HttpOnly, SameSite=Lax | **Yes.** Keeps you signed in. Strictly necessary. |
| `rk_welcome_back` | `auth.ts` (set), `src/routes/+layout.server.ts` (read and cleared) | Signing in undoes a waiting account deletion | 5 minutes, cleared on the next page | `1` | **Yes**, as part of signing in. Shows one "welcome back" line the person caused. Could be dropped for a line in the address instead. |
| `rk_arrival` | `src/features/membership/services.ts` (`remember`), read by `src/routes/join/+page.server.ts` | Opening a maker's page or a game link. **On `main` no page calls `remember` yet**; slice 3's maker pages and game links will | 400 days, or until a newer link replaces it | Which maker, which link, and when, sealed so it cannot be changed by hand. HttpOnly | **No.** It lets a maker earn the bringing bonus. The visitor did not ask for it. Needs a yes. |
| `__Host-rk_session_data`, `rk_dont_remember`, `rk_account_data` | named in `auth.ts` | Not set: the session cookie cache is off, "remember me" is always on, and account cookies are not used | — | — | Not used today. If any is ever turned on, it comes back here. |

No `localStorage`, `sessionStorage`, IndexedDB or `document.cookie` anywhere in `src/` on `main`. Fonts are served from Ruken's own address (`static/fonts/`). No analytics, no ads, no outside scripts on Ruken's pages.

### What Ruken's database keeps when someone uses the site

| What | Where | When | Why | Needed? |
|---|---|---|---|---|
| IP address and browser name per sign-in | `Session.ipAddress`, `Session.userAgent` | Each sign-in | Account security: lets the person and Ruken see where an account is signed in | Yes, for security (GDPR legitimate interest, recital 49). Could be dropped; nothing on `main` shows it to anyone yet. |
| Request counters by IP address and path | `RateLimit` (better-auth's keys) | Each sign-in, sign-up and reset request | Slows down people guessing passwords | Yes, for security. Counters are kept a day at most (`RATE_LIMIT_ROWS_KEPT_MS`). |
| Counters by a keyed hash of an email address (some with the IP) | `RateLimit` (keys starting `api:`), `auth-limits-plugin.ts` | Sign-in and reset requests | Limits tries per address | Yes, for security. The address is never stored in plain text. |
| Failed sign-ins per address | `SignInGuard` (a SHA-256 hash, never the address) | Wrong passwords | Pauses sign-in for an hour after many failures | Yes, for security. |
| Account, membership, payments, play, wishlist, maker data | the rest of the tables | When the person uses those parts | Running the account and the membership | Yes: it is the service they asked for. Listed in `privacy.md`. |

### Logs

| What | Where | Lasts | What it holds |
|---|---|---|---|
| Cloudflare Workers Logs (`"observability": { "enabled": true }` in `wrangler.jsonc` and `cloudflare/games/wrangler.jsonc`) | Cloudflare | 7 days on the Workers Paid plan (Cloudflare's docs) | One "invocation" entry per request, which Cloudflare fills with request details, plus the lines Ruken writes with `console.*`. Ruken's own lines never carry an email address (`mailFailureCode`) and name only what failed. **Not checked**: whether Cloudflare's invocation entries include the visitor's IP address or headers. The Owner can see one in the Cloudflare dashboard, Workers, ruken, Observability. |
| Cloudflare's own network logs and security | Cloudflare | Cloudflare's own terms | Every request passes through Cloudflare, which sees the IP address. If bot protection is ever turned on, Cloudflare may set `__cf_bm` or `cf_clearance` cookies. Not turned on in this repository. |

### Requests to other companies

| Company | From | When | What it gets |
|---|---|---|---|
| Stripe | The visitor's browser, on Stripe's own pages (Checkout, the billing page) | Joining, changing a card, cancelling | Card, billing address, email. Stripe sets its own cookies on its own pages, under Stripe's own policy. No Stripe script runs on Ruken's pages. |
| Stripe | Ruken's server | Checkout, webhooks, the daily job | Customer and subscription ids, the email |
| Resend | Ruken's server | Confirm-your-email, password reset, password changed, sign-in paused | The email address and the message. Resend keeps a log of sent mail under its own terms. |
| GitHub | The maker's browser (sign-in on github.com) and Ruken's server | A maker connects GitHub and Ruken pulls a game | The maker's GitHub account and chosen repositories |
| Neon (through Cloudflare Hyperdrive) | Ruken's server | Every database call | Everything in the database |

### Games (not on a page on `main` yet)

Games run in a frame on their own address (`cloudflare/games/`). A game may keep its own saved progress in the browser on its own address, and may talk to the outside servers its maker listed (the gate's `connect-src`). Ruken's maker agreement (point 4) says a game must not find out who a player is or collect their details without clearly telling them. While a game is on screen, Ruken's page will send a "still here" beat every few seconds to measure play time (`src/features/play/sessions.ts`), which is how makers are paid. **[LAWYER TO CONFIRM]** whether the beat counts as part of the service the member asked for (Ruken's view) or needs a yes; and what the notice must say about games' own storage.

## 2. The rule

**Before she agrees**, Ruken sets no cookie, keeps nothing in the browser, and writes nothing about her to its database or its logs. She can open and read every public page: the feed, clips, makers' pages, game pages, the legal pages.

**Signing up, signing in, joining, paying and playing** start only after she presses "I agree". Until then those buttons open the notice instead.

**After she agrees**, everything in section 1 runs as it does today, including the cookie that remembers which maker brought her. One yes covers it all; there is no second question.

**If she says no**, nothing is stored, not even her "no". The notice shows again on her next visit. She can still read public pages.

### What no website can avoid

Every request to any website carries the visitor's IP address, and Cloudflare's network receives it before Ruken's code runs. Ruken cannot read a page to someone without it. Under this rule Ruken does not **keep** it before a yes (section 4 says how), but Cloudflare's network still handles it in transit, under Cloudflare's own terms. The notice and the privacy page say this plainly. The legal basis for that handling is GDPR Article 6(1)(f), and the ePrivacy cookie rule does not cover it because nothing is stored on her device.

## 3. The notice

At the bottom of every public page until she chooses, and in front of Sign up, Sign in, Join and Play when she presses them. Two buttons of equal size and look. No pre-ticked boxes. Not "by using this site you agree".

> **Before you sign up or play**
>
> To sign you in and run your account, Ruken keeps a few things: small files in your browser (cookies), your email, and where you signed in from. We also remember which maker's link brought you here, so they get a thank-you share if you join.
>
> We don't show ads. We do not sell your data.
>
> [ I agree ]  [ Not now ]
>
> What we keep and why: [Privacy](/legal/privacy)

Why it passes the drunk-grandma test: it says what happens if she presses each button, in words she says out loud, and "Not now" leaves her on the page she was reading.

**"I agree":** sets `rk_consent=1` (6 months; then she is asked again), then carries on with what she pressed (sign up, sign in, join or play).

**"Not now":** closes the notice. Nothing is set or stored. Buttons that need an account keep opening the notice.

**Taking it back:** a "Cookies" link on every page shows the notice again, with "Withdraw my agreement". That deletes `rk_consent` and `rk_arrival` and signs her out on this browser. It does not delete her account; deleting the account is on the account page.

**Global Privacy Control** (`Sec-GPC: 1`): the notice still shows, since she may still want to sign in; Ruken never sets `rk_arrival` for that browser. [LAWYER TO CONFIRM]

## 4. What must change in the code so nothing is kept before a yes

Each item is later work, test first in CI, not built here.

| # | Today on `main` | Change | Where |
|---|---|---|---|
| 1 | No consent check anywhere | A helper `hasConsent(cookies)` reads `rk_consent`. The notice is server-rendered so it works without scripts. | new, in `src/features/accounts/` (it gates sign-in) |
| 2 | Sign up and sign in set `__Host-rk_session` and write a `Session` row with IP and browser | The sign-up and sign-in pages and their form actions refuse without consent and show the notice. The `/api/auth` route (`forward.ts`) refuses every endpoint without consent, so nothing reaches better-auth (no session, no `RateLimit` row by IP, no `SignInGuard` row, no reset mail). | `src/routes/sign-up`, `src/routes/sign-in`, `src/routes/forgot-password`, `src/routes/reset-password`, `src/features/accounts/forward.ts` |
| 3 | `rk_arrival` (`remember` in `membership/services.ts`) would be set on a maker's page or game link once slice 3 calls it | `remember` sets it only with consent. Without consent the link still opens; the arrival is not remembered. Withdrawing deletes it. | `src/features/membership/services.ts`, slice 3's routes |
| 4 | Join, checkout and the billing page need a session already | Covered by 2 (no session without consent). `/join` shows the notice first when there is none. | `src/routes/join` |
| 5 | Signed-out free play (FloorFifty) writes a `PlayPass` with no user and a `PlaySession` and beats with no user | Play needs consent, signed in or not. Without it the Play button shows the notice. The rows hold no name, email or IP, but they are a record of her visit, so under the Owner's rule they wait. Games also store their own saves in the browser on their own address, which is another reason Play waits. | `src/features/play/sessions.ts`, `passes.ts`, the play route (slice 2/3) |
| 6 | Cloudflare Workers Logs keep an "invocation" entry for every request for 7 days (`"observability": { "enabled": true }` in both `wrangler.jsonc` files), which may hold the IP and headers | Turn off invocation logs and keep only Ruken's own `console` lines, which never carry an email or IP. Cloudflare documents an `invocation_logs = false` setting; check it against the current Wrangler docs. This is a change to the Worker's settings: approved by the Owner on 2026-11-14 ("L10 A", via the coordinator); the commit quotes it, and the Owner makes the matching Cloudflare change. | `wrangler.jsonc`, `cloudflare/games/wrangler.jsonc` |
| 7 | Ruken's own `console.*` lines (`auth.ts`, `membership/services.ts`, `join`, `me`, `me/delete`, `webhooks/stripe`) | No change: none holds an IP or email, and all but the webhook run only for a signed-in person. Add a test that no log line includes an IP or an `@`. | those files |
| 8 | `rk_welcome_back` | No change: set only when signing in, which needs consent. | `auth.ts` |
| 9 | Analytics, ads, outside scripts, fonts from elsewhere | None today. Any added later must wait for consent, and needs the Owner's words first (no new tool without them). | — |
| 10 | Stripe webhooks, the daily job, GitHub callbacks | No change: these are servers talking to Ruken, not a visitor's browser, and concern people who already agreed. | — |
| 11 | Cloudflare's bot protection (`__cf_bm`, `cf_clearance`) | Not on now. Must stay off for public pages, or the rule breaks. | Cloudflare dashboard |

## 5. What this costs

- Every visitor sees a notice before signing up or playing, including on launch day, when FloorFifty is free with no account. Free play now needs one press of "I agree" first.
- A maker's link opened before a yes brings no bonus unless she agrees on that visit, before she leaves.
- Problems on public pages are harder to find, because Cloudflare's per-request logs are off (item 6).

## 6. Tests to write first (later)

- A public page with no `rk_consent`: the answer sets no cookie, and no row is written to any table.
- Sign up, sign in, forgot password and every `/api/auth` path without consent: refused with the notice; no `Session`, `RateLimit`, `SignInGuard` or `Verification` row.
- A maker link without consent sets no `rk_arrival`; with consent it does; withdrawing deletes both cookies and the session.
- Play without consent writes no `PlayPass` or `PlaySession`.
- The notice's two buttons have the same size and look (a browser check).
