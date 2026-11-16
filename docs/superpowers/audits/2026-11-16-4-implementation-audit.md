# Texts, not email, branch A: implementation audit, round 4

Pull request #175, commit `81765cc` on `claude/project-thread-cb74sj` (Tasks 0 Step 0, 1 and 2 of
`docs/superpowers/plans/2026-11-15-texts-not-email.md`). Lane 3 (`src/features/accounts/`), with lane 2 parts
(`src/lib/`, `tests/support/`, `tests/browser/support/`, `playwright.config.ts`). A fresh session wrote this and changed
nothing else. Written 2026-11-16 20:42 UTC (from `date`).

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## What was checked

- **Scope.** `git diff origin/main...81765cc` touches the 14 files in the plan's Task 1 and Task 2 file lists plus the
  plan itself. No package added (`package.json` and the lockfile are unchanged). Commits `57c6384` and `81765cc` are
  authored by McThayDT with no AI lines.
- **Interfaces against the plan.** `TextLine`, `TextMessage`, `TextResult`, `Texter`, `TwilioTexterOptions`,
  `createTwilioTexter`, `TextError` (`code`, `responseCode`, `twilioCode`), `textFailureCode`, `twilioSignatureOf`,
  `isFromTwilio`, `createCaptureTexter`, `toE164`, `hashNumber`, `isMadeUpNumber`, the five text functions and
  `fitText` all have the plan's names and shapes. `send` checks a made-up number first, then the allowlist, then posts
  `To`, `Body`, `MessagingServiceSid`, `StatusCallback` with Basic auth; `fetch` is a plain constant; `changedHands`
  answers `cannot_say` outside `+1` with no request and never throws; `textFailureCode` never reads the message.
- **The signature.** The test uses the worked example from Twilio's security page (token `12345`, expected
  `L/OH5YylLD5NRKLltdqwSvS0BnU=`), checks byte-order sorting, the cut `#` fragment, and refuses a changed value, a
  missing header and a wrong length; comparison is `timingSafeEqual` after a length check.
- **The words.** Each text matches "The words of every text" letter for letter. The GSM-7 basic set in `text-words.ts`
  has 127 distinct characters (128 less ESC), counted with `node`; the extension set is the ten two-place characters.
  Every text is tested at 160 places or fewer with both `https://ruken.io` and the longest site in use,
  `https://ruken.ruken-beta.workers.dev`; `fitText` cases cover the 160 cut, emoji at 70, `€` as two places, never
  cutting an emoji, and no space before `...`.
- **Codebase fit (Graphify, index at `8dca316`).** `src/features/accounts/services.ts` is imported by `hooks.server.ts`
  and every account route; `authServices()` builds the services once per process with `requireEnv`, so a required
  setting missing on the Worker throws on the first request. `isMadeUpNumber` lives in `src/lib/server/text.ts` and
  `phone.ts` re-exports it, which keeps `lib` free of feature imports (`tests/architecture.test.ts`).
- **Tests run.** In this cloud container (Node 22), `vitest run --project unit` on the five new test files: 70 passed.
  CI on `81765cc` (`verify (quick, draft)`, `postgres (quick, draft)`, the browser pieces) had not finished when this
  was written; this audit does not count as green.

## The three declared deviations

1. **Twilio wiring in `services.ts` moved to Task 4: sound.** Requiring six secrets in `createAuthServices` before
   their first user would make every request on `main` throw until the Owner runs X4. Nothing in branch A reads them.
   The plan has to say so where the work now lives (finding 1).
2. **21610 can arrive later, in a delivery report: sound as a precaution, not yet proven.** Twilio's 21610 page
   (twilio.com/docs/api/errors/21610, modified 2026-03-11) says only that the recipient opted out; it does not say
   whether the API refuses at once or accepts and fails later, and does not separate a Messaging Service from a `From`
   number. Building for both is right; the plan must change in the places that still say "at once" (finding 2).
