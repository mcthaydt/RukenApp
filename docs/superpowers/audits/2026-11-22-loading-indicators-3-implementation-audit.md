# Loading indicators, implementation audit 3 (PR #309)

- Examined: a6717a5..d6336ac on `claude/project-thread-jhe4or`: the merge of `main` at 06cf793 into d9b756d (a6717a5), and the one-line fix to `tests/browser/loading.test.ts` (d6336ac).
- Lane 2. Reviewer: the same review session as audits 1 and 2, Opus 5.5, medium.
- Verdict: **PASS, 0 red, 1 note.**

## The merge (a6717a5)

- Clean: `git show --cc a6717a5` prints no hand-resolved hunk, and no file is changed on both sides (the PR's files and main's files since the merge base do not overlap).
- Main brings only already-merged work (#306, #307, #308: CI sharding, `playwright.config.ts`, `tests/browser/support/shard-plan.ts`, `make-after.test.ts`, audits, the faster-CI spec, `progress.md`). None of it touches the loading code or its tests.

## The fix (d6336ac)

- `page.reload()` becomes `page.reload({ waitUntil: "domcontentloaded" })`, with a comment giving the reason (WebKit holds the load event while the clips are held back). Test-only; no product code changes.
- The shimmer is still asserted, and asserted at the right time: after the reload the journey waits for `pageHasSettled` (the `#svelte-announcer` is attached, so the page has hydrated and `use:loads` has run), then expects `video[data-loading]` to be visible while the clips are held, releases them, and expects no `video[data-loading]` left. Nothing was weakened or removed.
- This does not move the journey's own clock: `pageHasSettled` does not wait for the load event, so it does not hang on WebKit either.

## What ran

- `pnpm exec eslint tests/browser/loading.test.ts`: exit 0. `pnpm typecheck`: exit 0, 0 errors. `tests/shard-plan.test.ts` and `tests/loading-states.test.ts`: 19 passed.
- The browser journey was not run here (no Postgres, no WebKit in this container). CI on d6336ac was queued at the time of writing.

## Note

1. The WebKit fix is proven only by the full run with the phone profile, which the quick draft run may not include. The run that merges must show "a video shimmers until it has loaded" passing on the phone.
