# Texts, Not Email Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task (CLAUDE.md: no subagents). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A person joins Ruken, signs in and gets back in with their phone number and a code by text; every notice Ruken sends is a short text from one of two numbers; nobody is texted without a yes or after STOP; and the few legal emails still go out and are recorded.

**Architecture:** One port, `Texter`, beside `Mailer` in `src/lib/server/`, calling Twilio with plain `fetch`. The phone number, the yes to optional texts, STOP and the record of what was sent all live in the `accounts` feature, which every other feature already imports, so there is no new feature folder. Sign-in stays on better-auth 1.7.7, through its own `phoneNumber` plugin (already in the installed package; no new dependency). Texts in from people, STOP and delivery reports arrive at one signed webhook. The email sign-up on `main` is removed, not kept beside this.

**Tech Stack:** as slice 1 (Node 24, pnpm 10.34.6, SvelteKit 3.0.0, Svelte 5.57.1, Prisma 7.10.0, Postgres 16, better-auth 1.7.7, `@js-temporal/polyfill` 0.5.1, Vitest 5.0.3, Playwright 1.63.0, Cloudflare Workers). Twilio is a new outside service the Owner chose ("3. A"). **No new package.**

**Spec:** `docs/superpowers/specs/2026-11-15-texts-not-email-design.md` (approved by the Owner, 2026-11-15: "Text design approved"). Read it with `CLAUDE.md`, slice 1's plan (`2026-11-13-slice-1-accounts-membership.md`: "How a task runs" and "The look" hold here), and the tracker. The country table is `2026-11-15-texts-countries.md`. The help chat's own design is `docs/superpowers/specs/2026-11-15-help-chat-design.md` (written with this plan, not yet approved; nothing here builds it).

**Planned against:** `main` at `286bfdf`. Read in the plan session, 2026-11-15: every file under `src/features/accounts/`, `src/lib/server/mail.ts`, the account routes, the journeys' stand-ins, better-auth 1.7.7's own `dist/plugins/phone-number/` (its routes, options and error codes, from the published package), and Twilio's pages named under "What Twilio's pages say". No test, lint or typecheck ran; no code was written.

**Audited:** `docs/superpowers/audits/2026-11-15-texts-not-email-plan-audit.md` (2026-11-15). Its fixes are written into this plan; a line that an audit finding changed names it, as "(audit 3)".

**When it is built:** not now. Owner, 2026-11-15: "I want us to stick to our original plan only building things directly relevant to slice we're currently on". This plan reworks slice 1 (accounts), so the coordinator opens it when the slice order allows. It needs an Opus plan audit first.

## Global Constraints

- No session runs tests. Every red and green is read from CI on the branch (`verify`, `postgres`, `browser`).
- No new package. Twilio is called with plain `fetch`; phone numbers are handled by the small rules in Task 2, not a library.
- Every text starts with "Ruken:", fits in one text (160 GSM-7 places, or 70 characters when it holds anything outside GSM-7; `fitText`, audit 13), holds one link at most, and passes the drunk-grandma test. The words are in "The words of every text" and are tested letter for letter.
- A log never holds a phone number or a code. A failed send is logged as `TWILIO <status> <Twilio's code>` and nothing else.
- A phone number is never shown to a maker, another player or staff. Only its owner sees it, on `/me`.
- Nobody is texted without a yes or after STOP, and never twice: every notice goes through `tellByText` or `tellByNews` (Tasks 6 and 9), never straight to the `Texter`.
- Time comes from the injected clock. Quiet hours are worked out with Temporal from a time zone name.
- Buttons: the forward action blue; Back, Cancel and "Text it again" green; nothing here is red.
- The form never tells a stranger whether a number has an account: the same screen, the same words and the same timing either way. Texts are sent after the answer (`runAfterAnswer`), as mails are today.
- Tests use `TEXT_ALLOWLIST` or the stand-in. No test, journey or seeded account can text a real phone.
- Secrets are the Owner's, typed into Cloudflare. None is written in the repository or in chat.

## What Twilio's pages say

Read on 2026-11-15. The build session reads each again before Task 1 (Step 0) and stops if one differs.

| What | From which page | What it says |
|---|---|---|
| Sending | `docs/messaging/api/message-resource` | `POST https://api.twilio.com/2010-04-01/Accounts/{AccountSid}/Messages.json`, form-encoded: `To`, `Body`, and `MessagingServiceSid` (or `From`); optional `StatusCallback`. HTTP Basic sign-in with an API key and its secret. The answer's `sid` is the message's id. |
| A delivery report | the same page | Twilio posts `MessageSid`, `MessageStatus` and, for `failed` or `undelivered`, `ErrorCode` to the `StatusCallback` address. |
| A text in | `docs/messaging/guides/webhook-request` | Form-encoded: `MessageSid`, `MessagingServiceSid`, `From`, `To`, `Body` (up to 1600 characters). |
| The signature | `docs/usage/webhooks/webhooks-security` | Header `X-Twilio-Signature`: HMAC-SHA1, keyed with the account's **auth token** (not the API key), over the webhook's full address followed by every form field's name and value, sorted by name, then base64. |
| STOP, START, HELP | `docs/messaging/tutorials/advanced-opt-out` | Custom words for the replies need "Advanced Opt-Out" on a **Messaging Service**. Once on, it covers every number in that service. A STOP puts the number on a block list; later sends fail with error 21610. START and UNSTOP undo it. Twilio's post to the webhook then carries `OptOutType` = `STOP`, `START` or `HELP`, and Twilio has already sent the reply. **US toll-free numbers ignore the custom STOP reply** (the carrier sends its own). |
| A number that changed hands | `docs/lookup/v2-api/reassigned-number` | `GET https://lookups.twilio.com/v2/PhoneNumbers/{number}?Fields=reassigned_number&LastVerifiedDate=YYYYMMDD`. Answers `reassigned_number.is_number_reassigned`: `yes`, `no` or `no_data_available`. **US numbers only.** Needs its own carrier registration and approval. Updated monthly. |
| Each country | `en-us/guidelines/<iso>/sms` | `2026-11-15-texts-countries.md`. |

**What follows from it, and is built that way:**

