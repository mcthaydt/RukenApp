Task: lane 2 review of RukenApp PR #249 (slice 3 unit H, the maker's page)
Commit examined: 2ca2d5c
Next step: builder fixes F1 and F2; reviewer re-checks on the new head
Open decisions: none

# Implementation audit 1: the maker's page (unit H) at 2ca2d5c

Verdict: 2ca2d5c FAIL: 2 red

Ran here at 2ca2d5c: `pnpm lint` clean, `pnpm typecheck` 0 errors, `pnpm test` 1612 pass, `pnpm install --frozen-lockfile` ok. Not run here: browser journeys and pg tests (no Postgres in this container). CI on 2ca2d5c: postgres, verify, what-changed, commit-authors green; browser shard 2 red with `--max-failures=1`, so shards 1, 3, 4, 5, 6 were cancelled and gate is red. Commits are authored McThayDT, no Claude trailers, PR body ends with "Requested by **McThayDT**".

## Red

UNIT: tests/browser/maker-page.test.ts, `beforeAll` (lines 28 to 52)
VERDICT: red
REQUIREMENT: the checks must pass in CI before the PR is ready (Verification in CLAUDE.md; PR body "browser journeys run in CI").
REASON: the setup signs up three makers in a row with no rate-limit reset, and the shard fails there.
EVIDENCE: CI run 44850225491, job 136679618297 (shard 2, phone-landscape): `maker-page.test.ts:56` fails with `TimeoutError: locator.fill: Timeout 5000ms exceeded, waiting for getByLabel('Email')` at `support/account.ts:60` (signUp), called from `startDraft`, `gameWhere` at `maker-page.test.ts:34`, i.e. the first `gameWhere` after `addGame`. `forgetRateLimits` is only a `beforeEach` (line 53), so it has not run before `beforeAll`, while the site counts sign-ups per client address (5 an hour; `tests/browser/support/rate-limits.ts`). I could not open the Playwright report to see the page, so the sign-up limit is the likely cause, not proven.
EXPECTED: the setup signs up without meeting the limit, in every project and shard, and every journey in the file runs.
FIX: in `tests/browser/maker-page.test.ts` only: call `forgetRateLimits()` before each sign-up in `beforeAll` (before `addGame` and between the two `gameWhere` calls), as the sign-up journeys do; then read the error context if it still fails. Every journey after the first is unseen: five shards were cancelled, so H2 to H9 journeys have not run once on this head.

UNIT: docs/superpowers/live/claude-project-thread-ijqp94.md
VERDICT: red
REQUIREMENT: CLAUDE.md "Live state in a file": the session deletes its live-state file in its last commit before it hands the branch to the audit, so the audited commit is the one that merges.
REASON: the file is still in the PR and is stale.
EVIDENCE: `git diff origin/main...pr249 --stat` lists it (4 lines, "Last commit: 899525b (main, nothing of mine yet)", "Next step: matcher and its test...").
EXPECTED: no file under `docs/superpowers/live/` in the PR at the audited commit.
FIX: delete that one file in the fix commit (it is the last commit before re-audit).

## Checked, no defect found

- H1: `src/params/handle.ts` returns `isHandleShape(param)` only; `tests/params/handle.test.ts` covers shape, length bounds, capital, dot, hyphens, non-ASCII. Ruken's own screens are fixed routes (`make`, `join`, `me`, `g`, ...), which SvelteKit ranks above a matcher route; no route under `src/routes` collides with `[handle=handle]` or its `out/[link]` child.
- H2 to H4: `MakerPage.svelte` order is photo or initial, h1, @handle, one line, dots, Games section (article, h2 link, Play), Links nav; title `<name> · Ruken`; theme via custom properties set on `main`; no Games section without games and no Links nav without links; colours default to felt and chalk. Route files hold no class or style. 18+ games are filtered in the load (`ageRating !== "age_18"`, matches the enum in `prisma/schema/games.prisma`); newest first by `liveSince`.
- H5, H6: `tapLink` looks the link up with `hidden: false` and `page: { handle }`, so a hidden, foreign or made-up id gives null and the route answers 404 with nothing counted; the address comes from the database and must start with `https://`; the maker's own open (`userId: { not: viewer }`) and tap are not counted. Journeys cover 303, the three 404s, and the counts.
- H7: `arrival.remember` with the maker and `url.pathname`; the new `pay.test.ts` case asserts `broughtByUserId` and `arrivalPath`.
- H8: unknown handle gives `error(404)` and the layout keeps the wordmark on any status of 400 or more, so the missing page has its way back ("Back to Ruken"). Uppercase or dotted words do not match and reach the same page.
- H9: `overflow-wrap: anywhere`, 48px minimum on links and Play, `:focus-visible` outlines; journeys check them (unrun in CI, see red 1).
- H10: "Made by" links to `/<handle>`; `game-page` case checks the href.
- Edited checks named in the PR body: `tests/architecture.test.ts` (see note 2), `tests/browser/support/database.ts` (`givePage` keeps its old call shape and now returns `{ handle, linkIds }`; old callers ignore the result; `changeGame` gains optional fields; `pageCounts` is new), `pay.test.ts` and `game-page.test.ts` (one new case and one new assertion; no existing assertion weakened). Nothing is skipped or loosened except the architecture rule below.

## Notes (not blocking, not fixed here)

1. A hover on a link to a maker's page runs its load on the server. `src/app.html` has `data-sveltekit-preload-data="hover"`, so hovering "Made by" on a game's page (desktop) counts a view (`countView`) and sets the arrival cookie without anyone opening the page. H6 says a visitor's open counts. Bounded fix for the builder or unit D: `data-sveltekit-preload-data="off"` on that link, or count the view where only a real request makes it. Not reproduced by a journey; read from the code.
2. `tests/architecture.test.ts`: the spec (H task 4) said `MakerPage.svelte` is re-exported from `pages.browser.ts`; the builder instead let any `.svelte` file import another feature's `.svelte` file, because a matcher built by Node cannot load `.svelte` through the browser entry. The reason is real and disclosed, and the layer checks of the imported screen itself still apply. But the rule now permits any screen to import any feature's screens, wider than the one route that needs it, and `tests/architecture.test.ts` is listed under unit D, not H, in the spec's table. Unit D (which also edits this file) should tighten or keep it deliberately. Matcher stays on the browser entry only, which is right.
3. Known and left: a game named New or Github is shadowed by `/make/new` and `/make/github` (PR body; already in memory).
4. `MakerPage.svelte` loads a video for every game on the page with `preload="metadata"`; fine now, worth a cap if a maker can have many games.

# Cycle 2 to 5: re-checks

- ef3d854 FAIL: the out route answered 500 (SvelteKit needs `external` for a redirect to another site). Fixed in 5bf823c.
- 5bf823c FAIL: a 60-letter link title overflowed 320px (column flex with align-items:center). Fixed in 05ef5c6.
- 05ef5c6 FAIL: stray `undefined/long3.png` in the PR. Removed in 0444964.
- 0444964 PASS: PR file list has no stray file (15 files), CI green on this head (all browser shards, postgres, verify, gate); lint, typecheck and 1612 unit tests pass here. Reds 1 and 2 of cycle 1 fixed; the architecture rule is routes-only.
- Follow-up note: the builder reports a pay-step webkit failure on 05ef5c6 that passed on re-run. CLAUDE.md says a test that fails once and passes on retry is recorded under "Flaky tests" in docs/superpowers/history.md; not seen by me, left to the builder or coordinator.
- Notes still open, not blocking: hover preload counts a view on the "Made by" link.
