# Plan audit 2: Ruken from your computer (a command line and an MCP for makers)

- Reviewed: PR #318, head `9c9e4f2` (spec `docs/superpowers/specs/2026-11-22-ruken-from-your-computer-design.md`, reworked after plan audit 1 at `0e2c168`). Code read at the same commit; symbols checked with Graphify (index at `532a3aa`) and by reading the files at `9c9e4f2`.
- Lane: 3 (PR 1 has a migration and a new way to sign in). Reviewer: fresh session, Opus 5.5, medium. Started 2026-11-22 14:04 UTC (from `date`).
- Owner decisions: D1 decided ("Press Yes on Ruken"). D2 (npm) and D3 (agent destructive actions) are open; this audit assumes neither, and checks only that the spec holds under both options.
- Prompt: Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

**Verdict: FAIL, 5 red, 6 notes.** Six of audit 1's nine reds are fixed in full (R2, R3, R4, R5, R6's package shape, R9b). Four carry a gap that the fix itself opened or left (R1, R7, R8, R9a), and one new red: the plan's "Owns" column leaves out files the steps must change. Every red is a spec-only fix.

## Audit 1's reds, checked one by one

| Red | Fixed? | What was checked |
|---|---|---|
| R1 phishing Yes | Partly: see R2-1 | 4.1 shows where and when it was asked, the name "it calls itself", the warning and the bigger No; 4.4 adds `startedFrom`; A2 has the case. Where the place comes from, and how a journey sets it, are not said. |
| R2 key follows account | Yes | 4.3: `active` checked on every request, no `restoreOnSignIn`, keys deleted in `requestDeletion`. Matches `handle.ts:46` (`userStatus !== "active"`) and `deletion.ts:50-76` (the transaction that deletes sessions is where keys go). A4 has the case. |
| R3 revocation triggers | Yes | 4.3 names `changePassword` (`credentials.ts:83`) and the reset (`auth.ts:162`, `revokeSessionsOnPasswordReset`), and says the pause does not touch keys. A4 has both cases and the pause case. (See note N2-2.) |
| R4 limits | Yes | Per maker across keys (5.1), `start` 10 an hour per address, `finish` once per 5 s, 5 wrong codes, Yes 20 an hour, 411 for no length, 20 computers; all on `createRateLimiter`. Its longest window is a day (`rate-limit.ts:17`), and every window named is an hour or less. Per address works in journeys: `CF-Connecting-IP` is already set per worker (`tests/browser/support/rate-limits.ts`). |
| R5 rules in form actions | Yes | 5.3 names a home and a PR for each rule. Every function it names exists: `setShowsPlayerCount` `service.ts:1177`, `putBack` 1199, `deleteLeftFiles` 1190, `takeOff` 1141, `throwAway` 1213, `saveClip` 286, `keepTheOldOne` 1089, `sendForReview` 456, `saveAnswer` 866, `ownGame` 833; pages `pageOf` 211 and the rest; `liveSend` `make/[game]/+page.server.ts:92`; `isBeingMadeEighteen` `[question]/+page.server.ts:75`; `hasAgreed` `src/features/make/agreement.ts:28`. The 18+ row is compatible with the browser: the form redirects to marks before saving (`[question]/+page.server.ts:371-377`), so a service refusal never reaches it. |
| R6 plain JS package | Yes, with a gap in R2-5 | JavaScript, `engines`, pack test A16, `pnpm-workspace.yaml` edited. The "checked by `svelte-check`" claim needs a `tsconfig.json` change nobody owns (R2-5). Node 20 claim: N2-1. |
| R7 file-disjoint PRs | No: see R2-3 | Per-group command and word files fixed. `parity.json` is still one file both PR 2 and PR 3 edit, and A1 needs an MCP tool for every built row before PR 4 makes any. |
| R8 every row stepped | Partly: see R2-4 | A6 and A8 now step nearly every row, and A10 prepares state. `sign-out` and `games` (the list) have no step, and an 18+ change on a past-draft game has no command shape. |
| R9 plain HTTP and publishing | (a) partly: see R2-2; (b) yes | (b): hand publishing from the owner's CLI, CI publishing named as its own lane 3 pull request outside this spec, and 10 says no workflow change. (a): the 400 rule as written breaks the journeys. |

## Red findings

