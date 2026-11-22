# Ruken from your computer, PR 2: implementation audit 5

**4d2e412 FAIL: 3 red**

- Reviewed: branch `claude/project-thread-ii8h7y` at `4d2e412`, off `main` `5f1e0c7`. Lane 2, fresh review.
- Brief: `docs/superpowers/specs/2026-11-22-ruken-from-your-computer-design.md`, section 8 "Pull request 2", 3.2, 3.3, the 5.3 rows marked PR 2, 5.4, and A5 to A7.
- Written 2026-11-22 18:02 UTC (from `date`).

## What ran (on 4d2e412, in a cloud container, Postgres 16 local)

| Check | Result |
|---|---|
| `pnpm lint` | exit 0 |
| `pnpm typecheck` | exit 0 (0 errors, 0 warnings) |
| `pnpm test` | 1946 of 1948 passed. The 2 failures were `tests/rules-pr-routes.test.ts` timing out at 5 s while lint and typecheck ran beside it; that file alone passed 33 of 33. Not touched by this change (N6). |
| `pnpm test:pg` | exit 0, 766 passed, 51 files (includes the new `send.pg.test.ts`) |
| `pnpm test:browser --project tablet --project computer --workers 3` | exit 0, 1126 passed, 114 skipped, 0 failed, 0 flaky, 20.9 min. Includes the three `cli-games.test.ts` journeys on both profiles. WebKit (phone) not run here: CI only. |
| `pnpm build` | ran inside the journeys' web server (green); not run on its own. |

## Security (only the maker acts on their own games and keys)

Holds. Every new games route goes through `onGame` or `ownGameOr404` after `maker(event)` (`game-call.server.ts:448-465`, `[game]/+server.ts` DELETE, `games/+server.ts` POST), so another maker's key gets 404 and the game is never read past the slug check. The branches route checks the repository is in this maker's `repositoriesFor` before asking GitHub (`branches/+server.ts:538`). A `files` answer goes through `saveAnswer`, which runs `checkReachable(makerUserId, fullName)`. The agreement is recorded only for the key's own maker, and only after a typed `yes` in the CLI (`commands/games.js` `agree`); no MCP exists yet (PR 4). The A5 journey proves 404 for GET, PATCH, DELETE, send, new-version, take-off, put-back, files, waiting and the video PUT, then that the same calls are 200 for the owner and the game reads back unchanged. Green on tablet and computer.

## Parity with the screens

`sendWhenAgreed` is called only by the check screen's `send` and the API `send` for a `draft`. Sent back, send again, put back and live saves call `sendForReview` with no agreement check, as 5.3 says. `send.pg.test.ts` proves the refusal, the send after agreeing, and that the service alone still sends. `liveSendOf` moved out of the game screen with no change, and the screen and `sendAgain` read it. The 18+ refusal was already in `saveAnswer`; this change adds `field: "marks"`, which the CLI turns into the A7 words. `setShowsPlayerCount` now refuses a game that is not live. `takeOff`, `putBack`, `deleteLeftFiles` and `throwAway` already refused the states their screens do not offer. One gap is R1 below.

## Red

### R1. `new-version` does not read `liveSendOf`
- UNIT: `src/routes/api/v1/games/[game]/new-version/+server.ts`
- VERDICT: red
- REQUIREMENT: spec 5.3, the `liveSend` row: "a `liveSendOf(game)` helper ... read by the screen and by `send` and `new-version` endpoints".
- REASON: the endpoint checks only `game.state !== "live"`, then copies from GitHub and sends. It never asks `liveSendOf`.
- EVIDENCE: `new-version/+server.ts:328` is the only check. The screen offers "Send a new version" only when `send === "new_version"` (`LiveScreen.svelte:119`, and `:63` posts `?/sendAgain` when it is `"again"`). So when staff sent back a name or a line on a live update (`liveSendOf` is `"none"` or `"again"`), `npx ruken update <game>` copies the files from GitHub (`pullLatest`, which writes a new pull). For `"none"`, `sendForReview` then refuses with "Fix what was sent back first." For `"again"`, it sends a fresh copy where the screen would send the held copy again.
- EXPECTED: `new-version` refuses unless `liveSendOf(game) === "new_version"`. Use the screen's words, "That game can't be sent right now.", plus a next step for `"again"` (`npx ruken send <game>`), before any copy is made.
- FIX: one check in `new-version/+server.ts`, and its words in `packages/ruken/words/games.js` if the CLI adds the next step. Add a journey step or a request in `tests/browser/cli-games.test.ts` that gets the refusal when a live update was sent back for its line, with no new pull written.

