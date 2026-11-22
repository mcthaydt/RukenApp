# Plan audit 1: Ruken from your computer (a command line and an MCP for makers)

- Reviewed: PR #318, head `2dc4758` (spec `docs/superpowers/specs/2026-11-22-ruken-from-your-computer-design.md`; D1 recorded as "Press Yes on Ruken"). Code read at the same commit.
- Lane: 3 (PR 1 has a migration and a new way to sign in). Reviewer: fresh session, Opus 5.5, medium.
- Prompt: Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

**Verdict: FAIL, 9 red, 8 notes.** The shape is sound (key only under `/api/v1`, services not screens, hashed keys, no account screens, agreement kept from agents, a parity check that fails by itself, a tickable checklist). The reds are gaps where the server-side rules the spec promises do not yet match how the code works today, and plan details that would break the build order.

## What holds (checked)

- `own-game.server.ts`, `own-page.server.ts`, `clipProblem` (`src/features/games/clips.ts:66`), `photoProblem` (`src/features/pages/photo.ts:63`), `CLIP_MAX_BYTES`, `questionsFor`, `askedQuestion`, `saveHeldClip` all exist where the spec says.
- `ownGame` already answers 404, never 403, for a game that is not the caller's (`src/routes/make/own-game.server.ts`). A key that sets `locals.caller` to the maker reuses it unchanged.
- 18+ rating and marks are enforced in the games service (`src/features/games/service.ts:942-972`), so the API inherits them.
- The plan is a checklist the implementer ticks, per pull request. No unit mixes rules files with product code under the rule-mix hook (`.claude/hooks/rules.json` `ruleMix.rulePaths`): none of PRs 1 to 4 touches `CLAUDE.md`, a shared skill or `.github/workflows/` (but see R9).
- Keeping `/me` (password, delete, membership) browser only, and the MCP having no agreement tool, are the right calls for a key that lives on a laptop.

## Red findings

