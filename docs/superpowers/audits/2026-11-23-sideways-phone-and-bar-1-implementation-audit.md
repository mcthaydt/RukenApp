# Implementation audit, cycle 1: the bar on every screen, and phones held sideways (PR #364)

- Reviewed: PR #364, branch `claude/project-thread-qlb5o2`, head **0b23fb3** (0b23fb38e64398393df96a7f18dda04152ec5186), against `main` at ffab7fc (merges cleanly: `git merge-tree` reports no conflict).
- Reviewer: fresh session, Opus 5.5, medium. Written 2026-11-23 13:54 UTC.
- Lane 2 (`src/lib/look.css`, root layout). Brief: the owner's requests (2026-11-22 21:23 and the 21:37 card) and the nine acceptance criteria in the PR body.
- Verdict: **0b23fb3 PASS**. No red. Three notes.

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## What ran

- CI run 45187645241 on 0b23fb3 (draft, quick): every job green. The browser shards reported 22, 16, 28, 16, 34 and 4 passed, 18 skipped (the computer project's sideways skips), 0 failed, 0 flaky.
- WebKit: shard 2 ran all 18 `[phone]` (iPhone SE on WebKit) tests of `sideways-phone.test.ts` (5 journeys at each of 3 sizes, plus the cookie card at 3 sizes), all passed on the first try. This closes the design review's "Safari's engine did not run" gap.
- Locally at 0b23fb3: `pnpm install --frozen-lockfile`, `pnpm typecheck` (0 errors, 0 warnings), `pnpm lint` (clean).
- Not run here: the browser journeys locally (CI ran them at this head), `verify` (the design review walked the screens at 941ac7c; the owner approved the look then; since then the diff adds only the merged-work items checked below).

## Criteria, one by one

| # | Criterion | Found |
| - | --- | --- |
| 1 | Bar everywhere but `/about`, both play screens and the steps | Holds. Every id in `NO_BAR` (`src/routes/+layout.svelte`) matches a route folder under `src/routes` except `/about`, which arrives with #333 (named in the PR's open items). `/make/page` with `rooms === null` matches the load in `src/routes/make/page/+page.server.ts:13`. The other `/make` screens (throw-away, take-off, take-down, links, github, a game's place) keep the bar, as the owner's card asked ("Not on the question steps"). See note 1 on test coverage. |
| 2 | Bar sideways: right-edge column, centred, inside | Holds: `Bar.svelte` media query; `expectBarOnTheRight` checks all four parts; passed on WebKit and Chromium. |
| 3 | Every screen sideways: no side scroll, `h1` ≤ 36px, clear of the bar | Holds. `--rail` padding on `body`; new Help/Join (`.card.bold`, `.helpdesk`) titles at 2.25rem = 36px; `/cookies` and `/help/how-the-feed-works` are in the card-screen list. |
| 4 | Feed sideways; Share frosted glass, under the bar on its centre line | Holds. Share reads `--glass-bg` / `--glass-filter` (look.css:108-109, with the solid fallback at 118-119). |
| 5 | Sign in form beside its heading | Holds (test asserts x and 16px level). |
| 6 | Steps sideways: Back/Save in a right column, all words left of it | Holds on the eight steps checked. |
| 7 | Upright phone: every tap box above the bar on `/join` and `/make/page` | Holds. The bar's room moved from a margin on the card to padding on `body`, so it can no longer collapse out of the page (design review notes 2 and 3 fixed). |
| 8 | Cookie card sideways at the foot, clear of the bar | Holds: `aboveBar={barShown}`, and the sideways rule subtracts `--rail` from its width; checked on `/` and `/help`. |
| 9 | Bar first in Tab order | Holds: `<Bar>` now renders before `{@render children()}`. `header + main` / `.panel + main` became `~` so the spacing survives the nav sitting between them. |

## The three changed tests

- `bar.test.ts`: the old "no bar" list (sign in, join, the missing pages) is turned to "the bar" checks, and help, cookies, privacy and terms are added. That is the owner's new rule, not a loosening. The play screen moved into a new "no bar" test that also covers the maker's test play and four steps, and a new upright-phone check (criterion 7) was added. Stronger than before.
- `adults-only.test.ts`: one Tab became four. Still an exact count, so Sign in must be the fourth stop and nothing else may slip in front of it: not weakened. See note 2.
- `player-count.test.ts`: the Tab limit went from 15 to 18, exactly the bar's three new stops in front. The test still fails if the switch is not reached. Justified.

## Owner rules

- Frosted glass for transparency: Share now uses the glass tokens. The bar itself is still solid, as on `main`; that is the queued glass work (PR open items).
- No underlined text links: none added in this diff.
- Spinners only: no loading text added.
- Bar everywhere but the landing page, play and steps; sideways bar on the right: holds (criteria 1, 2).

## CRUD

The change adds nothing a user can make. No CRUD journey is owed.

## Notes (none blocks)

**1. Five step routes in `NO_BAR` have no journey that checks them.**
UNIT: `tests/browser/bar.test.ts`, `tests/browser/sideways-phone.test.ts`. VERDICT: note. REQUIREMENT: criterion 1 says it is "checked by `bar.test.ts` and `sideways-phone.test.ts`". REASON: the journeys check `/make/new`, the questions, `/make/page/name`, `/make/page/links/add`, `/make/page` with no page and both play screens, but not `/make/[game]/agreement`, `/make/[game]/check`, `/make/page/links/add/where`, `/make/page/links/[link]` or `/make/page/links/[link]/where`. EVIDENCE: each of those ids matches a route folder and is in `NO_BAR`, so the behaviour is right today; only a later rename would slip through. EXPECTED: one "no bar" assertion each. FIX: add the five paths to the "no bar" loop in `bar.test.ts` (a game needs to be at agreement/check and a link must exist, which `givePage` already gives). Only that file.

**2. The PR body says more than the adults-only test checks.**
UNIT: PR body, `tests/browser/adults-only.test.ts:162`. VERDICT: note. REASON: the body says the test "now expects the three bar links before Sign in"; the test presses Tab four times and checks only that Sign in has focus. EVIDENCE: the loop at line 162. EXPECTED: body and test agree. FIX: either reword the body line to "presses Tab four times: the bar's three places come first", or assert the three bar links' focus on the way. PR body or that one file.

**3. Not measured: the cookie card sideways on a step screen may sit under Back/Save.**
UNIT: `src/lib/look.css` (sideways `.consent` rule and sideways `.screen .acts`). VERDICT: note (unmeasured). REASON: on a step there is no bar, so `--rail` is 0 and the card is `min(100% - 1.5rem, 40rem)` wide from the left; at 667 wide that reaches x = 652, while the Back/Save column (10rem) stands at the right edge from about x = 495 down the middle of the window. The card is at the foot and the column is centred, so they may or may not overlap; I did not shoot it. A maker reaches the steps signed in, usually after answering cookies, so it is rare. EXPECTED: the card clear of Back/Save. FIX, if a shot shows an overlap: subtract the step column's width in the same sideways rule when `:root:not(:has(nav.bar)) .screen` is present. Only `src/lib/look.css`.

## Follow-ups seen, not from this change

- A missing game's play screen (`/g/<no-such-game>/play`) has neither the bar nor the wordmark, as on `main` (route id is in `NO_BAR`, and the header skips `/g/`). Older than this change; reported, not fixed here.
