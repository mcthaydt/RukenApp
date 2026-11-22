# Floor Fifty GitHub fix, implementation audit 1 (PR #300)

- Examined: `cf7b2be` on `claude/project-thread-1syb5o`, diffed against `main` (merge base `7b1784a`).
- Lane: 2 (the GitHub connect route and callback). One fresh review.
- Reviewer: Opus 5.5, medium. Audited 2026-11-22 04:30 UTC.
- Verdict: **FAIL: 3 red** (two small, one UX).

## What ran

- `pnpm lint`: exit 0. `pnpm typecheck`: 0 errors, 0 warnings.
- `connect-github`, `make-after` and `make-game-crud` journeys on `computer` and `tablet`, against Postgres 16 in this container: **84 passed, 0 failed**, including the two new journeys and the changed `make-game-crud.test.ts:20`.
- Not run: the `phone` profile (no WebKit here). CI on `cf7b2be` had not started when audited (only `commit-authors` and `pr-rules-run` queued).

## What checks out

- **Tokens never logged.** The callback logs only `found.length`, each `accountLogin` and `repositories.length`. `Connection` (`src/features/games/github-connect.ts:11-15`) holds no token, and the code, the state and repository names are not logged.
- **Route logic.** `src/routes/make/github/+server.ts`: `choose=1` with `install=1`, or a maker not yet connected, goes to the install page; a connected maker without `install=1` goes to sign-in. `hasConnectedGitHub` is only asked when `choose=1` and `install` is not set. A plain connect (no `choose`) still goes to sign-in, as before. The redirect is still limited to the built target's origin.
- **Callback.** `?looked=1` is added only when there is no `installation_id` (a sign-in) and a game; an install, or no game, lands where it did before. `install=1` in an address only picks the install page, which any maker could open anyway, so nothing new is exposed.
- **Files question.** `connectAddress` gets `&install=1` only with `looked=1`. The Live and Taken-off screens' own `connectAddress` (`src/routes/make/[game]/+page.server.ts:179`) still uses `choose=1`, and the callback brings a maker back to the files question either way, as before.
- **Live refusal.** Only `GameError("NOT_CONNECTED")` with a `repoFullName` gets the new words; both places that throw it in this path (`service.ts:395` `checkReachable`, `github.ts:219` `repositoryToken`) mean "Ruken can't see the repository". The words name the existing "Change the game's files" link beside the repo chip, which the journey follows.
- **CRUD.** The thing touched is a game's files choice; its update is walked end to end (`make-after.test.ts` new journey: Change, Choose on GitHub, pick, Save, "Your update is waiting for review."), and create, read and delete stay covered by `make-game-crud.test.ts`.
- **Changed tests** are named in the PR body with reasons.

## Findings

### 1. The live-state file is still on the branch handed to the audit

UNIT: `docs/superpowers/live/claude-project-thread-1syb5o.md`. VERDICT: red. REQUIREMENT: CLAUDE.md "Live state in a file": the session deletes the file in its last commit before it hands the branch to the audit, so the audited commit is the one that merges. REASON: `cf7b2be` adds the file back and the branch was handed to the audit with it. EVIDENCE: `git diff --stat origin/main...cf7b2be` lists `docs/superpowers/live/claude-project-thread-1syb5o.md | 6 +++`; its "Last commit: 240a99f" is already stale. EXPECTED: the reviewed head has no file under `docs/superpowers/live/`. FIX: delete that one file.

### 2. A connected maker's first press can come back to a screen that looks unchanged

UNIT: `src/routes/make/parts/FilesQuestion.svelte` (with `src/routes/make/[game]/[question=question]/+page.server.ts` `filesScreen`). VERDICT: red. REQUIREMENT: the drunk-grandma test (CLAUDE.md, Rules that never bend): nothing that needs explaining. REASON: GitHub's sign-in for an app already authorised returns without showing anything, so when the refreshed list still lacks the game (the exact Floor Fifty case this PR is diagnosing), the maker presses "Choose on GitHub", the page reloads, and the screen is identical; only the link's address changed. Nothing tells her the press worked or that pressing again now opens GitHub's page for choosing. EVIDENCE: `looked` is read only to build `connectAddress` (`+page.server.ts:124-127`); no `.svelte` file reads it, so the screen's words and buttons are the same before and after the trip. EXPECTED: back from that trip (`looked=1`), the screen says in one plain line that Ruken looked again, and what to do if the game is still missing, for example: "Ruken looked again. Still don't see your game? Press Choose on GitHub to add it there." FIX: pass a `looked` flag from `filesScreen` and show one line on the "choose" and "pick" screens of `FilesQuestion.svelte` when it is set; assert the line in the new `connect-github.test.ts` journey. Touches only those three files.

### 3. A duplicated, stale comment in the new Live journey

UNIT: `tests/browser/make-after.test.ts:231-235`. VERDICT: red (small). REQUIREMENT: cohesion of the change (review skill, audit prompt). REASON: the journey's comment is written twice, the first copy cut off before "Now the words point at...". EVIDENCE: lines 231-232 and 233-235 repeat "Floor Fifty on ruken.io: Ruken's list of the maker's games on GitHub no longer held it ...". EXPECTED: one comment. FIX: delete lines 231-232. Touches only that file.

## Notes (not blocking, not fixed here)

- The Taken-off screen still shows the old "Choose it on GitHub" words and link for the same refusal; that path still works (it reaches the files question through GitHub's sign-in now), so it is left as is.
- The log line names GitHub account logins (an org or a person's handle). No secret, and it is what the PR needs for the owner's `wrangler tail`; worth removing once Floor Fifty is understood.
