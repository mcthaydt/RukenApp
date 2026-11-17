# Texts, branch A (the Texter and the number rules): implementation audit, cycle 1

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

- Pull request: #191 (draft), branch `claude/project-thread-vdtizd`.
- Commit examined: `064fe28` ("Remove branch A's live-state file before the review"), whose code is `2a8f8b7`. The review counts only for that commit.
- Measured against: `docs/superpowers/plans/2026-11-15-texts-not-email.md` at `064fe28`: "This slice" (Units, acceptance criteria A1 to A6, "Codes go through Twilio Verify"), Global Constraints, "The words of every text", Review Focus 1 and 6, Branch A (Task 0 Step 0, Task 1, Task 2). Also `CLAUDE.md` and the `this-repo` skill.
- Lane: 2 (`src/lib/`, `playwright.config.ts`, `tests/support/`). One fresh review.
- Written: 2026-11-17 05:32 UTC (from `date`).

## Verdict

Two red findings and three notes. The `Texter`, its Verify calls, the stand-in and the words match the plan closely, and every check that could run here passed. The two reds are a wrong number for some typed UK numbers (Review Focus 1) and a stand-in failure switch that one parallel journey can trip for another (a flaky test by design). Both fixes are small and touch only branch A's own files. After they are fixed and checked, the pull request can be marked ready for the full CI run that A1 needs.

## What was checked, and how

| Check | Result | Evidence |
|---|---|---|
| A1: lint, typecheck | PASS | `pnpm lint` exit 0, `pnpm typecheck` exit 0, on `064fe28`, Node 22 in a cloud container. |
| A1: unit tests that touch the change | PASS | `vitest run tests/lib/server/text.test.ts tests/features/accounts/phone.test.ts tests/features/accounts/text-words.test.ts tests/architecture.test.ts`: 4 files, 59 tests passed. `pnpm test:pg`, `pnpm build` and the journeys were not run here (no Postgres in this container); the draft's quick CI run on `064fe28` passed `verify`, `postgres`, all six browser pieces, `gate` and `commit-authors`. |
| A1: full CI run on the last commit | NOT YET | Only the "(quick, draft)" run exists. The full run starts when the draft is marked ready, after this review's fixes. |
| A2: every case in Task 1's `text.test.ts` | PASS | Each `it` the plan lists is present, plus extras (account line's service, stand-in base, null Twilio code, `codeUsed` makes no request off the allowlist). `sendCode` cancels with the number percent-encoded in the path, ignores 404, throws on any other failure before starting; `codeUsed` swallows 404, logs 500 as `TWILIO 500 20500`, logs a thrown `fetch` as `unknown error`. |
| A3: the stand-in answers as Twilio does | PASS (with red 2 below) | `tests/browser/twilio-stand-in.test.ts`: text read back by `textTo`; code read back by `codeTo`; the second `sendCode` leaves `["111111","canceled"],["222222","pending"]`; `codeUsed` leaves `approved`; a missing `CustomCode` answers 400 / 60200; `/test/hands` drives `changedHands`. |
| A4: `toE164` table and the words | PASS for the plan's rows; red 1 for a case the rows miss | All plan rows plus `312.555.0142`; refusals include `312 555 01x2`. Words are letter for letter the plan's table; each starts `Ruken: `, is plain ASCII GSM-7, is at most 160 and holds one `http`, on `https://ruken.io` and `https://ruken.ruken-beta.workers.dev`. |
| A5: only Task 1 and 2 files; nothing a visitor sees changes | PASS | `git diff 2202698 064fe28 --stat`: the plan, `playwright.config.ts`, `src/lib/server/text.ts`, `src/features/accounts/phone.ts`, `src/features/accounts/text-words.ts`, `tests/support/capture-texter.ts`, `tests/browser/support/fake-twilio-server.ts`, `tests/browser/support/texts.ts` and the three test files. No route, screen, table or setting. `services.ts` untouched (moved to Task 4, as planned). Graphify (indexed at `main` `78008fc`) finds no `createTwilioTexter` on `main`, and nothing on the branch imports `text.ts` outside tests and `phone.ts`: the code has no caller yet, as planned. The live-state file was added and removed inside the branch. |
| A6: `src/lib/` imports no feature | PASS | `tests/architecture.test.ts` passed; `isMadeUpNumber` lives in `text.ts` and `phone.ts` re-exports it. |
| Logs never hold a number or a code | PASS | `TextError`'s message is only `Twilio answered <status>`; `textFailureCode` answers `TWILIO <status> <code>` or `unknown error`; tests check the number and the code are not in the message. |
| `node:crypto` in a feature runs in the Worker | PASS | `wrangler.jsonc` has `nodejs_compat`; nine other `src/features/` files already import `node:crypto`. |
| Task 0 Step 0 | PASS, with note 3 | The 2026-11-17 reading is written under the step: custom code length, the console switch, approve feedback, number in place of `{Sid}`, price ($0.05 per successful verification plus about $0.0083 per SMS), Geo Permissions' place, Fraud Guard with custom codes, `#` not signed. |
| Identity | PASS | Both branch-A commits authored by McThayDT; `commit-authors` passed. |

