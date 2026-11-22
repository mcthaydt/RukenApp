# Implementation audit 2: faster CI, unit W

**5e01c29 PASS**

- Change: PR #296, branch `claude/project-thread-kp3qww`, head 5e01c29, against round 1 (`2026-11-22-faster-ci-1-implementation-audit.md`, 8b2b999 FAIL, 1 red). Since 8b2b999 the workflow changed in three commits: cf076b9, 60e0516 and 01ba62d, all in the step "Pick the journeys". The other commits (37571d6, the round 1 audit file; c5002b1, beb8189, bbe60fc and 5e01c29) only add or remove the round 1 audit file and the live-state file. Net of 8b2b999, `ci.yml` changes in that one step only (`git diff 8b2b999 5e01c29 -- .github/workflows/ci.yml`).
- Audited 2026-11-22 03:31 UTC by the round 1 session (Opus 5.5, medium), with draft run 44980455045 at 5e01c29 and the latest full run on `main` (44979353772).
- Prompt: Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## Round 1 red

- **R1, fixed, and its cause corrected.** Round 1 said the empty listing exited 0. It did not. The step showed only the last 3 lines, and the error lines above `Total: 0 tests in 0 files` were cut off. The real cause: the step listed the journeys before `pnpm generate`, so every journey file failed to import the generated database client, and the listing failed with an empty total. So the "No tests found" rule never matched, and every piece ran on. The fix in 01ba62d runs `pnpm generate` before the listing. It skips only on Playwright's two empty answers: "No tests found" with a failing status, or the exact line `Total: 0 tests in 0 files` with status 0. Any other failure still runs the journeys. The step now prints the status and the last 5 lines.
  - **Checked in run 44980455045.** All six pieces print `The listing ended with status 0:` and `Total: 0 tests in 0 files`. This is a true empty list: the diff is `ci.yml` only, and `--only-changed` reaches no journey. The screens steps, "Run the journeys", the lists and the uploads are all skipped, and no piece logs "Comparing". Pieces took 65 to 79 s from start to end, against 73 to 91 s in run 44977750904, where they started the web servers for nothing. "Pick the journeys" takes 8 to 10 s with the generate step. `gate (quick, draft)` passed.
  - **The builder's point about the full run is confirmed.** In `main`'s full run 44979353772, piece 1's listing ends `at eval (<anonymous>:1:1)`, `Listing tests:`, `Total: 0 tests in 0 files`. That is the same import failure, and the piece ran on as it always had. With generate first, the listing really lists. If a full-run listing still fails, its status is not 0, so the piece runs and the journeys fail in plain sight. If a piece ever lists zero journeys with status 0 on a full run, the gate's union check names every journey not run.
  - **Under `sh -e`,** a failing `pnpm generate` fails the step, and so the piece. It cannot skip anything.

## Still holds from round 1

The rest of round 1's checks covered the workflow outside this step, which is unchanged: A1's shape, the gate logic and the docs-only rule, the union check on real Playwright 1.63 reports, the pinned image, and the kit rules (nothing dropped, no retries, sleeps or wider timeouts, the required check never skipped).

## Red

None.

## Notes (not blocking)

- N1 to N6 from round 1 stand. N1 is the main one: the full run after ready is what proves the journeys pass in the container, including the WebKit phone journeys that open `*.localhost` addresses.
- **N7.** A piece with journeys now runs `pnpm generate` twice, once in the pick step and once inside `pnpm test:browser`. It is a few seconds per piece. Dropping the second one would mean calling Playwright directly in "Run the journeys", which is optional.
