# Feed settings, implementation audit 6

Pull request #405, head `de2bcce38706909de93a4b44278e64068446d514`. Reviewer: a fresh session, Opus 5.5 medium. Written 2026-11-27 05:17 UTC.

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

**Verdict: PASS. No red findings.**

## What changed since audit 5 (PASS at eba51c9)

1. `4a50ba2`, a merge of `main` (`e586224`) into the branch.
2. `de2bcce`, three small changes: the side names stay pinned at the top of the chips' box, Remove keeps the focus beside the chip taken off, and the fit check scrolls the less side by wheel.

## The merge lost nothing

Method: for each of the 15 files both sides changed since the merge base, every line either side added was looked for in the merge result.

- 14 files: every added line from both sides is in the merge.
- `src/routes/+page.server.ts`: the only line "missing" from each side is the `feed.service.page(...)` call, which the merge combined. It now passes `feed.viewerOf(locals.caller)` (main's side) and sits in the `Promise.all` with `taste.learningOf` and returns `tune` (the PR's side). `src/routes/api/feed/+server.ts` passes the viewer as well.
- `src/features/accounts/deletion.ts`: the purge deletes `feedTaste` (own rows, rows naming the person as maker, rows on their games), `goodPickAsked`, and `makerFollow` on both sides of a follow.
- `src/features/feed/feed.ts` exports taste types and the search exports together.

`main` has since moved to `89caede` (#403, the private feed binding), which touches `service.ts`, `ranker.test.ts` and `progress.md` too. A trial merge of de2bcce with `89caede` is clean (`git merge-tree`), and on that tree `pnpm typecheck` passes and the feed unit tests pass (102). Branch protection does not require the branch to be up to date.

## The three small changes

- **Pinned names** (`YourFeed.svelte`: `.tastes h2 { position: sticky; top: -0.25rem; background: var(--paper) }`, `scroll-padding-block: 2.25rem 0.75rem`). The name is 35.9px tall and the scroll padding is 36px. Measured in WebKit at 375x667 and 320x568 with the box scrolled to its end: the less name sits at the box's top (0px) with a white background, and the more name has scrolled away with its section. At 1280x720 the same. Screenshots in `2026-11-27-feed-settings-6/`.
- **Focus after Remove** (`nextAfter`, `keepFocusNear`). Probe results, in WebKit (phone) and Chromium (computer): removing a middle chip by keys focuses the next chip (the journey checks Cosy to Bold); removing the last chip of a side (Story) focuses the one before it (Weird); removing by a click focuses the next chip; removing every chip of the more side lands on that side's Add.
- **Wheel on the less side** (`fits-the-screen.test.ts`): the test now hovers each side's heading and checks the box scrolls up from its end. It passed on the computer. The `inTheBox` helper now counts the pinned name as covering the box's top, so a focused chip hidden under the name would fail.

## The standing rules

- No page scroll: `{page: 0, view: 0}` at 375x667 and 320x568 (WebKit) and 1280x720 (Chromium), with 13 chips added and after removals.
- 48px: no button, link or switch in `main` under 48px wide or tall, at those sizes, before and after removals.
- Keyboard and focus: Tab reaches every chip, each fully in view below the pinned name and above the fade. At 320x568 in WebKit, a Tab walk over 9 chips found none under the name or the fade.
- Gamepad: the site's gamepad layer is #409, not merged; the box is reached by moving focus, which that layer drives.

## What ran

- `pnpm lint`, `pnpm typecheck`: pass.
- `pnpm test`: 2281 passed.
- `pnpm test:pg` on local Postgres 16: 809 passed (54 files), including the purge tests.
- Browser journeys inside `mcr.microsoft.com/playwright:v1.63.0-noble` (WebKit for the phone), `--project=phone --project=computer`: `your-feed`, `fits-the-screen`, `feed-top`, `feed-controls`, `feed` and the probe: 106 passed, 2 skipped (tests marked to skip on one project), 0 failed.
- Probe rerun at 320x568 on the phone: 2 passed. The probe is `2026-11-27-feed-settings-6-probe.test.ts.txt`.
- CI on de2bcce (quick, draft run): `gate`, `verify`, `postgres`, the 6 browser pieces, `commit-authors` and `pr-rules-run` all green. The full run starts when the pull request is marked ready.
- Not run: the tablet project, and the full journey suite (CI's full run covers it).

## Notes (not blocking)

- N1. The pinned name's room is a fixed 2.25rem. If the name ever wraps (a larger text setting, or longer words), a focused chip could be scrolled to sit under it. The `inTheBox` check would catch it at the sizes it runs.
- N2. Removing a chip by a click also moves the focus to the next chip. That is fine for keys and a gamepad, and shows a focus ring only for keyboard focus.
