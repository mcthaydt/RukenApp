# Wishlist before launch: implementation audit 3, re-point after a conflict-resolved merge (lane 2)

Examined: `ed4b4a8` on `claude/project-thread-mqxj7b` (PR #338), the merge of `main` at `7411e4a` into `44665dd`. Written 2026-11-22 19:39 UTC by the audit session (Opus 5.5, medium).
Earlier audits: 1 FAIL at `ae51633`, 2 PASS at `fb0401b`. Rechecked on the PR since then: `53c32f4`, `f3547d7`, `be431fe` (FAIL: privacy page lacked `rk_wish_pressed`), and `44665dd` PASS.

**Verdict: PASS, 0 red.**

## The conflict resolution

There was one conflict, in `src/routes/make/[game]/+page.server.ts`. `main` (#323) renamed `liveSend(game)` to `liveSendOf(game)` on the line next to the branch's wishlist count. The resolution keeps `main`'s `liveSendOf` and adds the branch's lines as they were:

- the import of `isOpen`, `launchServices` and `wishlistCountWords`;
- `userId` taken from `ownGame`;
- `wished` worked out from `countFor(game.id, userId)` and `!isOpen(now(cookies))`;
- `wished` in the live view's data.

`git diff 7411e4a ed4b4a8` on that file shows exactly those additions and nothing else. No conflict markers are left anywhere in `src`, `tests` or `progress.md`.

## What ran on ed4b4a8

| Check | Result |
| --- | --- |
| `pnpm lint` | exit 0 |
| `pnpm typecheck` | 0 errors |
| `pnpm test` (unit) | 136 files, 1,972 tests pass (the privacy cookie list included) |
| Playwright on computer, local Postgres 16: `wishlist`, `make-live-changes`, `make-send`, `player-count`, `make-accepted` | 44 of 44 pass. These cover the maker's live screen with the wishlist count and with `main`'s send changes. |
| Phone (WebKit), tablet | not run here. They run in CI. |

## Notes

None new. The notes from audits 1 and 2 still stand.
