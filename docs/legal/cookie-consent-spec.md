# Cookie notice: what Ruken keeps, and when it asks

**Not legal advice.** A spec for a later build, checked against the code on `main` at `f77ef2d` (14 November 2026). Nothing here is built yet. Sources are in `research.md`, section 5.

The Owner, 2026-11-14: "we need a cookie notice if we're collecting any data and we can't collect any data AT ALL until that's approved".

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

## 2. Sorted

**Strictly necessary** (the law lets these run without a yes; the notice still says they exist):
- the sign-in cookie `__Host-rk_session`;
- `rk_welcome_back` (or replace it with a line in the address, and it goes away);
- the security records: sign-in IP and browser, rate-limit counters, the failed-sign-in pause;
- Cloudflare receiving each request, and its 7-day logs;
- the cookie that remembers the person's cookie choice (new, see below);
- payment on Stripe's pages, mail through Resend, the database: these run only when the person signs up, joins or asks for a mail.

**Not strictly necessary** (blocked until the person says yes):
- `rk_arrival`, "which maker brought you".

**Unclear, for the lawyer:** the play-time beat, and games' own storage.

## 3. What cannot wait for a yes

The Owner's rule is "no data at all until approved". Some data the site cannot work without, and the law does not ask for a yes for it:

- **Every page request carries the visitor's IP address** to Cloudflare. No site can answer a request without it. This happens before any notice can be shown. Legal basis: GDPR Article 6(1)(f), the site's legitimate interest in delivering and securing itself; not covered by the ePrivacy cookie rule because nothing is stored on the device.
- **Signing in needs a cookie.** Without `__Host-rk_session` nobody can stay signed in. Legal basis: ePrivacy Article 5(3), strictly necessary; GDPR Article 6(1)(b), the contract.
- **Security records** (sign-in IP, rate limits, the pause): GDPR Article 6(1)(f) and recital 49.
- **Payment**: the person goes to Stripe's page to pay; Stripe needs their card. GDPR Article 6(1)(b).

Options for the Owner (decision, not mine):
- **(A) Recommended.** These run without a yes, and the notice says so in plain words. The one optional cookie, `rk_arrival`, waits for a yes. This is what the law asks, and what most sites do.
- **(B)** Show the notice first and keep Sign up, Sign in and Join shut until the person presses OK. The IP address still reaches Cloudflare on the first page, so this does not reach "nothing at all"; it only delays sign-in. A "No" then means they cannot sign in, which makes the OK a condition of using the site rather than a free choice.
- **(C)** Also cut Cloudflare's logs to the minimum (turn off Cloudflare's per-request invocation logs and keep Ruken's own lines; Cloudflare documents an `invocation_logs = false` setting, to be checked against the current Wrangler docs). This is a change to the Worker's settings and needs the Owner's words.

## 4. The notice

Shown at the bottom of the first page a visitor opens, on every page, until they choose. It does not cover the Play button or the feed. Two buttons of equal size and look. No pre-ticked boxes, no "by using this site you agree".

> **Cookies on Ruken**
>
> We use a few small files to keep you signed in and keep accounts safe. Ruken can't work without them.
>
> Can we also remember which maker's link brought you here? If you join, that maker gets a thank-you share.
>
> We don't show ads. We do not sell your data.
>
> [ Yes, that's fine ]  [ No thanks ]
>
> More about this: [Privacy](/legal/privacy)

Why these words pass the drunk-grandma test: one question, two answers that say what they do, no word she would not say out loud ("cookies" is in the title only, explained in the first line).

## 5. What happens

**Before she chooses:** the strictly necessary items only. `rk_arrival` is not set. A maker's link still opens the page and the game; it just is not remembered.

**"Yes, that's fine":** a choice cookie `rk_cookies=yes` is set (6 months, then she is asked again). From then on, opening a maker's page or a game link sets `rk_arrival` as today. The link she arrived on, if she arrived on one in this visit, is remembered at that moment, not before.

**"No thanks":** a choice cookie `rk_cookies=no` is set (6 months). `rk_arrival` is never set, and any old one is deleted. Everything else works the same: watching, signing up, joining, playing. If she later joins, no maker gets the bringing bonus for her.

**Changing her mind:** a "Cookies" link in the footer of every page opens the same two buttons. Saying no after yes deletes `rk_arrival`.

**Browser "do not track" signals:** a browser that sends Global Privacy Control (`Sec-GPC: 1`) is treated as "No thanks" without asking. [LAWYER TO CONFIRM]

**Signed-in people:** the choice is per browser, not per account. Nothing is stored in the database about it.

## 6. What this means for makers

A visitor who says no, or never answers, cannot be counted as brought by a maker. Some makers will get fewer bringing bonuses than the design expects. The Owner should know this before choosing (`research.md`, Owner question 7).

## 7. Building it (later work, not now)

- The choice cookie: `rk_cookies`, `yes` or `no`, 6 months, `SameSite=Lax`, `Secure`, `Path=/`, HttpOnly (the server renders the notice, so no page script needs to read it).
- `remember` in `membership/services.ts` checks the choice before setting `rk_arrival`; "No thanks" deletes it.
- The notice is server-rendered, so it works with scripts off.
- Tests: a maker link with no choice sets no `rk_arrival`; after "Yes" it does; after "No" it does not and an old one is gone; `Sec-GPC: 1` acts as "No"; the notice's two buttons have equal weight (a browser check).
