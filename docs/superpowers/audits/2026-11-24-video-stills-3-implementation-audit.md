# Video stills: implementation audit, round 3

Lane 2 re-review, Opus 5.5 medium. Pull request #380, head `02f6025caf49ab432a956b90e826c17af2eeadb1`, against `main` at `e2a9d8f4`. Round 2 (FAIL, 1 red) is `2026-11-24-video-stills-2-implementation-audit.md` on `claude/project-thread-d98zn6` (69832a9). Round 1 (FAIL, 3 red) is on `claude/project-thread-5ieggm` (029dae9).

**Verdict: PASS.** The round 2 red is fixed and the fix is bounded. No new red. Two notes.

## Round 2 finding: the failed-still mark never expired. Fixed.

The diff since `7174e29` is one commit (`02f6025`), three files: `src/features/games/stills.ts`, `src/features/games/services.ts`, `tests/features/games/stills.test.ts`.

- `stillOf` now writes the failure time (`String(now)`) into `<s>s-<w>.none` and, when the mark is found, asks the media tool again only once `now - lastFailed >= STILL_RETRY_MS` (24 h). A repeat failure rewrites the mark with the new time, so it waits a fresh day.
- The time comes from the games' clock: `services.ts:132` passes `now: () => parts.clock.epochMs()`, and production's `parts.clock` is `systemClock` (`services.ts:157`). `Date.now` is only the fallback when a caller passes no clock.
- The `head` of the mark became one `get` of it (`failedAt`), so the still route does no extra read.
- The kept still is read before the mark, so once a retry succeeds the stale mark is never consulted again.

**Checked by a program.** With round 2's `stills.ts` (`git show 7174e29:src/features/games/stills.ts`) put back under the head's tests, "that failed is tried again a day later …" fails (`expected 1 to be 2`: the tool is not asked again after 24 h); 8 other tests pass. With the head, all 9 pass. The test also pins the boundary (24 h − 1 ms: no call; 24 h: a call), so `<=` in place of `<` would fail it, and its last two steps fail if a repeat failure does not rewrite the mark's time.

**Bounded.** A still that keeps failing costs at most one media call per (clip, second, width) per day, plus the round 1 note that requests landing at the same instant may each call once. Seconds and widths are capped by `isStillSecond` / `isStillWidth`, and only stills someone actually asks for are tried. So a full outage costs, per day, no more calls than the stills viewed that day would have cost the first time, and the not-found answer stays `no-store`, so browsers do not hide a healed still. No retry loop exists inside a request. This is within the free-tier reasoning the owner accepted on the card (01:58 UTC).

**PR body.** The criterion and the open-risk line now say a failure is retried a day later and that a fixed token brings every still back within a day, with nothing to clear by hand. It ends with "Requested by **McThayDT**".

## Round 1 and round 2 holds, spot-checked at 02f6025

- Feed counts stills apart from clips (`feed-controls.test.ts`): not in the diff since 7174e29, unchanged.
- No mark without a frame maker: "is not marked as failed on a site with no frame maker" passes.
- `deleteClipFile` removes the clip's stills and marks: its test passes.
- The Safari loop-by-hand (#374): `src/lib/quiet-video.ts` is not in the PR's diff, and no script sets `video.loop`.
- `--local` comments: not in the diff since 7174e29, unchanged.

## What ran here

- `pnpm exec vitest run tests/features/games/stills.test.ts` at 02f6025: 9 passed. With round 2's `stills.ts`: 1 failed, 8 passed.
- `pnpm lint`, `pnpm typecheck` and `pnpm test` at 02f6025: all exit 0; unit suite 2,198 passed in 151 files.
- CI at 02f6025 (quick draft run, while writing): verify, postgres, pr-rules and commit-authors passed; the six browser shards were still running. Full CI runs when the PR is marked ready.

## Notes (not fixed here)

1. `failedAt` treats a mark whose text is not a number as "failed just now". Because `now - now` is always 0, such a mark would block that still for good, the round 2 bug in a corner. Today it cannot happen: this code only ever writes `String(now)`, and an empty mark (as round 2's code wrote, never on `main`) reads as `0` and is retried at once. Counting a non-number as old, as round 2's fix suggested, would close the corner. Optional.
2. Round 2's note stands: the mark's `put` sits in the `catch`, so an R2 failure there answers 500 instead of 404. Only the picture fails.
