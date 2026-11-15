# Texts, not email

Date: 2026-11-15. Status: approved by the Owner on 2026-11-15 ("Text design approved"). The Owner's four answers of 2026-11-15 are written in. Builds on the design (`2026-11-13-ruken-reels-linktree-design.md`), the wishlist design, beta builds, the makers' sales spec and the apps spec, and changes them only where this file and the "Changed on 2026-11-15" section at the end of each of them say so.

Principles served: the drunk-grandma test (a text is where a tired person already looks), privacy by default (a phone number is asked for with its reason beside it, never shown to anyone, and never texted without a yes), and "don't overengineer" (one port, one provider, plain `fetch`).

## Why

Owner, 2026-11-15: "Reconsider the AI chat, I almost never want to use email here; text only almost exclusively".

Owner, 2026-11-15: "The text is for more than just support, everything other companies do with email, we do via. text unless it's something paper trail related for legal".

Asked whether "text" means messages inside the app, texts to a phone number, or both, the Owner answered "2": texts to the person's phone number.

## What the Owner decided

- Everything other companies send by email, Ruken sends as a text to the person's phone number.
- Email stays only for a legal paper trail.
- Help is by text too, and the AI help chat is in for launch.

The Owner's four answers, 2026-11-15, each picked on a question card:

1. **What people sign up with:** A. A phone number and a password, confirmed by a text code. Email is asked only at paying, for the receipt. (Not chosen: phone, password and email at sign-up; phone only with a code at every sign-in.)
2. **Outside the US and Canada:** B. Every text goes by text in every country from the first day, accepting the higher cost and the wait on each country's registration. (Not chosen: email elsewhere until each country is added; the US and Canada only.)
3. **The texting company:** A. Twilio.
4. **If the carriers have not approved Ruken's number by launch:** "Launch waits for the carriers". (Not chosen: keep email sign-up until approved.)

## Goals

- A person signs up, confirms it is them, and gets back in after a forgotten password, all with their phone and no inbox.
- Every notice Ruken sends a person arrives as a short text they understand at a glance, with one link at most.
- Nobody gets a text they did not agree to. Texting STOP stops them, and Ruken shows that plainly.
- The few legal emails still arrive, and Ruken can show that each was sent.

## Not in this

- The AI help chat itself: what it can answer, when a person takes over, and what it may see. It needs its own short design. This file only says where its texts come in and go out.
- Messages inside the app, and any new push notification. The apps spec's three push notifications stay as they are.
- WhatsApp, RCS, picture messages and voice calls.
- Texts that sell something nobody asked about.

## What would make it a failure even if it works

- A text to someone who did not agree, after STOP, or twice.
- An optional text that wakes someone at night.
- A person who gets a phone number someone else used to have, and gets into that person's account with it.
- A phone number shown to a maker, a player or a log.
- Sign-up that nobody can finish because the phone carriers have not yet approved Ruken's number.
- A legal notice that went only by text and cannot be shown later.

## Approaches

- **A. The phone number is the account's name, and a text does what email did (chosen, answer 1).** Sign-up asks for a phone number, a password and a date of birth. A code by text confirms the number. Email is kept only for legal papers and is asked for only when one is first needed.
- B. Keep email sign-up and add a phone number for notices. Less to rebuild, but every person still needs an inbox to join, which is what the Owner wants gone.
- C. No password: a code by text at every sign-in. One field fewer, but every sign-in costs a text, and a person whose phone is off or abroad cannot get in.

## How it works

### Which message goes where

| Message | Today | From now |
|---|---|---|
| Confirm it is you at sign-up | email link | text code |
| Forgot password | email link | text code |
| "Your password was changed" | email | text |
| "Password sign-in is paused" | email | text |
| A maker's game or extra: accepted, sent back, taken down, taken off sale | email | text |
| A suspension or take-down reason to the maker | email | text, with a link to the reason on Ruken |
| A split: the invitation, and what changed | email | text, with a link to the split on Ruken |
| A wishlisted game is out (launch) | email to every wishlister | text to wishlisters who said yes |
| Help | none in any spec | text Ruken's account number; the help chat answers |
| Receipts | Stripe's email | Stripe's email (unchanged) |
| Terms or privacy changed | email | email; a text with the link for accounts that have no email |
| EU and UK: "you gave up your 14 days" | email | email (the law asks for a lasting copy) |
| A game left Ruken, bought through Apple: the link to Apple's refund page | email | email, and the same link by text |

Call: the apps spec's three push notifications (new DLC, a beta invite, a renewal in three days) stay push notifications, off until turned on. They do not also go by text.

### Signing up and signing in

