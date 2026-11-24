# Video stills: implementation audit, round 2

Lane 2 re-review, Opus 5.5 medium. Pull request #380, head `7174e299ffdf70da33178d9a04ed414ab34172a2`, against `main` at `e2a9d8f4`. Round 1 (FAIL, 3 red) is `2026-11-24-video-stills-1-implementation-audit.md` on `claude/project-thread-5ieggm` (029dae9).

**Verdict: FAIL, 1 red.** All three round 1 findings are fixed. One new red: the "could not be made" mark never expires.

## Round 1 findings

1. **Feed test counted stills as clips: fixed.** `tests/browser/feed-controls.test.ts:108-133` counts `/api/still/` apart, keeps the clip cap of 2 and adds a still cap of 4. The cap matches `Feed.svelte` `stillNear` (current-1 to current+3, so 0..3 at the top). The PR body names the edit. CI at 7174e29: shard 6, the phone shard that failed in round 1, passed (quick draft run).
2. **Failed stills retried and re-billed: fixed.** `stillOf` checks `<s>s-<w>.none` before reading the clip and writes it in the `catch`. Checked by a program: with the round 1 `stillOf` swapped back in, "that failed is never asked of the media tool again" fails (1 failed, 7 passed). With the head it passes. The mark sits in the clip's still folder, so `deleteClipFile` removes it, and the test checks that too. No mark is written when there is no frame maker, and that is tested.
3. **Wrong `--local` comments: fixed.** playwright.config.ts, the verify skill, wrangler.jsonc, cloudflare.ts and the PR body now say the binding is there but every call throws. That matches the round 1 CI log.

## Whole diff

- The Safari loop-by-hand (#374) is untouched: `src/lib/quiet-video.ts` is not in the diff, `use:loopByHand` stays on the feed video, and no script sets `video.loop`.
- Unit tests for stills.test.ts, still-poster.test.ts, loading-states.test.ts and look.test.ts: 158 passed at 7174e29 (run here).
- The rest is as round 1 found it: no layout shift, spinners only, no new key exposed, custom UI only.

## Finding

UNIT: `src/features/games/stills.ts` `stillOf` / `failedMarkFor`.
VERDICT: red.
REQUIREMENT: the owner, 2026-11-24 01:58 UTC: every video shows its first-frame still until it loads. The PR's open risk says a missing binding permission at first deploy is "unverified".
REASON: one failure blocks that still forever. A one-off failure of the media tool, such as a missing permission at first deploy, a beta outage, a rate limit or the free allowance running out, writes `.none` for every still asked for while it lasts. Those clips never get a still until the maker replaces the clip.
EVIDENCE: `stillOf` returns `none` whenever `head(failed)` is non-null, and nothing ever removes the mark except `deleteClipFile`. `FileStore` has no date on `head`, so nothing can age it either. There is no one-line way to recover: `wrangler r2 object delete` removes one key and has no prefix or suffix delete, so clearing the marks would need a script run against the live bucket.
EXPECTED: a failed still is tried again after a bounded time, so a passing failure heals by itself. A real bad clip still costs at most one media call per still per period, not one per view.
FIX: write the time of failure into the mark, for example `Date.now()` as text. When the mark is found, read it, and if it is older than 24 hours, try again and rewrite the mark on another failure. An unreadable or empty mark counts as old. Take the clock as an optional dep (`now?: () => number`) and add a unit test: a failing maker is called once inside the window and again after it. Update the comments and the PR body's criterion and open-risk lines to say the mark lasts 24 hours. Files: `src/features/games/stills.ts`, `tests/features/games/stills.test.ts`, the PR body. A single `get` of the mark can replace the `head`, so this adds no extra read.

## Notes (not fixed here)

- The mark's `put` sits inside the `catch`. If R2 fails there, the error escapes and the still address answers 500 instead of 404. Only the picture fails and the page is fine. This is optional to fix.
- Round 1 notes still stand: up to 305 stills per clip, two first requests at the same moment both make the still, and the media binding at deploy is unverified.