### R2-1. The Yes screen's place has no named source and no way for a journey to set it
- UNIT: spec 4.1, 4.4, A2; PR 1's `/link` step.
- VERDICT: red.
- REQUIREMENT: audit 1 R1's EXPECTED, and "A check is a test that fails by itself" (CLAUDE.md): A2's warning case must be runnable.
- REASON: the spec says "Cloudflare's city and country" for both requests but not where the code reads them, and the code reads no Cloudflare location today. A2 says "the test sets Cloudflare's city and country for `start` and for the browser differently", but the journeys run on `wrangler dev`, which gives every request the same location object, and no seam exists to change it.
- EVIDENCE: `grep -rn "\.cf\b\|platform?.cf" src` finds nothing; `src/lib/server/cloudflare.ts:7-9` says "a Worker has no `platform` handed to each request by this adapter", so `event.platform.cf` cannot be assumed. `playwright.config.ts:87` starts `wrangler dev cloudflare/worker.js`; the only per-journey seam is `CF-Connecting-IP` (`tests/browser/support/rate-limits.ts:9-13`), which carries an address, not a place. If the place has to be read in `cloudflare/worker.js`, that is a lane 3 path PR 1 does not own.
- EXPECTED: the spec names the one function that answers a request's place (for example `placeOf(request)` on the existing `Platform` in `src/lib/server/platform.ts`, filled in `cloudflare.ts` from `request.cf`), says PR 1's first step proves `request.cf.city` and `.country` reach that function on this adapter (and stops and reports if they do not), and names how the warning case is checked: either a test platform whose `placeOf` answers what the test sets, used by a server test of the `/link` load, or a journey seam that the production `placeOf` never reads. The journey then covers the same-place screen.
- FIX: spec 4.1, 4.4 and A2, and PR 1's checklist and Owns. Files: the spec only.

