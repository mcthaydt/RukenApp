# Implementation audit: deploy workflow tests accept the games steps (PR #359), cycle 1

- Reviewed: PR #359 head 76543c3ca114707870b4139770f14b8502e97b7c (on main 46cf9165), lane 2, test-only.
- Also run against: PR #358 head 45ba9ef58611e0cf994c4ff6675577284bf72f26 `.github/workflows/deploy.yml`.
- Reviewer: fresh session, Opus 5.5, medium. Written 2026-11-23 05:56 UTC.

**Verdict: 76543c3 PASS (0 red, 2 notes).**

## What the change claims

`tests/deploy-workflow.test.ts` passes on today's main `deploy.yml` and on PR #358's (which adds the games deploy,
games check and games rollback steps): secrets are allowed in the games steps, and the step count after the target is
a floor (>= 8) instead of exactly 8, while every step after the target must still be gated on `deploy == 'true'`.

## Checks run (vitest, `pnpm exec vitest run tests/deploy-workflow.test.ts`)

| Test file | Workflow | Result |
|---|---|---|
| PR #359 | main | 15/15 pass |
| PR #359 | PR #358 | 15/15 pass |
| main (before) | PR #358 | 2 fail (step count, secrets) — the breakage #359 fixes |

Lint (eslint) and prettier clean on the file.

## Mutations (each applied to the workflow, PR #359 test file)

| # | Mutation | main wf | #358 wf |
|---|---|---|---|
| M1 | `secrets.CLOUDFLARE_API_TOKEN` added to the build step | caught | caught |
| M2 | `secrets.GAMES_ROUTE` added to the build step | caught | caught |
| M3 | a secret added to "how to roll back the games Worker" | n/a | caught |
| M5 | install step loses its `if:` gate | caught | caught |
| M6 | `DIRECT_DATABASE_URL` added to the games deploy step | n/a | caught |
| M4 | `GAMES_ROUTE` added to the site deploy step | passes | passes |
| M7 | new step `run: echo ${{ secrets.OTHER }} live-check.sh` | n/a | passes |

A secret in any step outside the deploy, live-check and games steps is caught (M1–M3, M6). The rollback-hint test
still picks the site rollback step on both workflows. Nothing red.

## Notes (not blocking)

**N1.** UNIT: tests/deploy-workflow.test.ts, "names secrets only in the deploy and live-check steps". VERDICT: note.
REQUIREMENT: the test's own comment ("the route only in the games deploy step"). REASON: the comment promises the
games route stays in the games deploy step, but nothing checks it. EVIDENCE: M4 passes. Main's test did not check it
either, so this is not a regression. EXPECTED: a stray `GAMES_ROUTE` fails a test. FIX: in that file only, add
`expect(stepBlocks.filter((s) => s.includes("GAMES_ROUTE")).every((s) => /id: games\n/.test(s))).toBe(true)` (or drop
the claim from the comment).

**N2.** UNIT: same test. VERDICT: note. REQUIREMENT: none broken; strength versus main's test. REASON: the allow-list
matches a substring anywhere in a step, so an extra step that merely mentions `live-check.sh` or `games-check.sh` can
carry a secret; main's exact `toEqual` would have caught that. EVIDENCE: M7 passes. Contrived, not a realistic leak.
EXPECTED: each allowed matcher names one step. FIX: in that file only, compare the secret-bearing steps exactly:
`expect(withSecrets).toEqual(allowed.filter((a) => indexOfStep(a) >= 0).map(stepNamed))`.
