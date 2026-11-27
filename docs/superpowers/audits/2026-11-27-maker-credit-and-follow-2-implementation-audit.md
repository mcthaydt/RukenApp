# Maker credit and follow: implementation audit 2

Lane 3 implementation audit of PR #400 at `bdba4e5614ea2faab6f02f666e76fdf35e5252ae` (branch `claude/project-thread-6790hn`), against the brief `docs/superpowers/specs/2026-11-27-maker-credit-and-follow-design.md`. Fresh session, Opus 5.5, medium. Finished 2026-11-27 02:13 UTC.

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## Verdict

**bdba4e5 FAIL: 1 red.**

## Audit 1's reds

1. **Lint at `Feed.svelte:503`.** Fixed. The callback is `(now: boolean) => …`. `pnpm lint` (ESLint and Prettier) exits 0 here at `bdba4e5`, and CI's `verify (quick, draft)` job passed on this head.
2. **48px lowered to 44.** Fixed. `tests/browser/follow-a-maker.test.ts` lines 235 and 236 assert `>= 48` for width and height, and the PR body's criterion 9 says 48 by 48 (`--size-target`). The badge's button is `width/height: var(--size-target)` (`FollowBadge.svelte`), and `look.css` still sets it to 48px.

## What ran, at `bdba4e5`

- `pnpm lint`: exit 0. `pnpm typecheck`: 0 errors, 0 warnings.
- `pnpm test` (unit): 156 files, 2249 tests passed.
- WebKit, phone project (iPhone SE), in the `mcr.microsoft.com/playwright:v1.63.0-noble` container against a local Postgres 16, `wrangler dev` as the config sets it:
  - `follow-a-maker.test.ts` (8), `feed.test.ts` (4) and `feed-controls.test.ts:438`, 2 workers: 12 passed, 1 failed: `feed-controls.test.ts:438` at line 447 (the fourth clip stayed `data-current="false"` for 15 s).
  - `feed-controls.test.ts:438` alone, `--repeat-each=5`: 5 passed.
  - All of `feed-controls.test.ts`, `follow-a-maker.test.ts` and `feed.test.ts`, 2 workers: 42 passed, 438 included.
  - So 438 failed 1 of 7 runs on phone. That is the same line and the same symptom already recorded under Flaky tests in `progress.md` (line 221) from #394 at `e0d9d92` on computer, a change that touched only the share sheet. It is not this change's, and is not a red here. Its phone sighting should be added to that entry.
- CI quick draft run on this head (run 45924741452): verify, postgres, browser shards 1 to 6 and gate all passed.
- Not run: the database suite (`pnpm test:pg`) locally; CI's postgres job passed on this head, and audit 1 ran it at `36b5289` (798 passed), with no database code changed since. Tablet and computer projects were not run here; CI's shards passed.

## Against the brief

Held: the additive-only migration (only `CREATE TABLE`, two `CREATE … INDEX`, and `ALTER TABLE "MakerFollow" ADD CONSTRAINT`, with `MakerFollow_not_self`), Restrict keys and both sides purged in `deletion.ts`; `follow`/`unfollow`/`followedAmong`/`followedMakerIds` in `follows.ts`; the feed service takes `viewerId` separately while `Asking` stays as it was; `following` and `mine` on `FeedClip.maker`; `rk_follow_pressed` on `RUKEN_COOKIES`, in the privacy page and gated before the cookie yes with the "follow" reason; the about line; the badge's glass tokens, `aria-label`, `aria-pressed`, busy state, the `role="alert"` problem line; CRUD in the journey (create, read, delete; a follow has no update, as the brief says).

### Red

UNIT: `src/routes/[handle=handle]/follow/+server.ts`, the `GET` handler (lines 55 to 64).
VERDICT: red.
REQUIREMENT: the brief, Rules, "The way back is checked too": "The cookie is deleted on the way back whatever happens … A handle with no page answers 404."
REASON: the GET only deletes the cookie and only checks for a page inside `if (signed in && cookie names this handle)`.
EVIDENCE: line 57 guards both `cookies.delete` and the `follow()` call (whose "no page" gives the only 404). So (a) a signed-in person with no cookie who opens `/nobody-has-this-page/follow` gets a 303 to `back`, not a 404; (b) a cookie naming another maker, or a signed-out visit, leaves `rk_follow_pressed` in place, so it can still follow on a later visit within the 30 minutes. No test covers the GET's 404 or the cookie being cleared: the journey "going to the way back without pressing the plus follows nobody" checks the 404 only for a POST.
EXPECTED: any GET of the way back clears `rk_follow_pressed` when it is there, and a handle with no page answers 404 whoever asks and whatever the cookie says; follow only when signed in and the cookie named this handle (as now).
FIX: in the GET, look the page up first (`pagesServices().service.pageByHandle(params.handle)`, as the POST does) and `error(404)` when null; read the cookie, then always `cookies.delete(PRESSED_COOKIE, { path: "/" })`; then follow when signed in and it matched. Add to `tests/browser/follow-a-maker.test.ts` ("going to the way back without pressing the plus follows nobody"): a GET of `/nobody-has-this-page/follow` answers 404, and after a GET of the way back with a cookie naming another handle, the cookie is gone. Files: those two only.

### Notes (not blocking)

1. Add the phone sighting of `feed-controls.test.ts:438` (1 fail in 7 WebKit phone runs here, line 447) to its Flaky tests entry in `progress.md`.
2. Audit 1's notes still stand: no journey presses the plus before the cookie yes (the gate's unit tests cover the reason and route), and no journey follows again after an unfollow.