### R2. The A6 journey leaves out steps the criterion names
- UNIT: `tests/browser/cli-games.test.ts`
- VERDICT: red
- REQUIREMENT: spec A6 (audit 1, R8: "every row of 3.2 and 3.3 is a step that reads its effect back with `game <game>` and in the browser"), and the CRUD rule.
- REASON: these steps listed in A6 are missing:
  1. A6.2 `set name` is never run. The name only comes from `new`, so the rename path and the address it moves to are untested.
  2. A6.2 `files` "with branch and folder": `--folder` is never passed. `--branch` appears only once, on the live game.
  3. A6.3 "Staff send the files back by the existing review command; `send` again after `files` is fixed (send again)": missing. The API `send` for `sent_back`, and the live `"again"` path, are never run.
  4. A6.5 "the count shows, then not, on the game's page": checked in the database (`showsPlayerCountOf`) and in `game`, but not on `/g/<game>`.
  5. A6.4 and A6.7 feed reads: "live on the feed", take-off "(leaves the feed)", put-back "(returns)". None of these looks at the feed. After `delete-files`, "the files screen says they are gone" is not read either.
- EVIDENCE: the test file at 4d2e412. `answerAll` runs `new`, `set line`, `files` (no flags), both videos and `set age`. No `reviewJob` with a send-back order appears anywhere. The browser reads are only `/g/<slug>` heading after the first accept and the A7 adults-only screen.
- EXPECTED: each listed step runs and reads its effect back as A6 says.
- FIX: `tests/browser/cli-games.test.ts` only, plus a support helper under `tests/browser/support/` if a send-back order needs one. If the fake GitHub has no repository with a folder, use one it serves or add one there (`tests/browser/support/fake-github-server.ts`).

### R3. "Connected. Ruken can see 3 on GitHub." is missing its noun
- UNIT: `packages/ruken/words/github.js`, `nowConnected`
- VERDICT: red (small)
- REQUIREMENT: the drunk-grandma rule (CLAUDE.md) and spec 6.
- REASON: the line reads "Ruken can see 3 on GitHub". Three of what? The sibling line `connected` says "1 game folder" or "N game folders".
- EVIDENCE: `words/github.js` `nowConnected: (repos) => \`Connected. Ruken can see ${String(repos)} on GitHub. ...\``.
- EXPECTED: the same counted noun as `connected`, for example "Connected. Ruken can see 3 game folders on GitHub. See them with: npx ruken repos". The journey keeps matching "Connected.".
- FIX: `packages/ruken/words/github.js` only.

## Notes (not blocking, follow-ups)

- N1. `PATCH /api/v1/games/<game>` saves several answers one after another (`[game]/+server.ts:280`). A refusal part way leaves the earlier answers saved, and `playerCount` runs after them. The browser saves one answer per press, so this is new behaviour, but only when a caller sends several fields. The CLI always sends one, or age with its marks.
- N2. `AGES` and `MARKS` in `[game]/+server.ts:214-215` copy lists the games feature already has (`AGE_RATINGS`, `CONTENT_MARKS`). Exporting and reusing those keeps the two from drifting.
- N3. `words.games.nothingDone` is never used.
- N4. API `send` on a live game whose send is a new version answers "That game can't be sent again right now." with no next command. The CLI could add "Send its newest files with: npx ruken update <game>". This goes with R1.
- N5. The branches route answers 404 for a repository that is not the maker's, where the browser's list answers empty. This follows 5.1's "never say it exists" and is fine. The builder said so in the notes.
- N6. `tests/rules-pr-routes.test.ts` (two `gh api` create tests) timed out at 5 s with lint and typecheck running beside it, and passed alone. It is not part of this change. It counts as a flake only if it repeats in CI.

## CRUD

- Games: create (`new`), read (`games`, `game`), update (`set line`, `set websites`, `set age`, `files`, videos, `player-count`, `keep-old`) and delete (`throw-away`) are all in the journey. Update by `set name` is missing (R2.1).
- Agreement: create only, by design (it cannot be taken back in the browser either).
- GitHub connection: create and read; the browser has no disconnect, so none is owed.

## Verdict

**4d2e412 FAIL: 3 red** (R1, R2, R3). The fixes are bounded to the files named in each finding. A re-check runs the changed journey on tablet and computer, plus lint and typecheck.
