# Plan audit 4: Ruken from your computer (a command line and an MCP for makers)

- Reviewed: PR #318, head `30db00b` (spec `docs/superpowers/specs/2026-11-22-ruken-from-your-computer-design.md`, reworked after plan audit 3 at `6776e83`). Code read at the same commit (the code under the spec is `main` at `16dee78`; the PR changes only docs).
- Lane: 3 (PR 1 has a migration and a new way to sign in). Reviewer: fresh session, Opus 5.5, medium. Started 2026-11-22 14:13 UTC (from `date`).
- Owner decisions: D1 and D3 decided and recorded (spec 9, 5.4, `progress.md`). D2 (npm) is open; this audit assumes neither option.
- Prompt: Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

**Verdict: FAIL, 2 red, 3 notes.** R3-2 is fixed. R3-1 is fixed for the layer rule but names an action on the wrong screen and, read as written, adds an agreement check to three browser sends that have none today (R4-1). One new red: the new `/link` screen is a first-level address, which every maker's page address can also be, and the reserved-word list that guards that is not owned (R4-2). Both are spec-only fixes.

## Audit 3's reds, checked one by one

| Red | Fixed? | What was checked |
|---|---|---|
| R3-1 agreement check's home | Layer rule yes; callers no (R4-1) | `src/features/make/send.ts` exported from `make.ts` is allowed: `make` is above `games` in `tests/architecture.test.ts:12-24`, so `make` may import `games` through `games.ts`, and routes may import `make.ts` (the check screen already does, `check/+page.server.ts:9`). `put-back` and a live game's saved change are left alone, as asked. But the callers listed are wrong: see R4-1. |
| R3-2 test names and owners | Yes | 4.5 and Owns now say `tests/routes/link.pg.test.ts` and `tests/features/accounts/computer-keys.pg.test.ts`; `vite.config.ts:43-44` runs `tests/**/*.pg.test.ts` in the postgres project, so `tests/routes/` (a new folder) is covered. `placeOf` is required, and every place a `Platform` value is written outside `src/` is owned: `grep -rn "setPlatform\|: Platform"` finds only `tests/features/accounts/auth.pg.test.ts:971,1027`, `tests/lib/server/background.test.ts:12`, `tests/lib/server/platform.test.ts:11`, all in PR 1's Owns, plus `src/lib/server/cloudflare.ts:11` (owned). `src/features/accounts/accounts.ts` is owned. |

Audit 3's notes: N3-1 (A7 now names the CLI's words), N3-2 (5.1's HTTPS bullet reads in order), N3-3 (`"endpoint": null, "browserOnly": true`), N3-4 ("the end of section 3") and N3-5 (D3 recorded in the status line, 3.2, 3.4, 5.4, A10, PR 4's checklist and 9) are all in the spec.

## Red findings