```
┌──────────────────────────┐
│ Join Ruken               │
│                          │
│ Phone number             │
│ [ +1 ▾ ][ 312 555 0142 ] │
│ Password                 │
│ [ ••••••••••           ] │
│ Date of birth            │
│ [ MM ][ DD ][ YYYY ]     │
│                          │
│ We'll text you a code to │
│ check it's you, and      │
│ texts about your account.│
│ Message and data rates   │
│ may apply. Reply STOP to │
│ stop, HELP for help.     │
│                          │
│ [   Text me a code   ]   │  blue
└──────────────────────────┘
```

- Sign-up asks for a phone number, a password and a date of birth. The country code starts on the one the browser's region suggests, and the number is stored in the international form (`+13125550142`).
- Pressing the button sends a six-digit code that lasts ten minutes. The next screen has one field, "The code we texted you", and "Text it again" (green) after 30 seconds. The right code makes the account and goes straight back to where the person was, as sign-up does today.
- One account per phone number. A number that already has an account gets the same screen and a text that says "You already have a Ruken account. Sign in, or reset your password", so the form never tells a stranger whose number has an account.
- Sign-in is the phone number and the password.
- "Forgot password" asks for the number, texts a code, then asks for a new password. Afterwards the person gets the "Your password was changed" text and is signed out everywhere, as today.
- Changing the number, on `/me`: the new number is confirmed by a code first, and the old number gets one text saying it was changed.
- Codes are limited for each number and each visitor with the limiter slice 1 already has, so nobody can run up texts or guess a code. Ten wrong codes pause codes for that number for an hour.
- **A number that changed hands.** Phone companies give old numbers to new people. Before a reset code is sent, Ruken asks Twilio whether the number changed hands since the account last signed in, where Twilio can say. If it did, or it cannot say and the account has paid or been paid, the reset goes to the account's email when it has one, and otherwise to help. The plan reads Twilio's own pages for this and fixes the exact rule.
- Call: no real person has an account yet, so nothing is moved over. The made-up accounts of the test copy get made-up numbers that can never be texted.
- Drunk grandma: one number she knows by heart, one code that arrives where she is already looking, one blue button a screen.

### The email that stays

- Ruken has an email address for a person only once a legal paper needs one: Stripe asks for it at paying and Ruken reads it from Stripe (a member), or Stripe's own sign-up for payouts asks for it (a maker). Nobody types it into Ruken.
- Ruken sends email only for the rows of the table that say email. Each one sent is recorded, as mails are today.
- The words of a legal email are short and plain, and say why it came by email: "We email this one so you have a copy to keep."

### Saying yes, and STOP

