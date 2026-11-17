# Texts, Not Email Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, under the repository's `CLAUDE.md` and its skills (`build`, `release`, `review`, `visual-check`, `staged-path`); where they and this plan differ, they win. Steps use checkbox (`- [ ]`) syntax for tracking. **Read "This slice: branches A and B" first.**

**Goal:** A person joins Ruken, signs in and gets back in with their phone number and a code by text; every notice Ruken sends is a short text from one of two numbers; nobody is texted without a yes or after STOP; and the few legal emails still go out and are recorded.

**Architecture:** One port, `Texter`, beside `Mailer` in `src/lib/server/`, calling Twilio with plain `fetch`. The phone number, the yes to optional texts, STOP and the record of what was sent all live in the `accounts` feature, which every other feature already imports, so there is no new feature folder. Sign-in stays on better-auth 1.7.7, through its own `phoneNumber` plugin (already in the installed package; no new dependency). Texts in from people, STOP and delivery reports arrive at one signed webhook. The email sign-up on `main` is removed, not kept beside this.

**Tech Stack:** as slice 1 (Node 24, pnpm 10.34.6, SvelteKit 3.0.0, Svelte 5.57.1, Prisma 7.10.0, Postgres 16, better-auth 1.7.7, `@js-temporal/polyfill` 0.5.1, Vitest 5.0.3, Playwright 1.63.0, Cloudflare Workers). Twilio is a new outside service the Owner chose ("3. A"). **No new package.**

**Spec:** `docs/superpowers/specs/2026-11-15-texts-not-email-design.md` (approved by the Owner, 2026-11-15: "Text design approved"). Read it with `CLAUDE.md` and its skills, and slice 1's plan (`2026-11-13-slice-1-accounts-membership.md`: "The look" holds here; how a task runs is in this plan now). The country table is `2026-11-15-texts-countries.md`. The help chat's own design is `docs/superpowers/specs/2026-11-15-help-chat-design.md` (written with this plan, not yet approved; nothing here builds it).

**Brought up to date:** 2026-11-17, against `main` at `3b1fabf`, for branches A and B only. "This slice: branches A and B" says what changed and is the brief for the build. Branches C, D and E wait; their tasks were not read against `3b1fabf`. The plan's branch has since merged `main` at `e5a1f62` (pull request #188: the rules and CI), which touches no path Tasks 0 to 5 name.

**Planned against:** `main` at `286bfdf`. Read in the plan session, 2026-11-15: every file under `src/features/accounts/`, `src/lib/server/mail.ts`, the account routes, the journeys' stand-ins, better-auth 1.7.7's own `dist/plugins/phone-number/` (its routes, options and error codes, from the published package), and Twilio's pages named under "What Twilio's pages say". No test, lint or typecheck ran; no code was written.

**Audited:** `docs/superpowers/audits/2026-11-15-texts-not-email-plan-audit.md` (2026-11-15). Its fixes are written into this plan; a line that an audit finding changed names it, as "(audit 3)". A line marked "(audit round 4)" or dated 2026-11-16 comes from the first attempt at branch A and its review, whose own files were rolled back with it; those lines are carried over as written. The 2026-11-17 changes were audited the same day, at `034f619`: `docs/superpowers/audits/2026-11-17-texts-not-email-2-plan-audit.md`. Its five red findings are fixed in this plan; a line one of them changed names it, as "(audit 2.1)". The auditor checks the fixes.

**When it is built:** now, for branches A and B. The Owner's handoff, 2026-11-17: this slice is this plan's branches A and B only (together: sign-up, sign-in and forgot password by phone); C, D and E wait; texts to real phones come last, after the Owner upgrades Twilio. (This replaces the 2026-11-15 line that held the whole plan for a later slice.)

**Codes through Twilio Verify:** the Owner, 2026-11-17 04:43 UTC, on a card: "Send codes through Twilio Verify". Written into branches A and B the same day, on top of `3787034`; "This slice", "Codes go through Twilio Verify", says how, and a line this changed names it, as "(Verify)". This round has not been audited yet; the auditor reads it together with the fixes for audit 2.1 to 2.5.

## This slice: branches A and B

Written 2026-11-17, against `main` at `3b1fabf`. This section is the brief for the build of branches A and B. Where it and a task below differ, this section wins, and the task has been edited to match.

### What the Owner already answered (not asked again)

- Sign-up is a phone number, a password and a date of birth, then a code sent by text. Email is asked for only when someone pays. Sign-in is the phone number and the password. Texts go through Twilio, opening first where replies work: the United States and Canada. (The spec, and the handoff of 2026-11-17.)
- This slice is branch A (the port) and branch B (sign-up, sign-in and forgot password). Branches C, D and E wait.
- Texts to real phones come last in the slice. A Twilio trial account cannot make Messaging Services, so the Owner upgrades Twilio first. Nothing has been bought or set up in Twilio yet.
- Codes go through Twilio Verify. (The Owner, 2026-11-17 04:43 UTC, on a card: "Send codes through Twilio Verify".)

### What changed since the plan was written

**`main` moved from `286bfdf` to `3b1fabf`.** Game submission (#63) merged, the later attempt at slice 2 was rolled back (#186), and the old workflow rules and CI were taken out (#187). Checked with `git diff 286bfdf 3b1fabf`:

| What | Then | Now | Where this plan says so |
|---|---|---|---|
| The accounts feature, `src/lib/server/`, `src/hooks.server.ts`, membership, money, the sign-up, sign-in, forgot-password and reset-password routes, the jobs, and their tests | as read | **no change at all** (the diff is empty for these paths) | the audit's reading of them still holds |
| The package versions in "Tech Stack" | as written | the same in `package.json` | no change |
| `/me` | the email, the membership line, sign out, delete | also "Your games" or "Make games? Add yours to Ruken." | Task 4: those two lines stay |
| The games feature | no staff list | `waitingGames()` in `src/features/games/service.ts` answers each waiting game's `makerEmail`; no screen reads it, one test does (`tests/features/games/review.pg.test.ts`) | Task 4: `makerEmail` is taken out |
| Journeys and their helpers | slice 1's | many more, all signing up by email through `signUp`: the `make-*` journeys, `buttons`, `client-address`, `connect-github`, `game-gate`; `tests/browser/support/game.ts`, `look.ts` (its `CARD_SCREENS` open "check your email" and `/reset-password`), and nine helpers in `database.ts` that take an email | Task 4: its file list names them |
| `playwright.config.ts` | three stand-ins on ports 12111 to 12113 | the same three, plus each worker's own client address (`journeyClientHeaders`) and the game gate on 8788; port 12114 is still free | Task 1: no change |
| Migrations | the newest was `20261114180000_final_month_lines` | the newest is `20261115190000_agreement_per_version`; `User` gained two relations | Task 3: the new migration is dated after it |
| `/help` | expected from the legal pages | only `/help/github` and `/help/record-screen`; there is no `/help` page | Task 5: no link to `/help` |
| The workflow | the old `CLAUDE.md`: no session runs tests; a tracker; the Owner's "fine" on each branch | the apps kit (`CLAUDE.md` and `.claude/skills/`, back on `main` at `e5a1f62` with CI, pull request #188): targeted tests in the session's container, CI as the gate, lanes, audits by lane, acceptance criteria, layout sketches, a live-state file, one approval of the finished result | Global Constraints, "How a task runs", and below |

**The first attempt at branch A (2026-11-16) was rolled back with the rest.** Its code is kept only under the tag `slice2-attempt-1` and is not built on. What it learned is written into this plan, because it is still true:

- Task 0's Step 0 was read once: the part of a webhook address after `#` is not signed; Twilio's worked signature example reproduces; SMS Pumping Protection is one switch for the whole account; and Twilio's pages do not agree on when a send to someone who opted out fails (point 8). The build session reads them again.
- `isMadeUpNumber` belongs in `src/lib/server/text.ts`, because `src/lib/` may import no feature (`tests/architecture.test.ts`); `phone.ts` re-exports it.
- The sample number `+1 312 555 0142` is itself a made-up number, so a test that expects a text to be sent must use one that is not, such as `+13125551234`.
- The Twilio settings are read in Task 4, not Task 1. The site builds its services on a request, so requiring the settings before anything uses them would stop the test site.
- `twilio phone-numbers:buy:local` does not exist. The Owner's commands were corrected (X2).

**New on 2026-11-17, decided in this plan session. The second plan audit should read these first.**

1. **Real texts last.** Branches A and B are built and tested against the stand-in. Task 0's proofs with a real phone hold back neither branch's build. Since Verify they are two: Step 1a (a real code through Verify) comes before branch B merges, and Step 1b (the two numbers and STOP) waits for X5 and decides how branch C is set up, not how A or B are built. (Verify)
2. **Branch B merges only after X4.** Once B is on `main` the site needs its Twilio settings to answer a sign-in at all, and `main` is what the test site runs. So B is built, audited and fixed on its branch, and merges after the Owner has done X1 to X4, after one real code has reached the Owner's phone through Verify (Task 0, Step 1a), and after the Owner has given the word a lane 3 change needs. (Verify)
3. **The email a member pays with is kept from branch B on.** Until X6 Twilio "cannot say" whether any number changed hands, so the spec's rule sends every paying member's reset code to their email. That email was only stored from branch D (Task 10). With D waiting, no member could reset a password. So `setPaperEmail`, and the call that stores the address when a checkout finishes, move from Task 10 into Task 5, and the reset's email arm sends through the `Mailer` there. `sendPaper`, `PaperMail` and the `.invalid` rule stay in D.
4. **No link to `/help` yet.** The page does not exist and the help chat waits. The forgot-password screen keeps its way back ("Back to sign in") and "Text it again", and does not offer a help link until the help chat's plan builds one.
5. **`TWILIO_AUTH_TOKEN` is read from branch C on**, with the webhook that checks signatures. Nothing in A or B uses it. The Owner may still set it in X4; an unused setting harms nothing.
6. **`waitingGames()` no longer answers `makerEmail`.** After B that column holds a stand-in address. Nothing shows the list yet; the screen that will (slice 4) says then what staff see of a maker.

### Codes go through Twilio Verify

**The Owner, 2026-11-17 04:43 UTC, on a card: "Send codes through Twilio Verify".** The card answered the one open point this section used to hold: Ruken's own two numbers cannot text a United States phone until the carriers approve Ruken (X5, which waits for the company and its tax number), so no real code could have arrived before then. Twilio's page on carrier registration says (as the setup session read it, 2026-11-17): "If you're only using 10DLC numbers to send user verification text messages, you can use Twilio Verify rather than registering for A2P 10DLC."

**How it is built.** Twilio's pages were read in this plan session on 2026-11-17 (`docs/verify/api/verification`, `docs/verify/api/customization-options`, `docs/verify/api/service`, and the error pages 60202, 60203 and 60204); "What Twilio's pages say" quotes them. No request was sent to Twilio.

1. **better-auth still makes and checks every code.** The `phoneNumber` plugin makes the six digits, keeps them for ten minutes and checks them, for sign-up and for forgot password alike. Nothing in the checking, the three tries, the wrong-code pause (audit 2.2) or the plugin's one-step reset changes.
2. **Verify only carries the code.** The plugin's `sendOTP` and the text arm of `sendPasswordResetOTP` hand the code to a new `Texter` call, `sendCode(number, code)`, which starts a Verify verification with that code as `CustomCode`. Ruken never asks Verify to check a code.
3. **A new code replaces the last one.** Twilio's pages do not say what happens when a second verification is started for the same number with a different code while the first is still open. They do say: "Mark the verification as `canceled` to start a new verification session with a different code", "Only recommended during testing or if you're using custom verification codes." So `sendCode` first cancels any open verification for the number (a 404, none open, is fine) and then starts the new one. Step 1a proves this with a real phone: two codes asked for, the second text holds the second code.
4. **Ruken tells Verify when a code was used.** Twilio: "If you're using custom verification codes you must also provide feedback that lets us know whether or not the user verified the code." A second new call, `codeUsed(number)`, marks the number's verification `approved`. The forms call it after the answer, whenever the plugin accepted a code. It never throws: a failure is logged by its code and changes nothing a person sees. Twilio's own sample does this by phone number ("Manually Approve Verification using Phone Number"), so no verification id is stored.
5. **One new setting, `TWILIO_VERIFY_SERVICE`** (the service's id, starting `VA`), set by the Owner in X4 after one command in X2 makes the service with custom codes on. Custom codes are a switch on the service ("`customCodeEnabled`: Whether to allow sending verifications with a custom code instead of a randomly generated one"); the pages name no request to Twilio for it. Only a custom company name needs Twilio's sales team, and Ruken does not use one.
6. **The code text is Twilio's words, not Ruken's.** Verify sends its own template with the service's name in it. Twilio's example, with the warning the service turns on: "Your AppName verification code is: 1234. Don't share this code with anyone; our employees will never ask for the code". So the code text does not start "Ruken:", does not say how long the code works, and a reset code does not say "Didn't ask? Ignore this text." `codeText` and `resetCodeText` leave the words table. The exact words that arrive are recorded in Step 1a. This narrows the spec's "every text starts Ruken:" for the code text only; the Owner's choice of Verify is the reason.
7. **The stand-in serves Verify's addresses** and keeps the code it was handed, so the journeys read the code from it (`codeTo(number)`).

**What still goes through Ruken's own numbers, and is blocked in the United States until X5.** Three texts in branch B are not codes, so Verify cannot send them: `alreadyText`, `passwordChangedText` and `signInPausedText`. They still go through the `Texter`'s `send` on the account line. Tests prove them against the stand-in. Until X5 a real United States phone does not get them (whether a Canadian phone does was not read). What a person sees then:

- **Signing up with a number that already has an account.** The same code screen as anyone, and no text comes. No code is sent to that number at all (a code that could never work would be worse than none). So the code screen gains one line, shown to everyone whatever the number: "No text? Check the number, or sign in if you already have an account." with "sign in" a link. The rule holds: no number gets a different screen, different words or a different wait, and both cases still call `/phone-number/send-otp`, so they count against the same limits (audit 6).
- **After a password is changed.** The screen already says it worked ("/sign-in" with its line). The text that tells the number's owner does not come. Changing the password took a code from that phone, or from the email the member pays with, so the person who did it held one of those.
- **After too many wrong passwords.** The sign-in screen says sign-in is paused and offers the reset, as today. The text that tells the number's owner does not come, so they find out when they next sign in.

After X5 all three arrive with no change to the code.

**Risks, named.**

- **Custom codes may be refused on the Owner's account.** The pages say a switch on the service is enough, and the error for a service without it is 60204, "Service does not support this feature". If Step 1a meets 60204 with the switch on, stop and report: the other shape (Verify makes and checks the codes itself, through the plugin's `verifyOTP`) does not reach forgot password, which always checks the plugin's own code, so it is a new plan round and a new audit, not a fix. Step 1a needs only X1 and the one Verify command, not the two numbers, so the coordinator should ask the Owner for it early. Branch B's build does not wait for it; branch B's merge does.
- **Verify's own limits sit behind Ruken's.** Five sends in one verification's ten minutes (error 60203, "Max send attempts reached"). Ruken's limits are in front (one code in 30 seconds, three in 15 minutes for a client and number, ten an hour for a number) and each new code cancels the last verification first, which should start the count again; the pages do not say that it does. If Twilio refuses a send, it is a failed send like any other: logged by its code, the code screen still shows, and "Text it again" works later.
- **Cost.** Verify charges for each verification on top of the text. The price page was not read in this session; Step 0 reads it and reports the number to the coordinator, since money is the Owner's.
- **Twilio's guard against fake sign-ups.** Verify's Fraud Guard is on unless a request turns it off (`riskCheck`: "enable(default)"); Ruken never turns it off. The pages do not say whether it acts on custom codes. X2's SMS Pumping Protection covers Ruken's own numbers, not Verify.
- **Which countries Verify may text.** The pages mention Geo Permissions for Verify but this session did not read where they are set. Step 0 reads it; if Verify has its own list, X2 gains a line turning Canada on there.
- **Codes are still kept readable for ten minutes** in Ruken's database (audit 7). This shape does not change that.
- **A STOP to the account number no longer stops codes**, since codes do not come from it. Branch C's tasks say otherwise today (point 2 under "What follows from it", Review Focus 3, Task 7); the plan session that brings C up to date rewrites them.

### Units

One pull request for each branch. Each merges before the next starts, and leaves `main` green.

| Unit | Branch | Lane, and why | Waits on | Files it owns | Output | Acceptance check |
|---|---|---|---|---|---|---|
| Task 0, Step 0 | A | 1: reading | nothing | the "Step 0" lines of this plan | what Twilio's pages and the plugin say today | every difference from this plan is written under the step, or the build stops and reports |
| Task 1 | A | 2: `src/lib/`, `playwright.config.ts`, `tests/support/` | Step 0; pull request #188 on `main` (met: `e5a1f62`, 2026-11-17) | Task 1's files | the `Texter` and the stand-in | A1 to A3, A6 |
| Task 2 | A | 1: new files with their tests | Task 1 (`isMadeUpNumber`) | Task 2's files | the number rules and the words | A4, A5 |
| Task 3 | B | 3: a migration | branch A on `main` | Task 3's files | the tables | B9 |
| Task 4 | B | 3: `src/features/membership/` | Task 3 | Task 4's files | sign-up and sign-in by phone; email sign-up gone | B1 to B3, B5 to B8, B10, B11 |
| Task 5 | B | 3: `src/features/membership/`, `src/features/money/` | Task 4 | Task 5's files | forgot password | B4 to B7, B10, B11 |
| Task 0, Step 1a | none (no code) | 3: a real device and the Owner's money | X1 and the Verify service (X2's last command) | the "Step 1a" lines of this plan | a real code on the Owner's phone through Verify (Verify) | the words that arrived and the verification's statuses are written under the step; branch B does not merge before it |
| Task 0, Step 1b | none (no code) | 3: a real device and the Owner's money | X1 to X5, and branch B built | the "Step 1b" lines of this plan | the proof of the two numbers | the four message ids and their statuses are written under the step |