### R4-1. `sendWhenAgreed` is given to a `sendAgain` the check screen does not have, and to sends the browser never checks
- UNIT: spec 5.3, row "The agreement before send"; 3.2 row "Check and send, and send again"; PR 2's checklist line 2.
- VERDICT: red.
- REQUIREMENT: 5.1 "Calls the same service function the browser's action calls, inside the same rules"; 5.3 "The form action then calls the same thing, and its existing journeys stay green unchanged"; audit 3's R3-1 EXPECTED ("unchanged from the browser").
- REASON: the row says "The check screen's `send` and `sendAgain` actions and the `send` and `new-version` endpoints call it". The check screen has one action, `send`. `sendAgain` is on the game's own screen, beside a second `send` (for a sent-back game) and `newVersion`, and none of those three checks the agreement today. Read as written, the plan adds the check to the browser's `sendAgain` (a browser change) and to the API's `send` for sent-back and live games and to `new-version` (stricter than the browser). The two disagree the day `MAKER_AGREEMENT_VERSION` changes, which is exactly when `hasAgreed` turns false for every maker.
- EVIDENCE: `src/routes/make/[game]/check/+page.server.ts:45-60`: `actions = { send }` only; it checks `hasAgreed` through `whereItIsNotReady` (line 25), and only for a `draft` (line 22; `waiting` is sent back to the game, line 49). `src/routes/make/[game]/+page.server.ts:223-307`: `send` (sent back, from line 232), `sendAgain` (live, from line 245), `newVersion` (live, from line 293) each call `sendForReview` with no agreement check. `src/routes/make/parts/LiveScreen.svelte:67` posts `?/sendAgain` or `?/newVersion`. `src/features/make/agreement.ts:24-30`: `hasAgreed` counts only the current version ("when the agreement changes, every maker is asked again"). Spec 3.2 row 63 maps `check`, `send` and `sendAgain` to the one `POST /api/v1/games/<game>/send`.
- EXPECTED: the agreement is asked where the browser asks it and nowhere else: `sendWhenAgreed` is called by the check screen's `send` and by `POST .../send` when the game is a `draft`; the game screen's `send` (sent back), `sendAgain` and `newVersion`, and `POST .../send` for a sent-back or live game and `POST .../new-version`, call `sendForReview` (with `liveSendOf` for the live cases) as today. A6 step 3 (send on a draft before agreeing is refused) stays as it is.
- FIX: spec 5.3 (that row's "New home" text), PR 2's checklist line 2, and if wanted a short note under 3.2 row 63 saying which state asks for the agreement. Files: the spec only.

### R4-2. `/link` is a first-level address, and the word is not reserved from makers' pages
- UNIT: spec 4.1, 4.5, section 8 PR 1 Owns.
- VERDICT: red.
- REQUIREMENT: A15 (`pnpm test` exits 0 on each head); "the diff touches only files in the plan" (CLAUDE.md); the existing rule in `src/features/pages/handle.ts:9-12` that no maker's page can hide a screen and no screen a page.
- REASON: a maker's page lives at `ruken.io/<handle>` (`src/routes/[handle=handle]/`). PR 1 adds `src/routes/link/`. A test reads every first-level folder of `src/routes/` and fails until the word is in `RESERVED_HANDLES`; `link` is not in it, and `src/features/pages/handle.ts` is not in any Owns. Beyond the test: a maker may already have the page address `link` (it fits the shape, 3 to 30 letters, `isHandleShape`), and a fixed route wins over the matcher (`src/params/handle.ts:3-5`), so that maker's live page would turn into the Yes screen. Memory already holds one such known shadowing bug (games named New or Github).
- EVIDENCE: `tests/features/pages/handle.test.ts:14-26` (`routeAndStaticNames()` reads `src/routes` folders and `static/`, and the test fails on a name not in `RESERVED_HANDLES`); `src/features/pages/handle.ts:13-62` (`RESERVED_HANDLES`, no `link`); `ls src/routes` at `30db00b`: no `link` today. Spec 4.1 step 1 prints `ruken.io/link` and `ruken.io/link?code=...`; 8 PR 1 Owns lists `src/routes/link/` and not `handle.ts`.
- EXPECTED: one of two, said in the spec: (a, recommended) the Yes screen sits under a word Ruken already keeps, for example `/me/link` beside `/me/computers` (`me` is reserved; `/me` already needs a signed-in maker, which the Yes screen needs too), so no new reserved word and no existing page at risk; 4.1's printed line, 4.5, A2 and Owns follow; or (b) PR 1 owns `src/features/pages/handle.ts` to add `link`, and its first step checks production for a page with the address `link` (a read the owner runs or permits), stopping if one exists.
- FIX: spec 4.1, 4.5, A2 if it names the path, section 8 PR 1 (Owns and checklist). Files: the spec only.

## Notes (not blocking, recorded)

- N4-1. A2 still says "A code started from another place (the test sets Cloudflare's city and country for `start` and for the browser differently) shows the warning above Yes". 4.5 says the journey runs on `wrangler dev`, which gives every request the same place, and that the warning case is `tests/routes/link.pg.test.ts`. A2 should point the different-place case to that file, so the implementer does not try to set `cf` in a journey (`playwright.config.ts:86-87` runs `wrangler dev cloudflare/worker.js`).
- N4-2. 5.3 names `sendWhenAgreed(gameId, userId)`, but `hasAgreed` takes the database (`agreement.ts:28`, `hasAgreed(db, userId)`) and the games service comes from `gamesServices()`. Name the parameters the helper takes (for example `(db, service, gameId, userId)`), or say it reads `prisma()` and `gamesServices()` itself as the routes do, so a test can give it a test database.
- N4-3. No test in the repo imports a route module today (`grep -rln "+page.server" tests` finds only folder scans). `tests/routes/link.pg.test.ts` importing `src/routes/link/+page.server.ts` is a new pattern; the `sveltekit()` plugin in `vite.config.ts:25` makes it possible, but putting the place comparison in `computer-keys.ts` and testing it there (`computer-keys.pg.test.ts`) is the pattern the repo already uses. Either is fine; the first commit should prove the chosen one runs.

## Fix check

Each red is fixed in the spec on #318. A fifth plan audit (cycle 5) checks R4-1 and R4-2 against this file on the new head; R3-2 and audit 3's notes need no second look unless the fix changes their text.
