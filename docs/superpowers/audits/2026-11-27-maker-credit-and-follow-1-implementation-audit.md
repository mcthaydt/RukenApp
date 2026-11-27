# Maker credit and follow: implementation audit 1

- Pull request: #400, branch `claude/project-thread-6790hn`
- Commit examined: `36b528964723af080ad95790847ebd2e5888d5af` (includes the merge of `main` at `16f8996`)
- Brief: `docs/superpowers/specs/2026-11-27-maker-credit-and-follow-design.md` (plan audit 4 PASS at `5392f72`)
- Lane: 3 (adds the `MakerFollow` migration)
- Written: 2026-11-27 01:34 UTC (from `date`)

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## Verdict

**FAIL: 2 red.** The build matches the brief closely, and its database, unit and Chromium journeys pass. CI is red at this commit: `pnpm lint` fails on one line in `Feed.svelte` (criterion 17), and the pull request body lowers criterion 9's 48px to 44px, with the journey checking only 44px wide.

## What ran

| Check | Where | Result |
| --- | --- | --- |
| `pnpm lint` | this container, and CI job `verify (quick, draft)` 140254847806 | **fails**: `src/features/feed/Feed.svelte:503:23 Unsafe assignment of an any value (@typescript-eslint/no-unsafe-assignment)` |
| `pnpm typecheck` | this container | 0 errors |
| `pnpm test` (unit) | this container | 156 files, 2249 tests passed |
| `pnpm test:pg` | this container, Postgres 16 | 53 files, 798 tests passed (`follows.pg.test.ts`, `purge.pg.test.ts` among them) |
| Journeys `follow-a-maker`, `feed`, `feed-controls` | this container, Chromium, projects tablet and computer (fresh database) | 84 passed. The phone project (WebKit) did not run here: no WebKit binary in this container |
| CI browser shards | run 45922017580 | shard 3 failed on `[phone] feed-controls.test.ts:438` "Back from a game opened past the first page…" (line 455: no clip `data-current="true"` after Back); the others were cancelled by fail-fast |
| CI postgres | run 45922017580 | passed |

## Findings

### 1. Red: lint fails, so CI is red

- UNIT: `src/features/feed/Feed.svelte`, the `onchange` handler given to `FollowBadge`.
- VERDICT: red.
- REQUIREMENT: brief criterion 17 ("Lint, typecheck, unit, database and browser suites pass in CI"); the PR body's "What ran" says "ESLint and Prettier: clean".
- REASON: ESLint's Svelte parser types the callback's `now` as `any`, and the assignment to `followed[maker.handle]` fails `no-unsafe-assignment`.
- EVIDENCE: `pnpm lint` exits 1 here and in CI job 140254847806 with `503:23 error Unsafe assignment of an any value`.
- EXPECTED: `pnpm lint` exits 0.
- FIX: type the parameter, `onchange={(now: boolean) => { followed[maker.handle] = now; }}`. Only `src/features/feed/Feed.svelte`. Correct the PR body's "What ran" line.

### 2. Red: criterion 9 lowered from 48px to 44px

- UNIT: `tests/browser/follow-a-maker.test.ts` ("the credit fits the column on every screen, held either way"), and criterion 9 in the PR body.
- VERDICT: red.
- REQUIREMENT: brief criterion 9 ("The badge's pressable area is at least 48 by 48px"), the 48px target rule, and CLAUDE.md "never weaken an acceptance criterion". A change does not quietly edit its own check.
- REASON: the PR body's criterion 9 says "at least 44 by 44px", and the journey asserts `badge.width >= 44` and `badge.height >= 44`. The button itself is `var(--size-target)` (48px) and `feed.test.ts:105` checks every clip button's height is at least 48, but nothing checks the width at 48.
- EVIDENCE: `follow-a-maker.test.ts`, the lines `expect(badge.width).toBeGreaterThanOrEqual(44)` and `expect(badge.height).toBeGreaterThanOrEqual(44)`; the PR body, criterion 9.
- EXPECTED: the journey asserts at least 48 for both, and the PR body's criterion 9 says 48 by 48px, as the brief does.
- FIX: change both 44s to 48 in `tests/browser/follow-a-maker.test.ts`, and criterion 9 in the PR body to 48 by 48px. Nothing else.

## For the fix round to watch (not findings of this change)

- CI's `[phone] feed-controls.test.ts:438` failure. It is listed under Flaky tests in `progress.md` from #394 (there at line 447, on computer). This change does reach that screen (`Feed.svelte`'s side column), and the phone project did not run here, so the cause is not settled. The fix round's CI must run it on phone. If it fails again, it is this change's to look into, not a flake to rerun.

## Notes (optional, not blocking)

- `src/routes/privacy/+page.svelte`: "It's gone when you unfollow, or when you or the maker delete your account." reads as if the maker deletes your account. Plainer: "It's gone when you unfollow, or when either of you deletes your account."
- The way back, `GET /<handle>/follow`, answers 404 for a handle with no page only when the person is signed in and the cookie names that handle. Otherwise it goes on to `back`. The brief's "Your own page, or no cookie, … goes on to `back`" allows this, and nothing is saved either way.
- Criterion 3's "following again after unfollowing makes a fresh row" has no journey step of its own. `follows.pg.test.ts` covers follow and unfollow, and the journey's delete step leaves no row.
- Before a cookie yes, the badge's JSON post is answered `{ go: "/cookies?for=follow&next=/<handle>/follow" }` by the gate (`gate.ts`), and the notice's words are in `Notice.svelte`. No journey presses the plus before the yes. The brief has no numbered criterion for it, and `gate.test.ts` and `routes.test.ts` cover the routing.

## Checked against the brief and rules, and found right

- Migration: additive only. It has `CREATE TABLE`, two indexes, two `RESTRICT` foreign keys and the `MakerFollow_not_self` check. `migration.test.ts` refuses anything else. Back-relations on `User` only.
- Purge: `deletion.ts` deletes both sides inside the purge transaction, before `makerPage`. `purge.pg.test.ts` passes.
- Route: `safeNextPath` on `back`; 404 for no page; 400 for your own page; anything but `want=off` means on. The JSON and plain-form answers match the brief. The cookie is `httpOnly`, `lax`, 30 minutes, path `/`, and is deleted on the way back whatever happens. It is the same as Wishlist's.
- Consent: the route is in `GATED`, has a `follow` reason in `gate.ts`, `Notice.svelte` and `/cookies`, and `rk_follow_pressed` is in `RUKEN_COOKIES` and in the hand-written test list.
- Feed: `viewerId` is kept apart from `Asking`, and `ranker.test.ts` shows the ranker is still told `{ kind: "crowd" }`. `followedAmong` is optional. Graphify (index at `16f8996`) and grep find no other `page()` caller but `/about`, which passes no viewer and gets `false` for both fields.
- Badge: glass tokens `--glass-pay`, `--glass-safe`, `--glass-edge`, `--glass-filter`; custom SVG marks; `aria-pressed`; `aria-busy` uses the shared busy-button spinner in `look.css`; no underline (`text-decoration: none` on the credit link); a plain form without script. The failure alert is `role="alert"` and lasts 4 s.
- CRUD: the journey creates, reads after a reload, and deletes a follow. Its update is "none" by the brief's choice.
- Privacy and about copy present; the cookie is listed with the updated date.
- The PR body names every changed existing test and the edit to the `verify` skill.
