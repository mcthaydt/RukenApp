# Screens audit, 2026-11-14

Owner, 2026-11-14: "take a screenshot of every single screen, every orientation, every device type, audit them one by one".

This is an audit of `main` at `6ad0214` (merge of #64), as it runs on the live test-mode site `ruken.<account>.workers.dev` and, for the states the live site cannot reach quickly, on a local copy of the same commit. Findings are reported, not fixed: no code changed in this branch.

The board, with every screenshot grouped by screen and each screen's findings beside it: https://claude.ai/artifact/TdiPxFihGvWzoFgLNqXpwc (private to the Owner until shared). The screenshots are not committed: they are on the board, named `<state>/<view>.png`.

## What was run

- **Where.** Live site (Stripe in test mode, card 4242 4242 4242 4242), with throwaway accounts on Resend's test address `delivered+<tag>@resend.dev`, so no mail bounced. Local: `pnpm build` and `wrangler dev` of the same commit against a local Postgres 16, with the repository's Stripe and GitHub stand-ins (`tests/browser/support/fake-*-server.ts`). Each screen below says which it used.
- **Devices.** Playwright's device profiles at deviceScaleFactor 1: iPhone SE (the 320×568 first generation, the smallest phone in the list), iPhone 15 Pro Max, Pixel 7 and iPad Mini, each in portrait and landscape, plus a computer at 1440×900 and at 1280×720. 10 views per state. Full-page screenshots.
- **Themes.** One. `src/lib/look.css` is dark by choice (`color-scheme: dark`, design 5.8: "one theme, dark by choice"), so there is no light and dark pair to shoot.
- **How a form's answer was shown on every device.** For a state that follows a form (a refusal, "Check your email"), the form was sent once for real to the live site, and the site's own HTML answer was replayed into each device's browser when it pressed the same button. This keeps rate limits and the 10-guess sign-in pause from being spent ten times. Sign-in pause itself was reached for real: 10 wrong passwords, 13 seconds apart, then an 11th.
- **Measured, not guessed.** For every image the script recorded horizontal overflow, every link, button, field and radio smaller than 44×44, and any clipped element. None overflowed; every target is at least 44px tall except the 24px radio dots, which sit inside full-width 48px rows that are the real target. Card position, page height and the cause of the extra scroll were measured in the DOM.
- **Looked at.** Every image, one by one, at 1:1 or in sheets of three or four, plus a keyboard pass on sign-in and the paywall card.
- **Not run.** No tests (CLAUDE.md: tests run on GitHub's runners). No code changed.

## Screens covered

39 states, 390 screenshots, plus one keyboard-focus set.

| # | Screen and state | Source |
|---|---|---|
| 01 | `/` home, signed out | live |
| 02 | `/sign-in` | live |
| 03 | `/sign-in`, email missing | live |
| 04 | `/sign-in`, wrong password | live |
| 05 | `/sign-in`, sign-in paused after 10 wrong passwords | live |
| 06 | `/sign-in?reset=1`, password updated | live |
| 07 | `/sign-up` | live |
| 08 | `/sign-up`, password too short | live |
| 09 | `/sign-up`, birth date not a date | live |
| 11 | `/sign-up`, under 13 | live |
| 12 | `/forgot-password` | live |
| 13 | `/forgot-password`, sent | live |
| 14 | `/reset-password`, expired or used link | live |
| 15 | `/reset-password`, the form (a made-up token) | live |
| 15b | `/reset-password`, the two passwords differ | live |
| 16 | `/join`, signed out | live |
| 17 | `/goodbye` with a day | live |
| 18 | `/goodbye` with no day | live |
| 19 | 404 page | live |
| 19b | `/make/new?github=failed` (where the GitHub callback sends a maker) | live |
| 20 | `/` home, signed in | live |
| 21 | `/me`, email not confirmed, not a member | live |
| 22 | `/me`, after "Send it again" | live |
| 23 | `/join`, signed in | live |
| 24 | `/me/delete`, not paying | live |
| 25 | `/me` with the welcome-back line, after signing in to undo a deletion | live (a real deletion, then a real sign-in) |
| 26 | `/` home, after paying with Stripe | live (a real Stripe test checkout) |
| 26b | `/join/done`, "Finishing up…" | local (an open checkout) |
| 27 | `/me`, member | live |
| 28 | `/join`, already a member | live |
| 29 | `/me/delete`, paying member | live |
| 30 | `/me`, membership ending (cancelled in Stripe's real test portal) | live |
| 30b | `/join`, member whose membership is ending | live |
| 32 | `/join`, membership paused (card failed more than 7 days ago) | local (row set `past_due` 8 days back; the stand-in has no failing card) |
| 33a | `/me`, card failed 2 days ago | local (row set `past_due` 2 days back) |
| 33b | `/me`, membership paused | local (row set `past_due` 8 days back) |
| 34 | `/me/delete`, staff | local (a `support` role added) |
| 35 | `/join/done`, "This is taking longer than usual" | local (the same open checkout, after 30 seconds) |
| 36 | Any page when the database cannot be reached | local (Postgres stopped, then a signed-in person opened `/me`) |
| 40 | Keyboard focus on `/sign-in` and `/join` (computer) | live |

**Not reached, and why.**

- The page the confirm-email link opens, and `/reset-password` with a real token: both need a link from an inbox this session cannot read. The reset form itself was reached with a made-up token (15, 15b), which renders the same page.
- `/join` refusals "You've started a lot of checkouts just now" and "Something went wrong on our side", and `/me`'s "billing page did not open": these need Stripe or the rate limiter to fail on cue; the words were read in the code (`src/routes/join/+page.server.ts`, `src/routes/me/+page.server.ts`).
- Ruken's own "Something went wrong on our side." card (`src/routes/+error.svelte`): not seen. The one server failure that could be caused on cue (the database down, 36) shows SvelteKit's plain page instead; see S13.
- The four emails: they are plain text (`src/features/accounts/mails.ts`), not pages. Their words were read; there is nothing to screenshot.
- `/make/github` and its callback: they only redirect (to GitHub, or to `/make/new`); `/make/new`, the feed, `/g/<game>`, a maker's page and `/admin` are not on main.
- Stripe's own Checkout and billing portal were used and looked at, but they are Stripe's pages, not audited as Ruken's.

## Findings

Ranks: **blocks launch** (a stranger would be stuck, misled or put off at a step the launch depends on), **should fix**, **note**. Each names the screen, the devices and the board's file (`<state>/<view>.png`).

### Blocks launch

**L1. After signing up, signing in or paying, a person lands on a page with nothing to tap.** Screens 20 and 26, all 10 views (`20-home-signed-in/*.png`, `26-home-after-paying/*.png`, byte-identical). Signed in, `/` shows only "Ruken / Games, one swipe at a time. Coming soon." with no link to the account, no Join, no Sign out. Measured: sign-up and sign-in with no `next` both land on `/`; a Stripe test checkout started from `/join` (no `next`) came back to `/` with no word that the payment worked. "Keep playing" on 28 and 30b and "Not now" on 16 and 23 also go to `/`. The way out is the browser's address bar. The feed (slice 3) is planned to replace this page; until it is on main, every first visit ends here. (The slice 1 implementation audit's note 8 left a link to `/me` to slice 3.)

**L2. There is no terms, privacy, refund or contact page anywhere.** Every screen, every view. The sign-up form, the paywall card and `/me` take a date of birth, an email and money with no link to what Ruken does with them, and nowhere to write to. Stripe's checkout page shows Stripe's own Terms and Privacy, not Ruken's. The design does not list these pages, so they are the Owner's call; they are ranked here because a stranger asked to pay with no terms, no privacy page and no contact will often stop.

### Should fix

**S1. Every page scrolls a little when nothing needs to scroll.** All screens. Measured on `/sign-in`: the page is 768px tall in a 720px window on a computer (48px of scroll) and 847px in an 839px Pixel 7 window (8px). Cause: `body { min-height: 100vh }` plus the header's top margin (`0.5rem`, `3rem` from 48rem wide) escaping the body (margin collapse), in `src/lib/look.css`. The same rule eats the card's bottom margin: on `/sign-up` with an error at 1280×720 the card ends 5px from the bottom of the page (`08-sign-up-password-short/desktop-1280x720.png`, `09-…/desktop-1280x720.png`).

**S2. The paywall card has no pip-red mark.** 16, 23, all views. Design 5.8: "On the paywall card, one small pip-red mark makes it read as a playing card" (Owner, 2026-11-14, "Keep it"). `--pip` is defined in `look.css` and used nowhere.

**S3. The paywall card opens with tax and runs to four sentences before the price.** 16, 23, all views. Design 5.2: "the paywall says what it costs and what happens next, in two short lines." The first line under the heading is "Tax is added where it applies.", a qualifier read before any price is shown; then "Renews until you cancel. You can cancel any time from your account."; then the steps. On iPhone SE portrait "Continue" is below the first screen (`16-join-signed-out/se-portrait.png`, `23-join-signed-in/se-portrait.png`).

**S4. "Your payment went through" is said before anything has checked it.** 26b and 35, all views (local). `/join/done` says "Your payment went through. One moment." for any checkout of this person that is still open; it was shown here for a checkout that was never paid. Live Stripe Checkout offers Klarna and Cash App Pay, which can send a person back before money moves. AGENTS.md: the copy never invents a fact.

**S5. Form errors are easy to miss and sometimes sit away from their field.** 03, 04, 05, 08, 09, 15b, all views. The error is the card's ink in bold, with no mark, and no field is marked or focused. On sign-up the password error "Use a password of 10 to 128 characters." sits under the birthday block, three fields away from the password box (`08-sign-up-password-short/se-portrait.png`). After any sign-up refusal the password box is empty (by design) but no line says to type it again, so the next press is refused for the password too (09).

**S6. Sign-in paused still offers "Sign in" as the main button.** 05, all views. "Too many tries. Sign-in is paused for an hour for this email. You can reset your password now." sits over the big dark "Sign in", which cannot work for an hour; the way on is the plain link under it, and the line says "reset" where the link says "Forgot your password?". 04 has the same "reset"/"Forgot" mismatch.

**S7. `/me`'s money line has no tax qualifier.** 27, all views. "You're a member. $9.99 a month. Renews on Monday, December 14." Design 5.8: "Every money line carries its qualifier ("Tax is added where it applies.")".

**S8. "Manage" does not say what it does.** 30, all views. A person whose membership is ending and who wants it back sees "Your membership ends on Monday, December 14. You can play until then." and a button "Manage". Stripe's page behind it has "Renew".

**S9. "Keep playing" and "You're already a member" say more than is true.** 28 and 30b (byte-identical), all views. "Keep playing" goes to `/` where there is nothing to play (L1). A member whose membership is ending is told "You're already a member." with no end date.

**S10. An expired reset link still says "Choose a new password".** 14, all views. The heading promises the one thing the screen cannot do; the line under it says "That link has expired or was already used." This state also has no "Back to sign in", which the other two reset states have.

**S11. Connecting GitHub ends on "We can't find that page."** 19b, all views, byte-identical to 19. `src/routes/make/github/callback/+server.ts` sends both a failure (`/make/new?github=failed`) and a success (`/make/new`) to `/make/new`, which is not on main. No link on main reaches `/make/github`, so a person reaches it only by typing the address; slice 4 builds `/make`.

**S12. "Change card or cancel" wraps inside its button on the smallest phone.** 27, `se-portrait.png`: two centred lines in one button.

**S13. When the database cannot be reached, every page is a bare white "500 | Internal Error".** 36, all views (local). The hook asks better-auth for the session on every request; when that throws ("Failed to get session", in the Worker's log) SvelteKit cannot render `+error.svelte` and falls back to its built-in page, since the app has no `src/error.html`. No Ruken name, no felt, no way back, words a person does not say. A Neon or Hyperdrive outage on the live site would look like this.

### Notes

- **N1. Widows.** "14 / days." on 24 and 29 (iPad portrait and landscape, both computers, the larger phones in landscape); "Sign in with / it." on 06 (`pixel7-portrait.png`); "new / one." on 12 (`se-portrait.png`); "until / then." on 30 (iPad and computers).
- **N2.** `/me` prints the email address alone, with no "Signed in as" (21, 25, 27, 30, 33).
- **N3.** After "Send it again" the "Confirm your email" line is replaced by "Sent. Check your email.", so the page no longer says what was sent (22).
- **N4.** "Check your email" has no "Didn't get it? Check spam, or send it again." (13).
- **N5.** A grown-up who mistypes their birth year and gets "Ruken isn't for you yet." has no way back to the form but the wordmark (11).
- **N6.** Headings mix full stops: "You're already a member.", "Your account will be deleted." beside "Your membership is paused" and "Finishing up…" (design 5.8: labels take no full stop, sentences do). The paused card's body repeats its heading: "…so your membership is paused." (32).
- **N7.** The staff delete screen's only link is "Keep my account", though there was nothing to choose (34).
- **N8.** `/goodbye?on=<any day>` is open to anyone and says "Your account will be deleted." to whoever opens it (17). Harmless; noted.
- **N9.** "Opens our payment page, run by Stripe." reads oddly ("our" and "run by Stripe") (21–33).
- **N10.** On the paying member's delete screen the quiet "Only want to stop paying? Cancel your membership instead." sits closer to the next paragraph than the other paragraphs are to each other, on phones in portrait (29).
- **N11.** The "Your password is updated" line and the welcome-back line are the only good-news lines; the first is plain body text that reads like any other sentence (06). The welcome-back panel is clear (25).
- **N12.** The main button is full width up to about 700px wide and its own width above: full on iPhone SE landscape, not on the larger phones in landscape. Consistent with the rule, noted only because the same phone changes look when turned.
- **N13.** Stripe's Checkout and portal show a generic shop icon and no Ruken logo or colour (Stripe dashboard branding settings, the Owner's).
- **N14.** Checked and clean: no horizontal overflow on any Ruken page (only SvelteKit's fallback in 36 is 1px wider than three phones), and the only text cut off is a long email address scrolling inside its own field (04, 05, 08, 09 on phones in portrait), which is normal; every target at least 44px; keyboard focus visible on every control, in reading order (40); wordmark and card centred on wide windows (measured: 320–960 at 1280, 400–1040 at 1440); the Blue `--pay` button appears only on "Continue to payment" (23); cards 20px, buttons 12px; text on paper is ink, notes ink-soft.

## Counts

2 block launch, 13 should fix, 14 notes.