- **Branch A is lane 2:** the full run, and one fresh review after the build. It needs nothing from the Owner and can merge before any Twilio step: it adds code nothing calls yet.
- **Branch B is lane 3:** this plan's second audit before the build, an implementation audit after it, and the Owner's approval before it merges. It stays a draft until then.
- **Models (Settings in `CLAUDE.md`):** the build is execution against a spec, so Sonnet 5.5 at medium effort. **Branch B is marked hard, so high effort:** Task 4 rewrites the one path where a mistake signs a stranger in to someone's account (the plugin's `verify`), and moves every journey to new helpers in the same change. The audits are Opus 5.5, medium.
- **Expected duration (an estimate, not measured):** branch A about half a day of session time, branch B one to two days with its audits. Waiting on the Owner's Twilio steps is not counted.

### Acceptance criteria

A gap against one of these is a defect. The device matrix is the nine projects in `playwright.config.ts` (phone, tablet and computer, upright and sideways, in Chromium and WebKit); they are browser profiles, so they are emulation evidence and not proof on a real phone.

**Branch A**

- A1. `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:pg` and `pnpm build` exit 0 in the session's container, and the full CI run is green on the pull request's last commit. CI and the required checks came back to `main` with pull request #188 (`e5a1f62`), which this plan's branch has merged in, so branch A starts from a `main` that has them. (audit 2.5)
- A2. Every case in Task 1's `text.test.ts` passes: the request Twilio gets, the allowlist, a made-up number never texted, the error code with no number or words in it, the three answers of `changedHands`, and the Verify calls: `sendCode` cancels then starts with the code, and `codeUsed` never throws. (Verify)
- A3. The stand-in answers a send as Twilio does: a text the `Texter` sends to it is read back by `textTo`, with its words, and a code handed to `sendCode` is read back by `codeTo` (`tests/browser/twilio-stand-in.test.ts`). (Verify)
- A4. Every row of Task 2's `toE164` table passes, and every text Ruken words starts "Ruken:", is plain GSM-7 and takes at most 160 places with the longest site address in use.
- A5. Nothing a visitor can see or do changes: the diff holds only the files Tasks 1 and 2 list, no route, screen, table or required setting is added, and every existing journey passes with the stand-in started and unused.
- A6. `tests/architecture.test.ts` passes: nothing under `src/lib/` imports a feature.

**Branch B**

