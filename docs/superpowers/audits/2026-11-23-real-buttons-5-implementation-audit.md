# Real buttons: implementation audit, round 5 (re-check of round 4's red)

- PR: #345
- Head examined: `13fdf4c44c1694667eb0f6c728ca538ab53db268`
- Reviewer: the same fresh session as round 4, Opus 5.5, medium
- Date: 2026-11-23 21:07 UTC
- Verdict: **PASS**

## Scope

`git diff 916f71d 13fdf4c` touches only the two files round 4 named:

- `src/routes/cookies/+page.svelte:41`: "What we keep" is now `class="quiet"`.
- `tests/browser/real-buttons.test.ts`: the account test now opens `/cookies` after the person has said yes, and runs `expectRealButtons`.

## Red 1: closed

- The check fails on its own: with the old bare link restored locally, the test failed on computer ("What we keep" was listed among the actions that are not real buttons).
- With the fix, the test passes on computer and tablet (2 passed, 30.0 s), in the cloud container on Postgres 16.
- prettier and eslint on both files: clean.
- Not run here: phone (WebKit). The full CI run covers it.

Nothing else changed since round 4, so round 4's other results stand for this head: lint, typecheck, 2,174 unit tests and 348 journeys on computer and tablet.
