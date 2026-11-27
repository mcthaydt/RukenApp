# Implementation audit 1: games sent to you (Your turn), PR #424

- Commit examined: `ba8beb7` (ba8beb729044a636a33b03669e6c4accb510b848), `main` at `84a3f98` already merged in.
- Brief: `docs/superpowers/specs/2026-11-27-games-sent-to-you-design.md` (plan audit 4 PASS at `975df4b`).
- Lane 3 implementation audit. Reviewer: a fresh session, Opus 5.5, medium. Started 2026-11-27 14:18 UTC, written 14:39 UTC (`date`).

**Verdict: FAIL, 3 red.**

## What ran

| Check | Result |
|---|---|
| `pnpm lint` | **fails**: Prettier, 11 files (R1). CI `verify (quick, draft)` on this head fails the same way (run 46014514826). |
| `pnpm typecheck` | 0 errors, 2376 files |
| `pnpm test` | 169 files, 2404 tests passed |
| `pnpm test:pg` (fresh Postgres 16 database) | 56 files, 829 tests passed |
| `prisma migrate diff`, migrated database to `prisma/schema` | empty |
| Journeys, all three profiles, phone in WebKit through `mcr.microsoft.com/playwright:v1.63.0-noble` `run-server`: `sent-to-you`, `feed-top`, `feed-controls`, `fits-the-screen`, `real-buttons`, `game-page`, `follow-a-maker`, `glass` | 323 passed, 7 skipped (skips are the files' own), 0 failed, 7.0 min |
| `gamepad.test.ts -g "Your turn\|shoulder\|share sheet\|feed"`, three profiles | 14 passed, **1 failed**: line 401 on phone (R2) |
| `gamepad.test.ts:401` and `:158`, phone, `--repeat-each 2` | `:158` 2/2 passed; `:401` **2/2 failed** (R2). CI's browser shard 1 failed on the same test, same error. |

## Changed existing tests (named in the PR body)

All eight read. Each change follows from the third tab or the new load: `tabs.test.ts` (three tabs, `tabFrom` both ways), `feed-controls.test.ts` (one more Tab press, order Fresh, Followed, Your turn, Search), `feed-top.test.ts` (swipe and RB reach Your turn and stop there; 48px and one centre line on Your turn at its width and 320), `gamepad.test.ts` (RB onward to Your turn), `fits-the-screen.test.ts` (both new screens added, nothing taken out), `routes/g/[game]/page.server.test.ts` (one more question in the same `Promise.all`, still "asks once"), `consent/routes.test.ts` and `purge.pg.test.ts` (new tests only). No check was weakened.

## Against the brief

- Tables and migration: only `CREATE TABLE`, `CREATE [UNIQUE] INDEX`, `ADD CONSTRAINT` on the two new tables (criterion 16, `migration.test.ts`); both `CHECK`s present; all keys `Restrict`; purge deletes both tables' rows both ways (`deletion.ts:191-192`, criterion 10). Game rows are never deleted anywhere in `src/`, so `GameSend.gameId` `Restrict` cannot block a maker's purge.
- Service: `canSend` needs two `MakerFollow` rows; faces come from the same mutual join, newest friendship first, max 8 (criterion 11); `send` checks live game, page, self, friends, limit, stop in that order and saves nothing on each refusal; stop answers "sent" and saves nothing; `skipDuplicates` on both unique keys (criterion 8); 18+ only for a known adult, taken-off games on no list (criterion 9); remove, stop and undo act only on the caller's rows (criterion 7).
- Limits: `limits.ts` stand-ins, `sendLimitsFrom` falls back on null, throw and wrong shape; `cloudflarePrivateSendLimits` and the one `setSendLimits` line in `hooks.server.ts` (criterion 17).
- Consent: `/your-turn` OPEN; send, seen, remove, stop, stopped GATED; the no-yes swipe journey passes on all three profiles (criterion 5).
- Screens: third tab with the dot and "Your turn, new games" label; list solid, Stop card on the glass tokens; Stop red, Keep quiet; link and both buttons are siblings; Stop → button at 48px; empty, signed-out and People you stopped screens fit (criteria 2–5, 14, 15). `/about` and `/privacy` updated (privacy date already 27 November 2026). `your-turn` reserved as a handle.
- CRUD: send (create), list and dot (read), seen (update), Remove (delete); stop create, list, Undo delete; all in `sent-to-you.test.ts` and passing.

## Findings

### R1

UNIT: `src/features/sends/limits.ts`, `service.ts`, `words.ts`, `src/routes/+page.server.ts`, `src/routes/privacy/+page.svelte`, `src/routes/your-turn/+page.server.ts`, `remove/+server.ts`, `send/+server.ts`, `stop/+server.ts`, `stopped/+page.server.ts`, `tests/features/sends/sends.pg.test.ts`. VERDICT: red. REQUIREMENT: criterion 18 (lint passes in CI); the PR body says lint ran green. REASON: the 11 files are not Prettier-formatted, so `pnpm lint` exits 1. EVIDENCE: local `pnpm lint` ends "Code style issues found in 11 files" (exit 1); CI job `verify (quick, draft)` 140558099609 on `ba8beb7` fails with the same line; e.g. `send/+server.ts:15` is one 121-character line Prettier splits in two. EXPECTED: `pnpm lint` exits 0 locally and in CI. FIX: `pnpm exec prettier --write` on exactly those 11 files; no other change. Correct the PR body's "Checks run" line.

### R2

UNIT: the share sheet with friends on a game's page, phone (WebKit): `src/features/feed/ShareSheet.svelte` / `src/features/sends/SendRow.svelte`, checked by `tests/browser/gamepad.test.ts:401`. VERDICT: red. REQUIREMENT: criterion 13 (the pad reaches the faces, with the rest of the sheet) and 18 (browser suites pass in CI). REASON: on the phone profile a Tab stop exists in the open sheet that the pad never reaches: the element whose text is the whole sheet ("Share / Tiny game … / Send to a friend / P / Pad Sam / Copy link / Text / WhatsApp / …"), i.e. the dialog or its scroll box itself. EVIDENCE: `gamepad.test.ts:401` fails at `support/pad.ts:195` "the pad cannot reach these on …/g/tiny-game-…" 3 of 3 here (once in the full gamepad run, twice with `--repeat-each 2`) and in CI browser shard 1 (`✘ 174 [phone]`); `:158` (the same sheet on the feed, no friends row) passes 2/2; tablet and computer pass. A likely cause, not proven: with the friends row the sheet is taller than the 375×667 window, so WebKit makes the scrolling sheet a keyboard stop. EXPECTED: `gamepad.test.ts:401` passes on phone, and the sheet with up to 8 faces either fits the phone or its scroll box is not a stop the pad cannot reach. FIX: find which element Tab stops on (log `document.activeElement` in that walk on the phone profile), then make it not a Tab stop or make the pad reach it, in `ShareSheet.svelte` and/or `SendRow.svelte` (and `src/lib/pad-focus.ts` only if the layer must learn scroll boxes); do not change `support/pad.ts` or the test's expectation. Run it on the phone profile via Playwright's docker image before handing back.

### R3

UNIT: `tests/browser/sent-to-you.test.ts` (keyboard journey, line 337). VERDICT: red. REQUIREMENT: criterion 12, a journey: "Tab reaches the faces in the sheet, the Your turn tab, each row, its Remove and its Stop button; Enter sends, opens and removes". REASON: the journey puts focus on Stop and Remove with `.focus()` and never presses Tab to reach a face, a row's link, Remove or Stop, never sends with Enter and never opens a row with Enter; only the tab's place in the Tab order is checked (`feed-controls.test.ts`). EVIDENCE: lines 352–367 use `stop.focus()` and `remove.focus()`; no `keyboard.press("Tab")` and no Enter on a face or row link anywhere in the file. EXPECTED: a journey that, by Tab presses only, reaches a face in the open share sheet and sends with Enter (shows "Sent"), and on `/your-turn` reaches a row's link (Enter opens `/g/<slug>`), its Remove and its Stop, with a visible focus ring. FIX: extend that journey in `tests/browser/sent-to-you.test.ts` only.

## Notes (not blocking, not for this fix round)

- N1. A face with no photo is the first letter on `--paper`, not "on the page's theme colour" as the brief says; it matches the feed's maker credit, which the brief says it should look like, so the brief's words are the error.
- N2. A double press of the Stop card's Stop: the second POST finds no row and answers 404, so the card can show "That didn't work" while the first succeeded. The Stop button shows no busy state while it waits.
- N3. Criterion 6's status codes 400, 403 and 429 are checked as service outcomes (`sends.pg.test.ts`), not through the route; the route's mapping is straightforward and the journey checks 404 and the signed-out refusal.
- N4. `/your-turn`'s load reads all live games twice (`listOf` and `hasNew`).
- N5. CI browser shard 1 also shows `✘ 182 [tablet] make-after.test.ts:475` after the phone failure; its summary counts 1 failed, so it was most likely cut off by the stop-at-first-failure setting, not a second failure. Not checked here.