- B1. A person joins with a phone number, a password, a date of birth and the code from the text, and lands where they were going, on every project.
- B2. A number that already has an account gets the same screens, the same words, one `alreadyText` and no code; no code typed there signs anyone in, even at the limit. (Against the stand-in. On a real United States phone `alreadyText` does not arrive until X5: "Codes go through Twilio Verify".)
- B3. Signing in works however the number is typed (Review Focus 1), and a wrong number or password reads the same one line.
- B4. Forgot password works end to end: a person who never paid gets the code by text; a member gets it at the email they paid with; a number with no account sees the same second screen and gets nothing. After it every device is signed out, the old password fails, and the person gets `passwordChangedText` (against the stand-in; not on a real United States phone until X5).
- B5. Each state has its plain line and a next step: a wrong code, a code asked for too soon, codes paused, a closed country, under 13 (refused before any text), Twilio answering 500 to a code (the code screen still shows and "Text it again" works), no text arriving (the code screen's "No text?" line), and a sign-up whose last step fails (no account is left and it can be tried again). No screen is a dead end.
- B6. Every screen here works with the keyboard alone and focus is always visible, and the code screen works with no script.
- B7. Nobody reaches what is not theirs: every `/api/auth` path answers 404 from outside except `/ok`, `/get-session` and `/sign-out`; a phone number shows only on its owner's `/me`; and a log line holds no number and no code (a test reads the log).
- B8. Email sign-up is gone, not kept beside this: `/reset-password` answers 404, `mails.ts` and `mailed-links.test.ts` are deleted by the end of the branch, and no journey signs up or signs in by email.
- B9. The migration applies on top of `main`'s schema, `tests/lib/server/migrations.pg.test.ts` passes, and each case in Task 3's Step 1 passes.
- B10. Every journey that was on `main` passes on the new helpers. None is skipped, loosened or deleted except the test files Tasks 4 and 5 name for deletion (`mailed-links.test.ts`, `mails.test.ts`).
- B11. The visual check (`visual-check`) passes on each screen below: plain words, one blue button, the layout in its sketch, on each project.
- **Not measured by any test:** that a real text reaches a real phone. A real code is proved by hand in Task 0's Step 1a, before branch B merges. Ruken's own three texts on a real phone are reported as not measured until Step 1b, after X5. (Verify)
- **Budgets:** the spec sets none for these screens, and none is added. They are plain forms rendered on the server.

### The screens (layout sketches)

Each is the one card the account screens already use (`main.card`): one column, the same on a small phone and on a computer, where the card sits in the middle. So each has one sketch. Blue is the forward button; green is a quiet way back.

```
/sign-up, first                      /sign-up, the code
┌──────────────────────────┐         ┌──────────────────────────┐
│ Join Ruken               │         │ We texted you a code     │
│ Country                  │         │                          │
│ [ United States (+1) ▾ ] │         │ The code we texted you   │
│ Phone number             │         │ [ 123456               ] │
│ [ 312 555 0142         ] │         │ (a problem shows here)   │
│ Password                 │         │                          │
│ [ ••••••••••           ] │         │ [     Join Ruken     ]   │ blue
│ Date of birth            │         │ [   Text it again    ]   │ green
│ [ MM ][ DD ][ YYYY ]     │         │ [ Change the number  ]   │ green
│ We'll text you a code to │         │ No text? Check the       │
│ check it's you, and      │         │ number, or sign in if    │
│ texts about your account.│         │ you already have an      │
│ Message and data rates   │         │ account.                 │
│ may apply. Reply STOP to │         └──────────────────────────┘
│ stop, HELP for help.     │
│ (a problem shows here)   │         /sign-in
│ [   Text me a code   ]   │ blue    ┌──────────────────────────┐
│ Already have an account? │         │ Sign in                  │
│ Sign in                  │         │ Country                  │
└──────────────────────────┘         │ [ United States (+1) ▾ ] │
                                     │ Phone number             │
/forgot-password, first              │ [ 312 555 0142         ] │
┌──────────────────────────┐         │ Password                 │
│ Forgot your password?    │         │ [ ••••••••••           ] │
│ Country                  │         │ (a problem shows here)   │
│ [ United States (+1) ▾ ] │         │ [      Sign in       ]   │ blue
│ Phone number             │         │ Forgot your password?    │
│ [ 312 555 0142         ] │         │ New here? Create an      │
│ (a problem shows here)   │         │ account                  │
│ [   Text me a code   ]   │ blue    └──────────────────────────┘
│ Back to sign in          │
└──────────────────────────┘         /forgot-password, the code
                                     ┌──────────────────────────┐
/me, the top                         │ Choose a new password    │
┌──────────────────────────┐         │ If that number has a     │
│ Your account             │         │ Ruken account, we sent a │
│ +1 312 555 0142          │         │ code. It may come by     │
│ (the membership line and │         │ text, or to the email    │
│ everything under it, as  │         │ you pay with.            │
│ on main today)           │         │ The code we sent you     │
└──────────────────────────┘         │ [ 123456               ] │
                                     │ New password             │
                                     │ [ ••••••••••           ] │
                                     │ Type it again            │
                                     │ [ ••••••••••           ] │
                                     │ (a problem shows here)   │
                                     │ [ Save my new password ] │ blue
                                     │ [   Text it again    ]   │ green
                                     │ Back to sign in          │
                                     └──────────────────────────┘
```

Three differences from the spec's drawing, each with its reason: the code screen's "No text?" line, which is new with Verify ("Codes go through Twilio Verify") and is shown to everyone; "Country" is its own labelled field above the number, where the spec draws the code and the number on one row, so that a screen reader hears what the list is and the country's name fits on a small phone; and forgot password has a "Country" field too, which the task did not say, because the number is read the same way on all three screens (audit 14).

## Global Constraints

- Tests run where the rules say (`release`, "Where tests run"): the quick, targeted ones in the session's own cloud container before a push (`pnpm test`, `pnpm test:pg`, the journeys that the change reaches), and the full suite in CI, which is the merge gate (`gate` and `commit-authors` are the required checks; `verify`, `postgres` and `browser` are the jobs `gate` sums up). Nothing runs on the Owner's computer. (This replaces "No session runs tests", which the old workflow rules asked for.)
- No new package. Twilio is called with plain `fetch`; phone numbers are handled by the small rules in Task 2, not a library.
- Every text Ruken words starts with "Ruken:" (the code text is Twilio Verify's own words and does not; "This slice", "Codes go through Twilio Verify"), fits in one text (160 GSM-7 places, or 70 characters when it holds anything outside GSM-7; `fitText`, audit 13), holds one link at most, and passes the drunk-grandma test. The words are in "The words of every text" and are tested letter for letter.
- A log never holds a phone number or a code. A failed send, of a text or of a code, is logged as `TWILIO <status> <Twilio's code>` and nothing else.
- A phone number is never shown to a maker, another player or staff. Only its owner sees it, on `/me`.
- Nobody is texted without a yes or after STOP, and never twice: every notice goes through `tellByText` or `tellByNews` (Tasks 6 and 9), never straight to the `Texter`.
- Time comes from the injected clock. Quiet hours are worked out with Temporal from a time zone name.
- Buttons: the forward action blue; Back, Cancel and "Text it again" green; nothing here is red.
- The form never tells a stranger whether a number has an account: the same screen, the same words and the same timing either way. Texts are sent after the answer (`runAfterAnswer`), as mails are today.
- Tests use `TEXT_ALLOWLIST` or the stand-in. No test, journey or seeded account can text a real phone.
- Secrets are the Owner's, typed into Cloudflare. None is written in the repository or in chat.

## What Twilio's pages say

Read on 2026-11-15; the three Verify rows on 2026-11-17. The build session reads each again before Task 1 (Step 0) and stops if one differs.

| What | From which page | What it says |
|---|---|---|
| Sending | `docs/messaging/api/message-resource` | `POST https://api.twilio.com/2010-04-01/Accounts/{AccountSid}/Messages.json`, form-encoded: `To`, `Body`, and `MessagingServiceSid` (or `From`); optional `StatusCallback`. HTTP Basic sign-in with an API key and its secret. The answer's `sid` is the message's id. |
| A delivery report | the same page | Twilio posts `MessageSid`, `MessageStatus` and, for `failed` or `undelivered`, `ErrorCode` to the `StatusCallback` address. |
| A text in | `docs/messaging/guides/webhook-request` | Form-encoded: `MessageSid`, `MessagingServiceSid`, `From`, `To`, `Body` (up to 1600 characters). |
| The signature | `docs/usage/webhooks/webhooks-security` | Header `X-Twilio-Signature`: HMAC-SHA1, keyed with the account's **auth token** (not the API key), over the webhook's full address followed by every form field's name and value, sorted by name, then base64. |
| STOP, START, HELP | `docs/messaging/tutorials/advanced-opt-out` | Custom words for the replies need "Advanced Opt-Out" on a **Messaging Service**. Once on, it covers every number in that service. A STOP puts the number on a block list; later sends fail with error 21610. START and UNSTOP undo it. Twilio's post to the webhook then carries `OptOutType` = `STOP`, `START` or `HELP`, and Twilio has already sent the reply. **US toll-free numbers ignore the custom STOP reply** (the carrier sends its own). |
| A number that changed hands | `docs/lookup/v2-api/reassigned-number` | `GET https://lookups.twilio.com/v2/PhoneNumbers/{number}?Fields=reassigned_number&LastVerifiedDate=YYYYMMDD`. Answers `reassigned_number.is_number_reassigned`: `yes`, `no` or `no_data_available`. **US numbers only.** Needs its own carrier registration and approval. Updated monthly. |
| Each country | `en-us/guidelines/<iso>/sms` | `2026-11-15-texts-countries.md`. |
| Sending a code (Verify) | `docs/verify/api/verification` | `POST https://verify.twilio.com/v2/Services/{ServiceSid}/Verifications`, form-encoded; `To` and `Channel` are required (`sms`); `CustomCode`: "A pre-generated code to use for verification. The code can be between 4 and 10 characters, inclusive." The page's samples sign in with an API key and its secret. A verification lasts 10 minutes. The answer's `sid` starts `VE`. |
| Closing a verification (Verify) | the same page, and `docs/verify/api/customization-options` | `POST …/Verifications/{Sid}` with `Status`: "Mark the verification as `approved` after your application had validated the verification code", or `canceled` "to start a new verification session with a different code". A sample titled "Manually Approve Verification using Phone Number" puts the number where `{Sid}` goes. With custom codes: "you must also provide feedback that lets us know whether or not the user verified the code." |
| The Verify service | `docs/verify/api/service`, errors 60202 to 60204 | `FriendlyName` is "The name that appears in the body of your verification messages" (30 characters at most on one line of the page, 32 on another); `CodeLength`; `CustomCodeEnabled`; `DoNotShareWarningEnabled`: "Whether to add a security warning at the end of an SMS verification body. Disabled by default". 60203: more than 5 sends in one verification. 60204: "Service does not support this feature". 60202 (5 checks) cannot happen: Ruken never asks Verify to check. **Not on these pages:** the default template's exact words, the price, and what a second verification with a different code does while one is open. |

**What follows from it, and is built that way:**

1. **Two Messaging Services, one number each**, "Ruken account" and "Ruken news", each with Advanced Opt-Out on and the spec's own reply words. STOP to one then blocks only that service. That is how the two-number rule is kept.
2. **Whether STOP also stops codes** (the spec's question): yes, as first planned: a STOP to the account number blocks everything from that service. **With Verify (2026-11-17) codes no longer come from that service, so this no longer holds for codes.** Nothing in branches A or B rests on it; the plan session that brings branch C up to date rewrites this point, Review Focus 3 and Task 7's part of it.
3. **Not confirmed from a page:** that a STOP on one Messaging Service leaves the other service's texts flowing on the same Twilio account. The tutorial says later sends "from your account" fail. Task 1's Step 0 proves it with the Owner's two real numbers and one real phone before anything else is built. If STOP on one silences both, stop and report: the two numbers then need two Twilio accounts, which is the Owner's call.
4. **The numbers in the United States must be ordinary local numbers** (registered with the carriers), not toll-free, or the spec's STOP words never show.
5. **The changed-hands check works for US numbers only**, and only once Twilio approves its use. Everywhere else the answer is "cannot say". The rule in Task 5 treats it so.
6. **Twilio does not resend a webhook that answered 500 unless asked to** (`docs/usage/webhooks/webhooks-connection-overrides`: the retry policy `rp` defaults to `ct`, a failed connection only, and the retry count `rc` to 1). So both of Ruken's webhook addresses, the services' incoming address (X3) and `statusCallback`, end `#rc=3&rp=5xx,ct,rt`. Task 1's Step 0 reads whether the signature covers the part after `#`; the stand-in signs the same way. (audit 2)
7. **A new Twilio account texts only its home country** (`docs/messaging/guides/sms-geo-permissions`). Each other country is turned on in Twilio's Geo Permissions when it opens, and Twilio advises leaving off the rest. (audit 10)
8. **A send to someone who opted out fails with error 21610 ("opted out of receiving messages from your Twilio phone number, Channels sender, or Messaging Service"), and Twilio's pages do not agree on when.** *Step 0, 2026-11-16:* `docs/messaging/tutorials/advanced-opt-out` says "Any subsequent outgoing messages from your account to this user will fail with Error Code 21610 asynchronously", in the delivery report; Twilio's 21610 error page (`docs/api/errors/21610`) does not say whether the API refuses the send at once or accepts it and fails later, and does not separate a Messaging Service from a `From` number. So both are built, and either records the STOP Ruken had not yet heard of: a thrown `TextError` 21610 (Task 6) and a delivery report whose `ErrorCode` is 21610 (Task 7). A notice lost that way still waits on `/me` (Tasks 6 and 7). Task 0 Step 1 records which one Twilio does. (audit 3, audit round 4)
9. **Replying needs a number of the person's own country** (the country table). With two US numbers, only people in the US and Canada can reply STOP or HELP. Canada shares the US numbering plan; that a Canadian phone can text a US number is expected and not yet proved. (audit 11)
10. **Codes go out through Verify, with Ruken's own code** (the three Verify rows; "This slice", "Codes go through Twilio Verify"). `sendCode` cancels the number's open verification, then starts one with `CustomCode`; `codeUsed` marks it `approved`. Ruken's two Messaging Services carry everything that is not a code. (Verify)

## The Calls in this plan

- **The email column stays, as a stand-in.** better-auth's `User.email` cannot be empty. Every account gets `<random id>@phone.ruken.invalid` there: never shown, never mailed (`.invalid` can never be a real address, RFC 2606; from branch B on nothing mails this column at all, and branch D makes the mailer refuse such an address outright). The real, optional address for legal papers is a new column, `paperEmail`. This is how "the email address becomes optional" is met without changing the library's table.
- **Sign-up keeps the password between its two screens in the database**, hashed, for ten minutes (`PendingSignUp`), keyed by a keyed hash of the number and a keyed hash of a value only the browser that started it holds (audit 2.1). Nothing readable is kept for a number that never finishes.
- **A code never signs anyone in to an account that exists.** The plugin's `verify` would sign in whoever holds the code. So the public `/api/auth/phone-number/*` routes are refused, and Ruken's own form calls `verify` only when no account has that number. A code alone can therefore never open an account whose number changed hands.
- **Forgot password is two screens:** the number, then one screen with the code, the new password and the password again. The library checks the code and saves the password in one step; splitting them would mean holding a checked code open.
- **"Text it again" after 30 seconds** is shown by a small script; with no script the button is always there and the server refuses a second code inside 30 seconds with "Give it a few seconds, then try again."
- **Codes are stored readable, for ten minutes.** The plugin keeps each code as plain text in `Verification.value` and has no option to hash it, where today's reset token is kept only as its hash. A code lasts ten minutes and allows three tries. Worth the Owner's eye. (audit 7)
- **A code is carried by Twilio Verify and made and checked by better-auth** ("This slice", "Codes go through Twilio Verify"). Verify is never asked whether a code is right. (Verify)
- **A number that has an account gets `alreadyText` from inside the plugin's `sendOTP`**, and no code, not from a separate path in the form. Both cases then call `/phone-number/send-otp`, so they count against the same limits, write the same row and take the same time. (audit 6)
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

Commands are for the Owner to paste into iTerm2; nothing else runs on the Owner's computer. A step goes to a website only where no command can do it, and says so. The coordinator hands the Owner X1 to X4 as one batch. Branches A and B are built against the stand-in, so none of it holds the build back; X1, the Verify command at the end of X2 and Step 1a are worth asking for early, because Step 1a is the proof that custom codes work on the Owner's account. (Verify)

The `twilio` commands in X2 and X4 were checked against twilio-cli's own `--help` by the setup check on 2026-11-17 (this plan session did not run them). The Verify commands in X2 and Step 1a were checked the same way in the plan session on 2026-11-17: their flags are in twilio-cli's `--help`; none was run against Twilio. Task 0's Step 0 checks them once more before the Owner is handed anything new.

- **X1. The Twilio account** (a website: upgrade the account from a trial and add billing; a trial account cannot make Messaging Services). Then install the tool once: `brew tap twilio/brew && brew install twilio` and sign it in: `twilio login`.
- **X2. Two local US numbers and two Messaging Services.** Find numbers that take texts: `twilio api:core:available-phone-numbers:local:list --country-code US --sms-enabled --limit 5 --properties phoneNumber`. Buy two ordinary local ones: `twilio api:core:incoming-phone-numbers:local:create --phone-number +1XXXXXXXXXX`, twice; each prints an id starting `PN`. Make the services: `twilio api:messaging:v1:services:create --friendly-name "Ruken account"` and the same with `"Ruken news"`; each prints an id starting `MG`. Put one number in each: `twilio api:messaging:v1:services:phone-numbers:create --service-sid MG… --phone-number-sid PN…`. (`twilio phone-numbers:buy:local`, which this plan first named, does not exist.) Turn on Canada in Twilio's SMS Geo Permissions (a website; the US is on already). Turn on SMS Pumping Protection under Communications > Messaging > Settings (a website; no command): a sign-up that texts a code to any typed number is what it guards against (Step 0). (audit 10) **The Verify service, which sends the codes:** `twilio api:verify:v2:services:create --friendly-name Ruken --code-length 6 --custom-code-enabled --do-not-share-warning-enabled`; it prints an id starting `VA`. The name is what the code text calls Ruken. It needs X1 only, not the two numbers. (Verify)
- **X3. The reply words** (a website: Twilio's Console has no command for Advanced Opt-Out). For each service turn Advanced Opt-Out on and paste the STOP, START and HELP replies from "The words of every text". **Branch C adds:** each service's incoming address, `<site>/webhooks/twilio#rc=3&rp=5xx,ct,rt`, so Twilio sends a post again after a 500 (audit 2). The address does not exist until branch C builds it, so it is not set in this slice; the command for it is checked when C's turn comes.
- **X4. The Worker's settings**, each with `npx -y wrangler@4.156.0 secret put NAME --name ruken`: `TWILIO_ACCOUNT_SID`, `TWILIO_API_KEY`, `TWILIO_API_SECRET` (`twilio api:core:keys:create --friendly-name ruken` prints both), `TWILIO_ACCOUNT_SERVICE`, `TWILIO_NEWS_SERVICE`, `TWILIO_VERIFY_SERVICE` (the `VA…` id from X2; Verify), and `TEXT_ALLOWLIST` with the Owner's and the testers' own numbers. `TWILIO_AUTH_TOKEN` is read from branch C on; setting it now does no harm. **Branch B does not merge before these are set and Step 1a has passed** ("This slice", 2). The test copy gets its own set (the apps' test-copy plan, amended).
- **X5. After the LLC and its tax number:** registering Ruken's name and both numbers with the US carriers (a website: Twilio's Console walks through it). Launch waits for this (Owner: "Launch waits for the carriers"). The privacy and terms pages must be public first, with the lines in "Notes for the plans that follow", and so must `/help`, which the HELP reply names (audit 20).
- **X6. After X5:** ask Twilio to turn on the changed-hands check (a website). Until then Task 5 treats every number as "cannot say".
- **X7. Each country the Owner wants open on the first day:** it must be one of the 43 where two-way is "Yes" (the Owner's answer to Question 1). Turn it on in Twilio's SMS Geo Permissions (a website), buy two numbers of that country that can take replies and add one to each Messaging Service, and register where the table says so. Some of these cost money. (audits 10, 12)
- **X8. Once branch B is on the test site (and again on the real site at launch):** the Owner signs up again with their phone, then the first-owner command with their number in place of the email (the build session writes the exact command into the pull request). The accounts made by email cannot be signed in to any more; no real person has one.

## How a task runs

Write the failing test, run it in the session's own container and check that it fails for the right reason; write the code; run the checks that touch it (`pnpm test`, `pnpm test:pg` with a local Postgres, the journeys the change reaches); then push. The pull request is a draft, and a draft's quick run is not the gate: the full run starts when the pull request is marked ready, after the reviews its lane calls for (`release`). The session watches each run until it ends.

Tick each step in this plan as it is done, and keep the session's live state in `docs/superpowers/live/<branch>.md` as `CLAUDE.md` says. The coordinator keeps `progress.md`. Report to the coordinator at each milestone with the commit and anything surprising. A stop rule, a third failed try, or a step that needs the Owner: stop that task and report.

Where a step below says "Push. Expected: `verify` fails" (or `postgres`, or `browser`), read it as: that kind of test fails for the right reason, seen first in the session's container and then in CI. The three names are still CI's jobs.

## Branches

Each is small enough to review in one sitting, merges before the next starts, and leaves `main` green.

| Branch | Tasks | Lane | Needs | What | In this slice |
|---|---|---|---|---|---|
| A `texts/port` | 0 (Step 0), 1, 2 | 2 | nothing from the Owner | the `Texter`, the stand-in, the number rules | yes |
| B `texts/sign-in` | 3, 4, 5 | 3 | A on `main`; X1 to X4 and Step 1a before it merges | the tables; sign-up, sign-in, forgot password; email sign-up removed | yes |
| (no branch) | 0 (Step 1a) | 3 | X1 and the Verify service | a real code on the Owner's phone | yes, before B merges |
| (no branch) | 0 (Step 1b) | 3 | X1 to X5, B built | the proof of the two numbers with a real phone | when X5 is done |
| C `texts/notices` | 6, 7, 8 | not set yet | B | one text a notice, once; texts in, STOP and START; what a person sees while texts are off; changing the number | waits |
| D `texts/yes` | 9, 10 | not set yet | C | the yes to news texts, quiet hours, the legal email | waits |
| E `texts/countries` | 11 | not set yet | B | which countries are open, and their words | waits |

The branch names are labels; a session uses the branch name its own prompt gives it.

## File map

```
src/lib/server/
  text.ts                 Texter (send, sendCode, codeUsed, changedHands), TextMessage,
                          createTwilioTexter, TextError, textFailureCode, isMadeUpNumber              (A)
  twilio-signature.ts     twilioSignatureOf, isFromTwilio                                             (C)
  mail.ts                 refuses an `.invalid` address                                               (D)
src/features/accounts/
  phone.ts                toE164, hashNumber; re-exports isMadeUpNumber                               (A)
  text-words.ts           every text's words, and fitText                                             (A, C)
  pending-sign-up.ts      keepPending, takePending, one row a browser                                 (B)
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
  paper.ts                setPaperEmail (B), sendPaper (D)                                            (B, D)
  countries.ts, library/countries.json   openCountries, countryOf                                    (E)
  mails.ts                cut down in Task 4, deleted in Task 5                                       (B)
  deletion.ts, staff.ts, services.ts, accounts.ts   amended                                          (B, C, D)
src/features/membership/   createCustomer takes no email; the paid-with email is kept; hasBillingCustomer  (B)
src/features/money/        hasBeenPaid                                                                 (B)
src/features/games/service.ts   waitingGames no longer answers makerEmail                             (B)
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

**The code text is not here.** A sign-up code and a reset code are both sent by Twilio Verify in Twilio's own words, with the service's name, "Ruken", in them ("This slice", "Codes go through Twilio Verify"). `codeText` and `resetCodeText`, which this table held, are not built. (Verify)

| Function | Words |
|---|---|
| `alreadyText(site)` | `Ruken: you already have a Ruken account. Sign in, or reset your password: <site>/sign-in` |
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
3. A person who texted STOP to the account number then asks for a code: no text is tried, and the screen says how to turn texts back on (Task 7). (Written before Verify; branch C's plan session rewrites it, since codes no longer come from the account number.)
4. The same notice asked for twice at once, or again after a retry: one text (Task 6).
5. A post to the webhook with a wrong signature, with a right signature sent twice, or with a `From` no account has: nothing wrong is stored, nothing is stored twice, and nothing throws (Task 7).
6. Twilio answers 500 or times out during sign-up: the person still sees the code screen, "Text it again" works, and the log holds Twilio's error code and no number or sign-in code (Tasks 1, 4).
7. A person whose yes was said at 19:59 their time and whose text is due at 03:00: it waits for 9:00 their time, in their zone and across a clock change (Task 9).

---

# Branch A: `texts/port`

### Task 0: Read first, and prove the two numbers

- [x] **Step 0:** read again the Twilio pages in "What Twilio's pages say" and better-auth 1.7.7's `dist/plugins/phone-number/routes.mjs` in `node_modules`. Also read: whether Twilio's signature covers the part of the address after `#` (point 6), and Twilio's page on SMS pumping protection, reporting whether it applies to a Messaging Service (audit 10). Also read, for Verify: the three Verify pages again; Verify's price page (report the price of one verification to the coordinator); where Verify's Geo Permissions are set and whether Canada is on; whether Fraud Guard acts on a verification with a custom code; and twilio-cli's `--help` for the Verify commands in X2 and Step 1a. Any difference from this plan: stop and report.
  *Read once, in the first attempt, on 2026-11-16 (the build session reads it again and corrects this line):* the `#…` part is **not** signed (`docs/usage/webhooks/webhooks-connection-overrides`: "omit the fragment"); Twilio's worked example reproduces (`L/OH5YylLD5NRKLltdqwSvS0BnU=`); signature order is byte order. SMS Pumping Protection (`docs/messaging/features/sms-pumping-protection-programmable-messaging`, modified 2026-09-25) is an **account-wide** setting, turned on in the Console under Communications > Messaging > Settings, free for the United States and Canada, and a blocked text shows error 30450. The page does not mention Messaging Services, so it is taken to cover them (they are Programmable Messaging); X2 turns it on. The one difference from the plan is point 8 (21610 timing), written there.
  *Read again 2026-11-17 for branch A (Verify, API and CLI pages; nothing differs from this plan except as noted):* `CustomCode` is 4 to 10 characters, and the Service needs "Enable Custom Verification Code" turned on in the Console (`CustomCodeEnabled`); with a custom code the app must give feedback (approve), as `codeUsed` does; the number goes where `{Sid}` goes in the update. Auth in the samples is an API key and secret. Price: US $0.05 per successful verification plus about $0.0083 for the SMS; failed or expired verifications do not pay the $0.05; Canada's price is not on the page. Geo Permissions: Console > Verify > Settings > Geo permissions; whether Canada is on by default is not on the page, so X-steps must check it. Fraud Guard supports custom codes (Standard or Max). The part of a webhook address after `#` is not signed. SMS Pumping Protection is account-wide; the page does not mention Messaging Services. The twilio-cli pages read do not list the `verifications:create` and `update` flags; they are checked with `--help` when the Owner runs Step 1a.
- [ ] **Step 1a (with the Owner, as soon as X1 and X2's Verify command are done; needs one real phone; branch B does not merge before it; Verify):** the Owner asks for a code with their own number, `twilio api:verify:v2:services:verifications:create --service-sid VA… --to +1… --channel sms --custom-code 123456`. Expected: a text arrives holding 123456. Then a second code, as the `Texter` will send it: `twilio api:verify:v2:services:verifications:update --service-sid VA… --sid +1… --status canceled`, then the create command again with `--custom-code 654321`. Expected: a second text holding 654321. Then `twilio api:verify:v2:services:verifications:update --service-sid VA… --sid +1… --status approved`. Expected: it answers with the status `approved`. Record under this step the exact words of each text, each command's status, and any error code. If a command answers 60204, or the second text holds the first code, or the number is refused where the id goes: stop and report ("Codes go through Twilio Verify", the first risk).
- [ ] **Step 1b (with the Owner, after X1 to X5 and after branch B is built; needs one real phone):** from the Owner's phone text STOP to the news number. Then send one text from each service to that phone with `twilio api:core:messages:create --messaging-service-sid MG… --to +1… --body "Ruken: test"`. Expected: the account one arrives; the news one fails with 21610: record whether the API refused it at once (HTTP 400) or accepted it and later reported `failed` with 21610 (read it again with `twilio api:core:messages:fetch --sid SM…`), point 8. Then START, and both arrive. Record the four message ids and their statuses under this step. If the account text is also blocked, stop and report (point 3 under "What follows from it"). Without a Canadian phone, record that a reply from Canada is still unproven (point 9).

Step 1a is cheap and early: it needs the upgraded account and one command's worth of setup, and it is the only proof that custom codes work on the Owner's account. Step 1b needs the two numbers to be allowed to text a United States phone, which is X5, so it is no longer in this slice's way: it decides how branch C is set up (if STOP on one service silences both, the two numbers need two Twilio accounts, and the `Texter`'s options change then). If it is tried before X5 and the texts do not arrive, record Twilio's error code for each and report; the step stays open.

### Task 1: The `Texter`

**Files:**
- Create: `src/lib/server/text.ts`, `tests/support/capture-texter.ts`, `tests/browser/support/fake-twilio-server.ts`, `tests/browser/support/texts.ts`
- Modify: `playwright.config.ts` (starts the stand-in on port 12114, beside the three that are there; the Worker's Twilio settings are added in Task 4)
- Test: `tests/lib/server/text.test.ts`, `tests/browser/twilio-stand-in.test.ts`
- Moved to branch C (Task 7), with the webhook that is its only user: `src/lib/server/twilio-signature.ts` and its test, the stand-in's `POST /test/inbound`, and `textIn`. Nothing is built ahead of its user.

**Interfaces (produces):**

```ts
export type TextLine = "account" | "news";
export interface TextMessage { to: string; line: TextLine; body: string }
export type TextResult = { sent: true; providerId: string } | { sent: false; why: "allowlist" | "made_up" };
export interface Texter {
  send(message: TextMessage): Promise<TextResult>;
  /** Texts a sign-in code through Twilio Verify. The code is ours: better-auth made it and will check it. */
  sendCode(number: string, code: string): Promise<TextResult>;
  /** Tells Verify the number's code was used. Never throws. */
  codeUsed(number: string): Promise<void>;
  /** Whether the number changed hands since that day, where Twilio can say. */
  changedHands(number: string, since: Date): Promise<"yes" | "no" | "cannot_say">;
}
export interface TwilioTexterOptions {
  accountSid: string; apiKey: string; apiSecret: string;
  services: Record<TextLine, string>;           // the two MG… ids
  verifyService: string;                         // the VA… id (Verify)
  statusCallback?: string;                       // <site>/webhooks/twilio; set from branch C on, when that address exists
  allowlist: string | undefined;                 // TEXT_ALLOWLIST: comma-separated numbers
  apiBase?: string; lookupBase?: string; verifyBase?: string;   // stand-ins only
  fetch?: typeof fetch;
  log?: (line: string) => void;                  // codeUsed's failures, as textFailureCode
}
export function createTwilioTexter(options: TwilioTexterOptions): Texter;
export class TextError extends Error { readonly code = "TWILIO"; readonly responseCode: number; readonly twilioCode: number | null }
export function textFailureCode(error: unknown): string;   // "TWILIO 400 21610", never the message
export function isMadeUpNumber(number: string): boolean;   // here, not in a feature: src/lib/ imports no feature
```

- `send`: a made-up number (`isMadeUpNumber`: true for `/^\+1\d{3}55501\d\d$/`) answers `made_up` before anything else; with an allowlist set, a number not on it answers `allowlist`; else the POST from "What Twilio's pages say" with `To`, `Body`, `MessagingServiceSid` and, when one is set, `StatusCallback`; `Authorization: Basic base64(apiKey:apiSecret)`. A non-2xx answer throws `TextError` with the status and the `code` from Twilio's JSON body (null when there is none). `fetch` is kept in a constant and called as a plain function, as `mail.ts` does.
- `sendCode` (Verify): the same two guards as `send`, in the same order (`made_up`, then `allowlist`), before any request. Then two requests to `https://verify.twilio.com/v2/Services/<verifyService>` (or `verifyBase`), with the same `Authorization` as `send`: first `POST /Verifications/<number>` with `Status=canceled`, the number percent-encoded in the path, where a 404 is expected and ignored (no verification is open) and any other non-2xx throws `TextError`; then `POST /Verifications` with `To`, `Channel=sms` and `CustomCode`. A non-2xx answer throws `TextError` as `send` does. The answer is `{ sent: true, providerId }` with the verification's `sid`. The code is in no log line and no error.
- `codeUsed` (Verify): `POST /Verifications/<number>` with `Status=approved`. A made-up number or one off the allowlist: no request. A 404 is nothing (no verification is open: the code went by email, or it had run out). Any other failure is handed to `log` as `textFailureCode` and swallowed. It never throws.
- `changedHands`: a number that does not start `+1`: `cannot_say`, with no request. Else the GET above with `LastVerifiedDate` as the UTC day of `since`; `yes` and `no` pass through; `no_data_available`, a missing field, a non-2xx answer or a thrown `fetch`: `cannot_say`. It never throws.
- `createCaptureTexter(): Texter & { sent: TextMessage[]; hands: Map<string, "yes" | "no" | "cannot_say"> }`: keeps what it was given, answers `{ sent: true, providerId: "SM-test-<n>" }`, and answers `changedHands` from `hands` (default `cannot_say`); it also keeps `codes: { to: string; code: string }[]` from `sendCode` (answering `providerId: "VE-test-<n>"`) and `used: string[]` from `codeUsed`.
- The stand-in (`fake-twilio-server.ts`, modelled on `fake-mail-server.ts`): `POST /2010-04-01/Accounts/:sid/Messages.json` keeps the text and answers `{ sid }`; `GET /texts?to=` lists them; `GET /v2/PhoneNumbers/:number` answers from `POST /test/hands`; `POST /test/fail` with `{ to }` makes the next send to that number, of a text or of a code, answer 500, so one journey cannot trip another (Review Focus 6); `GET /ready`. For Verify: `POST /v2/Services/:service/Verifications` keeps `{ to, code, status: "pending" }` and answers `{ sid, status }`, answering 400 with Twilio's code 60200 when `CustomCode` is missing (the stand-in sends no code of its own, so a `Texter` that forgot the code fails loudly); `POST /v2/Services/:service/Verifications/:to` sets the open one's status and answers 404 with code 20404 when none is open; `GET /codes?to=` lists them with their statuses. `texts.ts`: `textTo(number, starts: string)` (waits with `expect.poll`, never a pause), `countTextsTo`, `codeTo(number)` (the newest pending code for the number, waited for the same way) and `countCodesTo`. `codeIn(text)`, which read a code out of Ruken's own words, is not built. (Verify)
- `services.ts` and `AuthServices.texter`: **moved to Task 4** (built there, where the `Texter` has its first user). Branch A leaves `services.ts` alone.

- [x] **Step 1 (red):** `text.test.ts`, with a stubbed `fetch`:

```ts
it("posts the text to Twilio's Messages address with the line's service", async () => {
  const result = await texter.send({ to: "+13125551234", line: "news", body: "Ruken: hi" });   // not 555 01xx: that is a made-up number
  expect(calls[0].url).toBe("https://api.twilio.com/2010-04-01/Accounts/AC1/Messages.json");
  expect(Object.fromEntries(new URLSearchParams(calls[0].body))).toEqual({
    To: "+13125551234", Body: "Ruken: hi", MessagingServiceSid: "MG-news" });
  expect(calls[0].headers.authorization).toBe(`Basic ${btoa("SK1:secret")}`);
  expect(result).toEqual({ sent: true, providerId: "SM123" });
});
it("adds StatusCallback only when one is set", async () => { /* with statusCallback: the field is there; without: it is not */ });
it("texts only the allowlist when one is set", async () => { /* off the list: { sent: false, why: "allowlist" }, no call */ });
it("never texts a made-up number, allowlist or not", async () => { /* +12125550123: why "made_up", no call */ });
it("throws a TextError with the status and Twilio's code", async () => { /* 400 {"code":21610}: textFailureCode → "TWILIO 400 21610" */ });
it("logs nothing of the number or the body", () => { /* textFailureCode(new Error("to +13125550142 failed")) === "unknown error" */ });
it("sends a code through Verify: cancels the open one, then starts one with our code", async () => {   // Verify
  const result = await texter.sendCode("+13125551234", "482913");
  expect(calls.map((c) => c.url)).toEqual([
    "https://verify.twilio.com/v2/Services/VA1/Verifications/%2B13125551234",
    "https://verify.twilio.com/v2/Services/VA1/Verifications" ]);
  expect(Object.fromEntries(new URLSearchParams(calls[0].body))).toEqual({ Status: "canceled" });
  expect(Object.fromEntries(new URLSearchParams(calls[1].body))).toEqual({ To: "+13125551234", Channel: "sms", CustomCode: "482913" });
  expect(result).toEqual({ sent: true, providerId: "VE123" });
});
it("sends the code when nothing was open to cancel (404), and throws when the cancel fails any other way", async () => {});
it("never sends a code to a made-up number or one off the allowlist", async () => { /* no call at all */ });
it("throws a TextError when Verify refuses, with no code in it", async () => { /* 429 {"code":60203} → "TWILIO 429 60203" */ });
it("marks a code used, and never throws", async () => { /* Status=approved; a 404, a 500 and a thrown fetch all resolve; the 500 is logged by its code */ });
it("asks whether a US number changed hands, with the day", async () => { /* URL ends ?Fields=reassigned_number&LastVerifiedDate=20261101 */ });
it("cannot say for a number outside +1, with no request", async () => {});
it("cannot say when Twilio has no data, answers 500, or the request throws", async () => {});
```

  `twilio-stand-in.test.ts` (a journey with no page): a `Texter` made with `apiBase` at the stand-in sends one text, and `textTo` reads it back with its words; it hands over one code with `sendCode`, and `codeTo` reads it back; a second `sendCode` leaves the first canceled and `codeTo` answers the second; `codeUsed` leaves it approved (`verifyBase` at the stand-in too). Stubs. Push. Expected: the unit tests fail in `text.test.ts` with "not built yet", and the stand-in's journey fails because nothing answers on port 12114.
- [x] **Step 2 (green):** the code, the stand-in and the config. Push. Expected: all pass; the journeys still pass with the new stand-in started and unused.

  Three things the first attempt found, kept here so they are not found again: the Twilio settings are not read in this task (Task 4 reads them, where the `Texter` gets its first user, so the test site keeps running on `main` between branch A and branch B); `isMadeUpNumber` lives in this file; and the spec's sample number `+1 312 555 0142` is itself a made-up number, so only the made-up-number test uses one like it.

### Task 2: A phone number, written one way

**Files:**
- Create: `src/features/accounts/phone.ts`, `src/features/accounts/text-words.ts`
- Test: `tests/features/accounts/phone.test.ts`, `text-words.test.ts`

**Interfaces (produces):**
- `toE164(dialingCode: string, typed: string): string | null`. Spaces, dashes, dots and brackets are dropped. Typed text starting `+` or `00`, or `011` when the picked code is `+1` (the North American prefix; under `+44` it starts Leeds's 0113): what follows is the whole number. Otherwise leading zeros are dropped, under `+1` one leading `1` is dropped, and the dialing code's digits go in front. (audit 14) The answer is `+` and 8 to 15 digits, or null.
- `hashNumber(number: string, secret: string): string`: HMAC-SHA-256 of `phone:<E.164>` under `BETTER_AUTH_SECRET`, in hex. Used wherever a number that may have no account is kept (limits, the pause, a pending sign-up, STOP).
- `isMadeUpNumber`: re-exported from `src/lib/server/text.ts` (Task 1), so the feature's own code and tests import it from here.
- `text-words.ts`: the functions, constants and `fitText` of "The words of every text" that branches A and B use (`alreadyText`, `passwordChangedText`, `signInPausedText`). The code text is Verify's and has no function here. (Verify)

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

  `text-words.test.ts`: each function's whole text; every one starts `Ruken:`, is plain GSM-7 (straight apostrophes only), takes at most 160 GSM-7 places with `https://ruken.io` as the site, and holds at most one `http`; `fitText("Ruken: ", "W".repeat(200), " is out. Play it now: https://ruken.io/g/x")` is exactly 160 long, ends with the whole link and holds `...`; the same with a name holding one emoji is at most 70 long; a name holding `€` counts it as two places. Every case also runs with the longest site address in use (a `workers.dev` one). (audit 13) Push. Expected: `verify` fails in both.
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
| `PendingSignUp` | `numberHash String`, `browserHash String`, `passwordHash String`, `adultOn DateTime @db.Date`, `expiresAt`, `createdAt`; `@@id([numberHash, browserHash])`. One row for each browser that started a sign-up for the number. A newer try from the same browser replaces that browser's row; a try from another browser adds its own row and replaces none. (audit 2.1) |
| `SignInGuard` | the column `emailHash` is renamed `numberHash` (and its check). The rows are thrown away by the migration: they are pauses of at most an hour. |
| `TextSent` | `id`, `userId` (a `User`, `onDelete: Restrict`), `kind String`, `key String`, `line String`, `providerId String?`, `sentAt`, `createdAt`; `@@unique([userId, kind, key])`. Added and never changed (`reject_append_only_change('TextSent')`). It holds an id and no number, so it stays when the account is deleted, as `WishlistMail` was to. |

The migration is made with `prisma migrate diff` from `main`'s schema, as earlier ones were, then the checks and the trigger by hand at its end. Its folder is dated after `20261115190000_agreement_per_version`, the newest on `main`; `User` has gained two relations since this plan was written (`gameReviews`, `makerAgreements`), which this change leaves alone.

**Lane 3.** The deploy command (`pnpm deploy`) runs `prisma migrate deploy` first, so this migration reaches the test site's database when branch B merges. It adds columns that may be empty and two tables, renames one column and throws away only `SignInGuard`'s rows. Undoing it is a second migration, not a revert; the pull request says so. Accounts made by email stay in the database with no number and can no longer be signed in to (X8).

- [ ] **Step 1 (red):** a second `User` with the same `phoneNumber` rejects; `phoneNumber` `"3125550142"` rejects; two users with no number are fine; a second `TextSent` with the same person, kind and key rejects; `UPDATE` and `DELETE` on `TextSent` reject; `SignInGuard` has `numberHash` and no `emailHash`; two `PendingSignUp` rows with the same number and different browsers are fine, and a second with the same number and browser rejects (audit 2.1). Push. Expected: `postgres` fails.
- [ ] **Step 2 (green):** the schema and migration. Push. Expected: all pass.

### Task 4: Joining and signing in with a phone number

**Files:**
- Create: `src/features/accounts/pending-sign-up.ts`
- Modify: `auth.ts`, `auth-limits-plugin.ts`, `sign-in-guard.ts`, `sign-in-guards.ts`, `sign-in-pause-plugin.ts`, `forms.ts`, `services.ts`, `accounts.ts`, `staff.ts`, `deletion.ts`; `src/routes/sign-up/+page.server.ts`, `+page.svelte`, `src/routes/sign-in/+page.svelte`, `src/routes/me/+page.server.ts`, `+page.svelte`, `src/routes/jobs/first-owner/+server.ts`; `src/features/membership/service.ts`, `stripe-port.ts`, `checkout.ts` (`createCustomer` takes no email: Stripe asks for it at paying); `src/features/games/service.ts` (`waitingGames` no longer answers `makerEmail`); `playwright.config.ts` and `.env.example` (the Twilio settings)
- Delete: `tests/browser/mailed-links.test.ts` (its journeys need a sign-up by email). `mails.ts` loses the messages this task stops sending (`verificationMessage`, `passwordChangedMessage`, the sign-in pause's) and keeps `passwordResetMessage`, with its cases in `mails.test.ts`, until Task 5 deletes both files (audit 2.3).
- Test: `tests/features/accounts/auth.pg.test.ts`, `forms.test.ts`, `auth-limits-plugin.test.ts`, `services.test.ts`, `sign-in-guard.test.ts` (it tests `hashSignInEmail`, which becomes `hashNumber`; audit 2.4), `sign-in-guards.pg.test.ts`, `sign-in-pause-plugin.test.ts`, `pending-sign-up.pg.test.ts`, `staff.pg.test.ts`, `purge.pg.test.ts`; `tests/browser/sign-up.test.ts`, `sign-in.test.ts`, `auth-route.test.ts`, `first-owner.test.ts`, `me.test.ts`; `tests/browser/support/account.ts`, `database.ts`; `tests/support/create-user.ts`
- Test, added since this plan was written (each signs up by email today, or names an email screen): `tests/browser/client-address.test.ts`, `connect-github.test.ts`, `look.test.ts`, `look-layout.test.ts`, `delete-account.test.ts`, `membership.test.ts`, and three that fill the form themselves: `join.test.ts` and `pay.test.ts` ("Email", then "Create account") and `purged-account.test.ts` ("Email" on `/sign-in`, and the old wrong-password words) (audit 2.4); `tests/browser/support/look.ts` (`CARD_SCREENS`), `game.ts` (`startAtFiles` answers the maker's number), `rate-limits.ts` (its comment); `tests/features/games/review.pg.test.ts`. Every other journey (the `make-*` ones, `buttons`, `game-gate`, `money-job`) changes only through the helpers it calls; if one needs more, say so in the pull request.

**`auth.ts`:**
- `AuthOptions` gains `texter: Texter`. `mailer` stays for one mail only: a reset code sent to the email a member pays with (Task 5). Nothing mails `User.email` any more.
- Plugin: `phoneNumber({ otpLength: 6, expiresIn: 600, allowedAttempts: 3, phoneNumberValidator: (n) => /^\+[0-9]{8,15}$/.test(n), sendOTP, sendPasswordResetOTP, signUpOnVerification: { getTempEmail: () => `${randomUUID()}@phone.ruken.invalid`, getTempName: () => "Player" } })` from `better-auth/plugins`. `sendOTP` and `sendPasswordResetOTP` hand the send to `textLater` (the present `mailLater`, renamed, logging `textFailureCode`) and return at once. Inside `textLater`, `sendOTP` looks the number up: when no account has it, the code goes through Verify, `texter.sendCode(phoneNumber, code)`; when an account has it, no code is sent and the text is `alreadyText`, through `texter.send` on the account line (audit 6; Verify). Until X5 that text does not reach a real United States phone, and the code screen's "No text?" line is what the person has. For `alreadyText`, a `TextError` with Twilio's code 21610 records a stop for the number on the account line (`recordStop`, Task 7; until then only logged), so the next screen shows the START words (audit 3). Twilio may instead accept the send and report 21610 afterwards (point 8): that path is Task 7's delivery-report step, which records the same stop, so the screen shows the START words from the next ask.
- `emailAndPassword` keeps `enabled`, the two lengths, `revokeSessionsOnPasswordReset` and `onPasswordReset` (the plugin's reset calls both); `onPasswordReset` lifts the pause for `user.phoneNumber` and texts `passwordChangedText`. The whole `emailVerification` block goes. `sendResetPassword` and the `verification.storeIdentifier` override for `reset-password:` stay until Task 5: `/forgot-password` and `/reset-password` are still the email pages until then and import them, so taking them out here would fail `pnpm typecheck` on this task's push (audit 2.3). Between the two tasks those two pages still build and answer, but they can reach no account made by phone; that state is only ever on this branch.
- The `before` hook: a request that came through the public route (`PUBLIC_ROUTE_HEADER`) is answered `NOT_FOUND` unless its path is in `PUBLIC_AUTH_PATHS = ["/ok", "/get-session", "/sign-out"]`. Every form calls better-auth on the server without that header, so nothing else needs to be public, and the email routes and the plugin's `verify` cannot be reached from outside. A comment says why: `verify` signs in whoever holds a code.
- `rateLimit.customRules`: `/sign-in/phone-number` 30 a minute; `/phone-number/send-otp` 5 an hour (a client's sign-up starts, as `/sign-up/email` was); `/phone-number/request-password-reset` 10 an hour; `/phone-number/verify` and `/phone-number/reset-password` 10 per 15 minutes. The email rules go.

**The limits per number** (`auth-limits-plugin.ts`; the body's `phoneNumber` in place of `email`, keyed with `hashNumber`): `/sign-in/phone-number` 5 a minute per client and number; `/phone-number/send-otp` and `/phone-number/request-password-reset` each: 1 per 30 seconds per number (the answer's code is `CODE_TOO_SOON`), 3 per 15 minutes per client and number, 10 an hour per number. **Ten wrong codes pause codes for a number for an hour:** `WRONG_CODES = { max: 10, windowMs: 3_600_000 }`, key `api:auth:wrong-code:<hash>`; an `after` hook on `/phone-number/verify` and `/phone-number/reset-password` counts an `INVALID_OTP` or `TOO_MANY_ATTEMPTS` answer, and the `before` hooks on those two and on the two send paths refuse with code `CODES_PAUSED` once it is over. The plugin exports the two steps as functions, `countWrongCode(deps, number)` and `codesPausedFor(deps, number)`, and `finishSignUp` calls the same two around `consumePhoneNumberOTP` for a number that has an account, which never goes through `verify` (audit 2.2).

**The pause** (`sign-in-guard.ts`, `sign-in-guards.ts`, `sign-in-pause-plugin.ts`): unchanged in what it does; `hashSignInEmail` becomes `hashNumber`, the path `/sign-in/phone-number`, the body key `phoneNumber`; the notice is `signInPausedText` on the account line to the account with that number. `SIGN_IN_PAUSED_MESSAGE`: "Too many tries. Sign-in is paused for an hour for this number. You can reset your password now."

**`pending-sign-up.ts`** (audit 2.1): a sign-up is bound to the browser that started it, so a code typed in one browser finishes only that browser's sign-up. `keepPending(deps: { db; clock; secret }, input: { number: string; browser: string; passwordHash: string; adultOn: Date }): Promise<void>` (upsert on the number's hash and the browser's hash, `expiresAt` ten minutes on) and `takePending(deps, input: { number: string; browser: string }): Promise<{ passwordHash: string; adultOn: Date } | null>` (null when this browser has no row for the number, or it is expired; an expired row is deleted). `browser` is a random value (32 bytes from `crypto.getRandomValues`, base64url) that `startSignUp` makes when the browser has none and keeps in a cookie, `ruken_sign_up`, set with the site's cookie policy: `httpOnly`, `sameSite: "lax"`, `secure` as the other cookies are, path `/sign-up`, ten minutes. Only its hash is stored (`browserHash`: HMAC-SHA-256 of `sign-up:<value>` under `BETTER_AUTH_SECRET`). Why: with one row a number, a stranger who knows someone's number could start a sign-up after them, replace their kept password with the stranger's own, and have the real person's code put the stranger's password on the new account. A comment says so.

**`forms.ts`** (each still calls better-auth through `callAuth`):
- `FormFields` gains `country`, `phone`, `number`, `code`; `email` and `token` go. `AuthFormData` gains `phone`, `country`, `step?: "code"`, `number?`, `closedCountry?`.
- `startSignUp(event, deps: SignUpDeps)`, in this order: the country is open (Task 11; until then only `US` and `CA`), else `fail(400, { closedCountry: true })` and nothing is stored; `toE164` null: `phoneInvalid`; the password's length; the age, as today (`tooYoung` as today). Then `keepPending`, for this browser (its `ruken_sign_up` cookie, made now if it has none; audit 2.1), with the password hashed by better-auth's own hasher (`(await auth.$context).password.hash`) and the 18th birthday that `ageCheck` already answers (`adultOn`). Then `callAuth("/phone-number/send-otp", { phoneNumber })` whether or not an account has the number: `sendOTP` sends `alreadyText` to one that has (above), so both count against the same limits and take the same time. Either way the answer is `{ step: "code", number, next }`. (audit 6) A 429 with `CODE_TOO_SOON` reads `codeTooSoon`; with `CODES_PAUSED`, `codesPaused`.
- `finishSignUp(event, deps)`: `takePending` for this browser (its `ruken_sign_up` cookie; no cookie counts as no row). **When an account already has the number, or this browser has no row** (audits 2.1 and 2.2): `verify` is never called, but the code is still checked and used up through the plugin's server-only `auth.api.consumePhoneNumberOTP` (it has no route, so it is never public; it checks a code without making a user or a session). An `INVALID_OTP` or `TOO_MANY_ATTEMPTS` answer from it is counted under the same `api:auth:wrong-code:<hash>` key as a wrong code at `verify`, and a number over that limit is refused with `CODES_PAUSED` before the check, exactly as on the other path. Whatever the check answers, right code included, the screen reads `fail(400, { step: "code", number, error: FORM_MESSAGES.codeWrong })`, or `codesPaused` once paused. So a number with an account and a number without read the same at every try, do the same database work, and pause at the same count. **Else** `callAuth("/phone-number/verify", { phoneNumber, code })`; a 400 or 403: `codeWrong`. On success `texter.codeUsed(number)` is called after the answer (`runAfterAnswer`; Verify), and so it is on the other path when the plugin's check accepted the code. Then, in one transaction: a credential `Account` row (`providerId: "credential"`, `accountId: user.id`, the hash this browser kept), `adultOn` written as `setBirthDate` writes it today (only where it is still null), `phoneConfirmedAt` at the clock's time, and every pending row for the number deleted; the `ruken_sign_up` cookie is cleared; then `redirect(303, safeNextPath(next))`. If the transaction fails, one more transaction removes the half-made account (its `User` row and the `Session` that `verify` made), the session cookie is cleared, the pending row is kept, and the screen reads "Something went wrong. Try again." with "Text it again". Left as it was, the account would have no password and no `adultOn`, so an adult would get every under-18 default, and a second try would meet "an account has this number". A comment says so. (audit 15)
- `resendCode(event, deps)`: `send-otp` again for the number in the form, with the same answers.
- `signInWithPassword`: `toE164` then `callAuth("/sign-in/phone-number", { phoneNumber, password })`; a number that cannot be read is answered as a wrong password.
- `resendVerification` goes. `requestPasswordReset` and `resetPassword` stay until Task 5, with the two pages that call them (audit 2.3).
- `FORM_MESSAGES` changes: `wrongPassword` "That number and password don't match. Try again, or reset your password."; `phoneInvalid` "That doesn't look like a phone number. Check it and try again."; `codeWrong` "That code isn't right. Check the text, or ask for a new one."; `codeTooSoon` "Give it a few seconds, then try again."; `codesPaused` "Too many wrong codes. Codes are paused for an hour for this number."; `closedCountry` "Ruken isn't in your country yet."; `emailMissing` and `accountExists` go.

**The screens** (drawn in "This slice", "The screens"). `/sign-up`, first state: the spec's drawing, headed "Join Ruken", with "Country" as a `<select>` of the open countries (name and code) and "Phone number" as `type="tel"`, `autocomplete="tel-national"`; the note under the fields is the spec's five lines; the button "Text me a code". Second state, the same address: "We texted you a code", one field "The code we texted you" (`inputmode="numeric"`, `autocomplete="one-time-code"`), "Join Ruken" (blue), "Text it again" (green, shown after 30 seconds by a script and always without one), "Change the number" (green, back to the first state with the fields kept) and, under them, one quiet line shown whatever the number: "No text? Check the number, or sign in if you already have an account.", with "sign in" a link to `/sign-in` (Verify). `/sign-in`: "Country" (the same `<select>` as sign-up, starting on the browser's region), "Phone number" and "Password". (audit 14) `/me` shows the number in place of the email, and the "Confirm your email" block goes; the lines game submission added ("Your games", or "Make games? Add yours to Ruken.") stay as they are. Each screen keeps the way back it has today ("Already have an account? Sign in", "New here? Create an account", "Forgot your password?").

**`services.ts`** (moved here from Task 1): reads `TWILIO_ACCOUNT_SID`, `TWILIO_API_KEY`, `TWILIO_API_SECRET`, `TWILIO_ACCOUNT_SERVICE`, `TWILIO_NEWS_SERVICE`, `TWILIO_VERIFY_SERVICE` (all required; `TWILIO_AUTH_TOKEN` joins them in branch C, with the webhook), `TEXT_ALLOWLIST` (optional) and `TWILIO_API_BASE` (optional; refused unless it starts `http://127.0.0.1:`, through the existing `standInAddress`; when set it is `apiBase`, `lookupBase` and `verifyBase`, since the stand-in serves all three, audit 18); `AuthServices` gains `texter`, built with `createTwilioTexter` and no `statusCallback` (the address it would name is built in branch C); `playwright.config.ts` gives the Worker the plainly fake settings, pointing at the stand-in. `.env.example` lists them. Required settings are asked for here, not before, so `main` keeps running on the test site after branch A; branch B itself merges only once the Owner's X4 is done ("This slice", 2). Tests in `services.test.ts`: a missing setting is named at start (`Missing setting TWILIO_ACCOUNT_SID`, one case for each of the six), `TWILIO_API_BASE` is taken at `http://127.0.0.1:12114` and refused at `https://sms.example`.

**Elsewhere:** `grantFirstOwner(db, phoneNumber)` and the job's body `{ "phone": "+1…" }` with "No account has that number. Sign up on the site first."; `purgeDueAccounts` also sets `phoneNumber` and `paperEmail` to null and `phoneNumberVerified` false, deletes the `PendingSignUp` and `Verification` rows for the number (`identifier` the number, and the number followed by `-request-password-reset`); `createUser` (tests) gives each person a made-up number and a stand-in address ending `@phone.ruken.invalid`; `waitingGames()` (`src/features/games/service.ts`) stops answering `makerEmail`, which would now be that stand-in, and its test in `review.pg.test.ts` checks the list without it (nothing shows the list yet; "This slice", 6); `signUpsCountedFrom` (`database.ts`) reads the counter kept under `/phone-number/send-otp`, where it read `/sign-up/email`; `CARD_SCREENS` (`look.ts`) opens sign-up by its new heading, the code state of forgot password in place of "check your email", and no `/reset-password`; the journeys' `signUp(page, number = freshNumber())` reads the code from the stand-in (`await codeTo(number)`), `freshNumber()` answers `+1` and a random area code, `555` and four random digits outside `01··`, and every helper that took an email (`signInAs`, `userIdOf` and the rest of `database.ts`) takes the number.

- [ ] **Step 1 (red):** the journeys, with the unit and Postgres cases for each rule above (the `services.ts` checks in `services.test.ts` among them):

```ts
test("a person joins with their phone and a code", async ({ page }) => {
  const number = freshNumber();
  await page.goto("/sign-up?next=/me");
  await page.getByLabel("Phone number").fill(nationalOf(number));
  await page.getByLabel("Password").fill(JOURNEY_PASSWORD); await fillBirthDate(page, yearsAgo(30));
  await page.getByRole("button", { name: "Text me a code" }).click();
  await page.getByLabel("The code we texted you").fill(await codeTo(number));
  await page.getByRole("button", { name: "Join Ruken" }).click();
  await expect(page).toHaveURL("/me");
  await expect(page.getByText(shownAs(number))).toBeVisible();
});
test("a number that already has an account gets the same screen and one text", async ({ page, browser }) => {      // Review Focus 2
  /* someone else signs up with this number: the code screen shows, with the "No text?" line; the text is alreadyText; countCodesTo(number) does not grow;
     any six digits, and the real account's later reset code, read "That code isn't right"; nobody is signed in */ });
test("a wrong code can be tried again, and ten wrong codes pause codes", async ({ page }) => {});
test("the code screen works with no script", async ({ browser }) => { /* javaScriptEnabled: false */ });
test("under 13 is refused before any text", async ({ page }) => { /* countTextsTo(number) and countCodesTo(number) are 0 */ });
test("a code that was used is reported to Verify", async ({ page }) => { /* after joining, the stand-in's verification for the number is approved */ });   // Verify
test("asking again sends a new code and the old one stops working", async ({ page }) => { /* the stand-in holds one pending code, the newer */ });        // Verify
test("signing in works however the number is typed", async ({ page }) => {});                                       // Review Focus 1
test("sign-up answers the same for a number with an account, even at the limit", async ({ page }) => {});           // audit 6: the sixth code asked for in an hour reads the same either way
test("wrong codes typed for a number with an account pause codes at the same count", async ({ page }) => {});       // audit 2.2: the same words at every try as for a number with none, "Too many wrong codes" at the same try, and no code can be asked for after it
test("a second browser starting sign-up for the same number cannot set the password", async ({ browser }) => {     // audit 2.1
  /* the first browser starts sign-up with its number and password; a second browser then starts with the same number
     and another password (inside 30 seconds it reads "Give it a few seconds", and its row is kept all the same, which
     is the case that matters); the first types its code and joins; its password signs in and the second's does not;
     the second browser typing any code reads "That code isn't right". No pause: nothing here waits on time. */ });
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
- [ ] **Step 3:** `showTheOwner` for the two states of `/sign-up`, `/sign-in` and `/me`, on every project, before and after, so the visual check (`visual-check`) and the slice's screens page have their pictures. The session that built the screens checks them against the sketches and fixes what it finds. The Owner sees them on the screens page, with the finished result; there is no separate "fine" for this branch.

### Task 5: Forgot password, and a number that changed hands

**Files:**
- Create: `src/features/accounts/changed-hands.ts`, `src/features/accounts/paper.ts` (`setPaperEmail` only; "This slice", 3)
- Modify: `auth.ts` (`sendPasswordResetOTP`; `sendResetPassword` and the `verification.storeIdentifier` override for `reset-password:` go, since nothing uses them any more; audit 7, audit 2.3), `forms.ts` (`requestReset`, `finishReset`; `requestPasswordReset` and `resetPassword` go), `accounts.ts` (`setMoneyCheck`, `setPaperEmail`), `src/hooks.server.ts`, `src/routes/forgot-password/+page.server.ts`, `+page.svelte`; `src/features/membership/` (`hasBillingCustomer`; the finished checkout stores the email paid with), `src/features/money/` (`hasBeenPaid`)
- Delete: `src/routes/reset-password/`, `src/features/accounts/mails.ts`, `tests/features/accounts/mails.test.ts` (audit 2.3)
- Test: `tests/features/accounts/changed-hands.pg.test.ts`, `paper.pg.test.ts`, `forms.test.ts` (add cases), `tests/features/membership/service.pg.test.ts` and `tests/features/money/` (a case each), `tests/browser/forgot-password.test.ts`; `tests/browser/support/fake-stripe-server.ts`, `tests/support/fake-premium-stripe.ts` (a finished checkout carries an email), `tests/browser/support/account.ts` (`payAsNewMember` answers it), `mail.ts` (kept: the reset journey reads the mail)

**The rule** (the spec left it to the plan; "What follows from it", 5):

`resetChannel(deps: { db; texter; hasMoney(userId: string): Promise<boolean> }, user: { id: string; phoneNumber: string; paperEmail: string | null }): Promise<"text" | "email" | "help">`

1. `since` is the newest of the account's `Session.createdAt` and its `phoneConfirmedAt`.
2. `texter.changedHands(number, since)`: `no` answers `text`.
3. `cannot_say` and `hasMoney` false: `text`. (An account that never paid and was never paid has nothing to take but itself, and locking every such person out would be worse.)
4. Otherwise (`yes`, or `cannot_say` with money): `email` when there is a `paperEmail`, else `help`.

`hasMoney` is handed in from above, because `accounts` sits below the features that know and better-auth's `sendPasswordResetOTP` is built once, in `createAuthServices`. `accounts.ts` exports `setMoneyCheck(check: (userId: string) => Promise<boolean>)`; `src/hooks.server.ts` calls it at start, as it calls `setFileStore`, with `(id) => membershipServices().service.hasBillingCustomer(id)` joined with `moneyServices().hasBeenPaid(id)` (two one-line reads added to those features, with a test each; `hasBeenPaid` is true when a `JournalLine` names the person). Until it is set the check answers true, so a reset never goes by text on a guess. (audit 5)

`sendPasswordResetOTP({ phoneNumber, code })`, after the answer: find the account; `resetChannel`; `text`: the code through Verify, `texter.sendCode(phoneNumber, code)` (Verify), in the same words as a sign-up code. `email`: the same code through the `Mailer`, to the account's `paperEmail`, with the subject "Your Ruken code" and the text "Your code to choose a new password is `<code>`. It works for 10 minutes.", sent after the answer and logged by `mailFailureCode` if it fails, as mails are today. (Branch D's Task 10 moves this one send onto `sendPaper`, with its record.) `help`: nothing is sent and one line is logged, `reset held for help`, with no number. In this slice only an account with money and no kept email can land here: a member whose checkout finished before branch B (the test accounts, which X8 replaces) or a maker who has been paid (payouts are not built). The help chat's plan gives this arm its screen.

**The email a member pays with** (brought forward from Task 10; "This slice", 3). `setPaperEmail(db, userId: string, email: string): Promise<void>` in `paper.ts`: trimmed, lower-cased, written to `User.paperEmail`. Membership calls it when a checkout finishes, with the address Stripe collected (`customer_details.email`). The kept copy of the event still holds no address (`kept-event.ts` is unchanged); the handler reads it from the verified event before it is cut down. Nobody types it into Ruken. The stand-in Stripe's payment page shows an "Email" field already filled with a made-up address ending `@example.test`, as Stripe's own page asks for one, and puts it in the finished checkout; `payAsNewMember` answers it.

**The screens** (drawn in "This slice", "The screens"). `/forgot-password`, first: "Country" (the same `<select>` as sign-in), "Phone number" and "Text me a code". Second, the same address, whatever the number: "If that number has a Ruken account, we sent a code. It may come by text, or to the email you pay with." then "The code we sent you", "New password", "Type it again", "Save my new password" (blue), "Text it again" (green) and, underneath, "Back to sign in". There is no link to `/help`: that page does not exist yet ("This slice", 4). `finishReset` checks the length and the two passwords first, then `callAuth("/phone-number/reset-password", { phoneNumber, otp, newPassword })`; success calls `texter.codeUsed(number)` after the answer (a code that went by email has no verification open, which `codeUsed` takes as nothing; Verify) and redirects to `/sign-in?reset=1`; a 400 or 403 reads `codeWrong` and keeps the number.

- [ ] **Step 1 (red):** `resetChannel`'s seven cases (no; cannot say without and with money; yes with and without a paper email; a number outside +1; `since` taken from the newer of the two dates). The journeys: a reset by code signs every device out, the old password stops working, and the person gets `passwordChangedText`; a number with no account sees the same second screen and gets no text and no code; the stand-in says the number changed hands: no code is sent (`countCodesTo`), and the second screen is the same; a reset by text leaves the stand-in's verification approved; a member (someone who paid through the stand-in) gets the code at the email they paid with and none by text, and the reset works with it; a finished checkout sets `paperEmail` and the kept event holds no `@`; `hasBillingCustomer` and `hasBeenPaid` each answer true and false; a paused sign-in can still reset. Push. Expected: `postgres` and `browser` fail.
- [ ] **Step 2 (green):** the code. Push. Expected: all pass.
- [ ] **Step 3:** `showTheOwner` for the two states of `/forgot-password`, on every project, as Task 4's Step 3. Then hand the branch to the implementation audit by naming its commit. Branch B merges after that audit and its fixes, the Owner's X1 to X4, Step 1a, and the Owner's approval (lane 3). Tell the coordinator about X8.

---

# Branch C: `texts/notices`

**Waits.** Branches C, D and E are not in this slice. Their tasks below are as the first audit and the first attempt left them and were not read against `3b1fabf`; a plan session brings them up to date when their turn comes. With codes on Twilio Verify (2026-11-17), a STOP to the account number no longer stops codes, so point 2 under "What follows from it", Review Focus 3 and the parts of Tasks 7 and 8 that rest on it are out of date and are rewritten then. Three things this slice moved into them or out of them: `twilio-signature.ts`, the stand-in's `POST /test/inbound`, `textIn`, the `statusCallback` setting and `TWILIO_AUTH_TOKEN` are built in Task 7; `setPaperEmail` and its call from membership are already built in Task 5, so Task 10 builds the rest; and the reset's email arm moves onto `sendPaper` in Task 10.

### Task 6: One text a notice, once

**Files:**
- Create: `src/features/accounts/notices.ts`; modify `prisma/schema/accounts.prisma` (+ migration), `accounts.ts`, `deletion.ts`, `src/routes/jobs/purge-accounts/+server.ts`
- Test: `tests/features/accounts/notices.pg.test.ts`

- `WaitingNotice`: `id`, `userId`, `kind`, `key`, `body`, `madeAt`, `readAt DateTime?`, `providerId String?` (indexed) and `kept Boolean @default(false)`; `@@unique([userId, kind, key])`. Deleted with the account. A **kept** row is a hidden copy, written with every account-line send and shown only if Twilio later reports that send lost (21610): it holds the notice's words where the append-only `TextSent` cannot, because `TextSent` outlives the account (audit round 4). A kept row is not a waiting notice: `waitingNoticesOf` and the unread count leave it out.
- `tellByText(deps: { db; clock; texter; log }, input: { userId: string; kind: string; key: string; body: string }): Promise<"sent" | "waiting" | "already" | "held_back" | "no_number">`, in this order: the account is `active` and has a number, else `no_number`; a `TextSent` or `WaitingNotice` row for (person, kind, key): `already`; the account line is stopped for this number (Task 7; until then never): one `WaitingNotice` row, `waiting`; else, in one transaction, insert the `TextSent` row first and send inside it, as the wishlist plan's launch mail did, so two calls at once send one text: `sent: true` commits with the provider's id and, on the account line, a **kept** `WaitingNotice` in the same transaction (same person, kind and key, the words, the provider's id); `allowlist` or `made_up` rolls back, `held_back`; a `TextError` with Twilio's code 21610 rolls back, records the stop (`recordStop`, `providerId` `refused:<userId>:<kind>:<key>`; Task 7, until then only the rollback) and saves one `WaitingNotice`: `waiting` (audit 3); any other throw rolls back, logs `textFailureCode` and rethrows. A send Twilio accepts and then reports as 21610 is handled by Task 7's report step, which records the stop and shows the notice's kept copy on `/me` (point 8); the next notice waits. `tellByNews` keeps no copy: STOP on the news line does not hide an account notice.
- `waitingNoticesOf(db, userId)`: newest first, kept copies left out. `markNoticesRead(db, clock, userId)`, which touches shown notices only, so a kept copy shown later by a 21610 report is still unread. `purgeKeptNotices(db, clock)`: deletes kept copies older than 3 days (a delivery report comes within minutes), called by the daily job that runs `purgeDueAccounts` (`src/routes/jobs/purge-accounts`), so nobody's words are kept without a reason.
- Exported from `accounts.ts`: every other feature's notice goes through it.

- [ ] **Step 1 (red):** each answer above; two calls at once send one text (Review Focus 4); a retry after a throw sends; a send refused with 21610 leaves one `WaitingNotice` and answers `waiting` (audit 3); an account-line send leaves one kept copy that `waitingNoticesOf` and the unread count do not show, and a news-line send leaves none; `markNoticesRead` leaves a kept copy unread; `purgeKeptNotices` removes kept copies older than 3 days and leaves younger ones and shown notices; a deleted or waiting-to-be-deleted account gets nothing; the purge removes `WaitingNotice` rows and leaves `TextSent`. Push. Expected: `postgres` fails.
- [ ] **Step 2 (green):** the code; `passwordChangedText` and `signInPausedText` now go through `tellByText` (key: the clock's minute). Push. Expected: all pass.

### Task 7: Texts in: STOP, START, HELP, and reports

**Files:**
- Create: `src/features/accounts/text-stop.ts`, `inbound.ts`, `src/routes/webhooks/twilio/+server.ts`; modify the schema (+ migration), `text-words.ts`, `notices.ts`, `forms.ts`, `deletion.ts` (audit 4), `cloudflare/worker.js` (audit 1), `src/routes/+layout.server.ts`, `+layout.svelte`, `src/routes/me/+page.server.ts`, `+page.svelte`, `src/routes/sign-up/+page.svelte`, `src/routes/forgot-password/+page.svelte`
- Test: `tests/features/accounts/text-stop.pg.test.ts`, `inbound.pg.test.ts`, `tests/browser/twilio-webhook.test.ts`, `texts-off.test.ts`

- `TextStopEvent`: `id`, `numberHash`, `line`, `stopped Boolean`, `at`, `providerId String @unique`, `createdAt`. Never updated (a trigger of its own rejects `UPDATE` only: the purge deletes a person's rows, as the spec asks). The rows hold the number's hash, not the person's id, so `purgeDueAccounts` hashes the number before it clears it, and deletes the rows with that hash (audit 4). The state of a number on a line is its newest row.
- `recordStop(deps, input: { number; line; stopped: boolean; providerId: string }): Promise<void>`: a second row with the same `providerId` is skipped, not an error. `textStateOf(db, secret, userId): Promise<{ accountOff: boolean; newsOff: boolean; unread: number }>`.
- `receiveText(deps: { db; clock; texter; secret; services: Record<TextLine, string>; site: string; limiter }, fields: ReadonlyMap<string, string>): Promise<void>`:
  - `MessageStatus` present (a report): `ErrorCode` `21610` records a stop for `To` on the line of `MessagingServiceSid` (`providerId`: the report's `MessageSid`) and shows the notice that send carried: the kept `WaitingNotice` whose `providerId` is the report's `MessageSid` becomes a waiting one (`kept` false, unread), so it waits on `/me` as a refused send does; a report for an id with no kept copy (a code, a news text, a copy already purged) or a second report changes nothing more; anything else `failed` or `undelivered` logs `text not delivered: <ErrorCode>`. Nothing else is kept.
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
- [ ] **Step 1 (red):** `inbound.pg.test.ts`: STOP then START on each line changes only that line; the same `MessageSid` twice stores one row (Review Focus 5); a report with 21610 records a stop (the same stop a thrown 21610 records in Task 6, point 8) **and shows the lost notice**: a notice sent through `tellByText`, then a report with 21610 for its `MessageSid`, leaves one unread waiting notice with its words, and the same report again leaves one; a 21610 report for a code text or an unknown `MessageSid` shows nothing; an ordinary text gets one `helpText` and a second inside the hour gets none; a `From` with no account stores a hashed row and throws nothing; the purge removes a deleted person's `TextStopEvent` rows (audit 4). `twilio-webhook.test.ts`: a post with no signature and with a wrong one answers 400 and stores nothing; the stand-in's signed STOP, sent as Twilio sends it (form-encoded, no `Origin`), answers 200 through `worker.js` (audit 1). `texts-off.test.ts`: after a signed STOP to the account line the person sees the line on `/` and `/me`; a password change then waits on `/me` and counts as unread; `/forgot-password` shows the START words and no text is sent (Review Focus 3); after START the line is gone and the next notice is a text; STOP to the news line shows no line at all. Push. Expected: `postgres` and `browser` fail.
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
- **The help chat** (`2026-11-15-help-chat-design.md`) replaces `receiveText`'s "any other text" arm for the account line, and builds `/help`, which `helpText` names and this plan does not build. On `main` at `3b1fabf` there is no `/help` page (only `/help/github` and `/help/record-screen`), so branch B links to none; branch C's turn decides what `helpText` names if the help chat is still waiting.
- **Worth the Owner's eye, left as they are on purpose:** an account that never paid can be reset by whoever holds its number (Task 5, rule 3); outside the United States Twilio cannot say whether a number changed hands; a person who stops account texts can only turn them back on from their own phone; codes are kept readable for their ten minutes (audit 7); and the spec's "ten wrong codes pause codes for that number for an hour", with limits counted per number, lets a stranger who knows a number keep its owner from getting a code for an hour at a time. Slice 1 counted per client to stop that for resets. It is built as the spec says (audit 9).

## Self-review

- **Spec coverage.** "Which message goes where": codes and account notices, Tasks 4 to 6; the maker's, split's, extra's and wishlist's texts, the other plans' amended tasks through Task 6 and 9; help, the help chat's design; the three emails, Task 10 and their own plans. "Signing up and signing in": Tasks 2, 4, 5, 8. "The email that stays": Task 10. "Saying yes, and STOP": Tasks 7 and 9. "Every country": Task 11 and the country table. "Twilio": Task 1. "Before the carriers say yes": X5, `TEXT_ALLOWLIST` (Task 1), and Task 4 removes email sign-up. "Stored": Tasks 3, 6, 7, 9. "Left to the plan": Twilio's calls ("What Twilio's pages say"), the words ("The words of every text"), how email sign-up is removed (Task 4), the countries (the table, Task 11), the stand-in (Task 1).
- **Not covered here, and said so:** the fourth notification (the apps' slice N); the help chat; the legal pages' lines; the three legal emails' own senders.
- **Names.** `Texter`, `TextMessage`, `TextLine`, `tellByText`, `tellByNews`, `textStateOf`, `hashNumber`, `toE164`, `resetChannel`, `sendPaper` and `setPaperEmail` are spelled one way throughout.
- **Open before the build:** Task 0's Step 1a, a real code through Verify on the Owner's phone, before branch B merges; Task 0's Step 1b, the proof of the two numbers, after X5; and Task 7's Step 0 on the cross-site check (branch C). Whether a real code can reach a United States phone before X5 was answered by the Owner's choice of Twilio Verify ("This slice", "Codes go through Twilio Verify").
- **Brought up to date, 2026-11-17.** Read for branches A and B against `main` at `3b1fabf`: the diff from `286bfdf` for every path Tasks 0 to 5 name; `playwright.config.ts`, `package.json`, `.env.example`, `prisma/schema/accounts.prisma` and the migrations' names; `src/features/accounts/services.ts`, `accounts.ts`, `auth.ts` and `src/hooks.server.ts`; the account screens; `tests/architecture.test.ts`; the journeys' helpers; the callers of a person's email outside `accounts`; the rules and CI in pull request #188; and the first attempt's plan under the tag `slice2-attempt-1`. Not read again: better-auth's package and Twilio's pages (Step 0 does), and anything branches C, D and E touch. No test, lint or typecheck ran; no code was written.
