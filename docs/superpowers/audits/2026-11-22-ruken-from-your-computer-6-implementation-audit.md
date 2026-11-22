# Ruken from your computer, PR 2: implementation audit 6 (re-check)

**a0151ce FAIL: 2 red**

- Reviewed: branch `claude/project-thread-ii8h7y` at `a0151ce`, which is the fixes for audit 5 (`5ddc930`) on top of `4d2e412`.
- Brief: as audit 5 (spec section 8 "Pull request 2", 3.2, 3.3, the PR 2 rows of 5.3, 5.4, A5 to A7), plus audit 5's findings.
- Written 2026-11-22 18:22 UTC (from `date`).

## What ran (on a0151ce, cloud container, Postgres 16 local)

| Check | Result |
|---|---|
| `pnpm lint` | exit 0 |
| `pnpm typecheck` | exit 0, 0 errors. A first run read the build output an earlier journey run left in `.svelte-kit/output` and failed on it. After removing that folder (a local leftover, not in git) it was clean. |
| `pnpm test` | exit 0, 1948 of 1948 passed. This time it ran alone, and audit 5's N6 timeouts did not happen. |
| `pnpm test:pg` | exit 0, 766 passed, 51 files. The first try failed with ECONNREFUSED because the local Postgres had stopped. After a restart it passed. |
| `pnpm test:browser --project tablet --project computer tests/browser/cli-` | exit 0, 6 passed (the three `cli-games.test.ts` journeys on both profiles), 1.2 min. Only that file's tests changed. The full tablet and computer run in audit 5, at 4d2e412, was green, and the source changes since are limited to the three API routes and the CLI. WebKit (phone) runs in CI only. |

## Audit 5's findings

- **R1 (new-version ignores `liveSendOf`): fixed.** `new-version/+server.ts` now refuses unless `liveSendOf(game) === "new_version"`, before `pullLatest`. For `"again"` it adds `next: "send"`, which the CLI turns into the `send` command. The journey proves both cases. With the line sent back and not yet fixed, `update` is refused. Once the line is fixed, `update` is refused and points to `npx ruken send <game>`. The pull count is unchanged across both refusals and the `send` that follows (`filesOf(slug).pulls`).
- **R2 (A6 journey gaps): fixed.**
  - The rename moves the address, and the old address answers 1 with the game gone from the list.
  - `files --branch main --folder img` is refused in the browser's words, the choice is kept (read back as "branch main, folder img"), and it is then mended.
  - Staff send the files back. `send` is refused with "Fix what was sent back first.", then `files`, then `send` goes.
  - The game is on the feed after the accept, gone from it after `take-off`, and back after `put-back` plus an accept.
  - The player count shows "1 person played it this week." on `/g/<game>` when on, and not when off.
- **R3 (missing noun): not fixed.** `packages/ruken/words/github.js:12-13` at a0151ce still reads `` `Connected. Ruken can see ${String(repos)} on GitHub. See them with: ${PREFIX} repos` ``. `git diff 5ddc930..a0151ce -- packages/ruken/words/github.js` is empty. Carried forward as R3 below.
- **N1 (PATCH several answers): fixed.** Two kinds of change in one body now get 400 "Change one thing at a time." before anything is saved. The A5 journey checks it and then sees the game unchanged.
- **N3 (unused `nothingDone`): fixed**, removed.
- **N4 (send to a live game whose way on is a new version): fixed.** The answer carries `next: "update"`.

## Red

### R3 (carried from audit 5). "Connected. Ruken can see 3 on GitHub." is missing its noun
- UNIT: `packages/ruken/words/github.js`, `nowConnected`
- VERDICT: red (small)
- REQUIREMENT: the drunk-grandma rule (CLAUDE.md) and spec 6.
- REASON: unchanged since audit 5. "Ruken can see 3 on GitHub" does not say what it can see. The sibling `connected` line says "game folders".
- EVIDENCE: `words/github.js:12-13` at a0151ce, as quoted above.
- EXPECTED: for example `Connected. Ruken can see ${repos === 1 ? "1 game folder" : `${String(repos)} game folders`} on GitHub. See them with: ${PREFIX} repos`. The journey's `toContain("Connected.")` still holds.
- FIX: `packages/ruken/words/github.js` only.

### R4 (new in a0151ce). A message the CLI prints is written in `commands/games.js`, not in `words/`
- UNIT: `packages/ruken/commands/games.js`, `send`
- VERDICT: red (small)
- REQUIREMENT: spec 6 and A12: "every message the CLI prints is in `packages/ruken/words/`". The banned-words test reads only that folder, so a line outside it escapes the check.
- REASON: the R1/N4 fix builds the line inline: `` throw new Told(`${problem} Send its newest files with: ${PREFIX} update ${decodeURIComponent(game)}`) ``. It also imports `PREFIX` into the command file for this one line. Its twin for `update`, `sendAgainInstead`, was correctly put in `words/games.js`.
- EVIDENCE: `git diff 5ddc930..a0151ce -- packages/ruken/commands/games.js`, the `body?.next === "update"` branch.
- EXPECTED: a `words.games` entry (for example `updateInstead: (problem, game) => ...`) beside `sendAgainInstead`, called from `send`, and no `PREFIX` import in `commands/games.js`.
- FIX: `packages/ruken/words/games.js` and `packages/ruken/commands/games.js` only.

## Notes (not blocking)

- N7. The `delete-files` read-back looks for "Some of its files are still on Ruken." to be absent on `/make/<game>`. In the journey the take-off's delete never fails, so that line would be absent either way, and the check proves little. A stronger read would count the bucket's keys under `files/<publicId>/`, which A9 already does for uploads. This is optional and outside the A6 wording, which the journey now meets.
- N8. The `--folder` step uses a folder that is refused (`img`). A folder that is accepted is never saved through the CLI. The save path is the same `saveAnswer` as the refused one, and the round trip of the flags is read back, so this is noted, not red.
- N2 and N5 from audit 5 stand as follow-ups. N6 did not recur.

## Verdict

**a0151ce FAIL: 2 red** (R3, R4). Both are one-line moves in `packages/ruken/words/` and the one command file. A re-check needs lint, typecheck, `pnpm test`, and `cli-games.test.ts` on tablet and computer. No pg change is involved.