1. **Two Messaging Services, one number each**, "Ruken account" and "Ruken news", each with Advanced Opt-Out on and the spec's own reply words. STOP to one then blocks only that service. That is how the two-number rule is kept.
2. **Whether STOP also stops codes** (the spec's question): yes. A STOP to the account number blocks everything from that service, codes included. The spec's "After STOP on the account number" already says what the person sees.
3. **Not confirmed from a page:** that a STOP on one Messaging Service leaves the other service's texts flowing on the same Twilio account. The tutorial says later sends "from your account" fail. Task 1's Step 0 proves it with the Owner's two real numbers and one real phone before anything else is built. If STOP on one silences both, stop and report: the two numbers then need two Twilio accounts, which is the Owner's call.
4. **The numbers in the United States must be ordinary local numbers** (registered with the carriers), not toll-free, or the spec's STOP words never show.
5. **The changed-hands check works for US numbers only**, and only once Twilio approves its use. Everywhere else the answer is "cannot say". The rule in Task 5 treats it so.
6. **Twilio does not resend a webhook that answered 500 unless asked to** (`docs/usage/webhooks/webhooks-connection-overrides`: the retry policy `rp` defaults to `ct`, a failed connection only, and the retry count `rc` to 1). So both of Ruken's webhook addresses, the services' incoming address (X3) and `statusCallback`, end `#rc=3&rp=5xx,ct,rt`. Task 1's Step 0 reads whether the signature covers the part after `#`; the stand-in signs the same way. (audit 2)
7. **A new Twilio account texts only its home country** (`docs/messaging/guides/sms-geo-permissions`). Each other country is turned on in Twilio's Geo Permissions when it opens, and Twilio advises leaving off the rest. (audit 10)
8. **A send to someone who opted out is refused at once** with error 21610 ("opted out of receiving messages from your Twilio phone number, Channels sender, or Messaging Service"). Ruken treats that answer as a STOP it had not yet heard of (Task 6). (audit 3)
9. **Replying needs a number of the person's own country** (the country table). With two US numbers, only people in the US and Canada can reply STOP or HELP. Canada shares the US numbering plan; that a Canadian phone can text a US number is expected and not yet proved. (audit 11)

## The Calls in this plan

- **The email column stays, as a stand-in.** better-auth's `User.email` cannot be empty. Every account gets `<random id>@phone.ruken.invalid` there: never shown, never mailed (`.invalid` can never be a real address, RFC 2606, and the mailer refuses it). The real, optional address for legal papers is a new column, `paperEmail`. This is how "the email address becomes optional" is met without changing the library's table.
- **Sign-up keeps the password between its two screens in the database**, hashed, for ten minutes (`PendingSignUp`), keyed by a keyed hash of the number. Nothing readable is kept for a number that never finishes.
- **A code never signs anyone in to an account that exists.** The plugin's `verify` would sign in whoever holds the code. So the public `/api/auth/phone-number/*` routes are refused, and Ruken's own form calls `verify` only when no account has that number. A code alone can therefore never open an account whose number changed hands.
- **Forgot password is two screens:** the number, then one screen with the code, the new password and the password again. The library checks the code and saves the password in one step; splitting them would mean holding a checked code open.
- **"Text it again" after 30 seconds** is shown by a small script; with no script the button is always there and the server refuses a second code inside 30 seconds with "Give it a few seconds, then try again."
- **Codes are stored readable, for ten minutes.** The plugin keeps each code as plain text in `Verification.value` and has no option to hash it, where today's reset token is kept only as its hash. A code lasts ten minutes and allows three tries. Worth the Owner's eye. (audit 7)
- **A number that has an account gets `alreadyText` from inside the plugin's `sendOTP`**, not from a separate path in the form. Both cases then call `/phone-number/send-otp`, so they count against the same limits, write the same row and take the same time. (audit 6)
- **Codes are not `TextSent` rows.** `TextSent` is for notices to an account, and a sign-up code has no account yet. Codes are limited by the limiter.
- **Any text that is not STOP, START or HELP**, to either number, gets the HELP reply until the help chat is built, at most once an hour per number.
- **Where a reply cannot reach Ruken** (179 of 222 countries can never reply; and with only Ruken's two US numbers, no country but the US and Canada can, audit 11), STOP by reply does not exist. The Owner, 2026-11-15, on a card: "Stay closed there until replies work". So a country is open only where a person can text Ruken back, every open country can reply STOP, START and HELP, and no other way to stop is built. This narrows the spec's "every country, from the first day" to "every country where replies work"; the spec's "Every country" carries a dated line saying so.
- **A made-up number can never be texted.** North American numbers of the form `+1 ··· 555 01··` are kept for fiction. The seeded accounts get those, and the `Texter` refuses them whatever the allowlist says.
- **The fourth notification, "About my account"**, is a push notification. It joins the apps' slice N with the other three. Nothing is built for it here; `/me` shows the waiting notices without it.
- **The legal emails' own senders stay in their own plans** (terms changed: the legal pages; the EU and UK email: the sales plan's Task 14; Apple's refund link: the apps' plan). This plan builds what they all use: `paperEmail`, `sendPaper` and its record.

## Questions for the Owner

Asked on a card in the thread, and answered.

1. **In countries where people can't text Ruken back** (most of the world outside the 43 in the table): A. They turn news texts off on their account page, and get help on the site. B. Buy a local number in each country where that makes replies work. C. Stay closed there until replies work. **Owner, 2026-11-15: C, "Stay closed there until replies work".** Ruken opens only where people can text back: on the first day the United States and Canada, and later, one at a time, any of the 43 two-way countries the Owner gets a number in (X7).

## Where execution stops and waits for the Owner

Commands are one line each for the Owner's Mac. A step goes to a website only where no command can do it, and says so. X1 to X4 need the computer, not the iPad.

The `twilio` commands below were written from the plan session's knowledge of Twilio's command-line tool and were not run. Task 0's Step 0 checks each against the tool's own `--help` before the Owner is handed it, and corrects it here.

- **X1. The Twilio account** (a website: a first sign-up, and billing). Then install the tool once: `brew tap twilio/brew && brew install twilio` and sign it in: `twilio login`.
- **X2. Two local US numbers and two Messaging Services.** `twilio api:messaging:v1:services:create --friendly-name "Ruken account"` and the same with `"Ruken news"`; each prints an id starting `MG`. Buy two numbers (`twilio phone-numbers:buy:local --country-code US --sms-enabled`) and add one to each service (`twilio api:messaging:v1:services:phone-numbers:create --service-sid MG… --phone-number-sid PN…`). Turn on Canada in Twilio's SMS Geo Permissions (a website; the US is on already). (audit 10)
- **X3. The reply words** (a website: Twilio's Console has no command for Advanced Opt-Out). For each service turn Advanced Opt-Out on and paste the STOP, START and HELP replies from "The words of every text". Set each service's incoming address to `<site>/webhooks/twilio#rc=3&rp=5xx,ct,rt`, so Twilio sends a post again after a 500 (audit 2).
- **X4. The Worker's settings**, each with `npx -y wrangler@4.156.0 secret put NAME --name ruken`: `TWILIO_ACCOUNT_SID`, `TWILIO_API_KEY`, `TWILIO_API_SECRET` (`twilio api:core:keys:create --friendly-name ruken` prints both), `TWILIO_AUTH_TOKEN`, `TWILIO_ACCOUNT_SERVICE`, `TWILIO_NEWS_SERVICE`, and `TEXT_ALLOWLIST` with the Owner's and the testers' own numbers. The test copy gets its own set (the apps' test-copy plan, amended).
- **X5. After the LLC and its tax number:** registering Ruken's name and both numbers with the US carriers (a website: Twilio's Console walks through it). Launch waits for this (Owner: "Launch waits for the carriers"). The privacy and terms pages must be public first, with the lines in "Notes for the plans that follow", and so must `/help`, which the HELP reply names (audit 20).
- **X6. After X5:** ask Twilio to turn on the changed-hands check (a website). Until then Task 5 treats every number as "cannot say".
- **X7. Each country the Owner wants open on the first day:** it must be one of the 43 where two-way is "Yes" (the Owner's answer to Question 1). Turn it on in Twilio's SMS Geo Permissions (a website), buy two numbers of that country that can take replies and add one to each Messaging Service, and register where the table says so. Some of these cost money. (audits 10, 12)
- **X8. Once branch B is on the real site:** the Owner signs up again with their phone, then the first-owner command with their number in place of the email. The accounts made by email cannot be signed in to any more; no real person has one.

## How a task runs

As slice 1's plan: write the failing test, push, read the red in CI and check it failed for the right reason; write the code, push, read the green; update the tracker with the task and the progress; one line to the coordinator with the commit, the test count and anything surprising. A stop rule, a third failed fix or a step that needs the Owner: stop that task and report.

## Branches

Each is small enough to review in one sitting, merges before the next starts, and leaves `main` green.

| Branch | Tasks | Needs | What |
|---|---|---|---|
| A `texts/port` | 0, 1, 2 | X1, X2 for Step 0 only | the `Texter`, the stand-in, the number rules |
| B `texts/sign-in` | 3, 4, 5 | A | the tables; sign-up, sign-in, forgot password; email sign-up removed |
| C `texts/notices` | 6, 7, 8 | B | one text a notice, once; texts in, STOP and START; what a person sees while texts are off; changing the number |
| D `texts/yes` | 9, 10 | C | the yes to news texts, quiet hours, the legal email |
| E `texts/countries` | 11 | B | which countries are open, and their words |

## File map

```
src/lib/server/
  text.ts                 Texter, TextMessage, createTwilioTexter, TextError, textFailureCode        (A)
  twilio-signature.ts     twilioSignatureOf, isFromTwilio                                             (A)
  mail.ts                 refuses an `.invalid` address                                               (D)
src/features/accounts/
  phone.ts                toE164, hashNumber, isMadeUpNumber                                          (A)
  text-words.ts           every text's words, and fitText                                             (A, C)
  pending-sign-up.ts      keepPending, takePending                                                    (B)
  auth.ts                 the phoneNumber plugin; email sign-up, its mails and its routes go          (B)
  auth-limits-plugin.ts   limits per number                                                           (B)
  sign-in-guard(s).ts, sign-in-pause-plugin.ts   keyed by number; the notice is a text               (B)
  forms.ts                startSignUp, finishSignUp, signInWithPassword, requestReset, finishReset    (B)
  changed-hands.ts        resetChannel                                                                (B)
  notices.ts              tellByText, waitingNoticesOf, markNoticesRead                               (C)
  text-stop.ts            recordStop, textStateOf                                                     (C)
  inbound.ts              receiveText                                                                 (C)
  change-number.ts        startNumberChange, finishNumberChange                                       (C)
  text-yes.ts             sayYes, sayNo, yesOf, tellByNews, inQuietHours                              (D)
  paper.ts                setPaperEmail, sendPaper                                                    (D)
  countries.ts, library/countries.json   openCountries, countryOf                                    (E)
  mails.ts                deleted                                                                     (B)
  deletion.ts, staff.ts, services.ts, accounts.ts   amended                                          (B, C, D)
src/routes/
  sign-up/, sign-in/, forgot-password/, me/        rewritten                                          (B, C, D)
  reset-password/                                  deleted                                            (B)
  webhooks/twilio/+server.ts                       new                                                (C)
  +layout.server.ts, +layout.svelte                the "texts are off" line                           (C)
  jobs/first-owner/+server.ts                      takes a number                                     (B)
prisma/schema/accounts.prisma, prisma/migrations/<timestamp>_texts_*/                                 (B, C, D)
tests/support/capture-texter.ts, create-user.ts
tests/browser/support/fake-twilio-server.ts, texts.ts, account.ts, database.ts
tests/…                                           mirrors src/
```

## The words of every text

In `text-words.ts`, each a pure function answering a string, each tested whole. `<site>` is `BETTER_AUTH_URL`.

| Function | Words |
|---|---|
| `codeText(code)` | `Ruken: your code is 123456. It works for 10 minutes. Don't share it with anyone.` |
| `alreadyText(site)` | `Ruken: you already have a Ruken account. Sign in, or reset your password: <site>/sign-in` |
| `resetCodeText(code)` | `Ruken: your code to choose a new password is 123456. It works for 10 minutes. Didn't ask? Ignore this text.` |
| `passwordChangedText(site)` | `Ruken: your password was changed and we signed you out everywhere. Not you? Choose a new one: <site>/forgot-password` |
| `signInPausedText(site)` | `Ruken: too many wrong passwords, so sign-in is paused for an hour. Not you? Choose a new password: <site>/forgot-password` |
| `numberChangedText()` | `Ruken: the phone number on your Ruken account was changed. Not you? Reply HELP to this text.` |
| `helpText(site)` | `Ruken: help is at <site>/help. We text about your account. Msg and data rates may apply. Reply STOP to stop.` |

Pasted into Twilio by the Owner (X3), and pinned in `text-words.ts` as constants so a test keeps them under 160 and the same as the spec:

| Line | STOP | START | HELP |
|---|---|---|---|
| account | `Ruken: no more texts from us, so you won't hear about your account or password here. Reply START to turn them back on.` | `Ruken: your texts are back on.` | `helpText` |
| news | `Ruken: no more news texts. You'll still get texts about your account. Reply START to get news again.` | `Ruken: news texts are back on. Reply STOP to stop.` | `helpText` |

`fitText(before: string, name: string, after: string): string` builds a text that holds a typed name (a game, an extra): when the whole does not fit in one text the name is cut and ends in `...`; the link in `after` is never cut. One text is 160 GSM-7 places (`€ [ ] { } | ^ ~ \` take two each), or 70 characters when anything in it is outside GSM-7, which then sends the whole text in a wider encoding. A longer text is sent as two or three paid parts, so the limit is the encoding's, not a count of letters. (audit 13) The other plans' texts (a game, a split, an extra, the wishlist) are worded in those plans' amended tasks and built with it.

## Review Focus

1. A number typed many ways (`312 555 0142`, `(312) 555-0142`, `+1 312 555 0142`, `0312…` in a country that writes a leading 0, with the country chosen wrongly left on +1): one account, found again at sign-in whichever way it is typed (Task 2, Task 4).
2. A code asked for, and typed, for a number that already has an account: the stranger sees the same screens, and the code never signs them in (Task 4).
3. A person who texted STOP to the account number then asks for a code: no text is tried, and the screen says how to turn texts back on (Task 7).
4. The same notice asked for twice at once, or again after a retry: one text (Task 6).
5. A post to the webhook with a wrong signature, with a right signature sent twice, or with a `From` no account has: nothing wrong is stored, nothing is stored twice, and nothing throws (Task 7).
6. Twilio answers 500 or times out during sign-up: the person still sees the code screen, "Text it again" works, and the log holds a code and no number (Tasks 1, 4).
7. A person whose yes was said at 19:59 their time and whose text is due at 03:00: it waits for 9:00 their time, in their zone and across a clock change (Task 9).

---

# Branch A: `texts/port`

### Task 0: Read first, and prove the two numbers

- [x] **Step 0:** read again the Twilio pages in "What Twilio's pages say" and better-auth 1.7.7's `dist/plugins/phone-number/routes.mjs` in `node_modules`. Also read: whether Twilio's signature covers the part of the address after `#` (point 6), and Twilio's page on SMS pumping protection, reporting whether it applies to a Messaging Service (audit 10). Any difference from this plan: stop and report.
- [ ] **Step 1 (with the Owner, after X1 to X3; needs one real phone):** from the Owner's phone text STOP to the news number. Then send one text from each service to that phone with `twilio api:core:messages:create --messaging-service-sid MG… --to +1… --body "Ruken: test"`. Expected: the account one arrives; the news one fails with 21610. Then START, and both arrive. Record the four message ids and their statuses in the tracker. If the account text is also blocked, stop and report (point 3 under "What follows from it"). Without a Canadian phone, record that a reply from Canada is still unproven (point 9).

This step needs the Owner and a real phone, so it may finish after Tasks 1 and 2 are green; branch B does not start before it.

### Task 1: The `Texter`

**Files:**
- Create: `src/lib/server/text.ts`, `src/lib/server/twilio-signature.ts`, `tests/support/capture-texter.ts`, `tests/browser/support/fake-twilio-server.ts`, `tests/browser/support/texts.ts`
- Modify: `playwright.config.ts` (the stand-in on port 12114, and the settings below, all plainly fake)
- Test: `tests/lib/server/text.test.ts`, `tests/lib/server/twilio-signature.test.ts`

**Interfaces (produces):**

```ts
export type TextLine = "account" | "news";
export interface TextMessage { to: string; line: TextLine; body: string }
export type TextResult = { sent: true; providerId: string } | { sent: false; why: "allowlist" | "made_up" };
export interface Texter {
  send(message: TextMessage): Promise<TextResult>;
  /** Whether the number changed hands since that day, where Twilio can say. */
  changedHands(number: string, since: Date): Promise<"yes" | "no" | "cannot_say">;
}
export interface TwilioTexterOptions {
  accountSid: string; apiKey: string; apiSecret: string;
  services: Record<TextLine, string>;           // the two MG… ids
  statusCallback: string;                        // <site>/webhooks/twilio
  allowlist: string | undefined;                 // TEXT_ALLOWLIST: comma-separated numbers
  apiBase?: string; lookupBase?: string;         // stand-ins only
  fetch?: typeof fetch;
}
export function createTwilioTexter(options: TwilioTexterOptions): Texter;
export class TextError extends Error { readonly code = "TWILIO"; readonly responseCode: number; readonly twilioCode: number | null }
export function textFailureCode(error: unknown): string;   // "TWILIO 400 21610", never the message
```

- `send`: a made-up number (`isMadeUpNumber`, Task 2) answers `made_up` before anything else; with an allowlist set, a number not on it answers `allowlist`; else the POST from "What Twilio's pages say" with `To`, `Body`, `MessagingServiceSid` and `StatusCallback`, `Authorization: Basic base64(apiKey:apiSecret)`. A non-2xx answer throws `TextError` with the status and the `code` from Twilio's JSON body (null when there is none). `fetch` is kept in a constant and called as a plain function, as `mail.ts` does.
- `changedHands`: a number that does not start `+1`: `cannot_say`, with no request. Else the GET above with `LastVerifiedDate` as the UTC day of `since`; `yes` and `no` pass through; `no_data_available`, a missing field, a non-2xx answer or a thrown `fetch`: `cannot_say`. It never throws.
- `twilio-signature.ts`: `twilioSignatureOf(authToken: string, url: string, fields: ReadonlyMap<string, string>): string` and `isFromTwilio(authToken, url, fields, header: string | null): boolean`, compared with `timingSafeEqual`; a null or wrong-length header is false.
- `createCaptureTexter(): Texter & { sent: TextMessage[]; hands: Map<string, "yes" | "no" | "cannot_say"> }`: keeps what it was given, answers `{ sent: true, providerId: "SM-test-<n>" }`, and answers `changedHands` from `hands` (default `cannot_say`).
- The stand-in (`fake-twilio-server.ts`, modelled on `fake-mail-server.ts`): `POST /2010-04-01/Accounts/:sid/Messages.json` keeps the text and answers `{ sid }`; `GET /texts?to=` lists them; `GET /v2/PhoneNumbers/:number` answers from `POST /test/hands`; `POST /test/inbound` posts a signed text or report to the site's webhook, as Twilio would; `GET /ready`. `texts.ts`: `textTo(number, starts: string)` (waits with `expect.poll`, never a pause), `countTextsTo`, `codeIn(text)`, `textIn(from, body, extra?)`.
- `services.ts` reads `TWILIO_ACCOUNT_SID`, `TWILIO_API_KEY`, `TWILIO_API_SECRET`, `TWILIO_AUTH_TOKEN`, `TWILIO_ACCOUNT_SERVICE`, `TWILIO_NEWS_SERVICE` (all required), `TEXT_ALLOWLIST` (optional) and `TWILIO_API_BASE` (optional; refused unless it starts `http://127.0.0.1:`, through the existing `standInAddress`; when set it is both `apiBase` and `lookupBase`, since the stand-in serves both, audit 18), and `AuthServices` gains `texter`.

- [x] **Step 1 (red):** `text.test.ts`, with a stubbed `fetch`:

```ts
it("posts the text to Twilio's Messages address with the line's service", async () => {
  const result = await texter.send({ to: "+13125550142", line: "news", body: "Ruken: hi" });
  expect(calls[0].url).toBe("https://api.twilio.com/2010-04-01/Accounts/AC1/Messages.json");
  expect(Object.fromEntries(new URLSearchParams(calls[0].body))).toEqual({
    To: "+13125550142", Body: "Ruken: hi", MessagingServiceSid: "MG-news", StatusCallback: "https://ruken.test/webhooks/twilio" });
  expect(calls[0].headers.authorization).toBe(`Basic ${btoa("SK1:secret")}`);
  expect(result).toEqual({ sent: true, providerId: "SM123" });
});
it("texts only the allowlist when one is set", async () => { /* off the list: { sent: false, why: "allowlist" }, no call */ });
it("never texts a made-up number, allowlist or not", async () => { /* +12125550123: why "made_up", no call */ });
it("throws a TextError with the status and Twilio's code", async () => { /* 400 {"code":21610}: textFailureCode → "TWILIO 400 21610" */ });
it("logs nothing of the number or the body", () => { /* textFailureCode(new Error("to +13125550142 failed")) === "unknown error" */ });
it("asks whether a US number changed hands, with the day", async () => { /* URL ends ?Fields=reassigned_number&LastVerifiedDate=20261101 */ });
it("cannot say for a number outside +1, with no request", async () => {});
it("cannot say when Twilio has no data, answers 500, or the request throws", async () => {});
```

  `twilio-signature.test.ts`: the worked example on Twilio's page (its address, fields, token and expected signature, copied from the page in Step 0); fields given in another order sign the same; one changed value, a missing header and a header of another length are refused. Stubs. Push. Expected: `verify` fails in both files with "not built yet".
- [x] **Step 2 (green):** the code, the stand-in and the config. Push. Expected: all pass; the journeys still pass with the new stand-in started and unused.

  *Built 2026-11-16 (branch A):* `services.ts` does not read the Twilio settings or hold `texter` yet. That wiring, with its six required settings and the `TWILIO_API_BASE` guard, moves to Task 4, where the `Texter` gets its first user: the site builds its services on every request, so requiring secrets earlier would stop any deploy of `main` before X4. `isMadeUpNumber` lives in `src/lib/server/text.ts` (`lib` imports no feature) and `phone.ts` re-exports it. The plan's sample number `+13125550142` is itself a made-up number (`555 01xx`), so tests use `+1312555 1234` style numbers. Step 0 found the fragment `#rc=3&rp=…` is not signed (the stand-in and `isFromTwilio` cut it), and that Twilio says a send to an opted-out number fails "asynchronously" (a delivery report with `ErrorCode` 21610), not at once as point 8 says: Task 6 must handle 21610 from the delivery report as well.

### Task 2: A phone number, written one way

**Files:**
- Create: `src/features/accounts/phone.ts`, `src/features/accounts/text-words.ts`
- Test: `tests/features/accounts/phone.test.ts`, `text-words.test.ts`

**Interfaces (produces):**
- `toE164(dialingCode: string, typed: string): string | null`. Spaces, dashes, dots and brackets are dropped. Typed text starting `+`, `00` or `011`: what follows is the whole number. Otherwise leading zeros are dropped, under `+1` one leading `1` is dropped, and the dialing code's digits go in front. (audit 14) The answer is `+` and 8 to 15 digits, or null.
- `hashNumber(number: string, secret: string): string`: HMAC-SHA-256 of `phone:<E.164>` under `BETTER_AUTH_SECRET`, in hex. Used wherever a number that may have no account is kept (limits, the pause, a pending sign-up, STOP).
- `isMadeUpNumber(number: string): boolean`: true for `/^\+1\d{3}55501\d\d$/`.
- `text-words.ts`: the functions, constants and `fitText` of "The words of every text" that branches A and B use (`codeText`, `alreadyText`, `resetCodeText`, `passwordChangedText`, `signInPausedText`).

- [x] **Step 1 (red):**

```ts
it.each([
  ["+1", "312 555 0142", "+13125550142"], ["+1", "(312) 555-0142", "+13125550142"],
  ["+1", "+1 312 555 0142", "+13125550142"], ["+44", "07700 900123", "+447700900123"],
  ["+1", "+44 7700 900123", "+447700900123"], ["+49", "0151 23456789", "+4915123456789"],
  ["+1", "1 312 555 0142", "+13125550142"], ["+1", "1-312-555-0142", "+13125550142"],
  ["+1", "0044 7700 900123", "+447700900123"], ["+1", "011 44 7700 900123", "+447700900123"],   // audit 14
])("writes %s %s as %s", (code, typed, want) => expect(toE164(code, typed)).toBe(want));     // Review Focus 1
it.each([["+1", ""], ["+1", "12345"], ["+1", "abc"], ["+1", "1234567890123456"]])("refuses %s %s", (c, t) => expect(toE164(c, t)).toBeNull());
it("hashes the same number the same way and shows none of it", () => {});
it("knows a made-up number", () => { expect(isMadeUpNumber("+12125550123")).toBe(true); expect(isMadeUpNumber("+12125551234")).toBe(false); });
```

  `text-words.test.ts`: each function's whole text; every one starts `Ruken:`, is plain GSM-7 (straight apostrophes only), takes at most 160 GSM-7 places with a six-digit code and with `https://ruken.io` as the site, and holds at most one `http`; `fitText("Ruken: ", "W".repeat(200), " is out. Play it now: https://ruken.io/g/x")` is exactly 160 long, ends with the whole link and holds `...`; the same with a name holding one emoji is at most 70 long; a name holding `€` counts it as two places. Every case also runs with the longest site address in use (a `workers.dev` one). (audit 13) Push. Expected: `verify` fails in both.
- [x] **Step 2 (green):** the code. Push. Expected: all pass. Branch A is ready to merge.

---

# Branch B: `texts/sign-in`

### Task 3: The tables

**Files:**
- Modify: `prisma/schema/accounts.prisma`; create `prisma/migrations/<timestamp>_texts_sign_in/migration.sql`
- Test: `tests/features/accounts/schema.pg.test.ts` (new), `tests/lib/server/migrations.pg.test.ts` (as it requires)

| Table | Change |
|---|---|
| `User` | `phoneNumber String? @unique`; `phoneNumberVerified Boolean @default(false)` (both named as the plugin reads them); `phoneConfirmedAt DateTime? @db.Timestamptz`; `paperEmail String?`. `email` and `emailVerified` stay (the stand-in; see the Calls). SQL: `CHECK "User_phoneNumber_check"` (`^\+[0-9]{8,15}$`). |
| `PendingSignUp` | `numberHash String @id`, `passwordHash String`, `adultOn DateTime @db.Date`, `expiresAt`, `createdAt`. A newer try for the same number replaces the row. |
| `SignInGuard` | the column `emailHash` is renamed `numberHash` (and its check). The rows are thrown away by the migration: they are pauses of at most an hour. |
| `TextSent` | `id`, `userId` (a `User`, `onDelete: Restrict`), `kind String`, `key String`, `line String`, `providerId String?`, `sentAt`, `createdAt`; `@@unique([userId, kind, key])`. Added and never changed (`reject_append_only_change('TextSent')`). It holds an id and no number, so it stays when the account is deleted, as `WishlistMail` was to. |

The migration is made with `prisma migrate diff` from `main`'s schema, as earlier ones were, then the checks and the trigger by hand at its end.

- [ ] **Step 1 (red):** a second `User` with the same `phoneNumber` rejects; `phoneNumber` `"3125550142"` rejects; two users with no number are fine; a second `TextSent` with the same person, kind and key rejects; `UPDATE` and `DELETE` on `TextSent` reject; `SignInGuard` has `numberHash` and no `emailHash`. Push. Expected: `postgres` fails.
- [ ] **Step 2 (green):** the schema and migration. Push. Expected: all pass.

### Task 4: Joining and signing in with a phone number

**Files:**
- Create: `src/features/accounts/pending-sign-up.ts`
- Modify: `auth.ts`, `auth-limits-plugin.ts`, `sign-in-guard.ts`, `sign-in-guards.ts`, `sign-in-pause-plugin.ts`, `forms.ts`, `services.ts`, `accounts.ts`, `staff.ts`, `deletion.ts`; `src/routes/sign-up/+page.server.ts`, `+page.svelte`, `src/routes/sign-in/+page.svelte`, `src/routes/me/+page.server.ts`, `+page.svelte`, `src/routes/jobs/first-owner/+server.ts`; `src/features/membership/service.ts`, `stripe-port.ts`, `checkout.ts` (`createCustomer` takes no email: Stripe asks for it at paying)
- Delete: `src/features/accounts/mails.ts`, `tests/features/accounts/mails.test.ts`, `tests/browser/mailed-links.test.ts`
- Test: `tests/features/accounts/auth.pg.test.ts`, `forms.test.ts`, `auth-limits-plugin.test.ts`, `sign-in-guards.pg.test.ts`, `sign-in-pause-plugin.test.ts`, `pending-sign-up.pg.test.ts`, `staff.pg.test.ts`, `purge.pg.test.ts`; `tests/browser/sign-up.test.ts`, `sign-in.test.ts`, `auth-route.test.ts`, `first-owner.test.ts`, `me.test.ts`; `tests/browser/support/account.ts`, `database.ts`; `tests/support/create-user.ts`

**`auth.ts`:**
- `AuthOptions` gains `texter: Texter`; `mailer` goes (nothing here mails).
- Plugin: `phoneNumber({ otpLength: 6, expiresIn: 600, allowedAttempts: 3, phoneNumberValidator: (n) => /^\+[0-9]{8,15}$/.test(n), sendOTP, sendPasswordResetOTP, signUpOnVerification: { getTempEmail: () => `${randomUUID()}@phone.ruken.invalid`, getTempName: () => "Player" } })` from `better-auth/plugins`. `sendOTP` and `sendPasswordResetOTP` hand the send to `textLater` (the present `mailLater`, renamed, logging `textFailureCode`) and return at once. Inside `textLater`, `sendOTP` looks the number up: when an account has it, the text is `alreadyText` in place of the code (audit 6). A `TextError` with Twilio's code 21610 records a stop for the number on the account line (`recordStop`, Task 7; until then only logged), so the next screen shows the START words (audit 3).
- `emailAndPassword` keeps `enabled`, the two lengths, `revokeSessionsOnPasswordReset` and `onPasswordReset` (the plugin's reset calls both); `onPasswordReset` lifts the pause for `user.phoneNumber` and texts `passwordChangedText`. `sendResetPassword`, the whole `emailVerification` block and the `verification.storeIdentifier` override for `reset-password:` go: nothing uses them any more (audit 7).
- The `before` hook: a request that came through the public route (`PUBLIC_ROUTE_HEADER`) is answered `NOT_FOUND` unless its path is in `PUBLIC_AUTH_PATHS = ["/ok", "/get-session", "/sign-out"]`. Every form calls better-auth on the server without that header, so nothing else needs to be public, and the email routes and the plugin's `verify` cannot be reached from outside. A comment says why: `verify` signs in whoever holds a code.
- `rateLimit.customRules`: `/sign-in/phone-number` 30 a minute; `/phone-number/send-otp` 5 an hour (a client's sign-up starts, as `/sign-up/email` was); `/phone-number/request-password-reset` 10 an hour; `/phone-number/verify` and `/phone-number/reset-password` 10 per 15 minutes. The email rules go.

**The limits per number** (`auth-limits-plugin.ts`; the body's `phoneNumber` in place of `email`, keyed with `hashNumber`): `/sign-in/phone-number` 5 a minute per client and number; `/phone-number/send-otp` and `/phone-number/request-password-reset` each: 1 per 30 seconds per number (the answer's code is `CODE_TOO_SOON`), 3 per 15 minutes per client and number, 10 an hour per number. **Ten wrong codes pause codes for a number for an hour:** `WRONG_CODES = { max: 10, windowMs: 3_600_000 }`, key `api:auth:wrong-code:<hash>`; an `after` hook on `/phone-number/verify` and `/phone-number/reset-password` counts an `INVALID_OTP` or `TOO_MANY_ATTEMPTS` answer, and the `before` hooks on those two and on the two send paths refuse with code `CODES_PAUSED` once it is over.

**The pause** (`sign-in-guard.ts`, `sign-in-guards.ts`, `sign-in-pause-plugin.ts`): unchanged in what it does; `hashSignInEmail` becomes `hashNumber`, the path `/sign-in/phone-number`, the body key `phoneNumber`; the notice is `signInPausedText` on the account line to the account with that number. `SIGN_IN_PAUSED_MESSAGE`: "Too many tries. Sign-in is paused for an hour for this number. You can reset your password now."

**`pending-sign-up.ts`:** `keepPending(deps: { db; clock; secret }, input: { number: string; passwordHash: string; adultOn: Date }): Promise<void>` (upsert, `expiresAt` ten minutes on) and `takePending(deps, number): Promise<{ passwordHash: string; adultOn: Date } | null>` (null when missing or expired; an expired row is deleted).

**`forms.ts`** (each still calls better-auth through `callAuth`):
- `FormFields` gains `country`, `phone`, `number`, `code`; `email` and `token` go. `AuthFormData` gains `phone`, `country`, `step?: "code"`, `number?`, `closedCountry?`.
- `startSignUp(event, deps: SignUpDeps)`, in this order: the country is open (Task 11; until then only `US` and `CA`), else `fail(400, { closedCountry: true })` and nothing is stored; `toE164` null: `phoneInvalid`; the password's length; the age, as today (`tooYoung` as today). Then `keepPending` with the password hashed by better-auth's own hasher (`(await auth.$context).password.hash`) and the 18th birthday that `ageCheck` already answers (`adultOn`). Then `callAuth("/phone-number/send-otp", { phoneNumber })` whether or not an account has the number: `sendOTP` sends `alreadyText` to one that has (above), so both count against the same limits and take the same time. Either way the answer is `{ step: "code", number, next }`. (audit 6) A 429 with `CODE_TOO_SOON` reads `codeTooSoon`; with `CODES_PAUSED`, `codesPaused`.
- `finishSignUp(event, deps)`: an account already has the number, or `takePending` is null: `fail(400, { step: "code", number, error: FORM_MESSAGES.codeWrong })`, without calling `verify`. Else `callAuth("/phone-number/verify", { phoneNumber, code })`; a 400 or 403: `codeWrong`. On success, in one transaction: a credential `Account` row (`providerId: "credential"`, `accountId: user.id`, the kept hash), `adultOn` written as `setBirthDate` writes it today (only where it is still null), `phoneConfirmedAt` at the clock's time, and the pending row deleted; then `redirect(303, safeNextPath(next))`. If the transaction fails, one more transaction removes the half-made account (its `User` row and the `Session` that `verify` made), the session cookie is cleared, the pending row is kept, and the screen reads "Something went wrong. Try again." with "Text it again". Left as it was, the account would have no password and no `adultOn`, so an adult would get every under-18 default, and a second try would meet "an account has this number". A comment says so. (audit 15)
- `resendCode(event, deps)`: `send-otp` again for the number in the form, with the same answers.
- `signInWithPassword`: `toE164` then `callAuth("/sign-in/phone-number", { phoneNumber, password })`; a number that cannot be read is answered as a wrong password.
- `resendVerification` and `resetPassword` go.
- `FORM_MESSAGES` changes: `wrongPassword` "That number and password don't match. Try again, or reset your password."; `phoneInvalid` "That doesn't look like a phone number. Check it and try again."; `codeWrong` "That code isn't right. Check the text, or ask for a new one."; `codeTooSoon` "Give it a few seconds, then try again."; `codesPaused` "Too many wrong codes. Codes are paused for an hour for this number."; `closedCountry` "Ruken isn't in your country yet."; `emailMissing` and `accountExists` go.

**The screens.** `/sign-up`, first state: the spec's drawing, with "Country" as a `<select>` of the open countries (name and code) and "Phone number" as `type="tel"`, `autocomplete="tel-national"`; the note under the fields is the spec's five lines; the button "Text me a code". Second state, the same address: "We texted you a code", one field "The code we texted you" (`inputmode="numeric"`, `autocomplete="one-time-code"`), "Join Ruken" (blue), "Text it again" (green, shown after 30 seconds by a script and always without one) and "Change the number" (green, back to the first state with the fields kept). `/sign-in`: "Country" (the same `<select>` as sign-up, starting on the browser's region), "Phone number" and "Password". (audit 14) `/me` shows the number in place of the email, and the "Confirm your email" block goes.

**Elsewhere:** `grantFirstOwner(db, phoneNumber)` and the job's body `{ "phone": "+1…" }` with "No account has that number. Sign up on the site first."; `purgeDueAccounts` also sets `phoneNumber` and `paperEmail` to null and `phoneNumberVerified` false, deletes the `PendingSignUp` and `Verification` rows for the number (`identifier` the number, and the number followed by `-request-password-reset`); `createUser` (tests) gives each person a made-up number; the journeys' `signUp(page, number = freshNumber())` reads the code from the stand-in (`codeIn(await textTo(number, "Ruken: your code is"))`), `freshNumber()` answers `+1` and a random area code, `555` and four random digits outside `01··`, and every helper that took an email (`signInAs`, `userIdOf` and the rest of `database.ts`) takes the number.

- [ ] **Step 1 (red):** the journeys, with the unit and Postgres cases for each rule above:

```ts
test("a person joins with their phone and a code", async ({ page }) => {
  const number = freshNumber();
  await page.goto("/sign-up?next=/me");
  await page.getByLabel("Phone number").fill(nationalOf(number));
  await page.getByLabel("Password").fill(JOURNEY_PASSWORD); await fillBirthDate(page, yearsAgo(30));
  await page.getByRole("button", { name: "Text me a code" }).click();
  await page.getByLabel("The code we texted you").fill(codeIn(await textTo(number, "Ruken: your code is")));
  await page.getByRole("button", { name: "Join Ruken" }).click();
  await expect(page).toHaveURL("/me");
  await expect(page.getByText(shownAs(number))).toBeVisible();
});
test("a number that already has an account gets the same screen and one text", async ({ page, browser }) => {      // Review Focus 2
  /* someone else signs up with this number: the code screen shows; the text is alreadyText; no code text;
     any six digits, and the real account's later reset code, read "That code isn't right"; nobody is signed in */ });
test("a wrong code can be tried again, and ten wrong codes pause codes", async ({ page }) => {});
test("the code screen works with no script", async ({ browser }) => { /* javaScriptEnabled: false */ });
test("under 13 is refused before any text", async ({ page }) => { /* countTextsTo(number) is 0 */ });
test("signing in works however the number is typed", async ({ page }) => {});                                       // Review Focus 1
test("sign-up answers the same for a number with an account, even at the limit", async ({ page }) => {});           // audit 6: the sixth try in an hour reads the same either way
test("a sign-up whose last step fails leaves no account, and can be tried again", async ({ page }) => {});              // audit 15
test("an account cannot be made, or opened with a code, around the forms", async ({ request }) => {
  for (const path of ["/sign-up/email", "/sign-in/email", "/phone-number/send-otp", "/phone-number/verify",
                      "/request-password-reset", "/send-verification-email"])
    expect((await request.post(`/api/auth${path}`, { data: {} })).status()).toBe(404);
});
test("Twilio failing does not break the code screen", async ({ page }) => {});                                       // Review Focus 6
```

  Push. Expected: `browser` fails at "Phone number"; `postgres` and `verify` fail in the new cases.
- [ ] **Step 2 (green):** the code, with every old journey moved to the new helpers. Push. Expected: all pass, on all nine projects.
- [ ] **Step 3:** `showTheOwner` for the two states of `/sign-up`, `/sign-in` and `/me`, every view, before and after. The Owner's "fine" before the branch is marked ready.

### Task 5: Forgot password, and a number that changed hands

**Files:**
- Create: `src/features/accounts/changed-hands.ts`
- Modify: `auth.ts` (`sendPasswordResetOTP`), `forms.ts` (`requestReset`, `finishReset`), `src/routes/forgot-password/+page.server.ts`, `+page.svelte`
- Delete: `src/routes/reset-password/`
- Test: `tests/features/accounts/changed-hands.pg.test.ts`, `forms.test.ts` (add cases), `tests/browser/forgot-password.test.ts`

**The rule** (the spec left it to the plan; "What follows from it", 5):

`resetChannel(deps: { db; texter; hasMoney(userId: string): Promise<boolean> }, user: { id: string; phoneNumber: string; paperEmail: string | null }): Promise<"text" | "email" | "help">`

1. `since` is the newest of the account's `Session.createdAt` and its `phoneConfirmedAt`.
2. `texter.changedHands(number, since)`: `no` answers `text`.
3. `cannot_say` and `hasMoney` false: `text`. (An account that never paid and was never paid has nothing to take but itself, and locking every such person out would be worse.)
4. Otherwise (`yes`, or `cannot_say` with money): `email` when there is a `paperEmail`, else `help`.

`hasMoney` is handed in from above, because `accounts` sits below the features that know and better-auth's `sendPasswordResetOTP` is built once, in `createAuthServices`. `accounts.ts` exports `setMoneyCheck(check: (userId: string) => Promise<boolean>)`; `src/hooks.server.ts` calls it at start, as it calls `setFileStore`, with `(id) => membershipServices().service.hasBillingCustomer(id)` joined with `moneyServices().hasBeenPaid(id)` (two one-line reads added to those features, with a test each; `hasBeenPaid` is true when a `JournalLine` names the person). Until it is set the check answers true, so a reset never goes by text on a guess. (audit 5)

`sendPasswordResetOTP({ phoneNumber, code })`, after the answer: find the account; `resetChannel`; `text`: `resetCodeText(code)` on the account line. `email`: the same code by `sendPaper` (Task 10; until branch D is merged this arm logs `reset held: no channel` and sends nothing) with the subject "Your Ruken code" and the text "Your code to choose a new password is `<code>`. It works for 10 minutes." `help`: nothing is sent and one line is logged, `reset held for help`, with no number.

**The screens.** `/forgot-password`, first: "Phone number" and "Text me a code". Second, the same address, whatever the number: "If that number has a Ruken account, we sent a code. It may come by text, or to the email you pay with." then "The code we sent you", "New password", "Type it again", "Save my new password" (blue), "Text it again" (green) and, underneath, "No code? Get help" to `/help`. `finishReset` checks the length and the two passwords first, then `callAuth("/phone-number/reset-password", { phoneNumber, otp, newPassword })`; success redirects to `/sign-in?reset=1`; a 400 or 403 reads `codeWrong` and keeps the number.

- [ ] **Step 1 (red):** `resetChannel`'s seven cases (no; cannot say without and with money; yes with and without a paper email; a number outside +1; `since` taken from the newer of the two dates). The journeys: a reset by code signs every device out, the old password stops working, and the person gets `passwordChangedText`; a number with no account sees the same second screen and gets no text; the stand-in says the number changed hands: no code text is sent, and the second screen is the same; a paused sign-in can still reset. Push. Expected: `postgres` and `browser` fail.
- [ ] **Step 2 (green):** the code. Push. Expected: all pass. Branch B is ready to merge after the Owner's "fine" on Task 4's screens. Tell the coordinator about X8.

---

# Branch C: `texts/notices`

### Task 6: One text a notice, once

**Files:**
- Create: `src/features/accounts/notices.ts`; modify `prisma/schema/accounts.prisma` (+ migration), `accounts.ts`, `deletion.ts`
- Test: `tests/features/accounts/notices.pg.test.ts`

- `WaitingNotice`: `id`, `userId`, `kind`, `key`, `body`, `madeAt`, `readAt DateTime?`; `@@unique([userId, kind, key])`. Deleted with the account.
- `tellByText(deps: { db; clock; texter; log }, input: { userId: string; kind: string; key: string; body: string }): Promise<"sent" | "waiting" | "already" | "held_back" | "no_number">`, in this order: the account is `active` and has a number, else `no_number`; a `TextSent` or `WaitingNotice` row for (person, kind, key): `already`; the account line is stopped for this number (Task 7; until then never): one `WaitingNotice` row, `waiting`; else, in one transaction, insert the `TextSent` row first and send inside it, as the wishlist plan's launch mail did, so two calls at once send one text: `sent: true` commits with the provider's id; `allowlist` or `made_up` rolls back, `held_back`; a `TextError` with Twilio's code 21610 rolls back, records the stop (`recordStop`, `providerId` `refused:<userId>:<kind>:<key>`; Task 7, until then only the rollback) and saves one `WaitingNotice`: `waiting` (audit 3); any other throw rolls back, logs `textFailureCode` and rethrows.
- `waitingNoticesOf(db, userId)`: newest first. `markNoticesRead(db, clock, userId)`.
- Exported from `accounts.ts`: every other feature's notice goes through it.

- [ ] **Step 1 (red):** each answer above; two calls at once send one text (Review Focus 4); a retry after a throw sends; a send refused with 21610 leaves one `WaitingNotice` and answers `waiting` (audit 3); a deleted or waiting-to-be-deleted account gets nothing; the purge removes `WaitingNotice` rows and leaves `TextSent`. Push. Expected: `postgres` fails.
- [ ] **Step 2 (green):** the code; `passwordChangedText` and `signInPausedText` now go through `tellByText` (key: the clock's minute). Push. Expected: all pass.

### Task 7: Texts in: STOP, START, HELP, and reports

**Files:**
- Create: `src/features/accounts/text-stop.ts`, `inbound.ts`, `src/routes/webhooks/twilio/+server.ts`; modify the schema (+ migration), `text-words.ts`, `notices.ts`, `forms.ts`, `deletion.ts` (audit 4), `cloudflare/worker.js` (audit 1), `src/routes/+layout.server.ts`, `+layout.svelte`, `src/routes/me/+page.server.ts`, `+page.svelte`, `src/routes/sign-up/+page.svelte`, `src/routes/forgot-password/+page.svelte`
- Test: `tests/features/accounts/text-stop.pg.test.ts`, `inbound.pg.test.ts`, `tests/browser/twilio-webhook.test.ts`, `texts-off.test.ts`

- `TextStopEvent`: `id`, `numberHash`, `line`, `stopped Boolean`, `at`, `providerId String @unique`, `createdAt`. Never updated (a trigger of its own rejects `UPDATE` only: the purge deletes a person's rows, as the spec asks). The rows hold the number's hash, not the person's id, so `purgeDueAccounts` hashes the number before it clears it, and deletes the rows with that hash (audit 4). The state of a number on a line is its newest row.
- `recordStop(deps, input: { number; line; stopped: boolean; providerId: string }): Promise<void>`: a second row with the same `providerId` is skipped, not an error. `textStateOf(db, secret, userId): Promise<{ accountOff: boolean; newsOff: boolean; unread: number }>`.
- `receiveText(deps: { db; clock; texter; secret; services: Record<TextLine, string>; site: string; limiter }, fields: ReadonlyMap<string, string>): Promise<void>`:
  - `MessageStatus` present (a report): `ErrorCode` `21610` records a stop for `To` on the line of `MessagingServiceSid`; anything else `failed` or `undelivered` logs `text not delivered: <ErrorCode>`. Nothing else is kept.
  - `OptOutType` `STOP` or `START`: `recordStop` for `From` on the line of `MessagingServiceSid`. `HELP`: nothing (Twilio has replied).
  - Any other text: `helpText` back on the same line, at most once an hour per number (`api:help-reply:<hash>`), through the `Texter` directly (it answers a text the person just sent). The help chat's plan replaces this arm for the account line.
  - An unknown `MessagingServiceSid`: ignored.
- The route: reads the body as form fields, checks `isFromTwilio(TWILIO_AUTH_TOKEN, BETTER_AUTH_URL + "/webhooks/twilio", fields, header)`, answers 400 "Bad signature" and stores nothing when it fails; else `receiveText` and 200 with `<Response/>` as `text/xml`. A throw answers 500, and Twilio sends it again because the address ends `#rc=3&rp=5xx,ct,rt` ("What follows from it", 6). The body is read as form fields whatever its content type.
- **SvelteKit's cross-site check, settled in the audit (audit 1).** In @sveltejs/kit 3.0.0, `is_csrf_forbidden` refuses a form post whose `Origin` is not the site's, and one with no `Origin` even when `csrf.trustedOrigins` is set. Twilio sends no `Origin`. The check runs before the `handle` hook, so no route or hook can let it through. So `cloudflare/worker.js` (which the journeys also run, through `wrangler dev`) gives a `POST` to `/webhooks/twilio` the content type `application/vnd.ruken.twilio-form` before handing it to the site. The signature is over the fields, so nothing is weaker. A comment in both files says why.
- A refused send (Task 6's 21610) and a lost STOP heal each other: the next send records the stop. A lost STOP and a lost START together leave Ruken wrong until the next send; said in a comment.
- **While the account line is off** (`textStateOf().accountOff`), from the layout's load, for a signed-in person only: one line at the top of every screen, "Your texts are off, so you could miss news about your account." with "How to turn them back on" (a link to `/me#texts`), and, with unread notices, "`<n>` unread". `/me` gets a "Texts" block: "Text START to `<the account number>` to turn them back on.", then the waiting notices, newest first, each with its words and time; opening `/me` marks them read. The code screens (`/sign-up`'s second state for a number whose account line is off, and `/forgot-password`'s) show "Your texts are off. Text START to `<number>`, then ask for a code." in place of "Text it again", and no code is sent.
- `tellByText` now asks `textStateOf` (Task 6's "until then never").
- The account number shown to people is a setting, `TEXT_ACCOUNT_NUMBER` (X4 gains it), since the service's id is not a number.

- [ ] **Step 0:** confirm from a real post (Task 0's test texts, read in Twilio's request log) that Twilio's webhook carries no `Origin`. If it carries the site's own, the `worker.js` line is not needed; report either way. (audit 1)
- [ ] **Step 1 (red):** `inbound.pg.test.ts`: STOP then START on each line changes only that line; the same `MessageSid` twice stores one row (Review Focus 5); a report with 21610 records a stop; an ordinary text gets one `helpText` and a second inside the hour gets none; a `From` with no account stores a hashed row and throws nothing; the purge removes a deleted person's `TextStopEvent` rows (audit 4). `twilio-webhook.test.ts`: a post with no signature and with a wrong one answers 400 and stores nothing; the stand-in's signed STOP, sent as Twilio sends it (form-encoded, no `Origin`), answers 200 through `worker.js` (audit 1). `texts-off.test.ts`: after a signed STOP to the account line the person sees the line on `/` and `/me`; a password change then waits on `/me` and counts as unread; `/forgot-password` shows the START words and no text is sent (Review Focus 3); after START the line is gone and the next notice is a text; STOP to the news line shows no line at all. Push. Expected: `postgres` and `browser` fail.
- [ ] **Step 2 (green):** the code. Push. Expected: all pass.
- [ ] **Step 3:** `showTheOwner` for the top line and `/me`'s Texts block, every view.

### Task 8: Changing the number

**Files:**
- Create: `src/features/accounts/change-number.ts`, `src/routes/me/number/+page.server.ts`, `+page.svelte`
- Test: `tests/features/accounts/change-number.pg.test.ts`, `tests/browser/change-number.test.ts`

- `startNumberChange(event, deps)`: first the person's current password, checked against their credential `Account` hash with better-auth's own hasher (`(await auth.$context).password.verify`); wrong reads `wrongPassword` and sends nothing (audit 8). Then the new number read as at sign-up and its country open, and `send-otp` (a number some account already has gets `alreadyText` from `sendOTP`, and the same next screen). `finishNumberChange(event, deps)`: `callAuth("/phone-number/verify", { phoneNumber, code, updatePhoneNumber: true })` with the person's own cookie (the plugin refuses a number that is taken); on success `phoneConfirmedAt` is set and `numberChangedText` goes to the **old** number through the `Texter` directly, once, logged by code if it fails.
- `/me/number`: "Your password", "New phone number", "Text me a code", then "The code we texted you" and "Change my number" (blue), "Keep my old number" (green, back to `/me`).

- [ ] **Step 1 (red):** the journey: change it; sign in with the new number and not the old; the old number got one `numberChangedText`; a taken number shows the code screen and changes nothing; a wrong code changes nothing; a wrong password sends no code and changes nothing (audit 8). Push. Expected: `browser` fails: 404.
- [ ] **Step 2 (green):** the code. Push. Expected: all pass. Branch C is ready to merge after the Owner's "fine".

---

# Branch D: `texts/yes`

### Task 9: The yes to news texts, and quiet hours

**Files:**
- Create: `src/features/accounts/text-yes.ts`; modify the schema (+ migration), `accounts.ts`, `deletion.ts`, `src/routes/me/+page.server.ts`, `+page.svelte`
- Test: `tests/features/accounts/text-yes.test.ts`, `text-yes.pg.test.ts`, `tests/browser/me.test.ts` (add cases)

- `TextYesEvent`: `id`, `userId`, `yes Boolean`, `words String` (the exact line shown), `timeZone String?`, `at`, `createdAt`. Rows are added, never updated (the same `UPDATE`-only trigger); deleted with the account. The newest row is the state.
- `newsYesWords(country: Country | null): string`: `"Text me when my wishlisted games are out. About one text. Message and data rates may apply. Reply STOP to stop."`, the same in every open country, since a country opens only where replies reach Ruken (Question 1). The record keeps exactly the words shown. (audit 16; wherever this plan or another says `NEWS_YES_WORDS`, it is this)
- `sayYes(deps, input: { userId; timeZone: string | null })` (refused for an account whose `adultOn` is after today or null: optional texts are not offered under 18), `sayNo(deps, userId)`, `yesOf(db, userId): Promise<{ yes: boolean; timeZone: string | null }>`.
- `inQuietHours(nowMs: number, timeZone: string): boolean`, pure, with Temporal: true before 9:00 and from 20:00 in that zone. `timeZone` is the one the device gave when the person said yes (`Intl.DateTimeFormat().resolvedOptions().timeZone`, in a hidden field filled by a script); with none, the text goes only when it is between 9:00 and 20:00 in every zone of the number's country (`timeZones` in Task 11's list; until then the US's, from Honolulu to New York), so nobody is woken at night (audit 17). An unknown zone name counts as quiet, so a bad value never sends at night.
- `tellByNews(deps, input: { userId; kind; key; body }): Promise<"sent" | "quiet" | "no_yes" | "stopped" | "already" | "held_back" | "no_number">`: as `tellByText`, on the news line, with `no_yes` when the newest event is not a yes, `stopped` when the news line is off or Twilio refuses the send with 21610 (which records the stop, audit 3), and `quiet` (nothing recorded, so a later run sends) inside quiet hours. No `WaitingNotice`: an optional text that cannot go is not owed.
- `/me`, in the Texts block: a switch, off to start, with `NEWS_YES_WORDS` beside it; not shown to an account under 18. The first press of Wishlist shows the same tick (the wishlist plan, amended).

- [ ] **Step 1 (red):** `text-yes.test.ts`: 08:59 quiet, 09:00 not, 19:59 not, 20:00 quiet, in `America/Chicago`, `Asia/Kolkata` and across the US clock change of 2027-03-14; an unknown zone is quiet (Review Focus 7); with no device zone, a US number at 13:59 New York time is quiet (8:59 in Honolulu) and at 14:00 is not (audit 17). `text-yes.pg.test.ts`: each answer of `tellByNews`; a yes, a no and a yes again leave three rows and the state yes; under 18 is refused; the purge removes the rows. The journey: the switch on `/me` turns on and off and keeps its state; an account under 18 sees no switch. Push. Expected: all three jobs fail.
- [ ] **Step 2 (green):** the code. Push. Expected: all pass.

### Task 10: The email that stays

**Files:**
- Create: `src/features/accounts/paper.ts`; modify the schema (+ migration), `src/lib/server/mail.ts`, `accounts.ts`, `auth.ts` (Task 5's `email` arm), `src/features/membership/events.ts` (or the handler that reads a finished checkout)
- Test: `tests/features/accounts/paper.pg.test.ts`, `tests/lib/server/mail.test.ts` (add cases), `tests/features/membership/service.pg.test.ts` (add a case)

- `mail.ts`: an address whose domain ends in `.invalid` is never sent and answers `false`, with no request. (The apps' test-copy plan adds the same for `.test`; whichever lands second joins the first's rule.)
- `PaperMail`: `id`, `userId`, `kind`, `key`, `sentAt`, `createdAt`; `@@unique([userId, kind, key])`; add-only (`reject_append_only_change`). Holds no address.
- `setPaperEmail(db, userId: string, email: string): Promise<void>`: trimmed, lower-cased; called by membership when a checkout finishes, with the address Stripe collected (`customer_details.email`). The kept copy of the event still holds no address (`kept-event.ts` is unchanged); the handler reads it from the verified event before it is cut down. Nobody types it into Ruken.
- `sendPaper(deps: { db; clock; mailer; log }, input: { userId; kind; key; subject: string; text: string }): Promise<"sent" | "already" | "no_address" | "held_back">`: the row first and the mail inside one transaction, as `tellByText`; the text gets one last line, "We email this one so you have a copy to keep." `no_address` lets the caller send the spec's text with the link instead.
- Makers: slice 5's bank step reads the address Stripe Connect holds and calls `setPaperEmail` ("Notes for the plans that follow").

- [ ] **Step 1 (red):** each answer of `sendPaper`, the last line, once only; a finished checkout sets `paperEmail` and the kept event holds no `@`; `someone@phone.ruken.invalid` is not sent and answers false; a reset for an account whose number changed hands and has a paper email sends the code by mail and no text. Push. Expected: `postgres` and `verify` fail.
- [ ] **Step 2 (green):** the code. Push. Expected: all pass. Branch D is ready to merge.

---

# Branch E: `texts/countries`

### Task 11: Which countries are open

The Owner's answer to Question 1 (C, "Stay closed there until replies work") is built here: a country is open only where a person can text Ruken back.

**Files:**
- Create: `src/features/accounts/countries.ts`, `src/features/accounts/library/countries.json`, `library/README.md`
- Modify: `forms.ts`, `src/routes/sign-up/+page.server.ts`, `+page.svelte`, `text-words.ts`, `text-yes.ts`
- Test: `tests/features/accounts/countries.test.ts`, `tests/browser/sign-up.test.ts` (add cases)

- [ ] **Step 0:** read Twilio's page for every country again (the method in `2026-11-15-texts-countries.md`; Sweden and the nineteen listed there by hand) and write `countries.json` from the pages: for each, `iso`, `name`, `dialingCode`, `twoWay`, `needsRegistration`, `sender` (what the country accepts from Ruken: `us_number`, `name` or `local_number`, from the table's last three columns, audit 12), `replyHere` (true only where Ruken has a number of that country on both lines: at first the US and Canada, audit 11), `timeZones` (every IANA zone of the country, from the zone table shipped with Node, audit 17), and `open`. The US and Canada split takes Canada's area codes from the North American Numbering Plan administrator's published list (audit 21). `README.md` records the day each was read and the command that made it. (The table's row for Brunei lost its name and code when it was copied; read it from its page.) Facts come from the pages; none is typed from memory.
- `open` is true only for a country where a text can go out and a reply can come back today, with nothing more from the Owner: on the first day that is the United States and Canada once X5 is done. Every other country starts `false` and is opened by one line in `countries.json`, only after the Owner's X7 for it: its Geo Permission on in Twilio, a number of that country on both lines, and its registration where one is asked. `open` is never true where `replyHere` is false, so a country whose `twoWay` is false cannot open at all. Puerto Rico shares `+1` and Twilio's page says a US number reaches it, but that a reply from it reaches Ruken's US numbers is not proven: it starts closed, and opens when Task 0's kind of proof (a real STOP from a Puerto Rico number, recorded) is on the pull request. `open` and Twilio's Geo Permissions must match (audits 10, 12). Launch waits for the ones the Owner marks.
- `openCountries(): readonly Country[]` (by name), `countryOf(number: string): Country | null` (the longest dialing code that fits; `+1` is told apart by area code only between the United States and Canada, and anything else under `+1` is its own entry).
- Sign-up's `<select>` lists `openCountries()`, starting on the one the browser's `Accept-Language` region names when it is open, else the first. A closed country cannot be chosen; a number typed with `+` whose country is closed gets "Ruken isn't in your country yet." and nothing is stored or sent.
- Every open country can reply, so the words are the same everywhere: sign-up's note ends "Reply STOP to stop, HELP for help." and `newsYesWords` has one ending. No "turn these off on your account page" wording is built.

- [ ] **Step 1 (red):** no entry is `open` with `replyHere` false; every entry has the nine fields, a dialing code of `+` and 1 to 4 digits and a zone name Temporal accepts; no two entries share a dialing code but the `+1` ones; `countryOf` for a US, a Canadian, a UK and an unknown number; the journey: a closed country's number is refused with the one line, with no text and no row; the list offers only open countries. Push. Expected: `verify` and `browser` fail.
- [ ] **Step 2 (green):** the list and the code. Push. Expected: all pass. Branch E is ready to merge. Tell the coordinator which countries are open and which wait on X7.

---

## Notes for the plans that follow

- **Other plans' texts.** A notice to an account is `tellByText(…, { userId, kind, key, body })` from `accounts.ts`; an optional one is `tellByNews`. Each plan words its own with `fitText`. The amended tasks are at the end of: the wishlist plan (branch D), beta builds (Task 4 and 6), the sales plan (Tasks 8, 14 and 28), the apps' test copy (Tasks 7 and 10) and the apps' slices (L). Slice 1's plan carries a note that this plan replaces its sign-up, sign-in, reset and mails.
- **Slice 4's five mails to a maker** (`admin/maker-mails.ts`: a game live, sent back, taken down; a page taken down; an account suspended) were not in the spec's list of plans, and are the same change. A note at the top of slice 4's plan says so and gives their words as texts.
- **The privacy and terms pages** (held on pull request #104) must say, before X5: what texts Ruken sends (codes, account notices and, with a yes, one text when a wishlisted game is out), about how often, that message and data rates may apply, how to stop (reply STOP, or the account page) and get help (reply HELP), and that phone numbers are never shared or sold. The carriers read these pages.
- **Slice 5's bank step** calls `setPaperEmail` with the address Stripe Connect holds for a maker.
- **The apps' slice N** adds the fourth notification, "About my account", off until turned on; with it on, a `WaitingNotice` also goes out as a notification.
- **The help chat** (`2026-11-15-help-chat-design.md`) replaces `receiveText`'s "any other text" arm for the account line, and `/help`, which this plan links to and does not build. Until it is on `main`, `/help` is whatever the legal pages' branch puts there; if nothing is there when Task 5 starts, stop and ask the coordinator.
- **Worth the Owner's eye, left as they are on purpose:** an account that never paid can be reset by whoever holds its number (Task 5, rule 3); outside the United States Twilio cannot say whether a number changed hands; a person who stops account texts can only turn them back on from their own phone; codes are kept readable for their ten minutes (audit 7); and the spec's "ten wrong codes pause codes for that number for an hour", with limits counted per number, lets a stranger who knows a number keep its owner from getting a code for an hour at a time. Slice 1 counted per client to stop that for resets. It is built as the spec says (audit 9).

## Self-review

- **Spec coverage.** "Which message goes where": codes and account notices, Tasks 4 to 6; the maker's, split's, extra's and wishlist's texts, the other plans' amended tasks through Task 6 and 9; help, the help chat's design; the three emails, Task 10 and their own plans. "Signing up and signing in": Tasks 2, 4, 5, 8. "The email that stays": Task 10. "Saying yes, and STOP": Tasks 7 and 9. "Every country": Task 11 and the country table. "Twilio": Task 1. "Before the carriers say yes": X5, `TEXT_ALLOWLIST` (Task 1), and Task 4 removes email sign-up. "Stored": Tasks 3, 6, 7, 9. "Left to the plan": Twilio's calls ("What Twilio's pages say"), the words ("The words of every text"), how email sign-up is removed (Task 4), the countries (the table, Task 11), the stand-in (Task 1).
- **Not covered here, and said so:** the fourth notification (the apps' slice N); the help chat; the legal pages' lines; the three legal emails' own senders.
- **Names.** `Texter`, `TextMessage`, `TextLine`, `tellByText`, `tellByNews`, `textStateOf`, `hashNumber`, `toE164`, `resetChannel`, `sendPaper` and `setPaperEmail` are spelled one way throughout.
- **Open before the build:** Task 0's proof of the two numbers; Task 7's Step 0 on the cross-site check.