3. **SMS Pumping Protection belongs in the Owner steps: sound.** Twilio's page
   (twilio.com/docs/messaging/features/sms-pumping-protection-programmable-messaging, modified 2026-09-25): it is turned
   on per account in the Console under Communications > Messaging > Settings, is free for the US and Canada, and a
   blocked text shows error 30450. A sign-up that texts a code to any typed number is what pumping targets. The plan
   does not yet record it (finding 3).

## Findings

UNIT: plan, Task 4 (and Task 1's `services.ts` bullet).
VERDICT: red.
REQUIREMENT: The plan is the brief; a deviation is recorded where the work moves to (CLAUDE.md, Reporting).
REASON: Task 1's `services.ts` bullet is now built by Task 4, but only Task 1's note says so.
EVIDENCE: Task 4's files list `services.ts` for other reasons; nothing in Task 4 names the six required settings,
`TEXT_ALLOWLIST`, the `TWILIO_API_BASE` guard through `standInAddress` (audit 18) or `AuthServices.texter`. Task 1's
bullet still reads as part of a step marked done.
EXPECTED: Task 4 carries the bullet, with its test (a missing setting named at start; `TWILIO_API_BASE` refused unless
`http://127.0.0.1:`), and Task 1's bullet says it moved.
FIX: Plan only: move the bullet into Task 4 and add those two checks to its Step 1; leave a one-line pointer in Task 1.

UNIT: plan, "What follows from it" point 8, Task 4's 21610 bullet, Task 0 Step 1.
VERDICT: red.
REQUIREMENT: Review Focus 3 (a person who sent STOP asks for a code: no text is tried, and the screen says how to turn
texts back on); the plan's Step 0 stop rule ("any difference from this plan: stop and report").
REASON: The plan still says a send to an opted-out number "is refused at once", and Task 4 relies on a thrown
`TextError` 21610 alone.
EVIDENCE: Point 8 and Task 4's `auth.ts` bullet are unchanged at `81765cc`; only Task 1's note mentions the delivery
report. Twilio's 21610 page does not settle the timing, and the note does not name the page that says "asynchronously".
EXPECTED: Point 8 carries a dated line: either path can happen, both are handled; Task 4 (and Task 6/7) record a stop
from a delivery report's `ErrorCode` 21610 as well as from a thrown one; Task 0 Step 1 records whether the API answered
400 or accepted the send and reported 21610 later; the note names the page and quotes it.
FIX: Plan only: those four edits.

UNIT: plan, Task 0 Step 0 record and Owner step X2.
VERDICT: red.
REQUIREMENT: Task 0 Step 0: "Twilio's page on SMS pumping protection, reporting whether it applies to a Messaging
Service (audit 10)".
REASON: Step 0 is ticked, but its SMS pumping result is not written in the plan, and X2 has no step for it.
EVIDENCE: The Task 1 note records the `#` and 21610 results only; `grep -n -i pumping` on the plan finds only Step 0's
own text.
EXPECTED: Step 0's result is recorded (account-wide Console setting, free in the US and Canada, error 30450, the page
does not mention Messaging Services), and X2 adds: turn on SMS Pumping Protection under Communications > Messaging >
Settings (a website; no command).
FIX: Plan only: the record in Task 1's note (or under Step 0) and one line in X2.

UNIT: `src/features/accounts/phone.ts`, `toE164`.
VERDICT: note (follow-up for Task 11).
REQUIREMENT: Review Focus 1 (one account however the number is typed).
REASON: Every leading zero is dropped for every country, but Italy keeps its leading 0 in E.164 for fixed lines.
EVIDENCE: `national = digits.replace(/^0+/, "")`, per the plan's audit 14 rule. Only the US and Canada open first, so
nothing is wrong today.
EXPECTED: When Task 11 opens a country, its table says whether the trunk 0 is dropped.
FIX: None here; a line in Task 11 when Italy is considered.