- **Account texts** (codes, password and sign-in notices, a maker's notices, a split). The line under the phone number at sign-up says they will come. A person gets them because they have an account.
- **Optional texts** (today, only "a wishlisted game is out"). Sent only to a person who ticked a box that is empty to start with, shown the first time they press Wishlist: "Text me when my wishlisted games are out. About one text. Message and data rates may apply. Reply STOP to stop." The tick, its exact words and its moment are recorded, added and never changed. `/me` has the same switch.
- Saying yes to optional texts is never needed to join, to pay or to play.
- **Two numbers, so STOP on one does not silence the other.** Owner, 2026-11-15: "How does stop work here because we're text first, saying stop might make them not see important things". Owner, 2026-11-15: "Sign in codes, account messages, and support is 1 number, everything else is another; that works". So sign-in codes, account texts and help share one number ("Ruken account"), and every other text comes from a second ("Ruken news"). STOP sent to the news number ends only the optional texts; codes and account notices keep coming.
- **STOP.** A person who texts STOP to a number gets no more texts from that number; the phone carriers enforce this, and Ruken never works around it. Ruken hears of it from Twilio and records it, added and never changed.
- **The one reply to STOP.** It says plainly what stopped and how to undo it, and sells nothing. To the news number: "Ruken: no more news texts. You'll still get texts about your account. Reply START to get news again." To the account number: "Ruken: no more texts from us, so you won't hear about your account or password here. Reply START to turn them back on."
- **After STOP on the account number.** Only the person can undo it, by texting START; no button on Ruken can. Until they do:
  - Every screen shows one line at the top while they are signed in: "Your texts are off, so you could miss news about your account." with "How to turn them back on", which shows the number and the word START.
  - Each notice that would have been a text waits on `/me`, newest first, and the line at the top says how many are unread.
  - The code screens say the same thing in place of "Text it again", since a code cannot reach them either.
  - A fourth notification, "About my account", is offered there and in Settings, off until they turn it on like the apps spec's three. With it on, a waiting notice also arrives as a notification.
  - Legal papers still go by email, as before.
- **HELP.** Texting HELP gets one fixed reply with Ruken's name, where help is, and how to stop.
- **Any other text to the account number** goes to the help chat, once its own design is built. Until then it gets the HELP reply.
- **Quiet hours.** Optional texts go out only between 9:00 and 20:00 in the person's own time, read from their device when they said yes. Account texts go when they happen.
- **Under 18.** Optional texts are not offered to an account under 18.
- Ruken's public privacy and terms pages say what texts are sent, how often, that rates may apply, how to stop, and that phone numbers are never shared or sold. The carriers check these pages before they approve Ruken's number.

### Every country

- Owner, answer 2: every text goes by text in every country, from the first day. There is no email in its place anywhere.
- Owner, 2026-11-15, on a card about countries where people cannot text Ruken back: "Stay closed there until replies work". So Ruken opens only where a person can reply STOP, START and HELP: the United States and Canada on the first day, then any country where replies work once Ruken has a number there.
- Some countries deliver a company's texts only after that company registers with them, and some take weeks. The plan lists, from Twilio's own pages, every country Twilio reaches, what each asks for and how long it takes. Registering in each is the Owner's step.
- A country where Ruken's texts are not yet allowed is closed to sign-up, with one plain line: "Ruken isn't in your country yet." Nothing is stored. It opens by one entry in a list.
- Launch waits for the countries on that list that the Owner marks as needed on the first day.

### Twilio

- Owner, answer 3: Twilio. It is a new outside service; no package is added.
- One port, `Texter`, beside `Mailer` in `src/lib/server/`: every text goes through it, so a test can capture texts and the company can change in one file. It calls Twilio's HTTP API with plain `fetch`.
- `TEXT_ALLOWLIST` works as `MAIL_ALLOWLIST` does: when set, only those numbers are texted. The test copy and every test use it, so a made-up account is never texted.
- Texts in from people, STOP and delivery reports arrive at a webhook whose signature is checked, as Stripe's is.
- A log never holds a phone number or a code.
- The Twilio account, its bill and its keys are the Owner's.

### Before the carriers say yes

- US phone carriers deliver a company's texts only after that company registers its name and its number with them, which needs the company and its tax number. Ruken App LLC is not formed yet. Registering is the Owner's step after the LLC, and takes days to weeks.
- Owner, 2026-11-15, asked what sign-up does if the carriers have not approved Ruken's number by launch: "Launch waits for the carriers". Nobody ever joins by email. If the LLC and the carriers' approval come after 30 November, launch moves to the day they are in.
- Until the number is approved, texts reach only the numbers in `TEXT_ALLOWLIST`, so the Owner and testers can use the site.
- The email sign-up that is built today is removed by this work, not kept beside it.

### Stored

- On the account: the phone number (unique), when it was confirmed, the optional-texts yes with its words and time, and a STOP with its time. All deleted with the account.
- `TextSent`: who, which kind, when, and the company's own id for it. Only ever added. It is how a text is never sent twice.
- The email address becomes optional on the account.

## What changes elsewhere

- **The design (2026-11-13):** 5.6 sign-in, 5.7 sign-up and "We'll email you when it's live", 7.1 "Ruken sends few emails", 9 Mail.
- **The wishlist design:** the launch email becomes a text to wishlisters who said yes; `WishlistMail` becomes a `TextSent` kind.
- **Beta builds:** a maker adds a tester by handle only, never by email or phone number.
- **The makers' sales spec:** 5.6 and 5.10, the split's invitation and change and an extra's notices become texts; 5.2 and 5.8's emails stay.
- **The apps spec:** signing in, and "everyone on a wishlist gets an email" at launch.
- **The plans** built on those lines: slice 1 (accounts, built), the wishlist plan's branch D (the launch mail), beta builds' tester lookup, the sales plan's `mails.ts` and `proposeSplit`, the apps slices' L. Each carries a note at its top; a plan session rewrites those tasks once this spec is approved.

## Needs, and when

- The Owner: the Twilio account and its keys; after the LLC, registering Ruken's name and number with the US carriers; then each other country that asks for it.
- The privacy and terms pages with the lines above, public before registering.
- Then a plan, its audit and a build, like any slice.

## Left to the plan

- Twilio's exact calls, read from its own pages: sending, codes, the webhook's signature, the changed-hands check, and whether STOP also stops codes.
- The exact words of every text, each under 160 characters, each passing the drunk-grandma test, each starting "Ruken:".
- How the built email sign-up is removed.
- The list of countries, what each asks for, and which wait on a registration.
- The test stand-in for Twilio, as `fake-mail-server.ts` is for mail.
