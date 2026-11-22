# Plan audit 3: Ruken from your computer (a command line and an MCP for makers)

- Reviewed: PR #318, head `2b55c74` (spec `docs/superpowers/specs/2026-11-22-ruken-from-your-computer-design.md`, reworked after plan audit 2 at `29a795f`). Code read at the same commit (the code under the spec is `main` at `16dee78`; the PR changes only docs).
- Lane: 3 (PR 1 has a migration and a new way to sign in). Reviewer: fresh session, Opus 5.5, medium. Started 2026-11-22 14:09 UTC (from `date`).
- Owner decisions: D1 decided ("Press Yes on Ruken"). D2 (npm) and D3 (agent destructive actions) are open; this audit assumes neither.
- Prompt: Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

**Verdict: FAIL, 2 red, 5 notes.** All five of audit 2's reds are fixed as asked, and its six notes were taken. Two new reds come from checking the fixes against the code: the agreement rule's new home breaks the feature layer rule and changes two browser paths, and some test files named or touched by PR 1 are in the wrong test project or not owned. Both are spec-only fixes.

## Audit 2's reds, checked one by one

| Red | Fixed? | What was checked |
|---|---|---|
| R2-1 place of a request | Yes | 4.5 names `placeOf(request)` on `Platform` (`src/lib/server/platform.ts`, which exists and is set per test, "every test sets its own"), filled in `cloudflare.ts` from `request.cf`; PR 1's first step proves `cf` arrives and stops if not (`cloudflare/worker.js:16,20` passes the request through to `site.fetch`, so it is plausible; the step decides). The warning case is a server test with a test platform; the journey covers same-place. Two gaps in how the tests are named and owned: R3-2. |
| R2-2 plain HTTP 400 | Yes | 5.1 puts the 400 inside `httpsOnly` under its existing condition (`https-only.ts:27`, `protocol !== "https:"` returns early), so the `http://localhost:4173` journeys are untouched. A4 moves the case to `tests/features/accounts/https-only.test.ts`, which exists and already builds an https site address (`answer("https://ruken.io", ...)`, lines 18-37). The file is in PR 1's Owns. One sentence is garbled: N3-2. |
| R2-3 shared parity file | Yes | Four `parity/*.json` files, one per group; PR 2 writes `games.json` and `github.json`, PR 3 `page.json`, PR 4 all four after both merge. A1 checks MCP tools only once `mcp.js` exists, so PRs 1 to 3 can be green on their own. One row shape gap: N3-3. |
| R2-4 rows with no step | Yes | A3 runs `sign-out` then `whoami` and reads Your computers; A6.2 and A6.7 run `games` before and after `new` and after `throw-away`; 3.2 gives `set <game> age 18 --marks ...`, `set_answer` takes both, A7 covers a live 12+ game. The "browser's words" for the refusal do not exist: N3-1. |
| R2-5 Owns column | Mostly | Every path audit 2 listed is now owned: `handle.ts`, `https-only.ts`, `credentials.ts`, `auth.ts`, `deletion.ts`, `hooks.server.ts`, `platform.ts`, `cloudflare.ts`, `me/+page.svelte`, the `[question]` and `[game]` form actions, `check/`, `take-off/`, `throw-away/`, `agreement.ts`, `tsconfig.json`, `pnpm-lock.yaml`, `/help` list and `agent-prompt.ts`. Still missing: the accounts entry file and the test files the `Platform` change breaks (R3-2). |

Audit 2's notes: N2-1 (`>=22`), N2-2 (try/catch in `onPasswordReset`, with a test), N2-3 (dates moved back), N2-4 (words kept, `question` field), N2-5 (pack test in `pnpm test`), N2-6 (`github connect` with the opener stubbed) are all in the spec.

## Red findings

