# Faster CI unit T (PR #302): implementation audit 2

- Examined: 2ea34b9 (PR #302 head), the fix for audit 1's R1 (`b84676a..2ea34b9`: 41efeaa, then the live-state file added and removed). Audit 1: `2026-11-22-faster-ci-t-1-implementation-audit.md`.
- Lane 2 recheck. Reviewer: Opus 5.5, medium. Written 2026-11-22 05:16 UTC.
- Verdict: **PASS, 0 red.** Notes N1 to N3 from audit 1 stand.

## R1: fixed

`pieceFromEnv` returns this piece's files when the planner can deal, Playwright's own `shard: { current, total }` when `RUKEN_SHARD` reads but the times or the test folder do not, and `null` (config unchanged) when `RUKEN_SHARD` does not read. `playwright.config.ts` spreads the `shard` into the top-level config only in the second case. ci.yml never passes `--shard` together with `RUKEN_SHARD`, and its "List every journey" step clears `RUKEN_SHARD`, so the full list stays unsplit.

Checked by the same program as audit 1: the real `playwright test --list --reporter=json` over six pieces, as ci.yml runs them, the union compared as a sorted multiset with the unsplit list (1,785 tests).

| Times file | Audit 1 (1ebdb0e) | Now (2ea34b9) |
| --- | --- | --- |
| every pair timed | 1,785, once | 1,785, once |
| a third untimed, plus a key for a missing file | 1,785, once | 1,785, once |
| `{}` | 1,785, once | 1,785, once |
| one pair 100000 s, the rest 1 s | 1,785, once | 1,785, once |
| no file (`--shard`) | 1,785, once | 1,785, once |
| cut-off JSON | 10,710 | 1,785, once |
| one `null` value | 10,710 | 1,785, once |
| a JSON array | 10,710 | 1,785, once |
| an empty file | not run | 1,785, once |

- `pnpm exec vitest run tests/shard-plan.test.ts`: 12 of 12 pass. The two new tests check that each bad input (cut off, `null` value, array, empty, missing file, no times setting, missing test folder) makes all six pieces fall back to `{ shard: { current: n, total: 6 } }`, and that good times give files while an unreadable piece number leaves the config alone.
- `pnpm lint` and `pnpm typecheck` on 2ea34b9: both exit 0 (typecheck: 2013 files, 0 errors, 0 warnings).
- The diff touches only the three files the spec names for T (with the test file's place as audit 1's N3).