### R2-2. "Plain HTTP gets 400 on `/api/v1`" breaks every CLI journey, as written
- UNIT: spec 5.1, A4; `src/features/accounts/https-only.ts`.
- VERDICT: red.
- REQUIREMENT: A15 (`pnpm test:browser` green) and A4.
- REASON: the journeys' site is `http://localhost:4173` (`playwright.config.ts:99`, `BETTER_AUTH_URL`) and "the CLI" in every journey is `node packages/ruken/bin.js` against it. 5.1 makes `/api/v1` answer any plain-HTTP request with 400, with no condition, so every CLI step in A2 to A11 would get 400. `httpsOnly` avoids this by doing nothing when the site's own address is http (`https-only.ts:27`). If the 400 follows that same condition, A4's "a plain-HTTP request to `/api/v1` gets 400 with no `Location`" cannot be observed in a journey, since the journey site is http.
- EXPECTED: 5.1 says the 400 applies under the same condition as the redirect (the site's address is https), inside `httpsOnly` before its redirect; A4's plain-HTTP case moves to `httpsOnly`'s own unit test (`tests/features/accounts/https-only.test.ts`) with an https site address (the shape its existing redirect test has), and that file is in PR 1's Owns.
- FIX: spec 5.1, A4, PR 1's Owns. Files: the spec only.

### R2-3. PRs 2 and 3 still share `parity.json`, and A1 cannot pass between PR 2 and PR 4
- UNIT: spec 3 ("A check that fails by itself"), section 8.
- VERDICT: red.
- REQUIREMENT: section 8 "Pull requests 2 and 3 share no files"; audit 1 R7 EXPECTED (every PR green on its own).
- REASON (a): PR 2 and PR 3 each set `"built": true` on their rows of the one `packages/ruken/parity.json`; both change the same file, so "share no files" is false and the two branches can conflict.
- REASON (b): the A1 paragraph says the test "needs a command, endpoint and tool to exist only for built rows". MCP tools are written only in PR 4 (`mcp.js`). PR 2 marks its rows built, so A1 fails on PR 2 and PR 3, and on PR 1 for its own rows (`video`, `whoami`, `keep-old`, the list and show), until PR 4 lands.
- EXPECTED: one parity file per command group (`parity/account.json`, `parity/games.json`, `parity/github.json`, `parity/page.json`), each owned by the PR that builds it, and A1 checks the command and endpoint of a built row, and its MCP tool only once `mcp.js` exists (or a separate `"tool": true` flag PR 4 sets in every file, which PR 4 may touch since PRs 2 and 3 are merged by then).
- FIX: spec 3 (the A1 paragraph), 2 (layout), section 8 Owns for PRs 1 to 4. Files: the spec only.

### R2-4. Three parity rows still have no step, or no command shape
- UNIT: spec 3.1, 3.2, A2, A3, A6, A7.
- VERDICT: red.
- REQUIREMENT: audit 1 R8 EXPECTED ("each row in section 3 is named by one journey step that reads its effect back"); CRUD in `build`.
- REASON (a): `ruken sign-out` (`DELETE /api/v1/me/key`) is in no step. A3 removes the computer in the browser, not with `sign-out`.
- REASON (b): `ruken games` (`GET /api/v1/games`, `list_games`) is in no step; A6 reads back with `game <game>` only.
- REASON (c): 5.3 makes `saveAnswer` refuse 18+ on a past-draft game unless the marks come in the same answer, but the command is `ruken set <game> age|marks <value>`, one part per call, so no command can make a live, waiting, sent-back or taken-off game 18+. The browser can (`/make/<game>/marks?age=18`). A7 only covers a draft.
- EXPECTED: A3 (or A2) runs `sign-out` and then `whoami` answers "Sign in again", and the computer is gone from Your computers; A6 runs `games` after `new` and after `throw-away` and reads the list; 3.2's row gives a shape for 18+ with marks in one call (for example `ruken set <game> age 18 --marks <m,...>`), `set_answer` takes both, and A7 adds a live game made 18+ through the CLI.
- FIX: spec 3.2, A3, A6, A7. Files: the spec only.

### R2-5. The plan's "Owns" column leaves out files its own steps must change
- UNIT: section 8 table.
- VERDICT: red.
- REQUIREMENT: "the diff touches only files in the plan" (CLAUDE.md, a check is a test that fails by itself); Risk (lane by path: `src/hooks.server.ts`, `src/lib/`, `package.json`, `pnpm-lock.yaml`, config are lane 2 paths the plan must name).
- REASON: steps in section 8 change files no unit owns:
  - PR 1: `src/features/accounts/handle.ts` (and possibly `src/hooks.server.ts`) for "the key read only under `/api/v1`, the cookie ignored there"; `src/features/accounts/https-only.ts` (R2-2); `src/features/accounts/credentials.ts`, `auth.ts`, `deletion.ts` (keys removed); `src/routes/me/+page.svelte` (the link to Your computers); `src/routes/make/[game]/[question=question]/+page.server.ts` (the form actions call the moved rules); `src/lib/server/platform.ts` and `cloudflare.ts` (R2-1); `tsconfig.json` (its `include` has no `packages/`, `tsconfig.json:29-38`, so the "JSDoc checked by `svelte-check`" in section 2 does not happen without it); `pnpm-lock.yaml` (a new workspace package adds an importer, and CI installs `--frozen-lockfile`); and the journey files under `tests/browser/`.
  - PR 2: `src/features/make/agreement.ts` (where `hasAgreed` lives, not `src/features/games/`), `src/routes/make/[game]/+page.server.ts`, `check/+page.server.ts`, `throw-away/`, `take-off/`, `[question=question]/+page.server.ts` (the form actions call the moved rules).
  - PR 3: `src/routes/make/page/**` if its check finds a rule.
  - PR 4: `src/routes/help/+page.svelte` (or wherever the `/help` list is), `src/routes/help/get-your-game-on-ruken/agent-prompt.ts`.
- EXPECTED: each unit's Owns lists every path its checklist changes, so the plan audit's lane and the "only files in the plan" check can be judged from it. PR 2 and PR 3 stay disjoint (they are: games and make routes against page routes).
- FIX: section 8 table. Files: the spec only.

## Notes (not blocking, recorded)

- N2-1. Section 2 says `engines.node >=20` is "the oldest Node still supported upstream on 2026-11-22". Node 20 reached end of life on 2026-04-30; the oldest supported line on 2026-11-22 is Node 22. Either say `>=22` with that reason, or keep `>=20` and drop the claim.
- N2-2. `onPasswordReset` (`auth.ts:162-163` onward) must never throw, or better-auth skips signing every device out. Deleting keys there goes inside its own try/catch, or into the same step that ends sessions, and a test covers a failing key delete still ending sessions.
- N2-3. A4's "an expired key (clock moved 91 days)": the journeys cannot move the site's clock (`tests/browser/support/database.ts` comments: "the dates move instead"). Say the key's `lastUsedAt` and `createdAt` are moved back 91 days.
- N2-4. 5.3's "every question answered" row: `sendForReview` already refuses with "Answer every question first." (`service.ts:493`). The row should say the words stay as they are, or name the change and the screen it affects.
- N2-5. A16 does not say which suite runs the pack test (`pnpm test` or `test:browser`), and A15's list should include it.
- N2-6. `ruken github connect` (opens the browser and waits) is not run as a command in A6; the journey connects GitHub the way existing journeys do. A step that runs the command with the browser opener stubbed and reads `github` connected afterwards would cover its wait.

## Fix check

Each red is fixed in the spec on #318. A third plan audit (cycle 3) checks each fix against this file, on the new head.
