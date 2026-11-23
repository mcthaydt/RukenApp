# Deploy log host mask: re-point audit (cycle 3)

- Pull request: #368, head `1eee1d8fbe5eeedc8465a38a312d707c8a2f5097` (main `d9f5fde`, with #367, merged in).
- Earlier verdict: `248e1bc PASS` (cycle 2).
- Reviewer: fresh session, Opus 5.5, medium. Written 2026-11-23 17:57 UTC.
- Lane 3 (`.github/` workflow file).

## Verdict

1eee1d8 PASS, 0 red, 0 notes.

## What was checked

| Check | Result |
|---|---|
| `origin/main` (`d9f5fde`) is an ancestor of `1eee1d8` | yes |
| `git diff origin/main 1eee1d8 --stat` | `.github/workflows/deploy.yml | 6 ++++++`, one file |
| `git diff 248e1bc 1eee1d8 -- .github/workflows/deploy.yml` | empty: the workflow file is byte-for-byte the one passed at `248e1bc` |
| `pnpm vitest run tests/deploy-workflow.test.ts` at `1eee1d8` | 15 passed of 15 |
| No live-state file under `docs/superpowers/live/` at `1eee1d8` | none |

The six added lines are still the comment pair and the host-mask block (`dbhost` from `DIRECT_DATABASE_URL`, then `::add-mask::`) before `pnpm run deploy`. Commits between `248e1bc` and `1eee1d8` are main's #367 (looping video fix) and the merge; none touch `deploy.yml` or its test.
