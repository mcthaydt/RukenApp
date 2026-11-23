# Landing page follow-up (#369): re-point audit, cycle 3

Commit examined: `6cd9bc5` (6cd9bc54e91b6ddd2c1bc522dc71c1e3812061f3), the head of #369 after `main` at `0e7e218` (#366, sideways steps) was merged in. Earlier PASS: `e99744c` (cycle 2). Reviewer: Opus 5.5, medium. Written 2026-11-23 16:28 UTC (time from `date`).

**Verdict: 6cd9bc5 PASS.** No red findings, no notes.

## What was checked

1. **The change is the one that passed.** `git diff 509aa6e e99744c` (the PASSed head against its base) and `git diff 0e7e218 6cd9bc5` (the new head against today's `main`) touch the same four files, 88 lines added and 2 removed in each. With `progress.md` left out and `index` lines stripped, the two diffs differ only in the hunk line numbers of `src/lib/look.css` (4731→4775 and 4908→4952), which #366's 44 added lines explain. `motion.ts` and `about.test.ts` are identical.
2. **The merge conflict.** `progress.md` keeps both `edit-page.test.ts:278` [phone] flaky entries: #369's (seen on #333's draft run, also failing on main at `f421c37` and `509aa6e`) and main's (run 45194843744 at `f421c37`). Nothing lost.
3. **Interaction with #366 on /about.** #366's new CSS selects `.screen`, `.screen .acts`, `.screen main > form:has(> [data-frame="wide"])` and `.vframe[data-frame="wide"]`, under `(orientation: landscape) and (max-height: 449px)`. `/about` is `<main class="about">` with no `.screen`, `.acts`, form or `.vframe` (`src/routes/about/+page.svelte`), so none of it applies there. #369's sideways rules select only `.about .hero …` under `max-height: 30rem`, and its `text-decoration: none` sits on the corner button's own rule; neither touches a step screen. No shared selectors, so no cascade conflict either way.
4. **Checks run here on `6cd9bc5`:**
   - `pnpm lint`: exit 0.
   - `pnpm typecheck`: exit 0, 0 errors, 0 warnings.
   - `pnpm test`: 149 files, 2162 tests passed.
   - `pnpm test:browser tests/browser/about.test.ts tests/browser/sideways-phone.test.ts`: 45 passed on tablet and computer, 21 skipped (phone-only sideways cases). The 13 phone failures were all `browserType.launch: Executable doesn't exist at /opt/pw-browsers/webkit-2359` (no WebKit in this container), not test failures.
   - CI on `6cd9bc5`: `verify`, `postgres`, `commit-authors` and all six browser shards passed (the shards include the phone profile, so the WebKit runs of the /about and sideways journeys ran there). `pr-rules-run` failed only for "no passing review that names its head 6cd9bc5", which this audit answers.

## Follow-ups

None.