### R3-1. The agreement check's new home breaks the layer rule and changes put back and live updates
- UNIT: spec 5.3, row "The agreement before send"; PR 2.
- VERDICT: red.
- REQUIREMENT: 5.3's own rule "the form action then calls the same thing, and its existing journeys stay green unchanged"; the layer rule in `tests/architecture.test.ts` (part of `pnpm test`, A15).
- REASON: the row makes `sendForReview` in the games service refuse when the maker has not agreed. `hasAgreed` lives in the `make` feature, which sits above `games`, so the games service cannot import it; and `sendForReview` is also called by `putBack` and by the automatic live update, which do not check the agreement in the browser today.
- EVIDENCE: `tests/architecture.test.ts:12-24` orders the features `accounts, membership, games, ..., make, ...` and fails any feature importing one at or above itself (line 60, "may only import features below it"). `hasAgreed` is in `src/features/make/agreement.ts:28`, exported by `src/features/make/make.ts:4`. `sendForReview` (`src/features/games/service.ts:456`) is called by `sendLiveUpdate` (line 1052, run when a live game's answer is saved) and `putBack` (line 1202). Today the agreement is checked only on the check screen (`src/routes/make/[game]/check/+page.server.ts:25`) and the agreement screen. Putting the check inside `sendForReview` would make a maker whose agreement is an older version unable to put a game back, and would make a live game's saved change throw or silently not send.
- EXPECTED: the spec names a home that both callers can use without moving the rule into `games`: for example one helper in `src/features/make/` (say `sendWhenAgreed(db, games, gameId, userId)`, exported from `make.ts`) that checks `hasAgreed` and then calls `sendForReview`, used by the check screen's `send`/`sendAgain` actions and by the `send` and `new-version` endpoints. It says plainly whether `put-back` and live updates need the agreement (recommended: unchanged from the browser, so no), and A6 step 3 stays as it is.
- FIX: spec 5.3 (that row), section 8 PR 2 Owns (`src/features/make/make.ts` and the helper's file), PR 2's checklist. Files: the spec only.

### R3-2. PR 1's tests: two are in the wrong project, and the `Platform` change touches files nobody owns
- UNIT: spec 4.5 ("How it is checked"), section 8 PR 1 Owns.
- VERDICT: red.
- REQUIREMENT: "a check is a test that fails by itself" and "the diff touches only files in the plan" (CLAUDE.md); A15 (`pnpm typecheck`, `pnpm test`, `pnpm test:pg` exit 0).
- REASON (a): 4.5 says `tests/routes/link.test.ts` runs under `pnpm test:pg`, and Owns lists `tests/features/accounts/computer-keys.test.ts`. Both need the database (the Yes action writes `ComputerSignIn`; `computer-keys.ts` reads and writes keys), but a name without `.pg.` runs in the unit project, which has no database, and never in `test:pg`.
- EVIDENCE (a): `vite.config.ts:35-37`, unit project: `include: ["tests/**/*.test.ts"]`, `exclude: [..., "**/*.pg.test.ts"]`; `vite.config.ts:43-44`, postgres project: `include: ["tests/**/*.pg.test.ts"]`. The existing database tests follow that name (`tests/features/accounts/credentials.pg.test.ts`, `deletion.pg.test.ts`, `auth.pg.test.ts`).
- REASON (b): adding a required `placeOf` to the `Platform` interface makes every existing test platform fail `pnpm typecheck` (the tsconfig is `strict` with `exactOptionalPropertyTypes`), and those files are not in any Owns. N2-2's own test (a failing key delete still ends sessions in `onPasswordReset`) belongs beside the existing reset tests in `auth.pg.test.ts`, also not owned. The routes and hooks reach accounts code through its entry file, `src/features/accounts/accounts.ts`, which is not owned either, so the new key services cannot be reached without an unowned edit.
- EVIDENCE (b): `setPlatform({ databaseUrl: () => "", waitUntil: () => undefined })` at `tests/features/accounts/auth.pg.test.ts:971` and again at 1027; `tests/lib/server/background.test.ts:12`; `tests/lib/server/platform.test.ts:13` (a `Platform` value). `src/hooks.server.ts:2` imports `createHandle`, `httpsOnly` and `authServices` from `features/accounts/accounts.ts`, and every route under `src/routes/` that uses accounts imports from that file (for example `src/routes/forgot-password/+page.server.ts:1`).
- EXPECTED: the two database tests are named `*.pg.test.ts` (`tests/routes/link.pg.test.ts`, `tests/features/accounts/computer-keys.pg.test.ts`), and 4.5, A4 and Owns say so. Either `placeOf` is optional on `Platform` (with "no place" when absent), or PR 1 owns `tests/lib/server/platform.test.ts`, `tests/lib/server/background.test.ts` and `tests/features/accounts/auth.pg.test.ts`; `auth.pg.test.ts` is owned anyway for N2-2's test. `src/features/accounts/accounts.ts` is in PR 1's Owns.
- FIX: spec 4.5, A4 (if it names test files), section 8 PR 1 Owns. Files: the spec only.

## Notes (not blocking, recorded)

- N3-1. A7 and 5.3 say `set <game> age 18` alone on a live game "is refused with the browser's words". The browser never refuses that: it sends the maker to the marks question (`src/routes/make/[game]/[question=question]/+page.server.ts:378-385`, `redirect(303, .../marks?age=18)`). Name the words the API and the CLI give (for example "Choose its 18+ marks too: npx ruken set <game> age 18 --marks <marks>"), in `words/games.js`.
- N3-2. 5.1's HTTPS bullet has a clause out of place: "...as the redirect does nothing; since the key has already crossed the wire and a redirect invites it again; `https-only.ts` keeps redirecting...". The reason for answering 400 and not redirecting should follow the 400 sentence.
- N3-3. A1 says every built row has "its command and its endpoint". The `github connect` row has a command and no endpoint (browser only, 3.3). Say how a parity row marks that (for example `"endpoint": null` with `"browserOnly": true`) so A1 neither fails nor pushes a made-up endpoint.
- N3-4. A1 in section 7 says "the parity test in section 3.5"; the test is described at the end of section 3, after 3.5. Point to "section 3" instead.
- N3-5. The owner decided D3 after this audit started (relayed 2026-11-22 14:10 UTC): no MCP tool for throwing a game away or taking the page down; only the person, in the terminal. The spec at `2b55c74` still lists D3 as pending (status line, 3.2 and 3.4 rows, 5.4, A10, 9). The builder records the decision and removes the other option. This does not fail the plan.

## Fix check

Each red is fixed in the spec on #318. A fourth plan audit (cycle 4) checks R3-1 and R3-2 against this file on the new head; the five reds of audit 2 need no second look unless the fix changes their text.