UNIT: `tests/browser/support/texts.ts`, `textIn`.
VERDICT: note (follow-up for branch C).
REQUIREMENT: Review Focus 5; the webhook must tell the two lines apart.
REASON: `textIn` sends no `To` or `MessagingServiceSid` by default, and its `MessageSid` is `SM-in-<Date.now()>`, which
two calls in the same millisecond repeat.
EVIDENCE: `const fields = { MessageSid: \`SM-in-${String(Date.now())}\`, From: from, Body: body, ...extra }`.
EXPECTED: Branch C's journeys pass the line through `extra`, or `textIn` takes it, and ids are unique.
FIX: None in branch A.

## Verdict

`81765cc`: the code matches Tasks 1 and 2 and the three deviations are sound. Three reds, all in the plan text:
record each deviation where it now takes effect. No code change is needed. CI on `81765cc` was still running.

## Fix check

Checked 2026-11-16 20:45 UTC (from `date`) on `e14c984`, by this audit session. `git diff c1eb502 e14c984` changes only the plan.

- **Red 1: passed.** Task 1's `services.ts` bullet now says it moved to Task 4. Task 4 has a `services.ts` section with
  the six required settings, `TEXT_ALLOWLIST`, the `TWILIO_API_BASE` guard (audit 18), `AuthServices.texter`, the
  fake settings in `playwright.config.ts` and `.env.example`, and `services.test.ts` checks (each missing setting
  named; `http://127.0.0.1:12114` taken, `https://sms.example` refused), listed in its tests and its Step 1.
- **Red 2: passed.** Point 8 carries a dated line quoting `docs/messaging/tutorials/advanced-opt-out` ("will fail with
  Error Code 21610 asynchronously") and the 21610 page's silence; both paths are built (a thrown 21610 in Task 6, a
  reported one in Task 7, whose Step 1 tests it); Task 4's bullet names the second path; Task 0 Step 1 records 400 or
  accepted-then-failed.
- **Red 3: passed.** Step 0's result is recorded (account-wide, Communications > Messaging > Settings, free in the US
  and Canada, error 30450, Messaging Services not mentioned), and X2 has the Console step.

## The implementer's Task 6 call

UNIT: plan, Task 6 `tellByText` (the accepted-then-21610 sentence) and Task 7's delivery-report step.
VERDICT: red.
REQUIREMENT: Spec, "After STOP on the account number": "Each notice that would have been a text waits on `/me`".
Owner, 2026-11-15: "saying stop might make them not see important things".
REASON: A notice Twilio accepts and then reports as 21610 is lost: it stays `sent` and never waits on `/me`.
EVIDENCE: `e14c984` Task 6: "A send Twilio accepts and then reports as 21610 stays `sent` ... The one notice that was
accepted and lost is not shown on `/me`: said in a comment." The lost notice can be `passwordChangedText` or
`numberChangedText`, the security notices the account line exists for. It happens whenever Ruken did not hear the STOP
first (a STOP before the number had an account, or a STOP post that failed all three retries), and point 8 now says
the delayed failure may be Twilio's normal path for a Messaging Service.
EXPECTED: When Task 7's report step reads `ErrorCode` 21610, it finds the notice by its `MessageSid` (the
`TextSent` row's `providerId`) and saves its `WaitingNotice` with the same (person, kind, key), so the person sees it
on `/me` as the spec says. The body has to be kept somewhere deleted with the account (for example a `WaitingNotice`
written with every account-line send and shown only once a 21610 arrives), not on the append-only `TextSent`, which
outlives the account.
FIX: Plan only, Tasks 6 and 7 (and Task 3 if a column is needed): replace "stays sent ... not shown" with that step,
add an `inbound.pg.test.ts` case (a sent notice, then a report with 21610 for its `MessageSid`: one waiting notice on
`/me`, unread), and drop the comment. If the implementer wants to keep the loss instead, it goes to the Owner as a
decision card, since it narrows the spec.
