# Feed keys (PR #441), implementation audit 2

Reviewed head: `ad85418` (ad854187fbbd4ccc8185152c60ffe8184b3db3c2). Lane 2 (as review 1). Reviewer: fresh session, Opus 5.5, medium. Written 2026-11-28 02:55 UTC. Review 1: `2026-11-28-feed-keys-1-implementation-audit.md` at 1439915 on `claude/project-thread-mx2cn4`, verdict `cae4d56 FAIL: 2 red`.

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## Verdict

**PASS.** R1 and R2 are fixed and each fix is checked by a journey that fails without it. No new red.

## What ran

| Check | Result |
| --- | --- |
| `pnpm lint` | green (0) |
| `pnpm typecheck` | green, 0 errors |
| `pnpm test` | 2437 of 2437 passed, 169 files |
| `feed-shortcuts.test.ts` at `ad85418`, phone (WebKit), tablet, computer, Playwright 1.63 image, retries 0 | 21 of 21 passed |
| Probe `audits/2026-11-28-feed-keys-2-probe.test.ts.txt` (project files) at `ad85418`, three devices | held R, held M, held Enter (before launch) each press once; feed overlap, see below |
| Mutation: `if (!event.repeat) control.click()` back to `control.click()` | the journey's "M turns the sound on and off" fails on all three devices; the probe's held R and held Enter fail on all three |
| PR merged with `main` 93f0bc6 (clean merge, local only): `feed-shortcuts`, `feed-controls`, the probe, `controls-overlap`, three devices, 3 workers | 144 passed, 2 skipped, 1 failed: `controls-overlap` on the phone (see N1) |
| `controls-overlap.test.ts`, phone, `main` 93f0bc6 alone, repeat 3, 3 workers | 3 of 6 failed the same way (N1): not from this PR |

Not run: the full browser suite; `gamepad.test.ts` (the pad never sends Enter, I, M or R as key events, as review 1 found).

## Review 1's findings

- **R1, fixed.** `tests/browser/feed-shortcuts.test.ts:47` signs up, goes before launch, presses Enter and waits for the `/wishlist` answer (under 400) and "On your wishlist". Passes on all three devices. On `main` there is no Enter shortcut, so it fails there.
- **R2, fixed.** `Feed.svelte` onKey: the shortcut branch still calls `preventDefault()` on a repeat but clicks only when `!event.repeat`. The journey holds M (one down, three repeats, up) and checks one flip; four flips would end where it started, so it fails without the fix (mutation above). R and Enter share the same line: the probe held R for about 2 s (six repeats, spaced so the busy guard clears between them) and saw one `/api/feed/marks` request and Repost left on; held Enter before launch sent one wishlist post. Both fail without the fix.

## Overlap (standing rule, measured)

The probe measured every visible control on the feed (bar, top bar, the clip on screen's column) at 320×568, 375×667 and 667×375, before launch and after, on all three devices.

- At `ad85418` alone: none, except on the computer at 667×375 before launch, where the bar's You sits on the clip's Share (48 × 16.5 px). This branch has not taken #435 (93f0bc6), whose commits d18d72e and e611fe7 close that column up.
- At `ad85418` merged with `main`: none, every size, both states, all devices. The PR changes no layout, so what merges is clean on the feed.
- Phone and tablet at 667×375 show the "turn your phone" screen in the browser (no controls), as the owner asked.

## Notes (not blocking)

- N1. **On `main`, not this PR:** `tests/browser/controls-overlap.test.ts` fails about half the time on the phone at 3 workers: `/g/<slug>` at 667 by 375, sideways, before or after launch, reports a control with no name on "Back to the feed". `main` 93f0bc6 alone: 3 of 6 failed (repeat 3, retries 0); 2 workers once: 2 of 2 passed. It is a flake or a real overlap on the sideways game page, either way a defect by the owner's overlap rule, and needs its own fix and a "Flaky tests" line in `progress.md`.
- N2. The journey holds M but not R; R takes the same guarded line, and the probe covers it. A held-R step would make that a standing check.
- N3. The body's Lane line still says lane 1 (review 1's N1), and "Checks" does not yet mention the two fixes.
- N4. `sections[current] ?? undefined` (review 1's N3) is unchanged; harmless.
- N5. Before merge the branch should take `main` (it is behind #435); the merge is clean.

CRUD: the change adds nothing a user makes; Repost's create and delete by key and the wishlist add by key are in the journey.
