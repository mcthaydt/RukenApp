# Faster CI unit T (PR #302): implementation audit 1

- Examined: 1ebdb0e (PR #302 head), against `main` at e172f2a and `docs/superpowers/specs/2026-11-22-faster-ci-design.md` (3.1 item 3, 3.2, A7, A9).
- Lane 2, one fresh review. Reviewer: Opus 5.5, medium. Written 2026-11-22 05:10 UTC.
- Verdict: **FAIL, 1 red, 3 notes.**

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## What was run

- `pnpm exec vitest run tests/shard-plan.test.ts` at 1ebdb0e: 10 of 10 pass.
- The real `playwright test --list --reporter=json` (Playwright 1.63, after `pnpm generate`), six pieces, each run the way ci.yml's "Pick the journeys" step runs it: times file present means `RUKEN_SHARD=<n>/6` and `RUKEN_SHARD_TIMES` with no `--shard`; no file means `--shard=<n>/6`. The six listings' (device, file, title) lines were joined and compared, as a sorted multiset, with the unsplit listing (1,785 tests, 53 files, 159 file and device pairs).

| Times file | Six pieces together | Result |
| --- | --- | --- |
| every pair timed (made-up seconds) | 1,785 | exactly once |
| a third of pairs untimed, plus a key for a file that does not exist | 1,785 | exactly once |
| `{}` | 1,785 | exactly once |
| one pair 100000 s, the rest 1 s (piece 1 gets one file, so its other devices get an empty match) | 1,785 | exactly once |
| no file (Playwright's `--shard`) | 1,785 | exactly once |
| cut-off JSON | 10,710 | **every test six times** |
| an object with one `null` value | 10,710 | **every test six times** |
| a JSON array | 10,710 | **every test six times** |

- Confirmed: an empty `testMatch` list matches no file (piece 1 of the skewed case lists "8 tests in 1 file"), so a device with no files in a piece runs nothing there, not everything.
- Confirmed: Playwright's config `shard: { current: 2, total: 6 }` lists the same "295 tests in 26 files" as `--shard=2/6`.

## Red

**R1.** UNIT: `playwright.config.ts` with `planFromEnv` in `tests/browser/support/shard-plan.ts`. VERDICT: red. REQUIREMENT: spec 3.2 "Unknown or unreadable input falls back to today's behavior", the PR body's own "falls back" claim, and the brief for this review: the six pieces together list every test exactly once with missing, partial or corrupt times. REASON: when the cached times file exists but cannot be read, ci.yml has already dropped `--shard` (3.1 item 3), and `planFromEnv` returns `null`, so the config runs every journey in every piece. EVIDENCE: the table above: a cut-off file, a `null` value or an array gives 10,710 = 6 × 1,785. On a full run the gate's union check then fails on every doubled pair and each piece takes the whole suite's time; it stays that way on every pull request until `main` saves a good file. The PR body's "Six bad inputs ... each list all 1,785" is this same behavior, counted per piece. EXPECTED: with `RUKEN_SHARD` readable and no plan, the pieces split exactly as `--shard=<n>/6` does today, so they still list every test once. FIX: when `parseShard(RUKEN_SHARD)` gives a piece and `planFromEnv` gives `null`, set the config's top-level `shard: { current: piece, total: of }` (Playwright 1.63 takes it, confirmed above), and add unit or listing checks for the corrupt-file case that count the union across six pieces, not one. Files: `playwright.config.ts`, `tests/browser/support/shard-plan.ts`, `tests/shard-plan.test.ts`.

## Notes (not blocking)

- **N1. Times cache restored per piece.** Each piece restores `ci-test-times-*` on its own. If `main` saves a new file between two pieces' restores, those pieces deal from different times, and a pair can land in two pieces or none. The gate's union check catches it on a full run (a red run, not a silent loss); a draft run has no union check, so a draft could skip a journey. This is a ci.yml follow-up (for example, one job restores once and hands the same file to all six, or the key is pinned to one commit), not this PR.
- **N2. A7 and A9 are still open.** The PR body leaves both unticked; they need this PR's full run (and, for A7, the measuring runs). They must be ticked with run ids before merge; A8 is after merge as the spec says.
- **N3. Test file place.** The spec names `tests/browser/support/shard-plan.test.ts`; the PR uses `tests/shard-plan.test.ts` and says why in its body (Playwright would run it as a journey; the unit project leaves `tests/browser/**` out). The reason holds; `tests/changed-screens.test.ts` sits the same way.

## Checked and fine

- Every pair is dealt exactly once inside `planShards` (deduplicated by key, each dealt to one piece); dealing is deterministic across pieces (inputs sorted, ties to the lower piece, same float sums).
- A pair with no time counts as the median of the known ones, or 1 s when none are known; a time for a file that no longer exists is ignored.
- Keys match what the `test-times` job writes: `"<projectName>|<spec.file>"`, where the JSON report's file is relative to `testDir` (`tests/browser`), the same form `listJourneyFiles` gives.
- The "List every journey" step clears `RUKEN_SHARD`, so `parseShard("")` gives `null` and the full list is unsplit.
- No symlinks under `tests/browser`; `listJourneyFiles` uses Playwright's default match rule, which the config does not change.
