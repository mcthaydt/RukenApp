# Audit: do the tests walk the paths the owner, makers and players actually walk?

Examined: `main` at `b523531` (merge of #325), plus the owner's step files in the project folder (`owner-steps/`, outside the repo). Reviewer: Opus 5.5, medium. Started 2026-11-22 15:48 UTC.

Asked by the owner (2026-11-22 15:46 UTC): "We have a lot of tiny issues like this - is this because the lack of unit tests? Or are E2E tests are lacking ALL test cases".

## Answer

Neither, mostly. The code is well covered: 56 browser journey files with 538 journeys, and every page and every `/jobs/*` endpoint in `src/routes` has at least one journey that calls it. Today's snags came from the three things **around** the code that no test walks:

1. **The owner's own commands.** The owner runs hand-copied `curl` lines from files in the project folder. The journeys call the same endpoints through a test helper, so the endpoint is right while the line the owner pastes is wrong, and nothing notices.
2. **Hand-written owner instructions.** Deploy and setup steps are typed by sessions and never checked against the repo, so they go stale (`pnpm run deploy` after Workers Builds took over).
3. **The live site.** Production settings (http to https, Cloudflare routes, secrets, real Twilio, Stripe and GitHub) are only ever exercised by the owner. The journeys run against `wrangler dev` on `localhost` with stand-ins.

Adding more unit tests or more journeys of the same kind would not have caught any of today's four snags. Testing the owner's path and the live site would have caught three of them.

## Today's snags, traced

| Snag | Where it came from | Was the code tested? | Why the tests missed it |
| --- | --- | --- | --- |
| `/jobs/review` accept said "It changed since you looked" | `owner-steps/2026-11-20-real-game-walk.md` gives `{"do":"accept","game":"GAME"}` with no `seen`. Since #276 (unit A, 2026-11-21), accepting a held video or rating needs the `seen` time from `look` (spec `2026-11-21-everything-editable-design.md` line 94). | Yes. `tests/browser/make-live-changes.test.ts:141`, `:177`, `:225`, `:257`, `:302`, `:450`, `:461` accept with `seen: looked.seen`. | The journey passes `seen` through code. The owner's line was written on 2026-11-20, before the rule, and nothing checks it. |
| Notes said run `pnpm run deploy` | Session-written notes. `package.json` still has a `deploy` script, while Cloudflare Workers Builds already deploys `main`. | Not applicable: there is no code path. | Owner instructions are prose, never run or checked. |
| Phone sign-in bounced (http served without a redirect) | Production served `http://ruken.io` as a full site. | Now yes: `tests/features/accounts/https-only.test.ts` (#310). | Journeys run on `http://localhost`, where the redirect must not fire. Only a check against the live site can see it. |
| Flaky journeys slow every merge | 7 open entries under "Flaky tests" in `progress.md`; `feed-controls.test.ts:71` has failed three times. | Yes, too eagerly. | Timing on busy shared runners. Already being fixed one by one (#314, #315, #325). |

## Map: each flow and the test that walks it

Legend: **walked** means a browser journey does the flow end to end; **code only** means the endpoint or function is tested but not the way a person reaches it; **none** means nothing.

### Players

| Flow | Test | Status |
| --- | --- | --- |
| Open the site, swipe the feed, keys and controls | `feed.test.ts`, `feed-controls.test.ts` | walked (flaky: `:71`) |
| A game's page, signed out | `game-page.test.ts`, `game-gate.test.ts` | walked |
| Sign up, sign in, sign out | `sign-up.test.ts`, `sign-in.test.ts`, `auth-route.test.ts` | walked, against a Twilio stand-in |
| Forgot password | `forgot-password.test.ts` | walked; the feature is parked by the owner |
| Join and pay, come back to `/join/done` | `join.test.ts`, `pay.test.ts`, `membership.test.ts`, `rejoin.test.ts` | walked, against a Stripe stand-in |
| Play a game, time counted | `play.test.ts`, `play-time.test.ts`, `player-count.test.ts` | walked |
| 18+ games | `adults-only.test.ts` | walked |
| A maker's page and its links (`/[handle]`, `/out/[link]`) | `maker-page.test.ts` | walked |
| Your account: password, delete, goodbye | `me.test.ts`, `change-password.test.ts`, `delete-account.test.ts` | walked |
| Help pages | `help-guide.test.ts` | walked |
| Over plain http on the live site | `https-only.test.ts` (unit) | code only, never against ruken.io |

### Makers

| Flow | Test | Status |
| --- | --- | --- |
| Add a game, answer the questions, agree, check, send | `make-walk.test.ts`, `make-questions.test.ts`, `make-send.test.ts`, `make-game-crud.test.ts` | walked (flaky once: `make-game-crud.test.ts:20`) |
| Connect GitHub, pick a repo and branch | `connect-github.test.ts` | walked against a stand-in; the real GitHub return is checked only by the owner (slice 2 step 5) |
| Wait, be sent back, see the reasons | `make-waiting-and-off.test.ts`, `make-design-pass.test.ts` | walked |
| Live game: change videos and rating, held for review | `make-live-changes.test.ts`, `players-see-updates.test.ts` | walked |
| Take off, put back, throw away | `take-off.test.ts`, `make-waiting-and-off.test.ts`, `make-after.test.ts` | walked |
| Edit your page, add, change, remove links, take the page down | `edit-page.test.ts` | walked (flaky: `edit-page:452` is the next fix) |
| The AI-helper prompt on the "get your game on Ruken" guide | `rules-pr-routes.test.ts` names it; no test that it matches `files-check.ts` | none (see N2) |
| Command line and AI agent (`npx ruken …`, spec from #318) | not built yet; PR 1 is on a branch | none yet. Its spec covers makers only: review stays `/jobs/review` (section 5.4) |
| A game named "new" or "github" | known unfixed: shadowed by `/make/new` and `/make/github` | none (see N1) |

### The owner

| Flow | Test | Status |
| --- | --- | --- |
| `/jobs/first-owner` | `first-owner.test.ts` | code only: called through a helper, not the line in the owner's notes |
| `/jobs/review` list, look, accept, send back | `review-job.test.ts`, `make-live-changes.test.ts` | code only: same |
| `/jobs/attach-phone` | `attach-phone.test.ts` | code only |
| `/jobs/money`, `/jobs/decision-day`, `/jobs/purge-accounts` | `money-job.test.ts`, `decision-day-job.test.ts`, `purge-job.test.ts`, `tests/cloudflare/crons.test.ts` | code only; these also run on a schedule |
| Stripe webhooks | `stripe-webhook.test.ts` | code only, signed by the test's own secret |
| Deploy the site and the games gate | none. Workers Builds deploys `main`; whether it runs `prisma migrate deploy` (the `deploy` script does) is not checked here | none |
| Check the live site after a deploy | none. Planned in the "Deploy automatically from main" thread | none |
| Owner step files (`owner-steps/*.md`) | none. Written by hand, outside the repo | none |

## Gaps, ranked by owner pain

### R1. The owner's review commands are untested and hand-copied (red)

- UNIT: the owner's review path: `owner-steps/2026-11-20-real-game-walk.md` and `src/routes/jobs/review/+server.ts`.
- REQUIREMENT: CLAUDE.md "CLI first" (give the owner commands) and Verification (run it like a person); the everything-editable spec, section on `seen`.
- REASON: the owner's accept line lacks `seen`; the `look` answer asks the owner to hand-splice a time into JSON (`LOOK_SAYS_SEEN` in `src/features/games/review-words.ts:92`), which is not something a person should have to do.
- EVIDENCE: the owner's accept failed on 2026-11-22 with "It changed since you looked". The step file's accept line has no `seen`; the journeys at `make-live-changes.test.ts:141` and others pass it.
- EXPECTED: the owner types one command they never have to edit by hand, and a test runs that exact command.
- FIX, smallest first:
  1. Server only, lane 2, no new tool: `look` answers a ready-to-paste `accept` field holding the exact command, `seen` already filled in. `review-job.test.ts` and `make-live-changes.test.ts` take that field's text and run it, so the instruction is the thing tested. Files: `src/routes/jobs/review/+server.ts`, `src/features/games/review-words.ts`, those two tests.
  2. Product choice for the owner: a tested `ruken review` command (list, look, accept, send back) in the command line program from #318, reading the jobs secret from the Keychain. That adds owner commands to a spec that is makers-only, so it is a scope change and needs the owner's yes. A web review screen is slice 4's admin portal and is not proposed here.

### R2. Owner instructions are hand-written and never checked (red)

- UNIT: `owner-steps/*.md` in the project folder; any session's "run this" message.
- REQUIREMENT: CLAUDE.md "Report honestly" (a tool is checked to exist before anything is built on it) and "A check is a test that fails by itself".
- REASON: steps are typed from memory and drift from the repo: `pnpm run deploy` after Workers Builds took over, accept without `seen`.
- EVIDENCE: `owner-steps/2026-11-21-video-passes-deploy.md` and `2026-11-20-setup-commands.md` both say `pnpm run deploy`; `2026-11-20-real-game-walk.md` is the accept line above.
- EXPECTED: every command given to the owner either comes out of a tested program, or is checked by a test before it is handed over.
- FIX: owner commands live in the repo as small scripts under one folder (for example `scripts/owner/`), each with a test that runs it against the journeys' site. A message to the owner quotes a script, not a raw `curl`. Old step files that name a retired command are deleted or marked stale once auto-deploy lands. Lane 2. A rule that sessions must hand the owner only scripted commands is a CLAUDE.md change, so lane 3 and the retrospective's rule-change pull request.

### R3. Nothing checks the live site after a deploy (red)

- UNIT: the deploy path (Workers Builds today; the "Deploy automatically from main" spec next).
- REQUIREMENT: CLAUDE.md Verification ("the test hardest to fool comes first").
- REASON: production-only settings can only break on ruken.io, and the owner finds them first.
- EVIDENCE: the http to https bug (fixed by #310) passed every test; whether Workers Builds runs migrations is not checked by anything in this repo.
- EXPECTED: after every deploy, a short program visits ruken.io and fails loudly.
- FIX: a live smoke check in the auto-deploy work, at minimum: `http://ruken.io/sign-in` answers 308 to https; `/healthz` answers and reports the database and the migration it expects; the feed and one known game page load; `media.ruken.dev` refuses a video without a pass; the join page reaches Stripe checkout. Real texts stay the owner's call (draft in `handoff/forgot-password/diagnosis-and-smoke-draft.md`). This belongs in the auto-deploy spec, not a new thread.

### R4. Flaky journeys (note: already being worked)

- 7 open entries in `progress.md`. `feed-controls.test.ts:71` failed three times with no cause found; `make-design-pass.test.ts:239` and `adults-only.test.ts:148` both failed on the sign-up code step in the same run, which points at the Twilio stand-in under load. Next in line per memory: `edit-page:452` and `look.ts` `fonts.ready`. No new action beyond continuing those fix threads; a shared cause in the code stand-in is worth one look.

### R5. Real outside services are only ever met by the owner (note)

- Twilio, Stripe and GitHub are stand-ins in every journey, which is right for CI. The gap is covered by R3's live check in test mode for Stripe and by the owner's real-number walk for texts. No separate fix.

### N1. A game named "new" or "github" cannot be opened (note, known)

- Recorded in project memory as known unfixed. No journey covers it. Report only, per "Keep to the request".

### N2. The guide's AI-helper prompt can drift from the files check (note)

- Project memory says `src/routes/help/get-your-game-on-ruken/agent-prompt.ts` must stay in step with `files-check.ts`, but no test compares them. Fix: a unit test that every limit in `files-check.ts` (size, file count, `index.html`) appears in the prompt's text. Lane 1.

## Recommended order

1. R1 fix 1 (look answers a ready accept command, tested). Smallest, removes the snag the owner just hit. Lane 2, one short-path pull request when a slot opens.
2. R3 inside the auto-deploy work already waiting for a slot.
3. R2 scripts for the owner's remaining commands, then the rule change in the next retrospective.
4. N2's test.
5. R1 fix 2 only if the owner says yes to owner commands in the CLI.

## What this audit did not do

- It ran no tests and walked nothing live; it read `main` at `b523531` and the project folder's step files.
- It did not check Cloudflare's Workers Builds settings (no access from here), so whether migrations run on deploy is open.
- It changed no product code and opened no pull request.