## Red findings

### 1. A typed UK number starting `011` becomes a different country's number

- UNIT: `src/features/accounts/phone.ts`, `toE164`.
- VERDICT: red.
- REQUIREMENT: Review Focus 1 and the spec's rule that one number is one account, found again however it is typed, "`0312…` in a country that writes a leading 0". Task 2's interface.
- REASON: "011" is read as an international prefix whatever country was picked, but it is the North American one only. Under `+44`, Leeds (0113), Sheffield (0114), Nottingham (0115), Leicester (0116), Bristol (0117) and Reading (0118) numbers all start "011".
- EVIDENCE: run on `064fe28`: `toE164("+44", "0113 496 0000")` answers `+34960000` (a Spanish-looking number) and `toE164("+44", "0118 496 0000")` answers `+84960000`, instead of `+441134960000` and `+441184960000`. The code follows the plan's wording ("starting `+`, `00` or `011`"), so the plan carries the same slip. Only `+1` is offered in this slice, so nobody can hit it yet, but the function merges now and branch E opens other countries on top of it.
- EXPECTED: "011" is treated as the international prefix only when the picked dialing code is `+1`. Elsewhere it is a national number with its leading 0 dropped.
- FIX: in `toE164`, take the `011` arm only when `dialingCode === "+1"`; add rows `["+44", "0113 496 0000", "+441134960000"]` and `["+44", "0118 496 0000", "+441184960000"]` to `tests/features/accounts/phone.test.ts` (failing first), keeping `["+1", "011 44 7700 900123", "+447700900123"]`. Correct the `toE164` line in Task 2's interface in the plan to say so. Files: `src/features/accounts/phone.ts`, `tests/features/accounts/phone.test.ts`, the plan's Task 2 interface line.

### 2. The stand-in's failure switch is shared by every journey running at once

- UNIT: `tests/browser/support/fake-twilio-server.ts` (`POST /test/fail`, `failNext`) and `tests/browser/twilio-stand-in.test.ts`.
- VERDICT: red.
- REQUIREMENT: CLAUDE.md, Tests: "A test that fails once and passes on retry is a defect." Review Focus 6, which will rest on this switch in branch B.
- REASON: `failNext` is one flag for the whole stand-in. One stand-in serves every Playwright worker in a CI piece, and every journey runs in nine projects, so the same file runs in several workers at once. The next text or code started by any worker takes the failure.
- EVIDENCE: `playwright.config.ts` starts one stand-in per run and nine projects; `fake-twilio-server.ts` lines 38, 57 to 61 and 155 to 158 set and take one global flag. If "the next send fails with 500" runs in one project while "a code handed to sendCode is read back" runs in another, the second test's `sendCode` gets the 500 and fails, and the first test's expected rejection does not come and it fails too. It passed on the quick run; it is a race, not yet seen. Branch B will add more journeys that both send codes and ask for failures, which makes the race likelier.
- EXPECTED: a failure asked for by one journey can only hit that journey's own sends.
- FIX: `POST /test/fail` takes a JSON body `{ to }` and the stand-in fails only the next text or code to that number (a `Set<string>` in place of the flag); the journey posts its own number. Update the header comment and the plan's stand-in line (Task 1) to match. Files: `tests/browser/support/fake-twilio-server.ts`, `tests/browser/twilio-stand-in.test.ts`, the plan's Task 1 stand-in line.

## Notes (recorded, not fixed here)

1. **`fitText`'s emoji case runs only with the short site.** Task 2's Step 1 says every case also runs with the longest site address (audit 13). The long-name case does (`fits with the link of %s`); the emoji case and the euro case do not. With the `workers.dev` link and an emoji name, `before` plus `...` plus `after` is already over 70, so `fitText` falls back to dropping the whole name and answers a GSM-7 text; that is right, but no test holds it. A test with the long site would. Worth adding with branch C, where the first `fitText` caller is built. File: `tests/features/accounts/text-words.test.ts`.
2. **`changedHands` throws on an invalid `Date`.** `since.toISOString()` sits outside the `try`, so an invalid date throws `RangeError`, though the interface says it never throws. No caller exists yet; Task 5 passes a stored date. Moving that line inside the `try` would make the promise hold. File: `src/lib/server/text.ts`.
3. **Step 0's 2026-11-17 reading does not say better-auth's `routes.mjs` or twilio-cli's `--help` were read again.** The step asks for both. The `--help` check is left to the Owner's run of Step 1a, which the plan's "Where execution stops" says the plan session already did on 2026-11-17. The plugin's routes are what Task 4 builds on, so branch B's build session should read them before Task 4 and write what it found under Step 0.

## Follow-ups outside this change

None.
