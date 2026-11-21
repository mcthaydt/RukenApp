# Implementation audit 3 (unit P, recheck): CI shoots only the screens a change touches

**b510cd9 PASS: 0 red.**

- Examined: draft PR #262, branch `claude/project-thread-sws92y` at b510cd9, the fix commit `b471987..b510cd9` (`tests/browser/support/changed-screens.ts`, `tests/browser/support/look.ts`, `tests/changed-screens.test.ts`), against R1 in implementation audit 2 (`2026-11-21-ci-shoots-changed-screens-2-implementation-audit.md`, at 7534f9e).
- Audit: 2026-11-21 10:47 UTC, Opus 5.5, medium, the session that wrote audit 2. A recheck of one red, as audit 2's verdict said; no other file changed, so the rest of audit 2 stands at b510cd9.

## R1

| Red | Fixed? | Evidence |
|---|---|---|
| R1 the full-list guard counts the wrong list | **Yes.** | `filesTheScreenLoaded` returns `entryCount: performance.getEntriesByType("resource").length` beside the deduplicated `loaded`. `showTheOwner` passes both. `shouldShoot` compares `entryCount` with 250. Audit 2's check, rerun against the real `shouldShoot` at b510cd9: in Chromium, 300 fetches of `/poll` give `entryCount` 250 and 1 listed address, and the verdict is `shoot: true`, "the browser's list of loaded files may be full" (at 7534f9e the same page skipped). The A1 test now uses one address with 250 raw entries (shoots) and 249 (skips). It would fail on 7534f9e's code, which compared the list of 1. |

## What ran at b510cd9

- `pnpm exec vitest run tests/changed-screens.test.ts`: 24 passed. `pnpm lint`: exit 0. `pnpm typecheck`: exit 0.
- A real `tests/browser/look.test.ts` run (computer, Postgres 16 local) with the forgot-password paragraph changed and that change's answer from audit 2 as `LOOK_CHANGED`: 24 passed, exactly `look: forgot password` and `look: check your email`, as at 7534f9e. So the new return shape of `filesTheScreenLoaded` works end to end.
- Not run: the phone project (WebKit is not installed in this container), and the CI demos (A2 to A7, A9), which follow after the merge as audit 2's N17 says.

## Notes carried from audit 2

N17 to N21 stand unchanged (demos after the merge, the stale `ci.yml` top comment, no server-component-only A1 case, the local attachment name, the branch behind `main`). None blocks.

## Verdict

PASS at b510cd9. Merge needs the lane's own checks green and the owner's approval or standing permission for lane 3.
