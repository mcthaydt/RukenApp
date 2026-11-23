# Looping video flake fix: implementation audit 1 (lane 2)

Pull request #367, branch `claude/project-thread-d53102`, head **57a6900** (`57a690031aeff2aad21e80f9f081ee9dab07f23d`). Reviewer: fresh session, Opus 5.5, medium. Finished 2026-11-23 15:39 UTC (`date`).

**Verdict: 57a6900 PASS.** No red findings. Three notes, none blocking.

## What was checked, and what it showed

| Check | How | Result |
| --- | --- | --- |
| Root cause: a looping video whose address names `#t=0.001` never plays in WebKit on Linux and seeks without end | Standalone page (no app) in Playwright 1.63 WebKit, iPhone profile, `upright.mp4` served with byte ranges, 5 s watch | Old code (`loop` + `#t`): furthest 0.001 s, 889 `seeking` events, 890 requests. Confirmed. |
| The fix's pattern | Same page, `quietVideo` copied from 57a6900 | Furthest 2.0 s, came back to the start, 4 `seeking` events, 1 request. |
| Test honesty | `src/lib/quiet-video.ts` set to `main`'s, the new journey run on all three devices | Phone FAILS ("how far the video played", received 0); tablet and computer pass. File restored, all three pass. Matches criteria 1 and 2. |
| Reduced motion (criterion 3) | "with reduced motion a video does not start by itself", three devices, with the fix | Passes. |
| Looping elsewhere | Every `quietVideo` user read (VideoTile, FixCard, game page, MakerPage, GameBackdrop, join); `game-page`, `join`, `make-questions`, `maker-page` journeys, three devices, local Postgres 16 | 255 passed (6.7 min). |
| Lint | `pnpm lint` | Exit 0. |
| Typecheck | `pnpm typecheck` | Exit 1, but every one of its errors is in `.svelte-kit/output`/`.svelte-kit/cloudflare` left by the local build for the journeys; none in source. CI's `verify (quick, draft)` at 57a6900 is green. |
| CI at 57a6900 | `gh api .../commits/57a6900.../check-runs` | gate, verify, postgres, six browser pieces (quick, draft), pr-rules-run, commit-authors: all success. Full run starts when marked ready. |
| progress.md | Merge times and commits read from `gh api` | #361 14:13 `e0a9fdc`, #364 14:29 `f421c37`, #365 14:34 `c0d05cc`, run 45191952218 at `e0a9fdc` on push: all match. |
| Live-state file | `git diff --stat main...57a6900` | Not in the diff; deleted before hand-off. |
| PR body | REST read | Line 1 the attribution comment; line 2 `_Requested by **McThayDT** · [project thread](...)_` (it carries the builder's `?thread=` id, as the session's attribution format gives it); `## Lane`, `## Acceptance criteria` and "Tests changed" present; last line `Requested by **McThayDT**`. |

## Notes (not fixed here)

UNIT: `src/routes/join/+page.svelte:60`. VERDICT: note. REQUIREMENT: the PR body's claim that the videos using `quietVideo` "no longer carry their own `loop` attribute". REASON: the join backdrop still has `loop` and `use:quietVideo`. EVIDENCE: line 60 on 57a6900. It is harmless: the action sets `node.loop = false` when it runs, the address has no `#t`, and the `join` journeys pass on all three devices. EXPECTED: one owner of looping. FIX: drop `loop` there in a later change touching that file.

UNIT: `src/routes/make/parts/VideoTile.svelte` (via "Choose a different video"). VERDICT: note, outside this change. REASON: after a video is swapped, the same `<video>` element gets the new address and stays on its first frame; nothing calls `play()` again. EVIDENCE: a throwaway probe journey (phone, real clips, not committed): first video furthest 2.0 s, 4 seeks; after the swap, same element, furthest 0, 0 seeks, `loop` true. The swapped video does not storm (it is not playing), so this change does not reintroduce the bug; it was the same before. EXPECTED: unclear whether a swapped video should move; a product question for later, not this flake.

UNIT: `src/features/feed/Feed.svelte` (already reported in the PR). VERDICT: note for the feed follow-up. EVIDENCE: in the standalone WebKit page, `loop` set from the start on an address with **no** `#t` did play and come back, but still fired 513 `seeking` events and 514 requests in 5 s. EXPECTED: the feed's fix should turn looping on only after play has begun (this PR's pattern), not only drop `#t`.

## Probe

The standalone WebKit probe is kept in project files as `audits/2026-11-23-looping-video-flake-1-probe.mjs.txt`.