### R1. The prefilled Yes link is a phishing route to a key
- UNIT: spec 4.1, `src/routes/link/`.
- REQUIREMENT: spec 1 ("Ruken's server applies every rule"), Rules that never bend (credentials are lane 3).
- REASON: anyone can run `npx ruken sign-in`, then send a maker `ruken.io/link?code=XXXX-XXXX`; one press of the big Yes gives the stranger a key to the maker's games. This is the known device-code phishing pattern. The only guard is a sentence, and the computer's name is chosen by the stranger.
- EVIDENCE: spec 4.1 steps 1-2: the code arrives in the address, and the screen's one main action is Yes.
- EXPECTED: the Yes screen shows facts the stranger cannot choose: where the request came from (Cloudflare's city and country for the `start` request, compared in words with where the press comes from: "This was asked from Lisbon, Portugal, 40 seconds ago"), and the computer's name labelled as what it calls itself. When the two places differ, the screen says so above the button. Keep the prefill (D1 is decided and the flow stays) but a code is good only for a Yes within 10 minutes of `start`, as now.
- FIX: spec 4.1 and 4.4 (`ComputerSignIn` gains `startedFrom`), the PR 1 `/link` step, and A2 gains a case: a code started from another place shows the warning. Files: the spec only.

### R2. A key must follow the account's status, as a session does
- UNIT: spec 4.3, 4.4; `computer-keys.ts`, `src/features/accounts/handle.ts`.
- REQUIREMENT: spec 4.3 ("a key stops working when the maker ... deletes their account").
- REASON: deleting an account does not delete the user. It starts a 14-day `pending_deletion` wait in which every session is gone and signing in again undoes it (`src/features/accounts/deletion.ts:6-11`, `restoreOnSignIn` at `auth.ts:301`). "Cascade on account delete" fires only at purge, so a key would keep working for 14 days after "Delete my account".
- EVIDENCE: `handle.ts:46`: a session gives a `user` caller only when `userStatus === "active"`. The spec's key read has no such check.
- EXPECTED: a key gives a `user` caller only for an `active` account, checked on every request; a key's use never calls `restoreOnSignIn` (it is not a sign-in); asking to delete the account deletes the maker's keys at once, as it ends their sessions.
- FIX: spec 4.3 and the PR 1 `computer-keys.ts` step; A4 gains "a key after Delete my account gets 401". Files: the spec only.

### R3. Revocation names the wrong triggers
- UNIT: spec 4.3.
- REQUIREMENT: spec 4.3.
- REASON (a): a password is changed in two places. `changePassword` (`credentials.ts:80-103`, revokes other sessions) and the reset by text (`auth.ts:162`, `revokeSessionsOnPasswordReset: true`). The plan hooks only "where the password change happens".
- REASON (b): "A paused sign-in pauses keys too" misreads `sign-in-pause-plugin.ts`. That pause is per phone number, started by ten wrong password guesses from anyone (`sign-in-pause-plugin.ts:14-27`). Tying keys to it lets a stranger switch off a maker's computers by guessing at their number.
- EXPECTED: keys are removed on both password change and password reset; the pause does not touch keys.
- FIX: spec 4.3 and the PR 1 step; A4's "key after a password change" gains "and after a reset by text". Files: the spec only.

### R4. Limits per key leave the unsigned and multi-key paths open
- UNIT: spec 4.3, 5.1, 5.2.
- REQUIREMENT: spec 5.1 limits, A9, A11.
- REASON: (a) a maker can make any number of keys, so "30 uploads an hour per key" is no limit; (b) `POST /api/v1/sign-in/start` needs no key and has no limit, so anyone can fill `ComputerSignIn`; (c) the video upload is refused early only by `Content-Length`; a body sent without one is read whole (`[question]/+page.server.ts:414` treats a missing header as 0).
- EXPECTED: uploads and requests counted per maker (keep per key as well if wanted); `start` limited per address (for example 10 an hour) and `finish` polling limited as spec says; an upload with no `Content-Length` gets 411 before its body is read; at most 20 computers per maker.
- FIX: spec 4.3, 5.1, 5.2, and A11 gains the `start` and no-length cases. Reuse `createRateLimiter` (`src/lib/server/rate-limit.ts`, `api:` keys); this also answers open question 1: no new table. Files: the spec only.

### R5. The list of rules to move out of form actions is incomplete, and PR 1 needs some of them
- UNIT: spec 5.3, plan PR 1 and PR 2.
- REQUIREMENT: spec 2 ("A rule that today lives only in a form action moves into the service ... in the same pull request") and 5.3 ("the plan names each one's new home").
- REASON: the plan names no homes and leaves "anything else" to the implementer. Rules that live only in routes today and are missing from 5.3:
  - the agreement gate: `hasAgreed` is checked only in `make/[game]/check/+page.server.ts:25` and `send`; `sendForReview` does not check it (no `agree` in `src/features/games/service.ts`). Spec 5.4's refusal ("You need to agree ... first") depends on it;
  - every question answered before send (`firstUnanswered`, the same file);
  - `liveSend` (`make/[game]/+page.server.ts`): whether a live game offers a new version, a send again or nothing;
  - `isBeingMadeEighteen`: marks asked before a past-draft game becomes 18+ (`[question]/+page.server.ts`);
  - `CLIP_REQUEST_MAX_BYTES`, the video question only for `upright`/`wide`, and `keepOld` only for a live game (`[question]/+page.server.ts:414-447`);
  - `playerCount`, `putBack`, `deleteLeft`, `take-off` and `throw-away` state checks (`throw-away/+page.server.ts:11`).
  The video and keep-old ones are needed by PR 1's `PUT .../videos` and `DELETE .../waiting`, but the plan moves rules only in PR 2.
- EXPECTED: 5.3 lists each rule above with its new home (service function or shared helper); PR 1 moves the video and keep-old ones; PR 2 the rest.
- FIX: spec 5.3 and the PR 1 and PR 2 checklists. Files: the spec only.

### R6. The published package cannot be TypeScript
- UNIT: spec 2, 7 (A12 names `words.ts`), `packages/ruken/`.
- REQUIREMENT: spec 1 (`npx ruken` works on a maker's computer), D2.
- REASON: Node refuses to strip types from files under `node_modules` (`ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`), which is where `npx` puts the package. A `bin.js` importing `words.ts` works from the checkout and fails for every maker.
- EXPECTED: the package ships JavaScript only, with `engines.node` set to the oldest Node it supports; a test packs it (`pnpm pack`), installs the tarball in a temp folder outside the repo and runs `npx ruken --help` from there.
- FIX: spec 2 and 7 (`words.js`, or `.ts` compiled into the tarball by a named build step), and PR 1's package step gains the pack test. Also correct "`pnpm-workspace.yaml` is new": it exists and says "One app, no workspaces" (`pnpm-workspace.yaml:1`); the plan edits it. Files: the spec only.

### R7. PRs 2 and 3 are not file-disjoint, and the parity check has no partial state
- UNIT: plan table, section 8.
- REQUIREMENT: section 8 ("Pull requests 2 and 3 share no files and run side by side").
- REASON: both add commands to `packages/ruken/` (the command list in `bin.js`, `words.ts`, `parity.json`), and both own "A1 (part)". A1 as written fails while any action under `src/routes/make/` has no entry, so PR 2 is red until PR 3's page rows exist, and the reverse.
- EXPECTED: PR 1 lays out one file per command group (`commands/games.js`, `commands/page.js`, `words/games.js`, ...) and a `parity.json` that already lists every action, with rows not built yet marked `"pr": 2|3|4` that A1 accepts; PRs 2 and 3 each fill only their own files.
- FIX: section 8 table and the PR 1 package step. Files: the spec only.

### R8. Several parity rows have no step that observes them
- UNIT: A6, A8, A10.
- REQUIREMENT: CRUD in `build` and the `review` skill; CLAUDE.md Verification.
- REASON: no journey step runs: `delete-files` (a taken-off game with files left), `player-count on|off`, `keep-old age`, `send` for a sent-back game (send again) and `update` (new version), `files` change on a live game, `repos`/`branches`, `github connect`, `links up|down|show`, `page set address`, `page colours`. A10 calls each MCP tool once but names no state for it, so a tool can "match its command" by both refusing.
- EXPECTED: each row in section 3 is named by one journey step that reads its effect back (CLI and browser), and A10 says each call succeeds against prepared state.
- FIX: A6, A8 and A10 in section 7. Files: the spec only.

### R9. A plain-HTTP and a publishing gap the plan does not name
- UNIT: spec 4.3, 5.1, section 8 "After pull request 1 merges".
- REQUIREMENT: spec 5.1 ("HTTPS only"), the rule-mix hook, lane 3 for `.github/`.
- REASON (a): `https-only.ts` redirects plain HTTP. For the API the key has already crossed the wire by then, and the redirect invites the client to send it again.
- REASON (b): D2's recommended option publishes from CI with an npm token. That is a `.github/workflows/` change (a rule path), so it cannot travel with the code in any of PRs 1 to 4, and no unit holds it.
- EXPECTED: `/api/v1` answers plain HTTP with 400 and no redirect; the CLI refuses any address that is not `https://` except `localhost` for tests. Under D2 option A, a fifth pull request (lane 3, workflow only) adds publishing, or the owner publishes by hand from the CLI (`pnpm --filter ruken publish`), named as such.
- FIX: spec 4.3, 5.1, section 8 and 9. Files: the spec only.

## Notes (not blocking)

- N1. MCP `confirm` is not a person's check: an agent knows the game's address word, and a prompt hidden in a repository can supply it. Throw away and take the page down cannot be undone. Consider leaving those two out of the MCP, as the agreement is, and printing the terminal command instead. That changes parity, so it is the owner's call if taken up.
- N2. `send_video` and `set_photo` read any path the agent names. Check the extension and size before reading, and never print file contents in errors.
- N3. Expired codes: deleting them in the hourly job touches `cloudflare/crons.js` (lane 3) and is not in PR 1's "Owns". Delete on read, or add the path.
- N4. `lastUsedAt` written on every request is a write per call; write it at most once an hour.
- N5. `finish` should need the device secret, as the `deviceSecretHash` column implies; say so in 4.3.
- N6. Make sure no log or error report holds the `Authorization` header.
- N8. Say that `/api/v1` authenticates by key only and ignores the session cookie (`hooks.server.ts` sets a cookie caller on every route). SvelteKit's origin check already covers form and `text/plain` posts, so this is clarity, not a hole.
- N7. Open question 2: `clipProblem` takes the whole file as bytes, so reading the body once with `arrayBuffer()` after the `Content-Length` check (R4) is the same as the browser and within the Worker's 128 MB. No streaming needed.

## The open owner decision (D2), both options

- **A: `ruken` on npm.** Short to type, and the MCP line `npx -y ruken mcp` is what agents will guess. Costs: the owner's npm account (new access), 2FA on it. Publishing from CI can use npm's trusted publishing from GitHub Actions instead of a saved npm token, so no long-lived token sits in GitHub secrets; either way it is a workflow PR of its own (R9). Hand publishing from the owner's CLI needs no secret at all.
- **B: `npx https://ruken.io/ruken.tgz`.** No new account; the package updates with each deploy. Risk: the name `ruken` stays free on npm, and anyone can publish a package by that name. Makers and agents who type `npx ruken` from habit would run a stranger's code on the computer that holds their key. If B is chosen, the owner should still reserve the name on npm (an empty package), which needs the npm account anyway.
- Either way, the command prefix should live in one place in `words.*` so the help guide, the MCP line and every message change together.

## Fix check

Each red is fixed in the spec on #318. A second plan audit (cycle 2) checks each fix against this file, on the new head.
